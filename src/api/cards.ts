import type { PipefyAppInstance } from '../types/pipefy';
import type { PipefyCard } from '../types/types';

/** GraphQL page size: balances request count and payload size. */
export const PAGE_SIZE = 50;

// Exponential backoff for transient API failures: 500ms, 1s, 2s.
const RETRY_DELAYS_MS = [500, 1000, 2000];

type PageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

type AllCardsData = {
  allCards: {
    edges: { node: PipefyCard }[];
    pageInfo: PageInfo;
  } | null;
};

type PipeData = {
  pipe: { cards_count: number } | null;
};

type QueryEnvelope<T> = {
  data?: T;
  errors?: { message: string }[];
};

/**
 * The `updated_at` filter is only added for incremental sync; the initial load
 * must see the whole pipe. `pageInfo` provides the cursor persisted for resume.
 */
function buildAllCardsQuery(updatedAfter?: string | null, requestId = ''): string {
  const filter = updatedAfter
    ? `, filter: { field: "updated_at", operator: gt, value: ${JSON.stringify(updatedAfter)} }`
    : '';
  // Unique operation name: the SDK may cache by document/operation name and
  // return a stale snapshot after a card changes in Pipefy.
  const operation = requestId ? `DashboardAllCards_${requestId}` : 'DashboardAllCards';

  return `
    query ${operation}($pipeId: ID!, $first: Int!, $after: String) {
      allCards(pipeId: $pipeId, first: $first, after: $after${filter}) {
        edges {
          node {
            id
            title
            createdAt
            updated_at
            due_date
            done
            current_phase { id name }
            assignees { id name }
            labels { name }
            fields { name value }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Isolates the unknown `p.query` response shape: { data }, { errors }, or a
 * direct payload. GraphQL errors become exceptions for the sync layer.
 */
export function unwrap<T>(response: unknown): T {
  if (response && typeof response === 'object') {
    const envelope = response as QueryEnvelope<T>;
    if (envelope.errors?.length) {
      throw new Error(envelope.errors.map((error) => error.message).join('; '));
    }
    if ('data' in envelope) {
      return envelope.data as T;
    }
  }

  return response as T;
}

/** `null` tells loadAll/syncIncremental that pagination is finished. */
export function toNextCursor(pageInfo: PageInfo): string | null {
  if (!pageInfo.hasNextPage || !pageInfo.endCursor) {
    return null;
  }

  return pageInfo.endCursor;
}

/** Runs the operation up to four times with exponential backoff. */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_DELAYS_MS.length) {
        break;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

/** One page already converted to the format expected by the sync layer. */
export type PageResult = {
  cards: PipefyCard[];
  nextCursor: string | null;
};

/**
 * Fetches one page. `after` controls pagination; `updatedAfter` enables the
 * incremental filter. Normalization happens later, keeping this layer API-only.
 */
export async function fetchPage(
  p: PipefyAppInstance,
  pipeId: string,
  after: string | null,
  updatedAfter?: string | null,
): Promise<PageResult> {
  const variables: Record<string, string | number> = { pipeId, first: PAGE_SIZE };
  if (after) {
    variables.after = after;
  }

  const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const query = buildAllCardsQuery(updatedAfter, requestId);

  const data = await withRetry(async () => {
    const result = await p.query<unknown>(query, variables);
    return unwrap<AllCardsData>(result);
  });

  if (!data.allCards) {
    throw new Error('allCards não veio na resposta');
  }

  return {
    cards: data.allCards.edges.map((edge) => edge.node),
    nextCursor: toNextCursor(data.allCards.pageInfo),
  };
}

/**
 * Fetches the card count for the progress bar only. Pagination ends by cursor,
 * not by this estimate.
 */
export async function fetchCardsCount(
  p: PipefyAppInstance,
  pipeId: string,
): Promise<{ total: number }> {
  const query = `query DashboardPipeCount($pipeId: ID!) {
    pipe(id: $pipeId) {
      cards_count
    }
  }`;

  const data = await withRetry(async () => {
    const result = await p.query<unknown>(query, { pipeId });
    return unwrap<PipeData>(result);
  });

  return { total: data.pipe?.cards_count ?? 0 };
}
