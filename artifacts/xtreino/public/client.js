// ==================== TOAST NOTIFICATION SYSTEM ====================
let confirmResolve = null;

function showToast(type, message, title = null, duration = 5000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
    };
    
    const titles = {
        success: 'Sucesso',
        error: 'Erro',
        info: 'Informação',
        warning: 'Atenção'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ'}</div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="removeToast(this.parentElement)">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }

    return toast;
}

function removeToast(toast) {
    if (!toast) return;
    toast.classList.add('toast-exit');
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 300);
}

// Replace alert() with toast
window.alert = function(message) {
    showToast('info', message, null, 4000);
};

// Elegant confirmation modal
function showConfirm(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOkBtn');
        
        if (!modal || !titleEl || !messageEl || !okBtn) {
            resolve(false);
            return;
        }

        titleEl.textContent = title || 'Confirmar';
        messageEl.textContent = message || '';
        okBtn.textContent = confirmText;
        
        confirmResolve = resolve;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    });
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
    }
}

function handleConfirmOk() {
    closeConfirmModal();
    if (confirmResolve) {
        confirmResolve(true);
        confirmResolve = null;
    }
}

// Replace confirm() with elegant modal
window.confirm = function(message) {
    return showConfirm('Confirmar', message);
};

// Helper functions for different toast types
window.showSuccessToast = function(message, title = 'Sucesso') {
    showToast('success', message, title);
};

window.showErrorToast = function(message, title = 'Erro') {
    showToast('error', message, title);
};

window.showInfoToast = function(message, title = 'Informação') {
    showToast('info', message, title);
};

window.showWarningToast = function(message, title = 'Atenção') {
    showToast('warning', message, title);
};

// Client Area JavaScript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, browserLocalPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, addDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

// Reuse global Firebase app/auth/db initialized in firebase.js
let app = null;
let auth = null;
let db = null;
let storage = null;

// Inicializar Firebase imediatamente
function initializeFirebase() {
  
  
  
  
  
  
  if (window.firebaseApp && window.firebaseAuth && window.firebaseDb) {
    app = window.firebaseApp;
    auth = window.firebaseAuth;
    db = window.firebaseDb;
    storage = getStorage(app);
    
    
    return true;
  }
  
  if (window.FIREBASE_CONFIG) {
    // Fallback: initialize here if global init hasn't run yet
    
    app = initializeApp(window.FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    
    
    return true;
  }
  
  
  return false;
}

// Inicializar Firebase
const firebaseInitialized = initializeFirebase();


// Ensure local persistence for auth session
if (auth && auth.setPersistence) {
  try { setPersistence(auth, browserLocalPersistence); } catch(_) {}
}

// Global variables
let currentUser = null;
let userProfile = null;
let appliedTokenCoupon = null;
let selectedTokensQty = 0;

// Initialize client area
document.addEventListener('DOMContentLoaded', async function() {
    // Garantir que o Storage está inicializado
    if (!storage && window.firebaseApp) {
        try {
            storage = getStorage(window.firebaseApp);
        } catch (error) {}
    }

    // Detectar retorno do Mercado Pago e salvar no sessionStorage ANTES de limpar a URL
    try {
        const _sp = new URLSearchParams(location.search);
        const _colStatus = _sp.get('collection_status');
        const _status    = _sp.get('status');
        const _extRef    = _sp.get('external_reference');
        const _approved  = _colStatus === 'approved' || _status === 'approved';
        if (_approved && _extRef) {
            // Salvar para processar após auth estar pronta (no onAuthStateChanged)
            sessionStorage.setItem('mp_pending_ref', _extRef);
            sessionStorage.setItem('mp_pending_status', 'approved');
            // Limpar URL para não reprocessar no reload
            history.replaceState({}, document.title, location.pathname);
        }
    } catch(_) {}

    await checkAuthState();
    setupEventListeners();
    // Se vier com ?tab=myTokens, abrir direto essa aba
    try{
        const sp = new URLSearchParams(location.search);
        const tab = sp.get('tab');
        if (tab === 'myTokens') {
            await switchTab('myTokens');
        }
    }catch(_){ }
});

// Check authentication state
async function checkAuthState() {
    
    
    if (!auth) {
        
        showLoginPrompt();
        return;
    }
    onAuthStateChanged(auth, async (user) => {
        
        if (user) {
            currentUser = user;
            
            await loadUserProfile();
            await loadDashboard();
            await reconcilePendingPayments();

            // Processar retorno do Mercado Pago (tokens) — executar aqui onde auth é garantida
            try {
                const _mpRef    = sessionStorage.getItem('mp_pending_ref');
                const _mpStatus = sessionStorage.getItem('mp_pending_status');
                if (_mpRef && _mpStatus === 'approved') {
                    sessionStorage.removeItem('mp_pending_ref');
                    sessionStorage.removeItem('mp_pending_status');
                    await processSuccessfulPayment(_mpRef);
                    // Após creditar, abrir aba de tokens
                    try { await switchTab('tokens'); } catch(_) {}
                }
            } catch(_) {}
            // Verificar role de afiliado após carregar perfil (já é chamado no loadDashboard, mas garantir)
            await checkAffiliateRole();
            // Iniciar contador de notificações não lidas
            initNotificationCounter().catch(() => {});
            // Verificar novamente após um delay para garantir que o DOM está pronto
            setTimeout(async () => {
                await checkAffiliateRole();
            }, 500);
            // Hide login prompt if user is logged in
            hideLoginPrompt();
        } else {
            
            // Show login prompt instead of redirecting
            showLoginPrompt();
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    const dashTab = document.getElementById('dashboardTab');
    const ordersTab = document.getElementById('ordersTab');
    const productsTab = document.getElementById('productsTab');
    const tokensTab = document.getElementById('tokensTab');
    const profileTab = document.getElementById('profileTab');
    const affiliateTab = document.getElementById('affiliateTab');
    if (dashTab) dashTab.addEventListener('click', async () => await switchTab('dashboard'));
    if (ordersTab) ordersTab.addEventListener('click', async () => await switchTab('orders'));
    if (productsTab) productsTab.addEventListener('click', async () => await switchTab('products'));
    if (tokensTab) tokensTab.addEventListener('click', async () => await switchTab('tokens'));
    if (profileTab) profileTab.addEventListener('click', async () => await switchTab('profile'));
    if (affiliateTab) affiliateTab.addEventListener('click', async () => await switchTab('affiliate'));
    const notificationsTab = document.getElementById('notificationsTab');
    if (notificationsTab) notificationsTab.addEventListener('click', async () => await switchTab('notifications'));

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', saveProfile);
}

// Switch between tabs
async function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    // Remove active class from all tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active', 'border-blue-500', 'text-blue-600');
        button.classList.add('border-transparent', 'text-gray-500');
    });

    // Show selected tab content.
    document.getElementById(tabName + 'Content').classList.remove('hidden');

    // Add active class to selected tab
    const activeTab = document.getElementById(tabName + 'Tab');
    activeTab.classList.add('active', 'border-blue-500', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');

    // Para auto-refresh de pedidos ao trocar de aba
    _stopOrdersAutoRefresh();

    // Load tab-specific data
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'orders':
            loadOrders();
            reconcilePendingPayments().catch(console.error);
            _startOrdersAutoRefresh();
            break;
        case 'products':
            loadProducts();
            break;
        case 'tokens':
            await loadMyTokens();
            break;
        case 'profile':
            loadProfile();
            break;
        case 'affiliate':
            // Verificar novamente se é afiliado antes de carregar
            await checkAffiliateRole();
            await loadAffiliateData();
            break;
        case 'notifications':
            await loadNotifications();
            break;
    }
}

// Load user profile
async function loadUserProfile() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            
            return;
        }
        
        
        
        // Usar o mesmo perfil do script.js para manter consistência
        if (window.currentUserProfile && window.currentUserProfile.uid === currentUser.uid) {
            userProfile = window.currentUserProfile;
            
        } else {
            // Fallback: carregar do Firestore se não estiver disponível no window
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                userProfile = userDoc.data();
                // Sincronizar com window.currentUserProfile
                window.currentUserProfile = userProfile;
                
            } else {
                
                // Create default profile
                userProfile = {
                    name: currentUser.displayName || '',
                    email: currentUser.email,
                    phone: '',
                    nickname: '',
                    team: '',
                    age: '',
                    tokens: 0,
                    role: 'user',
                    level: 'Associado Treino'
                };
                await setDoc(doc(db, 'users', currentUser.uid), userProfile);
                // Sincronizar com window.currentUserProfile
                window.currentUserProfile = userProfile;
                
            }
        }
        
        // Atualizar mensagem de boas-vindas com primeiro nome
        const welcomeMessageElement = document.getElementById('welcomeMessage');
        if (welcomeMessageElement) {
            const fullName = userProfile.name || currentUser.email;
            const firstName = fullName.split(' ')[0]; // Pega apenas o primeiro nome
            welcomeMessageElement.textContent = `Bem-vindo à sua conta, ${firstName}!`;
        }
    } catch (error) {
        
    }
}

// Load dashboard
async function loadDashboard() {
    try {
        // Garantir que o userProfile seja carregado primeiro
        if (!userProfile && currentUser) {
            
            await loadUserProfile();
        }       
       
        // Verificar role de afiliado após carregar perfil
        await checkAffiliateRole();

        // Inscrições do dia (agenda de hoje)
        loadTodayRegistrations();
        
        // Load recent orders
        await loadRecentOrders();
        
        // Load stats
        await loadStats();
    } catch (error) {
        
    }
}

// Inscrições do dia — mostra eventos agendados para hoje no dashboard
async function loadTodayRegistrations() {
    const container  = document.getElementById('todayRegistrations');
    const badge      = document.getElementById('todayRegsBadge');
    const dateLabel  = document.getElementById('todayRegsDateLabel');
    if (!container) return;

    // Data de hoje no fuso BR (UTC-3)
    const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (dateLabel) {
        const [, m, d] = hoje.split('-');
        dateLabel.textContent = `${d}/${m}`;
    }

    if (!currentUser?.uid) {
        container.innerHTML = '<p style="color:#9ca3af;text-align:center;font-size:13px;padding:4px 0">Faça login para ver suas inscrições.</p>';
        return;
    }

    try {
        const allRegs = await fetchUserDocs('registrations', 200, false);
        const validStatuses = new Set(['paid', 'confirmed', 'approved', 'pending', 'lisagem_gratis']);
        const todayRegs = allRegs
            .filter(d => d.data.date === hoje && validStatuses.has(d.data.status || ''))
            .map(d => ({ id: d.id, ...d.data }));

        // Ordenar por hora do schedule ("14h" → 14)
        const getHour = s => {
            const m2 = String(s || '').match(/(\d{1,2})\s*h/i);
            return m2 ? parseInt(m2[1], 10) : 99;
        };
        todayRegs.sort((a, b) => getHour(a.schedule) - getHour(b.schedule));

        if (badge) {
            badge.textContent = todayRegs.length;
            badge.style.display = todayRegs.length > 0 ? '' : 'none';
        }

        if (todayRegs.length === 0) {
            container.innerHTML = '<p style="color:#9ca3af;text-align:center;font-size:13px;padding:4px 0">Nenhuma inscrição para hoje 🎮</p>';
            return;
        }

        const eventIcons = {
            'xtreino-tokens': '🎮', 'modo-liga': '⚔️',
            'semanal-freitas': '🏆', 'camp-freitas': '🥇'
        };
        const statusInfo = {
            paid:           { label: 'Confirmado',   color: '#10b981', bg: '#d1fae5' },
            confirmed:      { label: 'Confirmado',   color: '#10b981', bg: '#d1fae5' },
            approved:       { label: 'Aprovado',     color: '#3b82f6', bg: '#dbeafe' },
            pending:        { label: 'Aguard. pag.', color: '#f59e0b', bg: '#fef3c7' },
            lisagem_gratis: { label: '🆓 Grátis',    color: '#07b7b4', bg: '#ccfbf1' },
        };

        container.innerHTML = todayRegs.map(r => {
            const icon = eventIcons[r.eventType] || '🎮';
            const s    = statusInfo[r.status] || statusInfo.pending;
            // Problema 3: ignorar slot/slotDisplay que sejam timestamps (> 9999)
            const slot = (() => {
                const d = r.slotDisplay;
                if (d && !/^\d{5,}/.test(String(d))) {
                    // Normalizar formatos antigos e Liga para o padrão atual
                    return String(d)
                        .replace(/^Vaga\s*#?(\d+)$/, 'Slot $1')   // "Vaga #3" → "Slot 3"
                        .replace(/^Vaga\s*([A-Za-z])$/, 'Letra $1') // "Vaga J" → "Letra J"
                        .replace(/^Slot\s+([A-Za-z])$/, 'Letra $1'); // "Slot J" → "Letra J"
                }
                const n = Number(r.slot || r.slotNumber || 0);
                return (n > 0 && n <= 9999) ? `Slot ${n}` : '';
            })();
            const schedule = r.schedule || r.hour || '';
            // Remover sufixo de slot/letra do título (já aparece na linha abaixo)
            const name = (r.title || r.eventType || r.teamName || 'Evento')
                .replace(/\s*[-–]\s*(Slot\s*\d+|Letra\s*[A-Za-z]|Vaga\s*#?\d+|Vaga\s*[A-Za-z]|Grupo\s+\d+\s*[•·]\s*Slot\s*\d+)$/i, '');
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6;last-child:border-bottom:none">
                <div style="width:38px;height:38px;background:linear-gradient(135deg,#ede9fe,#dbeafe);border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:800;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:2px">${schedule}${slot ? ' &bull; ' + slot : ''}</div>
                </div>
                <div style="flex-shrink:0">
                    <span style="font-size:10px;font-weight:700;color:${s.color};background:${s.bg};border-radius:6px;padding:3px 8px;white-space:nowrap">${s.label}</span>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = '<p style="color:#9ca3af;text-align:center;font-size:13px;padding:4px 0">Erro ao carregar inscrições.</p>';
    }
}

// Load recent orders
async function loadRecentOrders() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            
            displayRecentOrders([]);
            return;
        }
        
        // Orders pagos/confirmados (Mercado Pago)
        const ordersData = await fetchUserDocs('orders', 5, true);
        const orders = ordersData.map(d => ({
            id: d.id,
            date: d.data.createdAt?.toDate?.() || new Date(),
            title: d.data.title || d.data.item || 'Pedido',
            status: d.data.status || 'pending',
            price: d.data.amount ?? d.data.total ?? 0,
            eventDate: d.data.date || null,
            schedule: d.data.schedule || d.data.hour || d.data.time || '',
            eventType: d.data.eventType || '',
            paidWithTokens: d.data.paidWithTokens || false,
            tokensUsed: d.data.tokensUsed || 0
        })).filter(o => o.status !== 'confirmed');

        // Registrations de eventos: incluir TODOS os pagos com tokens (qualquer status) e os com status 'paid'
        const regsData = await fetchUserDocs('registrations', 10, true);
        const regEvents = regsData
            .filter(d => {
                const paidWithTokens = d.data.paidWithTokens === true;
                const status = d.data.status || '';
                // Inclui se pago com tokens OU se status for 'paid'
                return paidWithTokens || status === 'paid';
            })
            .map(d => ({
                id: d.id,
                date: d.data.createdAt?.toDate?.() || new Date(),
                title: d.data.title || d.data.eventType || 'Reserva',
                status: d.data.status || 'paid',
                price: d.data.paidWithTokens ? 0 : (d.data.price || 0),
                eventDate: d.data.date || null,
                schedule: d.data.schedule || d.data.hour || d.data.time || '',
                eventType: d.data.eventType || '',
                paidWithTokens: d.data.paidWithTokens === true,
                tokensUsed: d.data.tokensUsed || d.data.tokenCost || 0
            }));

        const merged = [...regEvents]
            .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0))
            .slice(0, 5);

        displayRecentOrders(merged);
    } catch (error) {
        
        const recentOrdersElement = document.getElementById('recentOrders');
        if (recentOrdersElement) {
            recentOrdersElement.innerHTML = '<p class="text-gray-500 text-center">Erro ao carregar pedidos</p>';
        }
    }
}

// Display recent orders
function displayRecentOrders(orders) {
    const container = document.getElementById('recentOrders');
    
    if (orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">Nenhum pedido encontrado</p>';
        return;
    }

    const ordersHTML = orders.map(order => {
        // Define o valor a ser exibido: se pago com tokens, mostra a quantidade; senão, mostra o valor monetário
        const valorDisplay = order.paidWithTokens
            ? `${order.tokensUsed} token${order.tokensUsed !== 1 ? 's' : ''}`
            : `R$ ${order.price?.toFixed(2) || '0,00'}`;

        return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.07)" class="last:border-b-0">
                <div>
                    <p style="font-size:13px;font-weight:700;color:#fff;margin:0">${order.title || 'Reserva'}</p>
                    <p style="font-size:11px;color:rgba(255,255,255,0.45);margin:3px 0 0">${formatDate(order.date)}</p>
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:12px">
                    <p style="font-size:13px;font-weight:700;color:#ecd414;margin:0 0 4px">${valorDisplay}</p>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status, order)}">
                        ${getStatusText(order.status, order)}
                    </span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = ordersHTML;
}

// Pagination variables
let currentPage = 1;
let currentProductsPage = 1;
let currentWhatsAppPage = 1;
const ordersPerPage = 5;
let allOrdersData = [];

