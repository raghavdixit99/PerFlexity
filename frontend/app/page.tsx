"use client"

import { useState, useEffect, useRef } from "react"
import { HomeScreen } from "@/components/HomeScreen"
import { ChatInterface } from "@/components/ChatInterface"
import { ProofModeToggle } from "@/components/ProofModeToggle"
import { BackgroundEffect } from "@/components/BackgroundEffect"
import { ConversationSidebar } from "@/components/ConversationSidebar"
import { toast } from "sonner"
import { createStreamingService } from "../src/services/streaming-service"
import { 
  SSEEventType, 
  SSEConnectionState, 
  SSEStartEvent,
  SSETokenEvent, 
  SSESourcesEvent,
  SSEClaimsEvent,
  SSEDoneEvent, 
  SSEErrorEvent,
  SSECitationEvent,
  SSEClaimEvent
} from "../src/types/sse"
import { ChatRequest } from "../src/types/api"
import { conversationsService, type ConversationDetail } from "../services/conversations"

export interface ChatMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  sources?: Array<{
    id: string
    title: string
    url: string
    snippet: string
    relevance_score: number
  }>
  claims?: Array<{
    id: string
    text: string
    confidence: number
    evidence_count: number
    has_conflict: boolean
    uncertainty: boolean
    evidence_references?: Array<{
      source_url: string
      snippet: string
      confidence: number
      relevance_score: number
    }>
    uncertainty_reason?: string
  }>
  isStreaming?: boolean
}

// Convert backend message format to frontend format
function convertBackendMessageToFrontend(backendMessage: { 
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}): ChatMessage {
  return {
    id: backendMessage.id,
    content: backendMessage.content,
    isUser: backendMessage.role === 'user',
    timestamp: new Date(backendMessage.created_at),
    isStreaming: false
  }
}

