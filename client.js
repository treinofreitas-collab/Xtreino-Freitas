// Client Area JavaScript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, browserLocalPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, addDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// Reuse global Firebase app/auth/db initialized in firebase.js
let app = null;
let auth = null;
let db = null;

// Inicializar Firebase imediatamente
function initializeFirebase() {
  console.log('🔍 Initializing Firebase...');
  console.log('🔍 window.firebaseApp:', !!window.firebaseApp);
  console.log('🔍 window.firebaseAuth:', !!window.firebaseAuth);
  console.log('🔍 window.firebaseDb:', !!window.firebaseDb);
  console.log('🔍 window.FIREBASE_CONFIG:', !!window.FIREBASE_CONFIG);
  
  if (window.firebaseApp && window.firebaseAuth && window.firebaseDb) {
    app = window.firebaseApp;
    auth = window.firebaseAuth;
    db = window.firebaseDb;
    console.log('✅ Firebase initialized from global instances');
    console.log('🔍 DB after global init:', typeof db, db ? db.constructor.name : 'null');
    return true;
  }
  
  if (window.FIREBASE_CONFIG) {
    // Fallback: initialize here if global init hasn't run yet
    console.log('🔍 Initializing Firebase from FIREBASE_CONFIG...');
    app = initializeApp(window.FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('✅ Firebase initialized from FIREBASE_CONFIG');
    console.log('🔍 DB after local init:', typeof db, db ? db.constructor.name : 'null');
    return true;
  }
  
  console.error('❌ FIREBASE_CONFIG not found');
  return false;
}

// Inicializar Firebase
const firebaseInitialized = initializeFirebase();
console.log('🔍 Firebase initialization result:', firebaseInitialized);

// Ensure local persistence for auth session
if (auth && auth.setPersistence) {
  try { setPersistence(auth, browserLocalPersistence); } catch(_) {}
}

// Global variables
let currentUser = null;
let userProfile = null;

// Initialize client area
document.addEventListener('DOMContentLoaded', async function() {
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
    console.log('🔍 Checking auth state...');
    console.log('🔍 Auth instance:', auth ? 'Available' : 'NULL');
    if (!auth) {
        console.log('❌ Auth not available, showing login prompt');
        showLoginPrompt();
        return;
    }
    onAuthStateChanged(auth, async (user) => {
        console.log('🔍 Auth state changed:', user ? `User logged in: ${user.email} (${user.uid})` : 'User logged out');
        if (user) {
            currentUser = user;
            console.log('✅ User authenticated, loading profile and dashboard');
            await loadUserProfile();
            await loadDashboard();
            // Hide login prompt if user is logged in
            hideLoginPrompt();
        } else {
            console.log('❌ User not authenticated, showing login prompt');
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
    if (dashTab) dashTab.addEventListener('click', async () => await switchTab('dashboard'));
    if (ordersTab) ordersTab.addEventListener('click', async () => await switchTab('orders'));
    if (productsTab) productsTab.addEventListener('click', async () => await switchTab('products'));
    if (tokensTab) tokensTab.addEventListener('click', async () => await switchTab('tokens'));
    if (profileTab) profileTab.addEventListener('click', async () => await switchTab('profile'));

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

    // Show selected tab content
    document.getElementById(tabName + 'Content').classList.remove('hidden');

    // Add active class to selected tab
    const activeTab = document.getElementById(tabName + 'Tab');
    activeTab.classList.add('active', 'border-blue-500', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');

    // Load tab-specific data
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'orders':
            loadOrders();
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
    }
}

// Load user profile
async function loadUserProfile() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            console.warn('Usuário não autenticado, não é possível carregar perfil');
            return;
        }
        
        console.log('🔍 Loading user profile for:', currentUser.uid);
        
        // Usar o mesmo perfil do script.js para manter consistência
        if (window.currentUserProfile && window.currentUserProfile.uid === currentUser.uid) {
            userProfile = window.currentUserProfile;
            console.log('✅ User profile loaded from window.currentUserProfile:', userProfile);
        } else {
            // Fallback: carregar do Firestore se não estiver disponível no window
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                userProfile = userDoc.data();
                // Sincronizar com window.currentUserProfile
                window.currentUserProfile = userProfile;
                console.log('✅ User profile loaded from Firestore and synced:', userProfile);
            } else {
                console.log('❌ User document not found, creating default profile');
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
                console.log('✅ Default profile created and synced:', userProfile);
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
        console.error('Error loading user profile:', error);
    }
}

// Load dashboard
async function loadDashboard() {
    try {
        // Garantir que o userProfile seja carregado primeiro
        if (!userProfile && currentUser) {
            console.log('🔍 UserProfile not loaded, loading it first...');
            await loadUserProfile();
        }
        
        // Load recent orders
        await loadRecentOrders();
        
        // Load stats
        await loadStats();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load recent orders
async function loadRecentOrders() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            console.warn('Usuário não autenticado, mostrando pedidos vazios');
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
        }));

        // Registrations pagas com tokens (e.g., XTreino Associado)
        const regsData = await fetchUserDocs('registrations', 10, true);
        const tokenRegs = regsData
          .filter(d => d.data.paidWithTokens === true)
          .map(d => ({
            id: d.id,
            date: d.data.createdAt?.toDate?.() || new Date(),
            title: d.data.title || d.data.eventType || 'Reserva',
            // marcar como pago para aparecer como concluído
            status: d.data.status || 'paid',
            // preço 0 pois foi pago com tokens
            price: 0,
            eventDate: d.data.date || null,
            schedule: d.data.schedule || d.data.hour || d.data.time || '',
            eventType: d.data.eventType || '',
            paidWithTokens: true,
            tokensUsed: d.data.tokensUsed || d.data.tokenCost || 1
          }));

        const merged = [...orders, ...tokenRegs]
          .sort((a,b)=> (b.date?.getTime?.()||0) - (a.date?.getTime?.()||0))
          .slice(0, 5);

        displayRecentOrders(merged);
    } catch (error) {
        console.error('Error loading recent orders:', error);
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

    const ordersHTML = orders.map(order => `
        <div class="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
            <div>
                <p class="font-medium text-gray-900">${order.title || 'Reserva'}</p>
                <p class="text-sm text-gray-500">${formatDate(order.date)}</p>
            </div>
            <div class="text-right">
                <p class="font-medium text-gray-900">R$ ${order.price?.toFixed(2) || '0,00'}</p>
                <!-- Debug: ${JSON.stringify({price: order.price, amount: order.amount, total: order.total})} -->
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status, order)}">
                    ${getStatusText(order.status, order)}
                </span>
            </div>
        </div>
    `).join('');

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
            date: d.data.createdAt?.toDate?.() || new Date(),
            title: d.data.title || d.data.item || 'Pedido',
            status: d.data.status || 'pending',
            price: d.data.amount ?? d.data.total ?? 0,
            eventDate: d.data.date || null,
            schedule: d.data.schedule || d.data.hour || d.data.time || '',
            eventType: d.data.eventType || '',
            paidWithTokens: d.data.paidWithTokens || false,
            tokensUsed: d.data.tokensUsed || 0
        }));

        // incluir eventos pagos com tokens das registrations
        const regsData = await fetchUserDocs('registrations', 200, true);
        const mappedRegs = regsData
          .filter(d => d.data.paidWithTokens === true)
          .map(d => ({
            id: d.id,
            date: d.data.createdAt?.toDate?.() || new Date(),
            title: d.data.title || d.data.eventType || 'Reserva',
            status: d.data.status || 'paid',
            price: 0,
            eventDate: d.data.date || null,
            schedule: d.data.schedule || d.data.hour || d.data.time || '',
            eventType: d.data.eventType || '',
            paidWithTokens: true,
            tokensUsed: d.data.tokensUsed || d.data.tokenCost || 1
          }));

        allOrdersData = [...mappedOrders, ...mappedRegs]
          .sort((a,b)=> (b.date?.getTime?.()||0) - (a.date?.getTime?.()||0));

        displayAllOrdersPaginated();
        await loadWhatsAppLinks(allOrdersData);
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('allOrders').innerHTML = '<p class="text-gray-500 text-center">Erro ao carregar pedidos</p>';
    }
}

