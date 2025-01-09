# MCP Node Development Plan

## 1. Development Environment Setup

### Node Executor Setup
1. Start core package watcher:
```bash
cd packages/core
yarn watch
```

2. Start app-executor in dev mode:
```bash
cd packages/app-executor
yarn dev
```

### Required Dependencies
- Add `@modelcontextprotocol/core` to package.json
- Add any specific MCP server packages needed (e.g. `@modelcontextprotocol/server-brave-search`)

## 2. File Structure

### Required Files
1. Main Node Implementation (`packages/core/src/nodes/MCPNode.ts`)
   ```typescript
   import { type ChartNode, type NodeId, type NodeInputDefinition, type NodeOutputDefinition, type PortId } from '../NodeBase.js';
   import { nanoid } from 'nanoid/non-secure';
   import { NodeImpl, type NodeUIData } from '../NodeImpl.js';
   import { nodeDefinition } from '../NodeDefinition.js';
   import { type Inputs, type Outputs } from '../GraphProcessor.js';
   import { type EditorDefinition, type InternalProcessContext } from '../../index.js';
   
   export type MCPNode = ChartNode<'mcp', MCPNodeData>;
   
   export type MCPNodeData = {
     serverConfig: {
       command: string;  // e.g. 'npx' or 'uvx'
       args: string[];   // e.g. ['-y', '@modelcontextprotocol/server-brave-search']
       env?: Record<string, string>;  // Environment variables like API keys
     };
     useServerConfigInput?: boolean;
     
     capabilities: string[];
     useCapabilitiesInput?: boolean;
     
     toolConfig: string;
     useToolConfigInput?: boolean;
     
     errorOnConnectionFailure?: boolean;
   };
   
   export class MCPNodeImpl extends NodeImpl<MCPNode> {
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
           serverConfig: {
             command: 'npx',
             args: [],
             env: {}
           },
           capabilities: [],
           toolConfig: '',
           errorOnConnectionFailure: true,
         },
       };
     }
   
     getInputDefinitions(): NodeInputDefinition[] {
       const inputs: NodeInputDefinition[] = [];
       
       if (this.data.useServerConfigInput) {
         inputs.push({
           dataType: 'object',
           id: 'serverConfig' as PortId,
           title: 'Server Config',
         });
       }
       
       // Add other dynamic inputs based on capabilities
       
       return inputs;
     }
   
     getOutputDefinitions(): NodeOutputDefinition[] {
       return [
         {
           dataType: 'object',
           id: 'response' as PortId,
           title: 'Response',
         },
         {
           dataType: 'object',
           id: 'capabilities' as PortId,
           title: 'Available Capabilities',
         },
         {
           dataType: 'string',
           id: 'connectionStatus' as PortId,
           title: 'Connection Status',
         },
       ];
     }
   
     getEditors(): EditorDefinition<MCPNode>[] {
       return [
         {
           type: 'code',
           label: 'Server Configuration',
           dataKey: 'serverConfig',
           useInputToggleDataKey: 'useServerConfigInput',
           language: 'json',
         },
         {
           type: 'code',
           label: 'Tool Configuration',
           dataKey: 'toolConfig',
           useInputToggleDataKey: 'useToolConfigInput',
           language: 'json',
         },
         {
           type: 'toggle',
           label: 'Error on Connection Failure',
           dataKey: 'errorOnConnectionFailure',
         },
       ];
     }
   
     getBody(): string {
       return `MCP ${this.data.useServerConfigInput ? '(Config Using Input)' : 'Configured'}\nCapabilities: ${this.data.capabilities.length}`;
     }
   
     static getUIData(): NodeUIData {
       return {
         infoBoxBody: 'Connects to and interacts with Model Context Protocol servers.',
         infoBoxTitle: 'MCP Node',
         contextMenuTitle: 'MCP',
         group: ['AI', 'Integration'],
       };
     }
   
     async process(inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
       try {
         // 1. Get server configuration
         const config = this.data.useServerConfigInput 
           ? coerceType(inputs.serverConfig, 'object') 
           : this.data.serverConfig;

         // 2. Start MCP server if not running
         // TODO: Implement server lifecycle management

         // 3. Negotiate capabilities
         const capabilities = await this.negotiateCapabilities(config);

         // 4. Execute requested operation
         const response = await this.executeOperation(config, inputs);

         return {
           response: {
             type: 'object',
             value: response
           },
           capabilities: {
             type: 'object',
             value: capabilities
           },
           connectionStatus: {
             type: 'string',
             value: 'connected'
           }
         };
       } catch (err) {
         if (this.data.errorOnConnectionFailure) {
           throw err;
         }
         return {
           connectionStatus: {
             type: 'string',
             value: 'error'
           }
         };
       }
     }

     private async negotiateCapabilities(config: any): Promise<string[]> {
       // TODO: Implement capability negotiation
       return [];
     }

     private async executeOperation(config: any, inputs: Inputs): Promise<any> {
       // TODO: Implement operation execution
       return {};
     }
   }
   
   export const mcpNode = nodeDefinition(MCPNodeImpl, 'MCP');
   ```

