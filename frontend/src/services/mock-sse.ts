/**
 * Mock SSE Backend Service
 * 
 * Provides mock Server-Sent Events endpoints for development and testing.
 * Simulates realistic streaming responses with configurable delays, errors, and citations.
 */

import {
  SSEEventType,
  SSETokenMessage,
  SSECitationMessage,
  SSEDoneMessage,
  SSEErrorMessage,
  SSEHeartbeatMessage
} from '../types/sse';

// Mock Configuration
export interface MockSSEConfig {
  enableMocking: boolean;
  responseDelay: number;
  tokenDelay: number;
  errorRate: number;
  citationRate: number;
  heartbeatInterval: number;
  simulateNetworkIssues: boolean;
  maxResponseTime: number;
}

// Mock Chat Response Template
export interface MockChatTemplate {
  id: string;
  message: string;
  citations: Array<{
    title: string;
    url: string;
    snippet: string;
    relevance_score: number;
    position: { start: number; end: number };
  }>;
  processingTimeMs: number;
}

// Default mock configuration
export const DEFAULT_MOCK_CONFIG: MockSSEConfig = {
  enableMocking: true,
  responseDelay: 500,
  tokenDelay: 50,
  errorRate: 0.05, // 5% error rate
  citationRate: 0.3, // 30% chance of citation per sentence
  heartbeatInterval: 30000,
  simulateNetworkIssues: false,
  maxResponseTime: 10000
};

// Mock chat response templates
const MOCK_CHAT_TEMPLATES: MockChatTemplate[] = [
  {
    id: '1',
    message: `Artificial Intelligence (AI) has revolutionized numerous industries and continues to shape our future. From healthcare to finance, AI applications are transforming how we work and live. Machine learning algorithms can now process vast amounts of data to identify patterns and make predictions with remarkable accuracy. Deep learning, a subset of machine learning, has enabled breakthroughs in computer vision, natural language processing, and robotics. However, the rapid advancement of AI also raises important ethical questions about privacy, job displacement, and algorithmic bias that society must address thoughtfully.`,
    citations: [
      {
        title: "The Impact of Artificial Intelligence on Modern Society",
        url: "https://example.com/ai-impact-society",
        snippet: "AI has revolutionized numerous industries including healthcare, finance, and transportation...",
        relevance_score: 0.95,
        position: { start: 0, end: 95 }
      },
      {
        title: "Machine Learning: Patterns and Predictions",
        url: "https://example.com/ml-patterns-predictions",
        snippet: "Machine learning algorithms excel at processing large datasets to identify complex patterns...",
        relevance_score: 0.88,
        position: { start: 202, end: 301 }
      },
      {
        title: "Deep Learning Breakthroughs in Computer Vision",
        url: "https://example.com/deep-learning-cv",
        snippet: "Recent advances in deep learning have enabled significant breakthroughs in computer vision tasks...",
        relevance_score: 0.92,
        position: { start: 302, end: 445 }
      },
      {
        title: "Ethical Considerations in AI Development",
        url: "https://example.com/ai-ethics",
        snippet: "The rapid advancement of AI raises important questions about privacy, bias, and societal impact...",
        relevance_score: 0.89,
        position: { start: 482, end: 634 }
      }
    ],
    processingTimeMs: 3200
  },
  {
    id: '2',
    message: `Climate change represents one of the most pressing challenges of our time. Rising global temperatures are causing ice caps to melt, sea levels to rise, and weather patterns to become increasingly unpredictable. The scientific consensus is clear: human activities, particularly the emission of greenhouse gases from fossil fuels, are the primary drivers of current climate change. Renewable energy technologies like solar and wind power offer promising solutions, but transitioning to a sustainable energy system requires unprecedented global cooperation and investment.`,
    citations: [
      {
        title: "Global Temperature Rise and Climate Indicators",
        url: "https://example.com/climate-indicators",
        snippet: "Global average temperatures have risen significantly over the past century...",
        relevance_score: 0.96,
        position: { start: 62, end: 187 }
      },
      {
        title: "Scientific Consensus on Climate Change",
        url: "https://example.com/climate-consensus",
        snippet: "Over 97% of climate scientists agree that human activities are the primary cause...",
        relevance_score: 0.94,
        position: { start: 188, end: 351 }
      },
      {
        title: "Renewable Energy Solutions for Climate Action",
        url: "https://example.com/renewable-energy-solutions",
        snippet: "Solar and wind technologies have become cost-competitive with fossil fuels...",
        relevance_score: 0.91,
        position: { start: 352, end: 468 }
      }
    ],
    processingTimeMs: 2800
  },
  {
    id: '3',
    message: `The future of work is being reshaped by technological advancement and changing social dynamics. Remote work has become increasingly common, accelerated by the global pandemic. Digital collaboration tools enable teams to work effectively across geographical boundaries. However, this shift also presents challenges including work-life balance, digital fatigue, and the need for new management approaches. Organizations must adapt their cultures and practices to support both remote and hybrid work models while maintaining productivity and employee engagement.`,
    citations: [
      {
        title: "Remote Work Trends and Statistics",
        url: "https://example.com/remote-work-trends",
        snippet: "Remote work adoption has increased by 300% since the pandemic began...",
        relevance_score: 0.87,
        position: { start: 75, end: 159 }
      },
      {
        title: "Digital Collaboration Tools and Effectiveness",
        url: "https://example.com/digital-collaboration",
        snippet: "Modern collaboration platforms have enabled seamless remote teamwork...",
        relevance_score: 0.83,
        position: { start: 160, end: 247 }
      },
      {
        title: "Challenges of Remote Work Management",
        url: "https://example.com/remote-work-challenges",
        snippet: "Managing remote teams requires new approaches to leadership and communication...",
        relevance_score: 0.90,
        position: { start: 248, end: 395 }
      }
    ],
    processingTimeMs: 2400
  }
];

