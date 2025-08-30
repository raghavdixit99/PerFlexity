/**
 * Conversations API Service
 * 
 * Service layer for managing conversation history and CRUD operations
 */

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationsResponse {
  conversations: ConversationSummary[]
  total_count: number
  page: number
  limit: number
}

export interface ConversationDetail {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
  }>
}

export class ConversationsService {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl
  }

  /**
   * Fetch paginated list of conversations
   */
  async listConversations(limit: number = 20, page: number = 1): Promise<ConversationsResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/conversations?page=${page}&limit=${limit}`
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching conversations:', error)
      throw error
    }
  }

  /**
   * Fetch detailed conversation with messages
   */
  async getConversation(conversationId: string): Promise<ConversationDetail> {
    try {
      const response = await fetch(`${this.baseUrl}/api/conversations/${conversationId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching conversation:', error)
      throw error
    }
  }

  /**
   * Create new conversation
   */
  async createConversation(title: string = 'New Conversation'): Promise<ConversationSummary> {
    try {
      const response = await fetch(`${this.baseUrl}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error creating conversation:', error)
      throw error
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/conversations/${conversationId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete conversation: ${response.status}`)
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
      throw error
    }
  }

  /**
   * Search conversations by query string
   */
  async searchConversations(
    query: string, 
    limit: number = 20, 
    page: number = 1
  ): Promise<ConversationsResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/conversations/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
      )
      
      if (!response.ok) {
        throw new Error(`Failed to search conversations: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error searching conversations:', error)
      throw error
    }
  }

  /**
   * Update base URL (useful for configuration changes)
   */
  updateBaseUrl(newBaseUrl: string): void {
    this.baseUrl = newBaseUrl
  }
}

// Singleton instance for easy importing
export const conversationsService = new ConversationsService()