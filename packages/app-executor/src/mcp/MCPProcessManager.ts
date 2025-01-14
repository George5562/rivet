import { spawn, type ChildProcess } from 'child_process';
import { SecurityManager, MCPError, MCPErrorCode } from '@ironclad/rivet-mcp-shared';
import type {
  MCPServerConfig,
  MCPServerConfigWithSecurity,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ToolRequest,
  SecuritySettings,
} from '@ironclad/rivet-mcp-shared';
import type { ServerState } from './types.js';

/**
 * Manages MCP server processes and implements the Model Context Protocol lifecycle
 */
export class MCPProcessManager {
  private readonly servers: Map<string, ServerState> = new Map();

  /**
   * Validate server configuration
   */
  private validateConfig(config: MCPServerConfig): void {
    if (!config.command) {
      throw new MCPError(MCPErrorCode.ValidationError, 'Server command is required', { field: 'command' });
    }
    if (!Array.isArray(config.args)) {
      throw new MCPError(MCPErrorCode.ValidationError, 'Server args must be an array', { field: 'args' });
    }
  }

  /**
   * Initialize a connection to an MCP server with error handling
   */
  async initialize(serverId: string, config: MCPServerConfigWithSecurity): Promise<void> {
    try {
      // Validate configuration
      this.validateConfig(config);

      // Create security manager
      const security = new SecurityManager(config.security);

      // Start the server process
      const serverProcess = spawn(config.command, config.args ?? [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle process errors
      serverProcess.on('error', (err) => {
        throw new MCPError(MCPErrorCode.ConnectionError, `Failed to start server process: ${err.message}`, {
          originalError: err,
        });
      });

      // Store initial state with security manager
      this.servers.set(serverId, {
        process: serverProcess,
        capabilities: [],
        status: 'initializing',
        requestId: 1,
        pendingRequests: new Map(),
        resourceWatchers: new Map(),
        security,
      });

      // Set up message handling with error handling
      this.setupMessageHandling(serverId, serverProcess);

      try {
        // Protocol handshake
        const initResponse = await this.sendRequest(serverId, 'initialize', {
          capabilities: {
            resources: true,
            tools: true,
            sampling: true,
          },
          version: '1.0.0',
        });

        // Validate response
        if (!initResponse || typeof initResponse !== 'object') {
          throw new MCPError(MCPErrorCode.InvalidRequest, 'Invalid initialization response', {
            response: initResponse,
          });
        }

        // Store server capabilities
        const state = this.servers.get(serverId)!;
        if (initResponse.capabilities) {
          state.capabilities = Object.keys(initResponse.capabilities).filter((key) => initResponse.capabilities[key]);
        }

        // Send initialized notification
        await this.sendNotification(serverId, 'initialized', {});

        // Update server state
        state.status = 'connected';
      } catch (err) {
        // Handle initialization errors
        await this.handleInitializationError(serverId, err);
      }
    } catch (err) {
      // Handle startup errors
      await this.handleStartupError(serverId, err);
    }
  }

  /**
   * Handle initialization phase errors
   */
  private async handleInitializationError(serverId: string, err: unknown): Promise<void> {
    const state = this.servers.get(serverId);
    if (state) {
      state.status = 'error';
      try {
        // Try to send shutdown notification
        await this.sendNotification(serverId, 'shutdown', {
          error:
            err instanceof MCPError
              ? (err as MCPError).toJsonRpcError()
              : {
                  code: MCPErrorCode.InternalError,
                  message: err instanceof Error ? err.message : 'Unknown error',
                },
        });
      } catch {
        // Ignore shutdown notification errors
      }
      // Clean up resources
      await this.cleanupResources(serverId);
      // Kill process
      state.process.kill();
      this.servers.delete(serverId);
    }
    throw err instanceof MCPError
      ? err
      : new MCPError(
          MCPErrorCode.ConnectionError,
          `Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          { originalError: err },
        );
  }

  /**
   * Handle startup errors
   */
  private async handleStartupError(serverId: string, err: unknown): Promise<void> {
    const state = this.servers.get(serverId);
    if (state) {
      state.status = 'error';
      state.process.kill();
      this.servers.delete(serverId);
    }
    throw err instanceof MCPError
      ? err
      : new MCPError(
          MCPErrorCode.ConnectionError,
          `Server startup failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          { originalError: err },
        );
  }

  /**
   * Enhanced message handling with error handling
   */
  private setupMessageHandling(serverId: string, serverProcess: ChildProcess): void {
    serverProcess.stdout!.on('data', (data: Buffer) => {
      try {
        const messages = data.toString().trim().split('\n');
        for (const message of messages) {
          if (!message) continue;

          try {
            const parsed = JSON.parse(message);

            // Handle notifications
            if (!parsed.id) {
              this.handleNotification(serverId, parsed as JsonRpcNotification);
              continue;
            }

            // Handle responses
            const response = parsed as JsonRpcResponse;
            const state = this.servers.get(serverId);
            if (!state) return;

            const pending = state.pendingRequests.get(response.id as number);
            if (pending) {
              if (response.error) {
                // Convert JSON-RPC error to MCPError
                pending.reject(new MCPError(response.error.code, response.error.message, response.error.data));
              } else {
                pending.resolve(response.result);
              }
              state.pendingRequests.delete(response.id as number);
            }
          } catch (err: unknown) {
            // Handle JSON parse errors
            throw new MCPError(
              MCPErrorCode.ParseError,
              `Invalid JSON in server message: ${err instanceof Error ? err.message : String(err)}`,
              { message },
            );
          }
        }
      } catch (err) {
        console.error(`Error handling MCP server message: ${err}`);
        const state = this.servers.get(serverId);
        if (state) {
          state.status = 'error';
        }
      }
    });

    serverProcess.stderr!.on('data', (data: Buffer) => {
      console.error(`MCP server ${serverId} error:`, data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error(`MCP server ${serverId} process error:`, err);
      const state = this.servers.get(serverId);
      if (state) {
        state.status = 'error';
      }
    });

    serverProcess.on('exit', (code) => {
      console.log(`MCP server ${serverId} exited with code ${code}`);
      // Clean up on unexpected exit
      const state = this.servers.get(serverId);
      if (state) {
        state.status = 'error';
        state.pendingRequests.forEach((pending) => {
          pending.reject(new MCPError(MCPErrorCode.ConnectionError, 'Server connection terminated', { serverId }));
        });
        state.pendingRequests.clear();
        state.resourceWatchers.clear();
      }
    });
  }

  /**
   * Send a request to the server
   */
  private async sendRequest(serverId: string, method: string, params: any): Promise<any> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: state.requestId++,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      state.pendingRequests.set(request.id, { resolve, reject });
      state.process.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Send a notification to the server
   */
  private async sendNotification(serverId: string, method: string, params: any): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    state.process.stdin!.write(JSON.stringify(notification) + '\n');
  }

  /**
   * Handle server notifications
   */
  private handleNotification(serverId: string, notification: JsonRpcNotification): void {
    const state = this.servers.get(serverId);
    if (!state) return;

    switch (notification.method) {
      case 'resource/update':
        this.handleResourceUpdate(serverId, notification.params);
        break;
      case 'resource/delete':
        this.handleResourceDelete(serverId, notification.params);
        break;
      default:
        console.warn(`Unknown notification method: ${notification.method}`);
    }
  }

  /**
   * Handle resource update notifications
   */
  private handleResourceUpdate(serverId: string, params: any): void {
    const state = this.servers.get(serverId);
    if (!state) return;

    const resourceId = params.id;
    const watcher = state.resourceWatchers.get(resourceId);
    if (watcher) {
      watcher.emit('update', params);
    }
  }

  /**
   * Handle resource delete notifications
   */
  private handleResourceDelete(serverId: string, params: any): void {
    const state = this.servers.get(serverId);
    if (!state) return;

    const resourceId = params.id;
    const watcher = state.resourceWatchers.get(resourceId);
    if (watcher) {
      watcher.emit('delete', params);
      state.resourceWatchers.delete(resourceId);
    }
  }

  /**
   * Clean up server resources
   */
  private async cleanupResources(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) return;

    // Clear pending requests
    state.pendingRequests.clear();

    // Clear resource watchers
    state.resourceWatchers.clear();
  }

  /**
   * Check if server supports a capability
   */
  private checkCapability(serverId: string, capability: string): void {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    if (!state.capabilities.includes(capability)) {
      throw new MCPError(MCPErrorCode.CapabilityNotSupported, `Server ${serverId} does not support ${capability}`, {
        serverId,
        capability,
        supportedCapabilities: state.capabilities,
      });
    }
  }

  /**
   * Execute a tool on the server
   */
  async executeTool(serverId: string, request: ToolRequest): Promise<any> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    // Validate tool execution permission
    state.security.validateToolExecution(request);

    // Sanitize request parameters
    const sanitizedRequest = state.security.sanitizeToolRequest(request);

    // Execute tool
    return this.sendRequest(serverId, 'tool/execute', sanitizedRequest);
  }

  /**
   * Update security settings for a server
   */
  updateSecuritySettings(serverId: string, settings: Partial<SecuritySettings>): void {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    state.security.updateSettings(settings);
  }

  /**
   * Get current security settings for a server
   */
  getSecuritySettings(serverId: string): SecuritySettings {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    return state.security.getSettings();
  }
}
