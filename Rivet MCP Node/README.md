# MCP Node for Rivet

## Overview

The Model Context Protocol (MCP) Node enables communication with MCP-compliant servers through either HTTP or stdio interfaces. It allows you to send requests to external AI services or tools that implement the MCP protocol.

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

3. Configure MCP servers (for stdio mode):

Create a configuration file at `~/.config/rivet/mcp-config.json`. For example, using VS Code:

```bash
# MacOS/Linux
mkdir -p ~/.config/rivet
code ~/.config/rivet/mcp-config.json
```

Add your MCP server configurations:

```json
{
  "mcpServers": {
    "browser-use": {
      "command": "node",
      "args": ["/path/to/your/browser-use-server/build/index.js"]
    },
    "weather": {
      "command": "node",
      "args": ["/path/to/your/weather-server/build/index.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

Each server configuration can include:

- `command`: The command to run the server (required)
- `args`: Array of command arguments (optional)
- `env`: Environment variables for the server (optional)
- `disabled`: Set to true to disable the server (optional)
- `alwaysAllow`: Array of tools to always allow (optional)

## Using the MCP Node

The MCP Node provides two communication modes:

### 1. HTTP Mode

Uses standard HTTP POST requests to communicate with MCP servers.

#### Configuration:

1. **Endpoint URL**

   - Set the MCP server endpoint URL directly in the node
   - Or toggle "Use Input" to provide the endpoint via an input port

2. **Headers**
   - Add custom headers for authentication or other purposes
   - Headers can be set directly in the node or provided via an input port

### 2. STDIO Mode

Launches and communicates with local MCP servers using standard input/output.

#### Configuration:

1. **Server ID**

   - Set the MCP server ID that matches your configuration file
   - Or toggle "Use Input" to provide the server ID via an input port
   - The ID must match a key in your `mcpServers` configuration

2. **Configuration File**
   - Create `~/.config/rivet/mcp-config.json`
   - Define server configurations including command, arguments, and environment variables
   - Each server entry defines how to launch and configure the MCP server

### Tool Discovery

When using stdio mode, the MCP Node will:

1. Automatically discover available tools from the server
2. Display the number of available tools in the node
3. Include tool information in the metadata output
4. Handle tool-specific configurations

### Input/Output

For both modes:

- Input: The data to send to the MCP server
- Outputs:
  - Output: The response from the MCP server
  - Metadata: Additional metadata from the response (including available tools)
  - Error: Any error messages if the request fails

### Example Usage

1. **HTTP Mode**:

   - Select "HTTP" communication mode
   - Set endpoint URL (e.g., `http://localhost:8080`)
   - Add any required headers
   - Connect your input data

2. **STDIO Mode**:
   ```json
   // Example configuration
   {
     "mcpServers": {
       "browser-use": {
         "command": "node",
         "args": ["/path/to/browser-use-server/build/index.js"]
       }
     }
   }
   ```
   Then in Rivet:
   - Select "STDIO" communication mode
   - Set server ID to "browser-use"
   - Connect your input data
   - The node will automatically discover available tools

### Node Behavior

The node will:

1. Based on the communication mode:
   - HTTP: Send a POST request to the configured endpoint
   - STDIO: Launch and communicate with the configured local server
2. Send the input data in JSON format
3. Return the server's response or any error messages

### Error Handling

The node provides detailed error handling for both modes:

- HTTP mode:

  - Network errors
  - Invalid responses
  - Server errors

- STDIO mode:
  - Configuration errors (`CONFIG_NOT_FOUND`)
  - Server not found (`SERVER_NOT_FOUND`)
  - Server disabled (`SERVER_DISABLED`)
  - Launch failures (`SERVER_START_FAILED`)
  - Communication errors (`SERVER_COMMUNICATION_FAILED`)
  - Invalid responses (`INVALID_RESPONSE`)

Errors will be output through:

- The error port (error message)
- The metadata port (detailed error information)

### Troubleshooting

1. Missing dependencies:

```bash
yarn install
```

2. Build errors:

```bash
yarn workspace @ironclad/rivet-core clean
yarn build
```

3. HTTP Connection issues:

- Verify the endpoint URL is correct and accessible
- Check that any required headers are properly configured
- Ensure the MCP server is running and accepting connections

4. STDIO Connection issues:

