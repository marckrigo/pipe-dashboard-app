import { Card, PipefyCard } from '../types/types';

/**
 * Maps a raw Pipefy card to the `Card` model used by the app and stored in the cache.
 * Dates become timestamps so incremental sync can compare `updatedAt` numerically, and
 * `fields` becomes a name -> value map: scanning an array on every render is slower
 * than a direct lookup.
 */
export function normalize(card: PipefyCard): Card {
  const fields = Object.fromEntries(card.fields.map(({ name, value }) => [name, value]));

  return {
    // Keep the ID as a string so the composite [pipeId+cardId] key stays the same across loads.
    id: String(card.id),
    title: card.title,
    createdAt: Date.parse(card.createdAt),
    updatedAt: Date.parse(card.updated_at),
    dueDate: card.due_date ? Date.parse(card.due_date) : null,
    done: card.done,
    phaseId: card.current_phase?.id ?? null,
    phase: card.current_phase?.name ?? 'Sem fase',
    assigneeIds: card.assignees.map(({ id }) => id),
    // Names are kept so charts can group and filter by assignee.
    assigneeNames: card.assignees.map(({ name }) => name),
    labels: card.labels.map(({ name }) => name),
    fields,
  };
}

/** Parses a pipe text field as a number; invalid values become `null` so numeric filters can skip them. */
export function toNumber(value: string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Parses dd/mm/yyyy dates from pipe fields, validating the calendar day since this format is ambiguous. */
export function parseBrDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parts = value.split('/');
  if (
    parts.length !== 3 ||
    parts[0].length !== 2 ||
    parts[1].length !== 2 ||
    parts[2].length !== 4
  ) {
    return null;
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCDate() !== day ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCFullYear() !== year
  ) {
    return null;
  }

  return timestamp;
}
