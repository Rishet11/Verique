'use client';

import { ExternalLink } from 'lucide-react';
import { getDomainFromUrl } from '@/lib/utils';
import { Source } from '@/lib/types';
import { SourceReputationBadge } from './SourceReputationBadge';

interface SourceComparisonProps {
  supporting: Source[];
  contradicting: Source[];
  reasoning?: string;
}

export function SourceComparison({ 
  supporting, 
  contradicting,
  reasoning
}: SourceComparisonProps) {
  if (supporting.length === 0 && contradicting.length === 0) {
    return null;
  }

  const hasConflict = supporting.length > 0 && contradicting.length > 0;

  return (
    <div className="mt-4 space-y-3">
      {hasConflict && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl shadow-lg border border-slate-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-yellow-500 font-bold tracking-wider text-xs uppercase">
              <span className="text-sm">⚠️</span> SOURCES DISAGREE
            </div>
            
            <div className="space-y-4">
              <div className="text-xs text-slate-400 font-mono">
                <span className="text-green-400 font-bold">Supporting ({supporting.slice(0, 2).map(s => getDomainFromUrl(s.url)).join(', ')}):</span>
                <p className="mt-1 line-clamp-2 italic">"{supporting[0]?.snippet}"</p>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                <span className="text-red-400 font-bold">Contradicting ({contradicting.slice(0, 2).map(s => getDomainFromUrl(s.url)).join(', ')}):</span>
                <p className="mt-1 line-clamp-2 italic">"{contradicting[0]?.snippet}"</p>
              </div>

              {reasoning && (
                <div className="pt-3 border-t border-slate-800">
                  <div className="text-xs font-bold text-slate-200 mb-1 font-mono uppercase tracking-tight">Our take:</div>
                  <div className="text-sm text-slate-300 leading-relaxed font-mono">
                    {reasoning}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasConflict && supporting.length > 0 && (
        <SourceList 
          title="Supporting Evidence" 
          sources={supporting} 
          color="green" 
        />
      )}

      {!hasConflict && contradicting.length > 0 && (
        <SourceList 
          title="Contradicting Evidence" 
          sources={contradicting} 
          color="red" 
        />
      )}
      
      {/* If there's a conflict, we still show the source lists below the banner for utility */}
      {hasConflict && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60 hover:opacity-100 transition-opacity">
          <SourceList 
            title="Supporting" 
            sources={supporting} 
            color="green" 
          />
          <SourceList 
            title="Contradicting" 
            sources={contradicting} 
            color="red" 
          />
        </div>
      )}
    </div>
  );
}

function SourceList({ title, sources, color }: {
  title: string;
  sources: Source[];
  color: 'green' | 'red';
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900'
  };

  return (
    <div className={`p-3 border rounded-lg ${colorClasses[color]}`}>
      <div className="font-semibold text-sm mb-2 flex items-center gap-1">
        <span>{color === 'green' ? '✓' : '✗'}</span> {title}
      </div>
      <ul className="space-y-2">
        {sources.map((source, i) => (
          <li key={i}>
            <a 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:bg-white/50 p-2 rounded transition-colors"
            >
                <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium hover:underline">
                    {getDomainFromUrl(source.url)}
                  </span>
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </div>
                {source.domain_score !== undefined && (
                  <SourceReputationBadge 
                    domain={getDomainFromUrl(source.url)} 
                    score={source.domain_score} 
                    compact 
                  />
                )}
              </div>
              <p className="text-xs opacity-90 line-clamp-2">
                {source.snippet}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
