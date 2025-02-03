# MCP Node for Rivet

## Overview

The Model Context Protocol (MCP) Node enables interaction with MCP-compliant servers, providing access to external AI capabilities, tools, and resources through a standardized protocol.

## Installation and Setup

### Prerequisites

- [volta](https://volta.sh/) or Node.js >= 20.4.0
- [yarn](https://yarnpkg.com/getting-started/install) >= 3.5.0

### Steps

1. Clone and install dependencies:

```bash
# Clone with blobless clone for faster download
git clone --filter=blob:none git@github.com:Ironclad/rivet.git
cd rivet
yarn install
```

2. Build all packages:

```bash
yarn build
```

This will build all packages in the correct order, including `mcp-shared` before `core`.

3. Verify installation:

- Check that `dist` directories are created in both `packages/mcp-shared` and `packages/core`
- Ensure no TypeScript errors are present in the build output

### Development

For development, you can use watch mode:

```bash
# Watch mode for mcp-shared
yarn workspace @ironclad/rivet-mcp-shared watch

# Watch mode for core
yarn workspace @ironclad/rivet-core watch
```

### IDE Configuration

Rivet makes use of yarn PnP, so some editor configuration may be necessary:

#### VS Code

1. Install the [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs) extension
2. Open the command palette and run `TypeScript: Select TypeScript Version`
3. Select `Use Workspace Version`

For other IDEs, see: https://yarnpkg.com/getting-started/editor-sdks

### Troubleshooting

Common issues:

1. Missing dependencies:

```bash
yarn install
```

2. Build errors:

- Clear build artifacts and rebuild:

```bash
yarn workspace @ironclad/rivet-mcp-shared clean
yarn workspace @ironclad/rivet-core clean
yarn build
```

3. Type errors:

- The build script ensures packages are built in the correct order
- Check that package versions match in all `package.json` files
- Ensure your IDE is properly configured for yarn PnP

## Architecture

The MCP implementation is organized into packages:

- `mcp-shared`: Shared MCP types and utilities

  - Type definitions (`types.ts`)
  - Tool caching (`cache/ToolCache.ts`)
  - Security management (`security/SecurityManager.ts`)
  - Error handling and utilities

- `core`: Core Rivet integration
  - MCP Provider interface (`integrations/MCPProvider.ts`)
  - Tool execution and management
  - Integration with Rivet core functionality

## Key Components

### Types (`mcp-shared/types.ts`)

Core type definitions including:

- `MCPToolMetadata` - Tool metadata and capabilities
- `MCPParameter` - Parameter definitions for tools
- `SecuritySettings` - Security and permissions configuration
- `ToolRequest` - Tool execution request format
- `MCPError` and `MCPErrorCode` - Error handling

### Tool Cache (`mcp-shared/cache/ToolCache.ts`)

Manages caching of discovered tools:

- Single instance pattern
- Tool metadata caching
- Server-specific caching
- Cache invalidation and TTL management

### Security Manager (`mcp-shared/security/SecurityManager.ts`)

Handles security and permissions:

- Server-specific security settings
- Tool execution permissions
- Permission validation and enforcement

### MCP Provider (`core/integrations/MCPProvider.ts`)

Interface for MCP integration:

```typescript
export interface MCPProvider {
  initialize(config: Record<string, unknown>): Promise<void>;
  executeTool(request: ToolRequest): Promise<unknown>;
  getTools(): Promise<MCPToolMetadata[]>;
  cleanup(): Promise<void>;
}
```

## Error Handling

Standardized error handling through `MCPError`:

```typescript
export enum MCPErrorCode {
  ValidationError = 'VALIDATION_ERROR',
  ConfigError = 'CONFIG_ERROR',
  InitializationError = 'INITIALIZATION_ERROR',
  ExecutionError = 'EXECUTION_ERROR',
  SecurityError = 'SECURITY_ERROR',
  InternalError = 'INTERNAL_ERROR',
}
```

## Tool Metadata

Tools are defined with comprehensive metadata:

```typescript
export interface MCPToolMetadata {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
}
```

## Security Configuration

Security settings per server:

```typescript
export interface SecuritySettings {
  permissions: Record<string, boolean>;
  requireToolPermission: boolean;
  isToolExecutionPermitted: boolean;
}
```

## Server Configuration

Server configuration format:

```typescript
export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```

For more details, see the JSON schema in `MCP_schema.json` and reference implementation in `MCP_reference.json`.