- Check that your configuration file exists at `~/.config/rivet/mcp-config.json`
- Verify the server command and path are correct
- Check server permissions and environment variables
- Look for error messages in the node's error output
- Ensure the server executable exists and is accessible

5. Tool Discovery issues:

- Check that the server responds to the `_get_tools` command
- Verify the server returns valid JSON
- Check the server's stderr output for errors

### Under the Hood

When you use an MCP node:

1. The node checks the communication mode
2. For stdio mode:
   - Loads the configuration file
   - Launches the specified server process
   - Discovers available tools
   - Maintains the server process for communication
3. Sends your input to the server
4. Processes the response
5. Handles any errors or cleanup needed

## Development

For development, you can use watch mode:

```bash
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

```bash
yarn workspace @ironclad/rivet-core clean
yarn build
```

3. HTTP Connection issues:

- Verify the endpoint URL is correct and accessible
- Check that any required headers are properly configured
- Ensure the MCP server is running and accepting connections

4. STDIO Connection issues:

- Check that your configuration file exists and is valid
- Verify the server command and path are correct
- Check server permissions and environment variables
- Look for error messages in the node's error output

## Testing with Browser-Based MCP Server

### Available Tools

The MCP server provides two browser automation tools:

1. **open_url**

   - Purpose: Opens a URL in Brave browser
   - Required parameter: `url` (must be a valid URI)
   - Example input: `{"url": "https://example.com"}`

2. **get_page_content**
   - Purpose: Gets content from the currently open page
   - Optional parameter: `selector` (CSS selector to extract specific content)
   - Example input: `{"selector": ".main-content"}` or `{}`

### Setting Up a Test Server

1. Create a new directory for your test server:

```bash
mkdir mcp-test-server
cd mcp-test-server
npm init -y
```

2. Install required dependencies:

```bash
npm install express cors body-parser puppeteer
```

3. Create a basic MCP server (server.js):

```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let browser = null;
let page = null;

// Initialize browser
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    });
  }
}

// Basic MCP endpoint
app.post('/', async (req, res) => {
  try {
    const { input, configuration } = req.body;
    let response = { output: '', metadata: {} };

    // Determine which tool to use based on input
    if (input.url) {
      // open_url tool
      await initBrowser();
      if (!page) {
        page = await browser.newPage();
      }
      await page.goto(input.url);
      response = {
        output: `Opened URL: ${input.url}`,
        metadata: {
          tool: 'open_url',
          timestamp: new Date().toISOString(),
          status: 'success',
        },
      };
    } else {
      // get_page_content tool
      if (!page) {
        throw new Error('No page is open. Call open_url first.');
      }

      let content;
      if (input.selector) {
        const element = await page.$(input.selector);
        content = element ? await element.evaluate((el) => el.textContent) : '';
      } else {
        content = await page.content();
      }

      response = {
        output: content,
        metadata: {
          tool: 'get_page_content',
          timestamp: new Date().toISOString(),
          selector: input.selector || 'full page',
        },
      };
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// Cleanup on server shutdown
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Browser MCP test server running on http://localhost:${PORT}`);
});
```

### Example Usage in Rivet

1. **Opening a URL**:

   - Add an MCP Node
   - Set input to: `{"url": "https://example.com"}`
   - Connect to Debug node to see response

2. **Getting Page Content**:
   - Add another MCP Node
   - Set input to: `{"selector": "h1"}` or `{}` for full page
   - Connect to Debug node to see extracted content

### Example Test Graph

1. Create this flow:

```
[Text Node: URL] → [MCP Node: open_url] → [Debug Node]
                                       ↓
[Text Node: Selector] → [MCP Node: get_page_content] → [Debug Node]
```

2. Configure nodes:
   - First Text Node: `{"url": "https://example.com"}`
   - Second Text Node: `{"selector": "h1"}`
   - Both MCP Nodes: endpoint `http://localhost:8080`

### Important Notes

- The browser session persists between commands
- Only one page can be active at a time
- You must call `open_url` before `get_page_content`
- The browser will launch automatically on first `open_url`
- Use Ctrl+C in the terminal to properly shut down the server and browser

### Error Handling

The server will return errors if:

- No URL is provided for `open_url`
- `get_page_content` is called before any page is opened
- Invalid URLs are provided
- Invalid CSS selectors are used
