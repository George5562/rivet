/**
 * Tool caching system for MCP servers
 * Handles caching of discovered tools and their metadata
 */

import type { ToolMetadata } from '../index.js';

interface CachedTool {
  metadata: ToolMetadata;
  lastUpdated: number;
  serverId: string;
  serverVersion?: string;
}

interface CacheEntry {
  tools: Record<string, CachedTool>;
  serverVersion?: string;
  lastDiscovery: number;
}

export class ToolCache {
  private static instance: ToolCache;
  private cache: Record<string, CacheEntry> = {};

  // Cache TTL in milliseconds (1 hour)
  private static readonly CACHE_TTL = 60 * 60 * 1000;

  private constructor() {}

  /**
   * Get singleton instance of ToolCache
   */
  public static getInstance(): ToolCache {
    if (!ToolCache.instance) {
      ToolCache.instance = new ToolCache();
    }
    return ToolCache.instance;
  }

  /**
   * Cache tools for a specific MCP server
   */
  public cacheTools(serverId: string, tools: Record<string, ToolMetadata>, serverVersion?: string): void {
    const now = Date.now();
    const toolEntries: Record<string, CachedTool> = {};

    // Create cache entries for each tool
    Object.entries(tools).forEach(([toolId, metadata]) => {
      toolEntries[toolId] = {
        metadata,
        lastUpdated: now,
        serverId,
        serverVersion,
      };
    });

    // Update cache entry
    this.cache[serverId] = {
      tools: toolEntries,
      serverVersion,
      lastDiscovery: now,
    };
  }

  /**
   * Get cached tools for a specific server
   * Returns null if cache is invalid or expired
   */
  public getCachedTools(serverId: string, serverVersion?: string): Record<string, ToolMetadata> | null {
    const entry = this.cache[serverId];
    const now = Date.now();

    // Check cache validity
    if (
      !entry ||
      now - entry.lastDiscovery > ToolCache.CACHE_TTL ||
      (serverVersion && entry.serverVersion !== serverVersion)
    ) {
      return null;
    }

    // Extract and return tool metadata
    const tools: Record<string, ToolMetadata> = {};
    Object.entries(entry.tools).forEach(([toolId, cachedTool]) => {
      tools[toolId] = cachedTool.metadata;
    });

    return tools;
  }

  /**
   * Clear cache for a specific server
   */
  public clearCache(serverId: string): void {
    delete this.cache[serverId];
  }

  /**
   * Clear entire cache
   */
  public clearAllCache(): void {
    this.cache = {};
  }

  /**
   * Check if cache is valid for a server
   */
  public isCacheValid(serverId: string, serverVersion?: string): boolean {
    const entry = this.cache[serverId];
    const now = Date.now();

    return !!(
      entry &&
      now - entry.lastDiscovery <= ToolCache.CACHE_TTL &&
      (!serverVersion || entry.serverVersion === serverVersion)
    );
  }
}