// Load all orders with pagination
async function loadOrders() {
    try {
        
        const ordersData = await fetchUserDocs('orders', 200, true);
        
        
        const mappedOrders = ordersData.map(d => ({
            id: d.id,
            source: 'order', // <-- ADICIONADO
            date: d.data.createdAt?.toDate?.() || new Date(),
            title: d.data.title || d.data.item || 'Pedido',
            status: d.data.status || 'pending',
            price: d.data.amount ?? d.data.total ?? 0,
            eventDate: d.data.date || null,
            schedule: d.data.schedule || d.data.hour || d.data.time || '',
            teamName: d.data.teamName || d.data.team || d.data.name || '',
            email: d.data.email || null,
            contact: d.data.contact || d.data.phone || null,
            eventType: d.data.eventType || '',
            paidWithTokens: d.data.paidWithTokens || false,
            tokensUsed: d.data.tokensUsed || 0,
            whatsappLink: d.data.whatsappLink || d.data.groupLink || d.data.group_link || null
        }));
        

        // Incluir eventos das registrations: tokens e pagamentos aprovados (paid/confirmed/approved)
        const regsData = await fetchUserDocs('registrations', 200, true);
        
        
        const mappedRegs = regsData
            .filter(d => d.data.paidWithTokens === true || d.data.status === 'paid' || d.data.status === 'confirmed' || d.data.status === 'approved')
            .map(d => ({
                id: d.id,
                source: 'registration', // <-- ADICIONADO
                date: d.data.createdAt?.toDate?.() || new Date(),
                title: d.data.title || d.data.eventType || 'Reserva',
                status: d.data.status || 'paid',
                price: d.data.paidWithTokens ? 0 : (d.data.price || 0),
                eventDate: d.data.date || null,
                schedule: d.data.schedule || d.data.hour || d.data.time || '',
                eventType: d.data.eventType || '',
                paidWithTokens: d.data.paidWithTokens === true,
                tokensUsed: d.data.tokensUsed || d.data.tokenCost || 0,
                teamName: d.data.teamName || d.data.team || d.data.name || '',
                email: d.data.email || null,
                contact: d.data.contact || d.data.phone || null,
                whatsappLink: d.data.whatsappLink || d.data.groupLink || d.data.group_link || null
            }));
        

        allOrdersData = [...mappedOrders, ...mappedRegs]
          .sort((a,b)=> (b.date?.getTime?.()||0) - (a.date?.getTime?.()||0));
        
        

        await displayAllOrdersPaginated();
    } catch (error) {
        
        document.getElementById('allOrders').innerHTML = '<p class="text-gray-500 text-center">Erro ao carregar pedidos</p>';
    }
}

// Cache de downloadLinks dos produtos da loja (evita leituras repetidas do Firestore)
let _productLinksCache = null;

async function loadProductDownloadLinksCache() {
    if (_productLinksCache) return; // já carregado
    try {
        const fbReady = await waitForFirebase(6000);
        if (!fbReady || !window.firebaseDb) return;
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(collection(window.firebaseDb, 'products'));
        _productLinksCache = {};
        snap.forEach(d => {
            const data = d.data();
            _productLinksCache[d.id] = {
                downloadLinks: data.downloadLinks || {},
                downloadLink:  data.downloadLink  || ''
            };
        });
    } catch (e) {
        // Quota esgotada ou erro de rede — cachear vazio para não tentar de novo
        _productLinksCache = _productLinksCache || {};
    }
}

// Load products (loja virtual items)
async function loadProducts() {
    try {
        // Garantir que o cache de links está pronto antes de renderizar os botões
        await loadProductDownloadLinksCache();
        const ordersData = await fetchUserDocs('orders', 200, true);
        const productsData = ordersData.map(d => ({
            id: d.id,
            date: d.data.createdAt?.toDate?.() || new Date(),
            title: d.data.title || d.data.item || 'Produto',
            status: d.data.status || 'pending',
            price: d.data.amount ?? d.data.total ?? 0,
            eventType: d.data.eventType || '',
            type: d.data.type || '',
            productId: d.data.productId || d.data.itemId || '',
            productCategory: d.data.productCategory || '',
            productOptions: d.data.productOptions || {},
            downloadLink: d.data.downloadLink || d.data.productOptions?.downloadLink || '',
            shippingStatus: d.data.shippingStatus || '',
            shirtShipped: d.data.shirtShipped || false,
            shippedAt: d.data.shippedAt || null,
            shipping: d.data.shipping || d.data.productOptions?.delivery || {},
            booyahConfirmed: d.data.booyahConfirmed || false,
            booyahConfirmedAt: d.data.booyahConfirmedAt || null
        }));

        // Filter only products (not events or tokens)
        const productsOnly = productsData.filter(order => {
            const title = (order.title || '').toLowerCase();
            const item = (order.item || '').toLowerCase();
            const eventType = (order.eventType || '').toLowerCase();
            const type = (order.type || '').toLowerCase();
            
            // Include if explicitly marked as digital product
            if (type === 'digital_product') return true;

            // Otherwise, exclude events/tokens and keep product-like titles
            return !title.includes('xtreino') && 
                   !title.includes('camp') && 
                   !title.includes('semanal') && 
                   !title.includes('modo liga') &&
                   !title.includes('tokens') &&
                   !item.includes('xtreino') && 
                   !item.includes('camp') && 
                   !item.includes('semanal') && 
                   !item.includes('modo liga') &&
                   !item.includes('tokens') &&
                   eventType !== 'xtreino-tokens';
        });

        displayAllProductsPaginated(productsOnly);
    } catch (error) {
        
        document.getElementById('allProducts').innerHTML = '<p class="text-gray-500 text-center">Erro ao carregar produtos</p>';
    }
}

async function displayAllOrdersPaginated() {
    const container = document.getElementById('allOrders');
    // Filtra apenas eventos (source === 'registration') e que estejam pagos/confirmados
    const allOrders = allOrdersData.filter(order => {
        // Se for um produto (source === 'order'), excluir
        if (order.source === 'order') return false;
        
        const status = (order.status || '').toLowerCase();
        const paidWithTokens = order.paidWithTokens === true;
        
        // Para registrations, considerar apenas se estiver pago/confirmado
        return (status === 'paid' || status === 'confirmed' || status === 'approved') || paidWithTokens;
    });
    
    if (allOrders.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">Nenhum evento encontrado</p>';
        return;
    }

    // Agrupa por external_reference
    const groups = {};
    allOrders.forEach(order => {
        const groupKey = order.external_reference || `${order.eventDate}_${order.teamName}_${order.email}`;
        if (!groups[groupKey]) {
            groups[groupKey] = {
                externalRef: order.external_reference,
                date: order.date,
                eventDate: order.eventDate,
                teamName: order.teamName,
                email: order.email,
                contact: order.contact,
                price: order.price,
                tokensUsed: order.tokensUsed, // será substituído pela soma depois
                paidWithTokens: order.paidWithTokens,
                status: order.status,
                items: []
            };
        }
        groups[groupKey].items.push({
            schedule: order.schedule,
            hour: order.hour,
            whatsappLink: order.whatsappLink,
            eventType: order.eventType,
            title: order.title,
            id: order.id,
            tokensUsed: order.tokensUsed || 0
        });
    });

    // Calcula o total de tokens para cada grupo
    Object.values(groups).forEach(group => {
        if (group.paidWithTokens) {
            group.totalTokens = group.items.reduce((sum, item) => sum + (item.tokensUsed || 0), 0);
        } else {
            group.totalTokens = null; // não se aplica
        }
    });

    const groupedOrders = Object.values(groups).sort((a, b) => 
        (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0)
    );

    // Paginação
    const totalPages = Math.ceil(groupedOrders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const currentGroups = groupedOrders.slice(startIndex, endIndex);

    const ordersHTML = await Promise.all(currentGroups.map(async group => {
        const itemsHTML = await Promise.all(group.items.map(async item => {
            const tempOrder = {
                ...item,
                eventDate: group.eventDate,
                teamName: group.teamName,
                email: group.email,
                contact: group.contact,
                price: group.price,
                tokensUsed: item.tokensUsed,
                paidWithTokens: group.paidWithTokens,
                status: group.status
            };
            const whatsappButton = await getOrderActionButton(tempOrder);
            const hourDisplay = item.schedule ? (item.schedule.split(' - ')[1] || item.schedule) : (item.hour || '');
            return `
                <div class="border-t border-gray-200 pt-2 mt-2 first:border-t-0 first:pt-0 first:mt-0">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-gray-700">${hourDisplay}</span>
                        ${whatsappButton}
                    </div>
                </div>
            `;
        }));

        const eventDateStr = group.eventDate ? new Date(group.eventDate + 'T00:00:00').toLocaleDateString('pt-BR') : '';

        return `
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-medium text-gray-900">${group.teamName || 'Reserva'} • ${eventDateStr}</h4>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(group.status, { eventType: 'xtreino-tokens' })}">
                        ${getStatusText(group.status, { eventType: 'xtreino-tokens' })}
                    </span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                    <div>
                        <span class="font-medium">Contato:</span> ${group.email || group.contact || '-'}
                    </div>
                    <div>
                        <span class="font-medium">${group.paidWithTokens ? 'Consumo:' : 'Valor:'}</span> 
                        ${group.paidWithTokens 
                            ? `${group.totalTokens} token${group.totalTokens !== 1 ? 's' : ''}` 
                            : `R$ ${Number(group.price || 0).toFixed(2)}`}
                    </div>
                    <div>
                        <span class="font-medium">Data da compra:</span> ${formatDate(group.date)}
                    </div>
                </div>
                <div class="space-y-2">
                    ${itemsHTML.join('')}
                </div>
            </div>
        `;
    }));

    const paginationHTML = generatePaginationHTML(currentPage, totalPages);
    container.innerHTML = ordersHTML.join('') + paginationHTML;
}

// Generate pagination HTML
function generatePaginationHTML(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    let paginationHTML = '<div class="flex justify-center items-center mt-6 space-x-2">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button onclick="changePage(${currentPage - 1})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Anterior
        </button>`;
    }

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md">
                ${i}
            </button>`;
        } else {
            paginationHTML += `<button onclick="changePage(${i})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                ${i}
            </button>`;
        }
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button onclick="changePage(${currentPage + 1})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Próximo
        </button>`;
    }

    paginationHTML += '</div>';
    return paginationHTML;
}

// Display all products with pagination
function displayAllProductsPaginated(productsData) {
    const container = document.getElementById('allProducts');
    
    if (productsData.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">Nenhum produto encontrado</p>';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(productsData.length / ordersPerPage);
    const startIndex = (currentProductsPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const currentProducts = productsData.slice(startIndex, endIndex);

    // Generate products HTML
    const productsHTML = currentProducts.map(product => `
        <div class="bg-gray-50 rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium text-gray-900">${product.title || 'Produto'}</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status, product)}">
                    ${getStatusText(product.status, product)}
                </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                    <span class="font-medium">Data:</span> ${formatDate(product.date)}
                </div>
                <div>
                    <span class="font-medium">Valor:</span> R$ ${product.price?.toFixed(2) || '0,00'}
                </div>
            </div>
            ${getProductActionButton(product)}
        </div>
    `).join('');

    // Generate pagination HTML for products
    const paginationHTML = generateProductsPaginationHTML(currentProductsPage, totalPages);

    container.innerHTML = productsHTML + paginationHTML;
}


// Generate pagination HTML for products
function generateProductsPaginationHTML(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    let paginationHTML = '<div class="flex justify-center items-center mt-6 space-x-2">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button onclick="changeProductsPage(${currentPage - 1})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Anterior
        </button>`;
    }

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md">
                ${i}
            </button>`;
        } else {
            paginationHTML += `<button onclick="changeProductsPage(${i})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                ${i}
            </button>`;
        }
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button onclick="changeProductsPage(${currentPage + 1})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Próximo
        </button>`;
    }

    paginationHTML += '</div>';
    return paginationHTML;
}

