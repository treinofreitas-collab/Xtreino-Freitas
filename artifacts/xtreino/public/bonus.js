// bonus.js — Vaga Bônus (Org Freitas)
// Permite que jogadores se inscrevam via link exclusivo gerado pelo admin.

const _FS_URL = 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
const _AUTH_URL = 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

const _LABELS_EVENTO = {
    'xtreino-tokens': 'XTreino Freitas',
    'modo-liga': 'XTreino Modo Liga',
    'semanal-freitas': 'Semanal Freitas',
    'semanal': 'Semanal Freitas',
    'camp-freitas': 'Campeonato Freitas'
};

let _bonusLink = null;
let _bonusLinkId = null;
let _usuarioAtual = null;
let _perfilUsuario = null;
let _bonusLinkBlocked = null;    // { titulo, mensagem } quando o prazo/vagas estão esgotados
let _credPollingInterval = null; // polling automático para detectar credenciais enviadas pelo admin

// Utilitário: retorna número do slot somente se for sequencial (não timestamp)
function _slotNum(slot, slotNumber) {
    const n = Number(slot ?? slotNumber ?? 0);
    return (n > 0 && n <= 9999) ? n : null;
}

// ── Inicialização ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    document.body.style.visibility = 'visible';

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
        _mostrarErro('Link inválido', 'Nenhum código de vaga bônus encontrado na URL.');
        return;
    }

    await _aguardarFirebase();
    await _carregarBonusLink(code);

    if (!_bonusLink) return; // erro já exibido

    const { onAuthStateChanged } = await import(_AUTH_URL);
    onAuthStateChanged(window.firebaseAuth, async (user) => {
        _usuarioAtual = user;
        if (user) {
            await _carregarPerfilUsuario(user.uid);
        }
        _renderizarParticipacao();
    });
});

// ── Firebase: aguardar inicialização ──────────────────────────────────────────

function _aguardarFirebase() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.firebaseDb && window.firebaseAuth) return resolve();
            setTimeout(check, 100);
        };
        check();
    });
}

// ── Carregar dados do link bônus ──────────────────────────────────────────────

async function _carregarBonusLink(code) {
    try {
        const { collection, query, where, getDocs } = await import(_FS_URL);
        const q = query(
            collection(window.firebaseDb, 'bonus_links'),
            where('code', '==', code.toUpperCase())
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            _mostrarErro('Link não encontrado', 'Este link de vaga bônus não existe ou foi removido.');
            return;
        }

        const docSnap = snap.docs[0];
        _bonusLink = { id: docSnap.id, ...docSnap.data() };
        _bonusLinkId = docSnap.id;

        // Link pausado pelo admin: erro imediato (decisão explícita da organização)
        if (_bonusLink.status === 'pausado') {
            _mostrarErro('Link pausado', 'Este link de vaga bônus está temporariamente pausado pela organização.');
            return;
        }

        // Vagas esgotadas ou prazo vencido: guardar motivo, mas NÃO mostrar erro ainda.
        // O check de inscrição existente em _renderizarParticipacao decidirá o que exibir.
        if (_bonusLink.status === 'expirado' || (_bonusLink.usedCount || 0) >= (_bonusLink.quantity || 0)) {
            _bonusLinkBlocked = { titulo: 'Vagas esgotadas', mensagem: 'Todas as vagas bônus disponíveis já foram preenchidas.' };
        }
        if (_bonusLink.expiresAt && new Date(_bonusLink.expiresAt) < new Date()) {
            _bonusLinkBlocked = { titulo: 'Prazo encerrado', mensagem: 'O período de inscrição para esta vaga bônus já encerrou.' };
        }

        _renderizarInfoBonus();

    } catch (err) {
        console.error('[Bonus] Erro ao carregar link:', err);
        _mostrarErro('Erro ao carregar', 'Não foi possível carregar os dados. Tente novamente em instantes.');
    }
}

// ── Renderizar informações do evento ──────────────────────────────────────────

