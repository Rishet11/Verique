"""
Claim Decomposer Agent - Extracts factual claims from text
"""
from typing import List, Dict, Any
import json
import uuid
import structlog
from groq import AsyncGroq
from pydantic import BaseModel, Field

from app.core.config import settings

logger = structlog.get_logger()


class ExtractedClaim(BaseModel):
    """Schema for extracted claims."""
    text: str = Field(description="The exact claim text from the source")
    span_start: int = Field(description="Character offset where claim starts")
    span_end: int = Field(description="Character offset where claim ends")
    claim_type: str = Field(description="Type: numeric, entity, temporal, comparative, causal, general")
    topic: str = Field(description="Topic: ecommerce, saas, tech, finance, health, education, professional, general")
    time_sensitivity: str = Field(description="Time sensitivity: high, medium, low")


CLAIM_EXTRACTION_PROMPT = """You are an expert at identifying factual claims in text.

Your task is to extract all factual claims from the given text. Focus on:
1. **Numeric claims** - Statistics, percentages, counts, measurements
2. **Entity claims** - Facts about companies, products, people
3. **Temporal claims** - Dates, timeframes, sequences
4. **Comparative claims** - Comparisons between things
5. **Causal claims** - Cause-effect statements

DO NOT extract:
- Pure opinions or subjective statements
- Questions
- Hypotheticals or speculations
- Generic marketing fluff without specific claims

For each claim, provide:
- The exact text of the claim
- Character positions (span_start, span_end)
- Claim type
- Topic category
- Time sensitivity (how quickly might this become outdated)

Content vertical hint: {vertical}

TEXT TO ANALYZE:
{text}

Return your analysis as a JSON object with a "claims" array. Example format:
{{
    "claims": [
        {{
            "text": "claim text here",
            "span_start": 0,
            "span_end": 20,
            "claim_type": "numeric",
            "topic": "saas",
            "time_sensitivity": "high"
        }}
    ]
}}

Limit to the {max_claims} most significant claims.
Return ONLY valid JSON, no other text."""


class ClaimDecomposerAgent:
    """
    Extracts factual claims from text using Groq LLM (FREE).
    
    Uses Llama 3.1 70B on Groq for reliable claim extraction.
    """
    
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.LLM_MODEL
    
    async def extract_claims(
        self,
        text: str,
        vertical: str = "general",
        max_claims: int = None
    ) -> List[Dict[str, Any]]:
        """
        Extract factual claims from text.
        
        Args:
            text: The text to analyze
            vertical: Content category hint
            max_claims: Maximum number of claims to extract
            
        Returns:
            List of extracted claims with metadata
        """
        max_claims = max_claims or settings.MAX_CLAIMS_PER_ARTICLE
        
        logger.info("Extracting claims", text_length=len(text), vertical=vertical)
        
        try:
            # Format prompt
            prompt = CLAIM_EXTRACTION_PROMPT.format(
                text=text[:12000],  # Limit text length for context window
                vertical=vertical,
                max_claims=max_claims
            )
            
            # Call Groq API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a claim extraction expert. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=4000
            )
            
            # Parse response
            content = response.choices[0].message.content
            
            # Extract JSON from response
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(content[start:end])
            else:
                raise ValueError("Could not parse claims JSON")
            
            claims = result.get("claims", [])
            
            # Add unique IDs
            for i, claim in enumerate(claims):
                claim["id"] = f"clm_{uuid.uuid4().hex[:8]}"
                claim["is_verifiable"] = True
            
            # Fix overlapping spans
            claims = self._fix_overlapping_spans(claims)
            
            logger.info("Claims extracted", count=len(claims))
            return claims
            
        except Exception as e:
            logger.error("Claim extraction failed", error=str(e))
            # Return empty list on failure, let pipeline continue
            return []
    
    def _fix_overlapping_spans(self, claims: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Fix overlapping spans by adjusting or removing overlapping claims.
        Sort by start position and ensure no overlaps.
        """
        if not claims:
            return claims
        
        # Sort by span_start
        sorted_claims = sorted(claims, key=lambda c: c.get("span_start", 0))
        
        fixed_claims = []
        last_end = 0
        
        for claim in sorted_claims:
            start = claim.get("span_start", 0)
            end = claim.get("span_end", 0)
            
            # Apply -1 offset to fix LLM position calculation
            start = max(0, start - 1)
            end = max(0, end - 1)
            
            # Update claim with corrected positions
            claim["span_start"] = start
            claim["span_end"] = end
            
            # Skip invalid spans
            if end <= start:
                continue
            
            # If this claim overlaps with previous, skip it
            if start < last_end:
                logger.debug("Skipping overlapping claim", text=claim.get("text", "")[:30])
                continue
            
            fixed_claims.append(claim)
            last_end = end
        
        return fixed_claims
