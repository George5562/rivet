# MCP Node for Rivet

## Overview

The MCP (Model Context Protocol) Node enables interaction with MCP-compliant servers in Rivet, providing access to external AI capabilities through a standardized protocol.

## Implementation Status

### ✅ Core Implementation

- `MCPNode.ts`: Node definition, UI, and processing logic
- `MCPProcessManager.ts`: Server lifecycle and protocol implementation
- `SecurityManager.ts`: Security and permission management
- All core features implemented including:
  - Connection lifecycle
  - Resource operations
  - Tool execution
  - Sampling support
  - Security measures

### ✅ Documentation

- Node reference in `packages/docs/docs/node-reference/mcp.mdx`
- Node catalog entry in `packages/docs/docs/node-reference/all-nodes.mdx`
- Protocol specification in `MCP_reference.json`

### 📝 Testing (Pending)

- Unit tests needed for:
  - `MCPProcessManager`
  - `SecurityManager`
  - Node implementation
- Integration tests needed for:
  - End-to-end server communication
  - Tool execution flows
  - Security validation

## Protocol Implementation

### Connection Lifecycle

1. Initialization

   - Establish secure connection
   - Protocol handshake (initialize method)
   - Capability negotiation
   - Send initialized notification

2. Standard Operations

   - Resource Methods: getResource, listResources, watchResource
   - Tool Methods: listTools, executeTool, cancelTool
   - Sampling Methods: requestSample, provideSample, cancelSample

3. Error Handling
   - Validation errors: Immediate notification
   - Runtime errors: Graceful degradation
   - Security errors: Immediate termination

### Security Implementation

1. User Consent

   - Explicit consent UI
   - Consent storage
   - Revocation handling

2. Data Privacy

   - Access controls
   - Data protection
   - Transmission security

3. Tool Safety
   - Sandboxing
   - Resource limits
   - Execution monitoring

## File Organization

### Node Implementation

- `packages/core/src/model/nodes/MCPNode.ts`
  - Main node implementation
  - UI component registration
  - Process handling

### Core MCP Implementation

- `packages/core/src/nodes/mcp/`
  - `types.ts`: Protocol type definitions
  - `MCPProcessManager.ts`: Server management
  - `security/SecurityManager.ts`: Security implementation

### UI Components

- `packages/app/src/components/nodes/MCPNode.tsx`
  - Node UI implementation
  - Status display
  - Configuration interface

### Documentation

- `packages/docs/docs/node-reference/`
  - `mcp.mdx`: Node documentation
  - `all-nodes.mdx`: Catalog entry

### Configuration

- `packages/mcp/`
  - `config.json`: Server configuration
  - `MCP_reference.json`: Protocol specification

## Development Setup

1. Start core package watcher:

```bash
cd packages/core
yarn watch
```

2. Start app-executor:

```bash
cd packages/app-executor
yarn dev
```

## Server Configuration

Example configuration for Brave Search MCP server:

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

## Testing Strategy

### Unit Tests

- Node initialization
- Configuration validation
- Protocol message handling
- Error scenarios

### Integration Tests

- End-to-end MCP server communication
- Resource access flows
- Tool execution flows
- Error recovery

### Local Testing Environment

- Mock MCP server
- Test scenarios
- Performance testing

## Next Steps

1. Implement test suite

   - Unit tests for core components
   - Integration tests for server communication
   - Security validation tests

2. Performance optimization
   - Connection pooling
   - Resource caching
   - Error recovery improvements

## Contributing

When contributing to the MCP node:

1. Follow Rivet's coding standards
2. Update documentation for any changes
3. Add tests for new features
4. Update this README as needed
