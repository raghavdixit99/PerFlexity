/**
 * Server-Sent Events (SSE) Type Definitions
 * 
 * Defines all types for streaming responses from the backend API.
 * The backend sends events in the format: data: {"type": "token", "content": "..."}
 */

// SSE Event Types
export enum SSEEventType {
  START = 'start',   // New: Marks beginning of streaming
  TOKEN = 'token',
  SOURCES = 'sources', // New: Backend sends sources
  CLAIMS = 'claims',   // New: Backend sends claims (different from 'claim')
  DONE = 'done',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  CITATION = 'citation',
  CLAIM = 'claim'
}

// SSE Connection States
export enum SSEConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// SSE Error Types
export enum SSEErrorType {
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_LOST = 'connection_lost',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  SERVER_ERROR = 'server_error',
  AUTH_ERROR = 'auth_error',
  PARSE_ERROR = 'parse_error',
  MAX_RETRIES_EXCEEDED = 'max_retries_exceeded'
}

// Base SSE Event Interface
export interface BaseSSEEvent {
  type: SSEEventType
  timestamp?: number
}

// Start Event - marks beginning of streaming
export interface SSEStartEvent extends BaseSSEEvent {
  type: SSEEventType.START
  conversation_id: string
  message_id: string
}

// Token Event - streaming response tokens
export interface SSETokenEvent extends BaseSSEEvent {
  type: SSEEventType.TOKEN
  content: string
  conversation_id?: string
  message_id?: string
}

// Done Event - marks end of streaming
export interface SSEDoneEvent extends BaseSSEEvent {
  type: SSEEventType.DONE
  conversation_id?: string
  message_id?: string
  total_tokens?: number
  processing_time_ms?: number
}

// Error Event - indicates errors during streaming
export interface SSEErrorEvent extends BaseSSEEvent {
  type: SSEEventType.ERROR
  error: string
  code?: string
  details?: Record<string, any>
  retry_after?: number
}

// Heartbeat Event - keeps connection alive
export interface SSEHeartbeatEvent extends BaseSSEEvent {
  type: SSEEventType.HEARTBEAT
  server_time?: string
}

// Citation Event - provides source citations
export interface SSECitationEvent extends BaseSSEEvent {
  type: SSEEventType.CITATION
  citation: {
    id: string
    title: string
    url: string
    snippet: string
    relevance_score: number
    position?: { start: number; end: number }
  }
}

// Sources Event - provides source documents
export interface SSESourcesEvent extends BaseSSEEvent {
  type: SSEEventType.SOURCES
  sources: Array<{
    id: string
    title: string
    url: string
    snippet: string
    relevance_score: number
    metadata?: Record<string, any>
  }>
}

// Claims Event - provides multiple claims (when CVA enabled)
export interface SSEClaimsEvent extends BaseSSEEvent {
  type: SSEEventType.CLAIMS
  claims: Array<{
    id: string
    text: string
    confidence: number
    evidence_count: number
    has_conflict: boolean
    uncertainty: boolean
    evidence?: Array<{
      id: string
      text: string
      confidence: number
      supports_claim: boolean
    }>
  }>
}

// Claim Event - provides claim verification data (when CVA enabled)
export interface SSEClaimEvent extends BaseSSEEvent {
  type: SSEEventType.CLAIM
  claim: {
    id: string
    text: string
    confidence: number
    evidence_count: number
    has_conflict: boolean
    uncertainty: boolean
  }
}

// Union type for all SSE events
export type SSEEvent = 
  | SSEStartEvent
  | SSETokenEvent 
  | SSESourcesEvent
  | SSEClaimsEvent
  | SSEDoneEvent 
  | SSEErrorEvent 
  | SSEHeartbeatEvent
  | SSECitationEvent
  | SSEClaimEvent

// SSE Connection Error
export interface SSEConnectionError extends Error {
  type: SSEErrorType
  code?: string
  retryable: boolean
  retryAfter?: number
}

// SSE Connection Configuration
export interface SSEConfig {
  url: string
  timeout: number
  maxRetries: number
  retryDelay: number
  heartbeatInterval: number
  enableReconnect: boolean
  headers?: Record<string, string>
}

// SSE Connection Status
export interface SSEConnectionStatus {
  state: SSEConnectionState
  connected: boolean
  lastEventTime: number | null
  retryCount: number
  error: SSEConnectionError | null
}

// SSE Event Handlers
export interface SSEEventHandlers {
  onStart?: (event: SSEStartEvent) => void
  onToken?: (event: SSETokenEvent) => void
  onSources?: (event: SSESourcesEvent) => void
  onClaims?: (event: SSEClaimsEvent) => void
  onDone?: (event: SSEDoneEvent) => void
  onError?: (event: SSEErrorEvent) => void
  onCitation?: (event: SSECitationEvent) => void
  onClaim?: (event: SSEClaimEvent) => void
  onConnectionStateChange?: (state: SSEConnectionState) => void
}

// Token Message interfaces (for backward compatibility with existing code)
export interface SSETokenMessage {
  id: string
  event: SSEEventType.TOKEN
  data: {
    token: string
    conversation_id: string
    message_id: string
  }
  timestamp: number
}

export interface SSEDoneMessage {
  id: string
  event: SSEEventType.DONE
  data: {
    conversation_id: string
    message_id: string
    total_tokens: number
    citations_count?: number
    processing_time_ms: number
  }
  timestamp: number
}

export interface SSEErrorMessage {
  id: string
  event: SSEEventType.ERROR
  data: {
    error: string
    code: string
    details: Record<string, any>
    retry_after: number
  }
  timestamp: number
}

export interface SSECitationMessage {
  id: string
  event: SSEEventType.CITATION
  data: {
    id: string
    title: string
    url: string
    snippet: string
    relevance_score: number
    position: { start: number; end: number }
    conversation_id: string
    message_id: string
  }
  timestamp: number
}

export interface SSEHeartbeatMessage {
  id: string
  event: SSEEventType.HEARTBEAT
  data: {
    timestamp: number
    server_time: string
  }
  timestamp: number
}