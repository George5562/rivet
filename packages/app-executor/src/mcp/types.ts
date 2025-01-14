import type { ChildProcess } from 'child_process';
import type { EventEmitter } from 'events';
import type {
  MCPServerConfig,
  MCPServerConfigWithSecurity,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ResourceRequest,
  ResourceResponse,
  ToolRequest,
  SampleRequest,
  SampleResponse,
  SecuritySettings,
  SecurityManager,
} from '@ironclad/rivet-mcp-shared';

/**
 * Server state for process management
 */
export interface ServerState {
  /** Server process */
  process: ChildProcess;
  /** Supported capabilities */
  capabilities: string[];
  /** Server status */
  status: 'initializing' | 'connected' | 'error';
  /** Request counter */
  requestId: number;
  /** Pending request callbacks */
  pendingRequests: Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >;
  /** Resource watchers */
  resourceWatchers: Map<string, EventEmitter>;
  /** Security manager */
  security: SecurityManager;
}

export type {
  MCPServerConfig,
  MCPServerConfigWithSecurity,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ResourceRequest,
  ResourceResponse,
  ToolRequest,
  SampleRequest,
  SampleResponse,
  SecuritySettings,
};
