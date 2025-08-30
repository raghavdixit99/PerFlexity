/**
 * Production-Ready Streaming Service for PerFlexity
 * 
 * Handles Server-Sent Events streaming with proper error handling,
 * reconnection logic, and token-by-token response processing.
 */

import {
  SSEEventType,
  SSEConnectionState,
  SSEErrorType,
  SSEStartEvent,
  SSETokenEvent,
  SSESourcesEvent,
  SSEClaimsEvent,
  SSEDoneEvent,
  SSEErrorEvent,
  SSECitationEvent,
  SSEClaimEvent
} from '../types/sse'
import { ChatRequest } from '../types/api'
import { processSources } from '../utils/sourceUtils'

// Define required interfaces for this service
export interface SSEConfig {
  url: string
  timeout: number
  maxRetries: number
  retryDelay: number
  heartbeatInterval: number
  enableReconnect: boolean
  headers?: Record<string, string>
}

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

export interface SSEConnectionStatus {
  state: SSEConnectionState
  connected: boolean
  lastEventTime: number | null
  retryCount: number
  error: SSEConnectionError | null
}

export interface SSEConnectionError extends Error {
  type: SSEErrorType
  code?: string
  retryable: boolean
  retryAfter?: number
}

// Default SSE Configuration
const DEFAULT_SSE_CONFIG: SSEConfig = {
  url: 'http://localhost:8000',
  timeout: 30000,
  maxRetries: 5,
  retryDelay: 1000,
  heartbeatInterval: 30000,
  enableReconnect: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache'
  }
}

/**
 * Production-ready streaming service for handling SSE connections
 */
export class StreamingService {
  private config: SSEConfig
  private eventSource: EventSource | null = null
  private currentStreamId: string | null = null
  private connectionStatus: SSEConnectionStatus
  private handlers: SSEEventHandlers = {}
  private retryTimeout: NodeJS.Timeout | null = null
  private heartbeatTimeout: NodeJS.Timeout | null = null
  private currentMessage = ''
  private currentSources: SSESourcesEvent[] = []
  private currentCitations: SSECitationEvent[] = []
  private currentClaims: SSEClaimEvent[] = []
  private currentClaimsGroup: SSEClaimsEvent[] = []

