import { type FC } from 'react';
import { type PortId, type MCPNode } from '@ironclad/rivet-core';
import { RenderDataValue } from '../RenderDataValue.js';
import { type NodeComponentDescriptor } from '../../hooks/useNodeTypes.js';
import { type InputsOrOutputsWithRefs, type DataValueWithRefs } from '../../state/dataFlow';

export const MCPNodeOutput: FC<{ outputs: InputsOrOutputsWithRefs; renderMarkdown?: boolean }> = ({ outputs }) => {
  const connectionStatus = outputs['state' as PortId];
  const toolOutput = outputs['output' as PortId];
  const capabilities = outputs['info' as PortId];

  return (
    <div>
      <div>
        <em>Status: </em>
        {connectionStatus && <RenderDataValue value={connectionStatus as DataValueWithRefs} />}
      </div>
      {capabilities && (
        <div>
          <em>Capabilities: </em>
          <RenderDataValue value={capabilities as DataValueWithRefs} />
        </div>
      )}
      {toolOutput && (
        <div>
          <em>Tool Output: </em>
          <RenderDataValue value={toolOutput as DataValueWithRefs} />
        </div>
      )}
    </div>
  );
};

export const MCPNodeBody: FC<{ node: MCPNode }> = ({ node }) => {
  return (
    <div>
      <div>{node.data.useServerConfigInput ? '(Config Using Input)' : 'Server Configured'}</div>
      <div>Tool: {node.data.useToolIdInput ? '(Using Input)' : node.data.toolId || 'Not Set'}</div>
      <div>{node.data.requireToolPermission ? 'Requires Permission' : 'No Permission Required'}</div>
    </div>
  );
};

export const mcpNodeDescriptor: NodeComponentDescriptor<'mcp'> = {
  Body: MCPNodeBody,
  OutputSimple: MCPNodeOutput,
};
