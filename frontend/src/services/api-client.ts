/**
 * API Client for PerFlexity Backend
 * 
 * Provides a simple interface for making API calls to the backend
 * with proper error handling and response parsing.
 */

import { ChatRequest, ChatResponse, HealthResponse, APIError } from '../types/api'

export class APIClient {
  private baseUrl: string

  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Check backend health
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        status: 'ok',
        timestamp: Date.now(),
        ...data
      }
    } catch (error) {
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send a non-streaming chat request (fallback)
   */
  async sendChatRequest(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new APIError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status.toString(),
          errorData.details,
          Date.now()
        )
      }

      return await response.json()
    } catch (error) {
      if (error instanceof APIError) {
        throw error
      }
      
      throw new APIError(
        error instanceof Error ? error.message : 'Request failed',
        'NETWORK_ERROR',
        { originalError: error },
        Date.now()
      )
    }
  }

  /**
   * Update base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '')
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }
}

// API Error class
class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
    public timestamp?: number
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export { APIError }

// Default API client instance
export const defaultAPIClient = new APIClient()