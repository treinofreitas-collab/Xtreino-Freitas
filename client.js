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
let appliedTokenCoupon = null;
let selectedTokensQty = 0;

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
        console.log('🔍 Carregando pedidos...');
        const ordersData = await fetchUserDocs('orders', 200, true);
        console.log('🔍 Orders raw data:', ordersData);
        
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
            tokensUsed: d.data.tokensUsed || 0,
            whatsappLink: d.data.whatsappLink || null
        }));
        console.log('🔍 Mapped orders:', mappedOrders);

        // incluir eventos pagos com tokens das registrations
        const regsData = await fetchUserDocs('registrations', 200, true);
        console.log('🔍 Registrations raw data:', regsData);
        
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
            tokensUsed: d.data.tokensUsed || d.data.tokenCost || 1,
            whatsappLink: d.data.whatsappLink || null
          }));
        console.log('🔍 Mapped registrations:', mappedRegs);

        allOrdersData = [...mappedOrders, ...mappedRegs]
          .sort((a,b)=> (b.date?.getTime?.()||0) - (a.date?.getTime?.()||0));
        
        console.log('🔍 All orders data final:', allOrdersData);

        await displayAllOrdersPaginated();
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
        console.log('🔍 getEventDateTime - dateStr:', dateStr, 'scheduleStr:', scheduleStr);
        console.log('🔍 Tipo de dateStr:', typeof dateStr);
        
        // Verificar se dateStr é válido
        if (!dateStr || dateStr === 'undefined' || dateStr === 'null') {
            console.log('❌ dateStr inválido:', dateStr);
            return new Date(NaN);
        }
        
        // Se dateStr já é um objeto Date, usar ele
        let date;
        if (dateStr instanceof Date) {
            date = new Date(dateStr);
            console.log('🔍 dateStr é Date, criando nova Date');
        } else if (typeof dateStr === 'string') {
            console.log('🔍 dateStr é string, processando...');
            // Tentar diferentes formatos de data
            if (dateStr.includes('/')) {
                // Formato DD/MM/YYYY
                console.log('🔍 Formato DD/MM/YYYY detectado');
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    date = new Date(parts[2], parts[1] - 1, parts[0]);
                    console.log('🔍 Data criada a partir de partes:', parts);
                } else {
                    date = new Date(dateStr);
                }
            } else if (dateStr.includes('-')) {
                // Formato YYYY-MM-DD
                console.log('🔍 Formato YYYY-MM-DD detectado');
                date = new Date(dateStr + 'T00:00:00');
                console.log('🔍 Data criada com T00:00:00');
            } else {
                console.log('🔍 Formato não reconhecido, usando new Date()');
                date = new Date(dateStr);
            }
        } else {
            console.log('🔍 Tipo não reconhecido, usando new Date()');
            date = new Date(dateStr);
        }
        
        console.log('🔍 Data base criada:', date);
        console.log('🔍 Data base é válida?', !isNaN(date.getTime()));
        
        // Verificar se a data é válida
        if (isNaN(date.getTime())) {
            console.log('❌ Data inválida após parsing');
            return new Date(NaN);
        }
        
        // Extrair o horário do schedule
        let timeStr = scheduleStr;
        if (scheduleStr && scheduleStr.includes(' - ')) {
            timeStr = scheduleStr.split(' - ')[1]; // Pega a parte após " - "
        }
        console.log('🔍 Time string extraída:', timeStr);
        
        // Normalizar e converter horário (aceita 19, 19h, 19:00, "Terça-feira - 19h")
        const normalizeHour = (s)=>{
            if (!s) return NaN;
            const m = String(s).toLowerCase().match(/(\d{1,2})/);
            return m ? parseInt(m[1],10) : NaN;
        };
        const hour = normalizeHour(timeStr);
        console.log('🔍 Hora convertida:', hour);
        
        // Verificar se a hora é válida
        if (isNaN(hour) || hour < 0 || hour > 23) {
            console.log('❌ Hora inválida:', hour);
            return new Date(NaN);
        }
        
        // Definir a data e hora do evento
        date.setHours(hour, 0, 0, 0);
        console.log('🔍 Data/hora final:', date);
        console.log('🔍 Data/hora final é válida?', !isNaN(date.getTime()));
        
        return date;
    } catch (error) {
        console.error('❌ Erro ao converter data/hora do evento:', error);
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


// Display all orders with pagination (filtered for events only)
async function displayAllOrdersPaginated() {
    const container = document.getElementById('allOrders');
    
    console.log('🔍 Total de pedidos carregados:', allOrdersData.length);
    console.log('🔍 Todos os pedidos:', allOrdersData);
    
    // Filter only events (Treinos, Camps, Semanal, Modo Liga) -
    // incluir xtreino-tokens (consumo via tokens) e excluir compras de tokens
    const eventsOnly = allOrdersData.filter(order => {
        const title = (order.title || '').toLowerCase();
        const item = (order.item || '').toLowerCase();
        const eventType = (order.eventType || '').toLowerCase();
        
        console.log('🔍 Analisando pedido:', {
            title,
            item,
            eventType,
            status: order.status,
            whatsappLink: order.whatsappLink
        });
        
        // Excluir compras de tokens (orders com descrição/item contendo token)
        // mas manter registros de consumo (eventType === 'xtreino-tokens')
        if ((title.includes('token') || item.includes('token')) && eventType !== 'xtreino-tokens') {
            console.log('❌ Pedido excluído - compra de token');
            return false;
        }
        
        // Incluir somente eventos + xtreino-tokens
        const isEvent = eventType === 'xtreino-tokens' ||
               title.includes('xtreino') || 
               title.includes('camp') || 
               title.includes('semanal') || 
               title.includes('modo liga') ||
               item.includes('xtreino') || 
               item.includes('camp') || 
               item.includes('semanal') || 
               item.includes('modo liga');
        
        console.log(isEvent ? '✅ Pedido incluído - é evento' : '❌ Pedido excluído - não é evento');
        return isEvent;
    });
    
    console.log('🔍 Pedidos de eventos filtrados:', eventsOnly.length);
    console.log('🔍 Eventos encontrados:', eventsOnly);
    
    if (eventsOnly.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">Nenhum evento encontrado</p>';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(eventsOnly.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const currentOrders = eventsOnly.slice(startIndex, endIndex);

    // Generate orders HTML with WhatsApp buttons
    const ordersHTML = await Promise.all(currentOrders.map(async order => {
        const whatsappButton = await getOrderActionButton(order);
        return `
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
                ${whatsappButton}
            </div>
        `;
    }));

    // Generate pagination HTML
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


// Função para obter link do WhatsApp dinamicamente
async function getWhatsAppLinkForOrder(order) {
    try {
        console.log('🔍 getWhatsAppLinkForOrder - Order:', order);
        console.log('🔍 EventType:', order.eventType);
        console.log('🔍 Schedule:', order.schedule);
        
        // Se o pedido já tem um link salvo, usar ele
        if (order.whatsappLink) {
            console.log('✅ Usando link salvo no pedido:', order.whatsappLink);
            return order.whatsappLink;
        }
        
        // Buscar no Firestore (links do admin)
        if (window.getWhatsAppLink) {
            console.log('🔍 Buscando link no admin...');
            try {
                const adminLink = await window.getWhatsAppLink(order.eventType, order.schedule);
                console.log('🔍 Link encontrado no admin:', adminLink);
                
                if (adminLink && adminLink !== 'https://chat.whatsapp.com/SEU_GRUPO_PADRAO' && adminLink !== 'https://chat.whatsapp.com/SEU_GRUPO_TOKENS') {
                    console.log('✅ Usando link do admin:', adminLink);
                    return adminLink;
                }
            } catch (error) {
                console.error('❌ Erro ao buscar link no admin:', error);
            }
        } else {
            console.warn('⚠️ Função getWhatsAppLink não disponível');
        }
        
        // Tentar buscar diretamente no Firestore se a função não estiver disponível
        try {
            console.log('🔍 Tentando buscar diretamente no Firestore...');
            const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            
            if (window.firebaseDb) {
                const whatsappLinksRef = collection(window.firebaseDb, 'whatsapp_links');
                
                // Buscar link específico para o horário
                if (order.schedule) {
                    const specificQuery = query(
                        whatsappLinksRef,
                        where('eventType', '==', order.eventType),
                        where('schedule', '==', order.schedule),
                        where('status', '==', 'active')
                    );
                    const specificSnapshot = await getDocs(specificQuery);
                    
                    if (!specificSnapshot.empty) {
                        const link = specificSnapshot.docs[0].data().link;
                        console.log('✅ Link específico encontrado diretamente:', link);
                        return link;
                    }
                }
                
                // Buscar link geral para o evento
                const generalQuery = query(
                    whatsappLinksRef,
                    where('eventType', '==', order.eventType),
                    where('schedule', '==', null),
                    where('status', '==', 'active')
                );
                const generalSnapshot = await getDocs(generalQuery);
                
                if (!generalSnapshot.empty) {
                    const link = generalSnapshot.docs[0].data().link;
                    console.log('✅ Link geral encontrado diretamente:', link);
                    return link;
                }
            }
        } catch (error) {
            console.error('❌ Erro ao buscar diretamente no Firestore:', error);
        }
        
        // Fallback desativado: se não houver link válido, retornar vazio
        const fallbackLink = '';
        console.log('🔍 Usando link padrão:', fallbackLink);
        return fallbackLink;
    } catch (error) {
        console.error('❌ Erro ao obter link do WhatsApp:', error);
        return '';
    }
}

// Get appropriate action button for order (events only)
async function getOrderActionButton(order) {
    console.log('🔍 getOrderActionButton - Order:', order);
    
    // Verificar se é um evento (não produto da loja)
    const title = (order.title || '').toLowerCase();
    const item = (order.item || '').toLowerCase();
    const eventType = (order.eventType || '').toLowerCase();
    
    console.log('🔍 Title:', title, 'Item:', item, 'EventType:', eventType);
    
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
        console.log('❌ Produto da loja excluído');
        return '';
    }
    
    // Verificar se o pedido está confirmado
    if (!(order.status === 'paid' || order.status === 'confirmed')) {
        console.log('❌ Pedido não confirmado, status:', order.status);
        return '';
    }
    
    console.log('✅ Pedido válido, obtendo link do WhatsApp...');
    
    // Obter link do WhatsApp dinamicamente
    const whatsappLink = await getWhatsAppLinkForOrder(order);
    console.log('🔍 Link obtido:', whatsappLink);
    
    // Calcular janela de disponibilidade (1 hora antes até 1 hora depois)
    let isAvailable = false;
    // Padrão: não disponível até provar o contrário
    let buttonText = 'Aguardando liberação';
    let buttonClass = 'text-gray-500 bg-gray-100 cursor-not-allowed';
    const hasLink = typeof whatsappLink === 'string' && whatsappLink.startsWith('http');
    let linkDisplay = whatsappLink;
    
    if ((order.schedule && order.date) || (order.eventDate && (order.schedule || order.hour))) {
        const dateStr = order.date || order.eventDate;
        const scheduleStr = order.schedule || order.hour || '';
        console.log('🔍 Data do evento:', dateStr, 'Horário:', scheduleStr);
        console.log('🔍 Order completo:', order);
        
        // Se dateStr é um objeto Date, converter para string no formato correto
        let actualDateStr = dateStr;
        if (dateStr instanceof Date) {
            // Se temos eventDate, verificar se é uma data válida e recente
            if (order.eventDate) {
                const eventDateObj = new Date(order.eventDate);
                const now = new Date();
                const daysDiff = (now - eventDateObj) / (1000 * 60 * 60 * 24);
                
                console.log('🔍 eventDate:', order.eventDate);
                console.log('🔍 Diferença em dias:', daysDiff);
                
                // Se eventDate é muito antigo (mais de 30 dias), usar a data de criação
                if (daysDiff > 30) {
                    actualDateStr = dateStr.toISOString().split('T')[0];
                    console.log('🔍 eventDate muito antigo, usando data de criação:', actualDateStr);
                } else {
                    actualDateStr = order.eventDate;
                    console.log('🔍 Usando eventDate válido:', actualDateStr);
                }
            } else {
                // Converter Date para string YYYY-MM-DD
                actualDateStr = dateStr.toISOString().split('T')[0];
                console.log('🔍 Convertendo Date para string:', actualDateStr);
            }
        } else if (typeof dateStr === 'string') {
            // Se é string, verificar se é a data correta
            console.log('🔍 dateStr é string:', dateStr);
            
            // Se temos eventDate, verificar se é válido
            if (order.eventDate) {
                const eventDateObj = new Date(order.eventDate);
                const now = new Date();
                const daysDiff = (now - eventDateObj) / (1000 * 60 * 60 * 24);
                
                console.log('🔍 eventDate string:', order.eventDate);
                console.log('🔍 Diferença em dias:', daysDiff);
                
                // Se eventDate é muito antigo, usar dateStr
                if (daysDiff > 30) {
                    actualDateStr = dateStr;
                    console.log('🔍 eventDate muito antigo, usando dateStr:', actualDateStr);
                } else {
                    actualDateStr = order.eventDate;
                    console.log('🔍 Usando eventDate válido:', actualDateStr);
                }
            }
        }
        
        console.log('🔍 Data final a ser usada:', actualDateStr);
        
        const startDt = getEventDateTime(actualDateStr, scheduleStr);
        console.log('🔍 Data/hora calculada:', startDt);
        
        if (!isNaN(startDt.getTime())) {
            const now = new Date();
            const oneHourBefore = new Date(startDt.getTime() - (60 * 60 * 1000)); // 1 hora antes
            const oneHourAfter = new Date(startDt.getTime() + (60 * 60 * 1000)); // 1 hora depois
            
            console.log('🔍 Agora:', now);
            console.log('🔍 1h antes:', oneHourBefore);
            console.log('🔍 1h depois:', oneHourAfter);
            console.log('🔍 Evento em:', startDt);
            
            // Calcular diferenças em minutos para debug
            const minutesUntilStart = Math.ceil((startDt.getTime() - now.getTime()) / (1000 * 60));
            const minutesAfterStart = Math.ceil((now.getTime() - startDt.getTime()) / (1000 * 60));
            
            console.log('🔍 Minutos até o evento:', minutesUntilStart);
            console.log('🔍 Minutos após o evento:', minutesAfterStart);
            
            if (now >= oneHourBefore && now <= oneHourAfter) {
                isAvailable = true;
                buttonText = 'Entrar no Grupo';
                buttonClass = 'text-green-700 bg-green-100 hover:bg-green-200';
                console.log('✅ Link disponível - dentro da janela');
            } else if (now < oneHourBefore) {
                // Ainda não está disponível
                const timeUntilAvailable = Math.ceil((oneHourBefore.getTime() - now.getTime()) / (1000 * 60));
                buttonText = `Disponível em ${timeUntilAvailable}min`;
                buttonClass = 'text-gray-500 bg-gray-100 cursor-not-allowed';
                isAvailable = false;
                console.log('⏰ Link não disponível ainda:', buttonText);
            } else {
                // Já expirou - evento passou
                buttonText = 'Link Expirado';
                buttonClass = 'text-gray-500 bg-gray-100 cursor-not-allowed';
                isAvailable = false;
                console.log('❌ Link expirado - evento passou');
                console.log('🔍 Motivo: agora > 1h depois do evento');
            }
        } else {
            console.log('❌ Data/hora inválida');
        }
    } else {
        console.log('❌ Dados de data/hora insuficientes');
    }
    
    return `
        <div class="mt-3 space-y-2">
            <!-- Link do WhatsApp visível -->
            ${hasLink ? `
            <div class="text-xs text-gray-600">
                <strong>Link:</strong> <a href="${whatsappLink}" target="_blank" rel="noopener" class="font-mono text-xs break-all text-blue-700 underline">${linkDisplay}</a>
            </div>
            ` : ''}
            
            <!-- Botão de ação -->
            ${isAvailable && hasLink ? `
                <a href="${whatsappLink}" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${buttonClass}">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    ${buttonText}
                </a>
            ` : `
                <span class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${buttonClass}">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    ${hasLink ? buttonText : 'Link indisponível'}
                </span>
            `}
        </div>
    `;
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
    
    // Camisa física - solicitar dados de entrega e exibir status
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
                <button onclick="openShippingModal('${product.id}')" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                    Enviar dados de entrega
                </button>
                ${shipping?.address ? `<p class="text-xs text-gray-500 mt-1">Aguardando envio • ${shipping.name || ''}, ${shipping.address || ''}</p>` : `<p class="text-xs text-gray-500 mt-1">Aguardando dados de entrega</p>`}
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
            where('uid','==', currentUser.uid)
        ];
    } else {
        candidates = [
            where('userId','==', currentUser.uid),
            where('uid','==', currentUser.uid),
            where('ownerId','==', currentUser.uid)
        ];
    }
    
    console.log(`🔍 Searching in collection '${colName}' with email: ${currentUser.email}, uid: ${currentUser.uid}`);
    const resultMap = new Map();
    for (const cond of candidates){
        try{
            const qy = query(colRef, cond);
            const snap = await getDocs(qy);
            console.log(`🔍 Query result for ${colName} (${String(cond?.fieldPath||'')}):`, snap.size, 'documents');
            snap.forEach(d => {
                const data = d.data();
                resultMap.set(d.id, { id: d.id, data });
            });
        }catch(e){
            console.log(`🔍 Query error for ${colName}:`, e);
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
        // Verificar se Firebase está inicializado
        if (!db) {
            console.error('❌ Firebase not initialized, attempting to reinitialize...');
            initializeFirebase();
            if (!db) {
                alert('Erro: Firebase não foi inicializado. Recarregue a página.');
                return;
            }
        }
        
        // preço base R$1 por token, aplicar cupom se houver
        const basePrice = quantity || selectedTokensQty || 0;
        if (!basePrice){ alert('Selecione a quantidade de tokens'); return; }
        let price = basePrice;
        if (appliedTokenCoupon) {
            const discount = appliedTokenCoupon.discountType === 'percentage'
              ? basePrice * (appliedTokenCoupon.discountValue / 100)
              : appliedTokenCoupon.discountValue;
            price = Math.max(0, basePrice - discount);
        }
        
        // Criar preferência no Mercado Pago
        const response = await fetch('/.netlify/functions/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `${basePrice} Token${basePrice > 1 ? 's' : ''} XTreino`,
                unit_price: price,
                currency_id: 'BRL',
                quantity: 1,
                back_url: window.location.origin + window.location.pathname,
                coupon_info: appliedTokenCoupon ? {
                    id: appliedTokenCoupon.id,
                    code: appliedTokenCoupon.code,
                    discountType: appliedTokenCoupon.discountType,
                    discountValue: appliedTokenCoupon.discountValue,
                    context: 'tokens'
                } : undefined
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
                quantity: basePrice,
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
