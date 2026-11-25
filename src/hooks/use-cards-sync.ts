import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllCards, getMeta, type CacheStatus } from '../cache/db';
import { loadAll, syncIncremental, type SyncProgress } from '../data/sync-cards';
import type { Card } from '../types/types';
import { usePipefyApp } from './use-pipefy-app';

/**
 * Keeps the in-flight sync outside the component so StrictMode and repeated
 * clicks share one run instead of starting competing downloads.
 */

let currentRun: Promise<void> | null = null;

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Connects React to the cache/sync layers. The card list lives in IndexedDB;
 * failed API calls leave the cached cards available for the charts.
 */
export function useCardsSync() {
  const { pipefyAppInstance: p, userId, pipeId } = usePipefyApp();
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<CacheStatus>('idle');
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const activeRef = useRef(true);

  const run = useCallback((): Promise<void> => {
    if (currentRun) {
      return currentRun;
    }

    if (!p || !userId || !pipeId) {
      return Promise.resolve();
    }

    setError(null);
    setStatus('loading');

    currentRun = (async () => {
      const onProgress = (progress: SyncProgress) => {
        if (!activeRef.current) {
          return;
        }

        setLoaded(progress.loaded);
        setTotal(progress.total);
      };

      try {
        const meta = await getMeta(userId, pipeId);
        const isInitial = meta.cursor !== null || meta.lastSyncAt === null;

        const result = isInitial
          ? await loadAll({ p, userId, pipeId, onProgress })
          : await syncIncremental({ p, userId, pipeId, onProgress });

        if (!activeRef.current) {
          return;
        }

        setStatus('complete');
        setLoaded(result.loadedCount);
        setTotal(result.totalCount ?? 0);
        setCards(await getAllCards(userId, pipeId));
      } catch (cause) {
        if (!activeRef.current) {
          return;
        }

        setStatus('error');
        setError(toError(cause));
        setCards(await getAllCards(userId, pipeId).catch(() => []));
      }
    })().finally(() => {
      currentRun = null;
    });

    return currentRun;
  }, [p, userId, pipeId]);

  useEffect(() => {
    setCards([]);
    setStatus('idle');
    setLoaded(0);
    setTotal(0);
  }, [userId, pipeId]);

  useEffect(() => {
    activeRef.current = true;
    void run();

    return () => {
      // The sync continues writing to IndexedDB; only UI updates are ignored.
      activeRef.current = false;
    };
  }, [run]);

  return { cards, status, loaded, total, error };
}