// Generate pagination HTML for WhatsApp links
function generateWhatsAppPaginationHTML(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    let paginationHTML = '<div class="flex justify-center items-center mt-6 space-x-2">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button onclick="changeWhatsAppPage(${currentPage - 1})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Anterior
        </button>`;
    }

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md">
                ${i}
            </button>`;
        } else {
            paginationHTML += `<button onclick="changeWhatsAppPage(${i})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                ${i}
            </button>`;
        }
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button onclick="changeWhatsAppPage(${currentPage + 1})" class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Próximo
        </button>`;
    }

    paginationHTML += '</div>';
    return paginationHTML;
}


async function getWhatsAppLinkForOrder(order) {
    return '';
    try { // eslint-disable-line no-unreachable
        
        
        
        
        // Se o pedido já tem um link salvo e é válido, usar ele
        if (order.whatsappLink && order.whatsappLink.trim()) {
            
            return order.whatsappLink;
        }
        
        // Se não tem link salvo, tentar buscar usando a função getWhatsAppLink do script.js
        if (window.getWhatsAppLink) {
            
            try {
                const dynamicLink = await window.getWhatsAppLink(
                    order.eventType, 
                    order.schedule, 
                    order.eventDate || order.date || null
                );
                
                
                
                if (dynamicLink && dynamicLink.trim()) {
                    
                    return dynamicLink;
                }
            } catch (error) {
                
            }
        } else {
            
        }
        
        // Se ainda não tem link, tentar buscar diretamente no Firestore (fallback)
        try {
            
            const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            
            if (window.firebaseDb) {
                const whatsappLinksRef = collection(window.firebaseDb, 'whatsapp_links');
                // Normalizar parâmetros como no script.js
                // Aceitar `eventType` como objeto ou string (compatível com script.js)
                const rawTypeInput = (typeof order.eventType === 'object' && order.eventType !== null)
                    ? (order.eventType.eventType || order.eventType.type || order.eventType.key || order.eventType.label || order.eventType.name || '')
                    : order.eventType;

                const normalizeType = (t)=> String(t||'').toLowerCase().trim()
                    .replace(/\s+/g,'-')
                    .replace('modo liga','modo-liga')
                    .replace('semanal freitas','semanal-freitas')
                    .replace('camp','camp-freitas');

                const normalizeHour = (h)=>{
                    if (!h) return null;
                    const raw = (typeof h === 'object' && h !== null) ? (h.hour || h.schedule || JSON.stringify(h)) : h;
                    const s = String(raw).toLowerCase().trim();
                    const m = s.match(/(\d{1,2})/);
                    return m ? `${parseInt(m[1],10)}h` : s;
                };

                const type = normalizeType(rawTypeInput);
                const hour = normalizeHour(order.schedule || order.hour || null);
                
                
                
                // Buscar link específico para o horário
                if (hour) {
                    const specificQuery = query(
                        whatsappLinksRef,
                        where('eventType', '==', type),
                        where('schedule', '==', hour),
                        where('status', '==', 'active')
                    );
                    const specificSnapshot = await getDocs(specificQuery);
                    
                    if (!specificSnapshot.empty) {
                        const link = specificSnapshot.docs[0].data().link;
                        
                        return link;
                    }
                }
                
                // Buscar link geral para o evento (schedule = null ou "")
                for (const schedValue of [null, '']) {
                    const generalQuery = query(
                        whatsappLinksRef,
                        where('eventType', '==', type),
                        where('schedule', '==', schedValue),
                        where('status', '==', 'active')
                    );
                    const generalSnapshot = await getDocs(generalQuery);
                    
                    if (!generalSnapshot.empty) {
                        const link = generalSnapshot.docs[0].data().link;
                        
                        return link;
                    }
                }

                
            }
        } catch (error) {
            
        }
        
        // Se não houver link em nenhum lugar, retornar string vazia
        
        return '';
    } catch (error) {
        
        return '';
    }
}

function toBrazilISOString(dateStr) {
  const date = new Date(dateStr);

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);

  const get = type => parts.find(p => p.type === type).value;

  return `${get('year')}-${get('month')}-${get('day')}T` +
         `${get('hour')}:${get('minute')}:${get('second')}-03:00`;
}

// Get appropriate action button for order (events only) - VERSÃO CORRIGIDA
async function getOrderActionButton(order) {
    
    
    // Verificar se é um evento (não produto da loja)
    const title = (order.title || '').toLowerCase();
    const item = (order.item || '').toLowerCase();
    const eventType = (order.eventType || '').toLowerCase();
    
    
    
    // Excluir produtos da loja virtual
    if (title.includes('planilhas') || 
        title.includes('sensibilidades') || 
        title.includes('imagens aéreas') || 
        title.includes('camisa') ||
        (title.includes('token') && eventType !== 'xtreino-tokens') ||
        item.includes('planilhas') || 
        item.includes('sensibilidades') || 
        item.includes('imagens aéreas') || 
        item.includes('camisa') ||
        (item.includes('token') && eventType !== 'xtreino-tokens')) {
        
        return '';
    }
    
    // Verificar se o pedido está confirmado
    if (!(order.status === 'paid' || order.status === 'confirmed' || order.status === 'approved')) {
        
        return '';
    }
    
    
    
    // Obter link do WhatsApp dinamicamente
    const whatsappLink = await getWhatsAppLinkForOrder(order);
    
    
    // Se não houver link, não exibe nada (nem botão, nem span)
    const hasLink = typeof whatsappLink === 'string' && whatsappLink.trim() && whatsappLink.startsWith('http');
    if (!hasLink) {
        
        return '';
    }
    
    // Calcular janela de disponibilidade (agora que sabemos que existe link)
    let isAvailable = false;
    let buttonText = 'Aguardando liberação';
    let buttonClass = 'text-gray-500 bg-gray-100 cursor-not-allowed';
    
    // Verificar se temos data do evento (OBRIGATÓRIO)
    const hasEventDate = order.eventDate && order.eventDate !== '' && order.eventDate !== 'undefined' && order.eventDate !== 'null';
    const scheduleStr = order.schedule || order.hour || '';
    
    
    
    
    // SE NÃO HOUVER DATA DO EVENTO, LINK SEMPRE INDISPONÍVEL
    if (!hasEventDate) {
        
        buttonText = 'Data do evento não disponível';
        buttonClass = 'text-gray-500 bg-gray-100 cursor-not-allowed';
        isAvailable = false;
    } 
    // Se tiver data do evento, calcular disponibilidade
    else {
             
        
        const eventDateTime = new Date(order.eventDate); 
        
        
        if (isNaN(eventDateTime.getTime())) {
            
            buttonText = 'Data/hora do evento inválida';
            buttonClass = 'text-gray-500 bg-gray-100 cursor-not-allowed';
            isAvailable = false;
        } else {          
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');

            const ymd = `${year}-${month}-${day}`;        
            const eventTime = order.eventDate;           
            
            // Disponibilidade: agora <= horário do evento
            if (ymd <= eventTime) {
                isAvailable = true;
                buttonText = 'Entrar no Grupo';
                buttonClass = 'text-green-700 bg-green-100 hover:bg-green-200';
                
            } else {
                // Já expirou - evento passou
                buttonText = 'Link Expirado (Evento já ocorreu)';
                buttonClass = 'text-gray-500 bg-gray-100 cursor-not-allowed';
                isAvailable = false;
                
            }
        }
    }
    
    // Debug final
    
    
    // Retorna o botão (ativo ou desabilitado) apenas se houver link
    return `
        <div class="mt-3 space-y-2">
            ${isAvailable && hasLink ? `
                <a href="${whatsappLink}" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${buttonClass}">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    ${buttonText}
                </a>
            ` : (hasLink ? `
                <span class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${buttonClass}">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    ${buttonText}
                </span>
            ` : '')}
        </div>
    `;
}

// Função auxiliar para validar se uma string é uma data válida
function isValidDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    
    // Tentar diferentes formatos
    const formats = [
        // DD/MM/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        // YYYY-MM-DD
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        // DD-MM-YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    ];
    
    for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
            let day, month, year;
            
            if (format === formats[0]) { // DD/MM/YYYY
                day = parseInt(match[1], 10);
                month = parseInt(match[2], 10) - 1;
                year = parseInt(match[3], 10);
            } else { // YYYY-MM-DD ou DD-MM-YYYY
                day = parseInt(match[3], 10);
                month = parseInt(match[2], 10) - 1;
                year = parseInt(match[1], 10);
            }
            
            // Verificar se é uma data válida
            const date = new Date(year, month, day);
            return date.getDate() === day && 
                   date.getMonth() === month && 
                   date.getFullYear() === year &&
                   !isNaN(date.getTime());
        }
    }
    
    return false;
}
// Get appropriate action button for product
function getProductActionButton(product) {
    const title = (product.title || '').toLowerCase();
    const item = (product.item || '').toLowerCase();
    const cat = (product.productCategory || '').toLowerCase();
    const isPaid = ['paid', 'confirmed', 'approved'].includes(product.status) || product.paidWithTokens === true;

    // Check if it's Sensibilidades
    if (cat === 'sensibilidade' || title.includes('sensibilidades') || title.includes('sensibilidade') || item.includes('sensibilidades') || item.includes('sensibilidade')) {
        if (!isPaid) {
            return `<div class="mt-3"><span class="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Aguardando confirmação do pagamento</span></div>`;
        }
        // Tentar obter o link já em memória (pedido, cache de produtos ou scheduleConfig)
        const platform = product.productOptions?.platform || '';
        const brand = product.productOptions?.brand || '';
        const linkKey = platform === 'android' && brand ? brand : platform;
        const cacheEntry = _productLinksCache?.[product.productId] || {};
        const cfgLinks = window.scheduleConfig?.[product.productId]?.downloadLinks || cacheEntry.downloadLinks || {};
        const cfgLink  = window.scheduleConfig?.[product.productId]?.downloadLink  || cacheEntry.downloadLink  || '';
        const directLink = product.downloadLink
            || product.productOptions?.downloadLink
            || cfgLinks[linkKey]
            || cfgLinks[platform]
            || cfgLink
            || '';
        const onclickFn = directLink
            ? `window.open(${JSON.stringify(directLink)},'_blank')`
            : `downloadSensibilidades('${product.id}')`;
        return `
            <div class="mt-3">
                <button onclick="${onclickFn.replace(/"/g,'&quot;')}" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.703.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Download
                </button>
        </div>
        `;
    }
    
    // Check if it's Imagens Aéreas (categoria 'aereas' ou por título)
    const isAereas = (product.productCategory === 'aereas') ||
                     title.includes('imagens') || title.includes('aéreas') ||
                     item.includes('imagens')  || item.includes('aéreas');
    if (isAereas) {
        if (!isPaid) {
            return `<div class="mt-3"><span class="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Aguardando confirmação do pagamento</span></div>`;
        }
        return `
            <div class="mt-3">
                <button onclick="openImagesSelect('${product.id}')" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                    Selecionar Mapas
                </button>
            </div>
        `;
    }
    
    // Check if it's Planilhas de Análises
    if (title.includes('planilhas') || title.includes('análises') || item.includes('planilhas') || item.includes('análises')) {
        if (!isPaid) {
            return `<div class="mt-3"><span class="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Aguardando confirmação do pagamento</span></div>`;
        }
        return `
            <div class="mt-3">
                <button onclick="downloadPlanilhas('${product.id}')" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Download
                </button>
            </div>
        `;
    }

    // Produto digital genérico (categoria 'digital') com link de download
    const isDigital = cat === 'digital' || cat === 'servico' || cat === 'service';
    if (isDigital && (product.downloadLink || product.productOptions?.downloadLink)) {
        if (!isPaid) {
            return `<div class="mt-3"><span class="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Aguardando confirmação do pagamento</span></div>`;
        }
        return `
            <div class="mt-3">
                <button onclick="downloadProdutoDigital('${product.id}')" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Download
                </button>
            </div>
        `;
    }
    
    // Check if it's Passe Booyah/Elite
    const _passeProductId = (product.productId || '').toLowerCase();
    if (title.includes('passe') || title.includes('booyah') || title.includes('elite') || item.includes('passe') || item.includes('booyah') || item.includes('elite') || _passeProductId.includes('passe') || _passeProductId.includes('booyah')) {
        const isConfirmed = product.booyahConfirmed || false;
        const statusText = isConfirmed ? 'Enviado' : 'Processando';
        const statusColor = isConfirmed ? 'text-green-700 bg-green-100' : 'text-yellow-700 bg-yellow-100';
        const _confirmedDate = product.booyahConfirmedAt
            ? (product.booyahConfirmedAt.toDate ? product.booyahConfirmedAt.toDate() : new Date(product.booyahConfirmedAt)).toLocaleDateString('pt-BR')
            : 'Data não disponível';
        
        return `
            <div class="mt-3">
                <div class="flex items-center justify-between">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                        ${statusText}
                    </span>
                    ${isConfirmed ? `
                        <span class="text-xs text-gray-500">
                            Enviado em: ${_confirmedDate}
                        </span>
                    ` : `
                        <span class="text-xs text-gray-500">
                            Aguardando confirmação
                        </span>
                    `}
                </div>
            </div>
        `;
    }
    
    // Camisa física - exibir status de envio (dados já coletados na compra)
    if (title.includes('camisa') || item.includes('camisa')) {
        const shipped = product.shippingStatus === 'shipped' || product.shirtShipped === true;
        const shippedAt = product.shippedAt || product.shirtShippedAt;
        const shipping = product.shipping || {};
        if (shipped) {
            return `
                <div class="mt-3">
                    <div class="flex items-center justify-between">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-700 bg-green-100">
                            Enviado
                        </span>
                        <span class="text-xs text-gray-500">${shippedAt ? new Date(shippedAt).toLocaleDateString('pt-BR') : ''}</span>
                    </div>
                    ${shipping?.address ? `<p class="text-xs text-gray-500 mt-1">Para: ${shipping.name || ''} - ${shipping.address || ''}, ${shipping.number || ''} - ${shipping.district || ''} - ${shipping.city || ''}/${shipping.state || ''}</p>` : ''}
                </div>
            `;
        }
        return `
            <div class="mt-3">
                <div class="flex items-center justify-between">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-yellow-700 bg-yellow-100">
                        Aguardando envio
                    </span>
                    <span class="text-xs text-gray-500">Admin confirmará o envio</span>
                </div>
                ${shipping?.address 
                    ? `<p class=\"text-xs text-gray-500 mt-1\">Dados recebidos • ${shipping.name || ''} • ${shipping.address || ''}${shipping.shirtName ? ' • Nome na camisa: ' + shipping.shirtName : ''}</p>` 
                    : `<p class=\"text-xs text-gray-500 mt-1\">Dados de entrega serão confirmados pelo admin</p>`}
            </div>
        `;
    }

    return '';
}

// Download function for Planilhas de Análises — via Firestore (sem Netlify)
async function downloadPlanilhas(orderId) {
    try {
        const { doc, getDoc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const orderSnap = await getDoc(doc(window.firebaseDb, 'orders', orderId));
        let downloadLink = null;
        let productId = null;
        if (orderSnap.exists()) {
            const od = orderSnap.data();
            downloadLink = od.downloadLink || od.productOptions?.downloadLink || null;
            productId = od.productId || null;
        }
        if (!downloadLink && productId) {
            const prodSnap = await getDoc(doc(window.firebaseDb, 'products', productId));
            if (prodSnap.exists()) {
                downloadLink = prodSnap.data().downloadLink || null;
            }
        }
        if (!downloadLink) {
            const q = query(collection(window.firebaseDb, 'products'), where('category', '==', 'digital'));
            const snaps = await getDocs(q);
            if (!snaps.empty) downloadLink = snaps.docs[0].data().downloadLink || null;
        }
        if (downloadLink) {
            window.open(downloadLink, '_blank');
        } else {
            alert('Link de download não disponível. Entre em contato com o suporte.');
        }
    } catch (e) {
        alert('Erro ao obter link de download. Tente novamente.');
    }
}

// Download function for Sensibilidades — via Firestore (sem Netlify)
async function downloadSensibilidades(orderId) {
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // 1. Buscar o pedido para obter plataforma/marca e link já salvo
        const orderSnap = await getDoc(doc(window.firebaseDb, 'orders', orderId));
        if (!orderSnap.exists()) {
            alert('Pedido não encontrado. Entre em contato com o suporte.');
            return;
        }
        const od = orderSnap.data();

        // 2. Tentar usar o link armazenado diretamente no pedido (salvo na compra)
        let downloadLink = od.downloadLink || od.productOptions?.downloadLink || null;

        // 3. Se não tiver link no pedido, buscar no produto via plataforma/marca
        if (!downloadLink && od.productId) {
            const prodSnap = await getDoc(doc(window.firebaseDb, 'products', od.productId));
            if (prodSnap.exists()) {
                const prodData = prodSnap.data();
                const platform = od.productOptions?.platform || '';
                const brand = od.productOptions?.brand || '';
                const dlLinks = prodData.downloadLinks || {};
                // Chave: marca (android) ou plataforma (pc/ios)
                const key = platform === 'android' && brand ? brand : platform;
                downloadLink = dlLinks[key] || dlLinks[platform] || prodData.downloadLink || null;
            }
        }

        if (downloadLink && downloadLink.startsWith('http')) {
            window.open(downloadLink, '_blank');
        } else {
            alert('Link de download não disponível. Entre em contato com o suporte.');
        }
    } catch (e) {
        alert('Erro ao obter link de download. Tente novamente.');
    }
}

// Download function for Imagens Aéreas (via proxy; baixa um por vez)
function downloadImagensAereas(orderId) {
    // Buscar lista de arquivos e baixar todos (ou poderia renderizar seleção)
    const listUrl = `/.netlify/functions/download?orderId=${encodeURIComponent(orderId)}&list=1`;
    fetch(listUrl)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const files = Array.isArray(data?.files) ? data.files : [];
        if (files.length === 0) {
          // fallback para primeiro arquivo
          window.location.href = `/.netlify/functions/download?orderId=${encodeURIComponent(orderId)}&i=0`;
          return;
        }
        // Abrir cada arquivo em nova aba (um por mapa comprado)
        files.forEach(f => {
          const url = `/.netlify/functions/download?orderId=${encodeURIComponent(orderId)}&i=${encodeURIComponent(f.index)}`;
          window.open(url, '_blank');
        });
      })
      .catch(() => {
        // fallback
        window.location.href = `/.netlify/functions/download?orderId=${encodeURIComponent(orderId)}&i=0`;
      });
}

// Modal de seleção de mapas — lê mapLinks direto do Firestore (sem Netlify)
const MAP_NAMES_CLIENT = {
    bermuda: 'Bermuda',
    purgatorio: 'Purgatório',
    solara: 'Solara',
    kalahari: 'Kalahari',
    novaTerra: 'Nova Terra'
};

function ensureImagesModal(){
    let modal = document.getElementById('imagesSelectModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'imagesSelectModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-lg w-full p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Selecionar Mapas</h3>
                <button id="imagesSelectClose" class="text-gray-500 hover:text-black text-xl">✕</button>
            </div>
            <div id="imagesSelectBody" class="space-y-2 max-h-72 overflow-auto"></div>
            <div class="mt-5 flex items-center justify-between">
                <button id="imagesSelectAll" class="px-3 py-2 rounded bg-gray-100 text-gray-700 text-sm">Selecionar todos</button>
                <div class="space-x-2">
                    <button id="imagesSelectCancel" class="px-3 py-2 rounded border text-sm">Cancelar</button>
                    <button id="imagesSelectConfirm" class="px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold">Baixar selecionados</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

async function openImagesSelect(orderId) {
    const modal = ensureImagesModal();
    const body = modal.querySelector('#imagesSelectBody');
    const close = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };

    body.innerHTML = '<p class="text-sm text-gray-500 text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando mapas...</p>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
        // Buscar o pedido no Firestore para pegar o productId
        const { doc, getDoc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        let productId = null;
        let mapLinks = null;

        // Tentar pegar direto pela ordem
        const orderSnap = await getDoc(doc(window.firebaseDb, 'orders', orderId));
        if (orderSnap.exists()) {
            const od = orderSnap.data();
            productId = od.productId || od.itemId || null;
            // Se o próprio pedido já tem mapLinks (legado), usar
            if (od.mapLinks && typeof od.mapLinks === 'object') {
                mapLinks = od.mapLinks;
            }
        }

        // Se não tem mapLinks ainda, buscar do produto
        if (!mapLinks && productId) {
            const prodSnap = await getDoc(doc(window.firebaseDb, 'products', productId));
            if (prodSnap.exists()) {
                mapLinks = prodSnap.data().mapLinks || null;
            }
        }

        // Fallback: buscar o produto por nome (Imagens Aéreas) na coleção
        if (!mapLinks) {
            const prodQuery = query(collection(window.firebaseDb, 'products'),
                where('category', '==', 'aereas'));
            const prodSnap = await getDocs(prodQuery);
            if (!prodSnap.empty) {
                mapLinks = prodSnap.docs[0].data().mapLinks || null;
            }
        }

        // Normaliza chaves de mapa (compatibilidade legado: novaterra→novaTerra, alpina→solara)
        const _normalizeMapKey = k => {
            const m = { novaterra: 'novaTerra', alpina: 'solara' };
            return m[k] || k;
        };

        // Mapas que o cliente comprou (ordem.productOptions.maps)
        let purchasedKeys = null;
        if (orderSnap.exists()) {
            const opts = orderSnap.data().productOptions;
            if (Array.isArray(opts?.maps) && opts.maps.length > 0) {
                purchasedKeys = new Set(opts.maps.map(_normalizeMapKey));
            }
        }

        // Monta lista: deve ter link no produto E ter sido comprado (se tiver lista de compra)
        const availableMaps = Object.entries(MAP_NAMES_CLIENT)
            .filter(([key]) => {
                const hasLink = mapLinks && mapLinks[key] && mapLinks[key].trim() !== '';
                const wasPurchased = !purchasedKeys || purchasedKeys.has(key);
                return hasLink && wasPurchased;
            })
            .map(([key, name]) => ({ key, name, url: mapLinks[key] }));

        if (availableMaps.length === 0) {
            const reason = purchasedKeys
                ? 'Os mapas comprados ainda não tiveram os links configurados. Contate o suporte.'
                : 'Nenhum mapa disponível no momento. Contate o suporte.';
            body.innerHTML = `<p class="text-sm text-red-600 text-center py-4"><i class="fas fa-exclamation-triangle mr-2"></i>${reason}</p>`;
            return;
        }

        body.innerHTML = availableMaps.map(m => `
            <label class="flex items-center gap-3 p-3 border rounded-xl hover:bg-orange-50 cursor-pointer">
                <input type="checkbox" data-url="${m.url.replace(/"/g,'&quot;')}" data-name="${m.name}" class="w-4 h-4 accent-orange-500">
                <i class="fas fa-map-marker-alt text-orange-400"></i>
                <span class="text-sm font-medium text-gray-800">${m.name}</span>
            </label>`).join('');

        const btnAll    = modal.querySelector('#imagesSelectAll');
        const btnCancel = modal.querySelector('#imagesSelectCancel');
        const btnClose  = modal.querySelector('#imagesSelectClose');
        const btnConfirm = modal.querySelector('#imagesSelectConfirm');

        btnAll.onclick = () => body.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        btnCancel.onclick = close;
        btnClose.onclick  = close;

        btnConfirm.onclick = () => {
            const selected = Array.from(body.querySelectorAll('input[type="checkbox"]:checked'));
            if (selected.length === 0) { alert('Selecione pelo menos um mapa.'); return; }

            // Abrir primeiro imediatamente; restantes via fila
            const links = selected.map(cb => ({ url: cb.getAttribute('data-url'), name: cb.getAttribute('data-name') }));
            const first = links[0];
            const a = document.createElement('a');
            a.href = first.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display = 'none';
            document.body.appendChild(a); a.click(); a.remove();

            if (links.length > 1) {
                window._mapLinksQueue = links.slice(1);
                _showMapQueueModal();
            }
            close();
        };

    } catch (err) {
        console.error('openImagesSelect erro:', err);
        body.innerHTML = `<p class="text-sm text-red-600 text-center py-4"><i class="fas fa-exclamation-triangle mr-2"></i>Falha ao carregar mapas.<br><span class="text-xs text-gray-400">${err.message || ''}</span></p>`;
    }
}

// Fila de mapas restantes
function _showMapQueueModal() {
    let modal = document.getElementById('_mapQueueModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = '_mapQueueModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
                <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i class="fas fa-map text-orange-500 text-lg"></i>
                </div>
                <h3 class="text-base font-semibold text-gray-900 mb-1">Baixar próximo mapa</h3>
                <p id="_mqInfo" class="text-sm text-gray-500 mb-4"></p>
                <div class="flex gap-2 justify-center">
                    <button id="_mqNext" class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600">Abrir próximo</button>
                    <button id="_mqClose" class="px-4 py-2 border rounded-lg text-sm text-gray-600">Fechar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    const info  = modal.querySelector('#_mqInfo');
    const btnNext  = modal.querySelector('#_mqNext');
    const btnClose = modal.querySelector('#_mqClose');
    const update = () => {
        const rem = Array.isArray(window._mapLinksQueue) ? window._mapLinksQueue.length : 0;
        info.textContent = rem > 0 ? `Restam ${rem} mapa(s). Clique para abrir o próximo.` : 'Todos os mapas foram abertos!';
        btnNext.disabled = rem === 0;
        btnNext.classList.toggle('opacity-40', rem === 0);
    };
    btnNext.onclick = () => {
        if (!window._mapLinksQueue || window._mapLinksQueue.length === 0) return;
        const item = window._mapLinksQueue.shift();
        const a = document.createElement('a');
        a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display = 'none';
        document.body.appendChild(a); a.click(); a.remove();
        update();
    };
    btnClose.onclick = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
    update();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Mantidas por compatibilidade com código existente
function ensureImagesQueueModal() { return document.getElementById('_mapQueueModal') || { querySelector: () => null }; }
function showImagesQueueModal()   { _showMapQueueModal(); }

// Download function for produtos digitais genéricos — via Firestore
async function downloadProdutoDigital(orderId) {
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const orderSnap = await getDoc(doc(window.firebaseDb, 'orders', orderId));
        let downloadLink = null;
        let productId = null;
        if (orderSnap.exists()) {
            const od = orderSnap.data();
            downloadLink = od.downloadLink || od.productOptions?.downloadLink || null;
            productId = od.productId || null;
        }
        if (!downloadLink && productId) {
            const prodSnap = await getDoc(doc(window.firebaseDb, 'products', productId));
            if (prodSnap.exists()) {
                downloadLink = prodSnap.data().downloadLink || null;
            }
        }
        if (downloadLink && downloadLink.startsWith('http')) {
            window.open(downloadLink, '_blank');
        } else {
            alert('Link de download não disponível. Entre em contato com o suporte.');
        }
    } catch (e) {
        alert('Erro ao obter link de download. Tente novamente.');
    }
}

// Expor funções de download no escopo global (para onclick do HTML)
try {
    window.downloadSensibilidades = downloadSensibilidades;
    window.downloadImagensAereas = downloadImagensAereas;
    window.downloadPlanilhas = downloadPlanilhas;
    window.downloadProdutoDigital = downloadProdutoDigital;
    window.openImagesSelect = openImagesSelect;
    window.showImagesQueueModal = showImagesQueueModal;
    window.openShippingModal = function(orderId){
        const modal = document.getElementById('shippingModal');
        if (!modal) return;
        document.getElementById('shippingOrderId').value = orderId || '';
        // Máscaras nos campos
        const cpfEl = document.getElementById('shipCpf');
        const cepEl = document.getElementById('shipCep');
        if (cpfEl) {
            cpfEl.removeEventListener('input', maskCPFHandler);
            cpfEl.addEventListener('input', maskCPFHandler);
        }
        if (cepEl) {
            cepEl.removeEventListener('input', maskCEPHandler);
            cepEl.addEventListener('input', maskCEPHandler);
        }
        // limpar mensagens
        const msg = document.getElementById('shippingMsg'); if (msg) { msg.textContent=''; msg.className='text-sm'; }
        // limpar campos
        ['shipName','shipCpf','shipCep','shipAddress','shipNumber','shipComplement','shipDistrict','shipCity','shipState'].forEach(id=>{
            const el = document.getElementById(id); if (el) el.value = '';
        });
        modal.classList.remove('hidden'); modal.classList.add('flex');
    };
    window.closeShippingModal = function(){
        const modal = document.getElementById('shippingModal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    };
    window.saveShippingDetails = async function(){
        try{
            // Validações
            const cpfRaw = document.getElementById('shipCpf').value.replace(/\D/g,'');
            if (cpfRaw.length !== 11 || !isValidCPF(cpfRaw)){
                const msg = document.getElementById('shippingMsg');
                if (msg){ msg.textContent='CPF inválido'; msg.className='text-sm text-red-600'; }
                return;
            }
            const cepRaw = document.getElementById('shipCep').value.replace(/\D/g,'');
            if (cepRaw.length !== 8){
                const msg = document.getElementById('shippingMsg');
                if (msg){ msg.textContent='CEP inválido (deve ter 8 dígitos)'; msg.className='text-sm text-red-600'; }
                return;
            }
            const address = document.getElementById('shipAddress').value.trim();
            const city = document.getElementById('shipCity').value.trim();
            const state = document.getElementById('shipState').value.trim();
            if (!address || !city || !state){
                const msg = document.getElementById('shippingMsg');
                if (msg){ msg.textContent='Preencha todos os campos obrigatórios (Endereço, Cidade, Estado)'; msg.className='text-sm text-red-600'; }
                return;
            }
            const orderId = document.getElementById('shippingOrderId').value;
            const shipping = {
                name: document.getElementById('shipName').value.trim(),
                shirtName: document.getElementById('shipShirtName')?.value?.trim() || '',
                cpf: cpfRaw,
                cep: cepRaw,
                address: address,
                number: document.getElementById('shipNumber').value.trim(),
                complement: document.getElementById('shipComplement').value.trim(),
                district: document.getElementById('shipDistrict').value.trim(),
                city: city,
                state: state,
            };
            const { doc, updateDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            await updateDoc(doc(collection(window.firebaseDb,'orders'), orderId), {
                shipping,
                shippingStatus: 'pending',
                shippingUpdatedAt: new Date()
            });
            const msg = document.getElementById('shippingMsg'); if (msg){ msg.textContent='Dados salvos!'; msg.className='text-sm text-green-600'; }
            setTimeout(()=>{ closeShippingModal(); }, 900);
            // recarregar produtos na aba
            loadProducts();
        }catch(e){
            const msg = document.getElementById('shippingMsg'); if (msg){ msg.textContent='Erro ao salvar.'; msg.className='text-sm text-red-600'; }
        }
    };
} catch (_) {}

// Funções de máscara e validação para envio de camisa
function maskCPF(v){
    v = v.replace(/\D/g,'');
    if (v.length <= 3) return v;
    if (v.length <= 6) return v.replace(/(\d{3})(\d)/,'$1.$2');
    if (v.length <= 9) return v.replace(/(\d{3})(\d{3})(\d)/,'$1.$2.$3');
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/,'$1.$2.$3-$4');
}
function maskCEP(v){
    v = v.replace(/\D/g,'');
    if (v.length > 5) v = v.replace(/(\d{5})(\d)/,'$1-$2');
    return v;
}
function isValidCPF(cpf){
    cpf = String(cpf).replace(/\D/g,'');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (parseInt(cpf.charAt(9)) !== digit) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    return parseInt(cpf.charAt(10)) === digit;
}
async function fetchAddressFromCEP(cep){
    try{
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) return;
        const addr = document.getElementById('shipAddress'); if (addr) addr.value = data.logradouro || '';
        const dist = document.getElementById('shipDistrict'); if (dist) dist.value = data.bairro || '';
        const city = document.getElementById('shipCity'); if (city) city.value = data.localidade || '';
        const state = document.getElementById('shipState'); if (state) state.value = data.uf || '';
    }catch(_){}
}
// Handlers para os eventos de máscara
const maskCPFHandler = (e) => { e.target.value = maskCPF(e.target.value); };
const maskCEPHandler = async (e) => {
    e.target.value = maskCEP(e.target.value);
    const cep = e.target.value.replace(/\D/g,'');
    if (cep.length === 8) await fetchAddressFromCEP(cep);
};

// Function to get product information from Firestore
async function getProductInfo(productId) {
    try {
        const { collection, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const productDoc = await getDoc(doc(window.firebaseDb, 'products', productId));
        
        if (productDoc.exists()) {
            return productDoc.data();
        } else {
            
            return null;
        }
    } catch (error) {
        
        return null;
    }
}

// Load stats
async function loadStats() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            
            // Mostrar stats padrão se não autenticado
            const totalOrdersElement = document.getElementById('totalOrders');
            const totalSpentElement = document.getElementById('totalSpent');
            const availableTokensElement = document.getElementById('availableTokens');
            const myTokenBalanceElement = document.getElementById('myTokenBalance');
            
            if (totalOrdersElement) totalOrdersElement.textContent = '0';
            if (totalSpentElement) totalSpentElement.textContent = 'R$ 0,00';
            if (availableTokensElement) availableTokensElement.textContent = '0';
            if (myTokenBalanceElement) myTokenBalanceElement.textContent = '0';
            return;
        }
        
        const orders = await fetchUserDocs('orders', 200, false);
        const regs = await fetchUserDocs('registrations', 200, false);
        const regsPaidWithTokens = regs.filter(r => r.data.paidWithTokens === true);
        
        // Filtrar apenas pedidos pagos para o cálculo
        const paidOrders = orders.filter(o => {
            const status = (o.data.status || '').toLowerCase();
            return status === 'paid' || status === 'approved' || status === 'confirmed';
        });
        
        // Filtrar apenas registrations pagos (não pagos com tokens)
        const paidRegs = regs.filter(r => {
            const status = (r.data.status || '').toLowerCase();
            return (status === 'paid' || status === 'approved' || status === 'confirmed') && !r.data.paidWithTokens;
        });
        
        let totalOrders = paidOrders.length + regsPaidWithTokens.length;
        
        // Calcular valor gasto: orders pagos + registrations pagos (não com tokens)
        let totalSpent = paidOrders.reduce((sum, r) => sum + (r.data.total || r.data.amount || 0), 0);
        totalSpent += paidRegs.reduce((sum, r) => sum + (r.data.price || r.data.amount || r.data.total || 0), 0);

        

        const totalOrdersElement = document.getElementById('totalOrders');
        const totalSpentElement = document.getElementById('totalSpent');
        const availableTokensElement = document.getElementById('availableTokens');
        const myTokenBalanceElement = document.getElementById('myTokenBalance');
        
        if (totalOrdersElement) totalOrdersElement.textContent = totalOrders;
        if (totalSpentElement) totalSpentElement.textContent = `R$ ${totalSpent.toFixed(2)}`;
        if (availableTokensElement) availableTokensElement.textContent = userProfile?.tokens || 0;
        if (myTokenBalanceElement) myTokenBalanceElement.textContent = userProfile?.tokens || 0;
    } catch (error) {
        
    }
}

// Helper to fetch user docs handling different owner field names and rule variations
async function fetchUserDocs(colName, max = 50, sortDesc = false){
    // Verificar se o usuário está autenticado
    if (!currentUser || !currentUser.uid) {
        
        return [];
    }
    
    const colRef = collection(db, colName);
    
    // Campos de busca por coleção
    let candidates;
    if (colName === 'orders') {
        candidates = [
            where('customer','==', currentUser.email),
            where('buyerEmail','==', currentUser.email),
            where('userId','==', currentUser.uid),
            where('uid','==', currentUser.uid)
        ];
    } else if (colName === 'registrations') {
        candidates = [
            where('contact','==', currentUser.email),
            where('email','==', currentUser.email),
            where('userId','==', currentUser.uid),
            where('uid','==', currentUser.uid),
            where('membrosUids','array-contains', currentUser.uid)
        ];
    } else {
        candidates = [
            where('userId','==', currentUser.uid),
            where('uid','==', currentUser.uid),
            where('ownerId','==', currentUser.uid)
        ];
    }
    
    
    const resultMap = new Map();
    for (const cond of candidates){
        try{
            const qy = query(colRef, cond);
            const snap = await getDocs(qy);
            
            snap.forEach(d => {
                const data = d.data();
                resultMap.set(d.id, { id: d.id, data });
            });
        }catch(e){
            
        }
    }
    const results = Array.from(resultMap.values());
    const limited = results
        .sort((a,b)=>{
            const at = a.data.createdAt?.toMillis?.() || 0;
            const bt = b.data.createdAt?.toMillis?.() || 0;
            return sortDesc ? bt - at : at - bt;
        })
        .slice(0, max);
    
    return limited;
}

// Load profile
async function loadProfile() {
    // Garantir que o userProfile seja carregado primeiro
    if (!userProfile && currentUser) {
        await loadUserProfile();
    }
    
    if (userProfile) {
        // Preencher campos do formulário
        document.getElementById('profileName').value = userProfile.name || '';
        document.getElementById('profileEmail').value = userProfile.email || '';
        document.getElementById('profilePhone').value = userProfile.phone || '';
        document.getElementById('profileNickname').value = userProfile.nickname || '';
        document.getElementById('profileTeam').value = userProfile.team || '';
        document.getElementById('profileAge').value = userProfile.age || '';
        
        // Atualizar header do perfil
        const name = userProfile.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuário';
        document.getElementById('profileHeaderName').textContent = name;
        document.getElementById('profileHeaderEmail').textContent = userProfile.email || currentUser?.email || '-';
        
        // Foto de perfil ou iniciais
        const photoURL = userProfile.photoURL || userProfile.photoUrl || '';
        const avatarContainer = document.getElementById('profileAvatarContainer');
        const avatarImage = document.getElementById('profileAvatarImage');
        const initialsElement = document.getElementById('profileInitials');
        
        if (photoURL) {
            avatarImage.src = photoURL;
            avatarImage.classList.remove('hidden');
            initialsElement.classList.add('hidden');
        } else {
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
            initialsElement.textContent = initials;
            avatarImage.classList.add('hidden');
            initialsElement.classList.remove('hidden');
        }
        
        // Tokens badge
        const tokens = userProfile.tokens || 0;
        document.getElementById('profileTokensBadge').textContent = `${tokens} Token${tokens !== 1 ? 's' : ''}`;
        
        // Role badge
        const role = userProfile.role || 'user';
        const roleNames = {
            'admin': 'Administrador',
            'gerente': 'Gerente',
            'vendedor': 'Vendedor',
            'socio': 'Sócio',
            'design': 'Designer',
            'user': 'Usuário'
        };
        const roleElement = document.getElementById('profileRoleBadge');
        if (roleElement) {
            roleElement.querySelector('span').textContent = roleNames[role.toLowerCase()] || 'Usuário';
        }
        
        // Carregar estatísticas
        await loadProfileStats();
    }
}

// Load profile statistics
async function loadProfileStats() {
    try {
        if (!currentUser || !currentUser.uid) return;
        
        // Buscar orders e registrations
        const orders = await fetchUserDocs('orders', 200, true);
        const registrations = await fetchUserDocs('registrations', 200, true);
        
        // Filtrar apenas pedidos pagos para o cálculo
        const paidOrders = orders.filter(o => {
            const status = (o.data.status || '').toLowerCase();
            return status === 'paid' || status === 'approved' || status === 'confirmed';
        });
        
        // Filtrar apenas registrations pagos (não pagos com tokens)
        const paidRegs = registrations.filter(r => {
            const status = (r.data.status || '').toLowerCase();
            return (status === 'paid' || status === 'approved' || status === 'confirmed') && !r.data.paidWithTokens;
        });
        
        // Calcular valor gasto: orders pagos + registrations pagos (não com tokens)
        let totalSpent = paidOrders.reduce((sum, o) => sum + (Number(o.data.total || o.data.amount || 0)), 0);
        totalSpent += paidRegs.reduce((sum, r) => sum + (Number(r.data.price || r.data.amount || r.data.total || 0)), 0);
        
        document.getElementById('profileTotalSpent').textContent = 
            totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Eventos participados
        const eventsCount = registrations.filter(r => 
            r.data.status === 'paid' || r.data.status === 'confirmed' || r.data.paidWithTokens === true
        ).length;
        
        document.getElementById('profileEventsCount').textContent = eventsCount;
        
        // Membro desde
        const createdAt = userProfile.createdAt?.toDate?.() || 
                         userProfile.createdAt || 
                         currentUser.metadata?.creationTime;
        
        if (createdAt) {
            const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
            const formatted = date.toLocaleDateString('pt-BR', { 
                month: 'long', 
                year: 'numeric' 
            });
            document.getElementById('profileMemberSince').textContent = 
                formatted.charAt(0).toUpperCase() + formatted.slice(1);
        } else {
            document.getElementById('profileMemberSince').textContent = '-';
        }
    } catch (error) {
        
    }
}

// Reset profile form
function resetProfileForm() {
    if (userProfile) {
        document.getElementById('profileName').value = userProfile.name || '';
        document.getElementById('profilePhone').value = userProfile.phone || '';
        document.getElementById('profileNickname').value = userProfile.nickname || '';
        document.getElementById('profileTeam').value = userProfile.team || '';
        document.getElementById('profileAge').value = userProfile.age || '';
        document.getElementById('profilePhotoInputForm').value = '';
    }
}

// Handle photo upload
async function handlePhotoUpload(event) {
    // Verificar se storage está inicializado
    if (!storage) {
        
        alert('Erro: Storage não inicializado. Recarregue a página.');
        return;
    }
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione uma imagem válida');
        event.target.value = '';
        return;
    }
    
    if (!currentUser || !currentUser.uid) {
        alert('Você precisa estar logado para fazer upload de foto');
        return;
    }
    
    try {
        // Mostrar progresso
        const progressDiv = document.getElementById('photoUploadProgress');
        if (progressDiv) {
            progressDiv.classList.remove('hidden');
        }
        
        // Criar referência no Storage
        const storageRef = ref(storage, `profile-photos/${currentUser.uid}/${Date.now()}_${file.name}`);
        
        // Fazer upload
        const snapshot = await uploadBytes(storageRef, file);
        
        // Obter URL de download
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Deletar foto antiga se existir (usar apenas o path, não a URL completa)
        if (userProfile.photoURL || userProfile.photoUrl) {
            try {
                const oldPhotoURL = userProfile.photoURL || userProfile.photoUrl;
                // Extrair o path do Storage da URL completa
                // Exemplo: https://firebasestorage.googleapis.com/v0/b/.../profile-photos/uid/file.jpg
                // Precisamos apenas: profile-photos/uid/file.jpg
                const urlParts = oldPhotoURL.split('/profile-photos/');
                if (urlParts.length > 1) {
                    const path = `profile-photos/${urlParts[1].split('?')[0]}`;
                    const oldPhotoRef = ref(storage, path);
                    await deleteObject(oldPhotoRef);
                }
            } catch (error) {
                // Ignorar erro se a foto antiga não existir
                
            }
        }
        
        // Atualizar perfil no Firestore
        await setDoc(doc(db, 'users', currentUser.uid), {
            photoURL: downloadURL,
            updatedAt: new Date()
        }, { merge: true });
        
        // Atualizar userProfile local
        userProfile.photoURL = downloadURL;
        
        // Atualizar avatar na tela
        const avatarImage = document.getElementById('profileAvatarImage');
        const initialsElement = document.getElementById('profileInitials');
        if (avatarImage && initialsElement) {
            avatarImage.src = downloadURL;
            avatarImage.classList.remove('hidden');
            initialsElement.classList.add('hidden');
        }
        
        // Esconder progresso
        if (progressDiv) {
            progressDiv.classList.add('hidden');
        }
        
        // Mostrar notificação de sucesso
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        notification.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>Foto de perfil atualizada com sucesso!</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
    } catch (error) {
        
        alert('Erro ao fazer upload da foto. Tente novamente.');
        
        // Esconder progresso
        const progressDiv = document.getElementById('photoUploadProgress');
        if (progressDiv) {
            progressDiv.classList.add('hidden');
        }
    }
    
    // Limpar input
    event.target.value = '';
}

// Tornar função acessível globalmente
window.handlePhotoUpload = handlePhotoUpload;

// Save profile
async function saveProfile(e) {
    e.preventDefault();
    
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            alert('Você precisa estar logado para atualizar o perfil');
            return;
        }
        
        const profileData = {
            name: document.getElementById('profileName').value,
            phone: document.getElementById('profilePhone').value,
            nickname: document.getElementById('profileNickname').value,
            team: document.getElementById('profileTeam').value,
            age: document.getElementById('profileAge').value,
            updatedAt: new Date()
        };

        await setDoc(doc(db, 'users', currentUser.uid), profileData, { merge: true });
        
        // Update userProfile
        userProfile = { ...userProfile, ...profileData };
        
        // Atualizar mensagem de boas-vindas após atualizar perfil
        const welcomeMessageElement = document.getElementById('welcomeMessage');
        if (welcomeMessageElement) {
            const fullName = profileData.name || currentUser.email;
            const firstName = fullName.split(' ')[0]; // Pega apenas o primeiro nome
            welcomeMessageElement.textContent = `Bem-vindo à sua conta, ${firstName}!`;
        }
        
        // Atualizar header do perfil
        const name = profileData.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuário';
        document.getElementById('profileHeaderName').textContent = name;
        
        // Atualizar iniciais
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
        document.getElementById('profileInitials').textContent = initials;
        
        // Mostrar feedback visual
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<svg class="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Salvando...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            // Mostrar notificação de sucesso
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
            notification.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Perfil atualizado com sucesso!</span>
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }, 500);
    } catch (error) {
        
        alert('Erro ao salvar perfil. Tente novamente.');
    }
}

// Load tokens history (purchases)
async function loadTokensHistory() {
    try {
        const container = document.getElementById('tokensHistory');
        if (!container) return;
        
        // Buscar compras de tokens (orders com tipo 'tokens' ou descrição contendo 'token')
        const orders = await fetchUserDocs('orders', 50, true);
        const tokenOrders = orders.filter(o => 
            o.data.itemName?.toLowerCase().includes('token') || 
            o.data.type === 'tokens' ||
            o.data.description?.toLowerCase().includes('token') ||
            o.data.item?.toLowerCase().includes('token')
        );
        
        if (tokenOrders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center">Nenhuma compra de tokens encontrada</p>';
            return;
        }
        
        const historyHTML = tokenOrders.map(order => `
            <div class="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
                <div>
                    <p class="font-medium text-gray-900">${order.data.itemName || 'Compra de Tokens'}</p>
                    <p class="text-sm text-gray-500">${formatDate(order.data.createdAt?.toDate?.() || new Date())}</p>
                </div>
                <div class="text-right">
                    <p class="font-medium text-gray-900">R$ ${order.data.amount?.toFixed(2) || '0,00'}</p>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.data.status, order.data)}">
                        ${getStatusText(order.data.status, order.data)}
                    </span>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = historyHTML;
    } catch (error) {
        
        document.getElementById('tokensHistory').innerHTML = '<p class="text-gray-500 text-center">Erro ao carregar histórico</p>';
    }
}

