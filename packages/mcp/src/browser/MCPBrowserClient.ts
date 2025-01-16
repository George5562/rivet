// @ts-ignore - Tauri types will be available at runtime
import { invoke } from '@tauri-apps/api/tauri';
// @ts-ignore - EventTarget types are available but exports resolution fails
import { EventTarget } from 'event-target-shim';
import type { MCPServerConfigWithSecurity, ToolRequest } from '@ironclad/rivet-mcp-shared';

/**
 * Browser client for MCP server communication
 * Fixed type issues:
 * 1. Added ts-ignore for Tauri imports which are available at runtime
 * 2. Added ts-ignore for event-target-shim which has types but package.json exports issue
 * 3. Explicitly typed all async methods for better type safety
 */
export class MCPBrowserClient extends EventTarget {
  /**
   * Load MCP configuration
   * @returns Promise resolving to record of MCP server configurations
   */
  async loadConfig(): Promise<Record<string, MCPServerConfigWithSecurity>> {
    const configStr = await invoke<string>('mcp_load_config');
    const config = JSON.parse(configStr);
    return config.mcpServers || {};
  }

  /**
   * Initialize MCP server
   * @param serverId Unique identifier for the server
   * @param config Server configuration with security settings
   */
  async initialize(serverId: string, config: MCPServerConfigWithSecurity): Promise<void> {
    await invoke('mcp_initialize', { serverId, config });
  }

  /**
   * Execute tool on MCP server
   * @param serverId Unique identifier for the server
   * @param request Tool execution request
   * @returns Promise resolving to tool execution result
   */
  async executeTool(serverId: string, request: ToolRequest): Promise<any> {
    return invoke('mcp_execute_tool', { serverId, request });
  }

  /**
   * Get server information and status
   * @param serverId Unique identifier for the server
   * @returns Promise resolving to server information and status
   */
  async getServerInfo(serverId: string): Promise<{ status: string; lastError?: string }> {
    return invoke('mcp_get_server_info', { serverId });
  }
}