/**
 * Mock SSE Server
 */
export class MockSSEServer {
  private config: MockSSEConfig;
  private activeStreams = new Map<string, NodeJS.Timeout>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<MockSSEConfig> = {}) {
    this.config = { ...DEFAULT_MOCK_CONFIG, ...config };
  }

  /**
   * Start mock SSE stream
   */
  startMockStream(
    streamId: string,
    request: any,
    onMessage: (event: string, data: any) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): void {
    if (!this.config.enableMocking) {
      onError?.(new Error('Mock SSE server is disabled'));
      return;
    }

    // Select random template or first one
    const template = MOCK_CHAT_TEMPLATES[Math.floor(Math.random() * MOCK_CHAT_TEMPLATES.length)];
    
    // Start heartbeat
    this.startHeartbeat(streamId, onMessage);
    
    // Simulate initial delay
    setTimeout(() => {
      this.streamResponse(streamId, template, onMessage, onError, onComplete);
    }, this.config.responseDelay);
  }

  /**
   * Stream mock response
   */
  private streamResponse(
    streamId: string,
    template: MockChatTemplate,
    onMessage: (event: string, data: any) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): void {
    const tokens = this.tokenizeMessage(template.message);
    let currentTokenIndex = 0;
    let currentPosition = 0;

    const streamNextToken = () => {
      // Check for random errors
      if (Math.random() < this.config.errorRate) {
        this.sendErrorMessage(onMessage);
        onError?.(new Error('Mock server error'));
        return;
      }

      // Check for network issues simulation
      if (this.config.simulateNetworkIssues && Math.random() < 0.1) {
        const delay = Math.random() * 2000 + 1000; // 1-3 second delay
        setTimeout(streamNextToken, delay);
        return;
      }

      if (currentTokenIndex < tokens.length) {
        const token = tokens[currentTokenIndex];
        
        // Send token message
        const tokenMessage: SSETokenMessage = {
          id: `token-${currentTokenIndex}`,
          event: SSEEventType.TOKEN,
          data: {
            token,
            conversation_id: 'mock-conversation',
            message_id: template.id
          },
          timestamp: Date.now()
        };
        
        onMessage('token', tokenMessage.data);

        // Check if we should send a citation
        const tokenEndPosition = currentPosition + token.length;
        const citationForThisToken = template.citations.find(
          citation => citation.position.start >= currentPosition && 
                     citation.position.start < tokenEndPosition
        );

        if (citationForThisToken && Math.random() < this.config.citationRate) {
          setTimeout(() => {
            const citationMessage: SSECitationMessage = {
              id: `citation-${currentTokenIndex}`,
              event: SSEEventType.CITATION,
              data: {
                id: `citation-${Math.random().toString(36).substr(2, 9)}`,
                title: citationForThisToken.title,
                url: citationForThisToken.url,
                snippet: citationForThisToken.snippet,
                relevance_score: citationForThisToken.relevance_score,
                position: citationForThisToken.position,
                conversation_id: 'mock-conversation',
                message_id: template.id
              },
              timestamp: Date.now()
            };
            
            onMessage('citation', citationMessage.data);
          }, this.config.tokenDelay / 2);
        }

        currentPosition = tokenEndPosition;
        currentTokenIndex++;

        // Schedule next token
        const nextDelay = this.config.tokenDelay + (Math.random() * 20 - 10); // Add small jitter
        this.activeStreams.set(streamId, setTimeout(streamNextToken, nextDelay));
      } else {
        // Send completion message
        const doneMessage: SSEDoneMessage = {
          id: `done-${template.id}`,
          event: SSEEventType.DONE,
          data: {
            conversation_id: 'mock-conversation',
            message_id: template.id,
            total_tokens: tokens.length,
            citations_count: template.citations.length,
            processing_time_ms: template.processingTimeMs
          },
          timestamp: Date.now()
        };

        onMessage('done', doneMessage.data);
        this.stopHeartbeat(streamId);
        onComplete?.();
      }
    };

    // Start streaming
    streamNextToken();
  }

  /**
   * Tokenize message into realistic chunks
   */
  private tokenizeMessage(message: string): string[] {
    const tokens: string[] = [];
    const words = message.split(/(\s+)/);
    
    let currentChunk = '';
    for (const word of words) {
      currentChunk += word;
      
      // Create chunks of 1-4 words
      if (currentChunk.trim().split(/\s+/).length >= Math.random() * 3 + 1) {
        tokens.push(currentChunk);
        currentChunk = '';
      }
    }
    
    if (currentChunk.trim()) {
      tokens.push(currentChunk);
    }
    
    return tokens;
  }

  /**
   * Send error message
   */
  private sendErrorMessage(onMessage: (event: string, data: any) => void): void {
    const errorMessages = [
      'Rate limit exceeded',
      'Temporary server overload',
      'Service temporarily unavailable',
      'Request timeout',
      'Internal processing error'
    ];

    const errorMessage: SSEErrorMessage = {
      id: `error-${Date.now()}`,
      event: SSEEventType.ERROR,
      data: {
        error: errorMessages[Math.floor(Math.random() * errorMessages.length)],
        code: `E${Math.floor(Math.random() * 9000 + 1000)}`,
        details: { mock: true, timestamp: Date.now() },
        retry_after: Math.floor(Math.random() * 5000 + 1000)
      },
      timestamp: Date.now()
    };

    onMessage('error', errorMessage.data);
  }

  /**
   * Start heartbeat for stream
   */
  private startHeartbeat(streamId: string, onMessage: (event: string, data: any) => void): void {
    const heartbeatInterval = setInterval(() => {
      const heartbeatMessage: SSEHeartbeatMessage = {
        id: `heartbeat-${Date.now()}`,
        event: SSEEventType.HEARTBEAT,
        data: {
          timestamp: Date.now(),
          server_time: new Date().toISOString()
        },
        timestamp: Date.now()
      };

      onMessage('heartbeat', heartbeatMessage.data);
    }, this.config.heartbeatInterval);

    this.heartbeatIntervals.set(streamId, heartbeatInterval);
  }

  /**
   * Stop heartbeat for stream
   */
  private stopHeartbeat(streamId: string): void {
    const heartbeatInterval = this.heartbeatIntervals.get(streamId);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(streamId);
    }
  }

  /**
   * Stop mock stream
   */
  stopMockStream(streamId: string): void {
    const timeout = this.activeStreams.get(streamId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeStreams.delete(streamId);
    }
    
    this.stopHeartbeat(streamId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MockSSEConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MockSSEConfig {
    return { ...this.config };
  }

  /**
   * Clean up all active streams
   */
  cleanup(): void {
    for (const [streamId] of this.activeStreams) {
      this.stopMockStream(streamId);
    }
  }
}

/**
 * Mock SSE Server-Sent Events API for development
 */
export class MockSSEAPI {
  private mockServer: MockSSEServer;
  private eventListeners = new Map<string, EventTarget>();

  constructor(config?: Partial<MockSSEConfig>) {
    this.mockServer = new MockSSEServer(config);
  }

  /**
   * Create mock EventSource
   */
  createEventSource(url: string, options?: EventSourceInit): EventSource {
    // Extract stream ID from URL
    const streamId = this.extractStreamId(url);
    const eventTarget = new EventTarget();
    this.eventListeners.set(streamId, eventTarget);

    // Create mock EventSource
    const mockEventSource = {
      url,
      readyState: EventSource.CONNECTING,
      onopen: null as ((event: Event) => void) | null,
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      
      addEventListener: (type: string, listener: EventListener) => {
        eventTarget.addEventListener(type, listener);
      },
      
      removeEventListener: (type: string, listener: EventListener) => {
        eventTarget.removeEventListener(type, listener);
      },
      
      dispatchEvent: (event: Event) => {
        return eventTarget.dispatchEvent(event);
      },
      
      close: () => {
        this.mockServer.stopMockStream(streamId);
        this.eventListeners.delete(streamId);
        mockEventSource.readyState = EventSource.CLOSED;
      }
    } as EventSource;

    // Start mock stream
    setTimeout(() => {
      mockEventSource.readyState = EventSource.OPEN;
      mockEventSource.onopen?.(new Event('open'));
      eventTarget.dispatchEvent(new Event('open'));

      this.mockServer.startMockStream(
        streamId,
        {},
        (event: string, data: any) => {
          const messageEvent = new MessageEvent(event, {
            data: JSON.stringify(data),
            lastEventId: `${Date.now()}`,
            origin: location.origin
          });

          if (event === 'message' && mockEventSource.onmessage) {
            mockEventSource.onmessage(messageEvent);
          }

          eventTarget.dispatchEvent(messageEvent);
        },
        (error: Error) => {
          mockEventSource.readyState = EventSource.CLOSED;
          const errorEvent = new Event('error');
          mockEventSource.onerror?.(errorEvent);
          eventTarget.dispatchEvent(errorEvent);
        },
        () => {
          mockEventSource.close();
        }
      );
    }, 100);

    return mockEventSource;
  }

  /**
   * Extract stream ID from URL
   */
  private extractStreamId(url: string): string {
    const match = url.match(/stream\/([^/?]+)/);
    return match ? match[1] : `stream-${Date.now()}`;
  }

  /**
   * Enable/disable mocking
   */
  setMockingEnabled(enabled: boolean): void {
    this.mockServer.updateConfig({ enableMocking: enabled });
  }

  /**
   * Update mock configuration
   */
  updateConfig(config: Partial<MockSSEConfig>): void {
    this.mockServer.updateConfig(config);
  }
}

// Global mock SSE API instance
export const mockSSEAPI = new MockSSEAPI();

// Auto-enable mocking in development
if (process.env.NODE_ENV === 'development') {
  // Replace EventSource with mock implementation
  (globalThis as any).EventSource = class MockEventSource extends EventTarget {
    constructor(url: string, options?: EventSourceInit) {
      super();
      return mockSSEAPI.createEventSource(url, options);
    }
  };
}