// Load my tokens (balance)
async function loadMyTokens() {
    // Verificar se o usuário está autenticado
    if (!currentUser || !currentUser.uid) {
        
        // Mostrar 0 tokens se não autenticado
        const balanceElement = document.getElementById('myTokenBalance');
        if (balanceElement) {
            balanceElement.textContent = '0 Tokens';
        }
        return;
    }
    
    // Garantir que o userProfile seja carregado
    if (!userProfile) {
        
        await loadUserProfile();
    }
    
    // Verificar se há tokens não sincronizados
    // checkAndSyncTokens() removido para evitar reset do saldo
    
    if (userProfile) {
        const balanceElement = document.getElementById('myTokenBalance');
        if (balanceElement) {
            balanceElement.textContent = `${userProfile.tokens || 0} Tokens`;
        }
        
    } else {
        
    }
    
    // Carregar histórico de uso dos tokens
    loadTokenUsageHistory();
}

// Função checkAndSyncTokens removida para evitar reset do saldo de tokens
// Esta função estava causando o reset do saldo para o total de tokens comprados

// Load token usage history (eventos com tokens + compras na loja pagas com tokens)
async function loadTokenUsageHistory() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            
            return;
        }
        
        const container = document.getElementById('tokenUsageHistory');
        if (!container) return;
        
        // Buscar registros de uso em eventos (registrations)
        const registrations = await fetchUserDocs('registrations', 200, true);
        const tokenRegs = registrations
          .filter(r => r.data.paidWithTokens === true)
          .map(r => ({
            kind: 'evento',
            title: r.data.title || r.data.eventType || 'Evento',
            date: r.data.createdAt?.toDate?.() || new Date(),
            eventDate: r.data.date || '',
            schedule: r.data.schedule || r.data.hour || r.data.time || '',
            tokensUsed: r.data.tokensUsed || r.data.tokenCost || 1,
            status: r.data.status || 'confirmed'
          }));

        // Buscar compras na loja pagas com tokens (orders)
        const orders = await fetchUserDocs('orders', 200, true);
        const tokenOrders = orders
          .filter(o => o.data.paidWithTokens === true)
          .map(o => ({
            kind: 'produto',
            title: o.data.title || o.data.item || 'Produto',
            date: o.data.createdAt?.toDate?.() || new Date(),
            eventDate: '',
            schedule: '',
            tokensUsed: o.data.tokensUsed || 1,
            status: o.data.status || 'paid'
          }));

        const all = [...tokenRegs, ...tokenOrders]
          .sort((a,b)=> (b.date?.getTime?.()||0) - (a.date?.getTime?.()||0));

        if (all.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <p>Nenhum uso de tokens encontrado</p>
                    <p class="text-sm mt-1">Seus usos de tokens aparecerão aqui</p>
                </div>
            `;
            return;
        }

        const historyHTML = all.map(usage => {
            const when = usage.date || new Date();
            const label = usage.kind === 'produto' ? 'Produto (loja)' : 'Evento';
            const statusColor = getStatusColor(usage.status, usage.kind==='evento' ? { eventType: 'xtreino-tokens' } : null);
            const statusText = getStatusText(usage.status, usage.kind==='evento' ? { eventType: 'xtreino-tokens' } : null);
            return `
                <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                                </svg>
                            </div>
                            <div>
                                <h6 class="font-medium text-gray-900">${usage.title} • ${label}</h6>
                                <p class="text-sm text-gray-500">${formatDate(when)}</p>
                                ${usage.eventDate && usage.schedule ? `<p class="text-xs text-gray-400">${usage.eventDate} às ${usage.schedule}</p>` : ''}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="flex items-center space-x-2">
                                <span class="text-sm font-medium text-yellow-600">-${usage.tokensUsed} token${usage.tokensUsed > 1 ? 's' : ''}</span>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">${statusText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = historyHTML;
    } catch (error) {
        
        document.getElementById('tokenUsageHistory').innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>Erro ao carregar histórico</p>
            </div>
        `;
    }
}

// Logout
async function logout() {
    try {
        await signOut(auth);
        // Show login prompt instead of redirecting
        showLoginPrompt();
    } catch (error) {
        
    }
}

// Show login prompt
function showLoginPrompt() {
    const mainContent = document.querySelector('.max-w-7xl');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="min-h-screen flex items-center justify-center">
                <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                    <div class="mb-6">
                        <svg class="w-16 h-16 mx-auto text-blue-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        <h2 class="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
                        <p class="text-gray-600">Você precisa fazer login para acessar sua área de cliente.</p>
                    </div>
                    <div class="space-y-4">
                        <button onclick="window.location.href='index.html'" class="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                            Ir para Login
                        </button>
                        <button onclick="window.location.href='index.html'" class="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                            Voltar ao Site
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// ==================== SISTEMA DE AFILIADOS ====================

async function loadAffiliateData() {
    try {
        if (!currentUser || !currentUser.uid) {
            
            return;
        }

        // 1. Buscar role (para informações adicionais, mas não bloquear)
        const userRole = await getUserRole(currentUser.uid).catch(() => null);
        const hasAffiliateRole = userRole && (
            (userRole.role && String(userRole.role).toLowerCase().includes('afiliado')) ||
            userRole.affiliate === true ||
            ['active','pending','inactive'].includes(String(userRole.affiliateStatus || '').toLowerCase())
        );

        // 2. Sempre carregar vendas do afiliado (se houver)
        await Promise.all([
            loadAffiliateSales(),      // busca affiliate_sales por currentUser.uid
            loadAffiliateCommissions() // busca affiliate_commissions por currentUser.uid
        ]);

        // 3. Se existir ao menos uma venda OU o cargo autorizar, mostrar a aba
        const temVendas = (window.affiliateSales && window.affiliateSales.length > 0) || 
                         (window.affiliateCommissions && window.affiliateCommissions.length > 0);
        
        const mostrarAba = hasAffiliateRole || temVendas;

        const affiliateTab = document.getElementById('affiliateTab');
        if (!affiliateTab) return;

        if (!mostrarAba) {
            affiliateTab.classList.add('hidden');
            return;
        }

        // 4. Mostrar aba e preencher dados
        affiliateTab.classList.remove('hidden');

        // Gerar link de afiliado
        const affiliateLink = `${window.location.origin}?ref=${currentUser.uid}`;
        const linkInput = document.getElementById('affiliateLink');
        if (linkInput) linkInput.value = affiliateLink;

        // Pré-carregar dados PIX salvos
        try {
            const { doc: _doc, getDoc: _getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const uSnap = await _getDoc(_doc(db, 'users', currentUser.uid));
            if (uSnap.exists()) {
                const ud = uSnap.data();
                const pixKeyEl = document.getElementById('affiliatePixKey');
                const pixNameEl = document.getElementById('affiliatePixAccountName');
                if (pixKeyEl && ud.pixKey) pixKeyEl.value = ud.pixKey;
                if (pixNameEl && ud.pixAccountName) pixNameEl.value = ud.pixAccountName;
            }
        } catch (_) {}

        // Atualizar estatísticas
        updateAffiliateStats();

        // Carregar histórico de saques
        loadAffiliatePayoutsClient().catch(console.error);

        // Listeners
        const salesFilter = document.getElementById('affiliateSalesFilter');
        if (salesFilter) {
            salesFilter.addEventListener('change', () => {
                renderAffiliateSales(window.affiliateSales || []);
            });
        }
        const copyLinkBtn = document.getElementById('copyAffiliateLinkBtn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', copyAffiliateLink);
        }

        

    } catch (error) {
        
    }
}


// Carregar vendas do afiliado
async function loadAffiliateSales() {
    try {
        const { collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const salesRef = collection(db, 'affiliate_sales');
        const q = query(
            salesRef,
            where('affiliateId', '==', currentUser.uid)           
        );

        const snapshot = await getDocs(q);

        const sales = [];
        snapshot.forEach(doc => {
        const data = doc.data();
            sales.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date()
            });
        });

        sales.sort((a, b) => b.createdAt - a.createdAt);

        renderAffiliateSales(sales);
        window.affiliateSales = sales;
        
        // Atualizar estatísticas após carregar vendas
        updateAffiliateStats();
    } catch (error) {
        
        const tbody = document.getElementById('affiliateSalesTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-red-500">Erro ao carregar vendas</td></tr>';
        }
    }
}

// Retorna limiar de data para o filtro de período
function _getAffiliatePeriodFrom(filter) {
    const now = new Date();
    if (filter === 'today') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (filter === '7d')  { const d = new Date(now); d.setDate(d.getDate() - 7);  return d; }
    if (filter === '15d') { const d = new Date(now); d.setDate(d.getDate() - 15); return d; }
    if (filter === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    return null; // 'all' = sem filtro
}

// Renderizar vendas do afiliado
function renderAffiliateSales(sales) {
    const tbody = document.getElementById('affiliateSalesTableBody');
    if (!tbody) return;

    const filter = document.getElementById('affiliateSalesFilter')?.value || 'all';
    const from = _getAffiliatePeriodFrom(filter);
    const filteredSales = from ? sales.filter(s => s.createdAt >= from) : sales;

    if (filteredSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">Nenhuma venda encontrada</td></tr>';
        return;
    }

    tbody.innerHTML = filteredSales.map(sale => {
        const date = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('pt-BR') : 'N/A';
        const statusBadge = sale.status === 'paid' 
            ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Paga</span>'
            : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pendente</span>';

        // Identificar tipo de venda
        const saleTypeIcon = sale.saleType === 'event' ? '📅' : sale.saleType === 'product' ? '🛒' : '📦';
        const saleTypeText = sale.saleType === 'event' ? 'Evento' : sale.saleType === 'product' ? 'Produto' : 'N/A';

        // Link para detalhes do pedido/registro na área do cliente
        const orderLink = sale.orderId ? `client.html?tab=orders&highlightOrder=${encodeURIComponent(sale.orderId)}` : '';

        // Customer display (mailto se houver email)
        const customerDisplay = sale.customerEmail ? `<a href="mailto:${sale.customerEmail}" class="text-blue-600 underline">${sale.customerName || sale.customerEmail}</a>` : (sale.customerName || 'N/A');

        // Product display (link para pedido se houver orderId)
        const productDisplay = orderLink ? `<a href="${orderLink}" class="text-blue-700 font-medium underline" target="_blank" rel="noopener">${sale.productName || sale.productId || 'N/A'}</a>` : (sale.productName || sale.productId || 'N/A');

        // Valores clicáveis levam ao pedido (se houver)
        const saleValueDisplay = orderLink ? `<a href="${orderLink}" target="_blank" rel="noopener" class="text-gray-900">R$ ${(sale.saleValue || 0).toFixed(2)}</a>` : `R$ ${(sale.saleValue || 0).toFixed(2)}`;
        const commissionDisplay = orderLink ? `<a href="${orderLink}" target="_blank" rel="noopener" class="text-green-600">R$ ${(sale.commissionAmount || 0).toFixed(2)}</a>` : `<span class="text-green-600">R$ ${(sale.commissionAmount || 0).toFixed(2)}</span>`;

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">${date}</td>
                <td class="px-4 py-3 text-sm">${customerDisplay}</td>
                <td class="px-4 py-3 text-sm">
                    <div>${productDisplay}</div>
                    <div class="text-xs text-gray-500">${saleTypeIcon} ${saleTypeText}</div>
                </td>
                <td class="px-4 py-3 text-sm font-medium">${saleValueDisplay}</td>
                <td class="px-4 py-3 text-sm">${(sale.commissionRate || 0).toFixed(1)}%</td>
                <td class="px-4 py-3 text-sm font-medium">${commissionDisplay}</td>
                <td class="px-4 py-3 text-sm">${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// Carregar comissões do afiliado
async function loadAffiliateCommissions() {
    try {
        const { collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const commissionsRef = collection(db, 'affiliate_commissions');
        const q = query(
            commissionsRef,
            where('affiliateId', '==', currentUser.uid)           
        );
        const snapshot = await getDocs(q);

        const commissions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            commissions.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date()
            });
        });

        commissions.sort((a, b) => b.createdAt - a.createdAt);

        renderAffiliateCommissions(commissions);
        window.affiliateCommissions = commissions;
    } catch (error) {
        
        const tbody = document.getElementById('affiliateCommissionsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-red-500">Erro ao carregar comissões</td></tr>';
        }
    }
}

// Renderizar comissões do afiliado
function renderAffiliateCommissions(commissions) {
    const tbody = document.getElementById('affiliateCommissionsTableBody');
    if (!tbody) return;

    if (commissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">Nenhuma comissão encontrada</td></tr>';
        return;
    }

    tbody.innerHTML = commissions.map(comm => {
        const date = comm.createdAt ? new Date(comm.createdAt).toLocaleDateString('pt-BR') : 'N/A';
        const statusBadge = comm.status === 'paid' 
            ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Paga</span>'
            : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pendente</span>';
        
        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">${date}</td>
                <td class="px-4 py-3 text-sm font-medium">R$ ${(comm.amount || 0).toFixed(2)}</td>
                <td class="px-4 py-3 text-sm">${statusBadge}</td>
                <td class="px-4 py-3 text-sm">${comm.paymentMethod || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

// Atualizar estatísticas do afiliado (respeita filtro de período ativo)
function updateAffiliateStats() {
    const allSales = window.affiliateSales || [];
    const commissions = window.affiliateCommissions || [];

    // Aplicar mesmo filtro de período da tabela de vendas
    const filter = document.getElementById('affiliateSalesFilter')?.value || 'all';
    const from = _getAffiliatePeriodFrom(filter);
    const sales = from ? allSales.filter(s => s.createdAt >= from) : allSales;

    const totalSales = sales.length;
    const totalCommission = sales.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);

    const pendingCommission = sales
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);

    const paidCommission = sales
        .filter(s => s.status === 'paid')
        .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);

    // Comissões pagas do histórico (affiliate_commissions) — não filtradas por período
    const paidFromCommissions = commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

    const totalPaidCommission = paidCommission + paidFromCommissions;

    const totalSalesEl = document.getElementById('affiliateTotalSales');
    const totalCommissionEl = document.getElementById('affiliateTotalCommission');
    const pendingCommissionEl = document.getElementById('affiliatePendingCommission');
    const paidCommissionEl = document.getElementById('affiliatePaidCommission');

    if (totalSalesEl) totalSalesEl.textContent = totalSales;
    if (totalCommissionEl) totalCommissionEl.textContent = `R$ ${totalCommission.toFixed(2).replace('.', ',')}`;
    if (pendingCommissionEl) pendingCommissionEl.textContent = `R$ ${pendingCommission.toFixed(2).replace('.', ',')}`;
    if (paidCommissionEl) paidCommissionEl.textContent = `R$ ${totalPaidCommission.toFixed(2).replace('.', ',')}`;
}

// Copiar link de afiliado
async function copyAffiliateLink(event) {
    const linkInput = document.getElementById('affiliateLink');
    if (!linkInput) return;

    const link = linkInput.value;
    const button = event?.target?.closest('button') || document.getElementById('copyAffiliateLinkBtn');
    
    try {
        // Usar API moderna do Clipboard se disponível
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(link);
            // Mostrar feedback visual
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check mr-2"></i>Copiado!';
                button.classList.add('bg-green-600');
                button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('bg-green-600');
                    button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                }, 2000);
            } else {
                alert('Link copiado para a área de transferência!');
            }
        } else {
            // Fallback para navegadores antigos
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);
            document.execCommand('copy');
            alert('Link copiado para a área de transferência!');
        }
    } catch (err) {
        
        // Fallback manual
        linkInput.select();
        linkInput.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            alert('Link copiado para a área de transferência!');
        } catch (e) {
            alert('Erro ao copiar link. Selecione e copie manualmente.');
        }
    }
}

// Obter role do usuário
async function getUserRole(uid) {
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        
        return null;
    }
}

// Adicionar listener para filtro de período das vendas
document.addEventListener('DOMContentLoaded', () => {
    const salesFilter = document.getElementById('affiliateSalesFilter');
    if (salesFilter) {
        salesFilter.addEventListener('change', () => {
            if (window.affiliateSales) {
                renderAffiliateSales(window.affiliateSales);
                updateAffiliateStats();
            }
        });
    }
});

// Verificar se é afiliado ao carregar perfil
async function checkAffiliateRole() {
    try {
        // Aguardar um pouco para garantir que o DOM está pronto
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!currentUser || !currentUser.uid) {
            
            return;
        }
        
        
        
        // Verificar se o elemento existe
        const affiliateTab = document.getElementById('affiliateTab');
        if (!affiliateTab) {
            
            // Tentar novamente após um delay
            setTimeout(() => checkAffiliateRole(), 500);
            return;
        }
        
        const userRole = await getUserRole(currentUser.uid);
        
        
        const roleLower = userRole?.role ? String(userRole.role).toLowerCase() : '';
        
        const isAff = (
            (roleLower && roleLower.includes('afiliado')) ||
            userRole?.affiliate === true ||
            ['active','pending','inactive'].includes(String(userRole?.affiliateStatus || '').toLowerCase())
        );
        if (isAff) {
            
            affiliateTab.classList.remove('hidden');
            if (affiliateTab.classList.contains('hidden')) {
                affiliateTab.classList.remove('hidden');
                affiliateTab.style.display = '';
            }
        } else {
            
            affiliateTab.classList.add('hidden');
        }
    } catch (error) {
        
        
    }
}

// Hide login prompt
function hideLoginPrompt() {
    // This function is called when user is logged in
    // The main content is already loaded by loadDashboard()
}

// Helper functions
function formatDate(date) {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Função para persistir perfil do usuário
async function persistUserProfile(profile) {
    try {
        const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        const isNetlify = /netlify\.app$/i.test(location.hostname);
        
        
        
        if (window.firebaseReady && !isLocal && profile?.uid) {
            const { doc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(db, 'users'), profile.uid);
            await setDoc(ref, profile, { merge: true });
            
        } else {
            localStorage.setItem('assoc_profile', JSON.stringify(profile));
            
        }
    } catch(error) {
        
        localStorage.setItem('assoc_profile', JSON.stringify(profile));
    }
}

function getStatusColor(status, orderData = null) {
    // Caso especial para XTreino Tokens - sempre amarelo se for token
    if (orderData) {
        const title = (orderData.title || '').toLowerCase();
        const item = (orderData.item || '').toLowerCase();
        const eventType = (orderData.eventType || '').toLowerCase();
        
        // Se for XTreino Tokens, sempre retornar amarelo
        if (title.includes('xtreino tokens') || item.includes('xtreino tokens') || eventType === 'xtreino-tokens') {
            return 'bg-yellow-100 text-yellow-800';
        }
        
        // Caso especial para Passe Booyah/Elite
        const _scPid = (orderData.productId || '').toLowerCase();
        if (title.includes('passe') || title.includes('booyah') || title.includes('elite') || item.includes('passe') || item.includes('booyah') || item.includes('elite') || _scPid.includes('passe') || _scPid.includes('booyah')) {
            if (orderData.booyahConfirmed) {
                return 'bg-green-100 text-green-800';
            } else {
                return 'bg-yellow-100 text-yellow-800';
            }
        }
    }
    
    switch(status) {
        case 'paid':
        case 'approved':
        case 'confirmed':
            return 'bg-green-100 text-green-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'rejected':
        case 'failed':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function getStatusText(status, orderData = null) {    
    // Caso especial para XTreino Tokens - verificar se é um token independente do status
    if (orderData) {
        const title = (orderData.title || '').toLowerCase();
        const item = (orderData.item || '').toLowerCase();
        const eventType = (orderData.eventType || '').toLowerCase();
        
        // Se for XTreino Tokens, sempre retornar "Token"
        if (title.includes('xtreino tokens') || item.includes('xtreino tokens') || eventType === 'xtreino-tokens') {
            return 'Token';
        }
        
        // Caso especial para Passe Booyah/Elite
        const _stPid = (orderData.productId || '').toLowerCase();
        if (title.includes('passe') || title.includes('booyah') || title.includes('elite') || item.includes('passe') || item.includes('booyah') || item.includes('elite') || _stPid.includes('passe') || _stPid.includes('booyah')) {
            if (orderData.booyahConfirmed) {
                return 'Enviado';
            } else {
                return 'Processando';
            }
        }
    }    
   
    switch(status) {
        case 'paid':
        case 'approved':
        case 'confirmed':
            return 'Pago';
        case 'pending':
            return 'Pendente';
        case 'rejected':
        case 'failed':
            return 'Rejeitado';       
        default:
            return 'Em análise';
    }
}


/**
 * Reconcilia pagamentos pendentes do usuário atual.
 * Varre todos os seus registrations e orders com status pending
 * e que tenham external_reference, e tenta confirmá-los via API.
 */
async function reconcilePendingPayments() {
    if (!currentUser || !currentUser.uid) return;

    try {
        // Buscar registrations e orders pendentes do usuário
        const [registrations, orders] = await Promise.all([
            fetchUserDocs('registrations', 100, false).catch(() => []),
            fetchUserDocs('orders', 100, false).catch(() => [])
        ]);

        const pendingRegs = registrations.filter(r =>
            r.data.status === 'pending' && r.data.external_reference
        );
        const pendingOrders = orders.filter(o =>
            o.data.status === 'pending' && o.data.external_reference
        );

        const allRefs = [
            ...pendingRegs.map(r => r.data.external_reference),
            ...pendingOrders.map(o => o.data.external_reference)
        ];
        const uniqueRefs = [...new Set(allRefs)];
        if (uniqueRefs.length === 0) return;

        for (const ref of uniqueRefs) {
            try {
                // Usa /api/check-payment-status (API Server interno) em vez da Netlify function
                const response = await fetch('/api/check-payment-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ external_reference: ref })
                });
                if (!response.ok) continue;
                const data = await response.json();
                if (data.status === 'approved') {
                    await processSuccessfulPayment(ref);
                }
            } catch (_) { /* ignora erros por ref */ }
            await new Promise(r => setTimeout(r, 200));
        }

        // Recarregar aba atual após reconciliação
        const activeTab = document.querySelector('.tab-content:not(.hidden)')?.id;
        if (activeTab === 'ordersContent') {
            loadOrders();
        } else if (activeTab === 'dashboardContent') {
            loadDashboard();
        }

    } catch (_) { /* ignora */ }
}

async function processSuccessfulPayment(externalRef = null) {
    const extRef = externalRef || sessionStorage.getItem('lastExternalRef');
    
    if (!extRef) return;

    // Recuperar IDs salvos (se houver)
    let regIds = [];
    try {
        const storedIds = sessionStorage.getItem('lastRegIds');
        if (storedIds) regIds = JSON.parse(storedIds);
    } catch(e) {}

    try {
        const { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, writeBatch } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // ── COMPRA DE TOKENS ──
        // Busca direta por ID do documento (external_reference === docId)
        const _uid = auth?.currentUser?.uid || currentUser?.uid;
        const _fdb = window.firebaseDb || db;
        if (_uid && _fdb && extRef) {
            try {
                // Tenta busca direta por doc ID primeiro (sem índice, mais confiável)
                let _oData = null;
                let _oDocId = null;
                try {
                    const _directSnap = await getDoc(doc(_fdb, 'orders', extRef));
                    if (_directSnap.exists()) {
                        _oData = _directSnap.data();
                        _oDocId = _directSnap.id;
                    }
                } catch(_) {}

                // Fallback: query por external_reference (caso external_reference != docId)
                if (!_oData) {
                    try {
                        const _qSnap = await getDocs(query(
                            collection(_fdb, 'orders'),
                            where('external_reference', '==', extRef),
                            where('userId', '==', _uid)
                        ));
                        if (!_qSnap.empty) {
                            _oData = _qSnap.docs[0].data();
                            _oDocId = _qSnap.docs[0].id;
                        }
                    } catch(_) {}
                }

                if (_oData) {
                    const _isTokenOrder = _oData.type === 'tokens_purchase'
                        || String(_oData.title || '').toLowerCase().includes('token')
                        || String(_oData.item || '').toLowerCase().includes('token');
                    if (_isTokenOrder) {
                        const _qty = Number(_oData.quantity || _oData.total || _oData.amount || 0);
                        // Marcar pedido como pago
                        if (_oData.status !== 'paid' && _oDocId) {
                            try { await updateDoc(doc(_fdb, 'orders', _oDocId), { status: 'paid', paidAt: serverTimestamp(), external_reference: extRef }); } catch(_) {}
                        }
                        // Creditar tokens
                        if (_qty > 0) {
                            const _uRef = doc(_fdb, 'users', _uid);
                            const _uSnap = await getDoc(_uRef);
                            const _saldoAtual = Number(_uSnap.exists() ? (_uSnap.data().tokens || 0) : 0);
                            const _novoSaldo = Number((_saldoAtual + _qty).toFixed(2));
                            await updateDoc(_uRef, { tokens: _novoSaldo });
                            if (userProfile) userProfile.tokens = _novoSaldo;
                            if (window.currentUserProfile) window.currentUserProfile.tokens = _novoSaldo;
                            try { localStorage.setItem('assoc_profile', JSON.stringify(window.currentUserProfile || userProfile)); } catch(_) {}
                            const balEl = document.getElementById('myTokenBalance');
                            if (balEl) balEl.textContent = `${_novoSaldo} Tokens`;
                            const avEl = document.getElementById('availableTokens');
                            if (avEl) avEl.textContent = _novoSaldo;
                            showToast('success', `${_qty} token${_qty > 1 ? 's' : ''} creditado${_qty > 1 ? 's' : ''} na sua conta! Saldo: ${_novoSaldo}`, 'Tokens Creditados 🎮', 8000);
                        }
                        try { sessionStorage.removeItem('lastExternalRef'); } catch(_) {}
                        return;
                    }
                }
            } catch(_tokErr) {
                showToast('info', 'Pagamento confirmado! Tokens serão creditados em instantes.', 'Pagamento OK 🎮', 8000);
            }
        }

        // ── PRODUTO DIGITAL (external_reference = "digital_<orderId>") ──
        if (extRef && extRef.startsWith('digital_')) {
            const orderId = extRef.replace('digital_', '');
            const orderRef = doc(window.firebaseDb, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists() && orderSnap.data().status !== 'paid') {
                const orderData = orderSnap.data();
                await updateDoc(orderRef, { status: 'paid', paidAt: serverTimestamp() });
                // Notificar admin se for Passe Booyah
                if (orderData.productId === 'passe-booyah') {
                    try {
                        await addDoc(collection(window.firebaseDb, 'notifications'), {
                            title: '🎮 Novo pedido — Passe Booyah',
                            message: `Cliente: ${orderData.customerName || orderData.customer || 'Desconhecido'} (${orderData.buyerEmail || orderData.customer || ''})\nPlayer ID: ${orderData.productOptions?.playerId || 'Não informado'}\nPedido #${orderId}`,
                            type: 'admin_booyah',
                            createdAt: serverTimestamp()
                        });
                    } catch (_) {}
                }
            }
            // Recarregar pedidos se estiver na aba correta
            const activeTab = document.querySelector('.tab-content:not(.hidden)')?.id;
            if (activeTab === 'ordersContent') loadOrders();
            return;
        }

        // ── EVENTO (registrations) ──
        const regsRef = collection(window.firebaseDb, 'registrations');
        const q = query(
            regsRef,
            where('external_reference', '==', extRef),
            where('userId', '==', auth.currentUser.uid)
        );
        const snap = await getDocs(q);

        const batch = writeBatch(window.firebaseDb);
        snap.forEach(d => {
            const ref = doc(window.firebaseDb, 'registrations', d.id);
            batch.update(ref, { status: 'paid', paidAt: serverTimestamp() });
        });
        if (!snap.empty) await batch.commit();

        // Garantir entrada em orders para eventos
        if (!snap.empty) {
            const firstReg = snap.docs[0].data();
            const ordersRef = collection(window.firebaseDb, 'orders');
            const orderQ = query(ordersRef,
                where('external_reference', '==', extRef),
                where('userId', '==', auth.currentUser.uid)
            );
            const orderSnap2 = await getDocs(orderQ);
            if (orderSnap2.empty) {
                await addDoc(ordersRef, {
                    title: firstReg.title || firstReg.eventType || 'Evento',
                    description: firstReg.title || firstReg.eventType || 'Evento',
                    item: firstReg.title || firstReg.eventType || 'Evento',
                    amount: firstReg.price || 0,
                    total: firstReg.price || 0,
                    quantity: 1,
                    currency: 'BRL',
                    status: 'paid',
                    customer: firstReg.email || firstReg.contact || '',
                    customerName: firstReg.teamName || '',
                    buyerEmail: firstReg.email || '',
                    userId: firstReg.userId || auth.currentUser.uid || null,
                    uid: firstReg.userId || auth.currentUser.uid || null,
                    external_reference: extRef,
                    createdAt: serverTimestamp(),
                    timestamp: Date.now(),
                    type: 'event'
                });
            } else {
                const existingOrder = orderSnap2.docs[0];
                if (existingOrder.data().status !== 'paid') {
                    await updateDoc(doc(window.firebaseDb, 'orders', existingOrder.id), {
                        status: 'paid', paidAt: serverTimestamp()
                    });
                }
            }
        }
    } catch (_) { /* ignora */ }
}