function _renderizarInfoBonus() {
    const vagasRestantes = (_bonusLink.quantity || 0) - (_bonusLink.usedCount || 0);
    // Prioridade: nome salvo no documento (vem do adminEvents) > mapa local > ID bruto
    const nomeEvento = _bonusLink.eventName || _LABELS_EVENTO[_bonusLink.eventType] || _bonusLink.eventType;

    document.getElementById('bonusEventName').textContent = nomeEvento;
    document.getElementById('bonusSchedule').textContent = _bonusLink.schedule || '--';
    document.getElementById('bonusVagasRestantes').textContent = vagasRestantes;

    if (_bonusLink.date) {
        const [ano, mes, dia] = _bonusLink.date.split('-');
        document.getElementById('bonusDate').textContent = `${dia}/${mes}/${ano}`;
        document.getElementById('bonusDateRow').classList.remove('hidden');
    }

    if (_bonusLink.expiresAt) {
        const expiry = new Date(_bonusLink.expiresAt);
        document.getElementById('bonusExpiry').textContent = expiry.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        document.getElementById('bonusExpiryRow').classList.remove('hidden');
    }

    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('bonusCard').classList.remove('hidden');

    // Carregar lista de times inscritos de forma assíncrona (não bloqueia renderização)
    _carregarListaSlots();
}

// ── Carregar lista de times inscritos nesta vaga bônus ───────────────────────

