import { useEffect, useRef, useState } from 'react';
import './_group.css';

type ChartInstance = {
  data: { labels?: string[]; datasets: Array<{ data: number[] }> };
  destroy: () => void;
  update: () => void;
};

type ChartConstructor = new (
  context: CanvasRenderingContext2D,
  config: Record<string, unknown>,
) => ChartInstance;

declare global {
  interface Window {
    Chart?: ChartConstructor;
  }
}

const hoursFridayLiga = {
  labels: ['15h', '18h', '19h', '20h', '21h', '22h', '23h'],
  values: [1, 3, 11, 13, 7, 3, 6],
};

const products = [
  { name: 'XTreino Modo Liga', revenue: 1220, quantity: 24 },
  { name: 'XTreino Freitas', revenue: 810, quantity: 18 },
  { name: 'Sensibilidade Freitas', revenue: 360, quantity: 11 },
  { name: 'Planilhas de Análise', revenue: 220, quantity: 7 },
  { name: 'Semanal Freitas', revenue: 175, quantity: 5 },
];

function useChartJs() {
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && Boolean(window.Chart));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (window.Chart) {
      setReady(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-admin-chartjs]');
    const script = existing ?? document.createElement('script');
    const markReady = () => setReady(Boolean(window.Chart));
    const markFailed = () => setFailed(true);

    if (!existing) {
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.async = true;
      script.dataset.adminChartjs = 'true';
      document.head.appendChild(script);
    }

    script.addEventListener('load', markReady);
    script.addEventListener('error', markFailed);
    return () => {
      script.removeEventListener('load', markReady);
      script.removeEventListener('error', markFailed);
    };
  }, []);

  return { ready, failed };
}

function getHoursForFilters(day: string, event: string) {
  if (day === 'friday' && event === 'modo-liga') return hoursFridayLiga;
  if (day === 'friday' && event === 'treino-freitas') {
    return { labels: ['15h', '18h', '19h', '20h', '21h', '22h', '23h'], values: [2, 5, 8, 10, 6, 4, 5] };
  }
  return { labels: ['15h', '18h', '19h', '20h', '21h', '22h', '23h'], values: [2, 4, 9, 10, 7, 4, 6] };
}

export function Current() {
  const { ready, failed } = useChartJs();
  const hoursCanvas = useRef<HTMLCanvasElement>(null);
  const productsCanvas = useRef<HTMLCanvasElement>(null);
  const hoursChart = useRef<ChartInstance | null>(null);
  const productsChart = useRef<ChartInstance | null>(null);
  const [day, setDay] = useState('friday');
  const [event, setEvent] = useState('modo-liga');

  useEffect(() => {
    if (!ready || !window.Chart || !hoursCanvas.current || !productsCanvas.current) return;

    const hoursContext = hoursCanvas.current.getContext('2d');
    const productsContext = productsCanvas.current.getContext('2d');
    if (!hoursContext || !productsContext) return;

    hoursChart.current?.destroy();
    productsChart.current?.destroy();
    hoursChart.current = new window.Chart(hoursContext, {
      type: 'bar',
      data: {
        labels: hoursFridayLiga.labels,
        datasets: [{
          label: 'Demanda',
          data: hoursFridayLiga.values,
          backgroundColor: '#4a90e2',
          borderColor: '#357abd',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: { parsed: { y: number } }) => `Demanda: ${context.parsed.y} reservas`,
            },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
          x: { ticks: { maxRotation: 45, font: { size: 10 } } },
        },
      },
    });

    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    productsChart.current = new window.Chart(productsContext, {
      type: 'bar',
      data: {
        labels: products.map((product) => product.name.length > 18 ? `${product.name.slice(0, 16)}…` : product.name),
        datasets: [{
          label: 'Faturamento (R$)',
          data: products.map((product) => product.revenue),
          backgroundColor: colors.map((color) => `${color}cc`),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: { dataIndex: number }) => {
                const product = products[context.dataIndex];
                return [`R$ ${product.revenue.toFixed(2).replace('.', ',')}`, `${product.quantity} vendas`];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.15)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: (value: number) => `R$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)}`,
            },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#374151', font: { size: 11, weight: '600' } },
          },
        },
      },
    });

    return () => {
      hoursChart.current?.destroy();
      productsChart.current?.destroy();
      hoursChart.current = null;
      productsChart.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!hoursChart.current) return;
    const next = getHoursForFilters(day, event);
    hoursChart.current.data.labels = next.labels;
    hoursChart.current.data.datasets[0].data = next.values;
    hoursChart.current.update();
  }, [day, event, ready]);

  return (
    <main className="admin-charts-preview p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-slate-900">Painel administrativo</h1>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600">Prévia · dados ilustrativos</span>
        </div>

        <div className="admin-charts-grid">
          <section className="admin-chart-card p-4">
            <header className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Horários mais procurados</h2>
                <p className="mt-1 text-xs text-slate-500">Reservas confirmadas por horário</p>
              </div>
              <button className="shrink-0 text-xs font-semibold text-blue-600">Limpar filtros</button>
            </header>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <label className="text-[11px] font-medium text-slate-600">
                Dia da semana
                <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800" value={day} onChange={(event) => setDay(event.target.value)}>
                  <option value="">Todos os dias</option>
                  <option value="friday">Sexta-feira</option>
                </select>
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Evento
                <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800" value={event} onChange={(event) => setEvent(event.target.value)}>
                  <option value="">Todos os eventos</option>
                  <option value="modo-liga">XTreino Modo Liga</option>
                  <option value="treino-freitas">XTreino Freitas</option>
                </select>
              </label>
            </div>
            <div className="admin-chart-canvas">
              {failed ? <p className="py-12 text-center text-xs text-slate-500">O gráfico não carregou.</p> : <canvas ref={hoursCanvas} aria-label="Reservas confirmadas por horário" role="img" />}
            </div>
          </section>

          <section className="admin-chart-card p-4">
            <header className="mb-3">
              <h2 className="text-sm font-bold text-slate-900">Top produtos</h2>
              <p className="mt-1 text-xs text-slate-500">Classificados pelo faturamento no período</p>
            </header>
            <div className="admin-chart-canvas--short">
              {failed ? <p className="py-12 text-center text-xs text-slate-500">O gráfico não carregou.</p> : <canvas ref={productsCanvas} aria-label="Faturamento dos cinco produtos mais vendidos" role="img" />}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
