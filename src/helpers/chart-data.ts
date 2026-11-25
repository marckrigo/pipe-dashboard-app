import type { Card } from '../types/types';
import { parseBrDate } from './normalize';

export type ChartType = 'bar' | 'line' | 'pie' | 'area';

export type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'list';

export type FieldOption = {
  value: string;
  label: string;
  kind: FieldKind;
};

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'lt'
  | 'isEmpty'
  | 'isNotEmpty';

export const OPERATORS_BY_KIND: Record<FieldKind, FilterOperator[]> = {
  text: ['contains', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  number: ['equals', 'notEquals', 'gt', 'lt', 'isEmpty', 'isNotEmpty'],
  date: ['equals', 'gt', 'lt', 'isEmpty', 'isNotEmpty'],
  boolean: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  list: ['contains', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
};

export type CardFilter = {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
};

export type ChartRow = {
  name: string;
  value: number;
};

const BUILT_IN_FIELDS: FieldOption[] = [
  { value: 'phase', label: 'Fase', kind: 'text' },
  { value: 'assignee', label: 'Responsável', kind: 'list' },
  { value: 'label', label: 'Label', kind: 'list' },
  { value: 'done', label: 'Status', kind: 'boolean' },
  { value: 'createdAt', label: 'Data de criação', kind: 'date' },
  { value: 'updatedAt', label: 'Última atualização', kind: 'date' },
  { value: 'dueDate', label: 'Data limite', kind: 'date' },
  { value: 'title', label: 'Título', kind: 'text' },
  { value: 'id', label: 'ID do card', kind: 'text' },
];

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'dueDate']);
const CUSTOM_PREFIX = 'fields:';
const SAMPLE_LIMIT = 30;

/** Accepts both "1234.56" and "1.234,56" because pipes use mixed number formats; invalid input becomes `null`. */
function parseNumber(value: string): number | null {
  let text = value.trim().replace(/\s/g, '');
  if (text === '') {
    return null;
  }

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma > -1) {
    text = text.replace(',', '.');
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** The custom field type is inferred from at most 30 samples so only meaningful operators are offered. */
function inferKind(values: string[]): FieldKind {
  const samples = values.filter((value) => value.trim() !== '');
  if (samples.length === 0) {
    return 'text';
  }

  if (samples.every((value) => parseNumber(value) !== null)) {
    return 'number';
  }

  if (
    samples.every((value) => {
      const iso = Date.parse(value);
      return !Number.isNaN(iso) || parseBrDate(value) !== null;
    })
  ) {
    return 'date';
  }

  return 'text';
}

function customSamples(cards: Card[], name: string): string[] {
  const samples: string[] = [];
  for (const card of cards) {
    const value = card.fields[name];
    if (value != null && value.trim() !== '') {
      samples.push(value.trim());
    }
    if (samples.length >= SAMPLE_LIMIT) {
      break;
    }
  }
  return samples;
}

/**
 * Available fields come from the cards themselves (native plus pipe-specific) because the pipe
 * schema is not exposed elsewhere; `kind` gives number/date fields their > and < operators.
 */
export function listFields(cards: Card[]): FieldOption[] {
  const names = new Set<string>();
  for (const card of cards) {
    for (const name of Object.keys(card.fields)) {
      if (name.trim() !== '') {
        names.add(name);
      }
    }
  }

  const custom = [...names]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((name) => ({
      value: `${CUSTOM_PREFIX}${name}`,
      label: name,
      kind: inferKind(customSamples(cards, name)),
    }));

  return [...BUILT_IN_FIELDS, ...custom];
}

/** A card may hold several values for one field (labels, assignees), so filters must check all of them. */
export function getFieldValues(card: Card, field: string): string[] {
  if (field.startsWith(CUSTOM_PREFIX)) {
    const value = card.fields[field.slice(CUSTOM_PREFIX.length)];
    return value == null ? [] : [String(value)];
  }

  switch (field) {
    case 'id':
      return [card.id];
    case 'title':
      return [card.title];
    case 'phase':
      return [card.phase];
    case 'phaseId':
      return card.phaseId ? [card.phaseId] : [];
    case 'assignee':
      return card.assigneeNames;
    case 'label':
      return card.labels;
    case 'done':
      return [card.done ? 'Concluído' : 'Aberto'];
    case 'createdAt':
    case 'updatedAt':
    case 'dueDate': {
      const value =
        field === 'createdAt'
          ? card.createdAt
          : field === 'updatedAt'
            ? card.updatedAt
            : card.dueDate;
      return value !== null && Number.isFinite(value) ? [new Date(value).toISOString()] : [];
    }
    default:
      return [];
  }
}

/** Native dates stay ISO in the data and render in pt-BR, so formatting belongs here, not in filters. */
export function formatValue(field: string, value: string): string {
  if (DATE_FIELDS.has(field)) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toLocaleDateString('pt-BR');
    }
  }
  return value;
}

