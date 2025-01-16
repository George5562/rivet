/**
 * MCP shared type definitions
 */

/**
 * Parameter type for tool inputs/outputs
 */
export type MCPParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * Parameter definition for tool inputs
 */
export interface MCPParameterDefinition {
  /** Parameter type */
  type: MCPParameterType;
  /** Parameter description */
  description: string;
  /** Whether the parameter is required */
  required?: boolean;
  /** Maximum value for number parameters */
  max?: number;
  /** Minimum value for number parameters */
  min?: number;
  /** For array/object types, defines the structure */
  items?: {
    type: MCPParameterType;
    properties?: Record<string, string>;
  };
}

/**
 * Tool definition
 */
export interface MCPToolDefinition {
  /** Display name for the tool */
  name: string;
  /** Tool description */
  description: string;
  /** Input parameter definitions */
  inputs: Record<string, MCPParameterDefinition>;
  /** Output definitions */
  outputs: Record<string, MCPParameterDefinition>;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Server description */
  description: string;
  /** Command to start the server */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Available tools */
  tools?: Record<string, MCPToolDefinition>;
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

// API Request/Response types
export interface MCPRequest {
  method: string;
  params: Record<string, any>;
  timeout?: number;
  retryConfig?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    details?: any;
  };
  metadata?: {
    duration: number;
    timestamp: number;
  };
}

export interface APIOptions {
  timeout?: number;
  retryConfig?: {
    maxAttempts: number;
    backoffMs: number;
  };
  validateResponse?: (response: any) => boolean;
}

/**
 * Tool metadata type
 */
export interface ToolMetadata {
  name: string;
  description: string;
  inputs?: Record<
    string,
    {
      type: string;
      description: string;
      required: boolean;
      [key: string]: any;
    }
  >;
  outputs?: Record<
    string,
    {
      type: string;
      description: string;
      [key: string]: any;
    }
  >;
}

/**
 * Extended tool metadata with additional fields
 */
export interface ExtendedToolMetadata extends ToolMetadata {
  version?: string;
  author?: string;
  license?: string;
  tags?: string[];
  category?: string;
  examples?: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    description: string;
  }[];
  inputSchema?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool cache implementation
 */
export class ToolCacheImpl implements ToolCache {
  private readonly cache = new Map<string, { value: unknown; expiry?: number }>();
  private static instance: ToolCacheImpl;

  static getInstance(): ToolCacheImpl {
    if (!ToolCacheImpl.instance) {
      ToolCacheImpl.instance = new ToolCacheImpl();
    }
    return ToolCacheImpl.instance;
  }

  async get(key: string): Promise<unknown | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiry: ttl ? Date.now() + ttl : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getCachedTools(server: string): ExtendedToolMetadata[] | undefined {
    const key = `tools:${server}`;
    const tools = this.cache.get(key);
    if (!tools) return undefined;
    if (tools.expiry && tools.expiry < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return tools.value as ExtendedToolMetadata[];
  }
}

/**
 * Tool cache interface
 */
export interface ToolCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getCachedTools(server: string): ExtendedToolMetadata[] | undefined;
}