// Load products (loja virtual items)
async function loadProducts() {
    try {
        const ordersData = await fetchUserDocs('orders', 200, true);
        const productsData = ordersData.map(d => ({
            id: d.id,
            date: d.data.createdAt?.toDate?.() || new Date(),
            title: d.data.title || d.data.item || 'Produto',
            status: d.data.status || 'pending',
            price: d.data.amount ?? d.data.total ?? 0,
            eventType: d.data.eventType || ''
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
        console.error('Error loading products:', error);
        document.getElementById('allProducts').innerHTML = '<p class="text-gray-500 text-center">Erro ao carregar produtos</p>';
    }
}

// Função para converter data e horário do evento em DateTime
function getEventDateTime(dateStr, scheduleStr) {
    try {
        // Formato da data: YYYY-MM-DD
        // Formato do schedule: "Segunda - 19h" ou "19h"
        const date = new Date(dateStr + 'T00:00:00');
        
        // Extrair o horário do schedule
        let timeStr = scheduleStr;
        if (scheduleStr.includes(' - ')) {
            timeStr = scheduleStr.split(' - ')[1]; // Pega a parte após " - "
        }
        
        // Converter horário (ex: "19h" -> 19)
        const hour = parseInt(timeStr.replace('h', ''));
        
        // Definir a data e hora do evento
        date.setHours(hour, 0, 0, 0);
        
        return date;
    } catch (error) {
        console.error('Erro ao converter data/hora do evento:', error);
        return new Date(NaN); // inválido para não liberar link indevidamente
    }
}

function getWeekdayPtBr(dateStr){
    try{
        const d = new Date(`${dateStr}T00:00:00`);
        const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        return wd.charAt(0).toUpperCase() + wd.slice(1);
    }catch(_){ return ''; }
}

function formatTitleWithSchedule(title, dateStr, schedule){
    const { weekday, hour } = parseSchedule(schedule);
    const wd = weekday || (dateStr ? getWeekdayPtBr(dateStr) : '');
    if (wd && hour) return `${title} • ${wd} - ${hour}`;
    if (wd) return `${title} • ${wd}`;
    if (hour) return `${title} • ${hour}`;
    return title;
}

function parseSchedule(scheduleStr){
    const out = { weekday: '', hour: (scheduleStr||'').trim() };
    if (!scheduleStr) return out;
    if (scheduleStr.includes('-')){
        const parts = scheduleStr.split('-');
        out.weekday = (parts[0]||'').trim();
        out.hour = (parts[1]||'').trim();
    }
    return out;
}

function formatShortDatePtBr(dateStr){
    try{
        const d = new Date(`${dateStr}T00:00:00`);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }catch(_){ return dateStr||''; }
}

// Carrega links do WhatsApp para pedidos confirmados
async function loadWhatsAppLinks(orders) {
    const whatsappContainer = document.getElementById('whatsappLinks');
    const whatsappList = document.getElementById('whatsappList');
    if (!whatsappContainer || !whatsappList) return;

    const confirmedOrders = orders.filter(order => {
        // Verificar se o pedido está confirmado
        if (!(order.status === 'paid' || order.status === 'confirmed') || !(order.eventType || order.title)) {
            return false;
        }
        
        // Excluir produtos da loja virtual (só mostrar eventos)
        const title = (order.title || '').toLowerCase();
        const item = (order.item || '').toLowerCase();
        const eventType = (order.eventType || '').toLowerCase();
        
        // Excluir produtos da loja virtual
        if (title.includes('planilhas') || 
            title.includes('sensibilidades') || 
            title.includes('imagens aéreas') || 
            title.includes('camisa') ||
            // compras de tokens (mas manter eventos xtreino-tokens)
            (title.includes('token') && eventType !== 'xtreino-tokens') ||
            item.includes('planilhas') || 
            item.includes('sensibilidades') || 
            item.includes('imagens aéreas') || 
            item.includes('camisa') ||
            (item.includes('token') && eventType !== 'xtreino-tokens')) {
                return false;
        }
        
        // Não filtrar por janela aqui; mostramos todos e controlamos a disponibilidade do botão
        return true;
        
        return true;
    });

    if (confirmedOrders.length === 0) {
        whatsappContainer.classList.add('hidden');
        return;
    }

    whatsappContainer.classList.remove('hidden');
    
    // Mapeamento de eventos para links do WhatsApp (você pode personalizar)
    const whatsappLinks = {
        'camp-freitas': 'https://chat.whatsapp.com/SEU_LINK_CAMP_FREITAS',
        'xtreino-gratuito': 'https://chat.whatsapp.com/SEU_LINK_XTREINO_GRATUITO',
        'modo-liga': 'https://chat.whatsapp.com/SEU_LINK_MODO_LIGA',
        'treino': 'https://chat.whatsapp.com/SEU_GRUPO_TREINO',
        'modoLiga': 'https://chat.whatsapp.com/SEU_GRUPO_MODO_LIGA',
        'semanal': 'https://chat.whatsapp.com/SEU_GRUPO_SEMANAL',
        'finalSemanal': 'https://chat.whatsapp.com/SEU_GRUPO_FINAL_SEMANAL',
        'campFases': 'https://chat.whatsapp.com/SEU_GRUPO_CAMP_FASES',
        'xtreino-tokens': 'https://chat.whatsapp.com/SEU_GRUPO_ASSOCIADO'
    };

    // Paginate WhatsApp links (show only 5 per page)
    const whatsappPerPage = 5;
    const whatsappTotalPages = Math.ceil(confirmedOrders.length / whatsappPerPage);
    const whatsappStartIndex = (currentWhatsAppPage - 1) * whatsappPerPage;
    const whatsappEndIndex = whatsappStartIndex + whatsappPerPage;
    const currentWhatsappOrders = confirmedOrders.slice(whatsappStartIndex, whatsappEndIndex);

    whatsappList.innerHTML = currentWhatsappOrders.map(order => {
        const eventType = order.eventType || '';
        const rawTitle = order.title || '';
        const rawDate = order.date || null;
        const rawSchedule = order.schedule || '';
        
        // Usar o link salvo no pedido ou determinar baseado no tipo de evento
        let whatsappLink = order.whatsappLink || whatsappLinks[eventType] || whatsappLinks['modo-liga'];
        
        // Se não encontrar por eventType, tenta por título
        if (!order.whatsappLink && !whatsappLinks[eventType]) {
            if (title.toLowerCase().includes('camp')) {
                whatsappLink = whatsappLinks['camp-freitas'];
            } else if (title.toLowerCase().includes('gratuito')) {
                whatsappLink = whatsappLinks['xtreino-gratuito'];
            } else if (title.toLowerCase().includes('treino')) {
                whatsappLink = whatsappLinks['treino'];
            } else if (title.toLowerCase().includes('modo liga')) {
                whatsappLink = whatsappLinks['modoLiga'];
            } else if (title.toLowerCase().includes('semanal')) {
                whatsappLink = whatsappLinks['semanal'];
            }
        }
        
        // Calcular janela de disponibilidade do link (entre horário e +30min)
        let showWhatsAppButton = true;
        
        if ((rawSchedule && rawDate) || (order.eventDate && (order.schedule || order.hour))) {
            const dateStr = rawDate || order.eventDate;
            const scheduleStr = rawSchedule || order.schedule || order.hour || '';
            const startDt = getEventDateTime(dateStr, scheduleStr);
            if (!isNaN(startDt.getTime())){
                const endDt = new Date(startDt.getTime() + (30 * 60 * 1000));
                const now = new Date();
                // Disponível SOMENTE entre o horário e +30min
                showWhatsAppButton = now >= startDt && now <= endDt;
            } else {
                showWhatsAppButton = false;
            }
        } else {
            showWhatsAppButton = false;
        }

        return `
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h4 class="font-medium text-gray-900">${formatTitleWithSchedule(rawTitle, (order.eventDate||rawDate), (order.schedule||order.hour||rawSchedule))}</h4>
                    </div>
                    ${showWhatsAppButton ? `
                    <a href="${whatsappLink}" target="_blank" 
                       class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                        <span>Entrar no Grupo</span>
                    </a>
                    ` : `
                        <div class="bg-gray-300 text-gray-600 px-4 py-2 rounded-lg flex items-center space-x-2">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            <span>Link Expirado</span>
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');

    // Add pagination for WhatsApp links if needed
    if (whatsappTotalPages > 1) {
        const whatsappPaginationHTML = generateWhatsAppPaginationHTML(currentWhatsAppPage, whatsappTotalPages);
        whatsappList.innerHTML += whatsappPaginationHTML;
    }
    
    // Atualizar automaticamente a cada minuto para verificar expiração
    setTimeout(() => {
        loadWhatsAppLinks(allOrdersData);
    }, 60000); // 60 segundos
}

// Display all orders with pagination (filtered for events only)
function displayAllOrdersPaginated() {
    const container = document.getElementById('allOrders');
    
    // Filter only events (XTreinos, Camps, Semanal, Modo Liga) -
    // incluir xtreino-tokens (consumo via tokens) e excluir compras de tokens
    const eventsOnly = allOrdersData.filter(order => {
        const title = (order.title || '').toLowerCase();
        const item = (order.item || '').toLowerCase();
        const eventType = (order.eventType || '').toLowerCase();
        
        // Excluir compras de tokens (orders com descrição/item contendo token)
        // mas manter registros de consumo (eventType === 'xtreino-tokens')
        if ((title.includes('token') || item.includes('token')) && eventType !== 'xtreino-tokens') {
            return false;
        }
        
        // Incluir somente eventos + xtreino-tokens
        return eventType === 'xtreino-tokens' ||
               title.includes('xtreino') || 
               title.includes('camp') || 
               title.includes('semanal') || 
               title.includes('modo liga') ||
               item.includes('xtreino') || 
               item.includes('camp') || 
               item.includes('semanal') || 
               item.includes('modo liga');
    });
    
    if (eventsOnly.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">Nenhum evento encontrado</p>';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(eventsOnly.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const currentOrders = eventsOnly.slice(startIndex, endIndex);

    // Generate orders HTML
    const ordersHTML = currentOrders.map(order => `
        <div class="bg-gray-50 rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium text-gray-900">${formatTitleWithSchedule((order.title||'Reserva'), (order.eventDate||''), (order.schedule||''))}</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status, order)}">
                    ${getStatusText(order.status, order)}
                </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                    <span class="font-medium">Data:</span> ${order.eventDate ? `${formatShortDatePtBr(order.eventDate)} ${parseSchedule(order.schedule).hour? 'às '+parseSchedule(order.schedule).hour : ''}` : formatDate(order.date)}
                </div>
                <div>
                    <span class="font-medium">${order.paidWithTokens ? 'Consumo:' : 'Valor:'}</span> ${order.paidWithTokens ? `-${order.tokensUsed||1} token${(order.tokensUsed||1)>1?'s':''}` : `R$ ${Number(order.price||0).toFixed(2)}`}
                </div>
            </div>
        </div>
    `).join('');

    // Generate pagination HTML
    const paginationHTML = generatePaginationHTML(currentPage, totalPages);

    container.innerHTML = ordersHTML + paginationHTML;
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


// Get appropriate action button for order (events only)
function getOrderActionButton(order) {
    // Default WhatsApp link for events
    if (order.whatsappLink) {
        return `
                <div class="mt-3">
                    <a href="${order.whatsappLink}" target="_blank" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200">
                        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                        Entrar no Grupo
                    </a>
                </div>
        `;
    }
    
    return '';
}

// Get appropriate action button for product
function getProductActionButton(product) {
    const title = (product.title || '').toLowerCase();
    const item = (product.item || '').toLowerCase();
    
    // Check if it's Sensibilidades
    if (title.includes('sensibilidades') || title.includes('sensibilidade') || item.includes('sensibilidades') || item.includes('sensibilidade')) {
        return `
            <div class="mt-3">
                <button onclick="downloadSensibilidades('${product.id}')" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Download
                </button>
        </div>
        `;
    }
    
    // Check if it's Imagens Aéreas
    if (title.includes('imagens') || title.includes('aéreas') || item.includes('imagens') || item.includes('aéreas')) {
        return `
            <div class="mt-3">
                <button onclick="downloadImagensAereas('${product.id}')" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Download
                </button>
        </div>
        `;
    }
    
    // Check if it's Planilhas de Análises
    if (title.includes('planilhas') || title.includes('análises') || item.includes('planilhas') || item.includes('análises')) {
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
    
    // Check if it's Passe Booyah/Elite
    if (title.includes('passe') || title.includes('booyah') || title.includes('elite') || item.includes('passe') || item.includes('booyah') || item.includes('elite')) {
        const isConfirmed = product.booyahConfirmed || false;
        const statusText = isConfirmed ? 'Enviado' : 'Processando';
        const statusColor = isConfirmed ? 'text-green-700 bg-green-100' : 'text-yellow-700 bg-yellow-100';
        
        return `
            <div class="mt-3">
                <div class="flex items-center justify-between">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                        ${statusText}
                    </span>
                    ${isConfirmed ? `
                        <span class="text-xs text-gray-500">
                            Enviado em: ${product.booyahConfirmedAt ? new Date(product.booyahConfirmedAt).toLocaleDateString('pt-BR') : 'Data não disponível'}
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
    
    return '';
}

// Download function for Planilhas de Análises (via proxy)
function downloadPlanilhas(orderId) {
    // Baixar o primeiro arquivo da lista (ou abrir seleção depois)
    const proxyUrl = `/.netlify/functions/download?orderId=${encodeURIComponent(orderId)}&i=0`;
    window.open(proxyUrl, '_blank');
}

// Download function for Sensibilidades (considera plataforma)
function downloadSensibilidades(orderId) {
    // Buscar informações do pedido para obter a plataforma selecionada
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
        // Baixar arquivo baseado na plataforma selecionada
        const platform = data.platform || 'pc'; // fallback para PC
        const fileIndex = files.findIndex(f => f.platform === platform) || 0;
        const url = `/.netlify/functions/download?orderId=${encodeURIComponent(orderId)}&i=${encodeURIComponent(fileIndex)}`;
        window.open(url, '_blank');
      })
      .catch(() => {
        // fallback para primeiro arquivo
        window.location.href = `/.netlify/functions/download?orderId=${encodeURIComponent(orderId)}&i=0`;
      });
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

// Expor funções de download no escopo global (para onclick do HTML)
try {
    window.downloadSensibilidades = downloadSensibilidades;
    window.downloadImagensAereas = downloadImagensAereas;
    window.downloadPlanilhas = downloadPlanilhas;
} catch (_) {}

// Function to get product information from Firestore
async function getProductInfo(productId) {
    try {
        const { collection, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const productDoc = await getDoc(doc(window.firebaseDb, 'products', productId));
        
        if (productDoc.exists()) {
            return productDoc.data();
        } else {
            console.log('Produto não encontrado:', productId);
            return null;
        }
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        return null;
    }
}

// Load stats
async function loadStats() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            console.warn('Usuário não autenticado, carregando stats padrão');
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
        let totalOrders = orders.length + regsPaidWithTokens.length;
        let totalSpent = orders.reduce((sum, r) => sum + (r.data.total || r.data.amount || 0), 0);

        console.log('🔍 Stats data:', { totalOrders, totalSpent, userProfile });

        const totalOrdersElement = document.getElementById('totalOrders');
        const totalSpentElement = document.getElementById('totalSpent');
        const availableTokensElement = document.getElementById('availableTokens');
        const myTokenBalanceElement = document.getElementById('myTokenBalance');
        
        if (totalOrdersElement) totalOrdersElement.textContent = totalOrders;
        if (totalSpentElement) totalSpentElement.textContent = `R$ ${totalSpent.toFixed(2)}`;
        if (availableTokensElement) availableTokensElement.textContent = userProfile?.tokens || 0;
        if (myTokenBalanceElement) myTokenBalanceElement.textContent = userProfile?.tokens || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Helper to fetch user docs handling different owner field names and rule variations
async function fetchUserDocs(colName, max = 50, sortDesc = false){
    // Verificar se o usuário está autenticado
    if (!currentUser || !currentUser.uid) {
        console.warn('Usuário não autenticado, não é possível buscar documentos');
        return [];
    }
    
    const colRef = collection(db, colName);
    
    // Para coleção 'orders', usar campos customer e buyerEmail
    // Para coleção 'registrations', usar campos contact e teamName
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
            where('userId','==', currentUser.uid),
            where('uid','==', currentUser.uid)
        ];
    } else {
        // Para outras coleções, usar campos originais
        candidates = [
            where('userId','==', currentUser.uid),
            where('uid','==', currentUser.uid),
            where('ownerId','==', currentUser.uid)
        ];
    }
    
    console.log(`🔍 Searching in collection '${colName}' with email: ${currentUser.email}, uid: ${currentUser.uid}`);
    const results = [];
    for (const cond of candidates){
        try{
            const base = sortDesc ? query(colRef, cond) : query(colRef, cond);
            const snap = await getDocs(base);
            console.log(`🔍 Query result for ${colName}:`, snap.size, 'documents');
            snap.forEach(d => {
                const data = d.data();
                console.log(`🔍 Found document:`, { id: d.id, customer: data.customer, buyerEmail: data.buyerEmail, userId: data.userId, uid: data.uid });
                results.push({ id: d.id, data });
            });
            if (results.length > 0) break; // got something
        }catch(e){
            console.log(`🔍 Query error for ${colName}:`, e);
            // ignore permission errors, try next field
        }
    }
    // limit and sort by createdAt if requested
    const limited = results
        .sort((a,b)=>{
            const at = a.data.createdAt?.toMillis?.() || 0;
            const bt = b.data.createdAt?.toMillis?.() || 0;
            return sortDesc ? bt - at : at - bt;
        })
        .slice(0, max);
    console.log(`🔍 Final results for ${colName}:`, limited.length, 'documents');
    return limited;
}

// Load profile
function loadProfile() {
    if (userProfile) {
        document.getElementById('profileName').value = userProfile.name || '';
        document.getElementById('profileEmail').value = userProfile.email || '';
        document.getElementById('profilePhone').value = userProfile.phone || '';
        document.getElementById('profileNickname').value = userProfile.nickname || '';
        document.getElementById('profileTeam').value = userProfile.team || '';
        document.getElementById('profileAge').value = userProfile.age || '';
    }
}

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
        
        alert('Perfil atualizado com sucesso!');
    } catch (error) {
        console.error('Error saving profile:', error);
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
        console.error('Error loading tokens history:', error);
        document.getElementById('tokensHistory').innerHTML = '<p class="text-gray-500 text-center">Erro ao carregar histórico</p>';
    }
}

// Load my tokens (balance)
async function loadMyTokens() {
    // Verificar se o usuário está autenticado
    if (!currentUser || !currentUser.uid) {
        console.warn('Usuário não autenticado, não é possível carregar tokens');
        // Mostrar 0 tokens se não autenticado
        const balanceElement = document.getElementById('myTokenBalance');
        if (balanceElement) {
            balanceElement.textContent = '0 Tokens';
        }
        return;
    }
    
    // Garantir que o userProfile seja carregado
    if (!userProfile) {
        console.log('🔍 UserProfile not loaded, loading it first...');
        await loadUserProfile();
    }
    
    // Verificar se há tokens não sincronizados
    // checkAndSyncTokens() removido para evitar reset do saldo
    
    if (userProfile) {
        const balanceElement = document.getElementById('myTokenBalance');
        if (balanceElement) {
            balanceElement.textContent = `${userProfile.tokens || 0} Tokens`;
        }
        console.log('🔍 My tokens loaded:', userProfile.tokens);
    } else {
        console.log('❌ userProfile not available in loadMyTokens');
    }
    
    // Carregar histórico de uso dos tokens
    loadTokenUsageHistory();
}

// Função checkAndSyncTokens removida para evitar reset do saldo de tokens
// Esta função estava causando o reset do saldo para o total de tokens comprados

// Load token usage history
async function loadTokenUsageHistory() {
    try {
        // Verificar se o usuário está autenticado
        if (!currentUser || !currentUser.uid) {
            console.warn('Usuário não autenticado, não é possível carregar histórico de tokens');
            return;
        }
        
        const container = document.getElementById('tokenUsageHistory');
        if (!container) return;
        
        // Buscar registrations onde o usuário usou tokens
        const registrations = await fetchUserDocs('registrations', 50, true);
        const tokenUsage = registrations.filter(r => r.data.paidWithTokens === true);
        
        if (tokenUsage.length === 0) {
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
        
        const historyHTML = tokenUsage.map(usage => {
            const date = usage.data.createdAt?.toDate?.() || new Date();
            const eventType = usage.data.eventType || 'Evento';
            const tokensUsed = usage.data.tokensUsed || usage.data.tokenCost || 1;
            const status = usage.data.status || 'confirmed'; // Default para confirmed em vez de unknown
            const whatsappLink = usage.data.whatsappLink;
            const schedule = usage.data.schedule || '';
            const eventDate = usage.data.date || '';
            
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
                                <h6 class="font-medium text-gray-900">${eventType}</h6>
                                <p class="text-sm text-gray-500">${formatDate(date)}</p>
                                ${eventDate && schedule ? `<p class="text-xs text-gray-400">${eventDate} às ${schedule}</p>` : ''}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="flex items-center space-x-2">
                                <span class="text-sm font-medium text-yellow-600">-${tokensUsed} token${tokensUsed > 1 ? 's' : ''}</span>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}">
                                    ${getStatusText(status, { eventType: 'xtreino-tokens' })}
                                </span>
                            </div>
                            ${whatsappLink ? `
                                <div class="mt-2">
                                    <a href="${whatsappLink}" target="_blank" class="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 transition-colors">
                                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.56 20.16 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67M8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.64 7.89 7 8.5 7 9.71C7 10.93 7.89 12.1 8 12.27C8.14 12.44 9.76 14.94 12.25 16C12.84 16.27 13.3 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.7 16.56 16.68 16.03 16.89 15.45C17.1 14.87 17.1 14.38 17 14.2C16.91 14 16.47 13.85 15.65 13.25C14.83 12.65 14.5 12.38 14.26 12.14C14.03 11.9 13.9 11.8 13.68 11.56C13.45 11.31 13.52 11.16 13.6 11.04C13.68 10.92 13.78 10.76 13.87 10.62C13.97 10.5 14.02 10.4 14.12 10.24C14.22 10.08 14.17 9.94 14.1 9.82C14.03 9.7 13.18 7.91 12.83 7.23C12.5 6.58 12.15 6.67 11.89 6.66C11.64 6.65 11.36 6.65 11.08 6.65C10.8 6.65 10.34 6.54 9.95 6.89C9.56 7.24 8.76 7.95 8.76 9.65C8.76 11.35 10.1 12.93 10.27 13.14C10.44 13.35 12.73 15.76 16.08 17.14C16.8 17.44 17.35 17.65 17.73 17.73C18.11 17.81 18.46 17.77 18.75 17.7C19.08 17.62 19.7 17.36 19.93 17.08C20.16 16.8 20.27 16.56 20.35 16.45C20.43 16.34 20.5 16.2 20.4 16.04C20.3 15.88 20.2 15.8 20.05 15.65C19.9 15.5 19.72 15.35 19.54 15.2C19.36 15.05 19.2 14.95 19 14.75C18.8 14.55 18.85 14.4 18.9 14.3C18.95 14.2 19 14.05 18.95 13.9C18.9 13.75 18.4 12.3 17.4 10.95C16.25 9.4 14.9 8.88 14.7 8.8C14.5 8.72 14.3 8.68 14.1 8.68C13.9 8.68 13.6 8.73 13.35 8.78C13.1 8.83 12.85 8.8 12.65 8.65C12.45 8.5 11.85 7.95 11.1 7.3C10.6 6.9 10.2 6.7 9.85 6.95C9.5 7.2 8.7 7.33 8.53 7.33Z"/>
                                        </svg>
                                        Entrar no Grupo
                                    </a>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = historyHTML;
    } catch (error) {
        console.error('Error loading token usage history:', error);
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
        console.error('Error logging out:', error);
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
        
        console.log('🔍 Persisting profile:', { isLocal, isNetlify, firebaseReady: window.firebaseReady, hasUid: !!profile?.uid });
        
        if (window.firebaseReady && !isLocal && profile?.uid) {
            const { doc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(db, 'users'), profile.uid);
            await setDoc(ref, profile, { merge: true });
            console.log('✅ Profile saved to Firestore');
        } else {
            localStorage.setItem('assoc_profile', JSON.stringify(profile));
            console.log('✅ Profile saved to localStorage');
        }
    } catch(error) {
        console.error('❌ Error persisting profile:', error);
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
        if (title.includes('passe') || title.includes('booyah') || title.includes('elite') || item.includes('passe') || item.includes('booyah') || item.includes('elite')) {
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
    // Debug detalhado
    console.log('🔍 getStatusText called with:', { 
        status, 
        orderData: orderData ? {
            title: orderData.title,
            item: orderData.item,
            eventType: orderData.eventType,
            booyahConfirmed: orderData.booyahConfirmed
        } : null
    });
    
    // Caso especial para XTreino Tokens - verificar se é um token independente do status
    if (orderData) {
        const title = (orderData.title || '').toLowerCase();
        const item = (orderData.item || '').toLowerCase();
        const eventType = (orderData.eventType || '').toLowerCase();
        
        console.log('🔍 Checking for XTreino Tokens:', { title, item, eventType });
        
        // Se for XTreino Tokens, sempre retornar "Token"
        if (title.includes('xtreino tokens') || item.includes('xtreino tokens') || eventType === 'xtreino-tokens') {
            console.log('✅ Found XTreino Tokens, returning "Token"');
            return 'Token';
        }
        
        // Caso especial para Passe Booyah/Elite
        if (title.includes('passe') || title.includes('booyah') || title.includes('elite') || item.includes('passe') || item.includes('booyah') || item.includes('elite')) {
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
            return 'Pago';
        case 'pending':
            return 'Pendente';
        case 'rejected':
        case 'failed':
            return 'Rejeitado';
        default:
            return 'Desconhecido';
    }
}

// Token purchase functions - expostas globalmente
window.openTokensPurchaseModal = function() {
    const modal = document.getElementById('tokensPurchaseModal');
    if (modal) modal.classList.remove('hidden');
}

window.closeTokensPurchaseModal = function() {
    const modal = document.getElementById('tokensPurchaseModal');
    if (modal) modal.classList.add('hidden');
}

window.purchaseTokens = async function(quantity) {
    try {
        // Verificar se Firebase está inicializado
        if (!db) {
            console.error('❌ Firebase not initialized, attempting to reinitialize...');
            initializeFirebase();
            if (!db) {
                alert('Erro: Firebase não foi inicializado. Recarregue a página.');
                return;
            }
        }
        
        const price = quantity; // R$ 1,00 por token
        
        // Criar preferência no Mercado Pago
        const response = await fetch('/.netlify/functions/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                unit_price: price,
                currency_id: 'BRL',
                quantity: 1,
                back_url: window.location.origin + window.location.pathname
            })
        });
        
        if (!response.ok) throw new Error('Erro ao criar preferência');
        
        const data = await response.json();
        
        if (data.init_point) {
            // Salvar order no Firestore ANTES de redirecionar
            try {
                const currentUser = auth.currentUser;
                console.log('🔍 Current user:', currentUser ? `${currentUser.uid} (${currentUser.email})` : 'Not authenticated');
                console.log('🔍 DB instance:', db ? 'Available' : 'NULL - Firebase not initialized');
                console.log('🔍 DB type:', typeof db);
                console.log('🔍 DB constructor:', db ? db.constructor.name : 'null');
                console.log('🔍 DB has collection method:', db && typeof db.collection === 'function' ? 'YES' : 'NO');
                
                if (currentUser && db) {
                    const orderData = {
                        title: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                        description: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                        item: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                        amount: price,
                        total: price,
                        quantity: 1,
                        currency: 'BRL',
                        status: 'pending',
                        external_reference: data.external_reference,
                        preference_id: data.id,
                        customer: currentUser.email,
                        buyerEmail: currentUser.email,
                        userId: currentUser.uid,
                        uid: currentUser.uid,
                        createdAt: new Date(),
                        timestamp: Date.now()
                    };
                    
                    console.log('🔍 Attempting to save order:', orderData);
                    const docRef = await addDoc(collection(db, 'orders'), orderData);
                    console.log('✅ Order saved to Firestore with ID:', docRef.id);
                } else {
                    console.error('❌ Cannot save order: User not authenticated or DB not available');
                    console.error('❌ User:', currentUser ? 'Authenticated' : 'Not authenticated');
                    console.error('❌ DB:', db ? 'Available' : 'Not available');
                }
            } catch (firestoreError) {
                console.error('❌ Error saving order to Firestore:', firestoreError);
                console.error('❌ Error details:', {
                    message: firestoreError.message,
                    code: firestoreError.code,
                    stack: firestoreError.stack
                });
                // Continuar mesmo se der erro no Firestore
            }
            
            closeTokensPurchaseModal();
            
            // Salvar info da compra para processar após pagamento
            sessionStorage.setItem('tokenPurchase', JSON.stringify({
                quantity,
                price,
                external_reference: data.external_reference
            }));
            window.location.href = data.init_point;
        } else {
            alert('Erro ao iniciar pagamento');
        }
    } catch (error) {
        console.error('Error purchasing tokens:', error);
        alert('Erro ao processar compra de tokens');
    }
}

// Funções de paginação expostas globalmente
window.changePage = function(page) {
    currentPage = page;
    displayAllOrdersPaginated();
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
            console.error('❌ Firebase not initialized, attempting to reinitialize...');
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
        const response = await fetch('/.netlify/functions/create-preference', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: [{
                    title: `${quantity} Token${quantity > 1 ? 's' : ''} XTreino`,
                    quantity,
                    unit_price: 1.00
                }],
                external_reference: `tokens_${currentUser.uid}_${Date.now()}`
            })
        });

        const data = await response.json();
        
        if (data.init_point) {
            // Salvar order no Firestore ANTES de redirecionar
            try {
                console.log('🔍 Quick purchase - Current user:', currentUser ? `${currentUser.uid} (${currentUser.email})` : 'Not authenticated');
                console.log('🔍 Quick purchase - DB instance:', db ? 'Available' : 'NULL - Firebase not initialized');
                console.log('🔍 Quick purchase - DB type:', typeof db);
                console.log('🔍 Quick purchase - DB constructor:', db ? db.constructor.name : 'null');
                console.log('🔍 Quick purchase - DB has collection method:', db && typeof db.collection === 'function' ? 'YES' : 'NO');
                
                if (currentUser && db) {
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
                    timestamp: Date.now()
                };
                
                    console.log('🔍 Attempting to save quick order:', orderData);
                    const docRef = await addDoc(collection(db, 'orders'), orderData);
                    console.log('✅ Quick order saved to Firestore with ID:', docRef.id);
                } else {
                    console.error('❌ Cannot save quick order: User not authenticated or DB not available');
                    console.error('❌ User:', currentUser ? 'Authenticated' : 'Not authenticated');
                    console.error('❌ DB:', db ? 'Available' : 'Not available');
                }
            } catch (firestoreError) {
                console.error('❌ Error saving quick order to Firestore:', firestoreError);
                console.error('❌ Error details:', {
                    message: firestoreError.message,
                    code: firestoreError.code,
                    stack: firestoreError.stack
                });
                // Continuar mesmo se der erro no Firestore
            }
            
            // Redirecionar para pagamento
            window.location.href = data.init_point;
        } else {
            alert('Erro ao iniciar pagamento');
        }
    } catch (error) {
        console.error('Error in quick purchase:', error);
        alert('Erro ao processar compra rápida');
    }
}
