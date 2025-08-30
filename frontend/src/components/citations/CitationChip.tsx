/**
 * CitationChip Component
 * 
 * Interactive citation component that displays as a clickable chip/badge.
 * Supports hover states, click actions, and various display variants.
 */

import React, { useState, useCallback } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { CitationDisplayProps, CitationData } from './types';
import { formatCitationTitle, extractDomain, getCitationColor } from './utils';

interface CitationChipProps extends CitationDisplayProps {
  showIndex?: boolean;
  showDomain?: boolean;
  interactive?: boolean;
  color?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline';
}

export function CitationChip({
  citation,
  index,
  size = 'sm',
  showIndex = true,
  showDomain = false,
  interactive = true,
  color,
  onClick,
  onHover,
  className,
}: CitationChipProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(citation);
  }, [citation, onClick]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHover?.(citation);
  }, [citation, onHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const displayText = formatCitationTitle(citation);
  const domain = extractDomain(citation.url);
  const citationColor = color || getCitationColor(citation.relevance_score);
  
  const chipVariant = (() => {
    switch (citationColor) {
      case 'green': return 'default';
      case 'blue': return 'secondary';
      case 'yellow': return 'outline';
      case 'red': return 'destructive';
      default: return 'secondary';
    }
  })();

  const sizeClasses = {
    sm: 'text-xs h-5 px-2 gap-1',
    md: 'text-sm h-6 px-3 gap-1.5',
    lg: 'text-base h-7 px-4 gap-2',
  };

  return (
    <Badge
      variant={chipVariant}
      className={cn(
        'inline-flex items-center font-medium transition-all duration-200 cursor-pointer select-none',
        sizeClasses[size],
        interactive && [
          'hover:scale-105 hover:shadow-md',
          isHovered && 'ring-2 ring-primary/20',
        ],
        !interactive && 'cursor-default',
        className
      )}
      onClick={interactive ? handleClick : undefined}
      onMouseEnter={interactive ? handleMouseEnter : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
      title={`${citation.title || domain} - ${citation.snippet}`}
    >
      {showIndex && index !== undefined && (
        <span className="font-semibold">
          {index}
        </span>
      )}
      
      <FileText className={cn(
        'flex-shrink-0',
        size === 'sm' && 'w-3 h-3',
        size === 'md' && 'w-3.5 h-3.5',
        size === 'lg' && 'w-4 h-4'
      )} />
      
      {showDomain ? domain : (displayText.length > 20 ? displayText.slice(0, 17) + '...' : displayText)}
      
      {interactive && (
        <ExternalLink className={cn(
          'flex-shrink-0 opacity-60',
          size === 'sm' && 'w-2.5 h-2.5',
          size === 'md' && 'w-3 h-3',
          size === 'lg' && 'w-3.5 h-3.5'
        )} />
      )}
    </Badge>
  );
}

/**
 * Numbered Citation Chip
 * Simplified version that just shows a number
 */
export function NumberedCitationChip({
  citation,
  index,
  size = 'sm',
  onClick,
  onHover,
  className,
}: Pick<CitationChipProps, 'citation' | 'index' | 'size' | 'onClick' | 'onHover' | 'className'>) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(citation);
  }, [citation, onClick]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHover?.(citation);
  }, [citation, onHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const sizeClasses = {
    sm: 'text-xs h-4 w-4 min-w-[16px]',
    md: 'text-sm h-5 w-5 min-w-[20px]',
    lg: 'text-base h-6 w-6 min-w-[24px]',
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-full cursor-pointer',
        'transition-all duration-200 hover:scale-110 hover:shadow-md',
        isHovered && 'ring-2 ring-primary/20',
        sizeClasses[size],
        className
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={`Citation ${index}: ${citation.title || extractDomain(citation.url)}`}
    >
      {index || '?'}
    </Badge>
  );
}

/**
 * Minimal Citation Chip
 * Ultra-compact version for inline use
 */
export function MinimalCitationChip({
  citation,
  index,
  onClick,
  onHover,
  className,
}: Pick<CitationChipProps, 'citation' | 'index' | 'onClick' | 'onHover' | 'className'>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center',
        'text-xs font-medium text-primary hover:text-primary/80',
        'underline decoration-dotted underline-offset-2',
        'transition-colors duration-200 cursor-pointer',
        'h-4 px-1 rounded',
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(citation);
      }}
      onMouseEnter={() => onHover?.(citation)}
      title={`Citation ${index}: ${citation.title || extractDomain(citation.url)}`}
    >
      [{index}]
    </button>
  );
}
