import { type DataType } from '@ironclad/rivet-core';
import { MCPError, MCPErrorCode } from './errors.js';

/**
 * Maps MCP schema types to Rivet data types.
 * Handles basic scalar types and arrays.
 */
export function mapSchemaTypeToRivet(schema: any): DataType {
  const type = schema.type;
  const format = schema.format;

  // Handle array types
  if (type === 'array') {
    const itemType = mapSchemaTypeToRivet(schema.items);
    // Remove 'fn<' and '>' if present
    const baseType = itemType.replace(/^fn<(.+)>$/, '$1');
    return `${baseType}[]` as DataType;
  }

  // Handle scalar types
  switch (type) {
    case 'string':
      if (format === 'date') return 'date';
      if (format === 'time') return 'time';
      if (format === 'date-time') return 'datetime';
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    case 'null':
      return 'any';
    default:
      return 'any';
  }
}

/**
 * Validates tool input schema structure
 */
export function validateInputSchema(schema: unknown): void {
  if (!schema || typeof schema !== 'object') {
    throw new MCPError(MCPErrorCode.ValidationError, 'Invalid input schema structure');
  }

  const inputSchema = schema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };

  if (inputSchema.type !== 'object') {
    throw new MCPError(MCPErrorCode.ValidationError, 'Input schema must be of type "object"');
  }

  if (!inputSchema.properties || typeof inputSchema.properties !== 'object') {
    throw new MCPError(MCPErrorCode.ValidationError, 'Input schema must define properties');
  }

  // Validate each property's schema
  Object.entries(inputSchema.properties).forEach(([name, propSchema]) => {
    validatePropertySchema(name, propSchema);
  });
}

/**
 * Validates individual property schema
 */
function validatePropertySchema(name: string, schema: unknown): void {
  if (!schema || typeof schema !== 'object') {
    throw new MCPError(MCPErrorCode.ValidationError, `Invalid schema for property "${name}"`, { property: name });
  }

  const propSchema = schema as { type?: string; format?: string; description?: string };

  if (!propSchema.type || typeof propSchema.type !== 'string') {
    throw new MCPError(MCPErrorCode.ValidationError, `Missing or invalid type for property "${name}"`, {
      property: name,
    });
  }

  const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
  if (!validTypes.includes(propSchema.type)) {
    throw new MCPError(MCPErrorCode.ValidationError, `Invalid type "${propSchema.type}" for property "${name}"`, {
      property: name,
      type: propSchema.type,
    });
  }

  if (propSchema.format && typeof propSchema.format !== 'string') {
    throw new MCPError(MCPErrorCode.ValidationError, `Invalid format for property "${name}"`, {
      property: name,
      format: propSchema.format,
    });
  }
}