function toNumberComparable(value: string, kind: FieldKind): number | null {
  if (kind === 'number') {
    return parseNumber(value);
  }
  if (kind === 'date') {
    const iso = Date.parse(value);
    return Number.isNaN(iso) ? parseBrDate(value) : iso;
  }
  return null;
}

/** Multiple filters are combined with AND, so a card must satisfy every active filter. */
export function matchesFilter(card: Card, filter: CardFilter, fields: FieldOption[]): boolean {
  const values = getFieldValues(card, filter.field).map((value) => value.trim());
  const target = filter.value.trim().toLowerCase();
  const kind = fields.find((field) => field.value === filter.field)?.kind ?? 'text';

  switch (filter.operator) {
    case 'isEmpty':
      return values.length === 0 || values.every((value) => value === '');
    case 'isNotEmpty':
      return values.some((value) => value !== '');
    case 'contains':
      return values.some((value) => value.toLowerCase().includes(target));
    case 'equals':
    case 'notEquals': {
      const equal = values.some((value) => {
        if (kind === 'number' || kind === 'date') {
          const current = toNumberComparable(value, kind);
          const reference = toNumberComparable(filter.value, kind);
          return current !== null && reference !== null && current === reference;
        }
        return value.toLowerCase() === target;
      });
      return filter.operator === 'equals' ? equal : !equal;
    }
    case 'gt':
    case 'lt': {
      if (kind === 'number' || kind === 'date') {
        const reference = toNumberComparable(filter.value, kind);
        if (reference === null) {
          return false;
        }
        return values.some((value) => {
          const current = toNumberComparable(value, kind);
          return (
            current !== null &&
            (filter.operator === 'gt' ? current > reference : current < reference)
          );
        });
      }
      return values.some((value) =>
        filter.operator === 'gt' ? value.toLowerCase() > target : value.toLowerCase() < target,
      );
    }
    default:
      return true;
  }
}

/** Ignore filters with an empty value (except value-less operators) so untouched rows do not filter everything out. */
export function applyFilters(cards: Card[], filters: CardFilter[], fields: FieldOption[]): Card[] {
  const active = filters.filter(
    (filter) =>
      filter.operator === 'isEmpty' ||
      filter.operator === 'isNotEmpty' ||
      filter.value.trim() !== '',
  );
  if (active.length === 0) {
    return cards;
  }

  return cards.filter((card) => active.every((filter) => matchesFilter(card, filter, fields)));
}

/** Counts cards per axis value without a hard limit; the UI scrolls horizontally for extra groups. */
export function aggregate(cards: Card[], dimension: string): ChartRow[] {
  const groups = new Map<string, number>();

  for (const card of cards) {
    const keys = [
      ...new Set(
        getFieldValues(card, dimension)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const buckets = keys.length > 0 ? keys : ['Sem informação'];

    for (const key of buckets) {
      const name = formatValue(dimension, key);
      groups.set(name, (groups.get(name) ?? 0) + 1);
    }
  }

  return [...groups].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
