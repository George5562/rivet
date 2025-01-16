import type { LRUCache as LRUCacheType } from 'lru-cache';
import LRUCache from 'lru-cache';
import { MCPError, MCPErrorCode } from '@ironclad/rivet-mcp-shared';
import { join } from 'path';
import { homedir } from 'os';
import { mkdir, readFile, writeFile, rm } from 'fs/promises';

interface PackageInfo {
  version: string;
  lastAccessed: number;
  size: number;
  path: string;
}

/**
 * Package-level caching system for MCP
 * Handles caching of installed packages and their metadata
 */
export class PackageCache {
  private static instance: PackageCache;
  private readonly cacheDir: string;
  private readonly maxSize: number = 500 * 1024 * 1024; // 500MB
  private readonly cache: LRUCacheType<string, PackageInfo>;

  private constructor() {
    this.cacheDir = join(homedir(), '.rivet', 'mcp', 'packages');
    this.cache = new LRUCache<string, PackageInfo>({
      max: this.maxSize,
      maxSize: this.maxSize,
      sizeCalculation: (value: PackageInfo) => value.size,
      updateAgeOnGet: true,
    });
  }

  /**
   * Get singleton instance of PackageCache
   */
  public static getInstance(): PackageCache {
    if (!PackageCache.instance) {
      PackageCache.instance = new PackageCache();
    }
    return PackageCache.instance;
  }

  /**
   * Initialize cache directory
   */
  public async initialize(): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
    } catch (err) {
      throw new MCPError(MCPErrorCode.CacheInitError, 'Failed to initialize cache directory', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Get cached package path
   */
  public async getCachedPackage(packageId: string, version: string): Promise<string | null> {
    const key = this.getCacheKey(packageId, version);
    const info = this.cache.get(key);

    if (!info) {
      return null;
    }

    try {
      // Update last accessed time
      info.lastAccessed = Date.now();
      await this.updatePackageInfo(key, info);
      return info.path;
    } catch (err) {
      // If reading fails, remove from cache
      this.cache.delete(key);
      return null;
    }
  }

  /**
   * Cache a package
   */
  public async cachePackage(packageId: string, version: string, packagePath: string): Promise<void> {
    const key = this.getCacheKey(packageId, version);

    try {
      const stats = await readFile(packagePath);
      const info: PackageInfo = {
        version,
        lastAccessed: Date.now(),
        size: stats.length,
        path: packagePath,
      };

      // Add to cache
      this.cache.set(key, info);
      await this.updatePackageInfo(key, info);
    } catch (err) {
      throw new MCPError(MCPErrorCode.CacheWriteError, 'Failed to cache package', {
        packageId,
        version,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Clear cache for a specific package
   */
  public async clearPackage(packageId: string, version: string): Promise<void> {
    const key = this.getCacheKey(packageId, version);
    const info = this.cache.get(key);

    if (info) {
      try {
        await rm(info.path, { force: true });
        this.cache.delete(key);
      } catch (err) {
        throw new MCPError(MCPErrorCode.CacheInvalidationError, 'Failed to clear package from cache', {
          packageId,
          version,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Clear entire cache
   */
  public async clearAllPackages(): Promise<void> {
    try {
      await rm(this.cacheDir, { recursive: true, force: true });
      await mkdir(this.cacheDir, { recursive: true });
      this.cache.clear();
    } catch (err) {
      throw new MCPError(MCPErrorCode.CacheInvalidationError, 'Failed to clear package cache', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Get cache key for a package
   */
  private getCacheKey(packageId: string, version: string): string {
    return `${packageId}@${version}`;
  }

  /**
   * Update package info in cache
   */
  private async updatePackageInfo(key: string, info: PackageInfo): Promise<void> {
    const infoPath = join(this.cacheDir, `${key}.json`);
    await writeFile(infoPath, JSON.stringify(info, null, 2));
  }
}
