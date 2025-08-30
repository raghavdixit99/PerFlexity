/**
 * Claim Verification Table Component
 * 
 * Interactive table displaying claims with evidence sources, quoted spans,
 * timestamps, and conflict indicators. Supports sorting, filtering, and
 * expandable rows for detailed evidence viewing.
 */

import React, { useState, useCallback } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

// UI Components
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

// Evidence Components
import { ConflictIndicator } from './ConflictIndicator';
import { SourceDisplay } from './SourceDisplay';
import { EvidenceSpanPreview } from './EvidenceSpanPreview';

// Types
import { 
  ClaimTableProps, 
  AtomicClaim, 
  EvidenceSpan,
  CVAHelpers,
  EvidenceQuality,
  ConflictType
} from '../../types/cva';

/**
 * Individual Evidence Row within expanded claim
 */
interface EvidenceRowProps {
  evidence: EvidenceSpan;
  index: number;
  onEvidenceClick: (evidence: EvidenceSpan) => void;
  className?: string;
}

function EvidenceRow({ evidence, index, onEvidenceClick, className }: EvidenceRowProps) {
  return (
    <div className={`p-3 border-l-2 border-l-primary/20 bg-muted/30 ${className}`}>
      <div className="space-y-2">
        {/* Evidence Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge 
              variant={CVAHelpers.getQualityVariant(evidence.quality)}
              className="text-xs"
            >
              {evidence.quality}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {Math.round(evidence.confidence * 100)}% confidence
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEvidenceClick(evidence)}
                    className="h-6 w-6 p-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open source</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Evidence Content */}
        <div className="space-y-2">
          <EvidenceSpanPreview 
            evidence={evidence} 
            maxLength={200}
            showTimestamp
          />
          
          <SourceDisplay 
            evidence={evidence}
            compact
            showDomain
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Expandable Claim Row Component
 */
interface ClaimRowProps {
  claim: AtomicClaim;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEvidenceClick: (evidence: EvidenceSpan) => void;
  className?: string;
}

function ClaimRow({ claim, isExpanded, onToggleExpand, onEvidenceClick, className }: ClaimRowProps) {
  const evidenceCount = claim.supported_by.length;
  const hasConflict = claim.conflict;
  const isUncertain = claim.uncertain;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      {/* Main Claim Row */}
      <CollapsibleTrigger asChild>
        <TableRow className={`cursor-pointer hover:bg-muted/50 ${className}`}>
          <TableCell className="w-8">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </TableCell>
          
          {/* Claim Text */}
          <TableCell className="font-medium">
            <div className="space-y-1">
              <p className="text-sm leading-5">{claim.text}</p>
              <div className="flex items-center gap-2">
                {hasConflict && <ConflictIndicator claim={claim} size="sm" />}
                {isUncertain && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-xs text-yellow-600">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Uncertain
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{claim.uncertainty_reason}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </TableCell>
          
          {/* Evidence Sources Count */}
          <TableCell>
            <div className="text-center">
              <Badge variant={evidenceCount > 0 ? "default" : "secondary"}>
                {evidenceCount} {evidenceCount === 1 ? 'source' : 'sources'}
              </Badge>
            </div>
          </TableCell>
          
          {/* Confidence Score */}
          <TableCell>
            <div className="text-center">
              <Badge 
                variant={claim.confidence >= 0.8 ? "default" : claim.confidence >= 0.6 ? "secondary" : "destructive"}
                className="min-w-[60px]"
              >
                {Math.round(claim.confidence * 100)}%
              </Badge>
            </div>
          </TableCell>
          
          {/* Latest Evidence Time */}
          <TableCell>
            <div className="text-center">
              {claim.supported_by.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {CVAHelpers.formatTimestamp(
                    claim.supported_by
                      .filter(e => e.timestamp)
                      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())[0]?.timestamp
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      
      {/* Expanded Evidence Details */}
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={5} className="p-0">
            <div className="border-t bg-muted/20">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Supporting Evidence</h4>
                  <Badge variant="outline" className="text-xs">
                    {evidenceCount} {evidenceCount === 1 ? 'piece' : 'pieces'} of evidence
                  </Badge>
                </div>
                
                {claim.supported_by.length > 0 ? (
                  <div className="space-y-3">
                    {claim.supported_by.map((evidence, index) => (
                      <EvidenceRow
                        key={`${evidence.doc_id}-${evidence.start_offset}`}
                        evidence={evidence}
                        index={index}
                        onEvidenceClick={onEvidenceClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No supporting evidence found</p>
                    {claim.uncertainty_reason && (
                      <p className="text-xs mt-1">{claim.uncertainty_reason}</p>
                    )}
                  </div>
                )}
                
                {/* Conflict Information */}
                {hasConflict && claim.conflict_description && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-red-800 text-sm">Conflicting Evidence</p>
                        <p className="text-red-700 text-sm mt-1">{claim.conflict_description}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Main Claim Verification Table Component
 */
export function ClaimVerificationTable({
  claims,
  displayOptions,
  onDisplayOptionsChange,
  onClaimExpand,
  onEvidenceClick,
  className
}: ClaimTableProps) {
  const [hoveredClaim, setHoveredClaim] = useState<string | null>(null);

  const handleClaimRowClick = useCallback((claimId: string) => {
    onClaimExpand(claimId);
  }, [onClaimExpand]);

  if (claims.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No claims to display</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Table Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span>
            {claims.filter(c => c.conflict).length} conflicts
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span>
            {claims.filter(c => c.uncertain).length} uncertain
          </span>
        </div>
      </div>

      {/* Claims Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-8"></TableHead>
              <TableHead className="min-w-[300px]">Claim</TableHead>
              <TableHead className="text-center w-24">Sources</TableHead>
              <TableHead className="text-center w-24">Confidence</TableHead>
              <TableHead className="text-center w-24">Latest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                isExpanded={displayOptions.expandedClaims.has(claim.id)}
                onToggleExpand={() => handleClaimRowClick(claim.id)}
                onEvidenceClick={onEvidenceClick}
                className={hoveredClaim === claim.id ? 'bg-muted/30' : ''}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Optimizations */}
      {className?.includes('mobile-optimized') && (
        <div className="lg:hidden space-y-3">
          {claims.map((claim) => (
            <Card key={claim.id} className="p-0">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Claim Header */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-5 flex-1">{claim.text}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClaimRowClick(claim.id)}
                      className="h-6 w-6 p-0 flex-shrink-0"
                    >
                      {displayOptions.expandedClaims.has(claim.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Claim Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={claim.confidence >= 0.8 ? "default" : "secondary"}>
                      {Math.round(claim.confidence * 100)}% confidence
                    </Badge>
                    <Badge variant="outline">
                      {claim.supported_by.length} sources
                    </Badge>
                    {claim.conflict && <ConflictIndicator claim={claim} size="sm" />}
                    {claim.uncertain && (
                      <Badge variant="outline" className="text-yellow-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Uncertain
                      </Badge>
                    )}
                  </div>

                  {/* Expanded Evidence (Mobile) */}
                  {displayOptions.expandedClaims.has(claim.id) && (
                    <div className="space-y-2 pt-2 border-t">
                      {claim.supported_by.map((evidence, index) => (
                        <EvidenceRow
                          key={`${evidence.doc_id}-${evidence.start_offset}`}
                          evidence={evidence}
                          index={index}
                          onEvidenceClick={onEvidenceClick}
                          className="text-xs"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClaimVerificationTable;
