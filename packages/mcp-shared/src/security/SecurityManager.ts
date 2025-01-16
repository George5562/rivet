import type { SecuritySettings, ToolRequest } from '../types.js';

/**
 * Error codes for MCP operations following JSON-RPC 2.0 spec with protocol-specific extensions
 */
export enum MCPErrorCode {
  // JSON-RPC 2.0 reserved codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // MCP Protocol specific codes
  ValidationError = -33000,
  SecurityError = -33001,
  ResourceLimitExceeded = -33002,
  ResourceAccessDenied = -33003,
  ToolExecutionError = -33004,
  ToolNotFound = -33005,
  ToolNotSupported = -33006,
  CapabilityNotSupported = -33007,
  ConnectionError = -33008,
  ToolDiscoveryError = -33009,
  ToolMetadataError = -33010,
  TimeoutError = -33011,

  // Cache errors (-33020 to -33029)
  CacheError = -33020,
  CacheInitError = -33021,
  CacheWriteError = -33022,
  CacheReadError = -33023,
  CacheInvalidationError = -33024,
}

/**
 * Custom error class for MCP operations
 */
export class MCPError extends Error {
  code: MCPErrorCode;
  data?: any;

  constructor(code: MCPErrorCode, message: string, data?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;
  }

  toJsonRpcError() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

/**
 * Manages security for MCP operations
 */
export class SecurityManager {
  private settings: SecuritySettings;

  constructor(settings?: Partial<SecuritySettings>) {
    this.settings = {
      permissions: {
        fs: false,
        network: false,
        process: false,
        env: [],
      },
      requireToolPermission: true,
      isToolExecutionPermitted: false,
      ...settings,
    };
  }

  /**
   * Update security settings
   */
  updateSettings(settings: Partial<SecuritySettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
    };
  }

  /**
   * Validate tool execution permission
   */
  validateToolExecution(toolRequest: ToolRequest): void {
    if (this.settings.requireToolPermission && !this.settings.isToolExecutionPermitted) {
      throw new MCPError(MCPErrorCode.SecurityError, 'Tool execution requires permission', {
        toolId: toolRequest.toolId,
        requiresPermission: true,
        currentPermission: false,
      });
    }
  }

  /**
   * Sanitize tool request parameters
   */
  sanitizeToolRequest(request: ToolRequest): ToolRequest {
    // Basic parameter sanitization
    const sanitizedParams = { ...request.params };

    // Remove any potentially sensitive fields
    delete sanitizedParams.apiKey;
    delete sanitizedParams.credentials;
    delete sanitizedParams.token;
    delete sanitizedParams.password;

    return {
      ...request,
      params: sanitizedParams,
    };
  }

  /**
   * Get current security settings
   */
  getSettings(): SecuritySettings {
    return { ...this.settings };
  }
}
