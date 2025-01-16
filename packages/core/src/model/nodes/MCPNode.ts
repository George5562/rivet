import { nanoid } from 'nanoid/non-secure';
import { NodeImpl, type NodeUIData } from '../NodeImpl.js';
import { nodeDefinition } from '../NodeDefinition.js';
import {
  type ChartNode,
  type NodeId,
  type NodeInputDefinition,
  type NodeOutputDefinition,
  type PortId,
} from '../NodeBase.js';
import { type Inputs, type Outputs } from '../GraphProcessor.js';
import { type EditorDefinition, type InternalProcessContext } from '../../index.js';
import { coerceType, dedent } from '../../utils/index.js';
import { getError } from '../../utils/errors.js';
import {
  MCPError,
  MCPErrorCode,
  mapSchemaTypeToRivet,
  validateInputSchema,
  type ToolMetadata,
  type ExtendedToolMetadata,
  type ToolCache,
  ToolCacheImpl,
  type MCPOutputs,
  type ToolResponse,
  ErrorHandler,
  createError,
} from '@ironclad/rivet-mcp-shared';
import { type DataType } from '../DataValue.js';

/**
 * Node for making calls to MCP servers and their tools.
 * Implements dynamic port generation based on tool metadata.
 * Integrates with MCPProcessManager for infrastructure monitoring.
 */
export type MCPNode = ChartNode<'mcp', MCPNodeData>;

/**
 * Data structure for the MCP node.
 * Stores selected server, tool, and tool metadata for port generation.
 */
export type MCPNodeData = {
  /** Selected MCP server from config.json */
  mcpServer: string;

  /** Selected tool from the server's tool list */
  toolName: string;

  /**
   * Cached tool metadata used for port generation.
   * Retrieved from tools/list endpoint and stored here
   * to avoid repeated server queries.
   */
  toolMetadata?: {
    description: string;
    inputSchema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };

  /** Last known server status */
  serverStatus?: {
    status: 'initializing' | 'connected' | 'error';
    lastError?: string;
  };
};

/**
 * Validates tool metadata structure
 */
function validateToolMetadata(metadata: unknown): void {
  if (!metadata || typeof metadata !== 'object') {
    throw new MCPError(MCPErrorCode.ValidationError, 'Invalid tool metadata structure');
  }

  const toolMeta = metadata as Partial<ExtendedToolMetadata>;

  if (!toolMeta.name || typeof toolMeta.name !== 'string') {
    throw new MCPError(MCPErrorCode.ValidationError, 'Tool name is required and must be a string');
  }

  if (!toolMeta.description || typeof toolMeta.description !== 'string') {
    throw new MCPError(MCPErrorCode.ValidationError, 'Tool description is required and must be a string');
  }

  if (!toolMeta.inputSchema) {
    throw new MCPError(MCPErrorCode.ValidationError, 'Tool input schema is required');
  }

  validateInputSchema(toolMeta.inputSchema);
}

/**
 * Validates tool execution response
 */
function validateToolResponse(response: unknown): void {
  if (!response || typeof response !== 'object') {
    throw new MCPError(MCPErrorCode.InvalidResponse, 'Invalid tool response structure');
  }

  const toolResponse = response as {
    content?: unknown[];
    isError?: boolean;
    _meta?: Record<string, unknown>;
  };

  if (!Array.isArray(toolResponse.content)) {
    throw new MCPError(MCPErrorCode.InvalidResponse, 'Tool response must include content array');
  }

  // Validate each content item
  toolResponse.content.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new MCPError(MCPErrorCode.InvalidResponse, `Invalid content item at index ${index}`, { index });
    }

    const contentItem = item as { type?: string; text?: string; data?: string; mimeType?: string };

    if (!contentItem.type) {
      throw new MCPError(MCPErrorCode.InvalidResponse, `Missing content type at index ${index}`, { index });
    }

    switch (contentItem.type) {
      case 'text':
        if (typeof contentItem.text !== 'string') {
          throw new MCPError(MCPErrorCode.InvalidResponse, `Invalid text content at index ${index}`, { index });
        }
        break;
      case 'image':
        if (!contentItem.data || !contentItem.mimeType) {
          throw new MCPError(MCPErrorCode.InvalidResponse, `Invalid image content at index ${index}`, { index });
        }
        break;
      default:
        throw new MCPError(
          MCPErrorCode.InvalidResponse,
          `Unsupported content type "${contentItem.type}" at index ${index}`,
          { index, type: contentItem.type },
        );
    }
  });
}

