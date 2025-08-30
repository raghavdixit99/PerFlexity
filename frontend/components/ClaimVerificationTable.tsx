"use client"

import React, { useState } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Separator } from './ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'

interface EvidenceReference {
  source_url: string
  snippet: string
  confidence: number
  relevance_score: number
}

interface ClaimData {
  id: string
  text: string
  confidence: number
  evidence_count: number
  has_conflict: boolean
  uncertainty: boolean
  evidence_references?: EvidenceReference[]
  uncertainty_reason?: string
}

interface ClaimVerificationTableProps {
  claims: ClaimData[]
  className?: string
}

function ClaimRow({ 
  claim,
  isExpanded, 
  onToggleExpand 
}: { 
  claim: ClaimData
  isExpanded: boolean
  onToggleExpand: () => void 
}) {
  const hasConflict = claim.has_conflict
  const isUncertain = claim.uncertainty
  const evidenceCount = claim.evidence_count

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <CollapsibleTrigger asChild>
        <div className="cursor-pointer hover:bg-gray-50 p-4 border-b border-gray-100 transition-colors">
          <div className="flex items-start gap-4">
            {/* Expand/Collapse Button */}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>

            {/* Status Icon */}
            <div className="flex-shrink-0 mt-1">
              {hasConflict ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : isUncertain ? (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>

            {/* Claim Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 leading-5 mb-2">
                {claim.text}
              </p>
              
              <div className="flex flex-wrap items-center gap-2">
                <Badge 
                  variant={claim.confidence >= 0.8 ? "default" : claim.confidence >= 0.6 ? "secondary" : "destructive"}
                  className="text-xs"
                >
                  {Math.round(claim.confidence * 100)}% confidence
                </Badge>
                
                <Badge variant="outline" className="text-xs">
                  {evidenceCount > 0 ? `${evidenceCount} ${evidenceCount === 1 ? 'source' : 'sources'}` : 'No sources'}
                </Badge>
                
                {hasConflict && (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="w-3 h-3 mr-1" />
                    Conflicting evidence
                  </Badge>
                )}
                
                {isUncertain && (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Uncertain
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 bg-gray-50">
          <div className="pl-10 space-y-3">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-900">Supporting Evidence</h4>
              
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge 
                  variant={claim.confidence >= 0.8 ? "default" : claim.confidence >= 0.6 ? "secondary" : "destructive"}
                  className="text-xs"
                >
                  {Math.round(claim.confidence * 100)}% confidence
                </Badge>
                
                {!hasConflict && !isUncertain && (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* Display actual evidence references from backend analysis */}
              {claim.evidence_references && claim.evidence_references.length > 0 ? (
                <div className="space-y-2">
                  {claim.evidence_references.map((evidence, index) => (
                    <div key={index} className="p-3 bg-white rounded-md border border-gray-200">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <a 
                              href={evidence.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
                            >
                              {new URL(evidence.source_url).hostname}
                            </a>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(evidence.relevance_score * 100)}% match
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mb-2 italic">
                            "{evidence.snippet}"
                          </p>
                          <div className="text-xs text-gray-500">
                            Evidence confidence: {Math.round(evidence.confidence * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-yellow-800">
                      <p className="font-medium">No evidence found for this claim</p>
                      {claim.uncertainty_reason && (
                        <p className="mt-1">{claim.uncertainty_reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Conflict Information */}
            {hasConflict && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 text-sm">Conflicting Evidence Detected</p>
                    <p className="text-red-700 text-sm mt-1">
                      Some sources provide contradictory information about this claim.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Uncertainty Information */}
            {isUncertain && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800 text-sm">Uncertain Claim</p>
                    <p className="text-yellow-700 text-sm mt-1">
                      Insufficient evidence available to verify this claim with high confidence.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ClaimVerificationTable({ claims, className }: ClaimVerificationTableProps) {
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set())

  const toggleClaim = (claimId: string) => {
    setExpandedClaims(prev => {
      const newSet = new Set(prev)
      if (newSet.has(claimId)) {
        newSet.delete(claimId)
      } else {
        newSet.add(claimId)
      }
      return newSet
    })
  }

  if (claims.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No claims to verify</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header Stats */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="font-medium">
            {claims.length} {claims.length === 1 ? 'claim' : 'claims'} analyzed
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            {claims.filter(c => c.has_conflict).length} conflicts
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
            {claims.filter(c => c.uncertainty).length} uncertain
          </span>
        </div>
      </div>

      {/* Claims List */}
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          {claims.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              isExpanded={expandedClaims.has(claim.id)}
              onToggleExpand={() => toggleClaim(claim.id)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Mobile Optimization */}
      <div className="lg:hidden space-y-3">
        {claims.map((claim) => (
          <Card key={`mobile-${claim.id}`} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-5 flex-1">{claim.text}</p>
                <div className="flex-shrink-0">
                  {claim.has_conflict ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : claim.uncertainty ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={claim.confidence >= 0.8 ? "default" : "secondary"}>
                  {Math.round(claim.confidence * 100)}% confidence
                </Badge>
                <Badge variant="outline">
                  {claim.evidence_count} sources
                </Badge>
                {claim.has_conflict && (
                  <Badge variant="destructive" className="text-xs">
                    Conflicting
                  </Badge>
                )}
                {claim.uncertainty && (
                  <Badge variant="outline" className="text-yellow-600">
                    Uncertain
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}