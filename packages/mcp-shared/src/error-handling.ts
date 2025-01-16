import { MCPError, MCPErrorCode } from './errors.js';

/**
 * Error categories for grouping related errors
 */
export enum ErrorCategory {
  Protocol = 'protocol',
  Tool = 'tool',
  Infrastructure = 'infrastructure',
  Validation = 'validation',
  Security = 'security',
}

/**
 * Maps error codes to their categories
 */
export const errorCategories: Record<MCPErrorCode, ErrorCategory> = {
  // Protocol errors
  [MCPErrorCode.ParseError]: ErrorCategory.Protocol,
  [MCPErrorCode.InvalidRequest]: ErrorCategory.Protocol,
  [MCPErrorCode.MethodNotFound]: ErrorCategory.Protocol,
  [MCPErrorCode.InvalidParams]: ErrorCategory.Protocol,
  [MCPErrorCode.InternalError]: ErrorCategory.Protocol,

  // Tool errors
  [MCPErrorCode.ValidationError]: ErrorCategory.Validation,
  [MCPErrorCode.ExecutionError]: ErrorCategory.Tool,
  [MCPErrorCode.ToolExecutionError]: ErrorCategory.Tool,
  [MCPErrorCode.InvalidResponse]: ErrorCategory.Tool,

  // Infrastructure errors
  [MCPErrorCode.InstallationError]: ErrorCategory.Infrastructure,
  [MCPErrorCode.NetworkError]: ErrorCategory.Infrastructure,
  [MCPErrorCode.ResourceError]: ErrorCategory.Infrastructure,
  [MCPErrorCode.CacheError]: ErrorCategory.Infrastructure,
  [MCPErrorCode.ConnectionError]: ErrorCategory.Infrastructure,

  // Security errors
  [MCPErrorCode.SecurityError]: ErrorCategory.Security,
  [MCPErrorCode.ResourceAccessDenied]: ErrorCategory.Security,
  [MCPErrorCode.CapabilityNotSupported]: ErrorCategory.Security,
  [MCPErrorCode.ToolNotFound]: ErrorCategory.Tool,
};

/**
 * Error recovery strategy configuration
 */
export interface ErrorRecoveryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  baseDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Whether to use exponential backoff */
  useExponentialBackoff: boolean;
}

/**
 * Default recovery configuration by error category
 */
export const defaultRecoveryConfig: Record<ErrorCategory, ErrorRecoveryConfig> = {
  [ErrorCategory.Protocol]: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    useExponentialBackoff: true,
  },
  [ErrorCategory.Tool]: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 10000,
    useExponentialBackoff: false,
  },
  [ErrorCategory.Infrastructure]: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    useExponentialBackoff: true,
  },
  [ErrorCategory.Validation]: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    useExponentialBackoff: false,
  },
  [ErrorCategory.Security]: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    useExponentialBackoff: false,
  },
};

/**
 * Enhanced error handler with recovery strategies
 */
export class ErrorHandler {
  constructor(private readonly config: Record<ErrorCategory, ErrorRecoveryConfig> = defaultRecoveryConfig) {}

  /**
   * Determines if an error should be retried based on its category and retry count
   */
  shouldRetry(error: unknown, attempt: number): boolean {
    if (!(error instanceof MCPError)) {
      return attempt < this.config[ErrorCategory.Protocol].maxRetries;
    }

    const category = errorCategories[error.code];
    const recoveryConfig = this.config[category];

    return attempt < recoveryConfig.maxRetries;
  }

  /**
   * Calculates the delay before the next retry attempt
   */
  getRetryDelay(error: unknown, attempt: number): number {
    if (!(error instanceof MCPError)) {
      return this.calculateDelay(this.config[ErrorCategory.Protocol], attempt);
    }

    const category = errorCategories[error.code];
    const recoveryConfig = this.config[category];

    return this.calculateDelay(recoveryConfig, attempt);
  }

  /**
   * Creates a standardized error message with metadata
   */
  formatErrorMessage(error: unknown): string {
    if (error instanceof MCPError) {
      const category = errorCategories[error.code];
      return `[${category}] ${error.message}`;
    }

    return error instanceof Error ? error.message : String(error);
  }

  private calculateDelay(config: ErrorRecoveryConfig, attempt: number): number {
    if (attempt === 0 || config.maxRetries === 0) return 0;

    const delay = config.useExponentialBackoff
      ? config.baseDelay * Math.pow(2, attempt - 1)
      : config.baseDelay * attempt;

    return Math.min(delay, config.maxDelay);
  }
}

/**
 * Creates a standardized error object with enhanced metadata
 */
export function createError(
  code: MCPErrorCode,
  message: string,
  metadata?: Record<string, unknown>,
  cause?: unknown,
): MCPError {
  const category = errorCategories[code];
  const enhancedMetadata = {
    ...metadata,
    category,
    timestamp: new Date().toISOString(),
    cause: cause instanceof Error ? { name: cause.name, message: cause.message } : cause,
  };

  return new MCPError(code, message, enhancedMetadata);
}
