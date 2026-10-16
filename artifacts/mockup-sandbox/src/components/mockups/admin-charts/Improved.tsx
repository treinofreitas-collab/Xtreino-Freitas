import { useEffect, useMemo, useRef, useState } from 'react';
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

const hours = ['15h', '18h', '19h', '20h', '21h', '22h', '23h'];
const products = [
  { name: 'XTreino Modo Liga', revenue: 1220, quantity: 24 },
  { name: 'XTreino Freitas', revenue: 810, quantity: 18 },
  { name: 'Sensibilidade Freitas', revenue: 360, quantity: 11 },
  { name: 'Planilhas de Análise', revenue: 220, quantity: 7 },
  { name: 'Semanal Freitas', revenue: 175, quantity: 5 },
];

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function useChartJs() {
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && Boolean(window.Chart));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (window.Chart) {
      setReady(true);
      setFailed(false);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-admin-chartjs]');
    if (attempt > 0 && existing) existing.remove();
    const script = attempt > 0 || !existing ? document.createElement('script') : existing;
    const markReady = () => {
      setReady(Boolean(window.Chart));
      setFailed(!window.Chart);
    };

    setReady(false);
    setFailed(false);
    if (script !== existing || !existing) {
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.async = true;
      script.dataset.adminChartjs = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', markReady);
    script.addEventListener('error', () => setFailed(true));
    return () => script.removeEventListener('load', markReady);
  }, [attempt]);

  return { ready, failed, retry: () => setAttempt((current) => current + 1) };
}

function getHoursForFilters(day: string, event: string) {
  if (day === 'friday' && event === 'modo-liga') return [1, 3, 11, 13, 7, 3, 6];
  if (day === 'friday' && event === 'treino-freitas') return [2, 5, 8, 10, 6, 4, 5];
  return [2, 4, 9, 10, 7, 4, 6];
}

function ChartFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl bg-[#f5f8f7] px-5 text-center">
      <span className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8c9692]">Gráfico indisponível</span>
      <p className="mb-4 max-w-xs text-sm text-[#65716c]">Não foi possível carregar a visualização agora.</p>
      <button onClick={onRetry} className="rounded-lg border border-[#cdd8d2] bg-white px-4 py-2 text-sm font-semibold text-[#244d42] transition hover:bg-[#f3f7f4]">
        Tentar novamente
      </button>
    </div>
  );
}

