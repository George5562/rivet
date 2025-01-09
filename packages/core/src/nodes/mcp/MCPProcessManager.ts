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
} from './types.js';

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
}

/**
 * Manages MCP server processes and implements the Model Context Protocol lifecycle
 */
export class MCPProcessManager {
  private readonly servers: Map<string, ServerState> = new Map();

  /**
   * Initialize a connection to an MCP server
   * Following protocol_construction.connection_lifecycle.initialization
   */
  async initialize(serverId: string, config: MCPServerConfig): Promise<void> {
    try {
      // 1. Start the server process
      const serverProcess = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Store initial state
      this.servers.set(serverId, {
        process: serverProcess,
        capabilities: [],
        status: 'initializing',
        requestId: 1,
        pendingRequests: new Map(),
        resourceWatchers: new Map(),
      });

      // Set up message handling
      this.setupMessageHandling(serverId, serverProcess);

      // 2. Protocol handshake
      const initResponse = await this.sendRequest(serverId, 'initialize', {
        capabilities: {
          resources: true,
          tools: true,
          sampling: true,
        },
        version: '1.0.0',
      });

      // 3. Store server capabilities
      const state = this.servers.get(serverId)!;
      if (initResponse.capabilities) {
        state.capabilities = Object.keys(initResponse.capabilities).filter((key) => initResponse.capabilities[key]);
      }

      // 4. Send initialized notification
      await this.sendNotification(serverId, 'initialized', {});

      // Update server state
      state.status = 'connected';
    } catch (err) {
      // Handle initialization errors
      const state = this.servers.get(serverId);
      if (state) {
        state.status = 'error';
        state.process.kill();
        this.servers.delete(serverId);
      }
      throw new Error(`Failed to initialize MCP server ${serverId}: ${err}`);
    }
  }

  /**
   * Terminate a server connection following protocol_construction.connection_lifecycle.termination
   */
  async shutdown(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) return;

    try {
      // 1. Send shutdown request
      await this.sendRequest(serverId, 'shutdown', {});

      // 2. Cleanup resources
      await this.cleanupResources(serverId);

      // 3. Send exit notification
      await this.sendNotification(serverId, 'exit', {});

      // 4. Kill process and remove state
      state.process.kill();
      this.servers.delete(serverId);
    } catch (err) {
      // Force cleanup on error
      state.process.kill();
      this.servers.delete(serverId);
      throw new Error(`Error during MCP server shutdown: ${err}`);
    }
  }

  /**
   * Check if a server is healthy and connected
   */
  async checkServerHealth(serverId: string): Promise<boolean> {
    const state = this.servers.get(serverId);
    if (!state) return false;
    return state.status === 'connected' && !state.process.killed;
  }

  /**
   * Get server capabilities and status
   */
  getServerInfo(serverId: string) {
    const state = this.servers.get(serverId);
    if (!state) throw new Error(`Server ${serverId} not found`);

    return {
      capabilities: state.capabilities,
      status: state.status,
    };
  }

  // Private helper methods for protocol communication

  /**
   * Set up message handling for a server process
   */
  private setupMessageHandling(serverId: string, serverProcess: ChildProcess): void {
    serverProcess.stdout!.on('data', (data: Buffer) => {
      try {
        const messages = data.toString().trim().split('\n');
        for (const message of messages) {
          if (!message) continue;

          const parsed = JSON.parse(message);

          // Handle notifications (like resource watch events)
          if (!parsed.id) {
            this.handleNotification(serverId, parsed as JsonRpcNotification);
            continue;
          }

          // Handle regular responses
          const response = parsed as JsonRpcResponse;
          const state = this.servers.get(serverId);
          if (!state) return;

          const pending = state.pendingRequests.get(response.id as number);
          if (pending) {
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
            state.pendingRequests.delete(response.id as number);
          }
        }
      } catch (err) {
        console.error(`Error handling MCP server message: ${err}`);
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
      this.servers.delete(serverId);
    });
  }

  /**
   * Send a JSON-RPC request to a server
   */
  private async sendRequest(serverId: string, method: string, params: any): Promise<any> {
    const state = this.servers.get(serverId);
    if (!state) throw new Error(`Server ${serverId} not found`);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: state.requestId++,
    };

    return new Promise((resolve, reject) => {
      state.pendingRequests.set(request.id as number, { resolve, reject });
      state.process.stdin!.write(JSON.stringify(request) + '\n');
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

    // Reject pending requests
    for (const [id, { reject }] of state.pendingRequests) {
      reject(new Error('Server shutting down'));
      state.pendingRequests.delete(id);
    }
  }

  /**
   * Verify a server supports a specific capability
   */
  private verifyCapability(serverId: string, capability: string): void {
    const state = this.servers.get(serverId);
    if (!state) throw new Error(`Server ${serverId} not found`);
    if (!state.capabilities.includes(capability)) {
      throw new Error(`Server ${serverId} does not support ${capability}`);
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
   * Execute a tool
   */
  async executeTool(serverId: string, request: ToolRequest): Promise<any> {
    this.verifyCapability(serverId, 'tools');
    return this.sendRequest(serverId, 'executeTool', request);
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
}
