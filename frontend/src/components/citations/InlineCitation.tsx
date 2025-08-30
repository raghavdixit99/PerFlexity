/**
 * InlineCitation Component
 * 
 * Renders citations inline within text content with interactive hover/click behavior.
 * Designed to be embedded seamlessly in message text with minimal visual disruption.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../ui/utils';
import { CitationData, CitationDisplayProps } from './types';
import { SourceHoverPreview, SourcePopoverPreview } from './SourcePreview';
import { extractDomain } from './utils';

interface InlineCitationProps extends CitationDisplayProps {
  text?: string; // Custom text to display, defaults to [index]
  showPreviewOnHover?: boolean;
  showPreviewOnClick?: boolean;
  underline?: boolean;
  highlighted?: boolean;
  children?: React.ReactNode;
}

/**
 * Basic inline citation that appears as a clickable reference within text
 */
export function InlineCitation({
  citation,
  index,
  text,
  showPreviewOnHover = true,
  showPreviewOnClick = true,
  underline = true,
  highlighted = false,
  onClick,
  onHover,
  className,
  children,
}: InlineCitationProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (showPreviewOnClick) {
      setShowPopover(true);
    }
    onClick?.(citation);
  }, [citation, onClick, showPreviewOnClick]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHover?.(citation);
  }, [citation, onHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const displayText = text || `[${index || '?'}]`;
  const title = `Citation ${index}: ${citation.title || extractDomain(citation.url)}`;

  const citationElement = (
    <button
      className={cn(
        'inline text-primary hover:text-primary/80 transition-colors duration-200',
        'font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 rounded',
        underline && 'underline decoration-dotted underline-offset-2',
        highlighted && 'bg-primary/10 px-1 rounded',
        isHovered && 'bg-primary/5',
        className
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={title}
      aria-label={title}
    >
      {children || displayText}
    </button>
  );

  // Use hover preview for desktop, click for mobile
  const isTouchDevice = typeof window !== 'undefined' && 
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (isTouchDevice || !showPreviewOnHover) {
    return (
      <SourcePopoverPreview
        citation={citation}
        isOpen={showPopover}
        onClose={() => setShowPopover(false)}
      >
        {citationElement}
      </SourcePopoverPreview>
    );
  }

  return (
    <SourceHoverPreview citation={citation}>
      {citationElement}
    </SourceHoverPreview>
  );
}

/**
 * Superscript citation for academic-style references
 */
export function SuperscriptCitation({
  citation,
  index,
  onClick,
  onHover,
  className,
}: Pick<InlineCitationProps, 'citation' | 'index' | 'onClick' | 'onHover' | 'className'>) {
  return (
    <InlineCitation
      citation={citation}
      index={index}
      onClick={onClick}
      onHover={onHover}
      underline={false}
      className={cn('text-xs align-super', className)}
    />
  );
}

/**
 * Footnote-style citation that appears at the bottom of content
 */
export function FootnoteCitation({
  citation,
  index,
  onClick,
  onHover,
  className,
}: Pick<InlineCitationProps, 'citation' | 'index' | 'onClick' | 'onHover' | 'className'>) {
  return (
    <InlineCitation
      citation={citation}
      index={index}
      text={`${index}.`}
      onClick={onClick}
      onHover={onHover}
      underline={false}
      className={cn('mr-2', className)}
    />
  );
}

/**
 * Highlighted citation that shows the source text with background
 */
export function HighlightedCitation({
  citation,
  index,
  children,
  onClick,
  onHover,
  className,
}: Pick<InlineCitationProps, 'citation' | 'index' | 'children' | 'onClick' | 'onHover' | 'className'>) {
  return (
    <InlineCitation
      citation={citation}
      index={index}
      onClick={onClick}
      onHover={onHover}
      highlighted={true}
      underline={false}
      className={cn('font-normal', className)}
    >
      {children}
    </InlineCitation>
  );
}

/**
 * Citation marker for parsed text content
 * Used internally by citation parsing utilities
 */
export function CitationMarker({
  citationId,
  index,
  citations,
  originalText,
  onClick,
  onHover,
  className,
}: {
  citationId: string;
  index?: number;
  citations: Map<string, CitationData>;
  originalText: string;
  onClick?: (citation: CitationData) => void;
  onHover?: (citation: CitationData) => void;
  className?: string;
}) {
  const citation = citations.get(citationId);
  
  if (!citation) {
    // Fallback for missing citations
    return <span className="text-muted-foreground">{originalText}</span>;
  }

  return (
    <InlineCitation
      citation={citation}
      index={index}
      text={originalText}
      onClick={onClick}
      onHover={onHover}
      className={className}
    />
  );
}

/**
 * Hook for managing inline citation interactions
 */
export function useInlineCitations() {
  const [activeCitation, setActiveCitation] = useState<CitationData | null>(null);
  const [hoveredCitation, setHoveredCitation] = useState<CitationData | null>(null);

  const handleCitationClick = useCallback((citation: CitationData) => {
    setActiveCitation(citation);
    // Could trigger analytics, opening in new tab, etc.
  }, []);

  const handleCitationHover = useCallback((citation: CitationData) => {
    setHoveredCitation(citation);
  }, []);

  const clearActive = useCallback(() => {
    setActiveCitation(null);
  }, []);

  const clearHovered = useCallback(() => {
    setHoveredCitation(null);
  }, []);

  return {
    activeCitation,
    hoveredCitation,
    handleCitationClick,
    handleCitationHover,
    clearActive,
    clearHovered,
  };
}

/**
 * Provider component for citation context (if needed for complex citation management)
 */
export function CitationProvider({ 
  children,
  citations = new Map(),
}: { 
  children: React.ReactNode;
  citations?: Map<string, CitationData>;
}) {
  const citationHandlers = useInlineCitations();

  return (
    <div data-citation-context="true">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === CitationMarker) {
          return React.cloneElement(child as React.ReactElement<any>, {
            citations,
            onClick: citationHandlers.handleCitationClick,
            onHover: citationHandlers.handleCitationHover,
          });
        }
        return child;
      })}
    </div>
  );
}
