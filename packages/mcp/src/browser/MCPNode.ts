import {
  type ChartNode,
  type NodeId,
  type NodeInputDefinition,
  type NodeOutputDefinition,
  type PortId,
  type NodeConnection,
  NodeImpl,
  type NodeUIData,
  type Inputs,
  type Outputs,
  type Project,
  type InternalProcessContext,
  type DataType,
  type DataValue,
  coerceType,
} from '@ironclad/rivet-core';

import { MCPError, MCPErrorCode } from '@ironclad/rivet-mcp-shared';
import type {
  MCPServerConfig,
  SecuritySettings,
  ToolRequest,
  MCPServerConfigWithSecurity,
  MCPToolDefinition,
  MCPParameterType,
} from '@ironclad/rivet-mcp-shared';
import { nanoid } from 'nanoid/non-secure';
// @ts-ignore - Tauri types will be available at runtime
import { invoke } from '@tauri-apps/api/tauri';
import { MCPBrowserClient } from './MCPBrowserClient.js';
import { ResourceManager } from './ResourceManager.js';

export type MCPChartNode = ChartNode<'mcp', MCPNodeData>;

/**
 * MCP Node data structure
 * Updated to support:
 * - Dynamic tool selection
 * - Configuration management
 * - Security settings
 */
interface MCPNodeData {
  // MCP Selection
  selectedMcpId: string;
  selectedToolId: string;

  // Server Configuration
  serverConfig: MCPServerConfigWithSecurity;
  useServerConfigInput?: boolean;

  // Tool Parameters
  toolParams: string; // JSON string for tool parameters
  useToolParamsInput?: boolean;

  // Security Settings
  requireToolPermission: boolean;

  // Error Handling
  errorOnConnectionFailure: boolean;

  mcpServer?: string;
  toolName?: string;
}

interface ServerInfo {
  installed: boolean;
  status: string;
  lastError?: string;
}

interface MCPOutputs extends Outputs {
  output?: DataValue;
  error?: DataValue;
  metadata?: DataValue;
}

/**
 * MCP Node implementation
 * Supports:
 * - Dynamic port generation
 * - Type-safe configuration
 * - Tool execution with phases
 */
export class MCPNode extends NodeImpl<MCPChartNode> {
  private readonly client: MCPBrowserClient;
  private readonly serverId: string;
  private readonly mcpConfig: MCPServerConfigWithSecurity | null = null;
  private readonly toolDefinition: MCPToolDefinition | null = null;
  private readonly resourceManager: ResourceManager;

  constructor(chartNode: MCPChartNode) {
    super(chartNode);
    this.client = new MCPBrowserClient();
    this.serverId = `mcp-${chartNode.id}`;
    this.resourceManager = new ResourceManager();
    this.setupResourceHandling();
  }

  static create(): MCPChartNode {
    return {
      type: 'mcp',
      id: nanoid() as NodeId,
      title: 'MCP Server',
      visualData: { x: 0, y: 0 },
      data: {
        selectedMcpId: '',
        selectedToolId: '',
        serverConfig: {
          id: 'default',
          name: 'Default Server',
          description: 'Default MCP server configuration',
          command: '',
          args: [],
          env: {},
          security: {
            permissions: {},
            requireToolPermission: false,
            isToolExecutionPermitted: true,
          },
        },
        toolParams: '{}',
        requireToolPermission: false,
        errorOnConnectionFailure: true,
      },
    };
  }

  /**
   * Initialize node
   */
  async initialize(): Promise<void> {
    const security: SecuritySettings = {
      permissions: {}, // Required field
      requireToolPermission: false,
      isToolExecutionPermitted: true,
    };

    await this.client.initialize(this.serverId, {
      ...this.chartNode.data.serverConfig,
      security,
    });
  }