// Token purchase functions - expostas globalmente
window.openTokensPurchaseModal = function() {
    const modal = document.getElementById('tokensPurchaseModal');
    if (modal) modal.classList.remove('hidden');
    // reset resumo
    const summary = document.getElementById('tokensPurchaseSummary');
    if (summary) summary.classList.add('hidden');
    appliedTokenCoupon = null;
    const msg = document.getElementById('tokensCouponMsg'); if (msg){ msg.textContent = ''; msg.className = 'text-xs mt-1 text-gray-500'; }
  selectedTokensQty = 0;
  const buyBtn = document.getElementById('tokensBuyBtn');
  if (buyBtn){ buyBtn.disabled = true; buyBtn.textContent = 'Selecionar quantidade'; }
}

window.closeTokensPurchaseModal = function() {
    const modal = document.getElementById('tokensPurchaseModal');
    if (modal) modal.classList.add('hidden');
}

// Aplicar cupom na compra de tokens
window.applyTokenCoupon = async function(){
  try{
    const codeEl = document.getElementById('tokensCouponCode');
    const msgEl = document.getElementById('tokensCouponMsg');
    const code = (codeEl?.value || '').trim().toUpperCase();
    if (!code){ if(msgEl){ msgEl.textContent='Digite um código de cupom'; msgEl.className='text-xs mt-1 text-red-600'; } return; }
    const { collection, getDocs, query, where, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const couponsRef = collection(window.firebaseDb, 'coupons');
    const q = query(couponsRef, where('code','==', code), limit(1));
    const snap = await getDocs(q);
    if (snap.empty){ if(msgEl){ msgEl.textContent='Cupom não encontrado'; msgEl.className='text-xs mt-1 text-red-600'; } return; }
    const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
    // validações
    if (!data.isActive){ msgEl.textContent='Cupom inativo'; msgEl.className='text-xs mt-1 text-red-600'; return; }
    if (data.expirationDate){ const exp = data.expirationDate.toDate ? data.expirationDate.toDate() : new Date(data.expirationDate); if (exp < new Date()){ msgEl.textContent='Cupom expirado'; msgEl.className='text-xs mt-1 text-red-600'; return; } }
    const usage = (data.usageType||'both').toLowerCase();
    if (!(usage==='both' || usage==='tokens' || usage==='store')){ /* allow by default */ }
    // salvar
    appliedTokenCoupon = {
      id: data.id,
      code: data.code,
      discountType: data.discountType,
      discountValue: Number(data.discountValue||0)
    };
    if (msgEl){ msgEl.textContent = `Cupom aplicado: ${data.code}`; msgEl.className='text-xs mt-1 text-green-600'; }
    // mostrar resumo com valores
    updateTokensPurchaseSummary();
  }catch(e){
    const msgEl = document.getElementById('tokensCouponMsg');
    if (msgEl){ msgEl.textContent='Erro ao aplicar cupom'; msgEl.className='text-xs mt-1 text-red-600'; }
  }
}

function updateTokensPurchaseSummary(quantity){
  // quantidade usada na UI é definida quando o usuário clica nos botões; como não temos o estado aqui,
  // apenas mostramos resumo vazio; o valor final será recalculado no momento da compra.
  const subtotalEl = document.getElementById('tokensSubtotal');
  const discountRow = document.getElementById('tokensDiscountRow');
  const discountEl = document.getElementById('tokensDiscount');
  const totalEl = document.getElementById('tokensTotal');
  const summary = document.getElementById('tokensPurchaseSummary');
  if (!summary) return;
  const base = typeof quantity === 'number' && quantity>0 ? quantity : selectedTokensQty || 0;
  const discount = appliedTokenCoupon ? (appliedTokenCoupon.discountType==='percentage' ? base*(appliedTokenCoupon.discountValue/100) : appliedTokenCoupon.discountValue) : 0;
  const total = Math.max(0, base - discount);
  if (subtotalEl) subtotalEl.textContent = base.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  if (discountRow) discountRow.style.display = appliedTokenCoupon ? '' : 'none';
  if (discountEl) discountEl.textContent = `- ${discount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  summary.classList.remove('hidden');
  const buyBtn = document.getElementById('tokensBuyBtn');
  if (buyBtn){
    const totalFmt = total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    buyBtn.disabled = base <= 0;
    buyBtn.textContent = base > 0 ? `Comprar ${base} token${base>1?'s':''} por ${totalFmt}` : 'Selecionar quantidade';
  }
}

// Selecionar quantidade antes de comprar
window.setSelectedTokensQty = function(qty){
  selectedTokensQty = qty;
  updateTokensPurchaseSummary(qty);
}

window.purchaseTokens = async function(quantity) {
    try {
        // Re-initialize Firebase if needed
        if (!db) {
            
            initializeFirebase();
            if (!db) { alert('Erro: Firebase não foi inicializado. Recarregue a página.'); return; }
        }

        // Determine base quantity and price (R$1 per token)
        const baseQty = Number(quantity || selectedTokensQty || 0);
        if (!baseQty || baseQty <= 0) { alert('Selecione a quantidade de tokens'); return; }
        let price = baseQty * 1.00;
        if (appliedTokenCoupon) {
            const discount = appliedTokenCoupon.discountType === 'percentage'
                ? price * (appliedTokenCoupon.discountValue / 100)
                : appliedTokenCoupon.discountValue;
            price = Math.max(0, Number((price - discount).toFixed(2)));
        }

        // Ensure authenticated
        const currentUser = auth?.currentUser;
        if (!currentUser) { alert('Você precisa estar logado para comprar tokens'); return; }

        const activeAffiliateCode = getActiveAffiliateCode(); // sem parâmetro, usa stored ou null       

        // 1) Create order in Firestore before requesting preference
        const orderData = {
            title: `${baseQty} Token${baseQty > 1 ? 's' : ''} XTreino`,
            description: `${baseQty} Token${baseQty > 1 ? 's' : ''} XTreino`,
            item: `${baseQty} Token${baseQty > 1 ? 's' : ''} XTreino`,
            type: 'tokens_purchase',
            amount: price,
            total: price,
            quantity: baseQty,
            currency: 'BRL',
            status: 'pending',
            customer: currentUser.email,
            buyerEmail: currentUser.email,
            userId: currentUser.uid,
            uid: currentUser.uid,
            createdAt: new Date(),
            timestamp: Date.now(),
            affiliateCode: activeAffiliateCode || null
        };

        let savedOrderId = null;
        try {
            const docRef = await addDoc(collection(db, 'orders'), orderData);
            savedOrderId = docRef.id;
            // Gravar external_reference imediatamente (antes de chamar a Netlify function)
            try {
                await updateDoc(doc(db, 'orders', savedOrderId), {
                    external_reference: savedOrderId,
                    type: 'tokens_purchase'
                });
            } catch(_) {}
        } catch (err) {
            savedOrderId = `tokens_${currentUser.uid}_${Date.now()}`;
        }

        // 2) Request server-side to create Mercado Pago preference and pass external_reference as order id
        
        const payload = {
        title: `${baseQty} Token${baseQty > 1 ? 's' : ''} XTreino`,
        quantity: baseQty, // COMO ESTAVA ANTES quantity: 1 isso faz que a quantidade de tokens sempre seja 1 independente do selecionado
        unit_price: 1,
        currency_id: 'BRL',
        back_url: window.location.origin + window.location.pathname,
        external_reference: savedOrderId,
        // Identificação do usuário para o fallback do create-preference e webhook
        userId: currentUser.uid,
        customerEmail: currentUser.email,
        coupon_info: appliedTokenCoupon ? {
                id: appliedTokenCoupon.id,
                code: appliedTokenCoupon.code,
                discountType: appliedTokenCoupon.discountType,
                discountValue: appliedTokenCoupon.discountValue,
                context: 'tokens',
                // Redundância de identificação também dentro do coupon_info
                userId: currentUser.uid,
                email: currentUser.email
            } : undefined
        };

        // Mark this as tokens purchase to help webhook/server-side handling
        payload.type = 'tokens_purchase';
        
        const response = await fetch('/.netlify/functions/create-preference', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Erro ao criar preferência');
        const data = await response.json();

        if (!data || !data.init_point) {
            // mark order as error
            if (savedOrderId && db) {
                try { const ordRef = doc(db, 'orders', savedOrderId); await updateDoc(ordRef, { status: 'error' }); } catch(_) {}
            }
            showToast('error', 'Erro ao iniciar pagamento. Tente novamente.', 'Erro');
            return;
        }

        // 3) Save preference metadata into order and redirect
        try {
            if (savedOrderId && db) {
                const ordRef = doc(db, 'orders', savedOrderId);
                await updateDoc(ordRef, { external_reference: data.external_reference || savedOrderId, preference_id: data.id, paymentUrl: data.init_point });
            }
        } catch (updErr) {
            
        }

        closeTokensPurchaseModal();
        // Salvar referência para processar o retorno do MP
        const _finalExtRef = data.external_reference || savedOrderId;
        try { sessionStorage.setItem('lastCheckoutUrl', data.init_point); } catch(_) {}
        try { sessionStorage.setItem('lastExternalRef', _finalExtRef); } catch(_) {}
        // Redirecionar na mesma aba (evita popup bloqueado / card branco)
        window.location.href = data.init_point;
    } catch (error) {
        
        showToast('error', `Erro ao processar compra de tokens: ${error && error.message ? error.message : String(error)}`, 'Erro');
    }
}

const _AFF_KEY    = 'xf_affiliate_ref';
const _AFF_TS_KEY = 'xf_affiliate_ref_ts';
const _AFF_TTL    = 30 * 24 * 60 * 60 * 1000; // 30 dias

function getStoredAffiliateRef() {
    try {
        const ref = sessionStorage.getItem(_AFF_KEY) || localStorage.getItem(_AFF_KEY);
        if (!ref) return null;
        const tsStr = sessionStorage.getItem(_AFF_TS_KEY) || localStorage.getItem(_AFF_TS_KEY);
        const ts = tsStr ? parseInt(tsStr, 10) : null;
        if (ts && (Date.now() - ts) > _AFF_TTL) {
            try { localStorage.removeItem(_AFF_KEY); localStorage.removeItem(_AFF_TS_KEY); } catch(_) {}
            try { sessionStorage.removeItem(_AFF_KEY); sessionStorage.removeItem(_AFF_TS_KEY); } catch(_) {}
            return null;
        }
        return ref;
    } catch (_) { return null; }
}

function getActiveAffiliateCode(preferredAffiliateId = null) {
    if (preferredAffiliateId) return preferredAffiliateId;
    const storedRef = getStoredAffiliateRef();
    if (!storedRef) return null;
    const currentUid = window.currentUserProfile?.uid || window.firebaseAuth?.currentUser?.uid || null;
    if (currentUid && storedRef === currentUid) return null; // evita auto-comissão
    return storedRef;
}

// Funções de paginação expostas globalmente
window.changePage = async function(page) {
    currentPage = page;
    await displayAllOrdersPaginated();
};

window.changeProductsPage = function(page) {
    currentProductsPage = page;
    loadProducts();
};

window.changeWhatsAppPage = function(page) {
    currentWhatsAppPage = page;
    loadWhatsAppLinks(allOrdersData);
};

// Compra rápida de tokens (botões diretos) - exposta globalmente
window.purchaseTokensQuick = async function(quantity) {
    try {
        // Verificar se Firebase está inicializado
        if (!db) {
            
            initializeFirebase();
            if (!db) {
                alert('Erro: Firebase não foi inicializado. Recarregue a página.');
                return;
            }
        }
        
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('Você precisa estar logado para comprar tokens');
            return;
        }

        const price = quantity * 1.00; // R$ 1,00 por token
        
        // Confirmar compra
        const confirmMessage = `Confirmar compra de ${quantity} token${quantity > 1 ? 's' : ''} por R$ ${price.toFixed(2)}?`;
        if (!confirm(confirmMessage)) {
            return;
        }

        // Criar preferência de pagamento
        const prefPayload = {
            items: [{ title: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`, quantity, unit_price: 1.00 }],
            external_reference: `tokens_${currentUser.uid}_${Date.now()}`,
            type: 'tokens_purchase',
            // Garantir que o backend saiba quem é o dono do pedido mesmo em fallback
            userId: currentUser.uid,
            customerEmail: currentUser.email
        };
        
        const response = await fetch('/.netlify/functions/create-preference', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefPayload)
        });

        const data = await response.json();
        
        if (data.init_point) {
            // Salvar order no Firestore ANTES de redirecionar
            try {
                     
                if (currentUser && db) {
                    const activeAffiliateCode = getActiveAffiliateCode(); // sem parâmetro, usa stored ou null

                    const orderData = {
                    title: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                    description: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                    item: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                    amount: price,
                    total: price,
                    quantity: quantity,
                    currency: 'BRL',
                    status: 'pending',
                    external_reference: data.external_reference,
                    preference_id: data.id,
                    customer: currentUser.email,
                    buyerEmail: currentUser.email,
                    userId: currentUser.uid,
                    uid: currentUser.uid,
                    createdAt: new Date(),
                    timestamp: Date.now(),
                    affiliateCode: activeAffiliateCode || null
                };
                
                    
                    const docRef = await addDoc(collection(db, 'orders'), orderData);
                    
                } else {
                    
                    
                    
                }
            } catch (firestoreError) {
                
                console.error('❌ Error details:', {
                    message: firestoreError.message,
                    code: firestoreError.code,
                    stack: firestoreError.stack
                });
                showToast('error', `Erro ao salvar pedido antes do pagamento: ${firestoreError && firestoreError.message ? firestoreError.message : String(firestoreError)}`, 'Erro');
                // Continuar mesmo se der erro no Firestore
            }
            
            // Redirecionar na mesma aba (evita popup bloqueado / card branco)
            try { sessionStorage.setItem('lastCheckoutUrl', data.init_point); } catch(_) {}
            try { sessionStorage.setItem('lastExternalRef', data.external_reference || prefPayload.external_reference); } catch(_) {}
            window.location.href = data.init_point;
        } else {
            showToast('error', 'Erro ao iniciar pagamento. Tente novamente.', 'Erro');
        }
    } catch (error) {
        
        showToast('error', `Erro ao processar compra rápida: ${error && error.message ? error.message : String(error)}`, 'Erro');
    }
}

