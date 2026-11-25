import { fetchCardsCount, fetchPage, type PageResult } from '../api/cards';
import { getMeta, saveCardsPage, updateMeta, upsertCards, type CacheMeta } from '../cache/db';
import { normalize } from '../helpers/normalize';
import type { PipefyAppInstance } from '../types/pipefy';
import type { Card } from '../types/types';

// Covers Pipefy's eventual consistency and the interval where an edited field may
// still be returned with its old value. Duplicate ids are resolved by merge.
const OVERLAP_MS = 5000;

export type SyncProgress = {
  loaded: number;
  total: number;
};

export type SyncOptions = {
  p: PipefyAppInstance;
  userId: string;
  pipeId: string;
  onProgress?: (progress: SyncProgress) => void;
};

function fromIso(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toIso(timestamp: number | null): string | null {
  return timestamp === null || !Number.isFinite(timestamp)
    ? null
    : new Date(timestamp).toISOString();
}

function overlapSince(lastSyncAt: string | null): string | null {
  const timestamp = fromIso(lastSyncAt);
  return timestamp === null ? null : toIso(timestamp - OVERLAP_MS);
}

function latestUpdatedAt(cards: Card[], current: number | null): number | null {
  return cards.reduce<number | null>((max, card) => {
    if (!Number.isFinite(card.updatedAt)) {
      return max;
    }

    return max === null || card.updatedAt > max ? card.updatedAt : max;
  }, current);
}

/** Last-write-wins by id removes duplicates caused by the overlap window. */
function mergeCardsById(existing: Card[], incoming: Card[]): Card[] {
  const merged = new Map(existing.map((card) => [card.id, card]));

  for (const card of incoming) {
    const current = merged.get(card.id);
    if (!current || card.updatedAt >= current.updatedAt) {
      merged.set(card.id, card);
    }
  }

  return [...merged.values()];
}

/** A repeated cursor means the API stopped advancing; fail instead of looping forever. */
function registerCursor(cursor: string | null, seen: Set<string>): void {
  if (!cursor) {
    return;
  }

  if (seen.has(cursor)) {
    throw new Error('A paginação não avançou');
  }

  seen.add(cursor);
}

/** The cursor is the source of truth: null with a watermark means the base is complete. */
function isComplete(cursor: string | null, lastSyncAt: string | null): boolean {
  return cursor === null && lastSyncAt !== null;
}

/**
 * Initial (or resumed) load of all cards. The cursor and progress are persisted
 * after every page, so closing the tab does not restart the download.
 */
export async function loadAll({ p, userId, pipeId, onProgress }: SyncOptions): Promise<CacheMeta> {
  let meta = await getMeta(userId, pipeId);

  if (isComplete(meta.cursor, meta.lastSyncAt)) {
    onProgress?.({ loaded: meta.loadedCount, total: meta.totalCount ?? 0 });
    return meta;
  }

  let cursor = meta.cursor;
  let loaded = meta.loadedCount;
  let lastTimestamp = fromIso(meta.lastSyncAt);
  const seenCursors = new Set<string>();
  if (cursor) {
    seenCursors.add(cursor);
  }

  const markError = (nextCursor: string | null) =>
    updateMeta(userId, pipeId, {
      cursor: nextCursor,
      loadedCount: loaded,
      totalCount: meta.totalCount,
      lastSyncAt: toIso(lastTimestamp),
    });

  try {
    if (meta.totalCount === null) {
      const { total } = await fetchCardsCount(p, pipeId);
      meta = await updateMeta(userId, pipeId, { totalCount: total });
    }
  } catch (error) {
    await markError(cursor);
    throw error;
  }

  onProgress?.({ loaded, total: meta.totalCount ?? 0 });

  for (;;) {
    let page: PageResult;
    try {
      page = await fetchPage(p, pipeId, cursor);
      registerCursor(page.nextCursor, seenCursors);
    } catch (error) {
      await markError(cursor);
      throw error;
    }

    const cards = page.cards.map(normalize);
    loaded += cards.length;
    lastTimestamp = latestUpdatedAt(cards, lastTimestamp);
    cursor = page.nextCursor;

    meta = await saveCardsPage(userId, pipeId, cards, {
      cursor,
      loadedCount: loaded,
      totalCount: meta.totalCount,
      lastSyncAt: toIso(lastTimestamp ?? Date.now()),
    });

    onProgress?.({ loaded, total: meta.totalCount ?? 0 });

    if (cursor === null) {
      return meta;
    }
  }
}

/**
 * Incremental sync asks only for cards updated after the saved watermark and
 * upserts them. `loadedCount`/`totalCount` stay unchanged because the base is complete.
 */
export async function syncIncremental({
  p,
  userId,
  pipeId,
  onProgress,
}: SyncOptions): Promise<CacheMeta> {
  const meta = await getMeta(userId, pipeId);

  if (meta.totalCount === null || meta.loadedCount === 0) {
    return loadAll({ p, userId, pipeId, onProgress });
  }

  const since = overlapSince(meta.lastSyncAt);
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let fetched: Card[] = [];
  let lastTimestamp = fromIso(meta.lastSyncAt);

  for (;;) {
    const page = await fetchPage(p, pipeId, cursor, since);
    registerCursor(page.nextCursor, seenCursors);

    const cards = page.cards.map(normalize);
    fetched = mergeCardsById(fetched, cards);
    lastTimestamp = latestUpdatedAt(cards, lastTimestamp);
    cursor = page.nextCursor;

    onProgress?.({ loaded: meta.loadedCount, total: meta.totalCount ?? 0 });

    if (cursor === null) {
      break;
    }
  }

  if (fetched.length > 0) {
    await upsertCards(userId, pipeId, fetched);
  }

  const updated = await updateMeta(userId, pipeId, {
    lastSyncAt: toIso(lastTimestamp ?? Date.now()),
  });

  return updated;
}