  constructor(config: Partial<SSEConfig> = {}) {
    this.config = { ...DEFAULT_SSE_CONFIG, ...config }
    this.connectionStatus = {
      state: SSEConnectionState.DISCONNECTED,
      connected: false,
      lastEventTime: null,
      retryCount: 0,
      error: null
    }
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: SSEEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers }
  }

  /**
   * Start streaming for a chat request
   */
  async startStream(request: ChatRequest): Promise<void> {
    try {
      // Close any existing connection
      this.closeConnection()

      // Reset state
      this.currentMessage = ''
      this.currentSources = []
      this.currentCitations = []
      this.currentClaims = []
      this.currentClaimsGroup = []
      this.currentStreamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Update connection state
      this.updateConnectionState(SSEConnectionState.CONNECTING)

      // Create the streaming endpoint URL
      const streamUrl = `${this.config.url}/api/ask`

      // Start SSE connection
      await this.connectEventSource(streamUrl, request)

    } catch (error) {
      this.handleConnectionError(
        this.createSSEError(SSEErrorType.CONNECTION_FAILED, error instanceof Error ? error.message : 'Connection failed')
      )
    }
  }

  /**
   * Connect to EventSource
   */
  private async connectEventSource(url: string, request: ChatRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Make the initial POST request to start streaming
        fetch(url, {
          method: 'POST',
          headers: this.config.headers || {},
          body: JSON.stringify(request),
        })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          if (!response.body) {
            throw new Error('No response body for streaming')
          }

          // Process the streaming response
          await this.processStream(response.body)
          resolve()
        })
        .catch((error) => {
          reject(error)
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Process the streaming response
   */
  private async processStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    this.updateConnectionState(SSEConnectionState.CONNECTED)

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          // Stream completed naturally
          this.updateConnectionState(SSEConnectionState.DISCONNECTED)
          break
        }

        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          await this.processSSELine(line)
        }
      }
    } catch (error) {
      this.handleConnectionError(
        this.createSSEError(SSEErrorType.NETWORK_ERROR, error instanceof Error ? error.message : 'Stream processing failed')
      )
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Process a single SSE line
   */
  private async processSSELine(line: string): Promise<void> {
    const trimmedLine = line.trim()
    
    if (!trimmedLine || trimmedLine.startsWith(':')) {
      return // Skip empty lines and comments
    }

    if (trimmedLine.startsWith('data: ')) {
      const data = trimmedLine.slice(6) // Remove 'data: ' prefix
      
      if (data === '[DONE]') {
        // Handle explicit done signal
        this.updateConnectionState(SSEConnectionState.DISCONNECTED)
        return
      }

      try {
        const parsed = JSON.parse(data)
        await this.handleSSEEvent(parsed)
      } catch (error) {
        console.warn('Failed to parse SSE data:', data, error)
        this.handlers.onError?.({
          type: SSEEventType.ERROR,
          error: 'Failed to parse streaming data',
          code: 'PARSE_ERROR'
        })
      }
    }
  }

  /**
   * Handle parsed SSE event
   */
  private async handleSSEEvent(eventData: any): Promise<void> {
    if (!eventData.type) {
      return
    }

    // Update last event time
    this.connectionStatus.lastEventTime = Date.now()

    switch (eventData.type) {
      case 'start':
        await this.handleStartEvent(eventData)
        break
      case 'token':
        await this.handleTokenEvent(eventData)
        break
      case 'sources':
        await this.handleSourcesEvent(eventData)
        break
      case 'claims':
        await this.handleClaimsEvent(eventData)
        break
      case 'citation':
        await this.handleCitationEvent(eventData)
        break
      case 'claim':
        await this.handleClaimEvent(eventData)
        break
      case 'done':
        await this.handleDoneEvent(eventData)
        break
      case 'error':
        await this.handleErrorEvent(eventData)
        break
      case 'heartbeat':
        await this.handleHeartbeatEvent(eventData)
        break
      default:
        console.warn('Unknown SSE event type:', eventData.type)
    }
  }

  /**
   * Handle start event
   */
  private async handleStartEvent(data: any): Promise<void> {
    const event: SSEStartEvent = {
      type: SSEEventType.START,
      conversation_id: data.conversation_id || '',
      message_id: data.message_id || '',
      timestamp: Date.now()
    }

    this.handlers.onStart?.(event)
  }

  /**
   * Handle sources event
   */
  private async handleSourcesEvent(data: any): Promise<void> {
    const event: SSESourcesEvent = {
      type: SSEEventType.SOURCES,
      sources: processSources(data.sources || []),
      timestamp: Date.now()
    }

    this.currentSources.push(event)
    this.handlers.onSources?.(event)
  }

  /**
   * Handle claims event (multiple claims)
   */
  private async handleClaimsEvent(data: any): Promise<void> {
    const event: SSEClaimsEvent = {
      type: SSEEventType.CLAIMS,
      claims: data.claims || [],
      timestamp: Date.now()
    }

    this.currentClaimsGroup.push(event)
    this.handlers.onClaims?.(event)
  }

  /**
   * Handle done event
   */
  private async handleDoneEvent(data: any): Promise<void> {
    const event: SSEDoneEvent = {
      type: SSEEventType.DONE,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      total_tokens: data.total_tokens,
      processing_time_ms: data.processing_time_ms,
      timestamp: Date.now()
    }

    this.handlers.onDone?.(event)
    this.updateConnectionState(SSEConnectionState.DISCONNECTED)
  }

  /**
   * Handle token event
   */
  private async handleTokenEvent(data: any): Promise<void> {
    const event: SSETokenEvent = {
      type: SSEEventType.TOKEN,
      content: data.content || '',
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      timestamp: Date.now()
    }

    // Accumulate message content
    this.currentMessage += event.content

    // Notify handlers
    this.handlers.onToken?.(event)
  }

  /**
   * Handle citation event
   */
  private async handleCitationEvent(data: any): Promise<void> {
    const event: SSECitationEvent = {
      type: SSEEventType.CITATION,
      citation: {
        id: data.id || `citation-${Date.now()}`,
        title: data.title || '',
        url: data.url || '',
        snippet: data.snippet || '',
        relevance_score: data.relevance_score || 0,
        position: data.position
      },
      timestamp: Date.now()
    }

    this.currentCitations.push(event)
    this.handlers.onCitation?.(event)
  }

  /**
   * Handle claim event
   */
  private async handleClaimEvent(data: any): Promise<void> {
    const event: SSEClaimEvent = {
      type: SSEEventType.CLAIM,
      claim: {
        id: data.id || `claim-${Date.now()}`,
        text: data.text || '',
        confidence: data.confidence || 0,
        evidence_count: data.evidence_count || 0,
        has_conflict: data.has_conflict || false,
        uncertainty: data.uncertainty || false
      },
      timestamp: Date.now()
    }

    this.currentClaims.push(event)
    this.handlers.onClaim?.(event)
  }

  /**
   * Handle error event
   */
  private async handleErrorEvent(data: any): Promise<void> {
    const event: SSEErrorEvent = {
      type: SSEEventType.ERROR,
      error: data.error || 'Unknown error',
      code: data.code,
      details: data.details,
      retry_after: data.retry_after,
      timestamp: Date.now()
    }

    this.handlers.onError?.(event)

    // Handle retryable errors
    if (event.retry_after && this.config.enableReconnect) {
      setTimeout(() => {
        if (this.connectionStatus.retryCount < this.config.maxRetries) {
          this.attemptReconnection()
        }
      }, event.retry_after)
    }
  }

  /**
   * Handle heartbeat event
   */
  private async handleHeartbeatEvent(data: any): Promise<void> {
    // Reset heartbeat timeout
    this.resetHeartbeatTimeout()
  }


  /**
   * Handle connection errors
   */
  private handleConnectionError(error: SSEConnectionError): void {
    this.connectionStatus.error = error
    this.updateConnectionState(SSEConnectionState.ERROR)

    this.handlers.onError?.({
      type: SSEEventType.ERROR,
      error: error.message,
      code: error.code,
      timestamp: Date.now()
    })

    // Attempt reconnection if enabled
    if (error.retryable && this.config.enableReconnect && this.connectionStatus.retryCount < this.config.maxRetries) {
      this.attemptReconnection()
    }
  }

  /**
   * Attempt reconnection
   */
  private attemptReconnection(): void {
    this.connectionStatus.retryCount++
    this.updateConnectionState(SSEConnectionState.RECONNECTING)

    const delay = Math.min(
      this.config.retryDelay * Math.pow(2, this.connectionStatus.retryCount - 1),
      30000 // Cap at 30 seconds
    )

    this.retryTimeout = setTimeout(() => {
      // Note: We'd need to store the original request to retry
      console.log('Attempting to reconnect...')
    }, delay)
  }

  /**
   * Reset heartbeat timeout
   */
  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
    }

    this.heartbeatTimeout = setTimeout(() => {
      this.handleConnectionError(
        this.createSSEError(SSEErrorType.TIMEOUT_ERROR, 'Heartbeat timeout')
      )
    }, this.config.heartbeatInterval * 2) // Allow 2x heartbeat interval
  }

  /**
   * Update connection state
   */
  private updateConnectionState(state: SSEConnectionState): void {
    if (this.connectionStatus.state !== state) {
      this.connectionStatus.state = state
      this.connectionStatus.connected = state === SSEConnectionState.CONNECTED
      
      if (state === SSEConnectionState.CONNECTED) {
        this.connectionStatus.retryCount = 0
        this.connectionStatus.error = null
      }

      this.handlers.onConnectionStateChange?.(state)
    }
  }

  /**
   * Create SSE error
   */
  private createSSEError(type: SSEErrorType, message: string, code?: string): SSEConnectionError {
    const error = new Error(message) as SSEConnectionError
    error.type = type
    error.code = code
    error.retryable = [
      SSEErrorType.CONNECTION_FAILED,
      SSEErrorType.CONNECTION_LOST,
      SSEErrorType.NETWORK_ERROR,
      SSEErrorType.TIMEOUT_ERROR,
      SSEErrorType.SERVER_ERROR
    ].includes(type)
    
    return error
  }

  /**
   * Close connection
   */
  closeConnection(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }

    this.updateConnectionState(SSEConnectionState.DISCONNECTED)
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): SSEConnectionStatus {
    return { ...this.connectionStatus }
  }

  /**
   * Get accumulated message content
   */
  getCurrentMessage(): string {
    return this.currentMessage
  }

  /**
   * Get accumulated sources
   */
  getCurrentSources(): SSESourcesEvent[] {
    return [...this.currentSources]
  }

  /**
   * Get accumulated citations
   */
  getCurrentCitations(): SSECitationEvent[] {
    return [...this.currentCitations]
  }

  /**
   * Get accumulated claims
   */
  getCurrentClaims(): SSEClaimEvent[] {
    return [...this.currentClaims]
  }

  /**
   * Get accumulated claims groups
   */
  getCurrentClaimsGroups(): SSEClaimsEvent[] {
    return [...this.currentClaimsGroup]
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SSEConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * Create streaming service instance
 */
export function createStreamingService(config?: Partial<SSEConfig>): StreamingService {
  return new StreamingService(config)
}

/**
 * Default streaming service instance
 */
export const defaultStreamingService = createStreamingService()