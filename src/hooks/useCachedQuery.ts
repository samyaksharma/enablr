import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { FunctionReference } from 'convex/server';
import { getDatabase } from '../db/database';
import { useAuthStore } from '../stores/authStore';

// A live Convex query backed by a local copy of its last result.
//
// While the live result is loading (or the device is offline) the last result
// saved on this device is returned, so guild screens open instantly and stay
// readable without a connection. The server is always the source of truth: as
// soon as live data arrives it replaces the cached copy on screen and on disk.
export function useCachedQuery<Query extends FunctionReference<'query'>>(
  key: string,
  query: Query,
  args: Query['_args'] | 'skip'
): Query['_returnType'] | undefined {
  const userId = useAuthStore((s) => s.user?.id);
  const live = useQuery(query, ...([args] as any)) as Query['_returnType'] | undefined;
  const [cached, setCached] = useState<{ key: string; value: Query['_returnType'] } | null>(null);
  const skipped = args === 'skip';

  useEffect(() => {
    if (!userId || skipped) return;
    let cancelled = false;
    (async () => {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM query_cache WHERE user_id = ? AND key = ?',
          [userId, key]
        );
        if (row && !cancelled) setCached({ key, value: JSON.parse(row.value) });
      } catch {
        // A missing or unreadable cache entry just means we wait for live data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, key, skipped]);

  useEffect(() => {
    if (!userId || live === undefined) return;
    (async () => {
      try {
        const db = await getDatabase();
        await db.runAsync(
          'INSERT OR REPLACE INTO query_cache (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)',
          [userId, key, JSON.stringify(live), new Date().toISOString()]
        );
      } catch {
        // Caching is best-effort
      }
    })();
  }, [userId, key, live]);

  if (skipped) return undefined;
  if (live !== undefined) return live;
  return cached?.key === key ? cached.value : undefined;
}
