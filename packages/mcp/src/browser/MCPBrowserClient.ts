import { invoke } from '@tauri-apps/api/tauri';
import { EventTarget } from 'event-target-shim';
import type { MCPServerConfigWithSecurity, ToolRequest } from '@ironclad/rivet-mcp-shared';

/**
 * Browser client for MCP server communication
 */
export class MCPBrowserClient extends EventTarget {
  /**
   * Initialize MCP server
   */
  async initialize(serverId: string, config: MCPServerConfigWithSecurity): Promise<void> {
    await invoke('mcp_initialize', { serverId, config });
  }

  /**
   * Execute tool on MCP server
   */
  async executeTool(serverId: string, request: ToolRequest): Promise<any> {
    return invoke('mcp_execute_tool', { serverId, request });
  }
}
