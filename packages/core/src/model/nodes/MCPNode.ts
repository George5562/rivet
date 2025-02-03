import {
  type ChartNode,
  type NodeId,
  type NodeInputDefinition,
  type PortId,
  type NodeOutputDefinition,
} from '../NodeBase.js';
import { nanoid } from 'nanoid/non-secure';
import { NodeImpl, type NodeUIData, type PluginNodeImpl } from '../NodeImpl.js';
import { nodeDefinition } from '../NodeDefinition.js';
import { type DataValue } from '../DataValue.js';
import {
  type EditorDefinition,
  type Inputs,
  type NodeBody,
  type Outputs,
  type InternalProcessContext,
  type NativeApi,
} from '../../index.js';
import { dedent } from 'ts-dedent';
import { coerceType } from '../../utils/coerceType.js';
import type { RivetUIContext } from '../RivetUIContext.js';

// Define the node type and data structure
export type MCPNode = ChartNode<'mcp', MCPNodeData>;

// Communication mode for MCP
export type MCPCommunicationMode = 'http' | 'stdio';

// Base configuration for MCP servers
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  alwaysAllow?: string[];
}

// Add tool metadata types
export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface MCPServerInfo {
  tools: MCPToolDefinition[];
  metadata?: Record<string, unknown>;
}

export interface MCPNodeData {
  /** The communication mode for the MCP server */
  communicationMode: MCPCommunicationMode;

  /** The endpoint URL for HTTP mode */
  endpoint: string;

  /** The server ID for stdio mode (matches config file) */
  serverId?: string;

  /** Whether to use input for endpoint/server selection */
  useEndpointInput: boolean;

  /** Headers to send with requests (HTTP mode only) */
  headers: { key: string; value: string }[];

  /** Whether to use input for headers */
  useHeadersInput: boolean;

  /** Implementation-specific configuration */
  configuration: { [key: string]: unknown };

  /** Available tools for the current server */
  availableTools?: MCPToolDefinition[];
}

// MCP Config type
interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

