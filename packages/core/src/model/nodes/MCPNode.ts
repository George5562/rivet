import {
  type ChartNode,
  type NodeId,
  type NodeInputDefinition,
  type NodeOutputDefinition,
  type PortId,
} from '../NodeBase.js';
import { nanoid } from 'nanoid/non-secure';
import { NodeImpl, type NodeUIData } from '../NodeImpl.js';
import { nodeDefinition } from '../NodeDefinition.js';
import { type Inputs, type Outputs } from '../GraphProcessor.js';
import { type EditorDefinition } from '../EditorDefinition.js';
import { type InternalProcessContext } from '../../index.js';
import { coerceType, dedent } from '../../utils/index.js';
import { MCPProcessManager } from '../../nodes/mcp/MCPProcessManager.js';
import { type MCPServerConfigWithSecurity, type ToolRequest } from '../../nodes/mcp/types.js';

export type MCPNode = ChartNode<'mcp', MCPNodeData>;

type MCPNodeDataKeys =
  | 'serverConfig'
  | 'useServerConfigInput'
  | 'toolId'
  | 'useToolIdInput'
  | 'toolParams'
  | 'useToolParamsInput'
  | 'requireToolPermission'
  | 'errorOnConnectionFailure';

export type MCPNodeData = {
  // Server Configuration
  serverConfig: string; // JSON string for server configuration
  useServerConfigInput?: boolean;

  // Tool Configuration
  toolId: string;
  useToolIdInput?: boolean;

  toolParams: string; // JSON string for tool parameters
  useToolParamsInput?: boolean;

  // Security Settings
  requireToolPermission: boolean;

  // Error Handling
  errorOnConnectionFailure: boolean;
};

export class MCPNodeImpl extends NodeImpl<MCPNode> {
  private readonly processManager: MCPProcessManager;
  private readonly serverId: string;

  constructor(node: MCPNode) {
    super(node);
    this.processManager = new MCPProcessManager();
    this.serverId = `mcp-${node.id}`;
  }

  static create(): MCPNode {
    return {
      type: 'mcp',
      title: 'MCP',
      id: nanoid() as NodeId,
      visualData: {
        x: 0,
        y: 0,
        width: 250,
      },
      data: {
        serverConfig: JSON.stringify(
          {
            command: 'npx',
            args: [],
            env: {},
          },
          null,
          2,
        ),
        toolId: '',
        toolParams: '{}',
        requireToolPermission: true,
        errorOnConnectionFailure: true,
      },
    };
  }

  getInputDefinitions(): NodeInputDefinition[] {
    const inputs: NodeInputDefinition[] = [];

    if (this.data.useServerConfigInput) {
      inputs.push({
        dataType: 'object',
        id: 'config' as PortId,
        title: 'Server Config',
      });
    }

    if (this.data.useToolIdInput) {
      inputs.push({
        dataType: 'string',
        id: 'tool' as PortId,
        title: 'Tool ID',
      });
    }

    if (this.data.useToolParamsInput) {
      inputs.push({
        dataType: 'object',
        id: 'params' as PortId,
        title: 'Tool Parameters',
      });
    }

    return inputs;
  }

  getOutputDefinitions(): NodeOutputDefinition[] {
    return [
      {
        dataType: 'object',
        id: 'output' as PortId,
        title: 'Result',
      },
      {
        dataType: 'string',
        id: 'state' as PortId,
        title: 'Status',
      },
      {
        dataType: 'object',
        id: 'info' as PortId,
        title: 'Capabilities',
      },
    ];
  }

  getEditors(): EditorDefinition<MCPNode>[] {
    const editors: EditorDefinition<MCPNode>[] = [
      {
        type: 'code',
        label: 'Server Configuration',
        dataKey: 'serverConfig',
        useInputToggleDataKey: 'useServerConfigInput',
        language: 'json',
        helperMessage: 'JSON object with command, args, and optional env',
      },
      {
        type: 'string',
        label: 'Tool ID',
        dataKey: 'toolId',
        useInputToggleDataKey: 'useToolIdInput',
      },
      {
        type: 'code',
        label: 'Tool Parameters',
        dataKey: 'toolParams',
        useInputToggleDataKey: 'useToolParamsInput',
        language: 'json',
      },
      {
        type: 'toggle',
        label: 'Require Tool Permission',
        dataKey: 'requireToolPermission',
      },
      {
        type: 'toggle',
        label: 'Error on Connection Failure',
        dataKey: 'errorOnConnectionFailure',
      },
    ];

    return editors;
  }

  getBody(): string {
    return dedent`
      ${this.data.useServerConfigInput ? '(Config Using Input)' : 'Server Configured'}
      Tool: ${this.data.useToolIdInput ? '(Using Input)' : this.data.toolId || 'Not Set'}
      ${this.data.requireToolPermission ? 'Requires Permission' : 'No Permission Required'}
    `;
  }

  static getUIData(): NodeUIData {
    return {
      infoBoxBody: dedent`
        Connects to and executes tools on Model Context Protocol (MCP) servers.
        Supports server configuration, tool execution, and permission management.
      `,
      infoBoxTitle: 'MCP Node',
      contextMenuTitle: 'MCP',
      group: ['AI', 'Integration'],
    };
  }

  async process(inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
    try {
      // Get server configuration
      const serverConfig: MCPServerConfigWithSecurity = this.data.useServerConfigInput
        ? {
            command: '',
            args: [],
            ...JSON.parse(coerceType(inputs['config' as PortId], 'string')),
          }
        : {
            ...JSON.parse(this.data.serverConfig),
            security: {
              requireToolPermission: this.data.requireToolPermission,
              isToolExecutionPermitted: !this.data.requireToolPermission,
            },
          };

      // Initialize server if not already running
      await this.processManager.initialize(this.serverId, serverConfig);

      // Get tool configuration
      const toolId = this.data.useToolIdInput ? coerceType(inputs['tool' as PortId], 'string') : this.data.toolId;

      let toolParams: Record<string, any> = {};

      if (this.data.useToolParamsInput) {
        toolParams = coerceType(inputs['params' as PortId], 'object');
      } else if (this.data.toolParams) {
        toolParams = JSON.parse(this.data.toolParams);
      }

      // Execute tool
      const toolRequest: ToolRequest = {
        toolId,
        params: toolParams,
      };

      const result = await this.processManager.executeTool(this.serverId, toolRequest);

      // Get server capabilities
      const settings = this.processManager.getSecuritySettings(this.serverId);

      const outputs: Outputs = {};
      outputs['output' as PortId] = {
        type: 'object',
        value: result,
      };
      outputs['state' as PortId] = {
        type: 'string',
        value: 'success',
      };
      outputs['info' as PortId] = {
        type: 'object',
        value: {
          requiresPermission: settings.requireToolPermission,
          isPermitted: settings.isToolExecutionPermitted,
        },
      };

      return outputs;
    } catch (err) {
      if (!this.data.errorOnConnectionFailure) {
        const outputs: Outputs = {};
        outputs['state' as PortId] = {
          type: 'string',
          value: 'error',
        };
        outputs['output' as PortId] = {
          type: 'object',
          value: {} as Record<string, unknown>,
        };
        outputs['info' as PortId] = {
          type: 'object',
          value: {},
        };
        return outputs;
      }
      throw err;
    }
  }
}

export const mcpNode = nodeDefinition(MCPNodeImpl, 'MCP');
