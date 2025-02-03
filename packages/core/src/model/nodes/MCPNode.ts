import {
  type ChartNode,
  type NodeId,
  type NodeInputDefinition,
  type PortId,
  type NodeOutputDefinition,
} from '../NodeBase.js';
import { nanoid } from 'nanoid/non-secure';
import { NodeImpl, type NodeUIData } from '../NodeImpl.js';
import { nodeDefinition } from '../NodeDefinition.js';
import { type DataValue } from '../DataValue.js';
import {
  type EditorDefinition,
  type Inputs,
  type NodeBody,
  type Outputs,
  type InternalProcessContext,
} from '../../index.js';
import { dedent } from 'ts-dedent';
import { coerceType } from '../../utils/coerceType.js';

// Define the node type and data structure
export type MCPNode = ChartNode<'mcp', MCPNodeData>;

export interface MCPNodeData {
  /** The endpoint URL for the MCP server */
  endpoint: string;

  /** Whether to use input for endpoint */
  useEndpointInput: boolean;

  /** Headers to send with requests */
  headers: { key: string; value: string }[];

  /** Whether to use input for headers */
  useHeadersInput: boolean;

  /** Implementation-specific configuration */
  configuration: { [key: string]: unknown };
}

// Implement the node
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
        endpoint: 'http://localhost:8080',
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
      inputs.push({
        dataType: 'string',
        id: 'endpoint' as PortId,
        title: 'Endpoint',
        description: 'The endpoint URL for the MCP server',
      });
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

  getEditors(): EditorDefinition<MCPNode>[] {
    return [
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
    ];
  }

  getBody(): string | undefined {
    return this.data.useEndpointInput ? '(Using Input)' : this.data.endpoint;
  }

  async process(inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
    try {
      // Get endpoint from input or data
      const endpoint = this.data.useEndpointInput
        ? coerceType(inputs['endpoint' as PortId], 'string')
        : this.data.endpoint;

      // Get headers from input or data
      const headers = this.data.useHeadersInput
        ? (inputs['headers' as PortId] as { type: 'object'; value: Record<string, string> })?.value ?? {}
        : Object.fromEntries(this.data.headers.map(({ key, value }) => [key, value]));

      // Get input
      const input = coerceType(inputs['input' as PortId], 'string');

      // Make request to MCP server
      const response = await fetch(endpoint, {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        ['output' as PortId]: {
          type: 'string',
          value: data.output ?? '',
        },
        ['metadata' as PortId]: {
          type: 'object',
          value: data.metadata ?? {},
        },
        ['error' as PortId]: {
          type: 'string',
          value: '',
        },
      };
    } catch (error) {
      return {
        ['output' as PortId]: {
          type: 'string',
          value: '',
        },
        ['metadata' as PortId]: {
          type: 'object',
          value: {},
        },
        ['error' as PortId]: {
          type: 'string',
          value: error instanceof Error ? error.message : 'Unknown error occurred',
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
}

// Export the node definition
export const mcpNode = nodeDefinition(MCPNodeImpl, 'MCP');
