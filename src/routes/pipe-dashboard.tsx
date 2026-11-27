import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardChart } from '../components/dashboard-chart';
import {
  aggregate,
  applyFilters,
  listFields,
  OPERATORS_BY_KIND,
  type CardFilter,
  type ChartRow,
  type ChartType,
  type FilterJoin,
  type FilterOperator,
} from '../helpers/chart-data';
import { useCardsSync } from '../hooks/use-cards-sync';
import { usePipefyApp } from '../hooks/use-pipefy-app';
import '../styles/landing-page.css';
import '../styles/pipe-dashboard.css';

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Linha' },
  { value: 'area', label: 'Área' },
  { value: 'pie', label: 'Pizza' },
];

const JOINS: { value: FilterJoin; label: string }[] = [
  { value: 'and', label: 'E' },
  { value: 'or', label: 'OU' },
];

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'Contém' },
  { value: 'equals', label: 'Igual a' },
  { value: 'notEquals', label: 'Diferente de' },
  { value: 'gt', label: 'Maior que' },
  { value: 'lt', label: 'Menor que' },
  { value: 'isEmpty', label: 'Está vazio' },
  { value: 'isNotEmpty', label: 'Não está vazio' },
];

const PIE_LIMIT = 20;

export function PipeDashboard() {
  const { pipefyApp, pipefyAppInstance, userId, pipeId, ready } = usePipefyApp();
  const { cards, status, loaded, total, error } = useCardsSync();

  // TODO: replace manual sync with event-driven invalidation (webhook) or cache-busting polling;
  // until then this depends on Pipefy's eventual consistency.

  // Start with no selection so no chart is drawn before the user picks a type and axis.
  const [view, setView] = useState<{ type: ChartType | ''; dimension: string }>({
    type: '',
    dimension: '',
  });
  // Draft filters are kept apart so editing a row cannot change the chart until Apply is clicked.
  const [filters, setFilters] = useState<CardFilter[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<CardFilter[]>([]);
  const hasPendingFilters = JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  const [data, setData] = useState<ChartRow[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [chartLoading, setChartLoading] = useState(false);
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);

  const fields = useMemo(() => listFields(cards), [cards]);

  function operatorsFor(field: string): FilterOperator[] {
    return OPERATORS_BY_KIND[fields.find((option) => option.value === field)?.kind ?? 'text'];
  }

  const selectedType: ChartType | null = view.type === '' ? null : view.type;
  const hasView = selectedType !== null && view.dimension !== '';

  /**
   * The loader is switched on in the event handler (before render) and cleared here only after
   * the chart has mounted with the new data. Two frames before the aggregation keep the UI from
   * freezing before the spinner appears.
   */
  useEffect(() => {
    let cancelled = false;
    const frames: number[] = [];
    const schedule = (callback: FrameRequestCallback) => {
      frames.push(window.requestAnimationFrame(callback));
    };

    if (!hasView) {
      setData([]);
      setChartLoading(false);
      return;
    }

    setChartLoading(true);
    schedule(() => {
      if (cancelled) {
        return;
      }
      schedule(() => {
        if (cancelled) {
          return;
        }
        const visible = applyFilters(cards, appliedFilters, fields);
        setData(aggregate(visible, view.dimension));
        setFilteredCount(visible.length);
        schedule(() => {
          if (!cancelled) {
            setChartLoading(false);
          }
        });
      });
    });

    return () => {
      cancelled = true;
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
    };
  }, [appliedFilters, cards, fields, hasView, selectedType, view.dimension]);

  // Pie charts with dozens of slices become unreadable, so the type is disabled past this limit.
  const pieBlocked = data.length > PIE_LIMIT;
  const pieUnavailable = selectedType === 'pie' && pieBlocked;
  const chartWidth = Math.max(data.length * 48, 320);

  // Measure the container so the scroll hint appears only when horizontal overflow really exists.
  useEffect(() => {
    const element = chartBodyRef.current;
    if (!element) {
      setHasHorizontalScroll(false);
      return;
    }

    const measure = () => setHasHorizontalScroll(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [chartWidth, selectedType, data]);

  useEffect(() => {
    if (pipefyApp && pipefyAppInstance) {
      /**
       * Pipefy's main application requires that Pipe Views call this method when the page load is complete
       * before rendering the tab where your application will be shown.
       * Without this, you'll be redirected to the Kanban main view.
       */
      pipefyApp.render(() => {});
    }
  }, [pipefyApp, pipefyAppInstance]);

  // Hide the chart while loading: partial data could lead to wrong conclusions.
  const isLoading = status === 'idle' || status === 'loading';

  function beginChartLoad() {
    setChartLoading(true);
  }

  function applyFiltersToChart() {
    beginChartLoad();
    setAppliedFilters(filters.map((filter) => ({ ...filter })));
  }

  function addFilter() {
    setFilters((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        field: fields[0]?.value ?? 'phase',
        operator: 'contains',
        value: '',
        join: 'and',
      },
    ]);
  }

  function changeFilter(id: string, patch: Partial<CardFilter>) {
    setFilters((current) =>
      current.map((filter) => {
        if (filter.id !== id) {
          return filter;
        }

        const next = { ...filter, ...patch };
        const allowed = operatorsFor(next.field);
        return allowed.includes(next.operator) ? next : { ...next, operator: allowed[0] };
      }),
    );
  }

  if (ready && !pipefyAppInstance) {
    return (
      <main className="landing-page">
        <section className="landing-note">
          <strong>Dashboard indisponível fora do Pipefy</strong>
          <p>
            Abra este aplicativo dentro de um pipe no Pipefy e selecione a aba Dashboard. A leitura
            dos cards depende da sessão e da API disponíveis no ambiente do Pipefy.
          </p>
        </section>
      </main>
    );
  }

  if (ready && pipefyAppInstance && (!userId || !pipeId)) {
    return (
      <main className="landing-page">
        <section className="landing-note">
          <strong>Não foi possível identificar o contexto</strong>
          <p>O cache é separado por usuário e pipe. Abra o dashboard novamente dentro do Pipefy.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="pipe-dashboard-content">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
      </header>

      {isLoading ? (
        <div className="chart-loader" role="status" aria-live="polite">
          <div className="loader-spinner" aria-hidden="true" />
          <strong>Preparando os gráficos...</strong>
          <progress value={total > 0 ? loaded : undefined} max={total || undefined} />
        </div>
      ) : (
        <>
          {status === 'error' && (
            <div className="sync-error-panel" role="alert">
              {error?.message ?? 'Erro ao atualizar os dados.'}
            </div>
          )}

          <div className="chart-controls">
            <label>
              Tipo de gráfico
              <select
                value={view.type}
                onChange={(event) => {
                  const type = event.target.value as ChartType | '';
                  if (type !== '' && view.dimension !== '') {
                    beginChartLoad();
                  }
                  setView((current) => ({ ...current, type }));
                }}
              >
                <option value="">Selecione...</option>
                {CHART_TYPES.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.value === 'pie' && pieBlocked}
                  >
                    {option.label}
                    {option.value === 'pie' && pieBlocked ? ` (até ${PIE_LIMIT} grupos)` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Agrupar por
              <select
                value={view.dimension}
                onChange={(event) => {
                  const dimension = event.target.value;
                  if (dimension !== '' && view.type !== '') {
                    beginChartLoad();
                  }
                  setView((current) => ({ ...current, dimension }));
                }}
              >
                <option value="">Selecione...</option>
                {fields.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>

            {hasView && (
              <details className="filter-panel">
                <summary>
                  Filtros ({appliedFilters.length})
                  {hasPendingFilters ? ' · alterações pendentes' : ''}
                </summary>
                {filters.length === 0 ? (
                  <small>Nenhum filtro configurado.</small>
                ) : (
                  <div className="filter-list">
                    {filters.map((filter, index) => (
                      <div className="filter-row" key={filter.id}>
                        {index === 0 ? (
                          <span className="filter-join-label">Onde</span>
                        ) : (
                          <select
                            className="filter-join"
                            aria-label="Conector do filtro"
                            value={filter.join}
                            onChange={(event) =>
                              changeFilter(filter.id, {
                                join: event.target.value as FilterJoin,
                              })
                            }
                          >
                            {JOINS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                        <select
                          aria-label="Campo do filtro"
                          value={filter.field}
                          onChange={(event) =>
                            changeFilter(filter.id, { field: event.target.value })
                          }
                        >
                          {fields.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Operador do filtro"
                          value={filter.operator}
                          onChange={(event) =>
                            changeFilter(filter.id, {
                              operator: event.target.value as FilterOperator,
                            })
                          }
                        >
                          {OPERATORS.filter((option) =>
                            operatorsFor(filter.field).includes(option.value),
                          ).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {filter.operator !== 'isEmpty' && filter.operator !== 'isNotEmpty' && (
                          <input
                            aria-label="Valor do filtro"
                            placeholder="Valor"
                            value={filter.value}
                            onChange={(event) =>
                              changeFilter(filter.id, { value: event.target.value })
                            }
                          />
                        )}
                        <button
                          className="icon-button remove-filter"
                          type="button"
                          aria-label="Remover filtro"
                          title="Remover filtro"
                          onClick={() =>
                            setFilters((current) => current.filter((item) => item.id !== filter.id))
                          }
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="filter-actions">
                  <button className="add-filter" type="button" onClick={addFilter}>
                    Adicionar filtro
                  </button>
                  <button
                    className="apply-filters"
                    type="button"
                    onClick={applyFiltersToChart}
                    disabled={!hasPendingFilters}
                  >
                    Aplicar filtros
                  </button>
                </div>
              </details>
            )}
          </div>

          <section className="chart-panel">
            {selectedType === null || view.dimension === '' ? (
              <div className="chart-empty-state" role="status">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20V4M4 20h16" />
                  <path d="M8 20v-6M13 20V8M18 20v-9" />
                </svg>
                <strong>Escolha como visualizar os dados</strong>
                <span>
                  Selecione o tipo de gráfico e o campo para agrupar os cards. A visualização será
                  gerada com os dados do pipe.
                </span>
              </div>
            ) : (
              <>
                <h2>
                  {CHART_TYPES.find((option) => option.value === view.type)?.label} por{' '}
                  {fields.find((field) => field.value === view.dimension)?.label ?? view.dimension}
                </h2>
                {!chartLoading &&
                  (appliedFilters.length > 0 ||
                    (selectedType !== 'pie' && hasHorizontalScroll)) && (
                    <small className="chart-hint">
                      {appliedFilters.length > 0 ? `${filteredCount} de ${cards.length} cards` : ''}
                      {appliedFilters.length > 0 && selectedType !== 'pie' && hasHorizontalScroll
                        ? ' · '
                        : ''}
                      {selectedType !== 'pie' && hasHorizontalScroll
                        ? `${data.length} grupos · role horizontalmente para ver todos`
                        : ''}
                    </small>
                  )}
                {pieUnavailable && !chartLoading ? (
                  <div className="chart-blocked" role="status">
                    <strong>Pizza indisponível com {data.length} grupos.</strong>
                    <span>
                      Acima de {PIE_LIMIT} fatias o gráfico fica ilegível. Escolha barras, linha ou
                      área, ou outro eixo.
                    </span>
                  </div>
                ) : data.length === 0 && !chartLoading ? (
                  <p className="chart-empty">Nenhum card corresponde aos filtros selecionados.</p>
                ) : (
                  <div className="chart-frame">
                    <div className="chart-body" ref={chartBodyRef}>
                      <div
                        className="chart-canvas"
                        style={{ width: view.type === 'pie' ? '100%' : chartWidth }}
                      >
                        <DashboardChart type={selectedType} data={data} />
                      </div>
                    </div>
                    {chartLoading && (
                      <div className="chart-overlay" role="status" aria-live="polite">
                        <div className="loader-spinner" aria-hidden="true" />
                        <span>Montando o gráfico...</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
