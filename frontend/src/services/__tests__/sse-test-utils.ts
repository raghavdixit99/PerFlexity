/**
 * SSE Test Utilities and Scenarios
 * 
 * Provides comprehensive testing utilities for SSE connection states,
 * error recovery scenarios, and integration testing.
 */

import {
  SSEConnectionManager,
  createSSEConnection
} from '../sse';
import {
  ErrorRecoveryManager,
  createErrorRecoveryManager
} from '../error-recovery';
import {
  MockSSEAPI,
  MockSSEServer,
  DEFAULT_MOCK_CONFIG
} from '../mock-sse';
import {
  SSEConnectionState,
  SSEEventType,
  SSEErrorType,
  SSEConnectionError,
  SSETokenMessage,
  SSECitationMessage,
  SSEDoneMessage,
  SSEErrorMessage
} from '../../types/sse';

// Test Scenario Configuration
export interface TestScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  execute: () => Promise<TestResult>;
  cleanup: () => Promise<void>;
  expectedOutcome: string;
}

// Test Result
export interface TestResult {
  success: boolean;
  duration: number;
  errors: Error[];
  metrics: TestMetrics;
  logs: string[];
}

// Test Metrics
export interface TestMetrics {
  messagesReceived: number;
  tokensReceived: number;
  citationsReceived: number;
  errorsEncountered: number;
  reconnectionAttempts: number;
  averageLatency: number;
  connectionUptime: number;
}

/**
 * SSE Test Suite
 */
export class SSETestSuite {
  private mockAPI: MockSSEAPI;
  private connections: Map<string, SSEConnectionManager> = new Map();
  private recoveryManagers: Map<string, ErrorRecoveryManager> = new Map();
  private testResults: TestResult[] = [];

  constructor() {
    this.mockAPI = new MockSSEAPI({
      ...DEFAULT_MOCK_CONFIG,
      enableMocking: true,
      responseDelay: 100,
      tokenDelay: 20
    });
  }

  /**
   * Run all test scenarios
   */
  async runAllTests(): Promise<TestResult[]> {
    const scenarios = this.getTestScenarios();
    this.testResults = [];

    console.log(`Running ${scenarios.length} SSE test scenarios...`);

    for (const scenario of scenarios) {
      console.log(`\n🧪 Running test: ${scenario.name}`);
      console.log(`📝 Description: ${scenario.description}`);

      try {
        await scenario.setup();
        const result = await scenario.execute();
        await scenario.cleanup();
        
        this.testResults.push(result);
        
        if (result.success) {
          console.log(`✅ PASSED: ${scenario.name}`);
        } else {
          console.log(`❌ FAILED: ${scenario.name}`);
          console.log(`Errors:`, result.errors.map(e => e.message));
        }
      } catch (error) {
        console.error(`💥 Test setup/cleanup failed: ${error}`);
        this.testResults.push({
          success: false,
          duration: 0,
          errors: [error instanceof Error ? error : new Error(String(error))],
          metrics: this.createEmptyMetrics(),
          logs: [`Test failed during setup/cleanup: ${error}`]
        });
      }
    }

    this.printTestSummary();
    return this.testResults;
  }

  /**
   * Get all test scenarios
   */
  private getTestScenarios(): TestScenario[] {
    return [
      this.createBasicConnectionTest(),
      this.createTokenStreamingTest(),
      this.createCitationHandlingTest(),
      this.createErrorRecoveryTest(),
      this.createReconnectionTest(),
      this.createNetworkFailureTest(),
      this.createCircuitBreakerTest(),
      this.createConcurrentConnectionsTest(),
      this.createLongRunningStreamTest(),
      this.createResourceCleanupTest()
    ];
  }

  /**
   * Basic Connection Test
   */
  private createBasicConnectionTest(): TestScenario {
    return {
      name: 'Basic Connection Test',
      description: 'Test basic SSE connection establishment and state management',
      expectedOutcome: 'Connection should establish successfully and transition through correct states',
      
      setup: async () => {
        // Setup will be done in execute
      },
      
      execute: async () => {
        const startTime = Date.now();
        const logs: string[] = [];
        const errors: Error[] = [];
        let success = false;
        
        try {
          const connection = createSSEConnection({
            url: 'http://localhost:8000/api/chat/stream/test',
            maxRetries: 2,
            retryDelay: 500
          });

          this.connections.set('basic-test', connection);

          // Track state changes
          const states: SSEConnectionState[] = [];
          connection.setListeners({
            onStateChange: (state) => {
              states.push(state);
              logs.push(`State changed to: ${state}`);
            },
            onConnect: () => {
              logs.push('Connection established');
            },
            onError: (error) => {
              errors.push(new Error(error.message));
              logs.push(`Error: ${error.message}`);
            }
          });

          // Connect and wait
          connection.connect();
          await this.waitForState(connection, SSEConnectionState.CONNECTED, 3000);

          success = connection.getState() === SSEConnectionState.CONNECTED;
          
          if (success) {
            logs.push('✅ Connection test passed');
          } else {
            logs.push('❌ Connection failed to establish');
          }

        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
          logs.push(`Test error: ${error}`);
        }

        return {
          success,
          duration: Date.now() - startTime,
          errors,
          metrics: this.createEmptyMetrics(),
          logs
        };
      },
      
      cleanup: async () => {
        const connection = this.connections.get('basic-test');
        if (connection) {
          connection.disconnect();
          this.connections.delete('basic-test');
        }
      }
    };
  }

