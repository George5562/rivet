/**
 * MCP error codes following JSON-RPC 2.0 spec
 */
export enum MCPErrorCode {
  // JSON-RPC 2.0 reserved error codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // Custom error codes
  ValidationError = -32000,
  InstallationError = -32001,
  ExecutionError = -32002,
  NetworkError = -32003,
  ResourceError = -32004,
  CacheError = -32005,

  // Additional error codes
  ConnectionError = -32010,
  InvalidResponse = -32011,
  ToolExecutionError = -32012,
  CapabilityNotSupported = -32013,
  SecurityError = -32014,
  ResourceAccessDenied = -32015,
  ToolNotFound = -32016,
}

/**
 * Custom error class for MCP-related errors
 */
export class MCPError extends Error {
  constructor(
    public readonly code: MCPErrorCode,
    message: string,
    public readonly metadata?: Record<string, unknown>,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}