async function _carregarListaSlots() {
    const container = document.getElementById('slotsListContainer');
    if (!container || !_bonusLink) return;

    try {
        const { collection, query, where, getDocs } = await import(_FS_URL);
        const allRegs = new Map(); // docId → {data, _origem}

        // 1. Buscar inscrições desta vaga bônus (pelo bonusCode)
        try {
            const snap = await getDocs(query(
                collection(window.firebaseDb, 'registrations'),
                where('bonusCode', '==', _bonusLink.code)
            ));
            snap.forEach(d => allRegs.set(d.id, { ...d.data(), _origem: 'bonus' }));
        } catch (_) {}

        // 2. Buscar TODAS as registrations do eventType + date (regulares + bônus de outros códigos)
        if (_bonusLink.date) {
            try {
                const snap2 = await getDocs(query(
                    collection(window.firebaseDb, 'registrations'),
                    where('eventType', '==', _bonusLink.eventType),
                    where('date', '==', _bonusLink.date)
                ));
                snap2.forEach(d => {
                    if (allRegs.has(d.id)) return; // já incluído como bônus
                    const r = d.data();
                    // Filtrar pelo mesmo horário (comparação pelo número da hora)
                    const linkH = String(_bonusLink.schedule || '').match(/(\d+)/)?.[1] || '';
                    const regH  = String(r.schedule || r.hour || '').match(/(\d+)/)?.[1] || '';
                    if (!linkH || linkH === regH) {
                        allRegs.set(d.id, { ...r, _origem: 'regular' });
                    }
                });
            } catch (_) {}
        }

        if (allRegs.size === 0) return;

        // Filtrar status inválidos — pending não conta como time inscrito
        const _validStatus = new Set(['paid', 'confirmed', 'approved']);
        for (const [id, r] of allRegs) {
            if (!_validStatus.has(r.status)) allRegs.delete(id);
        }

        if (allRegs.size === 0) return;

        // Ordenar por tempo de chegada (createdAt) — quem chegou primeiro fica na posição mais baixa,
        // independente de ser regular ou bônus. Fallback: slotNumber quando createdAt ausente.
        const slots = [...allRegs.values()].sort((a, b) => {
            const ta = a.createdAt?.seconds ?? null;
            const tb = b.createdAt?.seconds ?? null;
            if (ta !== null && tb !== null) return ta - tb;
            // fallback para slotNumber quando createdAt não disponível
            const na = _slotNum(a.slot, a.slotNumber) ?? 9999;
            const nb = _slotNum(b.slot, b.slotNumber) ?? 9999;
            return na - nb;
        });

        const regulares = slots.filter(s => s._origem === 'regular').length;
        const bonus     = slots.filter(s => s._origem === 'bonus').length;
        // Usar initialOffset gravado no link (fixo no momento da criação).
        // Fallback para o count atual só se o campo ainda não existe (links antigos).
        const _initOffset = typeof _bonusLink.initialOffset === 'number' ? _bonusLink.initialOffset : regulares;
        const totalCap  = (_bonusLink.quantity || 0) + _initOffset;

        container.innerHTML = `
            <div class="mt-4 bg-gray-800 border border-gray-700 rounded-2xl p-4">
                <h3 class="text-sm font-bold text-gray-300 mb-1 flex items-center gap-2">
                    🎮 Times Inscritos
                    <span class="bg-orange-600 text-white text-xs font-black px-2 py-0.5 rounded-full">${slots.length} / ${totalCap}</span>
                </h3>
                ${regulares > 0 ? `<p class="text-xs text-gray-500 mb-3">${regulares} regular${regulares > 1 ? 'es' : ''} + ${bonus} bônus</p>` : ''}
                <div class="space-y-2">
                    ${(() => {
                        const _evTLista = String(_bonusLink?.eventType || '').toLowerCase();
                        const _isLigaLista = _evTLista === 'modo-liga' || _evTLista.includes('liga') || _evTLista.includes('modo');
                        return slots.map((s, idx) => {
                            const num = _slotNum(s.slot, s.slotNumber);
                            const isBon = s._origem === 'bonus';
                            // Modo Liga: letra pela posição (A, B, C...) — demais: #posição sequencial
                            const slotLabel = _isLigaLista
                                ? String.fromCharCode(65 + idx)
                                : `#${idx + 1}`;
                            return `
                            <div class="flex items-center gap-3 bg-gray-700/50 rounded-xl px-3 py-2.5">
                                ${s.teamLogoThumb
                                    ? `<img src="${_esc(s.teamLogoThumb)}" class="w-9 h-9 rounded-lg object-cover border border-gray-600 flex-shrink-0">`
                                    : `<div class="w-9 h-9 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0"><i class="fas fa-gamepad text-gray-400 text-sm"></i></div>`
                                }
                                <div class="flex-1 min-w-0">
                                    <div class="text-white font-bold text-sm truncate">${_esc(s.teamName || '—')}</div>
                                    ${isBon ? '<div class="text-xs text-orange-400">vaga bônus</div>' : '<div class="text-xs text-gray-500">vaga regular</div>'}
                                </div>
                                <span class="text-xs font-bold bg-gray-800 border rounded-lg px-2 py-1 flex-shrink-0 ${isBon ? 'text-orange-400 border-orange-500/30' : 'text-gray-400 border-gray-600'}">
                                    ${slotLabel}
                                </span>
                            </div>`;
                        }).join('');
                    })()}
                </div>
            </div>
        `;
        // Corrigir vagas restantes: totalCap - todos inscritos (regular + bônus)
        // _renderizarInfoBonus() mostra valor provisório; aqui atualizamos com o real.
        const elVagas = document.getElementById('bonusVagasRestantes');
        if (elVagas) elVagas.textContent = Math.max(0, totalCap - slots.length);

    } catch (err) {
        console.error('[Bonus] Erro ao carregar lista de slots:', err);
    }
}

// ── Carregar perfil do usuário no Firestore ───────────────────────────────────

async function _carregarPerfilUsuario(uid) {
    try {
        const { doc, getDoc } = await import(_FS_URL);
        const snap = await getDoc(doc(window.firebaseDb, 'users', uid));
        if (snap.exists()) {
            _perfilUsuario = snap.data();
        }
    } catch (err) {
        console.warn('[Bonus] Erro ao carregar perfil:', err);
    }
}

// ── Renderizar área de participação ───────────────────────────────────────────

async function _renderizarParticipacao() {
    const container = document.getElementById('participacaoContainer');
    if (!container || !_bonusLink) return;

    if (!_usuarioAtual) {
        // Sem login: se bloqueado, indica que podem entrar para ver sua inscrição
        const msg = _bonusLinkBlocked
            ? 'Se você já está inscrito nesta vaga, faça login para ver sua inscrição e as credenciais da sala.'
            : 'Faça login para participar desta vaga bônus';
        container.innerHTML = `
            <p class="text-gray-400 text-sm text-center mb-3">${msg}</p>
            <a href="/" class="block w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl text-center transition-colors btn-participar">
                <i class="fas fa-sign-in-alt mr-2"></i>Entrar / Cadastrar
            </a>
        `;
        return;
    }

    // Logado: verificar se já está inscrito antes de qualquer coisa
    await _verificarInscricaoExistente();
}

// ── Verificar inscrição existente ─────────────────────────────────────────────

async function _verificarInscricaoExistente() {
    const container = document.getElementById('participacaoContainer');
    if (!container) return;

    container.innerHTML = `<div class="text-center text-gray-400 text-sm py-3"><i class="fas fa-circle-notch fa-spin mr-2"></i>Verificando sua inscrição...</div>`;

    try {
        const { collection, query, where, getDocs } = await import(_FS_URL);

        // 1ª tentativa: buscar pelo bonusCode (mais preciso)
        let regDoc = null;
        try {
            const snap = await getDocs(query(
                collection(window.firebaseDb, 'registrations'),
                where('userId', '==', _usuarioAtual.uid),
                where('bonusCode', '==', _bonusLink.code)
            ));
            if (!snap.empty) regDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (_) {}

        // 2ª tentativa: buscar por userId + eventType + date (fallback)
        if (!regDoc) {
            try {
                const snap2 = await getDocs(query(
                    collection(window.firebaseDb, 'registrations'),
                    where('userId', '==', _usuarioAtual.uid),
                    where('eventType', '==', _bonusLink.eventType),
                    where('date', '==', _bonusLink.date)
                ));
                snap2.forEach(d => {
                    const r = d.data();
                    if (!regDoc && r.schedule === _bonusLink.schedule) regDoc = { id: d.id, ...r };
                });
            } catch (_) {}
        }

        if (regDoc) {
            // Usuário inscrito → buscar credenciais e mostrar card
            const notif = await _buscarCredenciais();
            _renderizarInscricaoExistente(regDoc, notif);
        } else if (_bonusLinkBlocked) {
            // Não inscrito e link bloqueado → mostrar motivo
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="text-4xl mb-3">⏰</div>
                    <p class="text-red-400 font-bold">${_bonusLinkBlocked.titulo}</p>
                    <p class="text-gray-400 text-sm mt-2">${_bonusLinkBlocked.mensagem}</p>
                </div>`;
        } else {
            // Não inscrito e link aberto → mostrar formulário
            _renderizarFormulario();
        }
    } catch (err) {
        console.error('[Bonus] Erro ao verificar inscrição:', err);
        if (_bonusLinkBlocked) {
            container.innerHTML = `<div class="text-center py-4"><p class="text-red-400 text-sm">${_bonusLinkBlocked.mensagem}</p></div>`;
        } else {
            _renderizarFormulario();
        }
    }
}

