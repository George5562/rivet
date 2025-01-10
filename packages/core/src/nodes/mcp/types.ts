/**
 * Configuration for an MCP server instance
 */
export interface MCPServerConfig {
  /** Command to start the server (e.g. 'npx') */
  command: string;

  /** Command arguments (e.g. ['-y', '@modelcontextprotocol/server-brave-search']) */
  args: string[];

  /** Environment variables for the server process */
  env?: Record<string, string>;
}

/**
 * JSON-RPC 2.0 request message
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: number | string;
}

/**
 * JSON-RPC 2.0 response message
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

/**
 * JSON-RPC 2.0 notification message
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * Server capabilities response
 */
export interface ServerCapabilities {
  resources?: boolean;
  tools?: boolean;
  sampling?: boolean;
  version: string;
}

/**
 * Resource request parameters
 */
export interface ResourceRequest {
  /** Unique identifier for the resource */
  resourceId: string;
  /** Type of resource being requested */
  type: string;
  /** Optional parameters for the resource request */
  options?: Record<string, any>;
}

/**
 * Resource response data
 */
export interface ResourceResponse {
  /** Resource metadata */
  metadata: {
    id: string;
    type: string;
    version?: string;
  };
  /** Resource content */
  content: any;
}

/**
 * Tool request parameters
 */
export interface ToolRequest {
  /** Unique identifier for the tool */
  toolId: string;
  /** Parameters for tool execution */
  params: Record<string, any>;
}

/**
 * Tool description
 */
export interface ToolInfo {
  /** Tool identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Tool description */
  description: string;
  /** Required parameters */
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
}

/**
 * Sampling request parameters
 */
export interface SampleRequest {
  /** The prompt to sample from */
  prompt: string;
  /** Optional sampling parameters */
  options?: {
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Sampling temperature */
    temperature?: number;
    /** Top-p sampling */
    topP?: number;
    /** Number of samples to generate */
    n?: number;
  };
}

/**
 * Sampling response data
 */
export interface SampleResponse {
  /** Unique identifier for this sample */
  id: string;
  /** Generated text */
  text: string;
  /** Sampling metadata */
  metadata?: {
    /** Number of tokens generated */
    tokenCount?: number;
    /** Model used for sampling */
    model?: string;
    /** Time taken to generate */
    generationTime?: number;
  };
}

/**
 * Resource watch event
 */
export interface ResourceWatchEvent {
  /** Type of event */
  type: 'created' | 'updated' | 'deleted';
  /** Resource data */
  resource: ResourceResponse;
}

/**
 * MCP Error codes following JSON-RPC 2.0 spec with protocol-specific extensions
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
  ResourceNotFound = -33002,
  ResourceAccessDenied = -33003,
  ToolNotFound = -33004,
  ToolExecutionError = -33005,
  SamplingError = -33006,
  CapabilityNotSupported = -33007,
  ConnectionError = -33008,
}

/**
 * MCP Protocol error with additional context
 */
export class MCPError extends Error {
  constructor(
    public readonly code: MCPErrorCode,
    message: string,
    public readonly data?: any,
  ) {
    super(message);
    this.name = 'MCPError';
  }

  /**
   * Convert to JSON-RPC error object
   */
  toJsonRpcError(): JsonRpcResponse['error'] {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

/**
 * Security settings for MCP operations
 */
export interface SecuritySettings {
  /** Whether tool execution requires explicit permission */
  requireToolPermission: boolean;

  /** Whether the current tool execution is permitted */
  isToolExecutionPermitted: boolean;
}

/**
 * Extended server configuration with security settings
 */
export interface MCPServerConfigWithSecurity extends MCPServerConfig {
  /** Security settings for the server */
  security?: SecuritySettings;
}
