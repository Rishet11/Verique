'use client';

import { Shield, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceReputationBadgeProps {
  domain: string;
  score: number;
  compact?: boolean;
}

// Trust tier configuration based on backend domain_reputation.py
const TRUST_TIERS = [
  { min: 0.90, label: 'Authoritative', color: 'bg-green-500', textColor: 'text-green-700', icon: '🟢' },
  { min: 0.80, label: 'Trusted', color: 'bg-blue-500', textColor: 'text-blue-700', icon: '🔵' },
  { min: 0.70, label: 'Reliable', color: 'bg-cyan-500', textColor: 'text-cyan-700', icon: '🔷' },
  { min: 0.50, label: 'Standard', color: 'bg-slate-400', textColor: 'text-slate-600', icon: '⚪' },
  { min: 0.30, label: 'Caution', color: 'bg-yellow-500', textColor: 'text-yellow-700', icon: '🟡' },
  { min: 0.00, label: 'Low Quality', color: 'bg-red-500', textColor: 'text-red-700', icon: '🔴' },
];

function getTrustTier(score: number) {
  return TRUST_TIERS.find(tier => score >= tier.min) || TRUST_TIERS[TRUST_TIERS.length - 1];
}

// Domain category mapping (inferred from common patterns)
function getDomainCategory(domain: string): string | null {
  const lowerDomain = domain.toLowerCase();
  
  // Government
  if (lowerDomain.endsWith('.gov') || lowerDomain.endsWith('.mil')) return 'Government';
  
  // Academic
  if (lowerDomain.endsWith('.edu') || lowerDomain.endsWith('.ac.uk')) return 'Academic';
  
  // Known categories
  const categoryMap: Record<string, string> = {
    // News
    'reuters.com': 'News', 'apnews.com': 'News', 'bbc.com': 'News', 'bbc.co.uk': 'News',
    'nytimes.com': 'News', 'washingtonpost.com': 'News', 'wsj.com': 'News',
    'theguardian.com': 'News', 'cnn.com': 'News', 'npr.org': 'News',
    
    // Science
    'nature.com': 'Science', 'science.org': 'Science', 'pnas.org': 'Science',
    'arxiv.org': 'Research', 'ieee.org': 'Research', 'acm.org': 'Research',
    
    // Medical
    'nejm.org': 'Medical', 'thelancet.com': 'Medical', 'bmj.com': 'Medical',
    'who.int': 'Health', 'cdc.gov': 'Health', 'nih.gov': 'Health',
    
    // Reference
    'wikipedia.org': 'Reference', 'britannica.com': 'Reference',
    
    // Tech
    'github.com': 'Tech', 'stackoverflow.com': 'Tech', 'w3.org': 'Standards',
    
    // Fact-checking
    'factcheck.org': 'Fact-Check', 'snopes.com': 'Fact-Check', 'politifact.com': 'Fact-Check',
    
    // Data
    'worldbank.org': 'Data', 'imf.org': 'Data', 'oecd.org': 'Data',
    
    // Space/Climate
    'nasa.gov': 'Science', 'noaa.gov': 'Climate',
  };
  
  // Check exact match first
  if (categoryMap[lowerDomain]) return categoryMap[lowerDomain];
  
  // Check subdomain match
  for (const [known, category] of Object.entries(categoryMap)) {
    if (lowerDomain.endsWith('.' + known)) return category;
  }
  
  return null;
}

export function SourceReputationBadge({ domain, score, compact = false }: SourceReputationBadgeProps) {
  const tier = getTrustTier(score);
  const category = getDomainCategory(domain);
  const percentage = Math.round(score * 100);
  
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span 
          className={cn("w-2 h-2 rounded-full", tier.color)}
          title={`${tier.label} source (${percentage}%)`}
        />
        <span className={cn("text-xs font-medium", tier.textColor)}>
          {percentage}%
        </span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className={cn("w-2.5 h-2.5 rounded-full", tier.color)} />
        <span className={cn("text-xs font-semibold", tier.textColor)}>
          {tier.label}
        </span>
      </div>
      
      {category && (
        <span className="text-xs text-slate-500 border-l border-slate-300 pl-2">
          {category}
        </span>
      )}
      
      <span className="text-xs text-slate-400 ml-auto">
        {percentage}%
      </span>
    </div>
  );
}

// Explanation component for when user hovers/clicks for more info
export function SourceReputationExplainer({ score }: { score: number }) {
  const tier = getTrustTier(score);
  const percentage = Math.round(score * 100);
  
  const explanations: Record<string, string> = {
    'Authoritative': 'Established authority in its field. Rigorous editorial standards.',
    'Trusted': 'Well-known, professional organization with fact-checking processes.',
    'Reliable': 'Generally accurate. May have occasional bias but factually sound.',
    'Standard': 'Unknown or unverified. Treat claims with appropriate skepticism.',
    'Caution': 'Mixed track record or known bias. Cross-reference with other sources.',
    'Low Quality': 'Known issues with accuracy. Not recommended as primary source.',
  };
  
  return (
    <div className="text-xs p-2 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("w-2.5 h-2.5 rounded-full", tier.color)} />
        <span className="font-semibold">{tier.label}</span>
        <span className="text-slate-400">({percentage}%)</span>
      </div>
      <p className="text-slate-600">{explanations[tier.label]}</p>
    </div>
  );
}
