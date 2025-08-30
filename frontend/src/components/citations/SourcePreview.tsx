/**
 * SourcePreview Component
 * 
 * Displays citation source information in hover cards, popovers, or dialogs.
 * Shows title, domain, snippet, and metadata with proper formatting.
 */

import React, { useState, useCallback } from 'react';
import { ExternalLink, Calendar, User, Star, Globe } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';
import { SourcePreviewProps, CitationData } from './types';
import { extractDomain, truncateText, getFaviconUrl } from './utils';

interface SourcePreviewContentProps {
  citation: CitationData;
  variant?: 'compact' | 'detailed';
  showActions?: boolean;
  onVisitSource?: (citation: CitationData) => void;
  className?: string;
}

/**
 * Content component that shows citation details
 */
function SourcePreviewContent({
  citation,
  variant = 'compact',
  showActions = true,
  onVisitSource,
  className,
}: SourcePreviewContentProps) {
  const domain = extractDomain(citation.url);
  const faviconUrl = getFaviconUrl(citation.url);
  
  const handleVisitSource = useCallback(() => {
    onVisitSource?.(citation);
    window.open(citation.url, '_blank', 'noopener,noreferrer');
  }, [citation, onVisitSource]);

  const formatRelevanceScore = (score?: number) => {
    if (!score) return null;
    const percentage = Math.round(score * 100);
    const variant = score >= 0.8 ? 'default' : score >= 0.6 ? 'secondary' : 'outline';
    return (
      <Badge variant={variant} className="text-xs">
        <Star className="w-3 h-3 mr-1" />
        {percentage}% relevant
      </Badge>
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with favicon and title */}
      <div className="flex items-start gap-3">
        <img
          src={faviconUrl}
          alt={`${domain} favicon`}
          className="w-4 h-4 mt-0.5 flex-shrink-0"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-tight line-clamp-2">
            {citation.title || 'Untitled Source'}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Globe className="w-3 h-3" />
            <span className="truncate">{domain}</span>
          </div>
        </div>
      </div>

      {/* Snippet */}
      <div className="text-sm text-muted-foreground leading-relaxed">
        <p className="line-clamp-3">
          {citation.snippet || 'No preview available for this source.'}
        </p>
      </div>

      {/* Metadata */}
      {variant === 'detailed' && citation.metadata && (
        <div className="space-y-2">
          <Separator />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {citation.metadata.author && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{citation.metadata.author}</span>
              </div>
            )}
            {citation.metadata.publish_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{new Date(citation.metadata.publish_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Relevance Score and Actions */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {formatRelevanceScore(citation.relevance_score)}
        </div>
        {showActions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleVisitSource}
            className="h-7 px-2 text-xs"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Visit
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Hover Card Preview
 * Shows on hover with automatic positioning
 */
export function SourceHoverPreview({
  citation,
  children,
  className,
  ...props
}: SourcePreviewProps & { children: React.ReactNode }) {
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        className={cn('w-80 p-4', className)}
        side="top"
        align="start"
        sideOffset={8}
      >
        <SourcePreviewContent
          citation={citation}
          variant="compact"
          {...props}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Popover Preview
 * Shows on click with manual control
 */
export function SourcePopoverPreview({
  citation,
  children,
  isOpen,
  onClose,
  className,
  ...props
}: SourcePreviewProps & { children: React.ReactNode }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onClose !== undefined ? 
    (open: boolean) => !open && onClose() : 
    setInternalOpen;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-96 p-4', className)}
        side="top"
        align="start"
        sideOffset={8}
      >
        <SourcePreviewContent
          citation={citation}
          variant="detailed"
          {...props}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Dialog Preview
 * Shows in a modal dialog for detailed view
 */
export function SourceDialogPreview({
  citation,
  children,
  isOpen,
  onClose,
  className,
  ...props
}: SourcePreviewProps & { children: React.ReactNode }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onClose !== undefined ? 
    (open: boolean) => !open && onClose() : 
    setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className={cn('max-w-md', className)}>
        <DialogHeader>
          <DialogTitle className="text-left">Source Details</DialogTitle>
        </DialogHeader>
        <SourcePreviewContent
          citation={citation}
          variant="detailed"
          {...props}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main SourcePreview component with automatic preview type selection
 */
export function SourcePreview({
  citation,
  trigger,
  placement = 'auto',
  className,
  ...props
}: SourcePreviewProps) {
  // Default trigger if none provided
  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-auto p-1 text-primary hover:text-primary/80">
      <ExternalLink className="w-4 h-4" />
    </Button>
  );

  const triggerElement = trigger || defaultTrigger;

  // Use hover card for desktop, popover for touch devices
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) {
    return (
      <SourcePopoverPreview citation={citation} className={className} {...props}>
        {triggerElement}
      </SourcePopoverPreview>
    );
  }

  return (
    <SourceHoverPreview citation={citation} className={className} {...props}>
      {triggerElement}
    </SourceHoverPreview>
  );
}