  /**
   * Get input definitions with enhanced type validation and optional handling
   */
  getInputDefinitions(): NodeInputDefinition[] {
    const inputs: NodeInputDefinition[] = [];

    // Add server config input if enabled
    if (this.data.useServerConfigInput) {
      inputs.push({
        id: 'config' as PortId,
        title: 'Server Config',
        dataType: 'object',
        description: 'MCP server configuration object',
        required: true,
      });
    }

    // Add dynamic inputs based on selected tool
    if (this.toolDefinition?.inputs) {
      if (this.data.useToolParamsInput) {
        // Single params input when using bulk mode
        inputs.push({
          id: 'params' as PortId,
          title: 'Tool Parameters',
          dataType: 'object',
          description: 'Parameters for the selected tool',
          required: true,
        });
      } else {
        // Individual parameter inputs with enhanced type handling
        for (const [paramName, paramDef] of Object.entries(this.toolDefinition.inputs)) {
          const dataType = this.mapToolTypeToRivetType(
            paramDef.type as MCPParameterType,
            paramDef.items?.type as MCPParameterType,
          );

          // Enhanced port metadata
          const portMetadata = {
            isArray: paramDef.type === 'array',
            itemType: paramDef.items?.type,
          };

          inputs.push({
            id: paramName as PortId,
            title: this.formatPortTitle(paramName, paramDef),
            dataType,
            description: this.formatPortDescription(paramDef),
            required: paramDef.required || false,
            data: portMetadata,
          });
        }
      }
    }

    return inputs;
  }

  /**
   * Get output definitions with enhanced metadata
   */
  getOutputDefinitions(): NodeOutputDefinition[] {
    const outputs: NodeOutputDefinition[] = [];

    // Add dynamic outputs based on selected tool
    if (this.toolDefinition?.outputs) {
      for (const [outputName, outputDef] of Object.entries(this.toolDefinition.outputs)) {
        const dataType = this.mapToolTypeToRivetType(
          outputDef.type as MCPParameterType,
          outputDef.items?.type as MCPParameterType,
        );

        // Enhanced output metadata
        const portMetadata = {
          isArray: outputDef.type === 'array',
          itemType: outputDef.items?.type,
        };

        outputs.push({
          id: outputName as PortId,
          title: this.formatPortTitle(outputName, outputDef),
          dataType,
          description: this.formatPortDescription(outputDef),
          data: portMetadata,
        });
      }
    }

    // Add status outputs with metadata
    outputs.push(
      {
        id: 'state' as PortId,
        title: 'Status',
        dataType: 'string',
        description: 'Execution status (success/error)',
        data: { isStatus: true },
      },
      {
        id: 'info' as PortId,
        title: 'Info',
        dataType: 'object',
        description: 'Execution details and timing information',
        data: { isMetadata: true },
      },
    );

    return outputs;
  }

  /**
   * Map MCP tool types to Rivet data types with enhanced array support
   */
  private mapToolTypeToRivetType(toolType: MCPParameterType, itemType?: MCPParameterType): DataType {
    // Handle array types with improved validation
    if (toolType === 'array' && itemType) {
      const arrayType = `${itemType}[]` as DataType;
      if (this.isValidScalarType(arrayType)) {
        return arrayType;
      }
      // Support nested arrays and complex types
      if (itemType === 'array') {
        return 'any[]' as DataType;
      }
      return 'object[]' as DataType;
    }

    // Map scalar types with validation
    if (this.isValidScalarType(toolType)) {
      return toolType as DataType;
    }

    // Default to 'any' for unknown types
    return 'any' as DataType;
  }

  /**
   * Validate if a type is a valid Rivet scalar type with array support
   */
  private isValidScalarType(type: string): type is DataType {
    const validTypes = [
      'string',
      'number',
      'boolean',
      'object',
      'any',
      'string[]',
      'number[]',
      'boolean[]',
      'object[]',
      'any[]',
    ] as const;
    return validTypes.includes(type as any);
  }

  /**
   * Handles installation of an MCP server if not already installed.
   * Uses npx to install the server package and updates the server status.
   */
  private async ensureServerInstalled(
    context: InternalProcessContext,
    serverId: string,
    config: MCPServerConfigWithSecurity,
  ): Promise<void> {
    if (!context.mcpClient) {
      throw new MCPError(MCPErrorCode.ConnectionError, 'MCP client not available');
    }

    // Check if server needs installation
    const serverInfo = (await context.mcpClient.getServerInfo(serverId)) as ServerInfo;
    if (!serverInfo.installed) {
      // Execute npx installation command
      const installCommand = {
        command: config.command,
        args: config.args,
        env: config.env,
      };

      await context.mcpClient.initialize(serverId, config);

      // Verify installation was successful
      const updatedInfo = (await context.mcpClient.getServerInfo(serverId)) as ServerInfo;
      if (!updatedInfo.installed) {
        throw new MCPError(MCPErrorCode.ConnectionError, 'Failed to install MCP server', {
          serverId,
          lastError: updatedInfo.lastError,
        });
      }
    }
  }

