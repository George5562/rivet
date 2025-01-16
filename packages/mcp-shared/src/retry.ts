import { MCPError, MCPErrorCode } from './errors.js';

/**
 * Determines if an error should be retried based on its code
 */
export function shouldRetryError(err: unknown): boolean {
  if (!(err instanceof MCPError)) return true;

  // Don't retry client errors
  switch (err.code) {
    case MCPErrorCode.ParseError: // -32700
    case MCPErrorCode.InvalidRequest: // -32600
    case MCPErrorCode.MethodNotFound: // -32601
    case MCPErrorCode.InvalidParams: // -32602
      return false;
    default:
      return true;
  }
}

/**
 * Gets the appropriate retry delay for an error
 */
export function getRetryDelay(err: unknown, attempt: number): number {
  const baseDelay = 1000;

  if (err instanceof MCPError) {
    switch (err.code) {
      case MCPErrorCode.ConnectionError:
        return baseDelay * Math.pow(2, attempt); // Exponential backoff
      case MCPErrorCode.InternalError:
        return baseDelay * attempt; // Linear backoff
      default:
        return baseDelay;
    }
  }

  return baseDelay;
}
