/**
 * API Type Definitions for PerFlexity Frontend
 * 
 * Defines all the types for API requests, responses, and streaming events
 * according to the backend API specification.
 */

// Source Document Interface
export interface SourceDocument {
  id: string
  title: string
  url: string
  snippet: string
  relevance_score: number
  metadata: Record<string, any>
}

// Claim Verification Interface (CVA)
export interface Claim {
  id: string
  text: string
  confidence: number // 0.0-1.0
  evidence_count: number
  has_conflict: boolean
  uncertainty: boolean
  evidence?: Evidence[]
}

// Evidence Interface
export interface Evidence {
  id: string
  text: string
  source: SourceDocument
  confidence: number
  supports_claim: boolean
}

// Chat Request Interface
export interface ChatRequest {
  message: string // Changed from 'query' to match backend API
  enable_cva: boolean // Claim Verification and Analysis
  conversation_id?: string | null // Backend expects null, not undefined
}

// Chat Response Interface (final response structure)
export interface ChatResponse {
  response: string
  conversation_id: string
  message_id: string
  sources: SourceDocument[]
  claims?: Claim[] // Only when enable_cva=true
  metadata: Record<string, any>
}

// API Error Interface
export interface APIError {
  error: string
  code: string
  details?: Record<string, any>
  timestamp: number
}

// Health Check Response
export interface HealthResponse {
  status: 'ok' | 'error'
  timestamp: number
  version?: string
}