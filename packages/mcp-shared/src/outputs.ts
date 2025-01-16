import { type DataValue } from './types/data.js';
import { type MCPErrorCode } from './errors.js';

/**
 * Base outputs type matching Rivet's Outputs type
 */
export type Outputs = Record<string, DataValue | undefined>;

/**
 * Standard MCP output structure
 */
export interface MCPOutputs extends Outputs {
  /** The main response content */
  response?: DataValue;

  /** Additional metadata about the execution */
  metadata?: {
    type: 'object';
    value: {
      /** Total execution time in milliseconds */
      executionTime: number;
      /** Current execution phase */
      phase: string;
      /** Error information if present */
      error?: {
        /** Error code from MCPErrorCode */
        code: MCPErrorCode;
        /** Error message */
        message: string;
        /** Additional error data */
        data?: unknown;
      };
      /** Server status information */
      serverStatus?: {
        status: 'initializing' | 'connected' | 'error';
        lastError?: string;
      };
      /** Number of retry attempts */
      retryCount?: number;
    };
  };
}

/**
 * Tool execution response structure
 */
export interface ToolResponse {
  /** Response content items */
  content: {
    /** Content type (text, image, etc) */
    type: string;
    /** Text content if type is 'text' */
    text?: string;
    /** Base64 data if type is 'image' */
    data?: string;
    /** MIME type for binary data */
    mimeType?: string;
  }[];
  /** Whether the response indicates an error */
  isError?: boolean;
  /** Additional metadata */
  _meta?: Record<string, unknown>;
}