export default function App() {
  const [isProofMode, setIsProofMode] = useState(false)
  const [isChatMode, setIsChatMode] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentQuery, setCurrentQuery] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)
  const [apiUrl, setApiUrl] = useState("http://localhost:8000")
  
  // Streaming service
  const streamingServiceRef = useRef(createStreamingService({ url: apiUrl }))
  const currentMessageRef = useRef<string>("")
  const currentAiMessageIdRef = useRef<string | null>(null)
  const currentSourcesRef = useRef<SSESourcesEvent[]>([])
  const currentCitationsRef = useRef<SSECitationEvent[]>([])
  const currentClaimsRef = useRef<SSEClaimEvent[]>([])
  const currentClaimsGroupRef = useRef<SSEClaimsEvent[]>([])
  const conversationIdRef = useRef<string | null>(null)

  // Update conversations service URL when apiUrl changes
  useEffect(() => {
    conversationsService.updateBaseUrl(apiUrl)
  }, [apiUrl])

  // Load conversation from backend
  const loadConversation = async (conversationId: string) => {
    try {
      setIsStreaming(true) // Show loading state
      
      // Close current streaming connection
      streamingServiceRef.current.closeConnection()
      
      const conversation: ConversationDetail = await conversationsService.getConversation(conversationId)
      
      // Convert backend messages to frontend format
      const frontendMessages = conversation.messages.map(convertBackendMessageToFrontend)
      
      // Update state
      setMessages(frontendMessages)
      conversationIdRef.current = conversationId
      setIsChatMode(true)
      
      // Clear current streaming state
      currentAiMessageIdRef.current = null
      currentMessageRef.current = ""
      currentSourcesRef.current = []
      currentCitationsRef.current = []
      currentClaimsRef.current = []
      currentClaimsGroupRef.current = []
      
      toast.success("Conversation loaded successfully")
      
    } catch (error) {
      console.error("Failed to load conversation:", error)
      toast.error("Failed to load conversation. Please try again.")
    } finally {
      setIsStreaming(false)
    }
  }

  // Check backend connection
  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/health`)
      const isConnected = response.ok
      setBackendConnected(isConnected)

      if (!isConnected) {
        toast.error("Cannot connect to backend server. Please make sure your Python backend is running.")
      } else {
        toast.success("Connected to backend server")
      }

      return isConnected
    } catch {
      setBackendConnected(false)
      toast.error("Cannot connect to backend server. Please make sure your Python backend is running.")
      return false
    }
  }

  // Setup streaming service event handlers
  useEffect(() => {
    const streamingService = streamingServiceRef.current

    streamingService.setEventHandlers({
      onStart: (event: SSEStartEvent) => {
        conversationIdRef.current = event.conversation_id
      },

      onToken: (event: SSETokenEvent) => {
        currentMessageRef.current += event.content
        
        // Update the current AI message with accumulated content
        if (currentAiMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentAiMessageIdRef.current
                ? { ...msg, content: currentMessageRef.current, isStreaming: true }
                : msg
            )
          )
        }
      },

      onSources: (event: SSESourcesEvent) => {
        currentSourcesRef.current.push(event)
      },

      onClaims: (event: SSEClaimsEvent) => {
        currentClaimsGroupRef.current.push(event)
      },

      onCitation: (event: SSECitationEvent) => {
        currentCitationsRef.current.push(event)
      },

      onClaim: (event: SSEClaimEvent) => {
        currentClaimsRef.current.push(event)
      },

      onDone: (event: SSEDoneEvent) => {
        // Finalize the message with all accumulated data
        if (currentAiMessageIdRef.current) {
          // Combine sources from both sources events and citation events
          const allSources = [
            ...currentSourcesRef.current.flatMap(s => s.sources),
            ...currentCitationsRef.current.map(c => ({
              id: c.citation.id,
              title: c.citation.title,
              url: c.citation.url,
              snippet: c.citation.snippet,
              relevance_score: c.citation.relevance_score
            }))
          ]

          // Combine claims from both claims events and claim events
          const allClaims = [
            ...currentClaimsGroupRef.current.flatMap(c => c.claims),
            ...currentClaimsRef.current.map(c => c.claim)
          ]

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentAiMessageIdRef.current
                ? {
                    ...msg,
                    content: currentMessageRef.current,
                    isStreaming: false,
                    sources: allSources,
                    claims: isProofMode && allClaims.length > 0 ? allClaims : undefined
                  }
                : msg
            )
          )
        }

        setIsStreaming(false)
        currentAiMessageIdRef.current = null
        currentMessageRef.current = ""
        currentSourcesRef.current = []
        currentCitationsRef.current = []
        currentClaimsRef.current = []
        currentClaimsGroupRef.current = []
      },

      onError: (event: SSEErrorEvent) => {
        console.error("Streaming error:", event)
        
        // Add error message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          content: `Error: ${event.error}. Please try again.`,
          isUser: false,
          timestamp: new Date(),
          isStreaming: false
        }

        setMessages((prev) => [...prev, errorMessage])
        setIsStreaming(false)
        
        toast.error(`Streaming error: ${event.error}`)
      },

      onConnectionStateChange: (state: SSEConnectionState) => {
        if (state === SSEConnectionState.CONNECTED) {
          setBackendConnected(true)
        } else if (state === SSEConnectionState.ERROR || state === SSEConnectionState.DISCONNECTED) {
          // SSE connection issues shouldn't affect conversations sidebar visibility
          console.log('SSE connection state changed:', state)
        }
      }
    })

    return () => {
      streamingService.closeConnection()
    }
  }, [isProofMode, isStreaming])

  // Check backend connection on mount and URL change
  useEffect(() => {
    checkConnection()
    
    // Update streaming service URL
    streamingServiceRef.current.updateConfig({ url: apiUrl })
  }, [apiUrl])

  const handleSearch = async (query: string) => {
    if (!query.trim() || isStreaming) return

    setCurrentQuery(query)
    setIsChatMode(true)
    setIsStreaming(true)

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: query,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Create AI message placeholder
    const aiMessageId = `ai-${Date.now()}`
    currentAiMessageIdRef.current = aiMessageId
    currentMessageRef.current = ""
    currentSourcesRef.current = []
    currentCitationsRef.current = []
    currentClaimsRef.current = []
    currentClaimsGroupRef.current = []

    const aiMessage: ChatMessage = {
      id: aiMessageId,
      content: "",
      isUser: false,
      timestamp: new Date(),
      isStreaming: true
    }

    setMessages((prev) => [...prev, aiMessage])

    try {
      // Create chat request with correct format
      const chatRequest: ChatRequest = {
        message: query, // Backend expects 'message' field
        enable_cva: isProofMode,
        conversation_id: conversationIdRef.current
      }

      // Start streaming
      await streamingServiceRef.current.startStream(chatRequest)

    } catch (error) {
      console.error("Chat error:", error)
      setIsStreaming(false)
      // Don't set backendConnected to false - conversations sidebar should remain visible

      // Remove placeholder message and add error
      setMessages((prev) => {
        const filteredMessages = prev.filter(msg => msg.id !== aiMessageId)
        return [...filteredMessages, {
          id: `error-${Date.now()}`,
          content: "Sorry, I encountered an error processing your request. Please try again.",
          isUser: false,
          timestamp: new Date(),
          isStreaming: false
        }]
      })

      toast.error("Failed to get response from backend")
    }
  }

  const handleNewChat = () => {
    // Close any active streaming connection
    streamingServiceRef.current.closeConnection()
    
    setIsChatMode(false)
    setMessages([])
    setCurrentQuery("")
    setIsStreaming(false)
    currentAiMessageIdRef.current = null
    currentMessageRef.current = ""
    currentSourcesRef.current = []
    currentCitationsRef.current = []
    currentClaimsRef.current = []
    currentClaimsGroupRef.current = []
    conversationIdRef.current = null
  }

  const handleConfigChange = (newUrl: string) => {
    setApiUrl(newUrl)
    // Re-check connection after configuration change
    setTimeout(() => {
      checkConnection()
    }, 500)
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <BackgroundEffect />

      {/* Conversations Sidebar - Always shown on desktop */}
      <ConversationSidebar
        apiUrl={apiUrl}
        activeConversationId={conversationIdRef.current}
        onConversationSelect={loadConversation}
        onNewConversation={handleNewChat}
        backendConnected={backendConnected}
      />

      {/* Main Content Area with responsive padding */}
      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        {!isChatMode && (
          <div className="flex-shrink-0">
            <ProofModeToggle
              isProofMode={isProofMode}
              onToggle={setIsProofMode}
              isChatMode={isChatMode}
              backendConnected={backendConnected}
            />
          </div>
        )}

        <div className="flex-1 transition-all duration-700 ease-in-out overflow-hidden">
          {!isChatMode ? (
            <div className="h-full px-4 sm:px-6 lg:px-8">
              <HomeScreen onSearch={handleSearch} backendConnected={backendConnected} />
            </div>
          ) : (
            <div className="h-full px-4 sm:px-6 lg:px-8">
              <ChatInterface
                messages={messages}
                onSearch={handleSearch}
                isProofMode={isProofMode}
                isStreaming={isStreaming}
                onProofModeToggle={setIsProofMode}
                backendConnected={backendConnected}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
