import { useMemo, useState } from 'react';
import { Phone, Search } from 'lucide-react';
import './_group.css';

const orders = [
  { id: '1', name: '', phone: '+55 11 90000-0001', email: 'cliente1@example.test', item: 'Camp Freitas', team: 'Camp Freitas', amount: 2.7, date: '15/10/2026', time: '18:40' },
  { id: '2', name: 'Mailson Oliveira', phone: '', email: 'cliente2@example.test', item: 'Modo Liga', team: 'Squad Freitas', amount: 3, date: '15/10/2026', time: '18:32' },
  { id: '3', name: 'Mailson Oliveira', phone: '+55 11 90000-0003', email: 'cliente3@example.test', item: '1 Token XTreino', team: '', amount: 1, date: '15/10/2026', time: '17:58' },
  { id: '4', name: 'Kaue Barreto', phone: '', email: 'cliente4@example.test', item: 'Campeonato Season 7', team: 'YQfpKya2K7vJwSrlr9yR', amount: 3, date: '15/10/2026', time: '17:46' },
];

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Improved() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return query ? orders.filter((order) =>
      [order.name, order.email, order.item, order.team].some((value) => value.toLocaleLowerCase('pt-BR').includes(query))
    ) : orders;
  }, [search]);

  return (
    <main className="confirmed-preview">
      <section className="confirmed-panel" aria-labelledby="confirmed-title">
        <header className="confirmed-header">
          <div>
            <h1 id="confirmed-title" className="confirmed-title">Pedidos confirmados</h1>
            <p className="confirmed-subtitle">Pagamentos aprovados, com os dados do cliente e da compra separados.</p>
          </div>
          <span className="confirmed-counter">664 pedidos</span>
        </header>
        <div className="confirmed-toolbar">
          <label className="relative flex w-full max-w-[340px] items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              className="confirmed-search pl-9"
              aria-label="Pesquisar pedidos confirmados"
              placeholder="Buscar cliente, e-mail ou evento"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span className="confirmed-page-note">Mostrando {filtered.length} resultados nesta busca</span>
        </div>
        <div className="confirmed-table-wrap">
          <table className="confirmed-table">
            <thead>
              <tr>
                <th>Cliente</th><th>Contato</th><th>Produto / evento</th><th>Valor</th><th>Data da compra</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td data-label="Cliente">
                    <span className={`confirmed-primary ${order.name ? '' : 'confirmed-empty-name'}`}>
                      {order.name || 'Nome não informado'}
                    </span>
                  </td>
                  <td data-label="Contato">
                    {order.phone ? (
                      <>
                        <span className="confirmed-phone"><Phone size={13} aria-hidden="true" />{order.phone}</span>
                        {order.email && <span className="confirmed-secondary">E-mail: {order.email}</span>}
                      </>
                    ) : order.email ? (
                      <>
                        <span className="confirmed-primary">{order.email}</span>
                        <span className="confirmed-secondary confirmed-contact-fallback">E-mail alternativo · sem celular informado</span>
                      </>
                    ) : (
                      <span className="confirmed-secondary">Contato não informado</span>
                    )}
                  </td>
                  <td data-label="Produto / evento">
                    <span className="confirmed-primary">{order.item}</span>
                    {order.team && <span className="confirmed-secondary">Time: {order.team}</span>}
                  </td>
                  <td data-label="Valor" className="confirmed-amount">{brl(order.amount)}</td>
                  <td data-label="Data da compra" className="confirmed-date">
                    <span className="confirmed-primary">{order.date}</span>
                    <span className="confirmed-secondary">{order.time}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="confirmed-pagination" aria-label="Paginação dos pedidos">
          <button aria-label="Página anterior">‹</button>
          <button className="is-active" aria-current="page">1</button>
          <button>2</button><button>3</button><button aria-label="Próxima página">›</button>
        </div>
      </section>
    </main>
  );
}
