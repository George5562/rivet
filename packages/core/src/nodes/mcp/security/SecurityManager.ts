import { MCPError, MCPErrorCode, type SecuritySettings, type ToolRequest } from '../types.js';

/**
 * Manages security for MCP operations
 */
export class SecurityManager {
  private settings: SecuritySettings;

  constructor(settings?: Partial<SecuritySettings>) {
    this.settings = {
      requireToolPermission: true,
      isToolExecutionPermitted: false,
      ...settings,
    };
  }

  /**
   * Update security settings
   */
  updateSettings(settings: Partial<SecuritySettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
    };
  }

  /**
   * Validate tool execution permission
   */
  validateToolExecution(toolRequest: ToolRequest): void {
    if (this.settings.requireToolPermission && !this.settings.isToolExecutionPermitted) {
      throw new MCPError(MCPErrorCode.SecurityError, 'Tool execution requires permission', {
        toolId: toolRequest.toolId,
        requiresPermission: true,
        currentPermission: false,
      });
    }
  }

  /**
   * Sanitize tool request parameters
   */
  sanitizeToolRequest(request: ToolRequest): ToolRequest {
    // Basic parameter sanitization
    const sanitizedParams = { ...request.params };

    // Remove any potentially sensitive fields
    delete sanitizedParams.apiKey;
    delete sanitizedParams.credentials;
    delete sanitizedParams.token;
    delete sanitizedParams.password;

    return {
      ...request,
      params: sanitizedParams,
    };
  }

  /**
   * Get current security settings
   */
  getSettings(): SecuritySettings {
    return { ...this.settings };
  }
}
