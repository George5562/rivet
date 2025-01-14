import {
  type ChartNode,
  type NodeId,
  type NodeInputDefinition,
  type NodeOutputDefinition,
  type PortId,
  type NodeConnection,
} from '@ironclad/rivet-core';
import { NodeImpl, type NodeUIData } from '@ironclad/rivet-core';
import type { Inputs, Outputs } from '@ironclad/rivet-core';
import type { Project } from '@ironclad/rivet-core';
import type { InternalProcessContext } from '@ironclad/rivet-core';
import { coerceType, dedent } from '@ironclad/rivet-core';
import type { MCPServerConfig, SecuritySettings, ToolRequest } from '@ironclad/rivet-mcp-shared';
import { nanoid } from 'nanoid/non-secure';
import { MCPBrowserClient } from './MCPBrowserClient.js';

export type MCPChartNode = ChartNode<'mcp', MCPNodeData>;

interface MCPNodeData {
  serverConfig: MCPServerConfig;
}

/**
 * MCP Node implementation
 */
export class MCPNode extends NodeImpl<MCPChartNode> {
  private readonly client: MCPBrowserClient;
  private readonly serverId: string;

  constructor(chartNode: MCPChartNode) {
    super(chartNode);
    this.client = new MCPBrowserClient();
    this.serverId = `mcp-${chartNode.id}`;
  }

  static create(): MCPChartNode {
    return {
      type: 'mcp',
      id: nanoid() as NodeId,
      title: 'MCP Server',
      visualData: { x: 0, y: 0 },
      data: {
        serverConfig: {
          command: '',
          args: [],
          env: {},
        },
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
   * Get input definitions
   */
  getInputDefinitions(
    _connections: NodeConnection[],
    _nodes: Record<NodeId, ChartNode>,
    _project: Project,
  ): NodeInputDefinition[] {
    return [
      {
        id: 'input' as PortId,
        title: 'Input',
        dataType: 'string',
      },
    ];
  }

  /**
   * Get output definitions
   */
  getOutputDefinitions(
    _connections: NodeConnection[],
    _nodes: Record<NodeId, ChartNode>,
    _project: Project,
  ): NodeOutputDefinition[] {
    return [
      {
        id: 'output' as PortId,
        title: 'Output',
        dataType: 'string',
      },
    ];
  }

  /**
   * Process node
   */
  async process(inputData: Inputs, _context: InternalProcessContext): Promise<Outputs> {
    const input = inputData['input' as PortId];
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    const toolRequest: ToolRequest = {
      toolId: 'process',
      params: { input },
    };

    const result = await this.client.executeTool(this.serverId, toolRequest);

    const outputs: Outputs = {};
    outputs['output' as PortId] = result;
    return outputs;
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
    // Cleanup will be handled by app-executor
  }
}