  /**
   * Process node with phases and validation
   */
  async process(inputs: Inputs, context: InternalProcessContext): Promise<MCPOutputs> {
    const startTime = Date.now();
    let phase = 'initialization';

    try {
      // Validate server and tool selection
      if (!this.data.mcpServer) {
        throw new MCPError(MCPErrorCode.ValidationError, 'No MCP server selected');
      }

      if (!this.data.toolName) {
        throw new MCPError(MCPErrorCode.ValidationError, 'No tool selected');
      }

      if (!context.mcpClient) {
        throw new MCPError(MCPErrorCode.ConnectionError, 'MCP client not available');
      }

      // Load and validate server config
      phase = 'server-config';
      const configs = await context.mcpClient.loadConfig();
      const serverConfig = configs[this.data.mcpServer];
      if (!serverConfig) {
        throw new MCPError(MCPErrorCode.ValidationError, `Invalid MCP server: ${this.data.mcpServer}`);
      }

      // Ensure server is installed
      phase = 'installation';
      await this.ensureServerInstalled(context, this.data.mcpServer, serverConfig);

      // Prepare tool arguments
      phase = 'preparation';
      const toolArgs: Record<string, unknown> = {};
      for (const [name, input] of Object.entries(inputs)) {
        if (input?.type) {
          toolArgs[name] = input.value;
        }
      }

      // Execute tool
      phase = 'execution';
      const toolRequest = {
        toolId: this.data.toolName,
        params: toolArgs,
      };

      const result = await context.mcpClient.executeTool(this.data.mcpServer, toolRequest);

      // Return result with metadata
      const outputs: MCPOutputs = {};
      outputs.output = {
        type: 'any',
        value: result,
      };
      outputs.metadata = {
        type: 'object',
        value: {
          executionTime: Date.now() - startTime,
          phase,
        },
      };
      return outputs;
    } catch (err: unknown) {
      // Return error with metadata
      const outputs: MCPOutputs = {};
      outputs.error = {
        type: 'string',
        value: err instanceof Error ? err.message : String(err),
      };
      outputs.metadata = {
        type: 'object',
        value: {
          executionTime: Date.now() - startTime,
          phase,
          error: err instanceof MCPError ? err.code : MCPErrorCode.InternalError,
        },
      };
      return outputs;
    }
  }

  /**
   * Get node UI data
   */
  static getUIData(): NodeUIData {
    return {
      contextMenuTitle: 'MCP Server',
      infoBoxTitle: 'MCP Server Node',
      infoBoxBody: 'Connects to an MCP-compliant server to execute operations',
      group: ['Integrations'],
    };
  }

  /**
   * Clean up node resources
   */
  async cleanup(): Promise<void> {
    const resources = this.resourceManager.getTrackedResources();
    for (const resource of resources) {
      const result = await this.resourceManager.cleanupResource(resource.id);
      if (!result.success) {
        console.error(`Failed to clean up resource ${resource.id}:`, result.error);
      }
    }
  }

  /**
   * Format port title with type information
   */
  private formatPortTitle(name: string, def: any): string {
    const required = def.required ? ' (required)' : ' (optional)';
    const type = def.type === 'array' ? `${def.items?.type || 'any'}[]` : def.type;
    return `${name}${required} [${type}]`;
  }

  /**
   * Format port description with constraints
   */
  private formatPortDescription(def: any): string {
    return def.description || '';
  }

  private setupResourceHandling(): void {
    this.resourceManager.onResourceEvent('resource:cleaned', (resourceId: string) => {
      console.log(`Resource ${resourceId} cleaned up successfully`);
    });
  }

  private async trackServerResource(serverId: string): Promise<void> {
    this.resourceManager.trackResource({
      id: serverId,
      type: 'server',
      cleanupFn: async () => {
        // Server cleanup is handled by app-executor
        await invoke('mcp_cleanup_server', { serverId });
      },
    });
  }

  private async trackToolResource(serverId: string, toolId: string): Promise<void> {
    this.resourceManager.trackResource({
      id: `${serverId}:${toolId}`,
      type: 'tool',
      dependencies: [serverId],
      cleanupFn: async () => {
        // Tool cleanup is handled by app-executor
        await invoke('mcp_cancel_tool', { serverId, toolId });
      },
    });
  }
}

function generateToolId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
