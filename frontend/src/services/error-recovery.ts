/**
 * Error Recovery and Network Resilience Service
 * 
 * Provides comprehensive error handling, automatic retry mechanisms,
 * circuit breaker pattern, and network recovery strategies for API calls.
 */

import {
  SSEConnectionState,
  SSEConnectionError,
  SSEErrorType
} from '../types/sse';

// Circuit Breaker States
export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing fast, not attempting calls
  HALF_OPEN = 'half_open' // Testing if service recovered
}

// Error Recovery Strategies
export enum RecoveryStrategy {
  IMMEDIATE_RETRY = 'immediate_retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  CIRCUIT_BREAKER = 'circuit_breaker',
  FALLBACK = 'fallback',
  NONE = 'none'
}

// Network Quality States
export enum NetworkQuality {
  EXCELLENT = 'excellent',  // < 100ms latency, no packet loss
  GOOD = 'good',           // < 300ms latency, minimal packet loss
  FAIR = 'fair',           // < 1000ms latency, some packet loss
  POOR = 'poor',           // > 1000ms latency, significant packet loss
  OFFLINE = 'offline'      // No connectivity
}

// Error Recovery Configuration
export interface ErrorRecoveryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  networkQualityCheckInterval: number;
  fallbackEnabled: boolean;
}

// Recovery Attempt Result
export interface RecoveryAttempt {
  attempt: number;
  strategy: RecoveryStrategy;
  delay: number;
  timestamp: number;
  success: boolean;
  error?: Error;
}

// Network Quality Metrics
export interface NetworkMetrics {
  latency: number;
  packetLoss: number;
  bandwidth: number;
  stability: number;
  quality: NetworkQuality;
  timestamp: number;
}

// Error Classification
export interface ErrorClassification {
  type: SSEErrorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  strategy: RecoveryStrategy;
  maxRetries: number;
  baseDelay: number;
}

/**
 * Default error recovery configuration
 */
export const DEFAULT_RECOVERY_CONFIG: ErrorRecoveryConfig = {
  maxRetries: 5,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterEnabled: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  networkQualityCheckInterval: 30000,
  fallbackEnabled: true
};

/**
 * Error classification rules
 */
export const ERROR_CLASSIFICATION_RULES: Record<SSEErrorType, ErrorClassification> = {
  [SSEErrorType.CONNECTION_FAILED]: {
    type: SSEErrorType.CONNECTION_FAILED,
    severity: 'high',
    retryable: true,
    strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 5,
    baseDelay: 2000
  },
  [SSEErrorType.CONNECTION_LOST]: {
    type: SSEErrorType.CONNECTION_LOST,
    severity: 'medium',
    retryable: true,
    strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 3,
    baseDelay: 1000
  },
  [SSEErrorType.NETWORK_ERROR]: {
    type: SSEErrorType.NETWORK_ERROR,
    severity: 'high',
    retryable: true,
    strategy: RecoveryStrategy.CIRCUIT_BREAKER,
    maxRetries: 3,
    baseDelay: 5000
  },
  [SSEErrorType.TIMEOUT_ERROR]: {
    type: SSEErrorType.TIMEOUT_ERROR,
    severity: 'medium',
    retryable: true,
    strategy: RecoveryStrategy.LINEAR_BACKOFF,
    maxRetries: 3,
    baseDelay: 2000
  },
  [SSEErrorType.SERVER_ERROR]: {
    type: SSEErrorType.SERVER_ERROR,
    severity: 'high',
    retryable: true,
    strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 2,
    baseDelay: 3000
  },
  [SSEErrorType.AUTH_ERROR]: {
    type: SSEErrorType.AUTH_ERROR,
    severity: 'critical',
    retryable: false,
    strategy: RecoveryStrategy.NONE,
    maxRetries: 0,
    baseDelay: 0
  },
  [SSEErrorType.PARSE_ERROR]: {
    type: SSEErrorType.PARSE_ERROR,
    severity: 'low',
    retryable: false,
    strategy: RecoveryStrategy.NONE,
    maxRetries: 0,
    baseDelay: 0
  },
  [SSEErrorType.MAX_RETRIES_EXCEEDED]: {
    type: SSEErrorType.MAX_RETRIES_EXCEEDED,
    severity: 'critical',
    retryable: false,
    strategy: RecoveryStrategy.FALLBACK,
    maxRetries: 0,
    baseDelay: 0
  }
};

