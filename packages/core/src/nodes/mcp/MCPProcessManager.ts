import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type {
  MCPServerConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ServerCapabilities,
  ResourceRequest,
  ResourceResponse,
  ResourceWatchEvent,
  ToolRequest,
  ToolInfo,
  SampleRequest,
  SampleResponse,
  SecuritySettings,
  MCPServerConfigWithSecurity,
} from './types.js';
import { MCPError, MCPErrorCode } from './types.js';
import { SecurityManager } from './security/SecurityManager.js';

interface ServerState {
  process: ChildProcess;
  capabilities: string[];
  status: 'initializing' | 'connected' | 'error';
  requestId: number;
  pendingRequests: Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >;
  resourceWatchers: Map<string, EventEmitter>;
  security: SecurityManager;
}

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
      const serverProcess = spawn(config.command, config.args, {
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
              ? err.toJsonRpcError()
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
      if (code !== 0) {
        const state = this.servers.get(serverId);
        if (state && state.status !== 'error') {
          state.status = 'error';
        }
      }
      this.servers.delete(serverId);
    });
  }

  /**
   * Enhanced request sending with error handling
   */
  private async sendRequest(serverId: string, method: string, params: any): Promise<any> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    if (state.status === 'error') {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} is in error state`);
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: state.requestId++,
    };

    return new Promise((resolve, reject) => {
      try {
        state.pendingRequests.set(request.id as number, { resolve, reject });
        state.process.stdin!.write(JSON.stringify(request) + '\n');
      } catch (err: unknown) {
        state.pendingRequests.delete(request.id as number);
        reject(
          new MCPError(
            MCPErrorCode.ConnectionError,
            `Failed to send request: ${err instanceof Error ? err.message : String(err)}`,
            { request },
          ),
        );
      }
    });
  }

  /**
   * Send a JSON-RPC notification to a server
   */
  private async sendNotification(serverId: string, method: string, params: any): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) throw new Error(`Server ${serverId} not found`);

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
    if (!state?.resourceWatchers) return;

    // Handle resource watch events
    if (notification.method === 'resourceChanged') {
      const event = notification.params as ResourceWatchEvent;
      const emitter = state.resourceWatchers.get(event.resource.metadata.id);
      if (emitter) {
        emitter.emit('change', event);
      }
    }
  }

  /**
   * Clean up resources for a server
   */
  private async cleanupResources(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) return;

    // Clean up resource watchers
    if (state.resourceWatchers) {
      for (const [resourceId, emitter] of state.resourceWatchers) {
        emitter.removeAllListeners();
        try {
          await this.unwatchResource(serverId, resourceId);
        } catch (err) {
          console.error(`Error cleaning up resource watcher: ${err}`);
        }
      }
      state.resourceWatchers.clear();
    }

    // Reject pending requests with connection error
    for (const [id, { reject }] of state.pendingRequests) {
      reject(new MCPError(MCPErrorCode.ConnectionError, 'Server connection terminated', { serverId }));
      state.pendingRequests.delete(id);
    }
  }

  /**
   * Verify a server supports a specific capability
   */
  private verifyCapability(serverId: string, capability: string): void {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }
    if (!state.capabilities.includes(capability)) {
      throw new MCPError(MCPErrorCode.CapabilityNotSupported, `Server ${serverId} does not support ${capability}`, {
        capability,
        availableCapabilities: state.capabilities,
      });
    }
  }

  // Resource Operations

  /**
   * Get a specific resource from the server
   */
  async getResource(serverId: string, request: ResourceRequest): Promise<ResourceResponse> {
    this.verifyCapability(serverId, 'resources');
    return this.sendRequest(serverId, 'getResource', request);
  }

  /**
   * List available resources of a specific type
   */
  async listResources(serverId: string, type?: string): Promise<ResourceResponse[]> {
    this.verifyCapability(serverId, 'resources');
    return this.sendRequest(serverId, 'listResources', { type });
  }

  /**
   * Watch a resource for changes
   */
  async watchResource(serverId: string, request: ResourceRequest): Promise<EventEmitter> {
    this.verifyCapability(serverId, 'resources');

    const state = this.servers.get(serverId)!;
    const emitter = new EventEmitter();

    // Store the watcher
    if (!state.resourceWatchers) {
      state.resourceWatchers = new Map();
    }
    state.resourceWatchers.set(request.resourceId, emitter);

    // Start watching
    await this.sendRequest(serverId, 'watchResource', request);

    return emitter;
  }

  /**
   * Stop watching a resource
   */
  async unwatchResource(serverId: string, resourceId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state?.resourceWatchers) return;

    const emitter = state.resourceWatchers.get(resourceId);
    if (emitter) {
      emitter.removeAllListeners();
      state.resourceWatchers.delete(resourceId);
      await this.sendRequest(serverId, 'unwatchResource', { resourceId });
    }
  }

  // Tool Operations

  /**
   * List available tools
   */
  async listTools(serverId: string): Promise<ToolInfo[]> {
    this.verifyCapability(serverId, 'tools');
    return this.sendRequest(serverId, 'listTools', {});
  }

  /**
   * Execute a tool with security validation
   */
  async executeTool(serverId: string, request: ToolRequest): Promise<any> {
    this.verifyCapability(serverId, 'tools');

    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    // Validate tool execution permission
    state.security.validateToolExecution(request);

    // Sanitize request parameters
    const sanitizedRequest = state.security.sanitizeToolRequest(request);

    return this.sendRequest(serverId, 'executeTool', sanitizedRequest);
  }

  /**
   * Cancel a running tool execution
   */
  async cancelTool(serverId: string, toolId: string): Promise<void> {
    this.verifyCapability(serverId, 'tools');
    await this.sendRequest(serverId, 'cancelTool', { toolId });
  }

  // Sampling Operations

  /**
   * Request a sample from the server
   */
  async requestSample(serverId: string, request: SampleRequest): Promise<SampleResponse> {
    this.verifyCapability(serverId, 'sampling');
    return this.sendRequest(serverId, 'requestSample', request);
  }

  /**
   * Provide a sample result back to the server
   */
  async provideSample(serverId: string, sampleId: string, result: any): Promise<void> {
    this.verifyCapability(serverId, 'sampling');
    await this.sendRequest(serverId, 'provideSample', { sampleId, result });
  }

  /**
   * Cancel a pending sample request
   */
  async cancelSample(serverId: string, sampleId: string): Promise<void> {
    this.verifyCapability(serverId, 'sampling');
    await this.sendRequest(serverId, 'cancelSample', { sampleId });
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
