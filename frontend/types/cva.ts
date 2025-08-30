/**
 * CVA (Claim Verification Analysis) Types
 * 
 * Types for claim verification and evidence analysis
 */

export interface ClaimData {
  id: string
  text: string
  confidence: number
  evidence_count: number
  has_conflict: boolean
  uncertainty: boolean
}

export interface EvidenceSpan {
  id: string
  text: string
  doc_id: string
  url: string
  title: string
  start_offset: number
  end_offset: number
  confidence: number
  quality: 'high' | 'medium' | 'low'
  timestamp?: string
}

export interface AtomicClaim {
  id: string
  text: string
  confidence: number
  supported_by: EvidenceSpan[]
  conflict: boolean
  uncertain: boolean
  uncertainty_reason?: string
  conflict_description?: string
}

export interface ClaimTableProps {
  claims: AtomicClaim[]
  displayOptions: {
    expandedClaims: Set<string>
  }
  onDisplayOptionsChange: (options: any) => void
  onClaimExpand: (claimId: string) => void
  onEvidenceClick: (evidence: EvidenceSpan) => void
  className?: string
}

export type EvidenceQuality = 'high' | 'medium' | 'low'
export type ConflictType = 'direct' | 'indirect' | 'temporal'

// Helper utilities
export class CVAHelpers {
  static getQualityVariant(quality: EvidenceQuality): "default" | "secondary" | "destructive" | "outline" {
    switch (quality) {
      case 'high': return 'default'
      case 'medium': return 'secondary' 
      case 'low': return 'destructive'
      default: return 'outline'
    }
  }

  static formatTimestamp(timestamp?: string): string {
    if (!timestamp) return '-'
    try {
      const date = new Date(timestamp)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }
}

// Convert our simple claim format to AtomicClaim format for the table
export function convertToAtomicClaim(claim: ClaimData): AtomicClaim {
  return {
    id: claim.id,
    text: claim.text,
    confidence: claim.confidence,
    supported_by: [], // We'll need to add evidence spans if available
    conflict: claim.has_conflict,
    uncertain: claim.uncertainty,
    uncertainty_reason: claim.uncertainty ? 'Insufficient evidence' : undefined,
    conflict_description: claim.has_conflict ? 'Conflicting information found in sources' : undefined
  }
}