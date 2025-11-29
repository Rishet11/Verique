"""
Verification Service - Orchestrates the multi-agent verification pipeline
"""
from typing import Dict, Any, List, Optional
import math
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import Vertical, ClaimResult, VerificationSummary
from app.agents.pipeline import VerificationPipeline

logger = structlog.get_logger()


class VerificationService:
    """
    Main service for orchestrating content verification.
    Uses LangGraph multi-agent pipeline for claim extraction and verification.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.pipeline = VerificationPipeline()
    
    async def verify(
        self,
        text: str,
        url: Optional[str] = None,
        vertical: Optional[Vertical] = Vertical.GENERAL,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Run full verification pipeline on text content.
        
        Args:
            text: The text content to verify
            url: Optional source URL
            vertical: Content category for optimized processing
            language: Content language
            
        Returns:
            Dictionary containing claims, verdicts, scores, and metadata
        """
        logger.info(
            "Starting verification service",
            text_length=len(text),
            vertical=vertical,
            language=language
        )
        
        # Run the multi-agent pipeline
        result = await self.pipeline.run(
            text=text,
            url=url,
            vertical=vertical.value if vertical else "general",
            language=language
        )
        
        # Calculate page score
        page_score = self._calculate_page_score(result["claims"])
        
        # Generate summary
        summary = self._generate_summary(result["claims"])
        
        return {
            "claims": result["claims"],
            "page_score": page_score,
            "summary": summary,
            "models_used": result.get("models_used", ["gpt-4o"]),
            "sources_checked": result.get("sources_checked", 0)
        }
    
    def _calculate_page_score(self, claims: List[ClaimResult]) -> int:
        """
        Calculate overall page score based on claim verdicts.
        IMPROVED ALGORITHM:
        - Properly rewards many supporting sources
        - Uses source count and support ratio
        - Logarithmic scaling for source count bonus
        """
        if not claims:
            return 50  # Neutral score for no claims
        
        # Enhanced verdict weights with better scaling
        verdict_weights = {
            "strongly_supported": 1.0,   # Perfect score
            "supported": 0.85,            # Very good
            "mixed": 0.50,                # Neutral
            "weak": 0.35,                 # Below average
            "contradicted": 0.10,         # Poor
            "outdated": 0.40,             # Slightly below neutral
            "not_verifiable": 0.50        # Neutral (not the claim's fault)
        }
        
        # Count total sources supporting vs contradicting
        total_supporting = 0
        total_contradicting = 0
        
        total_weight = 0
        weighted_sum = 0
        
        for i, claim in enumerate(claims):
            # Count sources for this claim
            supporting_count = len(claim.sources.supporting)
            contradicting_count = len(claim.sources.contradicting)
            
            total_supporting += supporting_count
            total_contradicting += contradicting_count
            
            # Position weight: Earlier claims are more important
            position_weight = 1.0 + (0.3 / (i + 1))
            
            # Get base verdict score
            verdict_score = verdict_weights.get(claim.verdict.value, 0.5)
            
            # Apply confidence multiplier
            base_score = verdict_score * claim.confidence
            
            # Source count bonus: Logarithmic scaling
            # More sources = higher confidence in the score
            total_sources = supporting_count + contradicting_count
            if total_sources > 0:
                # Support ratio bonus
                support_ratio = supporting_count / total_sources if total_sources > 0 else 0
                
                # Apply sigmoid-like curve for support ratio
                support_bonus = (support_ratio ** 0.7) * 0.15
                
                # Source count bonus (logarithmic)
                source_bonus = min(0.15, 0.08 * math.log(supporting_count + 1))
                
                # Combine bonuses
                final_score = base_score + support_bonus + source_bonus
                final_score = min(1.0, final_score)  # Cap at 1.0
            else:
                final_score = base_score
            
            weighted_sum += final_score * position_weight
            total_weight += position_weight
        
        if total_weight == 0:
            return 50
        
        # Calculate base score (0-100)
        base_page_score = int((weighted_sum / total_weight) * 100)
        
        # Apply global source bonus
        # If the page has many supporting sources overall, boost the score
        if total_supporting > 0:
            total_sources = total_supporting + total_contradicting
            global_support_ratio = total_supporting / total_sources
            
            # Global bonus for high support ratio with many sources
            if global_support_ratio >= 0.7 and total_supporting >= 5:
                global_bonus = min(10, 2 * math.log(total_supporting))
                base_page_score += int(global_bonus)
            elif global_support_ratio >= 0.8 and total_supporting >= 3:
                global_bonus = min(8, 1.5 * math.log(total_supporting))
                base_page_score += int(global_bonus)
        
        # Cap final score at 100
        final_page_score = min(100, max(0, base_page_score))
        
        logger.info(
            "Page score calculation",
            base_score=base_page_score,
            final_score=final_page_score,
            total_supporting=total_supporting,
            total_contradicting=total_contradicting,
            claim_count=len(claims)
        )
        
        return final_page_score
    
    def _generate_summary(self, claims: List[ClaimResult]) -> VerificationSummary:
        """Generate summary of verdict counts."""
        summary = VerificationSummary()
        
        for claim in claims:
            verdict = claim.verdict.value
            if verdict == "strongly_supported":
                summary.strongly_supported += 1
            elif verdict == "supported":
                summary.supported += 1
            elif verdict == "mixed":
                summary.mixed += 1
            elif verdict == "weak":
                summary.weak += 1
            elif verdict == "contradicted":
                summary.contradicted += 1
            elif verdict == "outdated":
                summary.outdated += 1
            else:
                summary.not_verifiable += 1
        
        return summary