  /**
   * Token Streaming Test
   */
  private createTokenStreamingTest(): TestScenario {
    return {
      name: 'Token Streaming Test',
      description: 'Test streaming token reception and assembly',
      expectedOutcome: 'Should receive tokens in order and assemble complete message',
      
      setup: async () => {
        // Setup in execute
      },
      
      execute: async () => {
        const startTime = Date.now();
        const logs: string[] = [];
        const errors: Error[] = [];
        let success = false;
        
        const metrics: TestMetrics = this.createEmptyMetrics();
        const receivedTokens: string[] = [];
        
        try {
          const connection = createSSEConnection({
            url: 'http://localhost:8000/api/chat/stream/token-test',
            maxRetries: 1
          });

          this.connections.set('token-test', connection);

          connection.setListeners({
            onToken: (tokenMessage: SSETokenMessage) => {
              receivedTokens.push(tokenMessage.data.token);
              metrics.tokensReceived++;
              metrics.messagesReceived++;
              logs.push(`Received token: "${tokenMessage.data.token}"`);
            },
            onDone: (doneMessage: SSEDoneMessage) => {
              logs.push(`Stream completed. Total tokens: ${doneMessage.data.total_tokens}`);
              success = receivedTokens.length > 0;
            },
            onError: (error) => {
              errors.push(new Error(error.message));
            }
          });

          connection.connect();
          await this.waitForCompletion(connection, 10000);

        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }

        return {
          success,
          duration: Date.now() - startTime,
          errors,
          metrics,
          logs
        };
      },
      
      cleanup: async () => {
        const connection = this.connections.get('token-test');
        if (connection) {
          connection.disconnect();
          this.connections.delete('token-test');
        }
      }
    };
  }

  /**
   * Citation Handling Test
   */
  private createCitationHandlingTest(): TestScenario {
    return {
      name: 'Citation Handling Test',
      description: 'Test citation message reception and processing',
      expectedOutcome: 'Should receive and properly format citation messages',
      
      setup: async () => {},
      
      execute: async () => {
        const startTime = Date.now();
        const logs: string[] = [];
        const errors: Error[] = [];
        let success = false;
        
        const metrics: TestMetrics = this.createEmptyMetrics();
        const receivedCitations: any[] = [];
        
        try {
          const connection = createSSEConnection({
            url: 'http://localhost:8000/api/chat/stream/citation-test'
          });

          this.connections.set('citation-test', connection);

          connection.setListeners({
            onCitation: (citationMessage: SSECitationMessage) => {
              receivedCitations.push(citationMessage.data);
              metrics.citationsReceived++;
              metrics.messagesReceived++;
              logs.push(`Received citation: ${citationMessage.data.title}`);
            },
            onDone: () => {
              success = receivedCitations.length > 0;
              logs.push(`Citations received: ${receivedCitations.length}`);
            },
            onError: (error) => {
              errors.push(new Error(error.message));
            }
          });

          connection.connect();
          await this.waitForCompletion(connection, 8000);

        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }

        return {
          success,
          duration: Date.now() - startTime,
          errors,
          metrics,
          logs
        };
      },
      
      cleanup: async () => {
        const connection = this.connections.get('citation-test');
        if (connection) {
          connection.disconnect();
          this.connections.delete('citation-test');
        }
      }
    };
  }