// ── Buscar credenciais de sala nas notificações ───────────────────────────────

async function _buscarCredenciais() {
    try {
        const { collection, query, where, getDocs } = await import(_FS_URL);
        const snap = await getDocs(query(
            collection(window.firebaseDb, 'notifications'),
            where('targetUserId', '==', _usuarioAtual.uid)
        ));
        const nomeEvento = (_bonusLink.eventName || _LABELS_EVENTO[_bonusLink.eventType] || '').toLowerCase();
        const hora = String(_bonusLink.schedule || '').match(/(\d{1,2})\s*h/i)?.[1] || '';
        let melhor = null, melhorTs = 0;
        snap.forEach(d => {
            const n = d.data();
            if (n.notifyType !== 'credentials' && n.notifyType !== 'finalists') return;
            if (!n.roomId) return;
            // Verificar se a notificação é deste evento comparando eventName e horário
            const nEvId = String(n.eventId || '').toLowerCase();
            const nEvNm = String(n.eventName || '').toLowerCase();
            const nSched = String(n.schedule || '').toLowerCase();
            const matchEvento = nEvId.includes(_bonusLink.eventType) || nEvNm.includes(nomeEvento) || nomeEvento.includes(nEvNm);
            const matchHora  = !hora || nSched.includes(hora + 'h') || nSched.includes(hora + '/') || nSched.includes(hora);
            if (matchEvento && matchHora) {
                const ts = n.createdAt?.toMillis?.() || n.createdAt?.seconds * 1000 || 0;
                if (ts > melhorTs) { melhor = n; melhorTs = ts; }
            }
        });
        return melhor;
    } catch (_) {
        return null;
    }
}