// ==================== NOTIFICATION SYSTEM ====================
let _notifUnsubscribe = null;

async function loadNotifications() {
    if (!currentUser || !db) return;
    const listEl = document.getElementById('notificationsList');
    if (!listEl) return;

    listEl.innerHTML = `<div class="flex items-center justify-center py-12 text-gray-400">
        <div class="text-center"><i class="fas fa-spinner fa-spin text-3xl mb-3 block"></i><p class="text-sm">Carregando...</p></div>
    </div>`;

    try {
        const notifRef = collection(db, 'notifications');
        const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);

        const readsRef = collection(db, 'notificationReads');
        const readsQ = query(readsRef, where('userId', '==', currentUser.uid));
        const readsSnap = await getDocs(readsQ);
        const readIds = new Set(readsSnap.docs.map(d => d.data().notifId));

        const notifs = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.type === 'all' || data.targetUserId === currentUser.uid) {
                notifs.push({ id: d.id, ...data, isRead: readIds.has(d.id) });
            }
        });

        renderNotifications(notifs, readIds);
        updateBellCounter(notifs.filter(n => !n.isRead).length);
    } catch (err) {
        console.error('Erro ao carregar notificações:', err);
        listEl.innerHTML = `<div class="flex items-center justify-center py-12 text-gray-400">
            <p class="text-sm">Não foi possível carregar notificações.</p>
        </div>`;
    }
}

