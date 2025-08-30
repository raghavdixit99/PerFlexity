"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageCircle, Plus, X, Search } from "lucide-react"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { toast } from "sonner"
import { 
  conversationsService, 
  type ConversationSummary, 
  type ConversationsResponse 
} from "../services/conversations"

interface ConversationSidebarProps {
  apiUrl: string
  activeConversationId?: string | null
  onConversationSelect: (conversationId: string) => void
  onNewConversation: () => void
  backendConnected: boolean | null
}

export function ConversationSidebar({
  apiUrl,
  activeConversationId,
  onConversationSelect,
  onNewConversation,
  backendConnected
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ConversationSummary[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Update service URL when apiUrl changes
  useEffect(() => {
    conversationsService.updateBaseUrl(apiUrl)
  }, [apiUrl])

  // Fetch conversations on mount and when backend connection changes
  useEffect(() => {
    if (backendConnected) {
      fetchConversations()
    }
  }, [backendConnected])

  const fetchConversations = async () => {
    if (!backendConnected) return

    setLoading(true)
    setError(null)
    
    try {
      const response: ConversationsResponse = await conversationsService.listConversations(50, 1)
      setConversations(response.conversations)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
      setError('Failed to load conversations')
      setConversations([])
    } finally {
      setLoading(false)
    }
  }

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!backendConnected || !query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const response = await conversationsService.searchConversations(query, 50, 1)
      setSearchResults(response.conversations)
    } catch (error) {
      console.error('Failed to search conversations:', error)
      setError('Failed to search conversations')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [backendConnected])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, performSearch])

  // Clear search when query is empty
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (!value.trim()) {
      setSearchResults([])
      setIsSearching(false)
    }
  }

  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    // Get conversation title for confirmation
    const conversation = conversations.find(conv => conv.id === conversationId)
    const conversationTitle = conversation ? truncateTitle(conversation.title, 40) : 'this conversation'
    
    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete "${conversationTitle}"? This action cannot be undone.`)
    
    if (!confirmed) return
    
    try {
      await conversationsService.deleteConversation(conversationId)
      
      // Remove from both local states
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
      setSearchResults(prev => prev.filter(conv => conv.id !== conversationId))
      
      // If deleted conversation was active, clear it
      if (activeConversationId === conversationId) {
        onNewConversation()
      }
      
      // Show success message
      toast.success(`Conversation "${conversationTitle}" deleted successfully`)
      
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error('Failed to delete conversation. Please try again.')
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  const truncateTitle = (title: string, maxLength: number = 30) => {
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title
  }

  if (!backendConnected) {
    return (
      <div className="hidden lg:flex w-80 flex-col bg-gray-50 border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-2">Conversations</h2>
          <Button 
            onClick={onNewConversation}
            className="w-full justify-start gap-2"
            variant="outline"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="text-sm text-gray-500">
              Connect to backend to view conversation history
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hidden lg:flex w-80 flex-col bg-gray-50 border-r border-gray-200">
      {/* Header with New Chat button */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-2">Conversations</h2>
        <Button 
          onClick={onNewConversation}
          className="w-full justify-start gap-2 mb-3"
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Show loading state */}
          {(loading || isSearching) && (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">
                {searchQuery ? 'Searching conversations...' : 'Loading conversations...'}
              </div>
            </div>
          )}

          {/* Show error state */}
          {error && !loading && !isSearching && (
            <div className="text-center py-4">
              <div className="text-sm text-red-600">{error}</div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={searchQuery ? () => performSearch(searchQuery) : fetchConversations}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Show empty states */}
          {!loading && !isSearching && !error && (
            <>
              {searchQuery && searchResults.length === 0 && (
                <div className="text-center py-4">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <div className="text-sm text-gray-500">No conversations found for "{searchQuery}"</div>
                </div>
              )}
              
              {!searchQuery && conversations.length === 0 && (
                <div className="text-center py-4">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <div className="text-sm text-gray-500">No conversations yet</div>
                </div>
              )}
            </>
          )}

          {/* Display conversations (search results if searching, all conversations if not) */}
          {!loading && !isSearching && !error && (searchQuery ? searchResults : conversations).map((conversation) => (
            <div
              key={conversation.id}
              className={`group p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                activeConversationId === conversation.id
                  ? 'bg-blue-100 border border-blue-200'
                  : 'hover:bg-gray-100 border border-transparent'
              }`}
              onClick={() => onConversationSelect(conversation.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {truncateTitle(conversation.title)}
                  </div>
                  {conversation.message_count > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5 mt-1">
                      {conversation.message_count} messages
                    </Badge>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-7 w-7 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300"
                    onClick={(e) => handleDeleteConversation(conversation.id, e)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer with conversation count */}
      {(() => {
        const displayedConversations = searchQuery ? searchResults : conversations
        const count = displayedConversations.length
        return count > 0 ? (
          <div className="p-3 border-t border-gray-200 text-xs text-gray-500 text-center">
            {searchQuery && `${count} result${count !== 1 ? 's' : ''} for "${searchQuery}"`}
            {!searchQuery && `${count} conversation${count !== 1 ? 's' : ''}`}
          </div>
        ) : null
      })()}
    </div>
  )
}