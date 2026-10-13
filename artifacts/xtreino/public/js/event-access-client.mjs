import { paymentFetch } from './payment-client.js';

const messages = {
    expired: 'Link expirado. O acesso terminou às 00h01 do dia seguinte à reserva (horário de Brasília).',
    not_configured: 'O link deste horário ainda não foi cadastrado pela organização.',
    inactive: 'O link deste horário está temporariamente desativado.',
    needs_review: 'Esta reserva precisa de conferência da organização para liberar o link.',
    not_confirmed: 'O link será liberado após a confirmação da vaga.',
    not_authorized: 'Link não disponível para esta conta.',
};
let owner = null;
let epoch = 0;
const records = new Map();
const pending = new Map();
const references = new Map();
const repaintTimers = new WeakMap();

function currentAccess(row) {
    if (row.status === 'available' && Date.parse(row.expiresAt) <= Date.now()) {
        const { url, ...expired } = row;
        return { ...expired, status: 'expired' };
    }
    return row;
}

export async function eventAccessRequest(action, data = {}) {
    const response = await paymentFetch(window.firebaseAuth?.currentUser, '/.netlify/functions/event-access-links', {
        method: 'POST', body: JSON.stringify({ ...data, action }),
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Resposta inválida ao consultar os links.'); }
    if (!response.ok) throw new Error(result.error || 'Não foi possível consultar os links agora.');
    return result;
}

export function clearEventAccessCache() {
    epoch++;
    records.clear();
    pending.clear();
    references.clear();
}

async function session() {
    await window.firebaseAuth?.authStateReady?.();
    const uid = window.firebaseAuth?.currentUser?.uid;
    if (!uid) throw new Error('Faça login para acessar os links das suas reservas.');
    if (owner !== uid) { owner = uid; clearEventAccessCache(); }
    return uid;
}

function checkSession(uid) {
    if (window.firebaseAuth?.currentUser?.uid !== uid) throw new Error('Sua sessão mudou. Entre novamente.');
}

function remember(access, uid, generation) {
    checkSession(uid);
    if (generation !== epoch) throw new Error('Os links foram atualizados. Consulte novamente.');
    if (!Array.isArray(access)) throw new Error('Resposta inválida ao consultar os links.');
    for (const row of access) {
        if (!row?.registrationId || !(row.status === 'available' || messages[row.status])) {
            throw new Error('Resposta inválida ao consultar os links.');
        }
        if (row.status === 'available') {
            if (!Number.isFinite(Date.parse(row.expiresAt))) throw new Error('Validade do link inválida.');
            const url = new URL(row.url);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Link inválido.');
        }
    }
    const rows = access.map(currentAccess);
    for (const row of rows) records.set(row.registrationId, {
        row, expires: Math.min(Date.now() + (row.status === 'available' ? 120000 : 20000),
            row.status === 'available' ? Date.parse(row.expiresAt) : Infinity),
    });
    return rows;
}

export async function fetchEventAccess(ids, { force = false } = {}) {
    const uid = await session();
    const generation = epoch;
    const unique = [...new Set(ids)].filter(Boolean);
    const missing = unique.filter(id => !pending.has(id) && (force || !records.has(id) || records.get(id).expires <= Date.now()));
    for (let offset = 0; offset < missing.length; offset += 200) {
        const batch = missing.slice(offset, offset + 200);
        const request = eventAccessRequest('resolve', { registrationIds: batch }).then(result => {
            if (!Array.isArray(result.access) || batch.some(id => !result.access.some(row => row.registrationId === id))) {
                throw new Error('Algumas reservas não retornaram da consulta.');
            }
            return remember(result.access, uid, generation);
        });
        for (const id of batch) {
            const promise = request.then(rows => rows.find(row => row.registrationId === id));
            pending.set(id, promise);
            promise.finally(() => { if (pending.get(id) === promise) pending.delete(id); }).catch(() => {});
        }
    }
    const result = await Promise.all(unique.map(id => pending.get(id) || records.get(id)?.row));
    checkSession(uid);
    return result.map(currentAccess);
}

async function fetchReferenceAccess(reference, force = false) {
    const uid = await session();
    const generation = epoch;
    const entry = references.get(reference);
    if (!force && entry && (entry.pending || entry.expires > Date.now())) {
        return (await (entry.pending || entry.rows)).map(currentAccess);
    }
    const request = eventAccessRequest('resolve', { externalReference: reference })
        .then(result => remember(result.access, uid, generation));
    references.set(reference, { pending: request });
    try {
        const rows = await request;
        references.set(reference, { rows, expires: Date.now() + 20000 });
        return rows;
    } catch (error) {
        if (references.get(reference)?.pending === request) references.delete(reference);
        throw error;
    }
}

function paint(container, rows, onRefresh) {
    clearTimeout(repaintTimers.get(container));
    repaintTimers.delete(container);
    const uid = window.firebaseAuth?.currentUser?.uid;
    container.replaceChildren();
    const seen = new Set();
    const current = rows.map(currentAccess);
    for (const row of current) {
        const key = `${row.eventType || row.registrationId}/${row.schedule || ''}/${row.eventDate || ''}/${row.status}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (row.status === 'available') {
            const link = document.createElement('a');
            link.href = row.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700';
            link.textContent = `Acessar ${row.label || 'evento'} — ${row.schedule}`;
            link.onclick = event => {
                if (Date.now() >= Date.parse(row.expiresAt) || uid !== window.firebaseAuth?.currentUser?.uid) {
                    event.preventDefault();
                    if (uid === window.firebaseAuth?.currentUser?.uid) paint(container, rows, onRefresh);
                    else container.textContent = messages.not_authorized;
                }
            };
            container.append(link);
            const validity = document.createElement('p');
            validity.className = 'text-xs text-gray-500 text-center';
            validity.textContent = `Disponível até ${new Date(row.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às 00h01 (Brasília).`;
            container.append(validity);
        } else {
            const text = document.createElement('p');
            text.className = 'text-xs text-gray-500';
            text.textContent = `${row.schedule ? row.schedule + ': ' : ''}${messages[row.status] || 'Link não disponível.'}`;
            container.append(text);
        }
    }
    if (onRefresh) retry(container, onRefresh);
    const deadlines = current.filter(row => row.status === 'available').map(row => Date.parse(row.expiresAt));
    if (deadlines.length) {
        const timer = setTimeout(() => {
            if (!container.isConnected) return;
            if (uid !== window.firebaseAuth?.currentUser?.uid) { container.textContent = messages.not_authorized; return; }
            paint(container, rows, onRefresh);
        }, Math.min(2147483647, Math.max(1, Math.min(...deadlines) - Date.now())));
        timer.unref?.();
        repaintTimers.set(container, timer);
    }
}

function retry(container, callback, label = 'Atualizar link') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-xs font-semibold text-teal-700 underline mt-2';
    button.textContent = label;
    button.onclick = () => callback(true);
    container.append(button);
}

export function eventAccessPlaceholder(id) {
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(String(id || ''))) return '';
    return `<div data-event-access-id="${id}" class="mt-3 flex flex-col gap-2" role="status" aria-live="polite">Consultando link de acesso...</div>`;
}

export async function hydrateEventAccessLinks(root) {
    const containers = [...root.querySelectorAll('[data-event-access-id]')];
    if (!containers.length) return;
    const uid = window.firebaseAuth?.currentUser?.uid;
    const update = async (targets, force = false) => {
        for (const target of targets) target.textContent = 'Consultando link de acesso...';
        try {
            const rows = await fetchEventAccess(targets.map(target => target.dataset.eventAccessId), { force });
            if (uid !== window.firebaseAuth?.currentUser?.uid) return;
            for (const target of targets) {
                if (!target.isConnected) continue;
                const row = rows.find(item => item.registrationId === target.dataset.eventAccessId);
                paint(target, row ? [row] : [], nextForce => update([target], nextForce));
            }
        } catch (error) {
            if (uid !== window.firebaseAuth?.currentUser?.uid) return;
            for (const target of targets) {
                if (!target.isConnected) continue;
                target.textContent = error.message || 'Link indisponível agora. Sua vaga continua confirmada.';
                retry(target, nextForce => update([target], nextForce), 'Tentar novamente');
            }
        }
    };
    await update(containers);
}

export async function mountReferenceAccess(container, reference) {
    const uid = window.firebaseAuth?.currentUser?.uid;
    const update = async (force = false) => {
        container.textContent = 'Consultando os links dos horários confirmados...';
        try {
            const rows = await fetchReferenceAccess(reference, force);
            if (!container.isConnected || uid !== window.firebaseAuth?.currentUser?.uid) return;
            paint(container, rows, update);
            if (!rows.length) container.textContent = 'Nenhum horário confirmado encontrado.';
        } catch (error) {
            if (!container.isConnected || uid !== window.firebaseAuth?.currentUser?.uid) return;
            container.textContent = error.message || 'Link indisponível agora. Sua vaga continua confirmada.';
            retry(container, update, 'Tentar novamente');
        }
    };
    await update();
}
