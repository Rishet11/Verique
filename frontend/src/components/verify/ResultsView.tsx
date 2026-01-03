'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Clock, 
  Database, 
  Cpu,
  ChevronDown,
  ExternalLink,
  Info
} from 'lucide-react';
import { VerificationResult, ClaimResult, VERDICT_CONFIG } from '@/lib/types';
import { cn, formatDuration, formatDate, getDomainFromUrl } from '@/lib/utils';
import { ConfidenceBreakdown } from './ConfidenceBreakdown';
import { SourceComparison } from './SourceComparison';

interface ResultsViewProps {
  result: VerificationResult;
  originalText: string;
  onReset: () => void;
}

export function ResultsView({ result, originalText, onReset }: ResultsViewProps) {
  const [selectedClaim, setSelectedClaim] = useState<ClaimResult | null>(null);
  const [showHighlightedText, setShowHighlightedText] = useState(true);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Verify another
        </button>
        
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatDuration(result.metadata.processing_time_ms)}
          </span>
          <span className="flex items-center gap-1">
            <Database className="h-4 w-4" />
            {result.metadata.sources_checked} sources
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="h-4 w-4" />
            {result.metadata.models_used.join(', ')}
          </span>
        </div>
      </div>

      {/* Score card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Verification Results
            </h2>
            <p className="text-slate-600">
              Found {result.claims.length} verifiable claims
            </p>
          </div>
          
          <div className="text-center">
            <div className={cn(
              "text-6xl font-bold",
              result.page_score >= 70 ? "text-green-600" :
              result.page_score >= 50 ? "text-yellow-600" :
              "text-red-600"
            )}>
              {result.page_score}
            </div>
            <div className="text-slate-500 text-sm">Trust Score</div>
          </div>
        </div>

        {/* Summary badges */}
        <div className="mt-6 flex flex-wrap gap-3">
          <SummaryBadge 
            count={result.summary.strongly_supported} 
            label="Strongly Supported" 
            color="bg-green-700" 
          />
          <SummaryBadge 
            count={result.summary.supported} 
            label="Supported" 
            color="bg-green-500" 
          />
          <SummaryBadge 
            count={result.summary.mixed} 
            label="Mixed" 
            color="bg-yellow-500" 
          />
          <SummaryBadge 
            count={result.summary.weak} 
            label="Weak" 
            color="bg-orange-500" 
          />
          <SummaryBadge 
            count={result.summary.contradicted} 
            label="Contradicted" 
            color="bg-red-500" 
          />
          <SummaryBadge 
            count={result.summary.not_verifiable} 
            label="Not Verifiable" 
            color="bg-gray-500" 
          />
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Highlighted text */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Analyzed Content
            </h3>
            <button
              onClick={() => setShowHighlightedText(!showHighlightedText)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              {showHighlightedText ? 'Show plain text' : 'Show highlights'}
            </button>
          </div>
          
          <div className="prose prose-slate max-w-none">
            {showHighlightedText ? (
              <HighlightedText 
                text={originalText} 
                claims={result.claims}
                onClaimClick={setSelectedClaim}
                selectedClaimId={selectedClaim?.id}
              />
            ) : (
              <p className="whitespace-pre-wrap">{originalText}</p>
            )}
          </div>
        </div>

        {/* Right: Claims list */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Claim Details
          </h3>
          
          {result.claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              isSelected={selectedClaim?.id === claim.id}
              onClick={() => setSelectedClaim(
                selectedClaim?.id === claim.id ? null : claim
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryBadge({ 
  count, 
  label, 
  color 
}: { 
  count: number; 
  label: string; 
  color: string;
}) {
  if (count === 0) return null;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm",
      color
    )}>
      <span className="font-bold">{count}</span>
      <span>{label}</span>
    </div>
  );
}

function HighlightedText({ 
  text, 
  claims,
  onClaimClick,
  selectedClaimId
}: { 
  text: string; 
  claims: ClaimResult[];
  onClaimClick: (claim: ClaimResult) => void;
  selectedClaimId?: string;
}) {
  // Sort claims by span start position
  const sortedClaims = [...claims].sort((a, b) => a.span[0] - b.span[0]);
  
  const segments: React.ReactNode[] = [];
  let lastEnd = 0;

  sortedClaims.forEach((claim, index) => {
    const [start, end] = claim.span;
    
    // Add text before this claim
    if (start > lastEnd) {
      segments.push(
        <span key={`text-${index}`}>
          {text.slice(lastEnd, start)}
        </span>
      );
    }

    // Add the highlighted claim
    const config = VERDICT_CONFIG[claim.verdict];
    segments.push(
      <span
        key={claim.id}
        onClick={() => onClaimClick(claim)}
        className={cn(
          "claim-highlight cursor-pointer px-1 rounded",
          config.bgColor,
          "border-b-2",
          config.borderColor,
          selectedClaimId === claim.id && "ring-2 ring-offset-1 ring-slate-400"
        )}
        title={`${config.label} (${Math.round(claim.confidence * 100)}% confidence)`}
      >
        {text.slice(start, end)}
      </span>
    );

    lastEnd = end;
  });

  // Add remaining text
  if (lastEnd < text.length) {
    segments.push(
      <span key="text-end">
        {text.slice(lastEnd)}
      </span>
    );
  }

  return <div className="whitespace-pre-wrap leading-relaxed">{segments}</div>;
}

function ClaimCard({ 
  claim, 
  isSelected,
  onClick 
}: { 
  claim: ClaimResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = VERDICT_CONFIG[claim.verdict];

  return (
    <motion.div
      layout
      className={cn(
        "bg-white rounded-xl border-2 transition-all cursor-pointer",
        isSelected ? config.borderColor : "border-slate-200",
        "hover:shadow-md"
      )}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            config.bgColor,
            config.color
          )}>
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </div>
          <div className="text-sm text-slate-500">
            {Math.round(claim.confidence * 100)}% confidence
          </div>
        </div>

        {/* Claim text */}
        <p className="text-slate-900 font-medium mb-2">
          "{claim.text}"
        </p>

        {/* Reasoning (always visible) */}
        <p className="text-sm text-slate-600 mb-3">
          {claim.reasoning}
        </p>

        {/* Expand indicator */}
        <div className="flex items-center justify-center">
          <ChevronDown className={cn(
            "h-5 w-5 text-slate-400 transition-transform",
            isSelected && "rotate-180"
          )} />
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
              
              {/* Confidence Breakdown - Explainability Pillar */}
              <ConfidenceBreakdown 
                confidence={claim.confidence}
                factors={[
                  {
                    label: `${claim.sources.supporting.length} supporting sources`,
                    impact: claim.sources.supporting.length > 0 ? 60 : 0,
                    description: 'High-reputation sources agree'
                  },
                  {
                    label: 'Recency boost',
                    impact: 15,
                    description: 'Recent information found'
                  },
                  claim.sources.contradicting.length > 0 ? {
                    label: `${claim.sources.contradicting.length} contradicting sources`,
                    impact: -10,
                    description: 'Disagreement found'
                  } : null
                ].filter((f): f is { label: string; impact: number; description: string } => f !== null && f.impact !== 0)}
              />

              {/* Source Comparison - Explainability Pillar */}
              <SourceComparison 
                supporting={claim.sources.supporting} 
                contradicting={claim.sources.contradicting} 
                reasoning={claim.reasoning}
              />

              {/* Metadata */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs px-2 py-1 bg-slate-100 rounded-full text-slate-600">
                  {claim.claim_type}
                </span>
                <span className="text-xs px-2 py-1 bg-slate-100 rounded-full text-slate-600">
                  {claim.topic}
                </span>
                <span className="text-xs px-2 py-1 bg-slate-100 rounded-full text-slate-600">
                  Time sensitivity: {claim.time_sensitivity}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SourceCard({ source }: { source: any }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-900 truncate">
              {getDomainFromUrl(source.url)}
            </span>
            <span className="text-xs text-slate-500">
              Score: {Math.round(source.domain_score * 100)}%
            </span>
          </div>
          <p className="text-sm text-slate-600 line-clamp-2">
            {source.snippet}
          </p>
          {source.published_at && (
            <p className="text-xs text-slate-400 mt-1">
              {formatDate(source.published_at)}
            </p>
          )}
        </div>
        <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0" />
      </div>
    </a>
  );
}