/**
 * Implementation of the MCP node.
 * Handles:
 * - Two-stage dropdown for server and tool selection
 * - Dynamic port generation based on tool metadata
 * - Tool execution via MCP protocol
 * - Infrastructure monitoring and error recovery
 */
export class MCPNodeImpl extends NodeImpl<MCPNode> {
  private readonly errorHandler = new ErrorHandler();

  static create(): MCPNode {
    const chartNode: MCPNode = {
      type: 'mcp',
      title: 'MCP Call',
      id: nanoid() as NodeId,
      visualData: {
        x: 0,
        y: 0,
        width: 250,
      },
      data: {
        mcpServer: '',
        toolName: '',
      },
    };

    return chartNode;
  }

  /**
   * Generates input ports based on the selected tool's metadata.
   * Each property in the tool's inputSchema becomes a port.
   * Required parameters are marked in the port title.
   */
  getInputDefinitions(): NodeInputDefinition[] {
    const inputs: NodeInputDefinition[] = [];

    if (this.data.toolMetadata?.inputSchema) {
      const { properties, required = [] } = this.data.toolMetadata.inputSchema;

      Object.entries(properties).forEach(([name, schema]) => {
        inputs.push({
          dataType: mapSchemaTypeToRivet(schema),
          id: name as PortId,
          title: name + (required.includes(name) ? ' (required)' : ' (optional)'),
          description: (schema as any).description,
          required: required.includes(name),
        });
      });
    }

    return inputs;
  }

  /**
   * Defines the node's output ports:
   * - response: The tool's response content
   * - metadata: Additional info including error state
   */
  getOutputDefinitions(): NodeOutputDefinition[] {
    return [
      {
        dataType: 'string',
        id: 'response' as PortId,
        title: 'Response',
        description: 'The tool execution response content',
      },
      {
        dataType: 'object',
        id: 'metadata' as PortId,
        title: 'Metadata',
        description: 'Additional response data including error state',
      },
    ];
  }

  /**
   * Configures the node's editor UI with two dropdowns:
   * 1. MCP Server selection (from config.json)
   * 2. Tool selection (from tools/list endpoint)
   */
  getEditors(): EditorDefinition<MCPNode>[] {
    return [
      {
        type: 'dropdown',
        label: 'MCP Server',
        dataKey: 'mcpServer',
        options: this.getMCPServerOptions(),
        helperMessage: 'Select the MCP server to use',
      },
      {
        type: 'dropdown',
        label: 'Tool',
        dataKey: 'toolName',
        options: this.getToolOptions(),
        helperMessage: 'Select the tool to call',
      },
    ];
  }

  /**
   * Gets available MCP servers from config.json.
   * TODO: Implement actual config loading
   */
  private getMCPServerOptions() {
    return [
      { label: 'Memory Server', value: 'memory' },
      { label: 'File Server', value: 'file' },
    ];
  }

  /**
   * Gets available tools for the selected server.
   * Uses ToolCache to avoid repeated server queries.
   */
  private getToolOptions(): { value: string; label: string; description?: string }[] {
    try {
      if (!this.data.mcpServer) {
        return [];
      }

      const tools = ToolCacheImpl.getInstance().getCachedTools(this.data.mcpServer);
      if (!tools) {
        return [];
      }

      return tools.map((tool: ExtendedToolMetadata) => ({
        value: tool.name,
        label: tool.name,
        description: tool.description,
      }));
    } catch (err) {
      console.error('Error getting tools:', err);
      return [];
    }
  }

  /**
   * Generates the node's visual body text showing:
   * - Selected server and tool
   * - Tool description if available
   */
  getBody(): string {
    return dedent`
      ${this.data.mcpServer ? `Server: ${this.data.mcpServer}` : '(No server selected)'}
      ${this.data.toolName ? `Tool: ${this.data.toolName}` : '(No tool selected)'}
      ${this.data.toolMetadata?.description ? `\n${this.data.toolMetadata.description}` : ''}
    `;
  }

  static getUIData(): NodeUIData {
    return {
      infoBoxBody: dedent`
        Makes a call to an MCP server using the selected tool.
        The tool's inputs and outputs are dynamically configured based on its metadata.
      `,
      infoBoxTitle: 'MCP Call Node',
      contextMenuTitle: 'MCP Call',
      group: ['Integration'],
    };
  }

