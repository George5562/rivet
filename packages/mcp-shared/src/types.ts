/**
 * MCP shared type definitions
 */

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Command to start the server */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * MCP server configuration with security settings
 */
export interface MCPServerConfigWithSecurity extends MCPServerConfig {
  /** Security settings */
  security?: SecuritySettings;
}

/**
 * Security settings for MCP server
 */
export interface SecuritySettings {
  /** Required permissions */
  permissions: {
    /** File system access */
    fs?: boolean;
    /** Network access */
    network?: boolean;
    /** Process execution */
    process?: boolean;
    /** Environment variables */
    env?: string[];
  };
  /** Resource limits */
  limits?: {
    /** Maximum memory usage in MB */
    memory?: number;
    /** Maximum CPU usage percentage */
    cpu?: number;
    /** Maximum number of concurrent connections */
    connections?: number;
  };
  /** Whether tool execution requires permission */
  requireToolPermission: boolean;
  /** Whether tool execution is permitted */
  isToolExecutionPermitted: boolean;
}

/**
 * JSON-RPC request message
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: any;
}

/**
 * JSON-RPC response message
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * JSON-RPC notification message
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params: any;
}

/**
 * Resource request parameters
 */
export interface ResourceRequest {
  /** Resource ID */
  id: string;
  /** Resource type */
  type: string;
  /** Resource parameters */
  params?: Record<string, unknown>;
}

/**
 * Resource response data
 */
export interface ResourceResponse {
  /** Resource ID */
  id: string;
  /** Resource type */
  type: string;
  /** Resource data */
  data: unknown;
  /** Resource metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Resource watch event data
 */
export interface ResourceWatchEvent {
  /** Resource ID */
  id: string;
  /** Event type */
  type: 'update' | 'delete';
  /** Resource data */
  data?: unknown;
}

/**
 * Tool request parameters
 */
export interface ToolRequest {
  /** Tool ID */
  toolId: string;
  /** Tool parameters */
  params?: Record<string, unknown>;
}

/**
 * Tool information
 */
export interface ToolInfo {
  /** Tool ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** Tool parameters schema */
  parameters?: Record<string, unknown>;
}

/**
 * Sample request parameters
 */
export interface SampleRequest {
  /** Sample ID */
  id: string;
  /** Sample type */
  type: string;
  /** Sample parameters */
  params?: Record<string, unknown>;
}

/**
 * Sample response data
 */
export interface SampleResponse {
  /** Sample ID */
  id: string;
  /** Sample type */
  type: string;
  /** Sample data */
  data: unknown;
}
