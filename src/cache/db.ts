import Dexie, { type Table } from 'dexie';
import type { Card } from '../types/types';

export type CacheStatus = 'idle' | 'loading' | 'complete' | 'error';

/** Cache header for one user/pipe: progress and the cursor needed to resume. */
export type CacheMeta = {
  key: string;
  userId: string;
  pipeId: string;
  cursor: string | null;
  loadedCount: number;
  totalCount: number | null;
  lastSyncAt: string | null;
};

type StoredCard = {
  userId: string;
  pipeId: string;
  cardId: string;
  card: Card;
};

type MetaPatch = Partial<Pick<CacheMeta, 'cursor' | 'loadedCount' | 'totalCount' | 'lastSyncAt'>>;

const DB_NAME = 'pipe-dashboard';

function cacheKey(userId: string, pipeId: string): string {
  return `${userId}|${pipeId}`;
}

class PipeDashboardDatabase extends Dexie {
  cards!: Table<StoredCard, [string, string, string]>;
  meta!: Table<CacheMeta, string>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      cards: '[userId+pipeId+cardId], [userId+pipeId]',
      meta: 'key',
    });
  }
}

const db = new PipeDashboardDatabase();

if (typeof navigator !== 'undefined') {
  void navigator.storage?.persist?.().catch(() => undefined);
}

export function createMeta(userId: string, pipeId: string): CacheMeta {
  return {
    key: cacheKey(userId, pipeId),
    userId,
    pipeId,
    cursor: null,
    loadedCount: 0,
    totalCount: null,
    lastSyncAt: null,
  };
}

function toStoredCards(userId: string, pipeId: string, cards: Card[]): StoredCard[] {
  return cards.map((card) => ({ userId, pipeId, cardId: card.id, card }));
}

async function readMeta(userId: string, pipeId: string): Promise<CacheMeta> {
  const stored = await db.meta.get(cacheKey(userId, pipeId));
  if (!stored || stored.userId !== userId) {
    return createMeta(userId, pipeId);
  }

  return stored;
}

function applyPatch(meta: CacheMeta, patch: MetaPatch): CacheMeta {
  return { ...meta, ...patch };
}

export async function getAllCards(userId: string, pipeId: string): Promise<Card[]> {
  const rows = await db.cards.where('[userId+pipeId]').equals([userId, pipeId]).toArray();
  return rows.map(({ card }) => card);
}

export async function getMeta(userId: string, pipeId: string): Promise<CacheMeta> {
  return readMeta(userId, pipeId);
}

export async function updateMeta(
  userId: string,
  pipeId: string,
  patch: MetaPatch,
): Promise<CacheMeta> {
  return db.transaction('rw', db.meta, async () => {
    const next = applyPatch(await readMeta(userId, pipeId), patch);
    await db.meta.put(next);
    return next;
  });
}

/**
 * Cards and cursor change in one transaction: advancing the cursor without the
 * cards would permanently skip data on resume.
 */
export async function saveCardsPage(
  userId: string,
  pipeId: string,
  cards: Card[],
  patch: MetaPatch,
): Promise<CacheMeta> {
  return db.transaction('rw', db.cards, db.meta, async () => {
    const next = applyPatch(await readMeta(userId, pipeId), patch);
    await db.cards.bulkPut(toStoredCards(userId, pipeId, cards));
    await db.meta.put(next);
    return next;
  });
}

/** The compound primary key makes bulkPut overwrite changed cards in place. */
export async function upsertCards(userId: string, pipeId: string, cards: Card[]): Promise<void> {
  await db.cards.bulkPut(toStoredCards(userId, pipeId, cards));
}
