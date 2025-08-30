"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, User, Bot, Shield, Loader2, ExternalLink, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
// Simple markdown renderer to avoid compatibility issues
const MarkdownRenderer = ({ children, className }: { children: string, className: string }) => {
  const formatContent = (content: string) => {
    return content
      // Headers
      .replace(/### (.*?)(?=\n|$)/g, '<h3 class="text-sm font-medium mt-3 mb-1">$1</h3>')
      .replace(/## (.*?)(?=\n|$)/g, '<h2 class="text-base font-semibold mt-3 mb-2">$1</h2>')
      .replace(/# (.*?)(?=\n|$)/g, '<h1 class="text-lg font-semibold mt-4 mb-2">$1</h1>')
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Code
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mt-2">')
      .replace(/\n/g, "<br />")
      .trim()
  }

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{
        __html: `<p class="mt-0 mb-0">${formatContent(children)}</p>`,
      }}
    />
  )
}
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { ScrollArea } from "./ui/scroll-area"
import { Switch } from "./ui/switch"
import { Label } from "./ui/label"
import { ClaimVerificationTable } from "./ClaimVerificationTable"

interface ChatMessage {
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

interface ChatInterfaceProps {
  messages: ChatMessage[]
  onSearch: (query: string) => void
  isProofMode: boolean
  isStreaming?: boolean
  onProofModeToggle: (value: boolean) => void
  backendConnected?: boolean | null
}

export function ChatInterface({ messages, onSearch, isProofMode, isStreaming = false, onProofModeToggle, backendConnected }: ChatInterfaceProps) {
  const [query, setQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() && !isStreaming) {
      onSearch(query)
      setQuery("")
    }
  }

  const cleanContent = (content: string) => {
    // Clean up citation markers and formatting artifacts
    return content
      .replace(/\[\[([^\]]+)\]\]/g, '') // Remove [[n]] citations
      .replace(/\[(\d+)\]/g, '') // Remove [n] citations
      .replace(/\(\)/g, '') // Remove empty parentheses
      .replace(/\s+\(\s*\)/g, '') // Remove spaced empty parentheses
      .trim()
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Messages Area with ScrollArea for proper scrollbar positioning */}
      <ScrollArea className="flex-1">
        <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pr-3 sm:pr-6">
        {messages.map((message) => (
          <div key={message.id}>
            <div className={`flex gap-2 sm:gap-4 ${message.isUser ? "justify-end" : "justify-start"}`}>
              {!message.isUser && (
                <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-3xl ${message.isUser ? "text-right" : ""}`}>
                <div
                  className={`rounded-xl p-3 sm:p-4 ${
                    message.isUser
                      ? "bg-primary text-primary-foreground ml-6 sm:ml-12"
                      : "bg-card border border-border shadow-sm"
                  }`}
                >
                  <MarkdownRenderer className="text-sm leading-relaxed">
                    {cleanContent(message.content)}
                  </MarkdownRenderer>

                  {/* Streaming indicator */}
                  {!message.isUser && (isStreaming || message.isStreaming) && message === messages[messages.length - 1] && (
                    <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  )}
                </div>

                {/* Sources display */}
                {!message.isUser && message.sources && message.sources.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Sources</div>
                    <div className="grid gap-2">
                      {message.sources.map((source, index) => (
                        <div key={source.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm truncate">{source.title}</h4>
                              <Badge variant="outline" className="text-xs">
                                {Math.round(source.relevance_score * 100)}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {source.snippet}
                            </p>
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              View source <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claims display (when proof mode is enabled) - Enhanced Table View */}
                {!message.isUser && isProofMode && message.claims && message.claims.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Claim Verification Analysis
                    </div>
                    <ClaimVerificationTable 
                      claims={message.claims}
                      className="bg-white rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* Proof mode indicator when no claims yet */}
                {!message.isUser && isProofMode && message.content && !message.claims && !isStreaming && !message.isStreaming && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Proof mode enabled
                    </Badge>
                  </div>
                )}

                <div className="text-xs text-muted-foreground mt-2">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {message.isUser && (
                <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-background/80 backdrop-blur-sm p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
          <div className="flex gap-2 sm:gap-3 items-center">
            <div className="flex-1 relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isStreaming ? "Please wait..." : "Follow up with another question..."}
                className="h-10 sm:h-12 pr-4 rounded-lg sm:rounded-xl border-2 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 text-sm sm:text-base"
                disabled={isStreaming}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-10 sm:h-12 px-4 sm:px-6 rounded-lg sm:rounded-xl bg-primary hover:bg-primary/90"
              disabled={!query.trim() || isStreaming}
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3 h-3 sm:w-4 sm:h-4" />}
            </Button>
            
            {/* Proof Mode Toggle */}
            <div className="flex items-center gap-2 sm:gap-3 bg-background/90 backdrop-blur-sm rounded-full px-3 sm:px-4 py-2 border border-border/50 ml-2">
              <Shield className={`w-3 h-3 sm:w-4 sm:h-4 ${isProofMode ? "text-primary" : "text-muted-foreground"}`} />
              <Label htmlFor="proof-mode-chat" className="text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                Proof Mode
              </Label>
              <Switch
                id="proof-mode-chat"
                checked={isProofMode}
                onCheckedChange={onProofModeToggle}
                disabled={backendConnected === false}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
