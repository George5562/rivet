# MCP Node for Rivet

## Overview

The Model Context Protocol (MCP) Node enables interaction with MCP-compliant servers, providing access to external AI capabilities, tools, and resources through a standardized protocol.

## Architecture

The MCP implementation is split across several packages:

- `core`: Core node implementation and processing logic
- `mcp`: Server management and protocol handling
- `app-executor`: Tool execution and resource management
- `mcp-shared`: Shared utilities, types, and error handling

## Features

- Dynamic tool discovery and port generation
- Infrastructure monitoring and health checks
- Comprehensive error handling with recovery strategies
- Two-level caching system (package and API)
- Resource management with dependency tracking
- State machine for server lifecycle management

## Resource Management

The system uses a dependency-aware resource management approach:

- Resource tracking with dependency graphs
- Ordered cleanup based on dependencies
- Cleanup verification with detailed reporting
- Event-based monitoring
- Automatic resource cleanup on errors

## State Management

Server lifecycle is managed through a state machine:

- Validated state transitions
- State persistence with metadata
- Automatic recovery mechanisms
- Event-based monitoring
- Integration with error handling

States and transitions:

```
not_installed -> installing -> installed -> starting -> initializing -> connected
                                                                    -> stopping -> stopped
                                                                    -> error -> [recovery]
```

## Error Handling

The system uses a categorized error handling approach:

- Protocol errors: JSON-RPC and MCP protocol issues
- Tool errors: Execution and validation failures
- Infrastructure errors: Connection and resource issues
- Security errors: Access and capability problems

Each category has specific recovery strategies:

- Configurable retry attempts
- Exponential/linear backoff
- Resource cleanup on failure
- Detailed error reporting

## Configuration

Server configuration is managed through `config.json`:

```json
{
  "mcpServers": {
    "serverId": {
      "name": "Server Name",
      "command": "npx start-server",
      "status": "installed",
      "capabilities": ["tool1", "tool2"]
    }
  }
}
```