export function Improved() {
  const { ready, failed, retry } = useChartJs();
  const hoursCanvas = useRef<HTMLCanvasElement>(null);
  const hoursChart = useRef<ChartInstance | null>(null);
  const [day, setDay] = useState('friday');
  const [event, setEvent] = useState('modo-liga');
  const hourValues = useMemo(() => getHoursForFilters(day, event), [day, event]);
  const maxRevenue = products[0].revenue;

  useEffect(() => {
    if (!ready || !window.Chart || !hoursCanvas.current) return;
    const context = hoursCanvas.current.getContext('2d');
    if (!context) return;

    hoursChart.current?.destroy();
    hoursChart.current = new window.Chart(context, {
      type: 'bar',
      data: {
        labels: hours,
        datasets: [{
          label: 'Reservas confirmadas',
          data: hourValues,
          backgroundColor: hourValues.map((value) => value === Math.max(...hourValues) ? '#d66c3c' : '#3d7664'),
          borderRadius: 7,
          borderSkipped: false,
          maxBarThickness: 42,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: '#18382f',
            titleColor: '#d5e4dd',
            bodyColor: '#fff',
            padding: 12,
            callbacks: {
              label: (context: { parsed: { y: number } }) => `${context.parsed.y} reservas confirmadas`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 14,
            ticks: { stepSize: 2, color: '#89948e', font: { size: 11 }, padding: 8 },
            grid: { color: '#e8eeea' },
            border: { display: false },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#67736d', font: { size: 11, weight: '600' }, padding: 8 },
            border: { display: false },
          },
        },
      },
    });

    return () => {
      hoursChart.current?.destroy();
      hoursChart.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!hoursChart.current) return;
    hoursChart.current.data.labels = hours;
    hoursChart.current.data.datasets[0].data = hourValues;
    hoursChart.current.update();
  }, [hourValues, ready]);

  const resetFilters = () => {
    setDay('');
    setEvent('');
  };

  return (
    <main className="admin-charts-preview min-h-[100dvh] px-4 py-6 sm:px-7 sm:py-8" style={{ background: '#f1f5f1', color: '#20352d', fontFamily: "'DM Sans', 'Avenir Next', sans-serif" }}>
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#668075]">XTREINO FREITAS · OPERAÇÃO</p>
            <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.04em] text-[#1c352c] sm:text-[30px]">Visão de reservas e vendas</h1>
            <p className="mt-1.5 text-sm text-[#738079]">Acompanhe os horários procurados e os produtos por faturamento.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d9e4dc] bg-[#e8f0e9] px-3 py-2 text-[11px] font-semibold text-[#587267]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d66c3c]" />
            Prévia · dados ilustrativos
          </span>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="min-w-0 rounded-[18px] border border-[#dfe8e1] bg-[#fffefa] p-4 shadow-[0_5px_18px_rgba(38,68,54,0.045)] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-[3px] w-5 rounded-full bg-[#d66c3c]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a16a4f]">Procura</span>
                </div>
                <h2 className="text-[17px] font-bold tracking-[-0.025em] text-[#20372e]">Horários mais procurados</h2>
                <p className="mt-1 text-xs text-[#7e8982]">Reservas confirmadas por horário</p>
              </div>
              <button onClick={resetFilters} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#47715f] transition hover:bg-[#edf3ee] hover:text-[#254b3b]">
                Limpar filtros
              </button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-semibold text-[#66746c]">
                Dia da semana
                <select value={day} onChange={(change) => setDay(change.target.value)} className="mt-1.5 w-full appearance-none rounded-[10px] border border-[#dce5de] bg-[#f8faf7] px-3 py-2.5 text-[13px] font-semibold text-[#33483d] outline-none transition focus:border-[#648c79] focus:ring-2 focus:ring-[#648c79]/15">
                  <option value="">Todos os dias</option>
                  <option value="friday">Sexta-feira</option>
                </select>
              </label>
              <label className="text-[11px] font-semibold text-[#66746c]">
                Evento
                <select value={event} onChange={(change) => setEvent(change.target.value)} className="mt-1.5 w-full appearance-none rounded-[10px] border border-[#dce5de] bg-[#f8faf7] px-3 py-2.5 text-[13px] font-semibold text-[#33483d] outline-none transition focus:border-[#648c79] focus:ring-2 focus:ring-[#648c79]/15">
                  <option value="">Todos os eventos</option>
                  <option value="modo-liga">XTreino Modo Liga</option>
                  <option value="treino-freitas">XTreino Freitas</option>
                </select>
              </label>
            </div>

            <div className="mb-2 flex items-center justify-between border-t border-[#edf0ec] pt-4">
              <span className="text-[11px] font-semibold text-[#748078]">Reservas confirmadas</span>
              <span className="rounded-md bg-[#edf3ee] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#668075]">Por horário</span>
            </div>
            <div className="relative h-[230px] sm:h-[270px]">
              {failed ? <ChartFailure onRetry={retry} /> : ready ? <canvas ref={hoursCanvas} aria-label="Reservas confirmadas por horário" role="img" /> : (
                <div className="flex h-full flex-col justify-end gap-3 px-3 pb-8 pt-5" aria-label="Carregando gráfico">
                  <div className="h-full animate-pulse rounded-xl bg-[#f0f4ef]" />
                  <div className="h-2 w-2/3 animate-pulse rounded bg-[#e5ece6]" />
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-[18px] border border-[#dfe8e1] bg-[#fffefa] p-4 shadow-[0_5px_18px_rgba(38,68,54,0.045)] sm:p-6">
            <div className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-[3px] w-5 rounded-full bg-[#3d7664]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#668075]">Faturamento</span>
              </div>
              <h2 className="text-[17px] font-bold tracking-[-0.025em] text-[#20372e]">Top produtos</h2>
              <p className="mt-1 text-xs text-[#7e8982]">Classificados pelo faturamento no período</p>
            </div>

            <div className="mb-3 flex items-center justify-between border-b border-[#edf0ec] pb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#89938d]">
              <span>Produto</span>
              <span className="pr-0.5">Faturamento</span>
            </div>
            <ol className="space-y-[18px]">
              {products.map((product, index) => {
                const width = `${(product.revenue / maxRevenue) * 100}%`;
                return (
                  <li key={product.name} className="min-w-0">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold ${index === 0 ? 'bg-[#f7e8df] text-[#a25230]' : 'bg-[#edf2ee] text-[#748078]'}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 text-[12px] font-semibold leading-[1.35] text-[#34473d] sm:text-[13px]">{product.name}</span>
                      </div>
                      <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#20372e] sm:text-[13px]">{currency(product.revenue)}</span>
                    </div>
                    <div className="ml-[30px] h-[9px] overflow-hidden rounded-full bg-[#edf1ed]">
                      <div className={`h-full rounded-full transition-[width] duration-500 ${index === 0 ? 'bg-[#d66c3c]' : 'bg-[#4d826f]'}`} style={{ width }} />
                    </div>
                    <p className="ml-[30px] mt-1.5 text-[10px] font-medium text-[#89938d]">{product.quantity} {product.quantity === 1 ? 'venda' : 'vendas'}</p>
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 border-t border-[#edf0ec] pt-3 text-[10px] leading-relaxed text-[#939b95]">
              Valores apresentados em reais · prévia com dados ilustrativos
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