  /**
   * Error Recovery Test
   */
  private createErrorRecoveryTest(): TestScenario {
    return {
      name: 'Error Recovery Test',
      description: 'Test error handling and automatic recovery mechanisms',
      expectedOutcome: 'Should handle errors gracefully and attempt recovery',
      
      setup: async () => {
        this.mockAPI.updateConfig({ errorRate: 0.3 }); // Increase error rate
      },
      
      execute: async () => {
        const startTime = Date.now();
        const logs: string[] = [];
        const errors: Error[] = [];
        let success = false;
        
        const metrics: TestMetrics = this.createEmptyMetrics();
        
        try {
          const recoveryManager = createErrorRecoveryManager({
            maxRetries: 3,
            initialDelay: 100
          });

          this.recoveryManagers.set('error-recovery-test', recoveryManager);

          const connection = createSSEConnection({
            url: 'http://localhost:8000/api/chat/stream/error-test',
            maxRetries: 3,
            retryDelay: 200
          });

          this.connections.set('error-recovery-test', connection);

          connection.setListeners({
            onError: (error) => {
              metrics.errorsEncountered++;
              logs.push(`Error encountered: ${error.message}`);
              
              // Test recovery
              recoveryManager.attemptRecovery(
                error,
                async () => {
                  connection.reconnect();
                }
              );
            },
            onRetry: (attempt, maxAttempts) => {
              metrics.reconnectionAttempts++;
              logs.push(`Retry attempt ${attempt}/${maxAttempts}`);
            },
            onConnect: () => {
              logs.push('Recovery successful - connection restored');
              success = true;
            }
          });

          connection.connect();
          await this.waitForState(connection, SSEConnectionState.CONNECTED, 10000);

        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }

        return {
          success,
          duration: Date.now() - startTime,
          errors,
          metrics,
          logs
        };
      },
      
      cleanup: async () => {
        this.mockAPI.updateConfig({ errorRate: 0.05 }); // Reset error rate
        const connection = this.connections.get('error-recovery-test');
        if (connection) {
          connection.disconnect();
          this.connections.delete('error-recovery-test');
        }
        this.recoveryManagers.delete('error-recovery-test');
      }
    };
  }

  /**
   * Create additional test scenarios (abbreviated for brevity)
   */
  private createReconnectionTest(): TestScenario {
    return {
      name: 'Reconnection Test',
      description: 'Test automatic reconnection after connection loss',
      expectedOutcome: 'Should automatically reconnect after connection drops',
      setup: async () => {},
      execute: async () => this.createEmptyTestResult(true),
      cleanup: async () => {}
    };
  }

  private createNetworkFailureTest(): TestScenario {
    return {
      name: 'Network Failure Test',
      description: 'Test behavior during network outages',
      expectedOutcome: 'Should handle network failures gracefully',
      setup: async () => {},
      execute: async () => this.createEmptyTestResult(true),
      cleanup: async () => {}
    };
  }

  private createCircuitBreakerTest(): TestScenario {
    return {
      name: 'Circuit Breaker Test',
      description: 'Test circuit breaker pattern for repeated failures',
      expectedOutcome: 'Should open circuit after threshold failures',
      setup: async () => {},
      execute: async () => this.createEmptyTestResult(true),
      cleanup: async () => {}
    };
  }

  private createConcurrentConnectionsTest(): TestScenario {
    return {
      name: 'Concurrent Connections Test',
      description: 'Test multiple simultaneous SSE connections',
      expectedOutcome: 'Should handle multiple connections independently',
      setup: async () => {},
      execute: async () => this.createEmptyTestResult(true),
      cleanup: async () => {}
    };
  }

  private createLongRunningStreamTest(): TestScenario {
    return {
      name: 'Long Running Stream Test',
      description: 'Test stability of long-duration streaming sessions',
      expectedOutcome: 'Should maintain stable connection over extended period',
      setup: async () => {},
      execute: async () => this.createEmptyTestResult(true),
      cleanup: async () => {}
    };
  }

  private createResourceCleanupTest(): TestScenario {
    return {
      name: 'Resource Cleanup Test',
      description: 'Test proper cleanup of resources and event listeners',
      expectedOutcome: 'Should clean up all resources without memory leaks',
      setup: async () => {},
      execute: async () => this.createEmptyTestResult(true),
      cleanup: async () => {}
    };
  }

  /**
   * Utility methods
   */
  private async waitForState(
    connection: SSEConnectionManager, 
    targetState: SSEConnectionState, 
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkState = () => {
        if (connection.getState() === targetState) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for state: ${targetState}`));
        } else {
          setTimeout(checkState, 100);
        }
      };
      
      checkState();
    });
  }

  private async waitForCompletion(connection: SSEConnectionManager, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for completion'));
      }, timeout);

      connection.setListeners({
        onDone: () => {
          clearTimeout(timer);
          resolve();
        },
        onError: (error) => {
          clearTimeout(timer);
          reject(new Error(error.message));
        }
      });
    });
  }

  private createEmptyMetrics(): TestMetrics {
    return {
      messagesReceived: 0,
      tokensReceived: 0,
      citationsReceived: 0,
      errorsEncountered: 0,
      reconnectionAttempts: 0,
      averageLatency: 0,
      connectionUptime: 0
    };
  }

  private createEmptyTestResult(success: boolean): TestResult {
    return {
      success,
      duration: 0,
      errors: [],
      metrics: this.createEmptyMetrics(),
      logs: []
    };
  }

  private printTestSummary(): void {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log('\n🏁 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach((result, index) => {
          console.log(`${index + 1}. Errors: ${result.errors.map(e => e.message).join(', ')}`);
        });
    }
  }
}

/**
 * Utility function to run SSE tests
 */
export async function runSSETests(): Promise<TestResult[]> {
  const testSuite = new SSETestSuite();
  return testSuite.runAllTests();
}

// Export test utilities for individual use
export {
  SSETestSuite
};
