'use client';

import { useEffect, useState } from 'react';
import { fetchMarketplaceFeedClient } from '../lib/marketplaceApi';
import type { MarketplaceFeed } from '../types/marketplace';

export function useMarketplaceFeed(initialFeed: MarketplaceFeed) {
  const [feed, setFeed] = useState(initialFeed);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (initialFeed.dataSource === 'live' && !initialFeed.usedFallback) {
      return;
    }

    let cancelled = false;

    async function refresh() {
      setIsRefreshing(true);

      try {
        const nextFeed = await fetchMarketplaceFeedClient();
        if (cancelled) {
          return;
        }

        setFeed({ ...nextFeed, usedFallback: false });
      } catch {
        if (!cancelled) {
          setFeed((current) => {
            if (current.dataSource === 'live' && current.listings.length > 0) {
              return current;
            }

            return { ...current, usedFallback: true };
          });
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [initialFeed.dataSource, initialFeed.usedFallback]);

  return { feed, isRefreshing };
}