// Add error types
export enum MCPErrorType {
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',
  SERVER_DISABLED = 'SERVER_DISABLED',
  SERVER_START_FAILED = 'SERVER_START_FAILED',
  SERVER_COMMUNICATION_FAILED = 'SERVER_COMMUNICATION_FAILED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  HTTP_ERROR = 'HTTP_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Add custom error class
export class MCPError extends Error {
  constructor(
    public type: MCPErrorType,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

async function loadMCPConfig(context: RivetUIContext): Promise<MCPConfig> {
  if (context.executor !== 'nodejs') {
    throw new MCPError(MCPErrorType.CONFIG_NOT_FOUND, 'MCP config loading is not supported in browser environment');
  }

  const nativeApi = context.nativeApi;
  if (!nativeApi) {
    throw new MCPError(MCPErrorType.CONFIG_NOT_FOUND, 'Native API not available');
  }

  try {
    const configContent = await nativeApi.readTextFile('mcp-config.json', 'appConfig');
    return JSON.parse(configContent);
  } catch (error) {
    throw new MCPError(
      MCPErrorType.CONFIG_NOT_FOUND,
      `Failed to load MCP config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

async function communicateWithStdioServer(
  serverId: string,
  input: unknown,
  configuration: unknown,
  signal: AbortSignal,
): Promise<{ output: string; metadata: Record<string, unknown> }> {
  // In browser context, we'll need to handle this differently
  throw new MCPError(
    MCPErrorType.SERVER_COMMUNICATION_FAILED,
    'STDIO communication is not supported in this environment',
  );
}

// Add tool discovery function
async function getServerTools(serverId: string): Promise<MCPServerInfo> {
  // In browser context, we'll need to handle this differently
  throw new Error('Tool discovery is not supported in this environment');
}

// Remove custom editor types
type MCPEditorDataKeys = keyof MCPNodeData;

// Update getEditors implementation
export class MCPNodeImpl extends NodeImpl<MCPNode> {
  static create(): MCPNode {
    const chartNode: MCPNode = {
      type: 'mcp',
      title: 'MCP',
      id: nanoid() as NodeId,
      visualData: {
        x: 0,
        y: 0,
        width: 250,
      },
      data: {
        communicationMode: 'http',
        endpoint: 'http://localhost:8080',
        serverId: '',
        useEndpointInput: false,
        headers: [],
        useHeadersInput: false,
        configuration: {},
      },
    };

    return chartNode;
  }

  getInputDefinitions(): NodeInputDefinition[] {
    const inputs: NodeInputDefinition[] = [];

    if (this.data.useEndpointInput) {
      if (this.data.communicationMode === 'http') {
        inputs.push({
          dataType: 'string',
          id: 'endpoint' as PortId,
          title: 'Endpoint',
          description: 'The endpoint URL for the MCP server',
        });
      } else {
        inputs.push({
          dataType: 'string',
          id: 'serverId' as PortId,
          title: 'Server ID',
          description: 'The MCP server ID from configuration',
        });
      }
    }

    if (this.data.useHeadersInput) {
      inputs.push({
        dataType: 'object',
        id: 'headers' as PortId,
        title: 'Headers',
        description: 'Headers to send with requests',
      });
    }

    inputs.push({
      dataType: 'string',
      id: 'input' as PortId,
      title: 'Input',
      description: 'The input to send to the MCP server',
      required: true,
    });

    return inputs;
  }

  getOutputDefinitions(): NodeOutputDefinition[] {
    return [
      {
        dataType: 'string',
        id: 'output' as PortId,
        title: 'Output',
        description: 'The response from the MCP server',
      },
      {
        dataType: 'object',
        id: 'metadata' as PortId,
        title: 'Metadata',
        description: 'Additional metadata from the MCP server response',
      },
      {
        dataType: 'string',
        id: 'error' as PortId,
        title: 'Error',
        description: 'Error message if the request fails',
      },
    ];
  }

  async getEditors(context: RivetUIContext): Promise<EditorDefinition<MCPNode>[]> {
    const editors: EditorDefinition<MCPNode>[] = [
      {
        type: 'dropdown',
        label: 'Communication Mode',
        dataKey: 'communicationMode',
        options: [
          { label: 'HTTP', value: 'http' },
          { label: 'STDIO', value: 'stdio' },
        ],
      },
    ];

    if (this.data.communicationMode === 'http') {
      editors.push(
        {
          type: 'string',
          label: 'Endpoint',
          dataKey: 'endpoint',
          useInputToggleDataKey: 'useEndpointInput',
          helperMessage: 'The endpoint URL for the MCP server',
        },
        {
          type: 'keyValuePair',
          label: 'Headers',
          dataKey: 'headers',
          useInputToggleDataKey: 'useHeadersInput',
          keyPlaceholder: 'Header',
          valuePlaceholder: 'Value',
          helperMessage: 'Headers to send with requests',
        },
      );
    } else {
      // Only try to load server IDs if we're in Node executor and have nativeApi
      let serverOptions: { label: string; value: string }[] = [];

      if (context.executor === 'nodejs' && context.nativeApi) {
        try {
          const config = await loadMCPConfig(context);
          serverOptions = Object.entries(config.mcpServers)
            .filter(([_, config]) => !config.disabled)
            .map(([id, _]) => ({
              label: id,
              value: id,
            }));
        } catch (error) {
          console.warn('Failed to load MCP server IDs:', error);
        }
      }

      editors.push({
        type: 'dropdown',
        label: 'Server ID',
        dataKey: 'serverId',
        useInputToggleDataKey: 'useEndpointInput',
        helperMessage: serverOptions.length
          ? 'Select an MCP server from configuration'
          : context.executor !== 'nodejs'
            ? 'STDIO mode requires Node Executor'
            : !context.nativeApi
              ? 'Native API not available'
              : 'No MCP servers found in config',
        options: serverOptions,
      });
    }

    return editors;
  }

  getBody(context: RivetUIContext): string | undefined {
    const base =
      this.data.communicationMode === 'http'
        ? this.data.useEndpointInput
          ? '(Using Input)'
          : this.data.endpoint
        : this.data.useEndpointInput
          ? '(Using Input)'
          : this.data.serverId;

    const parts = [base];

    if (this.data.communicationMode === 'stdio' && context.executor !== 'nodejs') {
      parts.push('(Requires Node Executor)');
    }

    if (this.data.availableTools?.length) {
      parts.push(`(${this.data.availableTools.length} tools)`);
    }

    return parts.join(' ');
  }

  async process(inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
    try {
      // Get input data
      const input = coerceType(inputs['input' as PortId], 'string');

      let response: { output: string; metadata: Record<string, unknown> };

      if (this.data.communicationMode === 'http') {
        // Get endpoint and headers for HTTP mode
        const endpoint = this.data.useEndpointInput
          ? coerceType(inputs['endpoint' as PortId], 'string')
          : this.data.endpoint;

        const headers = this.data.useHeadersInput
          ? (inputs['headers' as PortId] as { type: 'object'; value: Record<string, string> })?.value ?? {}
          : Object.fromEntries(this.data.headers.map(({ key, value }) => [key, value]));

        // Make HTTP request
        const httpResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            input,
            configuration: this.data.configuration,
          }),
        });

        if (!httpResponse.ok) {
          throw new Error(`HTTP error! status: ${httpResponse.status}`);
        }

        response = await httpResponse.json();
      } else {
        // Get server ID for stdio mode
        const serverId = this.data.useEndpointInput
          ? coerceType(inputs['serverId' as PortId], 'string')
          : this.data.serverId;

        if (!serverId) {
          throw new Error('No server ID provided for stdio communication');
        }

        // Check if we're in the Node executor
        if (context.executor !== 'nodejs') {
          throw new MCPError(
            MCPErrorType.SERVER_COMMUNICATION_FAILED,
            'STDIO communication requires the Node executor. Please switch to the Node executor in the top-right menu.',
          );
        }

        // Communicate with stdio server through Node executor
        response = await communicateWithStdioServer(serverId, input, this.data.configuration, context.signal);
      }

      // Add available tools to metadata
      const metadata: Record<string, unknown> = {
        ...((response.metadata as Record<string, unknown>) || {}),
        availableTools: this.data.availableTools,
      };

      return {
        ['output' as PortId]: {
          type: 'string',
          value: response.output ?? '',
        },
        ['metadata' as PortId]: {
          type: 'object',
          value: metadata,
        },
        ['error' as PortId]: {
          type: 'string',
          value: '',
        },
      };
    } catch (error) {
      const mcpError = error as MCPError;
      return {
        ['output' as PortId]: {
          type: 'string',
          value: '',
        },
        ['metadata' as PortId]: {
          type: 'object',
          value: {
            error: {
              type: mcpError.type || MCPErrorType.UNKNOWN_ERROR,
              details: mcpError.details,
            },
          },
        },
        ['error' as PortId]: {
          type: 'string',
          value: mcpError.message || 'Unknown error occurred',
        },
      };
    }
  }

  static getUIData(): NodeUIData {
    return {
      infoBoxBody: dedent`
        Connects to an MCP (Model Context Protocol) server to access external AI capabilities, tools, and resources.

        The node sends requests to the configured MCP server endpoint and returns the response.
      `,
      infoBoxTitle: 'MCP Node',
      contextMenuTitle: 'MCP',
      group: ['AI', 'Integration'],
    };
  }

  // Add method to update available tools
  async updateAvailableTools(): Promise<void> {
    if (this.data.communicationMode === 'stdio' && this.data.serverId) {
      try {
        const serverInfo = await getServerTools(this.data.serverId);
        this.data.availableTools = serverInfo.tools;
      } catch (error) {
        console.warn(`Failed to get available tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.data.availableTools = undefined;
      }
    } else {
      this.data.availableTools = undefined;
    }
  }
}

// Export the node definition
export const mcpNode = nodeDefinition(MCPNodeImpl, 'MCP');