/**
 * Error Recovery Manager
 */
export class ErrorRecoveryManager {
  private config: ErrorRecoveryConfig;
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private recoveryAttempts: RecoveryAttempt[] = [];
  private networkMetrics: NetworkMetrics | null = null;
  private listeners: {
    onRecoveryAttempt?: (attempt: RecoveryAttempt) => void;
    onCircuitBreakerStateChange?: (state: CircuitBreakerState) => void;
    onNetworkQualityChange?: (quality: NetworkQuality) => void;
  } = {};

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.startNetworkQualityMonitoring();
  }

  /**
   * Classify error and determine recovery strategy
   */
  classifyError(error: SSEConnectionError): ErrorClassification {
    const baseClassification = ERROR_CLASSIFICATION_RULES[error.type];
    
    // Adjust strategy based on network quality
    if (this.networkMetrics?.quality === NetworkQuality.POOR) {
      return {
        ...baseClassification,
        strategy: RecoveryStrategy.LINEAR_BACKOFF,
        maxRetries: Math.max(1, Math.floor(baseClassification.maxRetries / 2)),
        baseDelay: baseClassification.baseDelay * 2
      };
    }
    
    if (this.networkMetrics?.quality === NetworkQuality.OFFLINE) {
      return {
        ...baseClassification,
        retryable: false,
        strategy: RecoveryStrategy.FALLBACK
      };
    }
    
    return baseClassification;
  }

  /**
   * Calculate recovery delay based on strategy
   */
  calculateDelay(
    classification: ErrorClassification, 
    attemptCount: number
  ): number {
    let delay: number;
    
    switch (classification.strategy) {
      case RecoveryStrategy.IMMEDIATE_RETRY:
        delay = 0;
        break;
        
      case RecoveryStrategy.LINEAR_BACKOFF:
        delay = classification.baseDelay * attemptCount;
        break;
        
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        delay = classification.baseDelay * Math.pow(this.config.backoffMultiplier, attemptCount - 1);
        break;
        
      case RecoveryStrategy.CIRCUIT_BREAKER:
        delay = this.circuitBreakerState === CircuitBreakerState.OPEN 
          ? this.config.circuitBreakerTimeout 
          : classification.baseDelay;
        break;
        
      default:
        delay = classification.baseDelay;
    }
    
    // Apply jitter to prevent thundering herd
    if (this.config.jitterEnabled && delay > 0) {
      const jitter = delay * 0.1 * Math.random();
      delay += jitter;
    }
    
    // Ensure delay doesn't exceed maximum
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Attempt error recovery
   */
  async attemptRecovery(
    error: SSEConnectionError,
    recoveryFn: () => Promise<void>,
    attemptCount = 1
  ): Promise<boolean> {
    const classification = this.classifyError(error);
    
    // Check if error is retryable
    if (!classification.retryable || attemptCount > classification.maxRetries) {
      this.handleMaxRetriesExceeded(error);
      return false;
    }
    
    // Check circuit breaker
    if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.config.circuitBreakerTimeout) {
        return false;
      }
      this.setCircuitBreakerState(CircuitBreakerState.HALF_OPEN);
    }
    
    const delay = this.calculateDelay(classification, attemptCount);
    
    const recoveryAttempt: RecoveryAttempt = {
      attempt: attemptCount,
      strategy: classification.strategy,
      delay,
      timestamp: Date.now(),
      success: false
    };
    
    this.listeners.onRecoveryAttempt?.(recoveryAttempt);
    
    if (delay > 0) {
      await this.sleep(delay);
    }
    
    try {
      await recoveryFn();
      
      // Recovery successful
      recoveryAttempt.success = true;
      this.recoveryAttempts.push(recoveryAttempt);
      this.resetFailureCount();
      
      if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
        this.setCircuitBreakerState(CircuitBreakerState.CLOSED);
      }
      
      return true;
      
    } catch (recoveryError) {
      // Recovery failed
      recoveryAttempt.success = false;
      recoveryAttempt.error = recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError));
      this.recoveryAttempts.push(recoveryAttempt);
      
      this.incrementFailureCount();
      
      // Try again recursively
      return this.attemptRecovery(error, recoveryFn, attemptCount + 1);
    }
  }

  /**
   * Handle case when max retries exceeded
   */
  private handleMaxRetriesExceeded(error: SSEConnectionError): void {
    this.setCircuitBreakerState(CircuitBreakerState.OPEN);
    this.lastFailureTime = Date.now();
    
    // Could implement fallback strategies here
    console.error('Max retries exceeded for error:', error);
  }

  /**
   * Increment failure count and update circuit breaker
   */
  private incrementFailureCount(): void {
    this.failureCount++;
    
    if (this.failureCount >= this.config.circuitBreakerThreshold) {
      this.setCircuitBreakerState(CircuitBreakerState.OPEN);
      this.lastFailureTime = Date.now();
    }
  }

  /**
   * Reset failure count
   */
  private resetFailureCount(): void {
    this.failureCount = 0;
  }

  /**
   * Set circuit breaker state
   */
  private setCircuitBreakerState(state: CircuitBreakerState): void {
    if (this.circuitBreakerState !== state) {
      this.circuitBreakerState = state;
      this.listeners.onCircuitBreakerStateChange?.(state);
    }
  }

  /**
   * Start network quality monitoring
   */
  private startNetworkQualityMonitoring(): void {
    if (this.config.networkQualityCheckInterval <= 0) return;
    
    setInterval(() => {
      this.checkNetworkQuality();
    }, this.config.networkQualityCheckInterval);
    
    // Initial check
    this.checkNetworkQuality();
  }

  /**
   * Check network quality
   */
  private async checkNetworkQuality(): Promise<void> {
    try {
      const start = Date.now();
      
      // Simple network quality check using a HEAD request
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const latency = Date.now() - start;
      
      let quality: NetworkQuality;
      if (!response.ok) {
        quality = NetworkQuality.OFFLINE;
      } else if (latency < 100) {
        quality = NetworkQuality.EXCELLENT;
      } else if (latency < 300) {
        quality = NetworkQuality.GOOD;
      } else if (latency < 1000) {
        quality = NetworkQuality.FAIR;
      } else {
        quality = NetworkQuality.POOR;
      }
      
      const previousQuality = this.networkMetrics?.quality;
      
      this.networkMetrics = {
        latency,
        packetLoss: 0, // Simplified - could implement actual packet loss detection
        bandwidth: 0,  // Simplified - could implement bandwidth testing
        stability: this.calculateNetworkStability(),
        quality,
        timestamp: Date.now()
      };
      
      if (previousQuality !== quality) {
        this.listeners.onNetworkQualityChange?.(quality);
      }
      
    } catch (error) {
      this.networkMetrics = {
        latency: Infinity,
        packetLoss: 1,
        bandwidth: 0,
        stability: 0,
        quality: NetworkQuality.OFFLINE,
        timestamp: Date.now()
      };
      
      this.listeners.onNetworkQualityChange?.(NetworkQuality.OFFLINE);
    }
  }

  /**
   * Calculate network stability score
   */
  private calculateNetworkStability(): number {
    if (this.recoveryAttempts.length === 0) return 1;
    
    const recentAttempts = this.recoveryAttempts.slice(-10);
    const successRate = recentAttempts.filter(a => a.success).length / recentAttempts.length;
    
    return successRate;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set event listeners
   */
  setListeners(listeners: {
    onRecoveryAttempt?: (attempt: RecoveryAttempt) => void;
    onCircuitBreakerStateChange?: (state: CircuitBreakerState) => void;
    onNetworkQualityChange?: (quality: NetworkQuality) => void;
  }): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      circuitBreakerState: this.circuitBreakerState,
      failureCount: this.failureCount,
      networkMetrics: this.networkMetrics,
      recoveryAttempts: this.recoveryAttempts.slice(-5) // Last 5 attempts
    };
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.recoveryAttempts = [];
  }
}

/**
 * Create error recovery manager instance
 */
export function createErrorRecoveryManager(config?: Partial<ErrorRecoveryConfig>): ErrorRecoveryManager {
  return new ErrorRecoveryManager(config);
}

/**
 * Default error recovery manager instance
 */
export const defaultErrorRecoveryManager = createErrorRecoveryManager();
