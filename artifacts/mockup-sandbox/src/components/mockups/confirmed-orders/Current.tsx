import './_group.css';

const rows = [
  ['gilmariofreitas387@gmail.com', 'Camp Freitas', 'R$ 2,70', '15/10/2026', ''],
  ['mailsonoliveira26062010@gmail.com', 'Modo Liga', 'R$ 3,00', '15/10/2026', ''],
  ['mailsonoliveira26062010@gmail.com', '1 Token XTreino', 'R$ 1,00', '15/10/2026', ''],
  ['kauebarreto994@gmail.com', 'YQfpKya2K7vJwSrlr9yR', 'R$ 3,00', '15/10/2026', ''],
];

export function Current() {
  return (
    <main className="confirmed-preview">
      <section className="confirmed-panel">
        <header className="confirmed-header">
          <div>
            <h1 className="confirmed-title">Pedidos Confirmados</h1>
            <p className="confirmed-subtitle">Os títulos das colunas não correspondem aos dados exibidos.</p>
          </div>
          <span className="confirmed-counter">664 pedidos</span>
        </header>
        <div className="confirmed-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="confirmed-table" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Time</th>
                <th>Email</th>
                <th>Item</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0] + row[1]}>
                  {row.map((value, index) => <td key={index}>{value || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="confirmed-pagination">
          <button className="is-active">1</button><button>2</button><button>3</button><button>»</button>
        </div>
      </section>
    </main>
  );
}
