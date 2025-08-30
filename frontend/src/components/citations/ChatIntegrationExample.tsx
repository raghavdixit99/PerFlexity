/**
 * ChatIntegrationExample Component
 * 
 * Example showing how to integrate citation components with the existing ChatInterface.
 * This demonstrates the complete integration pattern for Stream C to follow.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Separator } from '../ui/separator';
import { CitationList, InlineCitation, useCitationManager } from './index';
import { CitationData } from './types';
import { mockCitations } from './utils';

// Extended message type that includes citations
interface EnhancedChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  citations?: CitationData[];
  isStreaming?: boolean;
}

interface ChatIntegrationExampleProps {
  messages: EnhancedChatMessage[];
  onSendMessage: (message: string) => void;
  isStreaming?: boolean;
}

/**
 * Enhanced message bubble that supports citations
 */
function MessageBubble({
  message,
  onCitationClick,
}: {
  message: EnhancedChatMessage;
  onCitationClick: (citation: CitationData) => void;
}) {
  const { parseCitations } = useCitationManager();

  // Parse citations from message content
  const parsedContent = message.citations 
    ? parseCitations(message.content, message.citations)
    : { text: message.content, citations: [] };

  const renderContentWithCitations = (content: string, citations: CitationData[]) => {
    if (!citations.length) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }

    // Simple citation replacement for demo
    let processedContent = content;
    citations.forEach((citation, index) => {
      const citationRegex = new RegExp(`\\[${index + 1}\\]`, 'g');
      processedContent = processedContent.replace(
        citationRegex,
        `<citation-placeholder data-id="${citation.id}" data-index="${index + 1}"></citation-placeholder>`
      );
    });

    // Create citation map for quick lookup
    const citationMap = new Map(citations.map(c => [c.id, c]));

    return (
      <div
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const placeholder = target.closest('[data-id]') as HTMLElement;
          if (placeholder) {
            const citationId = placeholder.getAttribute('data-id');
            const citation = citationId ? citationMap.get(citationId) : null;
            if (citation) {
              onCitationClick(citation);
            }
          }
        }}
      />
    );
  };

  return (
    <div className={`flex gap-4 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
      {!message.isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      
      <div className={`max-w-3xl ${message.isUser ? 'text-right' : ''}`}>
        <div
          className={`rounded-xl p-4 ${
            message.isUser
              ? 'bg-primary text-primary-foreground ml-12'
              : 'bg-card border border-border shadow-sm'
          }`}
        >
          <div className="text-sm leading-relaxed">
            {renderContentWithCitations(message.content, message.citations || [])}
          </div>
          
          {/* Streaming indicator */}
          {!message.isUser && message.isStreaming && (
            <div className="flex items-center gap-2 mt-3 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}
        </div>
        
        {/* Citations section */}
        {!message.isUser && message.citations && message.citations.length > 0 && !message.isStreaming && (
          <div className="mt-3 ml-0">
            <CitationList
              citations={message.citations}
              onCitationClick={onCitationClick}
              title="Sources"
              maxItems={3}
            />
          </div>
        )}
        
        <div className="text-xs text-muted-foreground mt-2">
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
      
      {message.isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      {/* Citation styling */}
      <style jsx>{`
        [data-id] {
          color: rgb(59 130 246);
          cursor: pointer;
          text-decoration: underline;
          text-decoration-style: dotted;
          text-underline-offset: 2px;
          font-weight: 500;
          padding: 0 1px;
          border-radius: 2px;
          transition: all 0.2s ease;
        }
        [data-id]:hover {
          color: rgb(37 99 235);
          background-color: rgb(59 130 246 / 0.1);
          padding: 0 2px;
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}

/**
 * Main chat interface with citation support
 */
export function ChatIntegrationExample({
  messages,
  onSendMessage,
  isStreaming = false,
}: ChatIntegrationExampleProps) {
  const [query, setQuery] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isStreaming) {
      onSendMessage(query);
      setQuery('');
    }
  };

  const handleCitationClick = (citation: CitationData) => {
    setSelectedCitation(citation);
    // Could also open source in new tab, track analytics, etc.
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCitationClick={handleCitationClick}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isStreaming ? "Please wait..." : "Follow up with another question..."}
                className="h-12 pr-4 rounded-xl border-2 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                disabled={isStreaming}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90"
              disabled={!query.trim() || isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Selected Citation Drawer */}
      {selectedCitation && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 md:items-center">
          <Card className="w-full max-w-md m-4 md:max-w-lg">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold">Citation Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCitation(null)}
                  className="h-8 w-8 p-0"
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Title
                  </h3>
                  <p className="mt-1">{selectedCitation.title}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Source
                  </h3>
                  <p className="mt-1 text-primary">
                    <a 
                      href={selectedCitation.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {selectedCitation.url}
                    </a>
                  </p>
                </div>
                
                {selectedCitation.snippet && (
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Preview
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedCitation.snippet}
                    </p>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => window.open(selectedCitation.url, '_blank', 'noopener,noreferrer')}
                    size="sm"
                  >
                    Visit Source
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCitation(null)}
                    size="sm"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Demo wrapper with sample data
 */
export function ChatIntegrationDemo() {
  const [messages, setMessages] = useState<EnhancedChatMessage[]>([
    {
      id: '1',
      content: 'What are the key differences between TypeScript and JavaScript?',
      isUser: true,
      timestamp: new Date(Date.now() - 60000),
    },
    {
      id: '2',
      content: `TypeScript is a strongly typed superset of JavaScript that compiles to plain JavaScript [1]. The key differences include:

**Type Safety**: TypeScript provides static type checking, which helps catch errors at compile time rather than runtime [1]. This is especially valuable in large applications where bugs can be costly.

**Enhanced IDE Support**: With TypeScript, you get better autocomplete, refactoring capabilities, and navigation features in your IDE [2]. This significantly improves developer productivity.

**Modern JavaScript Features**: TypeScript supports the latest ECMAScript features and can compile them down to older JavaScript versions for broader compatibility [1].

**Better Code Organization**: TypeScript's interfaces and classes provide better structure for complex applications [3]. This makes codebases more maintainable over time.

While JavaScript remains more flexible and has a lower learning curve, TypeScript's benefits become more apparent in larger projects where code quality and maintainability are crucial [4].`,
      isUser: false,
      timestamp: new Date(Date.now() - 30000),
      citations: mockCitations.slice(0, 4),
    },
  ]);
  
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSendMessage = (message: string) => {
    const newMessage: EnhancedChatMessage = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setIsStreaming(true);

    // Simulate streaming response
    setTimeout(() => {
      const responseMessage: EnhancedChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `That's a great follow-up question about ${message.toLowerCase()}. Let me provide some insights based on current best practices [1] and recent developments in the field [2].`,
        isUser: false,
        timestamp: new Date(),
        citations: mockCitations.slice(0, 2),
      };
      
      setMessages(prev => [...prev, responseMessage]);
      setIsStreaming(false);
    }, 2000);
  };

  return (
    <ChatIntegrationExample
      messages={messages}
      onSendMessage={handleSendMessage}
      isStreaming={isStreaming}
    />
  );
}