// ── Renderizar card de inscrição existente ────────────────────────────────────

function _renderizarInscricaoExistente(reg, notif) {
    const container = document.getElementById('participacaoContainer');
    if (!container) return;

    const nomeEvento = _bonusLink.eventName || _LABELS_EVENTO[_bonusLink.eventType] || _bonusLink.eventType;
    const [ano, mes, dia] = (_bonusLink.date || '').split('-');
    const dataFmt = dia ? `${dia}/${mes}/${ano}` : '—';
    // Problema 3: ignorar slotDisplay/slot que sejam timestamps (> 9999)
    const slotDisplay = (() => {
        const d = reg.slotDisplay;
        if (d && !/^\d{5,}/.test(String(d))) return d;
        const n = _slotNum(reg.slot, reg.slotNumber);
        return n ? `Vaga #${n}` : '';
    })();

    let credHtml = '';
    if (notif && notif.roomId) {
        credHtml = `
            <div style="margin-top:14px;background:linear-gradient(135deg,#f5f3ff,#eef2ff);border:2px solid #c4b5fd;border-radius:14px;padding:14px">
                <p style="font-size:10px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
                    <i class="fas fa-door-open"></i> Credenciais da Sala
                </p>
                <div style="display:flex;gap:8px;margin-bottom:${notif.roomLink ? '10px' : '0'}">
                    <div style="flex:1;background:#fff;border:2px solid #c4b5fd;border-radius:10px;padding:10px;text-align:center">
                        <div style="font-size:9px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">🎮 ID da Sala</div>
                        <div style="font-size:22px;font-weight:900;color:#4c1d95;font-family:monospace;letter-spacing:2px;user-select:all;word-break:break-all">${_esc(notif.roomId)}</div>
                    </div>
                    <div style="flex:1;background:#fff;border:2px solid #a5b4fc;border-radius:10px;padding:10px;text-align:center">
                        <div style="font-size:9px;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">🔑 Senha</div>
                        <div style="font-size:22px;font-weight:900;color:#312e81;font-family:monospace;letter-spacing:2px;user-select:all;word-break:break-all">${_esc(notif.roomPassword || '—')}</div>
                    </div>
                </div>
                ${notif.roomLink ? `<a href="${_esc(notif.roomLink)}" target="_blank" rel="noopener noreferrer"
                    style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:10px;font-size:13px;font-weight:800;text-decoration:none">
                    <i class="fas fa-external-link-alt"></i> Entrar na Sala</a>` : ''}
            </div>`;
    } else {
        credHtml = `
            <div id="credenciaisAguardando" style="margin-top:14px;background:#1f2937;border:1.5px solid #374151;border-radius:12px;padding:12px;text-align:center">
                <p style="color:#9ca3af;font-size:12px"><i class="fas fa-clock text-orange-400 mr-1"></i>ID e senha da sala serão enviados próximo ao horário do evento.</p>
                <p style="color:#6b7280;font-size:11px;margin-top:4px">Volte aqui ou acesse sua <a href="/" style="color:#f97316;text-decoration:underline">área do cliente</a> para ver.</p>
                <p id="credPollingStatus" style="color:#4b5563;font-size:10px;margin-top:6px"><i class="fas fa-circle-notch fa-spin" style="color:#6b7280;margin-right:4px"></i>Verificando automaticamente a cada 30s...</p>
            </div>`;
    }

    // Problema 2: banner de aviso urgente (aparece sempre que o inscrito acessa o link)
    const _bannerUrgente = `
        <div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);border:2px solid #ef4444;border-radius:14px;padding:13px 15px;margin-bottom:12px;text-align:center">
            <p style="color:#fff;font-size:14px;font-weight:900;margin:0;letter-spacing:0.3px">🚨 ID E SENHA SÃO ENVIADOS AQUI</p>
            <p style="color:#fca5a5;font-size:12px;font-weight:700;margin:5px 0 0">Faltando ~5 min do horário — salva este link! 🔥</p>
            <p style="color:#fecaca;font-size:11px;font-weight:600;margin:4px 0 0">NÃO FALTE — honre sua vaga gratuita!</p>
        </div>`;

    container.innerHTML = _bannerUrgente + `
        <div style="background:linear-gradient(135deg,#064e3b,#065f46);border:2px solid #10b981;border-radius:14px;padding:14px;margin-bottom:12px">
            <p style="font-size:10px;font-weight:800;color:#6ee7b7;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
                <i class="fas fa-check-circle"></i> Você já está inscrito!
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
                <div><span style="color:#6ee7b7;font-weight:600">Time:</span><br><span style="color:#fff;font-weight:800">${_esc(reg.teamName || '—')}</span></div>
                <div><span style="color:#6ee7b7;font-weight:600">Data:</span><br><span style="color:#fff;font-weight:800">${dataFmt}</span></div>
                <div><span style="color:#6ee7b7;font-weight:600">Horário:</span><br><span style="color:#fff;font-weight:800">${_esc(_bonusLink.schedule || '—')}</span></div>
                ${slotDisplay ? `<div><span style="color:#6ee7b7;font-weight:600">Vaga:</span><br><span style="color:#fff;font-weight:800">${_esc(slotDisplay)}</span></div>` : ''}
            </div>
        </div>
        ${credHtml}
        <a href="/" style="display:block;margin-top:12px;text-align:center;color:#9ca3af;font-size:12px;text-decoration:underline">
            ← Ver todos os meus pedidos na plataforma
        </a>
    `;

    // Polling automático: se ainda sem credenciais, verificar a cada 30s
    if (_credPollingInterval) { clearInterval(_credPollingInterval); _credPollingInterval = null; }
    if (!notif) {
        const _regSnapshot = reg; // captura o registro atual para o closure
        _credPollingInterval = setInterval(async () => {
            const novaNotif = await _buscarCredenciais();
            if (novaNotif) {
                clearInterval(_credPollingInterval);
                _credPollingInterval = null;
                _renderizarInscricaoExistente(_regSnapshot, novaNotif);
            } else {
                // Atualizar indicador de última verificação
                const statusEl = document.getElementById('credPollingStatus');
                const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="color:#6b7280;margin-right:4px"></i>Última verificação: ${agora} — próxima em 30s`;
            }
        }, 30000);
    }
}

// ── Renderizar formulário de inscrição ────────────────────────────────────────

function _renderizarFormulario() {
    const container = document.getElementById('participacaoContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-300 mb-1">
                <i class="fas fa-users text-orange-400 mr-1"></i>Nome do time *
            </label>
            <input type="text" id="bonusTeamName" placeholder="Ex: Alpha Squad"
                class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-300 mb-1">
                <i class="fas fa-image text-orange-400 mr-1"></i>Logo do time (opcional)
            </label>
            <input type="file" id="bonusLogoFile" accept="image/*"
                class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:text-sm cursor-pointer">
            <div id="bonusLogoPreview" class="mt-2 hidden">
                <img id="bonusLogoImg" src="" alt="Logo" class="w-14 h-14 rounded-lg object-cover border border-gray-600">
            </div>
        </div>
        <div class="mb-5">
            <label class="block text-sm font-medium text-gray-300 mb-1">
                <i class="fab fa-whatsapp text-green-400 mr-1"></i>WhatsApp *
            </label>
            <input type="tel" id="bonusPhone" placeholder="(99) 99999-9999"
                class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
        </div>
        <button onclick="window.confirmarParticipacao()" id="btnParticipar"
            class="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 px-6 rounded-xl transition-colors btn-participar text-lg tracking-wide">
            <i class="fas fa-gamepad mr-2"></i>QUERO PARTICIPAR
        </button>
        <p class="text-center text-xs text-gray-500 mt-3">Sua inscrição é gratuita e será confirmada imediatamente.</p>
    `;

    document.getElementById('bonusLogoFile')?.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('bonusLogoImg').src = e.target.result;
            document.getElementById('bonusLogoPreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });
}

// ── Confirmar participação ────────────────────────────────────────────────────

window.confirmarParticipacao = async function() {
    const btn = document.getElementById('btnParticipar');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i>Processando...';
    }

    try {
        if (!_usuarioAtual) throw new Error('Faça login para participar.');
        if (!_bonusLink) throw new Error('Dados da vaga bônus não carregados. Recarregue a página.');

        const teamName = document.getElementById('bonusTeamName')?.value?.trim();
        const phone    = document.getElementById('bonusPhone')?.value?.trim();

        if (!teamName) throw new Error('Informe o nome do time.');
        if (!phone)    throw new Error('Informe o número de WhatsApp.');

        // Verificar expiração
        if (_bonusLink.expiresAt && new Date(_bonusLink.expiresAt) < new Date()) {
            throw new Error('O prazo desta vaga bônus já expirou.');
        }

        // Logo: redimensiona para 128x128 JPEG (thumbnail seguro para Firestore)
        let teamLogoUrl = null;
        let teamLogoThumb = null;
        const logoFile = document.getElementById('bonusLogoFile')?.files?.[0];
        if (logoFile) {
            const rawDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Erro ao ler o arquivo de logo.'));
                reader.readAsDataURL(logoFile);
            });
            // Redimensiona para 128x128 JPEG — nunca ultrapassa ~30 KB em base64
            teamLogoThumb = await new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const SIZE = 128;
                    const canvas = document.createElement('canvas');
                    canvas.width = SIZE; canvas.height = SIZE;
                    const ctx = canvas.getContext('2d');
                    // Preenche fundo branco antes de desenhar — evita fundo preto em logos PNG com transparência ao exportar como JPEG
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, SIZE, SIZE);
                    const min = Math.min(img.width, img.height);
                    const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
                    ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = () => resolve(null);
                img.src = rawDataUrl;
            });
        }

        const {
            collection, runTransaction, doc,
            serverTimestamp, arrayUnion
        } = await import(_FS_URL);

        const regsRef  = collection(window.firebaseDb, 'registrations');
        const bonusRef = doc(window.firebaseDb, 'bonus_links', _bonusLinkId);
        const nomeEvento = _bonusLink.eventName || _LABELS_EVENTO[_bonusLink.eventType] || _bonusLink.eventType;

        // Problema 1: calcular offset das vagas regulares para numeração sequencial correta
        // Ex: 3 vendidas normalmente → primeiro bônus vira #4, não #1
        let _offsetRegulares = 0;
        try {
            const { getDocs: _gd, query: _q, collection: _c, where: _w } = await import(_FS_URL);
            const _snap = await _gd(_q(
                _c(window.firebaseDb, 'registrations'),
                _w('eventType', '==', _bonusLink.eventType),
                _w('date', '==', _bonusLink.date)
            ));
            const _linkH = String(_bonusLink.schedule || '').match(/(\d+)/)?.[1] || '';
            const _validStOff = new Set(['paid', 'confirmed', 'approved']);
            _snap.forEach(d => {
                const r = d.data();
                if (r.bonusCode === _bonusLink.code) return; // pular inscrições desta própria vaga bônus
                if (!_validStOff.has(r.status)) return; // ignorar pending
                const _regH = String(r.schedule || r.hour || '').match(/(\d+)/)?.[1] || '';
                if (!_linkH || _regH === _linkH) _offsetRegulares++;
            });
        } catch (_) {}

        // Transação atômica: contador + inscrição numa única operação.
        // Se a inscrição falhar, o contador é revertido automaticamente.
        let slotNum = 1;
        await runTransaction(window.firebaseDb, async (tx) => {
            const bonusSnap = await tx.get(bonusRef);
            if (!bonusSnap.exists()) throw new Error('Link bônus não encontrado.');

            const bd = bonusSnap.data();
            if (bd.status !== 'ativo') throw new Error('Este link bônus não está mais ativo.');
            if ((bd.usedCount || 0) >= bd.quantity) throw new Error('Todas as vagas bônus já foram preenchidas.');

            const jaResgatou = Array.isArray(bd.claimedBy) && bd.claimedBy.includes(_usuarioAtual.uid);
            if (jaResgatou) throw new Error('Você já resgatou esta vaga bônus.');

            // _contadorBonus: quantos bônus já foram criados (0→1→2→3, NÃO inclui offset)
            // slotNum:        número absoluto do slot para exibição (offset + contador)
            const _contadorBonus = (bd.usedCount || 0) + 1;
            slotNum = _offsetRegulares + _contadorBonus;
            const novoStatus = _contadorBonus >= bd.quantity ? 'expirado' : 'ativo';
            // Modo Liga usa letras (A, B, C...) — demais eventos usam #número
            const _evTL = String(_bonusLink.eventType || '').toLowerCase();
            const _isLigaBon = _evTL === 'modo-liga' || _evTL.includes('liga') || _evTL.includes('modo');
            const slotDisplay = _isLigaBon
                ? `Vaga ${String.fromCharCode(64 + slotNum)}`
                : `Vaga #${slotNum}`;

            // Atualiza contador no bonus_links (SÓ o contador bônus, sem offset)
            tx.update(bonusRef, {
                usedCount: _contadorBonus,
                status:    novoStatus,
                claimedBy: arrayUnion(_usuarioAtual.uid)
            });

            // Cria inscrição dentro da mesma transação — se falhar, tudo reverte
            const regRef = doc(regsRef);
            tx.set(regRef, {
                userId:       _usuarioAtual.uid,
                teamName,
                teamLogoUrl,
                teamLogoThumb,
                teamId:       _perfilUsuario?.teamId || null,
                leaderName:   _perfilUsuario?.name || _usuarioAtual.displayName || teamName,
                email:        _usuarioAtual.email,
                phone,
                schedule:     _bonusLink.schedule,
                date:         _bonusLink.date,
                eventType:    _bonusLink.eventType,
                title:        `${nomeEvento} - ${_bonusLink.schedule}`,
                price:        0,
                slot:         slotNum,
                slotNumber:   slotNum,
                slotDisplay,
                status:       'confirmed',
                origem:       'bonus',
                bonusCode:    _bonusLink.code,
                bonusLinkId:  _bonusLinkId,
                createdAt:    serverTimestamp()
            });
        });

        _mostrarSucesso(teamName, nomeEvento);

    } catch (err) {
        console.error('[Bonus] Erro ao confirmar:', err);
        let msg = err.message || 'Erro ao confirmar participação. Tente novamente.';
        // Erros de cota/quota do Firebase free tier
        if (
            msg.toLowerCase().includes('quota') ||
            msg.toLowerCase().includes('resource exhausted') ||
            msg.toLowerCase().includes('resource_exhausted') ||
            err.code === 'resource-exhausted'
        ) {
            msg = 'O banco de dados atingiu o limite diário do plano gratuito. As inscrições voltam a funcionar automaticamente a partir das 04h (horário de Brasília). Entre em contato com a organização se precisar de suporte.';
        }
        alert('❌ ' + msg);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-gamepad mr-2"></i>QUERO PARTICIPAR';
        }
    }
};

// ── Exibir sucesso ─────────────────────────────────────────────────────────────

function _mostrarSucesso(teamName, nomeEvento) {
    document.getElementById('bonusCard').classList.add('hidden');
    document.getElementById('successTeamName').textContent = teamName;
    document.getElementById('successEventName').textContent = nomeEvento;
    document.getElementById('successState').classList.remove('hidden');
}

// ── Exibir erro ───────────────────────────────────────────────────────────────

function _mostrarErro(titulo, mensagem) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('bonusCard').classList.add('hidden');
    document.getElementById('errorTitle').textContent = titulo;
    document.getElementById('errorMessage').textContent = mensagem;
    document.getElementById('errorState').classList.remove('hidden');
}

// ── Utilitário: escape HTML ───────────────────────────────────────────────────

function _esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