2. Node Component (`packages/app/src/components/nodes/MCPNode.tsx`)
   ```typescript
   import { type FC } from 'react';
   import { type NodeComponentDescriptor } from '../../hooks/useNodeTypes';
   import { type MCPNode } from '@ironclad/rivet-core';

   export const MCPNodeBody: FC<{
     node: MCPNode;
   }> = ({ node }) => {
     // Custom UI for showing MCP connection status, selected capabilities, etc.
     return (
       <div>
         <div>{node.data.serverConfig ? 'Connected' : 'Not Connected'}</div>
       </div>
     );
   };

   export const mcpNodeDescriptor: NodeComponentDescriptor<'mcp'> = {
     Body: MCPNodeBody,
   };
   ```

3. Node Documentation (`packages/docs/docs/node-reference/mcp.md`)
   ```markdown
   ---
   id: mcp
   title: MCP Node
   sidebar_label: MCP
   ---
   
   ![MCP Node Screenshot](./assets/mcp-node.png)
   
   ## Overview
   
   The MCP Node enables interaction with Model Context Protocol servers, allowing access to external AI capabilities, tools, and resources.
   
   ## Inputs/Outputs
   
   ### Inputs
   | Title | Data Type | Description |
   |-------|-----------|-------------|
   | Server Config | `object` | Configuration for the MCP server connection |
   | Tool Config | `object` | Configuration for specific tool usage |
   
   ### Outputs
   | Title | Data Type | Description |
   |-------|-----------|-------------|
   | Response | `object` | The response from the MCP server |
   | Capabilities | `object` | Available server capabilities |
   | Connection Status | `string` | Current connection status |
   
   ## Editor Settings
   | Setting | Description | Default |
   |---------|-------------|---------|
   | Server Configuration | JSON configuration for the MCP server | {} |
   | Tool Configuration | JSON configuration for tool usage | {} |
   | Error on Connection Failure | Whether to error on connection issues | true |
   ```

4. Node Registration
   - Add to node registry in `packages/core/src/nodes/index.ts`
   - Add to documentation index
   - Register component in `packages/app/src/hooks/useNodeTypes.ts`

## 3. MCP Node Implementation Structure

### Core Components
1. Node Definition
   - Create MCPNode class extending BaseNode
   - Define inputs/outputs based on MCP protocol
   - Implement node configuration UI

2. MCP Client Integration
   - Connection management
   - Protocol message handling
   - Error handling and recovery
   - Resource cleanup

### Node Features
1. Basic Functionality
   - MCP server connection
   - Capability negotiation
   - Resource access
   - Tool execution

2. Security Implementation
   - User consent handling
   - Data privacy controls
   - Tool safety measures
   - Secure sampling

## 4. Testing Strategy

1. Unit Tests
   - Node initialization
   - Configuration validation
   - Protocol message handling
   - Error scenarios

2. Integration Tests
   - End-to-end MCP server communication
   - Resource access flows
   - Tool execution flows
   - Error recovery

## 5. Documentation

1. Node Documentation
   - Usage instructions
   - Configuration options
   - Security considerations
   - Example graphs

2. Protocol Documentation
   - MCP protocol version support
   - Supported capabilities
   - Error handling guidance

## 6. Implementation Phases

### Phase 1: Basic Connection
- Node setup and configuration
- Basic MCP server connection
- Capability negotiation
- Simple resource access

### Phase 2: Core Features
- Tool execution
- Resource management
- Error handling
- Basic security measures

### Phase 3: Advanced Features
- Sampling support
- Advanced security
- Performance optimization
- Extended capabilities

## 7. Security Considerations

1. User Consent
   - Explicit consent UI
   - Clear documentation
   - Revocation handling

2. Data Privacy
   - Minimal data exposure
   - Secure transmission
   - Access controls

3. Tool Safety
   - Execution isolation
   - Resource limits
   - User authorization

## 8. Testing Environment

1. Local Testing
   - Mock MCP server
   - Test scenarios
   - Performance testing

2. Integration Testing
   - Live MCP server testing
   - Error scenarios
   - Security validation 