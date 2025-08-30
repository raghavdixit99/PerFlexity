/**
 * Evidence Span Preview Component
 * 
 * Component for displaying quoted evidence spans with highlighting,
 * truncation, hover previews, and expand/collapse functionality.
 */

import React, { useState } from 'react';
import { 
  Quote, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';

// UI Components
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

// Types
import { EvidenceSpan, CVAHelpers } from '../../types/cva';

interface EvidenceSpanPreviewProps {
  evidence: EvidenceSpan;
  maxLength?: number;
  showTimestamp?: boolean;
  showSource?: boolean;
  showQuality?: boolean;
  allowExpand?: boolean;
  highlightKeywords?: string[];
  className?: string;
}

/**
 * Text highlighting utility
 */
function highlightText(text: string, keywords: string[]): React.ReactNode {
  if (!keywords || keywords.length === 0) {
    return text;
  }

  // Create regex pattern for all keywords (case insensitive)
  const pattern = new RegExp(`(${keywords.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isKeyword = keywords.some(keyword => 
      keyword.toLowerCase() === part.toLowerCase()
    );
    
    if (isKeyword) {
      return (
        <mark key={index} className="bg-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      );
    }
    
    return part;
  });
}

/**
 * Copy to clipboard functionality
 */
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return { copied, copyToClipboard };
}

/**
 * Truncated Text Component with expand/collapse
 */
function TruncatedText({ 
  text, 
  maxLength = 150,
  allowExpand = true,
  highlightKeywords,
  className 
}: {
  text: string;
  maxLength?: number;
  allowExpand?: boolean;
  highlightKeywords?: string[];
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const shouldTruncate = text.length > maxLength && allowExpand;
  const displayText = shouldTruncate && !isExpanded ? 
    text.substring(0, maxLength) + '...' : text;
  
  const highlightedText = highlightKeywords ? 
    highlightText(displayText, highlightKeywords) : displayText;

  return (
    <div className={className}>
      <p className="leading-6 text-sm">
        {highlightedText}
      </p>
      
      {shouldTruncate && (
        <Button
          variant="link"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-auto p-0 text-xs mt-1"
        >
          {isExpanded ? (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3 mr-1" />
              Show more
            </>
          )}
        </Button>
      )}
    </div>
  );
}

/**
 * Compact Evidence Preview (for lists)
 */
function CompactEvidencePreview({
  evidence,
  maxLength = 100,
  showQuality = true,
  highlightKeywords,
  className
}: EvidenceSpanPreviewProps) {
  const { copied, copyToClipboard } = useCopyToClipboard();

  return (
    <div className={`flex items-start gap-2 p-2 bg-muted/30 rounded ${className}`}>
      <Quote className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <TruncatedText
          text={evidence.text}
          maxLength={maxLength}
          allowExpand={false}
          highlightKeywords={highlightKeywords}
          className="text-sm"
        />
        
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            {showQuality && (
              <Badge 
                variant={CVAHelpers.getQualityVariant(evidence.quality)}
                className="text-xs"
              >
                {Math.round(evidence.confidence * 100)}%
              </Badge>
            )}
            
            {evidence.timestamp && (
              <span className="text-xs text-muted-foreground">
                {CVAHelpers.formatTimestamp(evidence.timestamp)}
              </span>
            )}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(evidence.text)}
                  className="h-6 w-6 p-0"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? 'Copied!' : 'Copy quote'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

/**
 * Full Evidence Preview (for detailed views)
 */
function FullEvidencePreview({
  evidence,
  maxLength = 300,
  showTimestamp = true,
  showSource = true,
  showQuality = true,
  allowExpand = true,
  highlightKeywords,
  className
}: EvidenceSpanPreviewProps) {
  const { copied, copyToClipboard } = useCopyToClipboard();

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4 space-y-3">
        {/* Evidence Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Quote className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Evidence Quote</span>
          </div>
          
          <div className="flex items-center gap-1">
            {showQuality && (
              <Badge 
                variant={CVAHelpers.getQualityVariant(evidence.quality)}
                className="text-xs"
              >
                {evidence.quality}
              </Badge>
            )}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(evidence.text)}
                    className="h-6 w-6 p-0"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? 'Copied!' : 'Copy quote'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Evidence Text */}
        <div className="border-l-4 border-l-primary/30 pl-4 py-2 bg-muted/20 rounded-r">
          <TruncatedText
            text={evidence.text}
            maxLength={maxLength}
            allowExpand={allowExpand}
            highlightKeywords={highlightKeywords}
          />
        </div>

        {/* Evidence Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {showQuality && (
              <span>Confidence: {Math.round(evidence.confidence * 100)}%</span>
            )}
            
            {showSource && evidence.title && (
              <span className="truncate max-w-[200px]">
                Source: {evidence.title}
              </span>
            )}
          </div>
          
          {showTimestamp && evidence.timestamp && (
            <span>{CVAHelpers.formatTimestamp(evidence.timestamp)}</span>
          )}
        </div>

        {/* Character Positions (Debug Info) */}
        {evidence.start_offset !== undefined && evidence.end_offset !== undefined && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            Position: {evidence.start_offset}-{evidence.end_offset} 
            ({evidence.end_offset - evidence.start_offset} characters)
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Evidence List Preview Component
 */
export function EvidenceListPreview({
  evidenceList,
  maxItems = 3,
  compact = false,
  highlightKeywords,
  className
}: {
  evidenceList: EvidenceSpan[];
  maxItems?: number;
  compact?: boolean;
  highlightKeywords?: string[];
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  
  if (evidenceList.length === 0) {
    return (
      <div className={`text-center py-4 text-muted-foreground ${className}`}>
        <Quote className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No evidence quotes available</p>
      </div>
    );
  }

  const displayList = showAll ? evidenceList : evidenceList.slice(0, maxItems);
  const hasMore = evidenceList.length > maxItems;

  return (
    <div className={`space-y-3 ${className}`}>
      {displayList.map((evidence, index) => (
        <div key={`${evidence.doc_id}-${evidence.start_offset}-${index}`}>
          {compact ? (
            <CompactEvidencePreview
              evidence={evidence}
              maxLength={150}
              showQuality={true}
              highlightKeywords={highlightKeywords}
            />
          ) : (
            <FullEvidencePreview
              evidence={evidence}
              maxLength={200}
              showTimestamp={true}
              showSource={true}
              showQuality={true}
              highlightKeywords={highlightKeywords}
            />
          )}
        </div>
      ))}

      {hasMore && !showAll && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll(true)}
          className="w-full"
        >
          <ChevronDown className="w-4 h-4 mr-2" />
          Show {evidenceList.length - maxItems} more evidence quotes
        </Button>
      )}

      {showAll && hasMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll(false)}
          className="w-full"
        >
          <ChevronRight className="w-4 h-4 mr-2" />
          Show fewer evidence quotes
        </Button>
      )}
    </div>
  );
}

/**
 * Main Evidence Span Preview Component
 */
export function EvidenceSpanPreview({
  evidence,
  maxLength = 200,
  showTimestamp = false,
  showSource = false,
  showQuality = false,
  allowExpand = true,
  highlightKeywords,
  className
}: EvidenceSpanPreviewProps) {
  // Use compact version for short text or when showSource/showTimestamp are false
  const useCompact = !showSource && !showTimestamp && maxLength <= 150;

  if (useCompact) {
    return (
      <CompactEvidencePreview
        evidence={evidence}
        maxLength={maxLength}
        showQuality={showQuality}
        highlightKeywords={highlightKeywords}
        className={className}
      />
    );
  }

  return (
    <FullEvidencePreview
      evidence={evidence}
      maxLength={maxLength}
      showTimestamp={showTimestamp}
      showSource={showSource}
      showQuality={showQuality}
      allowExpand={allowExpand}
      highlightKeywords={highlightKeywords}
      className={className}
    />
  );
}

export default EvidenceSpanPreview;
