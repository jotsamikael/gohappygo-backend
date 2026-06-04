import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/** Cache key namespaces used across the app. */
export const CacheNamespace = {
  AIRPORTS: 'airports',
  AIRLINES: 'airlines',
  AIRLINE_IATA: 'airline-iata',
  CURRENCIES: 'currencies',
  DEMAND_TRAVEL: 'demand-travel',
} as const;

export type CacheNamespaceType = (typeof CacheNamespace)[keyof typeof CacheNamespace];

/**
 * Tracks cache keys per namespace and deletes them on activation changes
 * so deactivated records are not served from stale cache entries.
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly keysByNamespace = new Map<string, Set<string>>();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  track(namespace: CacheNamespaceType, key: string): void {
    if (!this.keysByNamespace.has(namespace)) {
      this.keysByNamespace.set(namespace, new Set());
    }
    this.keysByNamespace.get(namespace)!.add(key);
  }

  /**
   * Delete explicit keys (e.g. airline IATA lookups) and untrack them.
   */
  async deleteKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.cacheManager.del(key);
      for (const keySet of this.keysByNamespace.values()) {
        keySet.delete(key);
      }
    }
  }

  async invalidateNamespace(namespace: CacheNamespaceType): Promise<void> {
    const keys = this.keysByNamespace.get(namespace);
    if (!keys || keys.size === 0) {
      return;
    }

    const count = keys.size;
    for (const key of keys) {
      await this.cacheManager.del(key);
    }
    keys.clear();
    this.logger.log(`Invalidated ${namespace} cache (${count} keys)`);
  }

  /**
   * Clear all caches that may expose airport, airline, or currency visibility.
   */
  async invalidateActivationRelated(): Promise<void> {
    await Promise.all([
      this.invalidateNamespace(CacheNamespace.AIRPORTS),
      this.invalidateNamespace(CacheNamespace.AIRLINES),
      this.invalidateNamespace(CacheNamespace.AIRLINE_IATA),
      this.invalidateNamespace(CacheNamespace.CURRENCIES),
      this.invalidateNamespace(CacheNamespace.DEMAND_TRAVEL),
    ]);
    this.logger.log('Invalidated activation-related caches');
  }
}
