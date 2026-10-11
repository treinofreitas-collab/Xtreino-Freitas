// ====== SISTEMA DE CLASSIFICAÇÃO — CAMPEONATO SEMANAL ======
// Requer: window.firebaseDb (inicializado pelo admin)
// Requer: window.showToast (do admin.js)

(function () {
  'use strict';

  // ── Constantes ──────────────────────────────────────────────────────────
  const LBFF_DEFAULT = { 1:12, 2:9, 3:7, 4:5, 5:4, 6:3, 7:2, 8:1, 9:0, 10:0, 11:0, 12:0 };

  const FASES = [
    { hora: '19h', label: 'Semifinal A', classificam: 4 },
    { hora: '20h', label: 'Semifinal B', classificam: 4 },
    { hora: '21h', label: 'Semifinal C', classificam: 4 },
    { hora: '22h', label: 'Final',       classificam: null },
  ];

  const HORAS_SEMI = ['19h', '20h', '21h'];

  let _config = null;

  // ── Utilitários ─────────────────────────────────────────────────────────
  function hoje() {
    return new Date().toISOString().slice(0, 10);
  }

  function docId(data, hora) {
    return `semanal-freitas_${data}_${hora}`;
  }

  function calcPontos(pos, kills, tabela, pontoPorAbate) {
    const pontoPos = (tabela[pos] !== undefined ? tabela[pos] : tabela[String(pos)]) ?? 0;
    return Number(pontoPos) + (Number(kills) * Number(pontoPorAbate));
  }

  function ordenarEquipes(equipes) {
    return [...equipes].sort((a, b) => {
      // 1º Maior total de pontos
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      // 2º Critério — BOOYAH em qualquer queda
      const booyahB = (b.q1booyah || b.q2booyah) ? 1 : 0;
      const booyahA = (a.q1booyah || a.q2booyah) ? 1 : 0;
      if (booyahB !== booyahA) return booyahB - booyahA;
      // 3º Critério — Melhor colocação individual
      const melhorA = Math.min(a.q1pos || 99, a.q2pos || 99);
      const melhorB = Math.min(b.q1pos || 99, b.q2pos || 99);
      if (melhorA !== melhorB) return melhorA - melhorB;
      // 4º Critério — Melhor colocação na última queda
      return (a.q2pos || 99) - (b.q2pos || 99);
    });
  }

  // ── Config LBFF ──────────────────────────────────────────────────────────
  async function carregarConfig() {
    if (!window.firebaseDb) {
      _config = { tabela: LBFF_DEFAULT, pontoPorAbate: 1, bannerBase64: null };
      return _config;
    }
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    try {
      const snap = await getDoc(doc(window.firebaseDb, 'championship_config', 'semanal_lbff'));
      _config = snap.exists() ? snap.data() : { tabela: { ...LBFF_DEFAULT }, pontoPorAbate: 1, bannerBase64: null };
    } catch (_) {
      _config = { tabela: { ...LBFF_DEFAULT }, pontoPorAbate: 1, bannerBase64: null };
    }
    return _config;
  }

  async function salvarConfig(cfg) {
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    await setDoc(doc(window.firebaseDb, 'championship_config', 'semanal_lbff'), {
      ...cfg,
      updatedAt: serverTimestamp()
    });
    _config = cfg;
  }

  // ── Resultados — Firestore ────────────────────────────────────────────────
  async function carregarInscritosHora(data, hora) {
    const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const horaNum = parseInt(hora);
    const q = query(
      collection(window.firebaseDb, 'registrations'),
      where('eventType', 'in', ['semanal-freitas', 'semanal']),
      where('status', 'in', ['confirmed', 'paid', 'approved'])
    );
    const snap = await getDocs(q);
    const equipes = [];
    const vistosIds = new Set();
    snap.forEach(d => {
      const r = d.data();
      const rData = (r.date || r.registrationDate || r.eventDate || '').toString().slice(0, 10);
      const rHora = (r.hour || r.schedule || '').toString().replace('h', '').trim();
      const horaOk = rHora === String(horaNum) || rHora === hora || rHora.startsWith(String(horaNum) + ':');
      const dataOk = rData === data;
      if (dataOk && horaOk && !vistosIds.has(d.id)) {
        vistosIds.add(d.id);
        equipes.push({
          nome: r.teamName || r.userName || r.name || r.nickName || 'Equipe',
          registrationId: d.id
        });
      }
    });
    return equipes;
  }

  async function carregarResultado(data, hora) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    try {
      const snap = await getDoc(doc(window.firebaseDb, 'championship_results', docId(data, hora)));
      return snap.exists() ? snap.data() : null;
    } catch (_) { return null; }
  }

  async function salvarResultado(data, hora, equipes, status) {
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const fase = FASES.find(f => f.hora === hora);
    await setDoc(doc(window.firebaseDb, 'championship_results', docId(data, hora)), {
      eventType: 'semanal-freitas',
      date: data,
      hour: hora,
      phase: fase ? fase.label : hora,
      status: status || 'em_apuracao',
      teams: equipes,
      updatedAt: serverTimestamp()
    });
  }

  async function classificarParaFinal(data, equipesSemis) {
    const classificados = [];
    for (const semi of equipesSemis) {
      const top4 = ordenarEquipes(semi.equipes).slice(0, 4);
      top4.forEach(e => {
        classificados.push({
          nome: e.nome,
          registrationId: e.registrationId || '',
          deSemifinal: semi.hora,
          q1pos: 0, q1kills: 0, q1booyah: false,
          q2pos: 0, q2kills: 0, q2booyah: false,
          pontos: 0, abates: 0, classificado: false
        });
      });
    }
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    // Verificar se já existe resultado da final com dados — não sobrescrever
    const finalSnap = await carregarResultado(data, '22h');
    if (finalSnap && finalSnap.status === 'finalizado') return; // final já concluída
    await setDoc(doc(window.firebaseDb, 'championship_results', docId(data, '22h')), {
      eventType: 'semanal-freitas',
      date: data,
      hour: '22h',
      phase: 'Final',
      status: 'aberto',
      teams: classificados,
      updatedAt: serverTimestamp()
    });
  }

  // ── UI — Renderizar tabela de entrada de resultados ──────────────────────
  function _renderizarFormResultado(data, hora, equipes, resultadoExistente) {
    const container = document.getElementById('champResultsForm');
    if (!container) return;
    const tabela = (_config || {}).tabela || LBFF_DEFAULT;
    const pontoPorAbate = (_config || {}).pontoPorAbate ?? 1;
    const isFinal = hora === '22h';

    // Mesclar inscritos com dados já salvos
    let equipesComDados = equipes.map(eq => {
      const ex = (resultadoExistente?.teams || []).find(
        t => t.nome === eq.nome || t.registrationId === eq.registrationId
      );
      return ex ? { ...eq, ...ex } : {
        ...eq, q1pos: '', q1kills: 0, q1booyah: false,
        q2pos: '', q2kills: 0, q2booyah: false, pontos: 0, abates: 0, classificado: false
      };
    });
    // Adicionar equipes do resultado salvo que não estão nas inscrições
    if (resultadoExistente) {
      resultadoExistente.teams.forEach(t => {
        if (!equipesComDados.find(e => e.nome === t.nome)) equipesComDados.push({ ...t });
      });
    }

    container.innerHTML = `
      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-sm min-w-max" id="champTeamsTable">
          <thead>
            <tr class="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
              <th class="text-left py-2 px-2 font-semibold rounded-tl-lg">#</th>
              <th class="text-left py-2 px-2 font-semibold">Equipe</th>
              <th class="text-center py-2 px-2">Pos Q1</th>
              <th class="text-center py-2 px-2">Kills Q1</th>
              <th class="text-center py-2 px-1 text-yellow-600" title="Booyah na Queda 1">🏆 Q1</th>
              <th class="text-center py-2 px-2">Pos Q2</th>
              <th class="text-center py-2 px-2">Kills Q2</th>
              <th class="text-center py-2 px-1 text-yellow-600" title="Booyah na Queda 2">🏆 Q2</th>
              <th class="text-center py-2 px-2 text-orange-600 font-bold">Pts</th>
              <th class="text-center py-2 px-2 text-gray-500">Abates</th>
              ${!isFinal ? '<th class="text-center py-2 px-2 rounded-tr-lg">Class.</th>' : '<th class="text-center py-2 px-2 rounded-tr-lg">Pos.</th>'}
            </tr>
          </thead>
          <tbody id="champTeamRows">
            ${equipesComDados.map((eq, i) => `
              <tr class="border-b border-gray-50 champ-team-row hover:bg-orange-50 transition-colors"
                  data-idx="${i}" data-nome="${(eq.nome || '').replace(/"/g,'&quot;')}" data-regid="${eq.registrationId || ''}">
                <td class="py-2 px-2 text-xs text-gray-400 font-mono champ-rank">${i + 1}</td>
                <td class="py-2 px-2 font-medium text-gray-800 text-xs whitespace-nowrap">
                  ${eq.deSemifinal ? `<span class="text-xs text-gray-400 mr-1">[${eq.deSemifinal}]</span>` : ''}
                  ${eq.nome}
                </td>
                <td class="py-1 px-1 text-center">
                  <input type="number" min="1" max="12" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input focus:border-orange-400 focus:outline-none" data-field="q1pos" value="${eq.q1pos || ''}">
                </td>
                <td class="py-1 px-1 text-center">
                  <input type="number" min="0" max="99" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input focus:border-orange-400 focus:outline-none" data-field="q1kills" value="${eq.q1kills || 0}">
                </td>
                <td class="py-1 px-1 text-center">
                  <input type="checkbox" class="champ-booyah w-4 h-4 accent-orange-500 cursor-pointer" data-field="q1booyah" ${eq.q1booyah ? 'checked' : ''} title="Booyah Q1">
                </td>
                <td class="py-1 px-1 text-center">
                  <input type="number" min="1" max="12" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input focus:border-orange-400 focus:outline-none" data-field="q2pos" value="${eq.q2pos || ''}">
                </td>
                <td class="py-1 px-1 text-center">
                  <input type="number" min="0" max="99" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input focus:border-orange-400 focus:outline-none" data-field="q2kills" value="${eq.q2kills || 0}">
                </td>
                <td class="py-1 px-1 text-center">
                  <input type="checkbox" class="champ-booyah w-4 h-4 accent-orange-500 cursor-pointer" data-field="q2booyah" ${eq.q2booyah ? 'checked' : ''} title="Booyah Q2">
                </td>
                <td class="py-1 px-1 text-center font-bold text-orange-600 champ-pts" data-idx="${i}">${eq.pontos || 0}</td>
                <td class="py-1 px-1 text-center text-gray-500 champ-abates" data-idx="${i}">${eq.abates || 0}</td>
                <td class="py-1 px-1 text-center champ-classified" data-idx="${i}">${!isFinal ? (eq.classificado ? '<span class="text-green-600 font-bold">🟢</span>' : '<span class="text-gray-300">—</span>') : _trofeu(i)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        <button onclick="window.champRecalcular(true)" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-blue-700 transition-colors">
          <i class="fas fa-calculator"></i> Recalcular
        </button>
        <button onclick="window.champSalvar()" class="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-orange-700 transition-colors">
          <i class="fas fa-save"></i> Salvar Resultado
        </button>
        ${!isFinal ? `
        <button onclick="window.champSalvarEClassificar()" class="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-green-700 transition-colors">
          <i class="fas fa-check-double"></i> Finalizar & Classificar Top 4
        </button>
        ` : `
        <button onclick="window.champFinalizarFinal()" class="px-4 py-2 bg-yellow-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-yellow-700 transition-colors">
          <i class="fas fa-trophy"></i> Finalizar Campeonato
        </button>
        `}
        <button onclick="window.champExportar('png')" class="px-3 py-2 bg-gray-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-gray-700 transition-colors">
          <i class="fas fa-image"></i> PNG
        </button>
      </div>
    `;

    // Re-calcular pontos ao digitar
    container.querySelectorAll('.champ-input, .champ-booyah').forEach(el => {
      el.addEventListener('input', () => window.champRecalcular(false));
      el.addEventListener('change', () => window.champRecalcular(false));
    });
  }

  function _trofeu(i) {
    if (i === 0) return '🏆';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `<span class="text-gray-400 text-xs">${i + 1}º</span>`;
  }

  function _coletarDadosDaTabela() {
    const rows = document.querySelectorAll('.champ-team-row');
    const tabela = (_config || {}).tabela || LBFF_DEFAULT;
    const pontoPorAbate = (_config || {}).pontoPorAbate ?? 1;
    const equipes = [];
    rows.forEach(row => {
      const get = (f) => row.querySelector(`[data-field="${f}"]`);
      const q1pos   = parseInt(get('q1pos')?.value)  || 0;
      const q1kills = parseInt(get('q1kills')?.value) || 0;
      const q1booyah = get('q1booyah')?.checked || false;
      const q2pos   = parseInt(get('q2pos')?.value)  || 0;
      const q2kills = parseInt(get('q2kills')?.value) || 0;
      const q2booyah = get('q2booyah')?.checked || false;
      const pts1 = q1pos > 0 ? calcPontos(q1pos, q1kills, tabela, pontoPorAbate) : 0;
      const pts2 = q2pos > 0 ? calcPontos(q2pos, q2kills, tabela, pontoPorAbate) : 0;
      const pontos = pts1 + pts2;
      const abates = q1kills + q2kills;
      equipes.push({
        nome: row.dataset.nome,
        registrationId: row.dataset.regid || '',
        deSemifinal: row.dataset.desemi || '',
        q1pos, q1kills, q1booyah,
        q2pos, q2kills, q2booyah,
        pontos, abates, classificado: false
      });
    });
    return equipes;
  }

  // ── API Pública ──────────────────────────────────────────────────────────

  window.champRecalcular = function (reordenar) {
    const equipes = _coletarDadosDaTabela();
    const hora = document.getElementById('champHoraSelect')?.value;
    const isFinal = hora === '22h';

    // Atualizar células de pontos/abates
    document.querySelectorAll('.champ-team-row').forEach((row, i) => {
      const eq = equipes[i];
      if (!eq) return;
      const ptsEl   = document.querySelector(`.champ-pts[data-idx="${i}"]`);
      const abatEl  = document.querySelector(`.champ-abates[data-idx="${i}"]`);
      if (ptsEl)  ptsEl.textContent  = eq.pontos;
      if (abatEl) abatEl.textContent = eq.abates;
    });

    if (!reordenar) return;

    // Re-ordenar linhas
    const ordenadas = ordenarEquipes(equipes);
    const tbody = document.getElementById('champTeamRows');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('.champ-team-row'));
    ordenadas.forEach(eq => {
      const row = rows.find(r => r.dataset.nome === eq.nome);
      if (row) tbody.appendChild(row);
    });

    // Atualizar números de posição e classificado
    const limite = isFinal ? null : 4;
    Array.from(tbody.querySelectorAll('.champ-team-row')).forEach((row, rank) => {
      const rankEl = row.querySelector('.champ-rank');
      if (rankEl) rankEl.textContent = rank + 1;
      const classCell = row.querySelector('.champ-classified');
      if (!classCell) return;
      if (isFinal) {
        classCell.innerHTML = _trofeu(rank);
      } else {
        classCell.innerHTML = rank < limite
          ? '<span class="text-green-600 font-bold">🟢</span>'
          : '<span class="text-gray-300">—</span>';
      }
    });
  };

  window.champSalvar = async function (status) {
    const data = document.getElementById('champDataInput')?.value;
    const hora = document.getElementById('champHoraSelect')?.value;
    if (!data || !hora) { showToast('error', 'Selecione data e fase.'); return; }
    const equipes = _coletarDadosDaTabela();
    const ordenadas = ordenarEquipes(equipes);
    try {
      await salvarResultado(data, hora, ordenadas, status || 'em_apuracao');
      showToast('success', 'Resultado salvo!');
    } catch (e) {
      showToast('error', 'Erro ao salvar: ' + e.message);
    }
  };

  window.champSalvarEClassificar = async function () {
    const data = document.getElementById('champDataInput')?.value;
    const hora = document.getElementById('champHoraSelect')?.value;
    if (!data || !hora || hora === '22h') {
      showToast('warning', 'Selecione uma semifinal (19h, 20h ou 21h).');
      return;
    }
    const equipes = _coletarDadosDaTabela();
    const ordenadas = ordenarEquipes(equipes);
    const top4  = ordenadas.slice(0, 4).map(e => ({ ...e, classificado: true }));
    const resto = ordenadas.slice(4).map(e => ({ ...e, classificado: false }));
    const todas = [...top4, ...resto];
    try {
      await salvarResultado(data, hora, todas, 'finalizado');
      // Verificar se todas as semis estão finalizadas
      const resultados = await Promise.all(HORAS_SEMI.map(h => carregarResultado(data, h)));
      const todasFinalizadas = resultados.every(r => r && r.status === 'finalizado');
      if (todasFinalizadas) {
        const equipesSemis = HORAS_SEMI.map((h, i) => ({ hora: h, equipes: resultados[i].teams }));
        await classificarParaFinal(data, equipesSemis);
        showToast('success', 'Todas as 3 semis concluídas! Final montada automaticamente 🏆', null, 7000);
      } else {
        const faltam = HORAS_SEMI.filter((h, i) => !(resultados[i] && resultados[i].status === 'finalizado'));
        showToast('success', `Semifinal ${hora} finalizada! Faltam: ${faltam.join(', ')}`);
      }
      setTimeout(() => window.champCarregarFase(), 600);
    } catch (e) {
      showToast('error', 'Erro: ' + e.message);
    }
  };

  window.champFinalizarFinal = async function () {
    const data = document.getElementById('champDataInput')?.value;
    const hora = document.getElementById('champHoraSelect')?.value;
    if (!data || hora !== '22h') { showToast('warning', 'Selecione a fase Final (22h).'); return; }
    const equipes = _coletarDadosDaTabela();
    const ordenadas = ordenarEquipes(equipes).map((e, i) => ({ ...e, classificado: i === 0 }));
    try {
      await salvarResultado(data, hora, ordenadas, 'finalizado');
      showToast('success', `🏆 Campeão: ${ordenadas[0]?.nome}! Campeonato finalizado.`, null, 8000);
      setTimeout(() => window.champCarregarFase(), 600);
    } catch (e) {
      showToast('error', 'Erro: ' + e.message);
    }
  };

  window.champCarregarFase = async function () {
    const data = document.getElementById('champDataInput')?.value;
    const hora = document.getElementById('champHoraSelect')?.value;
    const statusEl = document.getElementById('champStatusLabel');
    const formWrapper = document.getElementById('champResultsForm');
    if (!data || !hora) return;
    if (formWrapper) formWrapper.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin text-xl"></i></div>';
    if (statusEl) statusEl.textContent = '';
    try {
      if (!_config) await carregarConfig();
      const [inscritosBrutos, resultadoExistente] = await Promise.all([
        carregarInscritosHora(data, hora),
        carregarResultado(data, hora)
      ]);
      if (statusEl && resultadoExistente) {
        const statusMap = { aberto: '🟡 Aguardando resultados', em_apuracao: '🟠 Em apuração', finalizado: '✅ Finalizado' };
        statusEl.textContent = statusMap[resultadoExistente.status] || resultadoExistente.status;
      }
      const isFinal = hora === '22h';
      let equipes;
      if (isFinal && resultadoExistente?.teams?.length) {
        equipes = resultadoExistente.teams.map(t => ({ nome: t.nome, registrationId: t.registrationId || '', deSemifinal: t.deSemifinal || '' }));
      } else if (inscritosBrutos.length > 0) {
        equipes = inscritosBrutos;
      } else if (resultadoExistente?.teams?.length) {
        equipes = resultadoExistente.teams.map(t => ({ nome: t.nome, registrationId: t.registrationId || '' }));
      } else {
        equipes = [];
      }
      if (equipes.length === 0 && !isFinal) {
        if (formWrapper) formWrapper.innerHTML = `
          <div class="text-center py-10">
            <i class="fas fa-exclamation-triangle text-yellow-500 text-2xl mb-3 block"></i>
            <p class="text-gray-600 font-medium">Nenhum inscrito confirmado nesta data/horário.</p>
            <p class="text-gray-400 text-sm mt-1">Verifique a data e o horário selecionados, ou aguarde as inscrições serem confirmadas.</p>
          </div>`;
        return;
      }
      _renderizarFormResultado(data, hora, equipes, resultadoExistente);
    } catch (e) {
      if (formWrapper) formWrapper.innerHTML = `<div class="text-red-500 text-sm py-4 text-center"><i class="fas fa-times-circle mr-1"></i>Erro: ${e.message}</div>`;
    }
  };

  window.champAdicionarEquipe = function () {
    const tbody = document.getElementById('champTeamRows');
    if (!tbody) return;
    const idx = tbody.querySelectorAll('.champ-team-row').length;
    const nome = prompt('Nome da equipe:');
    if (!nome) return;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-50 champ-team-row hover:bg-orange-50 transition-colors';
    tr.dataset.idx = idx;
    tr.dataset.nome = nome;
    tr.dataset.regid = '';
    tr.innerHTML = `
      <td class="py-2 px-2 text-xs text-gray-400 font-mono champ-rank">${idx + 1}</td>
      <td class="py-2 px-2 font-medium text-gray-800 text-xs">${nome}</td>
      <td class="py-1 px-1 text-center"><input type="number" min="1" max="12" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input" data-field="q1pos" value=""></td>
      <td class="py-1 px-1 text-center"><input type="number" min="0" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input" data-field="q1kills" value="0"></td>
      <td class="py-1 px-1 text-center"><input type="checkbox" class="champ-booyah w-4 h-4 accent-orange-500" data-field="q1booyah"></td>
      <td class="py-1 px-1 text-center"><input type="number" min="1" max="12" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input" data-field="q2pos" value=""></td>
      <td class="py-1 px-1 text-center"><input type="number" min="0" class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs champ-input" data-field="q2kills" value="0"></td>
      <td class="py-1 px-1 text-center"><input type="checkbox" class="champ-booyah w-4 h-4 accent-orange-500" data-field="q2booyah"></td>
      <td class="py-1 px-1 text-center font-bold text-orange-600 champ-pts" data-idx="${idx}">0</td>
      <td class="py-1 px-1 text-center text-gray-500 champ-abates" data-idx="${idx}">0</td>
      <td class="py-1 px-1 text-center champ-classified" data-idx="${idx}">—</td>
    `;
    tbody.appendChild(tr);
    tr.querySelectorAll('.champ-input, .champ-booyah').forEach(el => {
      el.addEventListener('input',  () => window.champRecalcular(false));
      el.addEventListener('change', () => window.champRecalcular(false));
    });
  };

  // ── Exportação ────────────────────────────────────────────────────────────
  window.champExportar = async function (formato) {
    const data = document.getElementById('champDataInput')?.value || hoje();
    const hora = document.getElementById('champHoraSelect')?.value || '19h';
    const faseFmt = FASES.find(f => f.hora === hora)?.label || hora;
    const equipes = _coletarDadosDaTabela();
    const ordenadas = ordenarEquipes(equipes);
    const isFinal = hora === '22h';
    // Fonte e background
    const bgSrc = _config?.bannerBase64 || '/assets/tabela-semanal.jpg';
    const exportEl = document.getElementById('champExportCanvas');
    if (!exportEl) { showToast('error', 'Elemento de exportação não encontrado.'); return; }

    // ── Exportação direta via Canvas 2D ───────────────────────────────────────
    // A imagem tabela-semanal.jpg já possui toda a estrutura visual (slots 01-12,
    // colunas B! A! P!). Apenas sobrepõe os dados nas posições corretas.
    try {
      showToast('info', 'Gerando exportação...', null, 3000);

      // Tamanho nativo da imagem template: 1080 × 1080
      const W = 1080, H = 1080;

      // Posições dos slots dentro da imagem (calibrado para 1080x1080)
      // Linha 1 (coroa/1º) topo: 305px; cada linha tem ~56px de altura
      const ROW_TOP_0 = 305;
      const ROW_H    = 56;
      // Colunas X
      const COL_NOME_X  = 235;   // esquerda — nome da equipe
      const COL_NOME_W  = 370;   // largura máxima do nome
      const COL_B_CX    = 647;   // centro — B! (booyahs totais)
      const COL_A_CX    = 762;   // centro — A! (abates)
      const COL_P_CX    = 882;   // centro — P! (pontos)

      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // 1. Desenhar imagem de fundo
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { ctx.drawImage(img, 0, 0, W, H); resolve(); };
        img.onerror = reject;
        img.src = bgSrc;
      });

      // 2. Sobrepor dados das equipes (máx 12 linhas)
      const MAX_LINHAS = 12;
      ordenadas.slice(0, MAX_LINHAS).forEach((e, i) => {
        const rowCY = ROW_TOP_0 + (i * ROW_H) + Math.round(ROW_H / 2) + 3; // centro vertical
        const booyahs = (e.q1booyah ? 1 : 0) + (e.q2booyah ? 1 : 0);
        const nome = (e.nome || '').toUpperCase();

        // Sombra de texto para legibilidade
        ctx.shadowColor   = 'rgba(0,0,0,0.85)';
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur    = 3;

        // Nome da equipe — tamanho adaptativo
        const fontSize = nome.length > 16 ? 18 : nome.length > 12 ? 20 : 23;
        ctx.font      = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // Truncar se necessário
        let nomeRender = nome;
        while (ctx.measureText(nomeRender).width > COL_NOME_W && nomeRender.length > 2) {
          nomeRender = nomeRender.slice(0, -1);
        }
        if (nomeRender !== nome) nomeRender = nomeRender.slice(0, -1) + '…';
        ctx.fillText(nomeRender, COL_NOME_X, rowCY);

        // B! — booyahs
        ctx.font      = '900 22px "Arial Black", Arial, sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.textAlign = 'center';
        ctx.fillText(booyahs > 0 ? String(booyahs) : '0', COL_B_CX, rowCY);

        // A! — abates
        ctx.fillText(String(e.abates || 0), COL_A_CX, rowCY);

        // P! — pontos
        ctx.fillStyle = '#f97316';
        ctx.fillText(String(e.pontos || 0), COL_P_CX, rowCY);

        // Linha classificada (top 4 na semi): destaque sutil
        if (!isFinal && i < 4) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(34,197,94,0.6)';
          ctx.lineWidth   = 3;
          ctx.strokeRect(COL_NOME_X - 4, ROW_TOP_0 + (i * ROW_H) + 2, COL_P_CX + 60, ROW_H - 4);
        }
      });

      // 3. Remover sombra e assinar
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      const dataFmt = data.split('-').reverse().join('/');
      ctx.font      = 'bold 20px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${faseFmt}  •  ${dataFmt}`, W / 2, H - 28);

      // 4. Download
      const link = document.createElement('a');
      link.download = `resultado_${data}_${hora}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('success', 'PNG exportado com sucesso!');
    } catch (e) {
      showToast('error', 'Erro na exportação: ' + e.message);
    }
  };

  // ── Configurações ─────────────────────────────────────────────────────────
  window.champRenderizarConfig = async function () {
    const container = document.getElementById('champConfigContent');
    if (!container) return;
    if (!_config) await carregarConfig();
    const tabela = _config.tabela || LBFF_DEFAULT;
    const posLabels = ['1º','2º','3º','4º','5º','6º','7º','8º','9º','10º','11º','12º'];
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Banner -->
        <div class="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h4 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm">
            <span class="w-6 h-6 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center text-xs"><i class="fas fa-image"></i></span>
            Banner da Tabela
          </h4>
          ${_config.bannerBase64 ? `
            <img src="${_config.bannerBase64}" class="w-full max-h-52 object-cover rounded-xl mb-4 border border-gray-200">
            <div class="flex gap-2 flex-wrap">
              <label class="cursor-pointer px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors border border-blue-200 flex items-center gap-2">
                <i class="fas fa-sync-alt"></i> Trocar Banner
                <input type="file" id="champBannerInput" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="window.champPreviewBanner(this)">
              </label>
              <button onclick="window.champRemoverBanner()" class="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200 flex items-center gap-2">
                <i class="fas fa-trash"></i> Remover
              </button>
            </div>
          ` : `
            <div id="champBannerPreviewWrap" class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-orange-400 transition-colors">
              <i class="fas fa-cloud-upload-alt text-3xl text-gray-300 mb-3 block"></i>
              <p class="text-sm text-gray-500 mb-4">PNG, JPG ou WEBP — máx. 800KB recomendado</p>
              <label class="cursor-pointer px-5 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition-colors flex items-center gap-2 justify-center w-fit mx-auto">
                <i class="fas fa-upload"></i> Selecionar Banner
                <input type="file" id="champBannerInput" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="window.champPreviewBanner(this)">
              </label>
            </div>
            <div id="champBannerPreview" class="hidden mt-3"></div>
          `}
        </div>

        <!-- Tabela de Pontos -->
        <div class="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h4 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm">
            <span class="w-6 h-6 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center text-xs"><i class="fas fa-trophy"></i></span>
            Tabela LBFF — Pontos por Colocação
          </h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-5">
            ${posLabels.map((label, i) => `
              <div class="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-200 shadow-sm">
                <span class="text-xs font-bold text-gray-600 w-7 shrink-0">${label}</span>
                <input type="number" id="champPos${i+1}" min="0" max="50" value="${tabela[i+1] ?? LBFF_DEFAULT[i+1] ?? 0}"
                  class="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:border-orange-400 focus:outline-none">
              </div>
            `).join('')}
          </div>
          <!-- Kill Points -->
          <div class="flex items-center gap-4 bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm">
            <i class="fas fa-crosshairs text-orange-500"></i>
            <span class="text-sm font-medium text-gray-700">Pontos por Abate:</span>
            <input type="number" id="champKillPts" min="0" max="10" step="0.5" value="${_config.pontoPorAbate ?? 1}"
              class="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:border-orange-400 focus:outline-none">
          </div>
        </div>

        <!-- Botão Salvar -->
        <button onclick="window.champSalvarConfig()" class="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-save"></i> Salvar Configurações
        </button>

        <!-- Preview dos padrões LBFF -->
        <details class="bg-blue-50 rounded-xl border border-blue-200">
          <summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-blue-700 flex items-center gap-2">
            <i class="fas fa-info-circle"></i> Ver tabela LBFF padrão
          </summary>
          <div class="px-4 pb-4 text-xs text-blue-800 space-y-1">
            <p>1º=12 · 2º=9 · 3º=7 · 4º=5 · 5º=4 · 6º=3 · 7º=2 · 8º=1 · 9º-12º=0 · +1 por abate</p>
            <button onclick="window.champRestaurarLBFF()" class="mt-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
              Restaurar padrão LBFF
            </button>
          </div>
        </details>
      </div>
    `;
  };

  window.champPreviewBanner = function (input) {
    if (!input.files?.length) return;
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById('champBannerPreview');
      const wrap    = document.getElementById('champBannerPreviewWrap');
      if (preview) {
        preview.innerHTML = `<img src="${e.target.result}" class="w-full max-h-40 object-cover rounded-xl border border-gray-200">
          <p class="text-xs text-gray-500 mt-1 text-center">Banner selecionado — clique em "Salvar" para confirmar</p>`;
        preview.classList.remove('hidden');
        if (wrap) wrap.classList.add('hidden');
      }
    };
    reader.readAsDataURL(input.files[0]);
  };

  window.champRestaurarLBFF = function () {
    for (let i = 1; i <= 12; i++) {
      const el = document.getElementById(`champPos${i}`);
      if (el) el.value = LBFF_DEFAULT[i] ?? 0;
    }
    const killEl = document.getElementById('champKillPts');
    if (killEl) killEl.value = 1;
    showToast('info', 'Valores LBFF padrão restaurados. Clique em Salvar para confirmar.');
  };

  window.champSalvarConfig = async function () {
    const pontoPorAbate = parseFloat(document.getElementById('champKillPts')?.value) || 1;
    const tabela = {};
    for (let i = 1; i <= 12; i++) {
      tabela[i] = parseInt(document.getElementById(`champPos${i}`)?.value) ?? 0;
    }
    const bannerInput = document.getElementById('champBannerInput');
    let bannerBase64 = _config?.bannerBase64 || null;
    if (bannerInput?.files?.length > 0) {
      try {
        bannerBase64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = e => res(e.target.result);
          reader.onerror = rej;
          reader.readAsDataURL(bannerInput.files[0]);
        });
      } catch (_) { showToast('warning', 'Erro ao ler imagem, banner não alterado.'); }
    }
    const cfg = { tabela, pontoPorAbate, bannerBase64 };
    try {
      await salvarConfig(cfg);
      showToast('success', 'Configurações salvas com sucesso!');
      window.champRenderizarConfig();
    } catch (e) {
      showToast('error', 'Erro ao salvar: ' + e.message);
    }
  };

  window.champRemoverBanner = async function () {
    if (!_config) return;
    _config.bannerBase64 = null;
    try {
      await salvarConfig(_config);
      showToast('success', 'Banner removido.');
      window.champRenderizarConfig();
    } catch (e) {
      showToast('error', 'Erro: ' + e.message);
    }
  };

  // ── Inicializadores chamados pelo adminNav ───────────────────────────────
  window.initChampionship = async function () {
    if (!_config) await carregarConfig();
    const dataInput = document.getElementById('champDataInput');
    if (dataInput && !dataInput.value) dataInput.value = hoje();
    ['champDataInput', 'champHoraSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._champBound) {
        el.addEventListener('change', window.champCarregarFase);
        el._champBound = true;
      }
    });
    // Carregar automaticamente ao abrir a seção
    await window.champCarregarFase();
  };

  window.initChampConfig = async function () {
    await window.champRenderizarConfig();
  };

})();
