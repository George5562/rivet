import { EventEmitter } from 'events';
import { MCPError, MCPErrorCode } from '@ironclad/rivet-mcp-shared';

export interface Resource {
  id: string;
  type: string;
  metadata?: Record<string, unknown>;
  dependencies?: string[];
  cleanupFn?: () => Promise<void>;
}

export interface ResourceVerification {
  success: boolean;
  error?: Error;
  details?: Record<string, unknown>;
}

/**
 * Manages MCP resources with dependency tracking and cleanup verification
 */
export class ResourceManager {
  private readonly resources: Map<string, Resource> = new Map();
  private readonly dependencyGraph: Map<string, Set<string>> = new Map();
  private readonly events: EventEmitter = new EventEmitter();

  /**
   * Track a new resource with optional cleanup function and dependencies
   */
  trackResource(resource: Resource): void {
    if (this.resources.has(resource.id)) {
      throw new MCPError(MCPErrorCode.ValidationError, `Resource ${resource.id} already tracked`);
    }

    this.resources.set(resource.id, resource);

    // Setup dependency tracking
    if (resource.dependencies?.length) {
      const deps = new Set(resource.dependencies);
      this.dependencyGraph.set(resource.id, deps);

      // Verify all dependencies exist
      for (const depId of deps) {
        if (!this.resources.has(depId)) {
          throw new MCPError(MCPErrorCode.ValidationError, `Dependency ${depId} for resource ${resource.id} not found`);
        }
      }
    }

    this.events.emit('resource:tracked', resource.id);
  }

  /**
   * Clean up a resource and its dependents
   */
  async cleanupResource(resourceId: string): Promise<ResourceVerification> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return { success: false, error: new Error(`Resource ${resourceId} not found`) };
    }

    try {
      // Clean up dependents first
      const dependents = this.findDependents(resourceId);
      for (const depId of dependents) {
        const result = await this.cleanupResource(depId);
        if (!result.success) {
          return result;
        }
      }

      // Execute cleanup function if provided
      if (resource.cleanupFn) {
        await resource.cleanupFn();
      }

      // Remove from tracking
      this.resources.delete(resourceId);
      this.dependencyGraph.delete(resourceId);

      // Remove from other resources' dependencies
      for (const deps of this.dependencyGraph.values()) {
        deps.delete(resourceId);
      }

      this.events.emit('resource:cleaned', resourceId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
        details: { resourceId, type: resource.type },
      };
    }
  }

  /**
   * Verify resource cleanup was successful
   */
  async verifyCleanup(resourceId: string): Promise<ResourceVerification> {
    const resource = this.resources.get(resourceId);

    // If resource is not tracked, consider cleanup successful
    if (!resource) {
      return { success: true };
    }

    // If resource still exists but has dependents, cleanup is incomplete
    const dependents = this.findDependents(resourceId);
    if (dependents.length > 0) {
      return {
        success: false,
        error: new Error('Resource has remaining dependents'),
        details: { resourceId, dependents },
      };
    }

    return { success: false, error: new Error('Resource still tracked') };
  }

  /**
   * Find all resources that depend on the given resource
   */
  private findDependents(resourceId: string): string[] {
    const dependents: string[] = [];

    for (const [id, deps] of this.dependencyGraph.entries()) {
      if (deps.has(resourceId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }

  /**
   * Subscribe to resource events
   */
  onResourceEvent(event: 'resource:tracked' | 'resource:cleaned', callback: (resourceId: string) => void): void {
    this.events.on(event, callback);
  }

  /**
   * Get all tracked resources
   */
  getTrackedResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resource by ID
   */
  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }
}