  /**
   * Executes the selected tool on the MCP server.
   */
  async process(inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
    const startTime = Date.now();
    let phase = 'initialization';
    let lastError: Error | null = null;

    try {
      // Validate server and tool selection
      if (!this.data.mcpServer) {
        throw createError(MCPErrorCode.ValidationError, 'No MCP server selected');
      }

      if (!this.data.toolName) {
        throw createError(MCPErrorCode.ValidationError, 'No tool selected');
      }

      if (!context.mcpClient) {
        throw createError(MCPErrorCode.ConnectionError, 'MCP client not available');
      }

      // Load and validate server config
      phase = 'server-config';
      const config = await context.mcpClient.loadConfig();
      const serverConfig = config[this.data.mcpServer];
      if (!serverConfig) {
        throw createError(MCPErrorCode.ValidationError, `Server "${this.data.mcpServer}" not found in config`, {
          serverId: this.data.mcpServer,
        });
      }

      // Check server health and status
      phase = 'health-check';
      const serverStatus = await context.mcpClient.getServerInfo(this.data.mcpServer);
      this.data.serverStatus = {
        status: serverStatus.status as 'initializing' | 'connected' | 'error',
        lastError: serverStatus.lastError,
      };

      if (this.data.serverStatus.status === 'error') {
        throw createError(
          MCPErrorCode.ConnectionError,
          `Server is in error state: ${this.data.serverStatus.lastError}`,
        );
      }

      // Initialize server with retry and capability check
      phase = 'server-init';
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          await context.mcpClient.initialize(this.data.mcpServer, serverConfig);
          break;
        } catch (err) {
          lastError = err as Error;
          retryCount++;

          if (!this.errorHandler.shouldRetry(err, retryCount)) {
            throw err;
          }

          const delay = this.errorHandler.getRetryDelay(err, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Validate and prepare arguments
      phase = 'argument-preparation';
      const toolArgs: Record<string, unknown> = {};
      const schema = this.data.toolMetadata?.inputSchema;

      if (!schema) {
        throw createError(MCPErrorCode.ValidationError, 'Tool metadata not available');
      }

      validateInputSchema(schema);

      Object.entries(schema.properties).forEach(([name, propSchema]) => {
        const input = inputs[name as PortId];
        if (input) {
          try {
            toolArgs[name] = coerceType(input, mapSchemaTypeToRivet(propSchema));
          } catch (err: unknown) {
            throw createError(MCPErrorCode.ValidationError, `Invalid type for parameter "${name}"`, {
              parameter: name,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (schema.required?.includes(name)) {
          throw createError(MCPErrorCode.ValidationError, `Missing required parameter "${name}"`, { parameter: name });
        }
      });

      // Execute tool with retry
      phase = 'tool-execution';
      retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          const response = (await context.mcpClient.executeTool(this.data.mcpServer, {
            toolId: this.data.toolName,
            params: toolArgs,
          })) as ToolResponse;

          if (!response) {
            throw createError(MCPErrorCode.InvalidResponse, 'No response from MCP server');
          }

          validateToolResponse(response);

          return {
            ['response' as PortId]: {
              type: 'string',
              value: response.content[0]?.text ?? '',
            },
            ['metadata' as PortId]: {
              type: 'object',
              value: {
                executionTime: Date.now() - startTime,
                phase,
                retryCount,
                serverStatus: {
                  status: 'connected',
                },
                ...(response.isError && {
                  error: {
                    code: MCPErrorCode.ToolExecutionError,
                    message: this.errorHandler.formatErrorMessage(response),
                    data: response._meta,
                  },
                }),
              },
            },
          };
        } catch (err) {
          lastError = err as Error;
          retryCount++;

          if (!this.errorHandler.shouldRetry(err, retryCount)) {
            throw err;
          }

          const delay = this.errorHandler.getRetryDelay(err, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw createError(MCPErrorCode.ToolExecutionError, 'Tool execution failed after retries', {}, lastError);
    } catch (err: unknown) {
      const error =
        err instanceof MCPError
          ? err
          : createError(MCPErrorCode.InternalError, err instanceof Error ? err.message : 'Unknown error', {
              originalError: err,
            });

      // Update server status on error
      if (error.code === MCPErrorCode.ConnectionError || error.code === MCPErrorCode.InternalError) {
        this.data.serverStatus = {
          status: 'error',
          lastError: this.errorHandler.formatErrorMessage(error),
        };
      }

      return {
        ['response' as PortId]: {
          type: 'string',
          value: '',
        },
        ['metadata' as PortId]: {
          type: 'object',
          value: {
            executionTime: Date.now() - startTime,
            phase,
            error: {
              code: error.code,
              message: this.errorHandler.formatErrorMessage(error),
              data: error.data,
            },
            serverStatus: this.data.serverStatus,
            retryCount: 0,
          },
        },
      };
    }
  }
}

export const mcpNode = nodeDefinition(MCPNodeImpl, 'MCP Call');
