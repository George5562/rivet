import { spawn, type ChildProcess } from 'child_process';
import { SecurityManager, MCPError, MCPErrorCode, ToolCache } from '@ironclad/rivet-mcp-shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  MCPServerConfig,
  MCPServerConfigWithSecurity,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ToolRequest,
  SecuritySettings,
  ToolMetadata,
  MCPRequest,
  MCPResponse,
  APIOptions,
} from '@ironclad/rivet-mcp-shared';
import type { ServerState } from './types.js';

/**
 * Manages MCP server processes and implements the Model Context Protocol lifecycle
 */
export class MCPProcessManager {
  private readonly servers: Map<string, ServerState> = new Map();
  private static configCache: { data: Record<string, MCPServerConfigWithSecurity>; timestamp: number } | null = null;
  private static readonly CACHE_TTL = 5000; // 5 seconds TTL for cache
  private static readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private static readonly MAX_RESTART_ATTEMPTS = 3;
  private readonly healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly restartAttempts: Map<string, number> = new Map();
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private static readonly DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    backoffMs: 1000,
  };

  /**
   * Load MCP configuration from config.json
   */
  async loadConfig(): Promise<Record<string, MCPServerConfigWithSecurity>> {
    try {
      // Check cache first
      if (
        MCPProcessManager.configCache &&
        Date.now() - MCPProcessManager.configCache.timestamp < MCPProcessManager.CACHE_TTL
      ) {
        return MCPProcessManager.configCache.data;
      }

      // Load from config.json
      const configPath = join(__dirname, '../../config.json');
      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Validate all server configurations
      const validatedConfig: Record<string, MCPServerConfigWithSecurity> = {};

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        throw new MCPError(MCPErrorCode.ValidationError, 'Invalid MCP configuration: mcpServers must be an object');
      }

      for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
        if (this.validateServerConfig(serverConfig)) {
          validatedConfig[serverId] = serverConfig as MCPServerConfigWithSecurity;
        }
      }

      // Update cache
      MCPProcessManager.configCache = {
        data: validatedConfig,
        timestamp: Date.now(),
      };

      return validatedConfig;
    } catch (err) {
      throw new MCPError(
        MCPErrorCode.ValidationError,
        `Failed to load MCP configuration: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate complete server configuration including tools
   */
  private validateServerConfig(config: unknown): config is MCPServerConfigWithSecurity {
    if (!config || typeof config !== 'object') return false;

    const serverConfig = config as Partial<MCPServerConfigWithSecurity>;

    // Validate required fields
    if (!serverConfig.id || typeof serverConfig.id !== 'string') return false;
    if (!serverConfig.name || typeof serverConfig.name !== 'string') return false;
    if (!serverConfig.command || typeof serverConfig.command !== 'string') return false;

    // Validate optional fields
    if (serverConfig.args && !Array.isArray(serverConfig.args)) return false;
    if (serverConfig.env && typeof serverConfig.env !== 'object') return false;

    // Validate tools if present
    if (serverConfig.tools) {
      if (typeof serverConfig.tools !== 'object') return false;

      for (const tool of Object.values(serverConfig.tools)) {
        if (!this.validateToolConfig(tool)) return false;
      }
    }

    return true;
  }

  /**
   * Validate tool configuration
   */
  private validateToolConfig(config: unknown): boolean {
    if (!config || typeof config !== 'object') return false;

    const toolConfig = config as { name?: unknown; description?: unknown; inputs?: unknown; outputs?: unknown };

    // Validate required fields
    if (!toolConfig.name || typeof toolConfig.name !== 'string') return false;
    if (!toolConfig.description || typeof toolConfig.description !== 'string') return false;

    // Validate parameter schemas
    if (toolConfig.inputs && !this.validateParameterSchema(toolConfig.inputs)) return false;
    if (toolConfig.outputs && !this.validateParameterSchema(toolConfig.outputs)) return false;

    return true;
  }

  /**
   * Validate parameter schema
   */
  private validateParameterSchema(schema: unknown): boolean {
    if (!schema || typeof schema !== 'object') return false;

    for (const param of Object.values(schema)) {
      if (!param || typeof param !== 'object') return false;

      const paramDef = param as { type?: unknown; description?: unknown; required?: unknown };

      if (!paramDef.type || typeof paramDef.type !== 'string') return false;
      if (!['string', 'number', 'boolean', 'object', 'array'].includes(paramDef.type)) return false;

      if (paramDef.description && typeof paramDef.description !== 'string') return false;
      if (paramDef.required !== undefined && typeof paramDef.required !== 'boolean') return false;
    }

    return true;
  }

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

        // Discover tools after successful initialization
        await this.discoverTools(serverId);
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

  /**
   * Start an MCP server if not already running
   */
  async startServer(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    if (state.status === 'connected') {
      return; // Already running
    }

    const config = (await this.loadConfig())[serverId];
    if (!config) {
      throw new MCPError(MCPErrorCode.ValidationError, `Configuration not found for server ${serverId}`);
    }

    await this.initialize(serverId, config);
    this.setupHealthCheck(serverId);
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    try {
      // Send shutdown notification
      await this.sendNotification(serverId, 'shutdown', {});
    } catch (err) {
      console.warn(`Error sending shutdown notification to ${serverId}:`, err);
    }

    // Cleanup and stop health check
    this.cleanupServer(serverId);
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): { status: string; lastError?: string } {
    const state = this.servers.get(serverId);
    if (!state) {
      return { status: 'not_found' };
    }

    return {
      status: state.status,
      lastError: state.lastError,
    };
  }

  /**
   * Setup health check for a server
   */
  private setupHealthCheck(serverId: string): void {
    // Clear existing health check if any
    this.clearHealthCheck(serverId);

    // Setup new health check interval
    const interval = setInterval(async () => {
      try {
        await this.checkServerHealth(serverId);
      } catch (err) {
        console.error(`Health check failed for ${serverId}:`, err);
        await this.handleHealthCheckFailure(serverId);
      }
    }, MCPProcessManager.HEALTH_CHECK_INTERVAL);

    this.healthCheckIntervals.set(serverId, interval);
  }

  /**
   * Check server health
   */
  private async checkServerHealth(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state || state.status !== 'connected') {
      throw new MCPError(MCPErrorCode.ConnectionError, 'Server not connected');
    }

    try {
      // Send ping request
      await this.sendRequest(serverId, 'ping', {});
      // Reset restart attempts on successful health check
      this.restartAttempts.set(serverId, 0);
    } catch (err) {
      throw new MCPError(MCPErrorCode.ConnectionError, 'Health check failed', { originalError: err });
    }
  }

  /**
   * Handle health check failure
   */
  private async handleHealthCheckFailure(serverId: string): Promise<void> {
    const attempts = (this.restartAttempts.get(serverId) || 0) + 1;
    this.restartAttempts.set(serverId, attempts);

    if (attempts <= MCPProcessManager.MAX_RESTART_ATTEMPTS) {
      console.log(`Attempting to restart server ${serverId} (attempt ${attempts})`);
      try {
        await this.restartServer(serverId);
      } catch (err) {
        console.error(`Failed to restart server ${serverId}:`, err);
      }
    } else {
      console.error(`Max restart attempts reached for server ${serverId}`);
      this.cleanupServer(serverId);
    }
  }

  /**
   * Restart a server
   */
  private async restartServer(serverId: string): Promise<void> {
    await this.stopServer(serverId);
    await this.startServer(serverId);
  }

  /**
   * Clean up server resources and stop health check
   */
  private cleanupServer(serverId: string): void {
    // Clear health check interval
    this.clearHealthCheck(serverId);

    const state = this.servers.get(serverId);
    if (state) {
      // Kill process
      state.process.kill();
      // Clean up resources
      this.cleanupResources(serverId);
      // Remove server state
      this.servers.delete(serverId);
    }
  }

  /**
   * Clear health check interval
   */
  private clearHealthCheck(serverId: string): void {
    const interval = this.healthCheckIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serverId);
    }
  }

  /**
   * Discover tools from an MCP server
   */
  async discoverTools(serverId: string): Promise<Record<string, ToolMetadata>> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    // Check if server supports tools capability
    this.checkCapability(serverId, 'tools');

    try {
      // Try to get tools from cache first
      const toolCache = ToolCache.getInstance();
      const cachedTools = toolCache.getCachedTools(serverId);
      if (cachedTools) {
        return cachedTools;
      }

      // Query tools from server
      const response = await this.sendRequest(serverId, 'tool/list', {});

      // Validate response
      if (!response || typeof response !== 'object') {
        throw new MCPError(MCPErrorCode.InvalidResponse, 'Invalid tool list response', { response });
      }

      // Validate and process tool metadata
      const tools: Record<string, ToolMetadata> = {};
      for (const [toolId, metadata] of Object.entries(response)) {
        if (this.validateToolMetadata(metadata)) {
          tools[toolId] = metadata as ToolMetadata;
        } else {
          console.warn(`Invalid tool metadata for ${toolId}, skipping`);
        }
      }

      // Cache the discovered tools
      toolCache.cacheTools(serverId, tools);

      return tools;
    } catch (err) {
      throw new MCPError(
        MCPErrorCode.ToolDiscoveryError,
        `Failed to discover tools: ${err instanceof Error ? err.message : 'Unknown error'}`,
        { originalError: err },
      );
    }
  }

  /**
   * Validate tool metadata from server
   */
  private validateToolMetadata(metadata: unknown): boolean {
    if (!metadata || typeof metadata !== 'object') return false;

    const toolMeta = metadata as Partial<ToolMetadata>;

    // Validate required fields
    if (!toolMeta.name || typeof toolMeta.name !== 'string') return false;
    if (!toolMeta.description || typeof toolMeta.description !== 'string') return false;

    // Validate inputs if present
    if (toolMeta.inputs && !this.validateParameterSchema(toolMeta.inputs)) return false;

    // Validate outputs if present
    if (toolMeta.outputs && !this.validateParameterSchema(toolMeta.outputs)) return false;

    return true;
  }

  /**
   * Get available tools for a server
   */
  async getAvailableTools(serverId: string): Promise<Record<string, ToolMetadata>> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    if (state.status !== 'connected') {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} is not connected`);
    }

    return this.discoverTools(serverId);
  }

  /**
   * Send a standardized API request to the server
   */
  private async sendStandardRequest<T>(
    serverId: string,
    request: MCPRequest,
    options: APIOptions = {},
  ): Promise<MCPResponse<T>> {
    const startTime = Date.now();
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    const timeout = options.timeout ?? MCPProcessManager.DEFAULT_TIMEOUT;
    const retryConfig = options.retryConfig ?? MCPProcessManager.DEFAULT_RETRY_CONFIG;

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        // Send request with timeout
        const response = await Promise.race([
          this.sendRequest(serverId, request.method, request.params),
          new Promise((_, reject) =>
            setTimeout(() => reject(new MCPError(MCPErrorCode.Timeout, 'Request timed out')), timeout),
          ),
        ]);

        // Validate response if validator provided
        if (options.validateResponse && !options.validateResponse(response)) {
          throw new MCPError(MCPErrorCode.InvalidResponse, 'Response validation failed', { response });
        }

        // Format successful response
        return {
          success: true,
          data: response as T,
          metadata: {
            duration: Date.now() - startTime,
            timestamp: Date.now(),
          },
        };
      } catch (err) {
        lastError = err as Error;
        if (attempt < retryConfig.maxAttempts) {
          // Wait before retry with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, retryConfig.backoffMs * Math.pow(2, attempt - 1)));
          continue;
        }
      }
    }

    // Format error response
    return {
      success: false,
      error: {
        code: lastError instanceof MCPError ? lastError.code : MCPErrorCode.InternalError,
        message: lastError?.message || 'Unknown error',
        details: lastError instanceof MCPError ? lastError.data : undefined,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Execute a tool with standardized request/response
   */
  async executeToolStandard(serverId: string, request: ToolRequest, options: APIOptions = {}): Promise<MCPResponse> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new MCPError(MCPErrorCode.ConnectionError, `Server ${serverId} not found`);
    }

    // Validate tool execution permission
    state.security.validateToolExecution(request);

    // Sanitize request parameters
    const sanitizedRequest = state.security.sanitizeToolRequest(request);

    // Send standardized request
    return this.sendStandardRequest(
      serverId,
      {
        method: 'tool/execute',
        params: sanitizedRequest,
        timeout: options.timeout,
        retryConfig: options.retryConfig,
      },
      {
        ...options,
        validateResponse: (response) => {
          // Add tool-specific response validation
          return response !== null && typeof response === 'object';
        },
      },
    );
  }

  /**
   * Get server information with standardized request/response
   */
  async getServerInfo(serverId: string, options: APIOptions = {}): Promise<MCPResponse> {
    return this.sendStandardRequest(
      serverId,
      {
        method: 'server/info',
        params: {},
        timeout: options.timeout,
        retryConfig: options.retryConfig,
      },
      options,
    );
  }

  /**
   * Get tool information with standardized request/response
   */
  async getToolInfo(serverId: string, toolId: string, options: APIOptions = {}): Promise<MCPResponse<ToolMetadata>> {
    return this.sendStandardRequest(
      serverId,
      {
        method: 'tool/info',
        params: { toolId },
        timeout: options.timeout,
        retryConfig: options.retryConfig,
      },
      {
        ...options,
        validateResponse: (response) => this.validateToolMetadata(response),
      },
    );
  }
}