function renderNotifications(notifs, readIds) {
    const listEl = document.getElementById('notificationsList');
    if (!listEl) return;

    if (notifs.length === 0) {
        listEl.innerHTML = `<div class="flex items-center justify-center py-16 text-gray-400">
            <div class="text-center">
                <i class="fas fa-bell-slash text-4xl mb-3 block"></i>
                <p class="text-sm font-medium">Nenhuma notificação</p>
                <p class="text-xs mt-1">Você será notificado sobre novidades e eventos aqui</p>
            </div>
        </div>`;
        return;
    }

    listEl.innerHTML = notifs.map(n => {
        const isRead = n.isRead || readIds.has(n.id);
        const dateStr = n.createdAt ? new Date(n.createdAt.toDate ? n.createdAt.toDate() : n.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const isCredentials = n.notifyType === 'credentials' || n.notifyType === 'finalists';
        const isTabela = n.notifyType === 'tabela';

        // Card de tabela pronta (verde) — aparece sempre que houver tabelaLink OU notifyType === 'tabela'
        const mostrarTabela = isTabela || !!n.tabelaLink;
        let tabelaHtml = '';
        if (mostrarTabela) {
            const btnTabela = n.tabelaLink
                ? `<a href="${escapeHtml(n.tabelaLink)}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 28px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:50px;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 4px 14px rgba(22,163,74,0.4);transition:transform 0.15s,box-shadow 0.15s;letter-spacing:0.3px"
                       onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(22,163,74,0.5)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(22,163,74,0.4)'">
                        <i class="fas fa-table"></i> Ver Tabela
                   </a>`
                : `<span style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:#d1fae5;color:#166534;border-radius:50px;font-size:13px;font-weight:700">
                        <i class="fas fa-table"></i> Tabela em breve
                   </span>`;
            tabelaHtml = `
                <div style="margin-top:12px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:16px;padding:16px">
                    <p style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
                        <i class="fas fa-table"></i> Tabela de pontuação disponível!
                    </p>
                    ${btnTabela}
                </div>`;
        }

        let credentialsHtml = '';
        if (isCredentials) {
            const hasRoomId = n.roomId && String(n.roomId).trim();
            const hasRoomPassword = n.roomPassword && String(n.roomPassword).trim();
            const linkBtn = n.roomLink
                ? `<a href="${escapeHtml(n.roomLink)}" target="_blank" rel="noopener noreferrer"
                      class="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow transition-all">
                      <i class="fas fa-external-link-alt"></i> Entrar na Sala
                   </a>`
                : '';
            const idBox = `<div style="flex:1;background:#fff;border:2px solid #c4b5fd;border-radius:12px;padding:12px;text-align:center;min-width:0">
                <div style="font-size:10px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">🎮 ID da Sala</div>
                <div style="font-size:26px;font-weight:900;color:#4c1d95;font-family:monospace;letter-spacing:3px;user-select:all;word-break:break-all">${escapeHtml(hasRoomId ? String(n.roomId) : '—')}</div>
            </div>`;
            const pwBox = `<div style="flex:1;background:#fff;border:2px solid #a5b4fc;border-radius:12px;padding:12px;text-align:center;min-width:0">
                <div style="font-size:10px;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">🔑 Senha</div>
                <div style="font-size:26px;font-weight:900;color:#312e81;font-family:monospace;letter-spacing:3px;user-select:all;word-break:break-all">${escapeHtml(hasRoomPassword ? String(n.roomPassword) : '—')}</div>
            </div>`;
            // Lista de slots (vagas) enviada junto com as credenciais
            let slotListHtml = '';
            if (Array.isArray(n.slotList) && n.slotList.length > 0) {
                const isLiga = n.slotList.length === 15;
                const rows = n.slotList.map((s, idx) => {
                    const label = isLiga
                        ? `Letra ${String.fromCharCode(65 + idx)}`
                        : `Slot ${idx + 1}`;
                    const teamDisplay = s.teamName
                        ? `<span style="font-weight:700;color:#1e1b4b">${escapeHtml(s.teamName)}</span>`
                        : `<span style="color:#9ca3af;font-style:italic">Vaga livre</span>`;
                    return `<tr style="border-top:1px solid #e0d9f7">
                        <td style="padding:5px 8px;font-size:12px;font-weight:700;color:#7c3aed;white-space:nowrap">${label}</td>
                        <td style="padding:5px 8px;font-size:13px">${teamDisplay}</td>
                    </tr>`;
                }).join('');
                slotListHtml = `
                <div style="margin-top:10px;background:#f5f3ff;border:1.5px solid #c4b5fd;border-radius:12px;overflow:hidden">
                    <div style="padding:8px 12px;background:#7c3aed;display:flex;align-items:center;gap:6px">
                        <i class="fas fa-list-ol" style="color:#e9d5ff;font-size:11px"></i>
                        <span style="font-size:10px;font-weight:800;color:#e9d5ff;text-transform:uppercase;letter-spacing:1px">Lista de Times</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse">${rows}</table>
                </div>`;
            }
            credentialsHtml = `
                <div style="margin-top:12px;background:linear-gradient(135deg,#f5f3ff,#eef2ff);border:2px solid #c4b5fd;border-radius:16px;padding:16px">
                    <p style="font-size:10px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;display:flex;align-items:center;gap:4px">
                        <i class="fas fa-gamepad"></i> Credenciais da Sala
                    </p>
                    <div style="display:flex;gap:10px;margin-bottom:8px">
                        ${idBox}
                        ${pwBox}
                    </div>
                    ${linkBtn}
                    ${slotListHtml}
                </div>`;
        }

        const iconClass = isCredentials ? 'fa-gamepad' : isTabela ? 'fa-table' : 'fa-bell';
        const iconBg = isCredentials
            ? (isRead ? 'bg-purple-100 text-purple-400' : 'bg-purple-200 text-purple-700')
            : isTabela
            ? (isRead ? 'bg-green-100 text-green-400' : 'bg-green-200 text-green-700')
            : (isRead ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600');

        // Para tabela, a mensagem já vai dentro do card verde — não duplicar
        const messageHtml = (!mostrarTabela && n.message)
            ? `<p class="text-sm text-gray-600 mt-1 leading-relaxed">${escapeHtml(n.message)}</p>`
            : '';

        return `<div class="${isRead ? 'bg-white' : 'bg-blue-50 border-l-4 border-l-blue-500'} hover:bg-gray-50 transition-colors px-6 py-4" data-notif-id="${n.id}">
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0 mt-1">
                    <div class="w-9 h-9 rounded-full flex items-center justify-center ${iconBg}">
                        <i class="fas ${iconClass} text-sm"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                        <p class="font-semibold text-sm ${isRead ? 'text-gray-900' : 'text-blue-900'}">${escapeHtml(n.title || 'Notificação')}</p>
                        <span class="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">${dateStr}</span>
                    </div>
                    ${messageHtml}
                    ${credentialsHtml}
                    ${tabelaHtml}
                    <div class="mt-2">
                        ${!isRead ? `<button onclick="markNotificationRead('${n.id}')" class="text-xs text-blue-600 hover:text-blue-800 font-medium">Marcar como lida</button>` : `<span class="text-xs text-gray-400">Lida</span>`}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function markNotificationRead(notifId) {
    if (!currentUser || !db || !notifId) return;
    try {
        const readDocId = `${currentUser.uid}_${notifId}`;
        const readRef = doc(db, 'notificationReads', readDocId);
        await setDoc(readRef, {
            userId: currentUser.uid,
            notifId: notifId,
            readAt: new Date()
        }, { merge: true });
        await loadNotifications();
    } catch (err) {
        console.error('Erro ao marcar notificação como lida:', err);
    }
}

async function markAllNotificationsRead() {
    if (!currentUser || !db) return;
    const items = document.querySelectorAll('[data-notif-id]');
    if (items.length === 0) { showToast('info', 'Nenhuma notificação para marcar.', 'Notificações'); return; }
    try {
        const promises = [];
        items.forEach(el => {
            const notifId = el.getAttribute('data-notif-id');
            if (notifId) {
                const readDocId = `${currentUser.uid}_${notifId}`;
                const readRef = doc(db, 'notificationReads', readDocId);
                promises.push(setDoc(readRef, { userId: currentUser.uid, notifId, readAt: new Date() }, { merge: true }));
            }
        });
        await Promise.all(promises);
        await loadNotifications();
        showToast('success', 'Todas as notificações foram marcadas como lidas.', 'Notificações');
    } catch (err) {
        console.error('Erro ao marcar todas como lidas:', err);
        showToast('error', 'Erro ao marcar notificações.', 'Erro');
    }
}

function updateBellCounter(count) {
    const badge = document.getElementById('notifBadge');
    const tabBadge = document.getElementById('notifTabBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    if (tabBadge) {
        if (count > 0) {
            tabBadge.textContent = count > 99 ? '99+' : count;
            tabBadge.classList.remove('hidden');
        } else {
            tabBadge.classList.add('hidden');
        }
    }
}

async function initNotificationCounter() {
    if (!currentUser || !db) return;
    try {
        const notifRef = collection(db, 'notifications');
        const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);

        const readsRef = collection(db, 'notificationReads');
        const readsQ = query(readsRef, where('userId', '==', currentUser.uid));
        const readsSnap = await getDocs(readsQ);
        const readIds = new Set(readsSnap.docs.map(d => d.data().notifId));

        let unread = 0;
        snap.forEach(d => {
            const data = d.data();
            if ((data.type === 'all' || data.targetUserId === currentUser.uid) && !readIds.has(d.id)) {
                unread++;
            }
        });
        updateBellCounter(unread);
    } catch (_) {}
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.switchTab = switchTab;

// Auto-refresh de pedidos quando o usuário retorna à aba (ex: veio do admin e voltou)
let _ordersAutoRefreshInterval = null;

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        const activeTab = document.querySelector('[data-tab].border-blue-600');
        const tabName = activeTab ? activeTab.getAttribute('data-tab') : '';
        if (tabName === 'orders') {
            loadOrders().catch(console.error);
        }
    }
});

// Mantém refresh a cada 45s enquanto a aba "pedidos" está aberta
function _startOrdersAutoRefresh() {
    _stopOrdersAutoRefresh();
    _ordersAutoRefreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadOrders().catch(console.error);
        }
    }, 45000);
}
function _stopOrdersAutoRefresh() {
    if (_ordersAutoRefreshInterval) { clearInterval(_ordersAutoRefreshInterval); _ordersAutoRefreshInterval = null; }
}

// ============================================================
// SISTEMA DE SAQUES DE AFILIADOS
// ============================================================

async function saveAffiliatePix() {
    const pixKey = (document.getElementById('affiliatePixKey')?.value || '').trim();
    const pixAccountName = (document.getElementById('affiliatePixAccountName')?.value || '').trim();
    const statusEl = document.getElementById('affiliatePixStatus');
    const btn = document.getElementById('saveAffiliatePixBtn');

    if (!pixKey || !pixAccountName) {
        alert('Preencha a chave PIX e o nome do titular antes de salvar.');
        return;
    }
    try {
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Salvando...'; }
        const { doc: _doc, updateDoc: _updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await _updateDoc(_doc(db, 'users', currentUser.uid), {
            pixKey,
            pixAccountName,
            updatedAt: new Date()
        });
        if (statusEl) { statusEl.classList.remove('hidden'); setTimeout(() => statusEl.classList.add('hidden'), 3000); }
    } catch (err) {
        console.error('Erro ao salvar PIX:', err);
        alert('Erro ao salvar dados PIX. Tente novamente.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-1"></i>Salvar dados'; }
    }
}

async function requestAffiliatePayout() {
    const amountRaw = document.getElementById('affiliatePayoutAmount')?.value;
    const amount = parseFloat(amountRaw);
    const pixKey = (document.getElementById('affiliatePixKey')?.value || '').trim();
    const pixAccountName = (document.getElementById('affiliatePixAccountName')?.value || '').trim();
    const msgEl = document.getElementById('affiliatePayoutMsg');
    const btn = document.getElementById('affiliateRequestPayoutBtn');

    function showMsg(text, type) {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.className = `text-sm mt-3 font-medium ${type === 'error' ? 'text-red-600' : 'text-green-600'}`;
    }

    if (!pixKey || !pixAccountName) {
        showMsg('Salve sua chave PIX e nome do titular antes de solicitar o saque.', 'error');
        return;
    }
    if (!amount || amount < 25) {
        showMsg('O valor mínimo para saque é R$ 25,00.', 'error');
        return;
    }

    // Verificar saldo total disponível (comissões paid + pending)
    const availableBalance = (window.affiliateSales || [])
        .filter(s => s.status === 'paid' || s.status === 'pending')
        .reduce((sum, s) => sum + (s.commissionAmount || s.amount || 0), 0);

    if (amount > availableBalance) {
        showMsg(`Saldo insuficiente. Disponível: R$ ${availableBalance.toFixed(2).replace('.', ',')}.`, 'error');
        return;
    }

    // Verificar se já existe saque pendente
    const jaTemPendente = (window._affiliatePayoutsCache || []).some(p => p.status === 'pending');
    if (jaTemPendente) {
        showMsg('Você já tem um saque pendente de aprovação. Aguarde o retorno do CEO.', 'error');
        return;
    }

    try {
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Enviando...'; }

        const { collection: _col, addDoc: _add, getDoc: _getDoc, doc: _doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Buscar nome do afiliado
        let affiliateName = currentUser.email;
        try {
            const uSnap = await _getDoc(_doc(db, 'users', currentUser.uid));
            if (uSnap.exists()) affiliateName = uSnap.data().name || uSnap.data().displayName || currentUser.email;
        } catch (_) {}

        await _add(_col(db, 'affiliate_payouts'), {
            affiliateId: currentUser.uid,
            affiliateName,
            affiliateEmail: currentUser.email,
            amount,
            pixKey,
            pixAccountName,
            method: 'PIX',
            status: 'pending',
            rejectionReason: null,
            createdAt: new Date(),
            processedAt: null,
            processedBy: null
        });

        showMsg('⏳ Solicitação enviada! Aguardando aprovação do CEO — não é aprovado automaticamente.', 'success');
        if (document.getElementById('affiliatePayoutAmount')) document.getElementById('affiliatePayoutAmount').value = '';
        await loadAffiliatePayoutsClient();
    } catch (err) {
        console.error('Erro ao solicitar saque:', err);
        showMsg('Erro ao enviar solicitação. Tente novamente.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>Solicitar Saque'; }
    }
}

async function loadAffiliatePayoutsClient() {
    const tb = document.getElementById('affiliatePayoutsTableBody');
    if (!tb || !currentUser) return;
    try {
        const { collection: _col, query: _q, where: _w, getDocs: _get, orderBy: _ob } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await _get(_q(_col(db, 'affiliate_payouts'), _w('affiliateId', '==', currentUser.uid)));
        const payouts = [];
        snap.forEach(d => {
            const data = d.data();
            payouts.push({
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                processedAt: data.processedAt?.toDate?.() || null
            });
        });
        payouts.sort((a, b) => b.createdAt - a.createdAt);
        window._affiliatePayoutsCache = payouts;
        renderAffiliatePayoutsClient(payouts);
    } catch (err) {
        console.error('Erro ao carregar saques:', err);
        tb.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-red-500">Erro ao carregar histórico</td></tr>';
    }
}

function renderAffiliatePayoutsClient(payouts) {
    const tb = document.getElementById('affiliatePayoutsTableBody');
    if (!tb) return;
    if (payouts.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Nenhuma solicitação de saque encontrada</td></tr>';
        return;
    }
    tb.innerHTML = payouts.map(p => {
        const date = p.createdAt ? p.createdAt.toLocaleDateString('pt-BR') : '—';
        const statusBadge = p.status === 'approved'
            ? '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">✅ Aprovado</span>'
            : p.status === 'rejected'
            ? '<span class="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">❌ Recusado</span>'
            : '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">⏳ Pendente</span>';
        const obs = p.status === 'rejected' && p.rejectionReason
            ? `<span class="text-red-600 text-xs">${p.rejectionReason}</span>`
            : (p.status === 'approved'
                ? `<span class="text-green-600 text-xs">Pago em ${p.processedAt ? p.processedAt.toLocaleDateString('pt-BR') : '—'}</span>`
                : '<span class="text-gray-400 text-xs">—</span>');
        return `<tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm">${date}</td>
            <td class="px-4 py-3 text-sm font-semibold text-green-700">R$ ${(p.amount || 0).toFixed(2).replace('.', ',')}</td>
            <td class="px-4 py-3 text-sm font-mono text-xs">${p.pixKey || '—'}</td>
            <td class="px-4 py-3 text-sm">${p.pixAccountName || '—'}</td>
            <td class="px-4 py-3">${statusBadge}</td>
            <td class="px-4 py-3">${obs}</td>
        </tr>`;
    }).join('');
}

window.saveAffiliatePix = saveAffiliatePix;
window.requestAffiliatePayout = requestAffiliatePayout;
window.loadAffiliatePayoutsClient = loadAffiliatePayoutsClient;
