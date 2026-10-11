// ==================== TOAST NOTIFICATION SYSTEM ====================
let confirmResolve = null;
const CAMP_SEMIFINAL_DATES = ['2024-11-22','2024-11-23','2025-11-22','2025-11-23'];
const CAMP_FINAL_DATES = ['2024-11-28','2025-11-28'];
let campSemifinalLinks = {};
let campSemifinalLinksLoaded = false;

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
            console.error('❌ Um ou mais elementos do modal não encontrados!');
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
    
    
    if (!confirmResolve) {
        console.error('  ❌ confirmResolve é null! Cancelando...');
        closeConfirmModal();
        return;
    }
    
    
    const resolve = confirmResolve;
    confirmResolve = null; // Limpar ANTES de resolver
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    resolve(true); // Resolver após limpar
    
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

// Admin RBAC and dashboards - Enhanced Security
(async function(){
  // Security: Check if running in admin context
  if (!window.location.pathname.includes('admin.html') && !window.location.pathname.includes('admin')) {
    console.warn('Admin script loaded outside admin context');
    return;
  }

  // Wait firebase
  const waitReady = () => new Promise(res => {
    const tick = () => {
      if (window.firebaseReady && window.firebaseDb && window.firebaseAuth) {
        
        res();
      } else {
        console.log('⏳ Aguardando inicialização do Firebase...', {
          firebaseReady: window.firebaseReady,
          firebaseDb: !!window.firebaseDb,
          firebaseAuth: !!window.firebaseAuth
        });
        setTimeout(tick, 100);
      }
    };
    tick();
  });
  await waitReady();

  const { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
  const { collection, getDocs, doc, updateDoc, query, where, orderBy, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

  // Security: Admin email whitelist (configure these)
  const ADMIN_EMAILS = [
    'cleitondouglass@gmail.com',
    'cleitondouglass123@hotmail.com',
    'gilmariofreitas378@gmail.com',
    'gilmariofreitas387@gmail.com',
    'flavetyr@gmail.com'
  ];

  // Security: Session timeout (30 minutes)
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  let sessionTimer = null;

  const authGate = document.getElementById('authGate');
  const dashboard = document.getElementById('dashboard');
  const roleBadge = document.getElementById('roleBadge');
  const loginError = document.getElementById('loginError');
  const loginInfo = document.getElementById('loginInfo');

  // Security: Check if user is authorized admin
  async function isAuthorizedAdmin(user) {
    if (!user || !user.email) return false;    
  
    // Check user role in Firestore
    try {
      
      const userDoc = await getDoc(doc(window.firebaseDb, 'users', user.uid));
      if (!userDoc.exists()) {       
        
        // Criar documento do usuário automaticamente
        const { setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const userData = {
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          role: 'socio', // Definir como socio por padrão
          createdAt: new Date(),
          lastLogin: Date.now()
        };
        
        await setDoc(doc(window.firebaseDb, 'users', user.uid), userData);
        
        
        // Agora tentar novamente
        const newUserDoc = await getDoc(doc(window.firebaseDb, 'users', user.uid));
        if (!newUserDoc.exists()) {
          
          return false;
        }
        
        const newUserData = newUserDoc.data();
        const role = (newUserData.role || '').toLowerCase();
        
        
        if (role === 'socio' || role === 'sócio' || role === 'ceo') {
          
          return true;
        }
        
        return false;
      }
      
      const userData = userDoc.data();
      const role = (userData.role || '').toLowerCase();
      
      
      
      
      // Para socio, permitir acesso total
      if (role === 'socio' || role === 'sócio' || role === 'ceo') {
        
        return true;
      }
      
      const isAuthorized = ['admin', 'staff', 'gerente', 'vendedor', 'design', 'designer', 'desgin',
                            'moderador', 'operador', 'suporte'].includes(role);
      return isAuthorized;
    } catch (error) {
      console.error('❌ Erro ao verificar cargo:', error);
      return false;
    }
  }

  // Security: Session management
  function startSessionTimer() {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
      
      logout();
    }, SESSION_TIMEOUT);
  }

  function resetSessionTimer() {
    startSessionTimer();
  }

  // Security: Enhanced logout
  async function logout() {
    try {
      await signOut(window.firebaseAuth);
      sessionStorage.removeItem('adminSession');
      localStorage.removeItem('adminSession');
      if (sessionTimer) clearTimeout(sessionTimer);
      showAuthGate();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Security: Show login form
  function showAuthGate() {
    authGate.classList.remove('hidden');
    dashboard.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }

  // Security: Show dashboard
  function showDashboard(userRole) {
    authGate.classList.add('hidden');
    // Aplicar permissões ANTES de exibir o dashboard — evita flash de conteúdo não autorizado
    window.visibilityApplied = false;
    controlSectionVisibility((userRole || '').toLowerCase().trim());
    dashboard.classList.remove('hidden');
    setView(userRole);
    startSessionTimer();
  }
  
  // Expor showDashboard globalmente imediatamente
  window.showDashboard = showDashboard;

  // ===== MATRIZ DE PERMISSÕES POR CARGO =====
  const ROLE_SECTIONS = {
    // CEO: tudo liberado
    ceo: ['sectionKPIs','sectionFilters','sectionCharts','sectionUsers','sectionOrders',
          'sectionTokenStats','sectionUsersManagement','sectionTokens','sectionCoupons',
          'sectionCouponUsage','sectionAffiliates','sectionAffiliateSales','sectionAffiliatePayouts',
          'sectionAffiliatePanel','sectionPasseBooyah','sectionHighlights','sectionNews',
          'sectionProducts','sectionEvents','sectionBonusSlots','sectionShirtOrders',
          'sectionSchedules','sectionNotificationsAdmin','sectionAdminHistory','sectionResetData',
          'sectionChampResults','sectionChampConfig'],
    // SOCIO: tudo, somente visualização (sem reset)
    socio: ['sectionKPIs','sectionFilters','sectionCharts','sectionUsers','sectionOrders',
            'sectionTokenStats','sectionUsersManagement','sectionTokens','sectionCoupons',
            'sectionCouponUsage','sectionAffiliates','sectionAffiliateSales','sectionAffiliatePayouts',
            'sectionAffiliatePanel','sectionPasseBooyah','sectionHighlights','sectionNews',
            'sectionProducts','sectionEvents','sectionBonusSlots','sectionShirtOrders',
            'sectionSchedules','sectionNotificationsAdmin','sectionAdminHistory',
            'sectionChampResults','sectionChampConfig'],
    // GERENTE: tudo, EXCETO aba principal completa (KPIs, filtros, gráficos, pedidos, tokenStats)
    gerente: ['sectionUsers','sectionUsersManagement',
              'sectionTokens','sectionCoupons','sectionCouponUsage','sectionAffiliates',
              'sectionAffiliateSales','sectionAffiliatePayouts','sectionAffiliatePanel','sectionPasseBooyah',
              'sectionHighlights','sectionNews','sectionProducts','sectionEvents','sectionBonusSlots',
              'sectionShirtOrders','sectionSchedules',
              'sectionNotificationsAdmin','sectionAdminHistory',
              'sectionChampResults','sectionChampConfig'],
    // DESIGNER: apenas conteúdo (destaques, notícias, produtos, eventos) — sem camisas, sem horários
    designer: ['sectionHighlights','sectionNews','sectionProducts','sectionEvents'],
    // VENDEDOR: usuários + financeiro (sem aba principal) + camisas + produtos + notificações
    vendedor: ['sectionUsers','sectionUsersManagement',
               'sectionTokens','sectionCoupons','sectionCouponUsage','sectionAffiliates',
               'sectionAffiliateSales','sectionAffiliatePayouts','sectionPasseBooyah','sectionShirtOrders',
               'sectionProducts','sectionNotificationsAdmin'],
    // ADMIN: gerenciador de eventos + horários + notificações + campeonato
    admin: ['sectionEvents','sectionSchedules','sectionNotificationsAdmin',
            'sectionChampResults','sectionChampConfig'],
    // STAFF: notificações, eventos e campeonato
    staff: ['sectionEvents','sectionNotificationsAdmin','sectionChampResults'],
    // MODERADOR: igual ao staff
    moderador: ['sectionEvents','sectionNotificationsAdmin','sectionChampResults'],
    // OPERADOR: mesmo acesso do vendedor (sem aba principal)
    operador: ['sectionUsers','sectionUsersManagement',
               'sectionTokens','sectionCoupons','sectionCouponUsage','sectionAffiliates',
               'sectionAffiliateSales','sectionAffiliatePayouts','sectionPasseBooyah','sectionShirtOrders',
               'sectionProducts','sectionNotificationsAdmin'],
    // SUPORTE: tokens, notificações, camisas
    suporte: ['sectionTokens','sectionNotificationsAdmin','sectionShirtOrders'],
    // Aliases
    'sócio': null, // tratado abaixo
    'desgin': null,
    'design': null,
  };
  window.ROLE_SECTIONS = ROLE_SECTIONS;

  const ALL_SECTIONS = ['sectionKPIs','sectionFilters','sectionCharts','sectionUsers','sectionOrders',
    'sectionTokenStats','sectionUsersManagement','sectionTokens','sectionCoupons','sectionCouponUsage',
    'sectionAffiliates','sectionAffiliateSales','sectionAffiliatePayouts','sectionAffiliatePanel','sectionPasseBooyah',
    'sectionHighlights','sectionNews','sectionProducts','sectionEvents','sectionBonusSlots','sectionShirtOrders',
    'sectionSchedules','sectionNotificationsAdmin','sectionAdminHistory','sectionResetData',
    'sectionChampResults','sectionChampConfig'];

  // Control section visibility based on role
  function controlSectionVisibility(userRole) {
    const role = (userRole || '').toLowerCase().trim();

    if (window.lastAppliedRole === role && window.visibilityApplied) return;
    window.lastAppliedRole = role;
    window.visibilityApplied = true;
    
    // Resolve aliases
    const resolvedRole = (role === 'sócio') ? 'socio'
      : (role === 'desgin' || role === 'design') ? 'designer'
      : role;

    // Ocultar todas as seções primeiro
    ALL_SECTIONS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Determinar seções permitidas para o cargo
    const allowed = ROLE_SECTIONS[resolvedRole] || [];

    // Mostrar seções permitidas
    // Usar display='' (remove override inline) para que Tailwind/CSS natural seja respeitado
    // Seções grid ficam como grid, seções block ficam como block
    allowed.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = '';
        el.classList.remove('hidden');
        // Carregar eventos se necessário
        if (id === 'sectionEvents' && typeof loadEventsPreview === 'function') {
          loadEventsPreview();
        }
        if (id === 'sectionAffiliatePayouts' && typeof loadAffiliatePayouts === 'function') {
          loadAffiliatePayouts();
        }
      }
    });

    // Atualizar sidebar: ocultar links sem permissão (usa adminNav)
    document.querySelectorAll('.sidebar-link[onclick*="adminNav"]').forEach(btn => {
      const match = btn.getAttribute('onclick').match(/adminNav\s*\(\s*['"][^'"]*['"]\s*,\s*['"](\w+)['"]/);
      if (match) {
        const sectionId = match[1];
        const hasAccess = allowed.includes(sectionId);
        const li = btn.closest('li');
        if (li) li.style.display = hasAccess ? '' : 'none';
      }
    });

    // sectionKPIs: controla via classe no <html> (CSS !important — imune a qualquer override)
    if (['ceo','socio'].includes(resolvedRole)) {
      document.documentElement.classList.add('kpis-enabled');
    } else {
      document.documentElement.classList.remove('kpis-enabled');
    }

    // Ocultar labels de categoria quando todos os itens estão escondidos
    document.querySelectorAll('.sidebar-section-label').forEach(label => {
      const ul = label.nextElementSibling;
      if (ul && ul.classList.contains('sidebar-menu')) {
        const hasVisible = Array.from(ul.querySelectorAll('li')).some(li => li.style.display !== 'none');
        label.style.display = hasVisible ? '' : 'none';
      }
    });

    // Para compatibilidade - manter variáveis antigas
    const sectionKPIs = document.getElementById('sectionKPIs');
    const sectionFilters = document.getElementById('sectionFilters');
    const sectionCharts = document.getElementById('sectionCharts');
    const sectionUsers = document.getElementById('sectionUsers');
    const sectionTokenStats = document.getElementById('sectionTokenStats');
    const sectionUsersManagement = document.getElementById('sectionUsersManagement');
    const sectionTokens = document.getElementById('sectionTokens');
    const sectionCoupons = document.getElementById('sectionCoupons');
    const sectionCouponUsage = document.getElementById('sectionCouponUsage');
    const sectionAffiliates = document.getElementById('sectionAffiliates');
    const sectionAffiliateSales = document.getElementById('sectionAffiliateSales');
    const sectionPasseBooyah = document.getElementById('sectionPasseBooyah');
    const sectionHighlights = document.getElementById('sectionHighlights');
    const sectionNews = document.getElementById('sectionNews');
    const sectionProducts = document.getElementById('sectionProducts');
    const sectionEventsSection = document.getElementById('sectionEvents');
    const sectionSchedules = document.getElementById('sectionSchedules');
    const sectionAdminHistory = document.getElementById('sectionAdminHistory');
    const sectionAffiliatePanel = document.getElementById('sectionAffiliatePanel');
    
    // Afiliado: Apenas painel de afiliado (mantido para compatibilidade)
    if (role === 'afiliado') {
      ALL_SECTIONS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      const panel = document.getElementById('sectionAffiliatePanel');
      if (panel) { panel.style.display = 'block'; panel.classList.remove('hidden'); }
    }
  }
  // ===== SEÇÕES EDITÁVEIS POR CARGO =====
  // null = readonly total | [] = todas as seções visíveis | [...] = seções específicas
  const ROLE_EDIT_SECTIONS = {
    ceo:      null,   // edição total
    socio:    [],     // somente leitura
    gerente:  null,   // edição total nas seções visíveis
    vendedor: ['#sectionUsers','#sectionUsersManagement',
               '#sectionTokens','#sectionCoupons','#sectionCouponUsage','#sectionAffiliates',
               '#sectionAffiliateSales','#sectionPasseBooyah','#sectionShirtOrders',
               '#sectionProducts','#sectionNotificationsAdmin'],
    designer: ['#sectionHighlights','#sectionNews','#sectionProducts','#sectionEvents'],
    staff:    ['#sectionEvents','#sectionNotificationsAdmin'],
    moderador:['#sectionEvents','#sectionNotificationsAdmin'],
    operador: ['#sectionUsers','#sectionUsersManagement',
               '#sectionTokens','#sectionCoupons','#sectionCouponUsage','#sectionAffiliates',
               '#sectionAffiliateSales','#sectionPasseBooyah','#sectionShirtOrders',
               '#sectionProducts','#sectionNotificationsAdmin'],
    suporte:  ['#sectionTokens','#sectionNotificationsAdmin','#sectionShirtOrders'],
    admin:    ['#sectionEvents','#sectionNotificationsAdmin'],
  };

  function controlEditPermissions(userRole) {
    const role = (userRole || '').toLowerCase()
      .replace('sócio','socio').replace('desgin','designer').replace('design','designer');

    const allEditable = [
      ...document.querySelectorAll('input, textarea, select'),
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('.edit-btn,.save-btn,.delete-btn,.add-btn,[class*="btn"]'),
      ...document.querySelectorAll('[contenteditable="true"]'),
    ];

    const editSections = ROLE_EDIT_SECTIONS[role];

    if (editSections === null) {
      // Acesso total
      allEditable.forEach(el => {
        if (!el.hasAttribute('data-temp-disabled')) {
          el.disabled = false; el.readOnly = false;
          el.style.pointerEvents = 'auto'; el.style.opacity = '1';
        }
      });
      return;
    }

    if (editSections.length === 0) {
      // Somente leitura total (SOCIO)
      allEditable.forEach(el => {
        el.disabled = true; el.readOnly = true;
        el.style.pointerEvents = 'none'; el.style.opacity = '0.5';
      });
      return;
    }

    // Edição limitada a seções específicas
    const selectorStr = editSections.join(',');
    allEditable.forEach(el => {
      const inAllowed = el.closest(selectorStr);
      if (inAllowed && !el.hasAttribute('data-temp-disabled')) {
        el.disabled = false; el.readOnly = false;
        el.style.pointerEvents = 'auto'; el.style.opacity = '1';
      } else {
        el.disabled = true; el.readOnly = true;
        el.style.pointerEvents = 'none'; el.style.opacity = '0.5';
      }
    });
  }

  // Security: Show login error
  function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
    setTimeout(() => {
      loginError.classList.add('hidden');
    }, 5000);
  }

  function showLoginInfo(message) {
    if (!loginInfo) return;
    loginInfo.textContent = message;
    loginInfo.classList.remove('hidden');
    setTimeout(() => {
      loginInfo.classList.add('hidden');
    }, 7000);
  }

  // Forgot password handler
  const forgotBtn = document.getElementById('btnForgotPassword');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async () => {
      try {
        const emailInput = document.getElementById('adminEmail');
        const email = (emailInput?.value || '').trim();
        if (!email) {
          showLoginError('Informe seu email para redefinir a senha.');
          return;
        }
        await sendPasswordResetEmail(window.firebaseAuth, email);
        showLoginInfo('Enviamos um email com o link para redefinir sua senha.');
      } catch (err) {
        console.error('Erro ao enviar reset de senha:', err);
        const msg = (err && err.code) ? String(err.code) : 'Falha ao enviar email de redefinição.';
        showLoginError(msg.replace('auth/', '').replaceAll('-', ' '));
      }
    });
  }

  function setView(authRole){
    const role = (authRole||'').toLowerCase();
    roleBadge.textContent = `Permissão: ${authRole||'desconhecida'}`;

    // Aplicar visibilidade imediatamente (solução definitiva — sem esperar 1500ms)
    window.visibilityApplied = false;
    controlSectionVisibility(role);

    // Reaplicar permissões de edição após DOM estabilizar
    setTimeout(() => {
      window.visibilityApplied = false;
      controlSectionVisibility(role);
      controlEditPermissions(role);
    }, 800);
  }

  // Variáveis de paginação
  let usuariosData = [];
  let usuariosPage = 1;
  const usuariosPerPage = 5;
  
  let tokensData = [];
  let tokensPage = 1;
  const tokensPerPage = 3;
  
  let tokenUsageData = [];
  let tokenUsagePage = 1;
  const tokenUsagePerPage = 3;
  
  let confirmedOrdersData = [];
  let confirmedOrdersPage = 1;
  const confirmedOrdersPerPage = 5;

  // Função para carregar usuários do Firestore
  async function carregarUsuarios() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    try {
      // Verificar se Firebase está inicializado
      if (!window.firebaseDb) {
        console.error('❌ Firebase não inicializado - carregarUsuarios');
        return;
      }
      
      
      // Buscar usuários no Firestore
      const usersRef = collection(window.firebaseDb, 'users');
      const snapshot = await getDocs(usersRef);
      
      
      // Armazenar todos os dados
      usuariosData = [];
      snapshot.forEach(doc => {
        usuariosData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Atualizar contador
      document.getElementById('usersCount').textContent = `${usuariosData.length} usuários`;
      
      // Mostrar primeira página
      mostrarUsuariosPagina(1);
      
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      tbody.innerHTML = '<tr><td colspan="2" class="py-6 text-center text-red-500">Erro ao carregar usuários</td></tr>';
    }
  }

  // Função para mostrar usuários da página específica
  function mostrarUsuariosPagina(pagina) {
    const tbody = document.getElementById('usersTableBody');
    const startIndex = (pagina - 1) * usuariosPerPage;
    const endIndex = startIndex + usuariosPerPage;
    const usuariosPagina = usuariosData.slice(startIndex, endIndex);
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    // Adicionar usuários da página
    usuariosPagina.forEach(user => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-100 hover:bg-gray-50';
      
      row.innerHTML = `
        <td class="py-2 px-2">${user.email || 'Email não informado'}</td>
        <td class="py-2 px-2">
          <select class="role-select border border-gray-300 rounded px-2 py-1 text-xs" data-uid="${user.id}">
            <option value="Ceo" ${(user.role||'').toLowerCase() === 'ceo' ? 'selected' : ''}>CEO – Acesso Total</option>
            <option value="Socio" ${(user.role||'').toLowerCase() === 'socio' ? 'selected' : ''}>SOCIO – Visualização Total</option>
            <option value="Gerente" ${(user.role||'').toLowerCase() === 'gerente' ? 'selected' : ''}>Gerente – Sem Dashboard/Pagamentos</option>
            <option value="Vendedor" ${(user.role||'').toLowerCase() === 'vendedor' ? 'selected' : ''}>Vendedor – Pedidos/Tokens/Passes</option>
            <option value="Designer" ${['designer','design','desgin'].includes((user.role||'').toLowerCase()) ? 'selected' : ''}>Designer – Produtos/Eventos/Conteúdo</option>
            <option value="Staff" ${['staff','admin'].includes((user.role||'').toLowerCase()) ? 'selected' : ''}>Staff – Notificações/Eventos</option>
          </select>
        </td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Atualizar informações de paginação
    const totalPages = Math.ceil(usuariosData.length / usuariosPerPage);
    document.getElementById('usersPageInfo').textContent = `Página ${pagina} de ${totalPages}`;
    
    // Gerar botões de paginação
    gerarBotoesPaginacao('usersPagination', pagina, totalPages, (p) => mostrarUsuariosPagina(p));
    
    // Adicionar event listener para mudanças de role
    tbody.addEventListener('change', alterarRole);
  }

  // Função para gerar botões de paginação
  function gerarBotoesPaginacao(containerId, paginaAtual, totalPaginas, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (totalPaginas <= 1) return;
    
    // Botão anterior
    if (paginaAtual > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '«';
      prevBtn.className = 'px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded';
      prevBtn.onclick = () => callback(paginaAtual - 1);
      container.appendChild(prevBtn);
    }
    
    // Números das páginas
    const startPage = Math.max(1, paginaAtual - 2);
    const endPage = Math.min(totalPaginas, paginaAtual + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.className = `px-2 py-1 text-xs rounded ${i === paginaAtual ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`;
      pageBtn.onclick = () => callback(i);
      container.appendChild(pageBtn);
    }
    
    // Botão próximo
    if (paginaAtual < totalPaginas) {
      const nextBtn = document.createElement('button');
      nextBtn.textContent = '»';
      nextBtn.className = 'px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded';
      nextBtn.onclick = () => callback(paginaAtual + 1);
      container.appendChild(nextBtn);
    }
  }
  // Função para alterar role do usuário
  async function alterarRole(event) {
    if (!event.target.classList.contains('role-select')) return;
    
    const select = event.target;
    const uid = select.getAttribute('data-uid');
    const novoRole = select.value;
    const email = select.closest('tr').querySelector('td:first-child').textContent;
    
    // Desabilitar select durante a operação
    select.disabled = true;
    select.style.opacity = '0.6';
    select.setAttribute('data-temp-disabled', 'true');
    
    try {
      // Atualizar no Firestore
      const userRef = doc(window.firebaseDb, 'users', uid);
      await updateDoc(userRef, { role: novoRole });
      
      // Mostrar sucesso
      alert(`Role de ${email} alterado para ${novoRole} com sucesso!`);
      
    } catch (error) {
      console.error('Erro ao alterar role:', error);
      alert('Erro ao alterar role. Tente novamente.');
      
      // Reverter select para valor anterior
      select.value = select.getAttribute('data-original-value') || 'Vendedor';
    } finally {
      // Reabilitar select
      select.disabled = false;
      select.style.opacity = '1';
      select.removeAttribute('data-temp-disabled');
    }
  }

  // Função para carregar dados de tokens
  async function carregarDadosTokens() {
    try {
      // Verificar se Firebase está inicializado
      if (!window.firebaseDb) {
        console.error('❌ Firebase não inicializado - carregarDadosTokens');
        return;
      }
      
      // 
      // Buscar pedidos de tokens
      const ordersRef = collection(window.firebaseDb, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      // 
      
      tokensData = [];
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        const status = String(order.status || '').toLowerCase();
        const descriptorRaw = order.description || order.item || order.itemName || order.title || '';
        const descriptor = String(descriptorRaw).toLowerCase();
        // Log detalhado removido
        // Considera tokens se houver menção a "token" em qualquer campo descritivo
        if (descriptor.includes('token')) {
          // Apenas pedidos pagos/confirmados entram nas compras
          if (['paid','approved','confirmed'].includes(status)) {
            const originalDate = order.createdAt ? (order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt)) : new Date(order.timestamp || 0);
            // Tenta extrair quantidade de tokens do texto
            const m = String(descriptorRaw).match(/(\d+)\s*token/i);
            const tokenQty = m ? parseInt(m[1]) : (order.tokens || 1);
            tokensData.push({
              id: doc.id,
              cliente: order.customer || order.customerName || order.buyerEmail || 'Cliente não informado',
              pacote: order.item || order.itemName || order.title || 'Pacote de Tokens',
              tokens: tokenQty,
              valor: order.amount || order.total || 0,
              data: originalDate.toLocaleDateString('pt-BR'),
              originalDate: originalDate
            });
          }
        }
      });
      
      // Ordenar por data (mais recentes primeiro) - usar timestamp original
      tokensData.sort((a, b) => {
        const dateA = a.originalDate || new Date(0);
        const dateB = b.originalDate || new Date(0);
        return dateB - dateA;
      });
      
      // Elementos legados podem não existir mais — usar null guard
      const _tcEl = document.getElementById('tokensCount');
      const _tpEl = document.getElementById('totalTokensPurchased');
      if (_tcEl) _tcEl.textContent = `${tokensData.length} compras`;
      if (_tpEl) _tpEl.textContent = tokensData.length;

      // Mostrar primeira página apenas se tabela existir
      if (document.getElementById('tokensTbody')) mostrarTokensPagina(1);
      
    } catch (error) {
      console.error('Erro ao carregar dados de tokens:', error);
    }
  }

  // Função para mostrar tokens da página específica
  function mostrarTokensPagina(pagina) {
    const tbody = document.getElementById('tokensTbody');
    if (!tbody) return;
    const startIndex = (pagina - 1) * tokensPerPage;
    const endIndex = startIndex + tokensPerPage;
    const tokensPagina = tokensData.slice(startIndex, endIndex);
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    // Adicionar tokens da página
    tokensPagina.forEach(token => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-100 hover:bg-gray-50';
      
      row.innerHTML = `
        <td class="py-1 px-1 text-xs">${token.cliente}</td>
        <td class="py-1 px-1 text-xs">${token.pacote}</td>
        <td class="py-1 px-1 text-xs">${token.tokens}</td>
        <td class="py-1 px-1 text-xs">${token.valor}</td>
        <td class="py-1 px-1 text-xs">${token.data}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Atualizar informações de paginação
    const totalPages = Math.ceil(tokensData.length / tokensPerPage);
    document.getElementById('tokensPageInfo').textContent = `Página ${pagina} de ${totalPages}`;
    
    // Gerar botões de paginação
    gerarBotoesPaginacao('tokensPurchasesPagination', pagina, totalPages, (p) => mostrarTokensPagina(p));
  }

  // Função para carregar dados de uso de tokens
  async function carregarDadosUsoTokens() {
    try {
      // Verificar se Firebase está inicializado
      if (!window.firebaseDb) {
        console.error('❌ Firebase não inicializado - carregarDadosUsoTokens');
        return;
      }
      
      // Buscar registros de uso de tokens
      const registrationsRef = collection(window.firebaseDb, 'registrations');
      const registrationsSnapshot = await getDocs(registrationsRef);
      
      tokenUsageData = [];
      registrationsSnapshot.forEach(doc => {
        const reg = doc.data();
        if (reg.paidWithTokens) {
          const originalDate = reg.createdAt ? (reg.createdAt.seconds ? new Date(reg.createdAt.seconds * 1000) : new Date(reg.createdAt)) : new Date(0);
          tokenUsageData.push({
            id: doc.id,
            cliente: reg.email || 'Cliente não informado',
            evento: resolveEventName(reg.eventType, reg.title || 'Evento'),
            tokens: reg.tokensUsed || '1',
            data: originalDate.toLocaleString('pt-BR'),
            originalDate: originalDate
          });
        }
      });
      
      // Ordenar por data (mais recentes primeiro) - usar timestamp original
      tokenUsageData.sort((a, b) => {
        const dateA = a.originalDate || new Date(0);
        const dateB = b.originalDate || new Date(0);
        return dateB - dateA;
      });
      
      const _tuEl = document.getElementById('totalTokensUsed');
      if (_tuEl) _tuEl.textContent = tokenUsageData.length;

      if (document.getElementById('tokenUsageTbody')) mostrarUsoTokensPagina(1);
      
    } catch (error) {
      console.error('Erro ao carregar dados de uso de tokens:', error);
    }
  }

  // Função para mostrar uso de tokens da página específica
  function mostrarUsoTokensPagina(pagina) {
    const tbody = document.getElementById('tokenUsageTbody');
    if (!tbody) return;
    const startIndex = (pagina - 1) * tokenUsagePerPage;
    const endIndex = startIndex + tokenUsagePerPage;
    const tokenUsagePagina = tokenUsageData.slice(startIndex, endIndex);
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    // Adicionar uso de tokens da página
    tokenUsagePagina.forEach(usage => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-100 hover:bg-gray-50';
      
      row.innerHTML = `
        <td class="py-1 px-1 text-xs">${usage.cliente}</td>
        <td class="py-1 px-1 text-xs">${usage.evento}</td>
        <td class="py-1 px-1 text-xs">${usage.tokens}</td>
        <td class="py-1 px-1 text-xs">${usage.data}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Atualizar informações de paginação
    const totalPages = Math.ceil(tokenUsageData.length / tokenUsagePerPage);
    
    // Gerar botões de paginação
    gerarBotoesPaginacao('tokenUsagePagination', pagina, totalPages, (p) => mostrarUsoTokensPagina(p));
  }

  // Função para carregar pedidos confirmados
  async function carregarPedidosConfirmados() {
    try {
      // Verificar se Firebase está inicializado
      if (!window.firebaseDb) {
        console.error('❌ Firebase não inicializado - carregarPedidosConfirmados');
        return;
      }
      
      
      // Buscar pedidos confirmados
      const ordersRef = collection(window.firebaseDb, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      
      
      // Função auxiliar para obter nome do item/evento
      const getItemName = (order) => {
        // Se tiver eventType, mapear para nome legível
        if (order.eventType) {
          const eventMap = {
            'modo-liga': 'Modo Liga',
            'xtreino-tokens': 'XTreino Tokens',
            'xtreino': 'XTreino Tokens',
            'semanal-freitas': 'Semanal Freitas',
            'semanal': 'Semanal Freitas',
            'camp-freitas': 'Camp Freitas',
            'camp': 'Camp Freitas'
          };
          return eventMap[order.eventType.toLowerCase()] || order.eventType;
        }
        // Tentar outros campos
        return order.title || order.item || order.productName || 'Item não informado';
      };
      
      confirmedOrdersData = [];
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        // Log detalhado removido
        if (['paid','approved','confirmed'].includes(String(order.status||'').toLowerCase())) {
          const originalDate = order.createdAt ? (order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt)) : new Date(0);
          confirmedOrdersData.push({
            id: doc.id,
            cliente: order.customer || order.customerName || order.buyerEmail || 'Cliente não informado',
            item: getItemName(order),
            valor: order.amount || order.total || 0,
            data: originalDate.toLocaleDateString('pt-BR'),
            originalDate: originalDate
          });
        }
      });
      
      // Ordenar por data (mais recentes primeiro)
      confirmedOrdersData.sort((a, b) => {
        const dateA = a.originalDate || new Date(0);
        const dateB = b.originalDate || new Date(0);
        return dateB - dateA;
      });
      
      // Atualizar contador
      document.getElementById('confirmedCount').textContent = `${confirmedOrdersData.length} pedidos`;
      // 
      
      // Mostrar primeira página
      mostrarPedidosConfirmadosPagina(1);
      
    } catch (error) {
      console.error('Erro ao carregar pedidos confirmados:', error);
    }
  }

  // Função para mostrar pedidos confirmados da página específica
  function mostrarPedidosConfirmadosPagina(pagina) {
    const tbody = document.getElementById('confirmedTbody');
    const startIndex = (pagina - 1) * confirmedOrdersPerPage;
    const endIndex = startIndex + confirmedOrdersPerPage;
    const pedidosPagina = confirmedOrdersData.slice(startIndex, endIndex);
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    // Adicionar pedidos da página
    pedidosPagina.forEach(pedido => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-100 hover:bg-gray-50';
      
      row.innerHTML = `
        <td class="py-1 px-1 text-xs">${pedido.cliente}</td>
        <td class="py-1 px-1 text-xs">${pedido.item}</td>
        <td class="py-1 px-1 text-xs">${pedido.valor}</td>
        <td class="py-1 px-1 text-xs">${pedido.data}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Atualizar informações de paginação
    const totalPages = Math.ceil(confirmedOrdersData.length / confirmedOrdersPerPage);
    document.getElementById('confirmedPageInfo').textContent = `Página ${pagina} de ${totalPages}`;
    
    // Gerar botões de paginação
    gerarBotoesPaginacao('confirmedPagination', pagina, totalPages, (p) => mostrarPedidosConfirmadosPagina(p));
  }

  // Submissão manual de equipe/cadastro rápido (confirma vaga sem pagamento)
  let _isSavingTeam = false;
  // Busca userId de um cliente pelo e-mail na coleção 'users'
  async function resolveUserIdByEmail(email) {
    if (!email || !window.firebaseDb) return null;
    try {
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const snap = await getDocs(query(
        collection(window.firebaseDb, 'users'),
        where('email', '==', email.toLowerCase().trim())
      ));
      if (!snap.empty) return snap.docs[0].id;
      // Tenta também pelo campo 'uid'
      const snap2 = await getDocs(query(
        collection(window.firebaseDb, 'users'),
        where('uid', '==', email.toLowerCase().trim())
      ));
      return snap2.empty ? null : snap2.docs[0].id;
    } catch (_) { return null; }
  }
  window.resolveUserIdByEmail = resolveUserIdByEmail;

  // Toggle visual do tipo de vaga (Pago / Listagem Grátis)
  window.selectAddPaidType = function(type) {
    const isPaid = type === 'paid';
    const paidLabel = document.getElementById('addPaidLabel');
    const freeLabel = document.getElementById('addFreeLabel');
    const dotPago   = document.getElementById('addDotPago');
    const dotGratis = document.getElementById('addDotGratis');
    const paidInput = document.getElementById('addPaidPago');
    const freeInput = document.getElementById('addPaidGratis');
    if (!paidLabel || !freeLabel) return;
    if (isPaid) {
      paidLabel.className = 'flex items-center gap-2 border-2 border-green-500 bg-green-50 rounded-xl px-4 py-3 cursor-pointer transition-all';
      freeLabel.className = 'flex items-center gap-2 border-2 border-gray-200 bg-white rounded-xl px-4 py-3 cursor-pointer transition-all';
      dotPago.className = 'w-4 h-4 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center flex-shrink-0';
      dotPago.innerHTML = '<div class="w-2 h-2 rounded-full bg-white"></div>';
      dotGratis.className = 'w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0';
      dotGratis.innerHTML = '';
      if (paidInput) paidInput.checked = true;
    } else {
      freeLabel.className = 'flex items-center gap-2 border-2 border-orange-400 bg-orange-50 rounded-xl px-4 py-3 cursor-pointer transition-all';
      paidLabel.className = 'flex items-center gap-2 border-2 border-gray-200 bg-white rounded-xl px-4 py-3 cursor-pointer transition-all';
      dotGratis.className = 'w-4 h-4 rounded-full border-2 border-orange-400 bg-orange-400 flex items-center justify-center flex-shrink-0';
      dotGratis.innerHTML = '<div class="w-2 h-2 rounded-full bg-white"></div>';
      dotPago.className = 'w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0';
      dotPago.innerHTML = '';
      if (freeInput) freeInput.checked = true;
    }
  };

  // Verificação ao sair do campo de e-mail — mostra se o usuário existe
  async function onAddEmailBlur() {
    const emailEl = document.getElementById('addEmail');
    const statusEl = document.getElementById('addEmailStatus');
    if (!emailEl || !statusEl) return;
    const email = emailEl.value.trim();
    if (!email) { statusEl.textContent = ''; return; }
    statusEl.textContent = 'Verificando...';
    statusEl.className = 'text-xs mt-1 text-gray-400';
    const uid = await resolveUserIdByEmail(email);
    if (uid) {
      statusEl.textContent = '✅ Usuário encontrado — notificações serão enviadas para ele.';
      statusEl.className = 'text-xs mt-1 text-green-600';
    } else {
      statusEl.textContent = '⚠️ E-mail não encontrado no sistema. A vaga será salva, mas ele não receberá notificações.';
      statusEl.className = 'text-xs mt-1 text-yellow-600';
    }
  }
  window.onAddEmailBlur = onAddEmailBlur;

  async function submitAddTeam(e){
    if (_isSavingTeam) { e?.preventDefault(); return; }
    try{
      e?.preventDefault();
          const hourEl = document.getElementById('addHour');
          const teamEl = document.getElementById('addTeamName');
          const contactEl = document.getElementById('addContact');
          const emailEl = document.getElementById('addEmail');
          const personEl = document.getElementById('addPerson');
          const notesEl = document.getElementById('addNotes');
          const msgEl = document.getElementById('addTeamMsg');
          const dateEl = document.getElementById('boardDate');
          const typeEl = document.getElementById('boardEventType');
          const _rawHour = (hourEl?.value || '').trim();
          // Normaliza "21:00" → "21h" para ficar consistente com inscrições normais
          const schedule = _rawHour.replace(/^(\d{1,2}):(\d{2})$/, (_, h) => h + 'h');
          const teamName = (teamEl?.value || '').trim();
          const contact = (contactEl?.value || '').trim();
          const clientEmail = (emailEl?.value || '').trim().toLowerCase();
          const person = (personEl?.value || '').trim();
          const notes = (notesEl?.value || '').trim();
          const date = (dateEl?.value || '').trim();
          // Usar tipo canônico (ex: 'xtreino-tokens') em vez do ID do doc Firestore
          const _selectedOpt = typeEl?.options?.[typeEl?.selectedIndex];
          const eventType = (_selectedOpt?.dataset?.canonicalType || canonicalType(typeEl?.value) || typeEl?.value || '').trim();
          if (!teamName || !contact){
            alert('Informe ao menos Time/Org e Contato.');
            return;
          }
          if (!eventType){
            alert('Selecione o tipo de evento no painel de horários antes de adicionar um time.\n\nSem o tipo de evento, o time não aparecerá na lista de Inscritos.');
            return;
          }
          if (!schedule || schedule === '—'){
            alert('Selecione o horário no painel de horários antes de adicionar um time.');
            return;
          }
          if (!date){
            alert('Selecione uma data no painel de horários.');
            return;
          }
          const submitBtn = document.querySelector('#formAddTeam button[type="submit"], #formAddTeam button:not([type="button"])');
          const originalBtnText = submitBtn ? submitBtn.textContent : null;
          _isSavingTeam = true;
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }
          if (msgEl) msgEl.textContent = '';

          // Resolve o userId real do cliente pelo e-mail
          let clientUserId = null;
          if (clientEmail) {
            clientUserId = await resolveUserIdByEmail(clientEmail);
          }

          const _paidTypeEl = document.querySelector('input[name="addPaidType"]:checked');
          const isFreeSlot = (_paidTypeEl?.value || 'paid') === 'free';

          const payload = {
            teamName,
            contact,
            email: clientEmail || null,
            person: person || null,
            notes: notes || null,
            date,
            schedule: schedule || '—',
            eventType: eventType || null,
            status: 'confirmed',
            userId: clientUserId || null,
            addedManually: true,
            freeSlot: isFreeSlot,
            listingType: isFreeSlot ? 'free' : 'paid'
          };
          try{
            const { collection, addDoc, serverTimestamp, query: _q, where: _w, getDocs: _gd, getDoc: _gd1, doc: _doc, runTransaction: _runTx } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            // Calcular próximo slot sequencial (unificado com PIX/tokens via transação atômica)
            const _normH = s => {
                const str = String(s||'').trim();
                const mColon = str.match(/(\d{1,2}):(\d{2})/);
                if (mColon) return parseInt(mColon[1],10)+'h';
                const mH = str.match(/(\d{1,2})\s*h/i);
                if (mH) return parseInt(mH[1],10)+'h';
                return str;
            };
            // rawEvType para consistência com MP
            const _rawDocId = (typeEl?.selectedOptions?.[0]?.dataset?.rawEventId || typeEl?.value || '').trim();
            let _rawEvType = _rawDocId;
            try {
                const _evSnap = await _gd1(_doc(window.firebaseDb, 'adminEvents', _rawDocId));
                if (_evSnap.exists() && _evSnap.data().eventType) _rawEvType = _evSnap.data().eventType;
            } catch(_) {}
            payload.eventType = _rawEvType || eventType || null;
            payload.teamName = teamName;

            // Calcular próximo slot sequencial real (total de inscritos no horário + 1)
            // Assim o time aparece na lista bônus com número correto em vez de "—"
            let _nextSlot = Math.floor(Date.now() / 1000); // fallback timestamp (links sem bonus)
            let _nextSlotDisplay = null;
            try {
                const _allSnap = await _gd(_q(
                    collection(window.firebaseDb, 'registrations'),
                    _w('eventType', '==', payload.eventType || eventType),
                    _w('date', '==', date)
                ));
                let _count = 0;
                const _normSchedLink = _normH(schedule);
                _allSnap.forEach(d => {
                    const r = d.data();
                    if (r.status === 'pending') return; // pendentes não ocupam slot
                    if (_normH(r.schedule || r.hour || '') === _normSchedLink) _count++;
                });
                _nextSlot = _count + 1;
                // Modo Liga usa letras (A, B, C...) — demais eventos usam #número
                const _isLigaManual = (() => { const _t = String(_rawEvType || '').toLowerCase(); return _t === 'modo-liga' || _t.includes('liga'); })();
                _nextSlotDisplay = _isLigaManual ? `Vaga ${String.fromCharCode(64 + _nextSlot)}` : `Vaga #${_nextSlot}`;
            } catch (_) {}

            payload.slot = _nextSlot;
            payload.slotNumber = _nextSlot;
            payload.slotDisplay = _nextSlotDisplay;
            await addDoc(collection(window.firebaseDb,'registrations'), { ...payload, createdAt: serverTimestamp() });
            const notifMsg = clientUserId
              ? 'Time adicionado! O cliente receberá notificações de ID/senha.'
              : clientEmail
                ? 'Time adicionado. ⚠️ E-mail não encontrado — cliente não receberá notificações.'
                : 'Time adicionado com sucesso!';
            if (msgEl) msgEl.textContent = notifMsg;
            // limpar campos
            if (teamEl) teamEl.value = '';
            if (contactEl) contactEl.value = '';
            if (emailEl) { emailEl.value = ''; }
            const statusEl = document.getElementById('addEmailStatus');
            if (statusEl) statusEl.textContent = '';
            if (personEl) personEl.value = '';
            if (notesEl) notesEl.value = '';
            // Atualiza quadro e pendências
            try { await loadBoard(); } catch(_){}
            try { await loadPending(true); } catch(_){}
          }catch(err){
            alert('Falha ao salvar time.');
          } finally {
            _isSavingTeam = false;
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText || 'Adicionar'; }
          }
    }catch(_){ _isSavingTeam = false; }
  }
  // Expor submitAddTeam globalmente
  window.submitAddTeam = submitAddTeam;
  
  onAuthStateChanged(window.firebaseAuth, async (user) => {
    if (!user){
      authGate.classList.remove('hidden');
      dashboard.classList.add('hidden');
      return;
    }
    // fetch role
    const uid = user.uid;
    let role = 'Vendedor';
    try{
      const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const { doc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const ref = doc(collection(window.firebaseDb,'users'), uid);
      const snap = await getDoc(ref);
      if (snap.exists()) role = (snap.data().role)||'Vendedor';
    }catch(e){}

    // 
    if (!['admin','ceo','gerente','vendedor','design','designer','desgin','socio','sócio','afiliado','staff','Socio','Gerente','Designer','Staff','Vendedor','Ceo'].includes((role||''))){
      authGate.classList.remove('hidden');
      dashboard.classList.add('hidden');
      return;
    }
    const roleLower = (role||'').toLowerCase().trim();
    authGate.classList.add('hidden');
    // Aplicar permissões ANTES de exibir o dashboard — evita flash de conteúdo não autorizado
    window.visibilityApplied = false;
    controlSectionVisibility(roleLower);
    dashboard.classList.remove('hidden');
    
    const isManager = ['ceo','gerente'].includes(roleLower);
    const isCeo = roleLower==='ceo';
    const isSocio = roleLower==='socio' || roleLower==='ceo';
    const isAffiliate = roleLower==='afiliado';
    const isStaff = roleLower==='staff';
    const canViewAll = ['ceo','gerente','socio'].includes(roleLower);
    window.adminRoleLower = roleLower;
    // Garantir que a sessão conheça o papel atual (corrige bloqueio de CEO)
    try {
      const sess = JSON.parse(sessionStorage.getItem('adminSession')||'{}');
      sessionStorage.setItem('adminSession', JSON.stringify({
        ...sess,
        role: roleLower,
        uid: sess.uid || user.uid,
        email: sess.email || user.email,
        timestamp: Date.now()
      }));
    } catch(_) {}
    // Atualiza badge de papel na UI
    try{
      const badge = document.getElementById('roleBadge');
      if (badge){
        badge.textContent = `Permissões: ${roleLower.toUpperCase()}`;
      }
    }catch(_){ }
    
    // Carregar usuários de permissões depois de definir o cargo
    if (window.loadPermissionsUsers) {
      window.loadPermissionsUsers();
    }
    
    // Carregar dados das novas seções
    if (window.loadTokensUsers) {
      window.loadTokensUsers();
    }
    
    if (window.loadAdminHistory) {
      window.loadAdminHistory();
    }
    
    // Carregar dados de cupons
    if (window.loadCoupons) {
      window.loadCoupons();
    }
    
    if (window.loadCouponUsage) {
      window.loadCouponUsage();
    }
    
    if (window.loadAffiliates) {
      window.loadAffiliates();
    }
    
    // Se for afiliado, carregar dados do painel de afiliado
    if (isAffiliate) {
      await loadAffiliatePanelData(user.uid);
    }
    
    // Se for staff, configurar interface restrita
    if (isStaff) {
      // Forçar evento para xtreino-tokens e desabilitar seleção
      const typeEl = document.getElementById('boardEventType');
      if (typeEl) {
        typeEl.value = 'xtreino-tokens';
        typeEl.disabled = true;
        typeEl.style.opacity = '0.6';
        typeEl.style.cursor = 'not-allowed';
      }
      
      // Ocultar botão "Destravar tudo do dia"
      const btnClearLocks = document.getElementById('btnClearLocks');
      if (btnClearLocks) {
        btnClearLocks.style.display = 'none';
      }
      
      // Carregar board automaticamente com evento correto
      setTimeout(() => {
        if (window.loadBoard) {
          loadBoard();
        }
      }, 500);
    }
    
  // Carregar pedidos de camisa (envios)
  if (window.loadShirtOrders) {
    window.loadShirtOrders();
  }
    // Controla visibilidade conforme o papel - REMOVIDO para evitar conflito com controlSectionVisibility
    // A visibilidade agora é controlada exclusivamente pela função controlSectionVisibility

    try {
      // Carregamento de dados conforme papel
      if (canViewAll) {
        // CEO/Gerente/Sócio: pode carregar datasets completos
        await carregarUsuarios();
        await loadTokensData();
        await carregarPedidosConfirmados();
      }
    } catch(e){
      console.error('❌ Erro ao carregar dados:', e);
    }
    // bind filtros e export
    const btnApply = document.getElementById('btnApplyFilter');
    if (btnApply) btnApply.onclick = applyFilter;
    const btnOrd = document.getElementById('btnExportOrdersCsv');
    if (btnOrd) btnOrd.onclick = exportOrdersCsv;
    const btnSch = document.getElementById('btnExportSchedulesCsv');
    if (btnSch) btnSch.onclick = exportSchedulesCsv;
    const btnLoadBoard = document.getElementById('btnLoadBoard');
    if (btnLoadBoard) btnLoadBoard.onclick = loadBoard;
    // Carrega eventos dinâmicos no dropdown do board ao iniciar e quando Firebase estiver pronto
    if (window.firebaseDb) {
      loadDynamicEventsIntoBoard();
    } else {
      const _waitFb = setInterval(() => {
        if (window.firebaseDb) { clearInterval(_waitFb); loadDynamicEventsIntoBoard(); }
      }, 300);
    }
    const formAddTeam = document.getElementById('formAddTeam');
    if (formAddTeam) formAddTeam.onsubmit = submitAddTeam;

    // ── Limpeza única de registrations de teste ──
    (async function cleanupTestRegistrations() {
      try {
        const _fbDb = window.firebaseDb || await new Promise(res => {
          const _t = setInterval(() => { if (window.firebaseDb) { clearInterval(_t); res(window.firebaseDb); } }, 300);
        });
        const { collection, query, where, getDocs, deleteDoc, doc } =
          await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const nomesAlvo = ['B12 E-SPORTS', 'TROPA DO FERA', 'B12 E-SPORTS B'];
        let deletados = 0;
        for (const nome of nomesAlvo) {
          // Query simples (campo único) — sem composite index
          const snap = await getDocs(query(collection(_fbDb, 'registrations'), where('teamName', '==', nome)));
          for (const d of snap.docs) {
            const r = d.data();
            if (r.addedManually !== true) continue; // filtro em JS
            await deleteDoc(doc(_fbDb, 'registrations', d.id));
            deletados++;
          }
        }
        if (deletados > 0) console.log(`🧹 Limpeza: ${deletados} registration(s) de teste removida(s).`);
      } catch (e) {
        console.warn('Limpeza de testes:', e?.message || e);
      }
    })();

    // Bind filtros do histórico de cupons - configurar após DOM estar pronto
    setupCouponUsageFilters();
    // Inicializa período como "hoje" (sincroniza com botão Hoje ativo por padrão)
    parsePeriodFromValue('today');
    // Carrega relatórios e pendências para todas as funções
    await loadReports().catch(()=>{});
    // Marcar 'principal' como inicializado para evitar que loadPageData
    // sobrescreva os dados com funções legadas (loadKPIs/loadCharts)
    window._adminPages = window._adminPages || { initialized: new Set() };
    window._adminPages.initialized.add('principal');
    if (canViewAll){
      await loadRecentSchedules().catch(()=>{});
      await loadPending(true).catch(()=>{});
    } else {
      await loadRecentOrders().catch(()=>{});
      await loadPending(false).catch(()=>{});
    }
    
    // APLICAR CONTROLE DE VISIBILIDADE APÓS CARREGAMENTO DE TODOS OS DADOS
    // Usar um delay maior e garantir que seja a última chamada
    setTimeout(() => {
      const finalRole = (roleLower || '').toLowerCase().trim();
      
      // Resetar flag para permitir reaplicação se necessário
      window.visibilityApplied = false;
      controlSectionVisibility(finalRole);
      try { renderTokensSectionPager(); } catch(_) {}
      // Garantir que a visibilidade não seja alterada depois
      window.lastAppliedRole = finalRole;
    }, 300); // Re-aplicar após DOM estabilizar (dados já foram carregados acima)
  });

  // ---- Relatórios ----
  let charts = {};
  let period = { from: null, to: null };
  // Tipo de filtro: 'all' | 'events' | 'products'
  let activeFilterType = 'all';

  // Bind filtros de período (pill buttons) e tipo
  try {
    // Period pill buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.period-btn').forEach(b => {
          b.classList.remove('bg-blue-600','text-white','shadow-sm','active-period');
          b.classList.add('bg-gray-100','text-gray-600');
        });
        btn.classList.add('bg-blue-600','text-white','shadow-sm','active-period');
        btn.classList.remove('bg-gray-100','text-gray-600');
        const p = btn.dataset.period;
        const customRange = document.getElementById('customDateRange');
        if (customRange) customRange.classList.toggle('hidden', p !== 'custom');
        if (p !== 'custom') { parsePeriodFromValue(p); await loadReports(); }
      });
    });
    // Apply button for custom range
    const btnApply = document.getElementById('btnApplyFilter');
    if (btnApply) btnApply.addEventListener('click', applyFilter);
    // Type filter buttons
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.type-btn').forEach(b => {
          b.classList.remove('bg-gray-800','text-white','shadow-sm','active-type');
          b.classList.add('bg-gray-100','text-gray-600');
        });
        btn.classList.add('bg-gray-800','text-white','shadow-sm','active-type');
        btn.classList.remove('bg-gray-100','text-gray-600');
        activeFilterType = btn.dataset.type || 'all';
        await loadReports();
      });
    });
  } catch(_){}

  // Mapa de IDs de evento → nome legível
  const EVENT_NAMES_MAP = {
    'xtreino-tokens': 'XTreino Freitas',
    'xtreino': 'XTreino Freitas',
    'modo-liga': 'XTreino Modo Liga',
    'semanal-freitas': 'Semanal Freitas',
    'semanal': 'Semanal Freitas',
    'camp-freitas': 'Campeonato Freitas',
    'camp': 'Campeonato Freitas'
  };

  function resolveEventName(eventType, fallback) {
    if (!eventType) return fallback || 'Evento';
    const key = String(eventType).toLowerCase().trim();
    return EVENT_NAMES_MAP[key] || fallback || eventType;
  }

  // Unifica pedidos: registrations (eventos) + orders de produtos (sem duplicar eventos)
  async function fetchUnifiedOrders() {
    const items = [];
    const seenExternalRefs = new Set();
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

      // 1. Eventos vêm de registrations (fonte primária para eventos)
      try {
        const regs = await getDocs(collection(window.firebaseDb, 'registrations'));
        regs.forEach(d => {
          const r = d.data();
          const ts = (r.createdAt?.toDate ? r.createdAt.toDate() : (r.timestamp ? new Date(r.timestamp) : new Date()));
          const extRef = r.external_reference || r.externalRef || null;
          if (extRef) seenExternalRefs.add(extRef);
          items.push({
            ts,
            amount: Number(r.price || 0),
            item: resolveEventName(r.eventType, r.title || 'Reserva'),
            customer: (r.email || '-'),
            status: (r.status || ''),
            paymentMethod: (r.paidWithTokens ? 'tokens' : 'mercado_pago'),
            source: 'registrations',
            docId: d.id,
            externalRef: extRef,
            schedule: r.schedule || null,
            teamName: r.teamName || null
          });
        });
      } catch (_) {}

      // 2. Produtos digitais, tokens e camisas vêm de orders (tipo não-evento)
      // Eventos que criam order também (via processSuccessfulPayment) são ignorados
      // pela deduplicação por external_reference
      try {
        const ords = await getDocs(collection(window.firebaseDb, 'orders'));
        ords.forEach(d => {
          const o = d.data();
          const type = (o.type || '').toLowerCase();
          // Pular orders de evento (já estão em registrations)
          if (type === 'event') return;
          // Pular orders com external_reference já visto em registrations
          const extRef = o.external_reference || o.externalRef || d.id;
          if (seenExternalRefs.has(extRef)) return;
          const ts = (o.createdAt?.toDate ? o.createdAt.toDate() : (o.timestamp ? new Date(o.timestamp) : new Date()));
          const rawItem = o.title || o.item || o.description || 'Produto';
          items.push({
            ts,
            amount: Number(o.amount || o.total || 0),
            item: rawItem,
            customer: (o.customer || o.buyerEmail || o.customerName || '-'),
            status: (o.status || ''),
            paymentMethod: (o.paidWithTokens ? 'tokens' : 'mercado_pago'),
            source: 'orders',
            docId: d.id,
            externalRef: extRef,
            productId: o.productId || null
          });
        });
      } catch (_) {}

    } catch (_) {}

    // Aplicar filtro de tipo
    if (typeof activeFilterType !== 'undefined') {
      if (activeFilterType === 'events')   return items.filter(i => i.source === 'registrations');
      if (activeFilterType === 'products') return items.filter(i => i.source === 'orders');
    }
    return items;
  }

  async function loadReports(){
    try{
      await loadKpis().catch(()=>{});
      // await loadTokensData().catch(()=>{}); // Desabilitado - usando novas funções de paginação
      await renderSalesChart().catch(()=>{});
      await renderTopProducts().catch(()=>{});
      await renderPaymentMethodsChart().catch(()=>{});
      await renderPopularHours().catch(()=>{});
      await renderActiveUsers().catch(()=>{});
    }catch(e){ console.error('Erro ao carregar relatórios', e); }
  }

  // ===== Paginação de salto entre seções (1 2 3 4 ›) no card de Tokens =====
  const TOKENS_JUMP_SECTIONS = [
    'sectionCoupons',
    'sectionCouponUsage',
    'sectionPasseBooyah',
    'sectionHighlights',
    'sectionNews',
    'sectionProducts',
    'sectionShirtOrders',
    'sectionSchedules',
    'sectionResetData'
  ];
  let tokensJumpPage = 0; // índice de página do paginador de seções
  const tokensJumpPerPage = 5;

  function scrollToSectionId(id){
    try{
      const el = document.getElementById(id);
      if (!el) return;
      // Nunca reexibir seções ocultas por controle de cargo
      // (apenas rolar se já estiver visível)
      if (el.style && el.style.display === 'none') return;
      el.scrollIntoView({ behavior:'smooth', block:'start' });
    }catch(_){ }
  }

  function renderTokensSectionPager(pageIndex){
    const container = document.getElementById('tokensJumpPagination');
    if (!container) return;
    if (typeof pageIndex === 'number') tokensJumpPage = pageIndex;
    container.innerHTML = '';

    const start = tokensJumpPage * tokensJumpPerPage;
    const end = Math.min(start + tokensJumpPerPage, TOKENS_JUMP_SECTIONS.length);
    const totalPages = Math.ceil(TOKENS_JUMP_SECTIONS.length / tokensJumpPerPage) || 1;

    // Botões numéricos 1..N do grupo atual
    for (let i = start; i < end; i++) {
      const btn = document.createElement('button');
      btn.textContent = String((i - start) + 1);
      btn.className = `px-2 py-1 text-xs rounded cursor-pointer ${i===start? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
      btn.addEventListener('click', () => scrollToSectionId(TOKENS_JUMP_SECTIONS[i]));
      container.appendChild(btn);
    }

    // Botão próximo ›
    if (tokensJumpPage < totalPages - 1) {
      const next = document.createElement('button');
      next.textContent = '›';
      next.className = 'px-2 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300';
      next.addEventListener('click', () => renderTokensSectionPager(tokensJumpPage + 1));
      container.appendChild(next);
    }
  }

  // Funções para gerenciar tokens
  // Feed global de tokens reutilizado pelo modal (evita re-fetch ao trocar filtro)
  let _tokensFullFeed = null;

  async function loadTokensData() {
    try {
      const { collection: col, getDocs: gd } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const feed = []; // { tipo: 'purchase'|'manual'|'usage', ts, qty, user, desc }

      // 1) Tokens comprados (orders com "token" no item/description, status paid)
      let totalComprados = 0;
      try {
        const ordSnap = await gd(col(window.firebaseDb, 'orders'));
        ordSnap.forEach(d => {
          const o = d.data();
          const txt = (o.description || o.item || '').toLowerCase();
          if (!txt.includes('token') && !txt.includes('xtreino')) return;
          const status = (o.status || '').toLowerCase();
          const isPaid = status === 'paid' || status === 'approved' || status === 'confirmed';
          if (!isPaid) return;
          const m = (o.description || o.item || '').match(/(\d+)\s*token/i);
          const qty = m ? parseInt(m[1]) : 1;
          totalComprados += qty;
          const ts = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.timestamp || 0);
          feed.push({ tipo: 'purchase', ts, qty, user: o.customer || o.buyerEmail || o.customerEmail || '-', desc: o.item || o.description || 'Tokens' });
        });
      } catch(_) {}

      // 2) Tokens adicionados manualmente pelo admin (adminHistory action=add_tokens)
      let totalManual = 0;
      try {
        const histSnap = await gd(col(window.firebaseDb, 'adminHistory'));
        histSnap.forEach(d => {
          const h = d.data();
          if ((h.action || '') !== 'add_tokens') return;
          const m = String(h.details || '').match(/Adicionou\s+(\d+)\s+tokens?\s+para\s+(.+)/i);
          if (!m) return;
          const qty = parseInt(m[1]);
          const user = m[2] || '-';
          totalManual += qty;
          const ts = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.createdAt || h.ts || 0);
          feed.push({ tipo: 'manual', ts, qty, user, desc: `Adição manual por ${h.adminName || 'admin'}` });
        });
      } catch(_) {}

      // 3) Tokens usados em eventos (registrations com paidWithTokens=true)
      let totalUsados = 0;
      try {
        const regSnap = await gd(col(window.firebaseDb, 'registrations'));
        regSnap.forEach(d => {
          const r = d.data();
          if (!r.paidWithTokens) return;
          const evt = (r.eventType || '').toLowerCase();
          let qty = 1;
          if (evt.includes('modo-liga') || evt.includes('modo liga')) qty = 3;
          else if (evt.includes('semanal')) qty = 3;
          else if (evt.includes('camp')) qty = 5;
          totalUsados += qty;
          const ts = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.timestamp || 0);
          feed.push({ tipo: 'usage', ts, qty: -qty, user: r.email || '-', desc: resolveEventName(r.eventType, r.title || 'Evento') });
        });
      } catch(_) {}

      // Ordenar feed por data desc
      feed.sort((a, b) => b.ts - a.ts);
      _tokensFullFeed = { feed, totalComprados, totalManual, totalUsados };

      // Atualizar cards do painel
      const saldo = totalComprados + totalManual - totalUsados;
      const el = id => document.getElementById(id);
      if (el('statsTokensPurchased')) el('statsTokensPurchased').textContent = totalComprados;
      if (el('statsTokensManual'))    el('statsTokensManual').textContent    = totalManual;
      if (el('statsTokensUsed'))      el('statsTokensUsed').textContent      = totalUsados;
      if (el('statsTokensBalance'))   el('statsTokensBalance').textContent   = `${saldo} tokens`;

      // Atividade recente no card (últimas 6 entradas)
      const actEl = el('tokensRecentActivity');
      if (actEl) {
        const recent = feed.slice(0, 6);
        if (recent.length === 0) {
          actEl.innerHTML = '<div class="text-gray-400 text-center py-3 italic">Sem atividade registrada.</div>';
        } else {
          actEl.innerHTML = recent.map(e => {
            const icoMap = { purchase: '🛒', manual: '✋', usage: '⚡' };
            const clrMap = { purchase: 'text-green-700', manual: 'text-blue-600', usage: 'text-orange-600' };
            const sign   = e.tipo === 'usage' ? '' : '+';
            const qty    = e.tipo === 'usage' ? Math.abs(e.qty) : e.qty;
            return `
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span>${icoMap[e.tipo]}</span>
                  <span class="truncate text-gray-600">${e.user}</span>
                </div>
                <span class="font-bold shrink-0 ${clrMap[e.tipo]}">${sign}${qty}t</span>
              </div>`;
          }).join('');
        }
      }

    } catch(err) {
      console.error('Erro ao carregar tokens:', err);
    }
  }

  // Abre o modal de histórico completo de tokens
  async function openTokensModal() {
    const modal   = document.getElementById('tokensFullModal');
    const listEl  = document.getElementById('tokensFullList');
    if (!modal || !window.firebaseDb) return;

    modal.classList.remove('hidden');
    if (listEl) listEl.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-xl mb-2 block"></i>Carregando...</div>';

    // Sempre refaz o fetch ao abrir (dados frescos)
    _tokensFullFeed = null;
    await loadTokensData();

    if (!_tokensFullFeed) {
      if (listEl) listEl.innerHTML = '<div class="text-center py-8 text-red-400">Erro ao carregar dados.</div>';
      return;
    }

    const { totalComprados, totalManual, totalUsados } = _tokensFullFeed;
    const saldo = totalComprados + totalManual - totalUsados;
    const el = id => document.getElementById(id);
    if (el('modalTokensPurchased')) el('modalTokensPurchased').textContent = totalComprados;
    if (el('modalTokensManual'))    el('modalTokensManual').textContent    = totalManual;
    if (el('modalTokensUsed'))      el('modalTokensUsed').textContent      = totalUsados;
    if (el('modalTokensBalance'))   el('modalTokensBalance').textContent   = saldo;

    filterTokensFeed('all');
  }
  window.openTokensModal = openTokensModal;

  // Filtra e renderiza o feed no modal
  function filterTokensFeed(filter) {
    const listEl = document.getElementById('tokensFullList');
    if (!listEl || !_tokensFullFeed) return;

    // Atualizar tabs
    document.querySelectorAll('.tokens-tab').forEach(btn => {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle('text-blue-600',  active);
      btn.classList.toggle('border-blue-500', active);
      btn.classList.toggle('border-b-2',      active);
      btn.classList.toggle('text-gray-500',  !active);
      btn.classList.toggle('border-transparent', !active);
    });

    const { feed } = _tokensFullFeed;
    const items = filter === 'all' ? feed : feed.filter(e => e.tipo === filter);

    if (items.length === 0) {
      listEl.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fas fa-inbox text-3xl mb-3 block opacity-40"></i>Sem registros para este filtro.</div>';
      return;
    }

    const tipoConfig = {
      purchase: { icon: '🛒', label: 'Compra',  bg: 'bg-green-100',  txt: 'text-green-700',  sign: '+' },
      manual:   { icon: '✋', label: 'Manual',  bg: 'bg-blue-100',   txt: 'text-blue-700',   sign: '+' },
      usage:    { icon: '⚡', label: 'Uso',     bg: 'bg-orange-100', txt: 'text-orange-700', sign: '-' },
    };

    listEl.innerHTML = items.map(e => {
      const c   = tipoConfig[e.tipo];
      const qty = Math.abs(e.qty);
      const dt  = e.ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      return `
        <div class="flex items-center gap-3 py-2.5 px-3 rounded-xl ${c.bg} bg-opacity-50 hover:bg-opacity-80 transition-colors">
          <div class="w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center text-lg shrink-0">${c.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-800 text-xs truncate">${e.user}</div>
            <div class="text-xs text-gray-500 truncate">${e.desc}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-bold ${c.txt}">${c.sign}${qty}t</div>
            <div class="text-xs text-gray-400">${dt}</div>
          </div>
        </div>`;
    }).join('');
  }
  window.filterTokensFeed = filterTokensFeed;

  function extractTokenQuantity(item) {
    const match = item.match(/(\d+)\s*Token/i);
    return match ? parseInt(match[1]) : 1;
  }

  function getTokenCountForEvent(eventType) {
    // Todos os eventos usam 1 token
    return 1;
  }

  function brl(n){ try {return n.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})} catch(_) {return `R$ ${Number(n||0).toFixed(2)}`;} }

  async function loadKpis(){
    // KPIs financeiros só para CEO e sócio
    const _roleLower = (window.adminRoleLower || '').toLowerCase().trim();
    if (!['ceo','socio'].includes(_roleLower)) return;

    const kpiTodayEl  = document.getElementById('kpiToday');
    const kpiMonthEl  = document.getElementById('kpiMonth');
    const kpiRecEl    = document.getElementById('kpiReceivable');
    const kpiActiveEl = document.getElementById('kpiActiveUsers');
    if (!kpiTodayEl || !kpiMonthEl || !kpiRecEl) return;

    const { collection, query, where, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const today = new Date(); today.setHours(0,0,0,0);
    const firstMonth = new Date(); firstMonth.setDate(1); firstMonth.setHours(0,0,0,0);

    let sumToday = 0, sumMonth = 0, receivable = 0;

    // ── Orders (produtos, camisas — não eventos, não tokens usados) ──
    try {
      const ordersCol = collection(window.firebaseDb, 'orders');
      const [todayOrd, monthOrd] = await Promise.all([
        getDocsFromServer(query(ordersCol, where('createdAt', '>=', today))),
        getDocsFromServer(query(ordersCol, where('createdAt', '>=', firstMonth)))
      ]);
      todayOrd.forEach(d => {
        const o = d.data();
        if ((o.type || '').toLowerCase() === 'event') return;
        if (o.paidWithTokens) return;
        const status = (o.status || '').toLowerCase();
        const isPaid = status === 'paid' || status === 'approved' || status === 'confirmed';
        if (isPaid) sumToday += Number(o.amount || 0);
      });
      monthOrd.forEach(d => {
        const o = d.data();
        if ((o.type || '').toLowerCase() === 'event') return;
        if (o.paidWithTokens) return;
        const val = Number(o.amount || 0);
        const status = (o.status || '').toLowerCase();
        if (status === 'paid' || status === 'approved' || status === 'confirmed') sumMonth += val;
        if (status === 'pending') receivable += val;
      });
    } catch(_){}

    // ── Registrations (apenas MP/PIX — excluir paidWithTokens) ──
    try {
      const regsCol = collection(window.firebaseDb, 'registrations');
      const [todayRegs, monthRegs] = await Promise.all([
        getDocsFromServer(query(regsCol, where('createdAt', '>=', today))),
        getDocsFromServer(query(regsCol, where('createdAt', '>=', firstMonth)))
      ]);
      todayRegs.forEach(d => {
        const r = d.data();
        if (r.paidWithTokens) return;
        const status = (r.status || '').toLowerCase();
        const isPaid = status === 'paid' || status === 'approved' || status === 'confirmed';
        if (isPaid) sumToday += Number(r.price || 0);
      });
      monthRegs.forEach(d => {
        const r = d.data();
        if (r.paidWithTokens) return;
        const val = Number(r.price || 0);
        const status = (r.status || '').toLowerCase();
        if (status === 'paid' || status === 'approved' || status === 'confirmed') sumMonth += val;
        if (status === 'pending') receivable += val;
      });
    } catch(_){}

    kpiTodayEl.textContent = brl(sumToday);
    kpiMonthEl.textContent = brl(sumMonth);
    kpiRecEl.textContent = brl(receivable);

    if (kpiActiveEl){
      const roleLower = (window.adminRoleLower||'').toLowerCase();
      if (roleLower==='ceo' || roleLower==='gerente' || roleLower==='socio'){
        try{
          const usersSnap = await getDocs(collection(window.firebaseDb,'users'));
          const weekAgo = Date.now() - 7*24*60*60*1000;
          let active = 0; usersSnap.forEach(d=>{ const u=d.data(); if (Number(u.lastLogin||0) >= weekAgo) active++; });
          kpiActiveEl.textContent = String(active);
        }catch(_){ kpiActiveEl.textContent = '—'; }
      } else {
        kpiActiveEl.textContent = '—';
      }
    }
  }

  async function openMonthSalesModal() {
    const modal   = document.getElementById('monthSalesModal');
    const listEl  = document.getElementById('monthSalesList');
    const totalEl = document.getElementById('monthSalesTotal');
    const titleEl = document.getElementById('monthSalesTitle');
    if (!modal || !window.firebaseDb) return;

    modal.classList.remove('hidden');
    if (listEl) listEl.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-xl mb-2 block"></i>Carregando...</div>';

    try {
      const now = new Date();
      const mesNome = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (titleEl) titleEl.textContent = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);

      const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

      const byDay = {}; // "DD/MM" → total

      // Registrations (eventos pagos no mês)
      try {
        const regsSnap = await getDocs(query(collection(window.firebaseDb, 'registrations'), where('createdAt', '>=', firstMonth)));
        regsSnap.forEach(d => {
          const r = d.data();
          const status = (r.status || '').toLowerCase();
          if (status !== 'paid' && status !== 'approved' && status !== 'confirmed') return;
          const ts = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.timestamp || 0);
          const dia = ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          byDay[dia] = (byDay[dia] || 0) + Number(r.price || 0);
        });
      } catch(_) {}

      // Orders (produtos, tokens — sem duplicar eventos)
      try {
        const ordSnap = await getDocs(collection(window.firebaseDb, 'orders'));
        ordSnap.forEach(d => {
          const o = d.data();
          if ((o.type || '').toLowerCase() === 'event') return;
          const status = (o.status || '').toLowerCase();
          if (status !== 'paid' && status !== 'approved' && status !== 'confirmed') return;
          const ts = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.timestamp || 0);
          if (ts < firstMonth) return;
          const dia = ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          byDay[dia] = (byDay[dia] || 0) + Number(o.amount || o.total || 0);
        });
      } catch(_) {}

      // Ordenar por data decrescente
      const entradas = Object.entries(byDay).sort((a, b) => {
        const [dA, mA] = a[0].split('/').map(Number);
        const [dB, mB] = b[0].split('/').map(Number);
        if (mA !== mB) return mB - mA;
        return dB - dA;
      });

      const total = entradas.reduce((s, [, v]) => s + v, 0);
      if (totalEl) totalEl.textContent = brl(total);

      if (entradas.length === 0) {
        if (listEl) listEl.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fas fa-inbox text-3xl mb-3 block opacity-40"></i>Nenhuma venda confirmada este mês.</div>';
        return;
      }

      if (listEl) listEl.innerHTML = entradas.map(([dia, val]) => `
        <div class="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fas fa-calendar-day text-blue-500 text-sm"></i>
            </div>
            <span class="font-semibold text-gray-700 text-sm">${dia}</span>
          </div>
          <span class="font-bold text-blue-800">${brl(val)}</span>
        </div>
      `).join('');

    } catch(err) {
      if (listEl) listEl.innerHTML = `<div class="text-center py-8 text-red-400">Erro ao carregar: ${err.message || err}</div>`;
    }
  }
  window.openMonthSalesModal = openMonthSalesModal;

  async function renderSalesChart(){
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const all = await fetchUnifiedOrders();
    const today = new Date(); today.setHours(0,0,0,0);
    const start = period.from ? new Date(period.from) : new Date(today.getTime() - 29*24*60*60*1000);
    const end = period.to ? new Date(period.to) : today;
    const days = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur <= endDay){ days.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
    const labels = days.map(d=>d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

    const mpRevMap = Object.fromEntries(labels.map(l=>[l,0]));
    const tkRevMap = Object.fromEntries(labels.map(l=>[l,0]));
    const seenRefs = new Set();

    all.forEach(o => {
      const ts = o.ts;
      if (period.from && ts < period.from) return;
      if (period.to && ts > period.to) return;
      const status = (o.status||'').toLowerCase();
      if (status !== 'paid' && status !== 'confirmed' && status !== 'approved') return;
      const ref = o.externalRef || o.docId || 'no-ref';
      if (seenRefs.has(ref)) return;
      seenRefs.add(ref);
      const label = ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (o.paymentMethod === 'tokens') {
        if (tkRevMap[label] !== undefined) tkRevMap[label] += Number(o.amount || 0);
      } else {
        if (mpRevMap[label] !== undefined) mpRevMap[label] += Number(o.amount || 0);
      }
    });

    const mpData = labels.map(l=>mpRevMap[l]);
    const tkData = labels.map(l=>tkRevMap[l]);

    try { if (charts.sales) { charts.sales.destroy(); } } catch(_){}
    try { const ex = typeof Chart !== 'undefined' && Chart.getChart && Chart.getChart(canvas); if (ex) ex.destroy(); } catch(_){}

    const ctx = canvas.getContext('2d');
    const gradBlue = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 280);
    gradBlue.addColorStop(0, 'rgba(59,130,246,0.35)');
    gradBlue.addColorStop(1, 'rgba(59,130,246,0.02)');
    const gradOrange = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 280);
    gradOrange.addColorStop(0, 'rgba(251,146,60,0.35)');
    gradOrange.addColorStop(1, 'rgba(251,146,60,0.02)');

    charts.sales = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'MP / PIX (R$)',
            data: mpData,
            borderColor: '#3b82f6',
            backgroundColor: gradBlue,
            borderWidth: 2.5,
            tension: 0.45,
            fill: true,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: 'Tokens (R$)',
            data: tkData,
            borderColor: '#fb923c',
            backgroundColor: gradOrange,
            borderWidth: 2.5,
            tension: 0.45,
            fill: true,
            pointBackgroundColor: '#fb923c',
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: R$ ${ctx.parsed.y.toFixed(2).replace('.',',')}`,
              footer: items => {
                const total = items.reduce((s,i)=>s+i.parsed.y,0);
                return total > 0 ? `Total: R$ ${total.toFixed(2).replace('.',',')}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45, minRotation: 45 }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.15)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0))
            },
            border: { display: false }
          }
        }
      }
    });

    try {
      const title = document.getElementById('salesChartTitle');
      const fmt = d => d.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'});
      if (title) title.textContent = `📈 Vendas — ${fmt(start)} a ${fmt(end)}`;
    } catch(_){}
  }

  // Função para normalizar nomes de produtos
  function normalizeProductName(name) {
    if (!name || name === 'undefined' || name === 'Item' || name === 'Pedido') {
      return 'Produto Diverso';
    }
    
    const normalized = String(name).trim();
    const lc = normalized.toLowerCase();

    // Verificar primeiro se é um ID de evento conhecido
    const fromEventMap = EVENT_NAMES_MAP[lc];
    if (fromEventMap) return fromEventMap;
    
    // Normalizar tokens
    if (lc.includes('token')) {
      const match = normalized.match(/(\d+)\s*token/i);
      if (match) {
        return `${match[1]} Token${Number(match[1]) > 1 ? 's' : ''} XTreino`;
      }
      if (lc.includes('undefined')) {
        return 'Token XTreino';
      }
      return normalized.replace(/undefined/gi, '').trim() || 'Token XTreino';
    }
    
    // Normalizar eventos/treinos
    if (lc.includes('modo liga') || lc.includes('modo-liga')) {
      return 'XTreino Modo Liga';
    }
    if (lc.includes('semanal')) {
      return 'Semanal Freitas';
    }
    if (lc.includes('camp') || lc.includes('campeonato')) {
      return 'Campeonato Freitas';
    }
    if (lc.includes('xtreino')) {
      return 'XTreino Freitas';
    }
    if (lc.includes('reserva') || lc.includes('treino')) {
      return 'Reserva de Evento';
    }
    
    // Normalizar sensibilidades
    if (lc.includes('sensibilidade')) {
      return 'Sensibilidade Free Fire';
    }
    
    // Normalizar imagens aéreas
    if (lc.includes('imag') && (lc.includes('aér') || lc.includes('aer') || lc.includes('mapa'))) {
      return 'Imagens Aéreas';
    }

    // Limpar "undefined" de qualquer nome
    return normalized.replace(/undefined/gi, '').trim() || 'Produto Diverso';
  }

  async function renderTopProducts(){
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;
    const all = await fetchUnifiedOrders();
    
    // Agrupar por external_reference primeiro (transações únicas)
    const transactionsByRef = new Map();
    
    all.forEach(o => {
      if ((o.status||'').toLowerCase() !== 'paid' && (o.status||'').toLowerCase() !== 'confirmed') return;
      
      const externalRef = o.externalRef || o.docId || 'no-ref';
      const rawName = o.item || 'Produto Diverso';
      const normalizedName = normalizeProductName(rawName);
      const amount = Number(o.amount || 0);
      
      if (transactionsByRef.has(externalRef)) {
        const existing = transactionsByRef.get(externalRef);
        existing.amount += amount;
        // Se o produto normalizado for diferente, manter o primeiro ou combinar
        if (!existing.products.includes(normalizedName)) {
          existing.products.push(normalizedName);
        }
      } else {
        transactionsByRef.set(externalRef, {
          amount: amount,
          products: [normalizedName]
        });
      }
    });
    
    // Agregar por produto a partir das transações únicas
    const revenueMap = {}; // Faturamento por produto
    const quantityMap = {}; // Quantidade de transações por produto
    
    transactionsByRef.forEach(transaction => {
      // Se uma transação tem múltiplos produtos, distribuir o valor igualmente
      const amountPerProduct = transaction.amount / transaction.products.length;
      transaction.products.forEach(productName => {
        revenueMap[productName] = (revenueMap[productName] || 0) + amountPerProduct;
        quantityMap[productName] = (quantityMap[productName] || 0) + 1;
      });
    });
    
    // Ordenar por faturamento e pegar top 5
    const entries = Object.entries(revenueMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, revenue]) => ({
        name,
        revenue,
        quantity: quantityMap[name] || 0
      }));
    
    try { if (charts.top) { charts.top.destroy(); } } catch(_){}

    const BAR_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444'];
    charts.top = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: entries.map(e => e.name.length > 18 ? e.name.slice(0,16)+'…' : e.name),
        datasets: [{
          label: 'Faturamento (R$)',
          data: entries.map(e => e.revenue),
          backgroundColor: entries.map((_, i) => BAR_COLORS[i % BAR_COLORS.length] + 'cc'),
          borderColor: entries.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: ctx => {
                const e = entries[ctx.dataIndex];
                return [`R$ ${e.revenue.toFixed(2).replace('.',',')}`, `${e.quantity} venda${e.quantity!==1?'s':''}`];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.15)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: v => 'R$' + (v>=1000?(v/1000).toFixed(1)+'k':v.toFixed(0))
            },
            border: { display: false }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#374151', font: { size: 11, weight: '600' } }
          }
        }
      }
    });
  }

  // Renderizar gráfico de formas de pagamento
  async function renderPaymentMethodsChart(){
    const canvas = document.getElementById('paymentMethodsChart');
    if (!canvas) return;
    const all = await fetchUnifiedOrders();

    const paymentMap = {
      mercado_pago: { count: 0, revenue: 0, label: 'MP / PIX' },
      tokens:       { count: 0, revenue: 0, label: 'Tokens' }
    };
    const seenRefs = new Set();
    all.forEach(o => {
      const status = (o.status||'').toLowerCase();
      if (status !== 'paid' && status !== 'confirmed' && status !== 'approved') return;
      if (period.from && o.ts < period.from) return;
      if (period.to && o.ts > period.to) return;
      const ref = o.externalRef || o.docId || 'no-ref';
      if (seenRefs.has(ref)) return;
      seenRefs.add(ref);
      const key = o.paymentMethod === 'tokens' ? 'tokens' : 'mercado_pago';
      paymentMap[key].count++;
      paymentMap[key].revenue += Number(o.amount || 0);
    });

    const entries = Object.values(paymentMap);
    const labels   = entries.map(p => p.label);
    const countData   = entries.map(p => p.count);
    const revenueData = entries.map(p => p.revenue);
    const total = countData.reduce((s,v)=>s+v,0);

    try { if (charts.payment) { charts.payment.destroy(); } } catch(_){}

    const centerPlugin = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { left, top, right, bottom } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px Inter,sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(String(total), cx, cy - 10);
        ctx.font = '11px Inter,sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('transações', cx, cy + 12);
        ctx.restore();
      }
    };

    charts.payment = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      plugins: [centerPlugin],
      data: {
        labels,
        datasets: [{
          data: countData,
          backgroundColor: ['#3b82f6', '#fb923c'],
          borderColor: ['#2563eb', '#ea580c'],
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { animateRotate: true, duration: 700, easing: 'easeInOutQuart' },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: { size: 12, weight: '600' },
              padding: 18,
              usePointStyle: true,
              pointStyleWidth: 10,
              generateLabels: chart => {
                return labels.map((lbl, i) => ({
                  text: `${lbl} — ${countData[i]} (R$ ${revenueData[i].toFixed(2).replace('.',',')})`,
                  fillStyle: ['#3b82f6','#fb923c'][i],
                  strokeStyle: ['#2563eb','#ea580c'][i],
                  lineWidth: 2,
                  pointStyle: 'circle',
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: ctx => {
                const i = ctx.dataIndex;
                const pct = total > 0 ? ((countData[i]/total)*100).toFixed(1) : '0.0';
                return [`${countData[i]} transações (${pct}%)`, `R$ ${revenueData[i].toFixed(2).replace('.',',')}`];
              }
            }
          }
        }
      }
    });
  }

  // Atualiza todos os componentes do dashboard
  async function refreshDashboard(){
    try { await loadKpis(); } catch(_){ }
    try { await renderSalesChart(); } catch(_){ }
    try { await renderTopProducts(); } catch(_){ }
    try { await renderPaymentMethodsChart(); } catch(_){ }
    try { await loadTokensData(); } catch(_){ }
  }

  async function loadRecentOrders(){
    const tbody = document.getElementById('ordersTbody');
    const count = document.getElementById('ordersCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    const items = [];
    
    // Orders - apenas pedidos com dados completos
    try {
    const snap = await getDocs(collection(window.firebaseDb,'orders'));
      snap.forEach(d=>{ 
        const o = d.data(); 
        const ts = new Date(o.createdAt||o.timestamp||0); 
        if (period.from && ts < period.from) return; 
        if (period.to && ts > period.to) return; 
        
        // Só adiciona se tiver dados essenciais
        const client = o.customer || o.buyerEmail || '';
        const item = o.item || o.productName || '';
        const value = Number(o.amount || o.total || 0);
        const status = o.status || '—';
        
        if (client && item && value > 0) {
          items.push({ 
            ts, 
            client, 
            item, 
            value, 
            status,
            id: d.id 
          }); 
        }
      });
    } catch(e) { console.error('Erro ao carregar orders:', e); }
    
    // Registrations pagas - apenas com dados completos
    try{
      const regsSnap = await getDocs(collection(window.firebaseDb,'registrations'));
      regsSnap.forEach(d=>{ 
        const r = d.data(); 
        const status = (r.status || '').toLowerCase(); 
        if (status !== 'paid') return; 
        
        const ts = (r.createdAt?.toDate ? r.createdAt.toDate() : (r.timestamp ? new Date(r.timestamp) : new Date())); 
        if (period.from && ts < period.from) return; 
        if (period.to && ts > period.to) return; 
        
        // Só adiciona se tiver dados essenciais
        const client = r.email || '';
        const item = r.title || r.eventType || '';
        const value = Number(r.price || 0);
        
        if (client && item && value > 0) {
          items.push({ 
            ts, 
            client, 
            item, 
            value, 
            status: 'paid',
            id: d.id 
          }); 
        }
      });
    } catch(e) { console.error('Erro ao carregar registrations:', e); }
    
    // ordenar por data desc e renderizar
    items.sort((a,b)=> b.ts - a.ts);
    
    // Limitar a 20 pedidos mais recentes
    const recentItems = items.slice(0, 20);
    
    recentItems.forEach((row, index) => { 
      const tr = document.createElement('tr'); 
      tr.innerHTML = `
        <td class="py-2 font-mono text-xs">${row.id ? row.id.substring(0, 6) : index + 1}</td>
        <td class="py-2">${row.client}</td>
        <td class="py-2">${row.item}</td>
        <td class="py-2 font-semibold">${brl(row.value)}</td>
        <td class="py-2">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${row.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
            ${row.status}
          </span>
        </td>
      `; 
      tbody.appendChild(tr); 
    });
    
    if (count) count.textContent = `${recentItems.length} pedidos`;
  }
  // Pendências (orders.status === 'pending' OU registrations.status === 'pending')
  async function loadPending(isManager){
    const tbody = document.getElementById('pendingTbody');
    const countEl = document.getElementById('pendingCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;
    try{
      const clauses = [ where('status','==','pending') ];
      if (!isManager && window.firebaseAuth?.currentUser?.uid){
        clauses.push(where('ownerId','==', window.firebaseAuth.currentUser.uid));
      }
      const ordSnap = await getDocs(query(collection(window.firebaseDb,'orders'), ...clauses));
      ordSnap.forEach(d=>{
        const o = d.data();
        const tr = document.createElement('tr');
        const created = new Date(o.createdAt||o.timestamp||Date.now()).toLocaleString('pt-BR');
        tr.innerHTML = `
          <td class="py-2">${o.customer||o.buyerEmail||'-'}</td>
          <td class="py-2">${o.item||o.productName||'-'}</td>
          <td class="py-2">${brl(Number(o.amount||o.total||0))}</td>
          <td class="py-2">${created}</td>
          <td class="py-2 space-x-2">
            <button class="px-2 py-1 bg-green-600 text-white rounded text-xs" data-approve="${d.id}">Aprovar</button>
            <button class="px-2 py-1 bg-red-600 text-white rounded text-xs" data-remove="${d.id}">Remover</button>
          </td>`;
        tbody.appendChild(tr); total++;
      });
    }catch(_){}
    try{
      const regClauses = [ where('status','==','pending') ];
      if (!isManager && window.firebaseAuth?.currentUser?.uid){
        regClauses.push(where('userId','==', window.firebaseAuth.currentUser.uid));
      }
      const regSnap = await getDocs(query(collection(window.firebaseDb,'registrations'), ...regClauses));
      regSnap.forEach(d=>{
        const r = d.data();
        const tr = document.createElement('tr');
        const created = new Date(r.createdAt?.toDate ? r.createdAt.toDate() : (r.timestamp||Date.now())).toLocaleString('pt-BR');
        tr.innerHTML = `
          <td class="py-2">${r.email||'-'}</td>
          <td class="py-2">${r.title||r.eventType||'-'}</td>
          <td class="py-2">${brl(Number(r.price||0))}</td>
          <td class="py-2">${created}</td>
          <td class="py-2 space-x-2">
            <button class="px-2 py-1 bg-green-600 text-white rounded text-xs" data-approve-reg="${d.id}">Aprovar</button>
            <button class="px-2 py-1 bg-red-600 text-white rounded text-xs" data-remove-reg="${d.id}">Remover</button>
          </td>`;
        tbody.appendChild(tr); total++;
      });
    }catch(_){ }
    if (countEl) countEl.textContent = `${total} pendentes`;
    tbody.addEventListener('click', async (e)=>{
      const approve = e.target.closest('[data-approve]');
      const approveReg = e.target.closest('[data-approve-reg]');
      const remove = e.target.closest('[data-remove]');
      const removeReg = e.target.closest('[data-remove-reg]');
      try{
        if (approve){
          const id = approve.getAttribute('data-approve');
          const { doc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
          await setDoc(doc(collection(window.firebaseDb,'orders'), id), { status:'paid', updatedAt: Date.now() }, { merge:true });
          approve.closest('tr')?.remove();
          // atualizar métricas e recentes
          await refreshDashboard();
        } else if (approveReg){
          const id = approveReg.getAttribute('data-approve-reg');
          const { doc, setDoc, collection, getDoc, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
          // marca registro como pago
          await setDoc(doc(collection(window.firebaseDb,'registrations'), id), { status:'paid', paidAt: Date.now() }, { merge:true });
          // cria um pedido em 'orders' para alimentar métricas e lista
          try{
            const snap = await getDoc(doc(collection(window.firebaseDb,'registrations'), id));
            if (snap.exists()){
              const r = snap.data();
              await addDoc(collection(window.firebaseDb,'orders'), {
                itemName: r.title || r.eventType || 'Reserva',
                amount: Number(r.price||0),
                customerName: r.email || '-',
                ownerId: r.userId || null,
                status: 'paid',
                createdAt: serverTimestamp()
              });
            }
          }catch(_){ }
          approveReg.closest('tr')?.remove();
          await refreshDashboard();
        } else if (remove){
          const id = remove.getAttribute('data-remove');
          const { doc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
          await deleteDoc(doc(collection(window.firebaseDb,'orders'), id));
          remove.closest('tr')?.remove();
          await refreshDashboard();
        } else if (removeReg){
          const id = removeReg.getAttribute('data-remove-reg');
          const { doc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
          await deleteDoc(doc(collection(window.firebaseDb,'registrations'), id));
          removeReg.closest('tr')?.remove();
          await refreshDashboard();
        }
      }catch(_){ alert('Ação falhou'); }
    });
  }

  async function loadRecentSchedules(){
    const tbody = document.getElementById('schedulesTbody');
    const count = document.getElementById('schedulesCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    const snap = await getDocs(collection(window.firebaseDb,'schedules'));
    let i=1; let total=0; snap.forEach(d=>{ const s=d.data(); const ts=new Date(s.createdAt||s.timestamp||s.date||0); if (period.from&&ts<period.from) return; if (period.to&&ts>period.to) return; total++; const tr=document.createElement('tr'); tr.innerHTML=`<td class="py-2">${i++}</td><td class="py-2">${s.eventType||''}</td><td class="py-2">${s.date||''}</td><td class="py-2">${s.hour||''}</td><td class="py-2">${s.name||s.email||''}</td>`; tbody.appendChild(tr); });
    if (count) count.textContent = `${total} inscrições`;
  }
  function parsePeriodFromValue(v){
    const now = new Date();
    if (v==='today'){ period.from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); period.to = null; }
    else if (v==='7d'){ const d=new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate()-7); period.from = d; period.to = null; }
    else if (v==='30d'){ const d=new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate()-30); period.from = d; period.to = null; }
    else if (v==='mes'){ period.from = new Date(now.getFullYear(), now.getMonth(), 1); period.to = null; }
    else { period.from = null; period.to = null; }
  }
  function parsePeriod(){
    const fromEl = document.getElementById('dateFrom');
    const toEl   = document.getElementById('dateTo');
    period.from = fromEl?.value ? new Date(fromEl.value) : null;
    period.to   = toEl?.value  ? new Date(toEl.value)   : null;
  }
  async function applyFilter(){ parsePeriod(); await loadReports(); }

  async function exportOrdersCsv(){
    const all = await fetchUnifiedOrders();
    const rows = [['data','cliente','item','valor','status']];
    all.forEach(o=>{ const ts=o.ts; if (period.from&&ts<period.from) return; if (period.to&&ts>period.to) return; rows.push([ts.toISOString(), o.customer||'', o.item||'', String(o.amount||0), o.status||'']); });
    downloadCsv('vendas.csv', rows);
  }

  async function exportSchedulesCsv(){
    const regs = await getDocs(collection(window.firebaseDb,'registrations'));
    const rows = [['id','data','evento','dia','hora','cliente']];
    regs.forEach(d=>{ const r=d.data(); const ts=(r.createdAt?.toDate ? r.createdAt.toDate() : (r.timestamp? new Date(r.timestamp) : new Date())); if (period.from&&ts<period.from) return; if (period.to&&ts>period.to) return; const schedule=String(r.schedule||''); const m=schedule.match(/(\d{1,2})h/); const hora=m?`${m[1]}h`:schedule; rows.push([d.id, ts.toISOString(), r.eventType||r.title||'Reserva', r.date||'', hora, r.email||'']); });
    downloadCsv('inscricoes.csv', rows);
  }

  // Bind botão reconciliar
  (function(){
    const btn = document.getElementById('btnReconcile');
    if (btn && !btn._bound){
      btn.addEventListener('click', ()=> reconcilePayments());
      btn._bound = true;
    }
  })();

  // Reconciliar pagamentos (24h) pelo external_reference
  async function reconcilePayments(){
    try{
      const { collection, getDocs, query, where, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const since = Date.now() - 24*60*60*1000;
      let checked = 0, approved = 0, ordersChecked = 0, ordersApproved = 0, tokensCredited = 0;
      // 1) Registrations pendentes
      const regsRef = collection(window.firebaseDb,'registrations');
      const regSnap = await getDocs(query(regsRef, where('status','==','pending')));
      for (const d of regSnap.docs){
        const r = d.data();
        const ts = r.createdAt?.toDate?.()?.getTime?.() || r.timestamp || 0;
        if ((r.external_reference || r.external_reference) && ts >= since){
          checked++;
          const res = await fetch('/.netlify/functions/check-payment-status', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ external_reference: r.external_reference }) });
          if (res.ok){
            const data = await res.json();
            const st = String(data?.status||'').toLowerCase();
            if (['approved','paid','accredited'].includes(st)){
              await updateDoc(doc(window.firebaseDb,'registrations', d.id), { status:'paid', paidAt: Date.now() });
              approved++;
            }
          }
        }
      }
      // 2) Orders pendentes (tokens/produtos)
      const ordersRef = collection(window.firebaseDb,'orders');
      const ordSnap = await getDocs(query(ordersRef, where('status','in',['pending','approved','']) ));
      for (const d of ordSnap.docs){
        const o = d.data();
        const ts = o.createdAt?.toDate?.()?.getTime?.() || o.timestamp || 0;
        if ((o.external_reference || o.preference_id) && ts >= since){
          ordersChecked++;
          const payload = o.external_reference ? { external_reference: o.external_reference } : { preference_id: o.preference_id };
          const res = await fetch('/.netlify/functions/check-payment-status', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
          if (res.ok){
            const data = await res.json();
            const st = String(data?.status||'').toLowerCase();
            if (['approved','paid','accredited'].includes(st)){
              await updateDoc(doc(window.firebaseDb,'orders', d.id), { status:'paid', paidAt: Date.now(), paymentStatus: 'approved' });
              ordersApproved++;
              // Se for compra de tokens, creditar saldo
              const isTokens = /token/i.test(String(o.title||'')) || /token/i.test(String(o.item||'')) || /token/i.test(String(o.description||''));
              if (isTokens){
                try{
                  const email = o.customer || o.buyerEmail;
                  if (email){
                    const { getDocs: g2, query: q2, where: w2 } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                    const usersRef = collection(window.firebaseDb,'users');
                    const userSnap = await g2(q2(usersRef, w2('email','==', email)));
                    if (!userSnap.empty){
                      const u = userSnap.docs[0];
                      const current = Number(u.data().tokens||0);
                      const qty = parseInt(String(o.title||'').match(/(\\d+)/)?.[1] || '1', 10);
                      await updateDoc(doc(window.firebaseDb,'users', u.id), { tokens: current + qty });
                      tokensCredited += qty;
                    }
                  }
                }catch(_){}
              }
            }
          }
        }
      }
      alert(`Reconciliados:\nInscrições → verificados ${checked}, confirmados ${approved}\nPedidos → verificados ${ordersChecked}, confirmados ${ordersApproved}\nTokens creditados: ${tokensCredited}`);
    }catch(e){
      console.error('Reconcile error', e);
      alert('Falha ao reconciliar pagamentos.');
    }
  }

  function downloadCsv(filename, rows){
    const csv = rows.map(r=>r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function renderPopularHours(){
    const canvas = document.getElementById('popularHoursChart');
    if (!canvas) return;
    const regs = await getDocs(collection(window.firebaseDb,'registrations'));
    const hours = ['14','15','16','17','18','19','20','21','22','23'];
    const map = Object.fromEntries(hours.map(h=>[h,0]));
    regs.forEach(d=>{ const r=d.data(); if ((r.status||'').toLowerCase()!=='paid') return; const schedule=String(r.schedule||''); const m=schedule.match(/(\d{1,2})h/); const h=(m?m[1]:schedule).toString().padStart(2,'0'); if (map[h]!==undefined) map[h]++; });
    const data = hours.map(h=>map[h]);
    try { if (charts.hours) { charts.hours.destroy(); } } catch(_){ }
    charts.hours = new Chart(canvas.getContext('2d'), { type:'bar', data:{ labels: hours.map(h=>`${h}h`), datasets:[{label:'Agendamentos', data, backgroundColor:'#34d399'}] }, options:{plugins:{legend:{display:false}}} });
  }

  // ===== HELPER FUNCTIONS PARA loadBoard =====
  
  // Mapa de tipos de eventos e suas variações
  function getEventTypeConfig() {
    return {
      canonical: {
        'modo-liga': (s) => s === 'liga' || s === 'modo-liga' || s.includes('modo liga') || s.includes('modo-liga'),
        'camp-final': (s) => s === 'camp-final' || s.includes('camp final') || s.includes('vaga direto') || s.includes('camp-final'),
        'camp-freitas': (s) => s === 'camp' || s === 'camp-freitas' || s.includes('camp freitas') || s.includes('camp-freitas'),
        'semanal-freitas': (s) => s === 'semanal' || s === 'semanal-freitas' || s.includes('semanal freitas') || s.includes('semanal-freitas'),
        'xtreino-tokens': (s) => s.includes('xtreino') || s === 'xtreino-tokens'
      },
      aliases: {
        'modo-liga': ['modo-liga','liga','modo liga'],
        'camp-freitas': ['camp-freitas','camp','camp freitas'],
        'camp-final': ['camp-final','camp final','final','vaga direto','vaga final'],
        'semanal-freitas': ['semanal-freitas','semanal','semanal freitas'],
        'xtreino-tokens': ['xtreino-tokens','xtreino','xtreino tokens']
      }
    };
  }

  // Normaliza tipo de evento para forma canônica
  function canonicalType(t) {
    const s = String(t||'').toLowerCase();
    const config = getEventTypeConfig();
    for (const [canonical, matcher] of Object.entries(config.canonical)) {
      if (matcher(s)) return canonical;
    }
    return t;
  }

  // Resolve aliases para um tipo de evento
  function resolveAliases(t) {
    const canon = canonicalType(t);
    const config = getEventTypeConfig();
    const base = config.aliases[canon] ? [...config.aliases[canon]] : [canon];
    base.push(null, '');
    return Array.from(new Set(base.filter(v => v !== undefined)));
  }

  // Retorna capacidade por horário
  function getCapacityForHour(eventType, hour, isCampFinalDate, isCampSemifinalDate) {
    const ev = String(eventType||'').toLowerCase();
    const hourNum = parseInt(String(hour||'').match(/(\d{1,2})/)?.[1] || 0, 10);
    
    if (ev === 'liga' || ev === 'acesso' || ev.includes('modo-liga') || ev.includes('modo liga') || ev.includes('acesso')) return 15;
    if (ev.includes('camp-final') || canonicalType(eventType) === 'camp-final') {
      if (isCampFinalDate && hourNum === 18) return 2;
      return 2;
    }
    if (ev.includes('semanal') && hourNum === 22) return 4;
    if (ev.includes('camp') && isCampSemifinalDate && hourNum === 17) return 3;
    return 12;
  }

  // Retorna horários padrão para tipo de evento
  function getDefaultHoursForEvent(eventType, isCampFinalDate) {
    return ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00',
            '10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00',
            '20:00','21:00','22:00','23:00'];
  }

  // Carrega eventos dinâmicos (adminEvents) no dropdown do board de horários
  async function loadDynamicEventsIntoBoard() {
    const typeEl = document.getElementById('boardEventType');
    if (!typeEl || !window.firebaseDb) return;
    try {
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const snap = await getDocs(query(
        collection(window.firebaseDb, 'adminEvents'),
        where('status', '==', 'Aberto')
      ));
      // Substituir TODAS as opções — apenas eventos do painel Criar/Gerenciar
      typeEl.innerHTML = '';
      if (snap.empty) {
        typeEl.innerHTML = '<option value="">Nenhum evento ativo</option>';
        return;
      }
      snap.forEach(d => {
        const ev = d.data();
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = ev.name || d.id;
        // Tipo canônico: preferir campo eventType; se vazio, derivar do nome do evento; fallback: doc ID
        // CRÍTICO: 'XTreino Freitas' → canonicalType → 'xtreino-tokens' (mesmo valor que o booking flow salva em r.eventType)
        const canon = canonicalType(ev.eventType || ev.name || d.id);
        opt.dataset.canonicalType = canon;
        opt.dataset.rawEventId = d.id;
        // evFieldType = tipo canônico que o booking flow usa ao salvar em r.eventType
        opt.dataset.evFieldType = canon;
        // rawEventType = valor exato que o MP/tokens usa como chave no slotCounters e em r.eventType
        // CRÍTICO: espelha `rawEventType = ev.eventType || d.id` do script.js
        opt.dataset.rawEventType = ev.eventType || d.id;
        typeEl.appendChild(opt);
      });
    } catch (err) {
      console.warn('Erro ao carregar eventos dinâmicos no board:', err);
      typeEl.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }
  window.loadDynamicEventsIntoBoard = loadDynamicEventsIntoBoard;

  // Busca registrations pelo dia
  // evFieldType = valor real do campo eventType no doc adminEvents (ex: 'xtreino-tokens')
  // CRÍTICO: igual ao fetchOccupiedForDate do script.js — query por campo único sem composite index
  // date e status são filtrados em JS depois, evitando necessidade de índice composto no Firestore
  async function fetchRegistrationsByDate(date, evFieldType, ovEventType = null, rawEventId = null) {
    try {
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const regs = collection(window.firebaseDb, 'registrations');
      const validStatuses = new Set(['paid', 'confirmed', 'approved', 'lisagem_gratis']);
      // Coletar todos os valores distintos de eventType que podem estar salvos nas registrations
      const typesToQuery = [...new Set([evFieldType, ovEventType, rawEventId].filter(Boolean))];
      if (typesToQuery.length === 0) return {};

      // Query por campo único (sem composite index) — mesclar resultados deduplificando por doc ID
      const allDocs = new Map();
      await Promise.all(typesToQuery.map(async t => {
        try {
          const snap = await getDocs(query(regs, where('eventType', '==', t)));
          snap.forEach(d => allDocs.set(d.id, d));
        } catch (_) {}
      }));

      const map = {};
      allDocs.forEach(d => {
        const r = d.data();
        if (r.date !== date) return;           // filtrar por data em JS
        if (!validStatuses.has(r.status)) return; // filtrar por status em JS

        const raw = String(r.schedule || r.hour || '').toLowerCase();
        const m = raw.match(/(\d{1,2})/);
        if (!m) return;

        const hh = String(parseInt(m[1], 10)).padStart(2, '0');
        const key = `${hh}:00`;
        map[key] = (map[key] || 0) + 1;
      });

      return map;
    } catch (e) {
      console.error('Erro ao buscar registrations:', e);
      return {};
    }
  }

  // Busca e normaliza horário em string
  function extractHour(hourStr) {
    const match = String(hourStr || '').match(/(\d{1,2})/);
    if (!match) return null;
    return String(parseInt(match[1], 10)).padStart(2, '0');
  }

  // Busca overrides (travas e ocupações extras)
  async function fetchScheduleOverrides(date, eventType, rawEventId = null) {
    const overrides = {};
    try {
      const { collection: c, query: q, where: w, getDocs: g } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const ovRef = c(window.firebaseDb, 'schedule_overrides');
      const variants = resolveAliases(eventType);
      // Incluir o ID bruto do Firestore como variante extra (retrocompat com docs antigos)
      if (rawEventId && rawEventId !== eventType && !variants.includes(rawEventId)) {
        variants.push(rawEventId);
      }
      
      // Buscar por variações de eventType
      for (const v of variants) {
        if (v === undefined || v === null || v === '') continue;
        try {
          const ovSnap = await g(q(ovRef, w('date', '==', date), w('eventType', '==', v)));
          ovSnap.forEach(d => {
            const raw = d.data();
            const hh = extractHour(raw.hour || raw.hh);
            if (!hh) return;
            const k = `${hh}:00`;
            const agg = overrides[k] || { lockedAny: false, extraOccupied: 0 };
            agg.lockedAny = agg.lockedAny || (raw.locked === true);
            if (raw.extraOccupied) agg.extraOccupied += Number(raw.extraOccupied || 0);
            if (raw.freeUntil) agg.freeUntil = raw.freeUntil;
            overrides[k] = agg;
          });
        } catch (e) {
          console.warn(`Erro ao buscar overrides para variante '${v}':`, e);
        }
      }
      
      // Fallback: todos os docs da data, filtrar em JS
      try {
        const allSnap = await g(q(ovRef, w('date', '==', date)));
        const canonEvent = canonicalType(eventType);
        allSnap.forEach(d => {
          const raw = d.data() || {};
          const hh = extractHour(raw.hour || raw.hh);
          if (!hh) return;
          const rawEt = raw.eventType || raw.event_type || '';
          const docFamily = canonicalType(rawEt);
          // Incluir se: sem eventType, canonical bate, ou ID bruto bate (retrocompat)
          const matchesCanon = docFamily === canonEvent;
          const matchesRawId = rawEventId && (rawEt === rawEventId);
          const hasNoType = !rawEt;
          if (!matchesCanon && !matchesRawId && !hasNoType) return;
          const k = `${hh}:00`;
          const agg = overrides[k] || { lockedAny: false, extraOccupied: 0 };
          agg.lockedAny = agg.lockedAny || (raw.locked === true);
          if (raw.extraOccupied) agg.extraOccupied += Number(raw.extraOccupied || 0);
          if (raw.freeUntil) agg.freeUntil = raw.freeUntil;
          overrides[k] = agg;
        });
      } catch (e) {
        console.warn('Erro ao buscar overrides fallback:', e);
      }
    } catch (e) {
      console.error('Erro ao buscar schedule_overrides:', e);
    }
    
    return overrides;
  }

  // Filtra horários por role (staff vê apenas 14h-18h)
  function filterEntriesByRole(entries) {
    if (window.adminRoleLower !== 'staff') return entries;
    return entries.filter(hour => {
      const hourNum = parseInt(String(hour).replace(/\D/g,'')) || 0;
      return hourNum >= 14 && hourNum <= 18;
    });
  }

  // Aplica travas fixas do Modo Liga
  function applyFixedModoLigaLocks(overrides, eventType) {
    if (canonicalType(eventType) !== 'modo-liga') return overrides;
    const fixed = { ...overrides };
    ['16:00', '17:00'].forEach(hour => {
      if (!fixed[hour]) {
        fixed[hour] = { lockedAny: true, extraOccupied: 0 };
      } else {
        fixed[hour].lockedAny = true;
      }
    });
    return fixed;
  }

  // Renderiza linha da tabela
  function createBoardTableRow(hour, capacity, occupied, overrides, eventType, permLockedHours) {
    const tr = document.createElement('tr');
    const ovData = overrides[hour] || {};
    const isFixedLock = false;
    const locked = isFixedLock ? true : !!(ovData.lockedAny === undefined ? ovData.locked : ovData.lockedAny);
    const isStaff = window.adminRoleLower === 'staff';

    // Trava permanente deste horário
    const hNum = parseInt(String(hour).match(/^(\d+)/)?.[1] || '', 10);
    const permLocked = !!(permLockedHours && permLockedHours.has(hNum));
    
    const remaining = Math.max(0, capacity - occupied);
    const occupiedText = remaining === 0 ? 'Lotado' : `Restam ${remaining}`;

    // Badge de trava permanente na coluna hora
    const permBadge = permLocked ? ' <span class="text-[10px] font-bold text-red-600 bg-red-100 rounded px-1">∞ FIXO</span>' : '';

    const lockButton = isStaff ? '' : `<button class="px-2 py-1 ${locked?'bg-red-600 text-white':'bg-yellow-400 text-black'} rounded text-xs" data-toggle-lock="${hour}">${locked?'Destravar':'Travar'}</button>`;
    const permLockButton = isStaff ? '' : `<button class="px-2 py-1 ${permLocked?'bg-purple-700 text-white':'bg-gray-400 text-white'} rounded text-xs font-bold" data-toggle-perm-lock="${hour}" title="${permLocked?'Remover trava permanente deste horário':'Travar este horário permanentemente (todas as datas)'}">∞ ${permLocked?'Destrav. Fixo':'Fixar'}</button>`;

    // Botão "Liberar Grátis": verde se ativo (freeUntil no futuro), cinza se inativo
    const nowTs = Date.now();
    const freeUntilTs = ovData.freeUntil ? new Date(ovData.freeUntil).getTime() : 0;
    const isFreeActive = freeUntilTs > nowTs;
    const freeButton = isStaff ? '' : `<button class="px-2 py-1 ${isFreeActive ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-800'} rounded text-xs font-bold" data-toggle-free="${hour}" title="${isFreeActive ? 'Cancelar gratuidade deste horário' : 'Liberar este horário como gratuito até o início'}">${isFreeActive ? '🟢 Grátis' : '🆓 Liberar'}</button>`;

    tr.innerHTML = `<td class="py-2">${hour}${permBadge}${isFreeActive ? ' <span class="text-[10px] font-bold text-green-700 bg-green-100 rounded px-1">GRÁTIS</span>' : ''}</td><td class="py-2" data-board-count="${hour}" data-board-cap="${capacity}" data-board-occ="${occupied}">${occupiedText}</td><td class="py-2 flex flex-wrap gap-1">
      <button class="px-2 py-1 bg-blue-600 text-white rounded text-xs" data-add-hour="${hour}">Adicionar</button>
      <button class="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs" data-manage-hour="${hour}">Gerenciar</button>
      <button class="px-2 py-1 bg-emerald-600 text-white rounded text-xs" data-export-hour="${hour}">Exportar</button>
      ${lockButton}
      ${permLockButton}
      ${freeButton}
    </td>`;
    
    return tr;
  }

  // Busca todos os overrides para um horário (consolidado)
  async function findAllOverridesForHour(date, eventType, hh, rawEventId = null) {
    
    const { collection: c, query: q, where: w, getDocs: g } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const ovRef = c(window.firebaseDb, 'schedule_overrides');
    const toUpdate = new Map();
    const variants = resolveAliases(eventType);
    const canon = canonicalType(eventType);
    
    // Incluir ID bruto como variante extra (retrocompat com docs antigos)
    if (rawEventId && rawEventId !== eventType && !variants.includes(rawEventId)) {
      variants.push(rawEventId);
    }
    
    // Query com eventType canônico e variações
    try {
      const snap1 = await g(q(ovRef, w('date', '==', date), w('eventType', '==', canon), w('hour', '==', hh)));
      snap1.forEach(d => toUpdate.set(d.id, d));
    } catch (e) {
      console.warn('❌ Erro na query eventType canônico:', e.message);
    }
    
    // Query com hh (formato alternativo)
    try {
      const snap2 = await g(q(ovRef, w('date', '==', date), w('eventType', '==', canon), w('hh', '==', hh)));
      snap2.forEach(d => toUpdate.set(d.id, d));
    } catch (e) {
      console.warn('❌ Erro na query hh:', e.message);
    }
    
    // Variações de aliases + ID bruto
    for (const v of variants) {
      if (!v) continue;
      try {
        const snapV = await g(q(ovRef, w('date', '==', date), w('eventType', '==', v), w('hour', '==', hh)));
        snapV.forEach(d => toUpdate.set(d.id, d));
      } catch (e) {
        console.warn(`  ⚠️ Erro variant ${v}:`, e.message);
      }
    }
    
    // Fallback: todos os docs da data, filtrar em JS (inclui docs com ID bruto antigo)
    try {
      const snapAll = await g(q(ovRef, w('date', '==', date)));
      snapAll.forEach(d => {
        const raw = d.data() || {};
        const hhDoc = extractHour(raw.hour || raw.hh);
        if (!hhDoc || hhDoc !== hh) return;
        const rawEt = raw.eventType || raw.event_type || '';
        const docFamily = canonicalType(rawEt);
        // Incluir se: canonical bate, ID bruto bate (retrocompat), ou sem eventType
        const matchesCanon = docFamily === canon;
        const matchesRawId = rawEventId && (rawEt === rawEventId);
        const hasNoType = !rawEt;
        if (!matchesCanon && !matchesRawId && !hasNoType) return;
        toUpdate.set(d.id, d);
      });
    } catch (e) {
      console.warn('❌ Erro ao buscar overrides fallback:', e.message);
    }
    
    return Array.from(toUpdate.values());
  }

  // Carrega quadro de horários por data/evento
  async function loadCampSemifinalLinks(force = false) {
    try{
      if (!window.firebaseDb) return {};
      if (campSemifinalLinksLoaded && !force) return campSemifinalLinks;
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const ref = collection(window.firebaseDb, 'camp_semifinal_links');
      const snap = await getDocs(ref);
      campSemifinalLinks = {};
      snap.forEach(doc => {
        const data = doc.data() || {};
        campSemifinalLinks[doc.id] = data;
      });
      campSemifinalLinksLoaded = true;
      return campSemifinalLinks;
    }catch(error){
      console.error('❌ Erro ao carregar links das semifinais do Camp:', error);
      return campSemifinalLinks;
    }
  }

  function renderCampSemifinalLinksPanel(selectedDate = null) {
    const panel = document.getElementById('campSemifinalLinksPanel');
    const list = document.getElementById('campSemifinalLinksList');
    if (!panel || !list) return;
    const normalizedDate = (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) ? selectedDate : null;
    const year = normalizedDate ? normalizedDate.slice(0,4) : null;
    const relevantDates = year ? CAMP_SEMIFINAL_DATES.filter(d => d.startsWith(year)) : [];

    if (!normalizedDate || !relevantDates.includes(normalizedDate)) {
      panel.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    panel.classList.remove('hidden');
    list.innerHTML = '';

    relevantDates.forEach((dateValue, index) => {
      const linkData = campSemifinalLinks[dateValue] || {};
      const linkValue = linkData.link || '';
      const fmt = new Date(`${dateValue}T00:00:00`);
      const dateLabel = fmt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
      const suffix = index === 0 ? '(Link 1)' : '(Link 2)';
      const card = document.createElement('div');
      card.className = 'bg-white border border-red-200 rounded-lg p-4 shadow-sm';
      const escapedValue = linkValue ? linkValue.replace(/"/g,'&quot;') : '';
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-red-700">${dateLabel} • 17h ${suffix}</p>
            <p class="text-xs text-gray-500">Cole o link do grupo onde enviará ID e senha da sala.</p>
          </div>
        </div>
        <div class="mt-3 space-y-2">
          <input data-camp-link-input="${dateValue}" type="url" value="${escapedValue}" placeholder="https://chat.whatsapp.com/..." class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          <div class="flex items-center gap-2">
            <button data-save-camp-link="${dateValue}" class="px-3 py-2 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700">Salvar link</button>
            <span id="campSemifinalStatus-${dateValue}" class="text-xs ${linkValue ? 'text-green-700' : 'text-gray-500'}">
              ${linkValue ? 'Link ativo' : 'Nenhum link cadastrado'}
            </span>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  }

  async function saveCampSemifinalLink(dateValue) {
    try{
      if (!window.firebaseDb) {
        showNotification('Firebase não inicializado ainda', 'error');
        return;
      }
      const input = document.querySelector(`[data-camp-link-input="${dateValue}"]`);
      if (!input) return;
      const link = input.value.trim();
      const { doc, setDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const ref = doc(collection(window.firebaseDb, 'camp_semifinal_links'), dateValue);
      await setDoc(ref, {
        date: dateValue,
        hour: '17h',
        link,
        status: link ? 'active' : 'inactive',
        updatedAt: serverTimestamp()
      }, { merge: true });
      showNotification('Link atualizado com sucesso!', 'success');
      await loadCampSemifinalLinks(true);
      renderCampSemifinalLinksPanel(dateValue);
    }catch(error){
      console.error('❌ Erro ao salvar link da semifinal do Camp:', error);
      showNotification('Erro ao salvar link da semifinal', 'error');
    }
  }

  (function(){
    const panel = document.getElementById('campSemifinalLinksPanel');
    if (panel) {
      panel.addEventListener('click', async (event)=>{
        const btn = event.target.closest('[data-save-camp-link]');
        if (!btn) return;
        const dateValue = btn.getAttribute('data-save-camp-link');
        await saveCampSemifinalLink(dateValue);
      });
    }
    const refreshBtn = document.getElementById('campSemifinalLinksRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async ()=>{
        await loadCampSemifinalLinks(true);
        const dateValue = document.getElementById('boardDate')?.value || null;
        renderCampSemifinalLinksPanel(dateValue);
      });
    }
  })();

  let _isLoadingBoard = false;
  let _boardRefreshInterval = null; // Opção 4: intervalo de atualização automática do board
  async function loadBoard(){
    if (_isLoadingBoard) return;
    _isLoadingBoard = true;
    try {
      // Validação de elementos DOM
      const dateEl = document.getElementById('boardDate');
      const typeEl = document.getElementById('boardEventType');
      const tbody = document.getElementById('boardTbody');
      if (!dateEl || !typeEl || !tbody) {
        console.warn('Elementos DOM não encontrados para loadBoard');
        return;
      }

      const date = dateEl.value;
      const eventType = typeEl.value;
      
      // Validação de data
      if (!date) {
        renderCampSemifinalLinksPanel(null);
        tbody.innerHTML = '';
        return
      }

      const selectedOpt = typeEl.options[typeEl.selectedIndex];
      const ovEventType = selectedOpt?.dataset?.canonicalType || canonicalType(eventType);
      // rawEvType espelha exatamente ev.eventType || d.id — o mesmo que script.js usa para verificar
      // disponibilidade (rawEventType). Usar isso nas travas garante que o match sempre funciona.
      const rawEvType = selectedOpt?.dataset?.rawEventType || ovEventType;
      const rawEventId = selectedOpt?.dataset?.rawEventId || eventType;
      // evFieldType = valor bruto do campo eventType do adminEvents doc (é o que o booking flow salva em r.eventType)
      const evFieldType = selectedOpt?.dataset?.evFieldType || rawEventId;
      const isCampSemifinalDate = CAMP_SEMIFINAL_DATES.includes(date);
      const isCampFinalDate = CAMP_FINAL_DATES.includes(date);

      // ===== Configuração de UI por role =====
      const btnClearLocks = document.getElementById('btnClearLocks');
      if (window.adminRoleLower === 'staff') {
        if (btnClearLocks) btnClearLocks.style.display = 'none';
        if (typeEl) {
          typeEl.value = 'xtreino-tokens';
          typeEl.disabled = true;
        }
      } else {
        if (typeEl) typeEl.disabled = false;
        if (btnClearLocks) btnClearLocks.style.display = '';
      }

      // ===== Carregar dados de semifinal =====
      if (ovEventType === 'camp-freitas') {
        await loadCampSemifinalLinks();
        renderCampSemifinalLinksPanel(date);
      } else {
        renderCampSemifinalLinksPanel(null);
      }

      // ===== Bind do botão de destravar tudo do dia =====
      bindClearLocksButton(btnClearLocks, date, rawEvType);

      // ===== Bind do botão Travar dia inteiro =====
      const btnLockAllDay = document.getElementById('btnLockAllDay');
      if (btnLockAllDay && window.adminRoleLower !== 'staff') {
        btnLockAllDay.style.display = '';
        const newBtnLock = btnLockAllDay.cloneNode(true);
        btnLockAllDay.parentNode.replaceChild(newBtnLock, btnLockAllDay);
        newBtnLock.addEventListener('click', () => handleLockAllDay(date, rawEvType));
      } else if (btnLockAllDay) {
        btnLockAllDay.style.display = 'none';
      }

      // ===== Bind e status do botão Trava Geral =====
      const btnGlobalLock = document.getElementById('btnGlobalLock');
      if (btnGlobalLock && window.adminRoleLower !== 'staff') {
        await loadGlobalLockStatus(rawEvType);
        const newBtnGlobal = btnGlobalLock.cloneNode(true);
        // copiar dataset
        newBtnGlobal.dataset.globalLocked = btnGlobalLock.dataset.globalLocked;
        newBtnGlobal.textContent = btnGlobalLock.textContent;
        newBtnGlobal.className = btnGlobalLock.className;
        btnGlobalLock.parentNode.replaceChild(newBtnGlobal, btnGlobalLock);
        newBtnGlobal.addEventListener('click', () => handleGlobalLock(rawEvType));
      } else if (btnGlobalLock) {
        btnGlobalLock.style.display = 'none';
      }

      // ===== Determinar horários e capacidade =====
      const defaultHours = getDefaultHoursForEvent(eventType, isCampFinalDate);
      
      if (defaultHours.length === 0) {
        tbody.innerHTML = '';
        return;
      }

      // ===== Carregar dados de registrations =====
      // Passar ambos: tipo canônico (ovEventType) e ID bruto do doc (rawEventId)
      // para aceitar registrations salvas de qualquer forma
      const occupancyMap = await fetchRegistrationsByDate(date, evFieldType, ovEventType, rawEventId);

      // ===== Carregar overrides (travas e extras) =====
      let overridesMap = await fetchScheduleOverrides(date, ovEventType, rawEventId);
      
      // Aplicar travas fixas do Modo Liga
      //overridesMap = applyFixedModoLigaLocks(overridesMap, ovEventType);

      // Mesclar overrides no mapa de ocupação
      const mergedMap = {};
      defaultHours.forEach(hour => {
        const occupied = occupancyMap[hour] || 0;
        const cap = getCapacityForHour(ovEventType, hour, isCampFinalDate, isCampSemifinalDate);
        let final = occupied;
        
        const ovData = overridesMap[hour];
        if (ovData?.extraOccupied) {
          final += ovData.extraOccupied;
        }
        if (ovData?.lockedAny) {
          final = cap;
        }
        
        mergedMap[hour] = final;
      });

      // ===== Filtrar horários por role =====
      let entries = [...defaultHours].sort((a, b) => {
        const na = parseInt(String(a).replace(/\D/g,'')) || 0;
        const nb = parseInt(String(b).replace(/\D/g,'')) || 0;
        return na - nb;
      });
      entries = filterEntriesByRole(entries);

      // ===== Renderizar tabela =====
      tbody.innerHTML = '';
      
      if (entries.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td class="py-2" colspan="3">Sem horários disponíveis para esta data/evento.</td>';
        tbody.appendChild(tr);
        return;
      }

      // ===== Carregar travas permanentes por horário =====
      let permLockedHours = new Set();
      try {
        const { collection: _c, query: _q, where: _w, getDocs: _g } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const hlRef = _c(window.firebaseDb, 'event_hour_locks');
        // Usar apenas 1 filtro (eventType) para evitar índice composto no Firestore
        const hlSnap = await _g(_q(hlRef, _w('eventType', '==', ovEventType)));
        hlSnap.forEach(d => {
          if (d.data().locked !== true) return; // filtrar locked em JS
          const h = parseInt(String(d.data().hour || '').match(/^(\d+)/)?.[1] || '', 10);
          if (!isNaN(h)) permLockedHours.add(h);
        });
      } catch(_) {}

      entries.forEach(hour => {
        const cap = getCapacityForHour(ovEventType, hour, isCampFinalDate, isCampSemifinalDate);
        const occupied = mergedMap[hour] || 0;
        const tr = createBoardTableRow(hour, cap, occupied, overridesMap, ovEventType, permLockedHours);
        tbody.appendChild(tr);
      });

      // ===== Bind dos botões de ação =====
      bindBoardTableActions(tbody, date, eventType, ovEventType, rawEventId, evFieldType);

      // ===== Opção 4: badge ao vivo — atualiza contagem a cada 60 s sem reload =====
      if (_boardRefreshInterval) { clearInterval(_boardRefreshInterval); _boardRefreshInterval = null; }
      const _liveDate = date, _liveField = evFieldType, _liveOv = ovEventType, _liveRaw = rawEventId;
      _boardRefreshInterval = setInterval(async () => {
        try {
          const freshOcc = await fetchRegistrationsByDate(_liveDate, _liveField, _liveOv, _liveRaw);
          document.querySelectorAll('[data-board-count]').forEach(td => {
            const h = td.dataset.boardCount;
            const cap = parseInt(td.dataset.boardCap || '0', 10);
            const occ = freshOcc[h] || 0;
            const rem = Math.max(0, cap - occ);
            const newText = rem === 0 ? 'Lotado' : `Restam ${rem}`;
            if (td.textContent !== newText) {
              td.textContent = newText;
              td.style.transition = 'color 0.5s';
              td.style.color = '#2563eb';
              setTimeout(() => { td.style.color = ''; }, 2000);
            }
          });
        } catch (_) {}
      }, 60000);

    } catch (e) {
      console.error('❌ Erro em loadBoard:', e.message || e);
    } finally {
      _isLoadingBoard = false;
    }
  }

  // Binda ações dos botões da tabela
  function bindBoardTableActions(tbody, date, eventType, ovEventType, rawEventId = null, evFieldType = null) {
    // Remover listeners antigos para evitar duplicação
    if (!tbody || !tbody.parentNode) return;
    const newTbody = tbody.cloneNode(true);
    tbody.parentNode.replaceChild(newTbody, tbody);
    
    newTbody.addEventListener('click', async (e) => {
      try {
        const btnAdd = e.target.closest('[data-add-hour]');
        const btnManage = e.target.closest('[data-manage-hour]');
        const btnToggle = e.target.closest('[data-toggle-lock]');
        const btnExport = e.target.closest('[data-export-hour]');

        if (btnAdd) {
          const h = btnAdd.getAttribute('data-add-hour');
          const modal = document.getElementById('modalAddTeam');
          const hourInput = document.getElementById('addHour');
          if (hourInput) hourInput.value = h;
          // Resetar toggle para "Pago" a cada abertura
          if (typeof window.selectAddPaidType === 'function') window.selectAddPaidType('paid');
          // Limpar campos do form
          ['addTeamName','addContact','addEmail','addPerson','addNotes'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
          });
          const statusEl = document.getElementById('addEmailStatus');
          if (statusEl) statusEl.textContent = '';
          const msgEl = document.getElementById('addTeamMsg');
          if (msgEl) msgEl.textContent = '';
          if (modal) modal.classList.remove('hidden');
        } 
        else if (btnManage) {
          const h = btnManage.getAttribute('data-manage-hour');
          openManageHourModal(date, ovEventType, h, rawEventId, evFieldType);
        } 
        else if (btnExport) {
          const h = btnExport.getAttribute('data-export-hour');
          try {
            const text = await buildExportList(date, ovEventType, h);
            await navigator.clipboard.writeText(text);
            alert('Lista copiada para a área de transferência.');
          } catch (err) {
            console.error('Falha ao exportar lista:', err);
            alert('Falha ao exportar lista.');
          }
        } 
        else if (btnToggle) {
          const h = btnToggle.getAttribute('data-toggle-lock');
          await handleToggleLock(h, date, eventType, ovEventType, rawEventId);
        }
        const btnPermLock = e.target.closest('[data-toggle-perm-lock]');
        if (btnPermLock) {
          const h = btnPermLock.getAttribute('data-toggle-perm-lock');
          await handleTogglePermanentLock(h, ovEventType);
        }
        const btnFree = e.target.closest('[data-toggle-free]');
        if (btnFree) {
          const h = btnFree.getAttribute('data-toggle-free');
          await handleToggleFree(h, date, ovEventType, rawEventId);
        }
      } catch (e) {
        console.error('Erro ao processar ação da tabela:', e);
      }
    });
  }

  async function handleToggleFree(hour, date, ovEventType, rawEventId = null) {
    const hh = extractHour(hour);
    if (!hh) { showToast('error', 'Horário inválido.', 'Erro'); return; }

    try {
      const { collection: c, query: q, where: w, getDocs: g, doc, addDoc, updateDoc, deleteField, serverTimestamp } =
        await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

      const ovRef = c(window.firebaseDb, 'schedule_overrides');
      const snap = await g(q(ovRef, w('date', '==', date), w('eventType', '==', ovEventType), w('hour', '==', hh)));

      const nowTs = Date.now();
      let existingFreeUntil = null;
      let existingDocId = null;

      snap.forEach(d => {
        const ft = d.data().freeUntil;
        if (ft) { existingFreeUntil = new Date(ft).getTime(); existingDocId = d.id; }
      });

      const isFreeActive = existingFreeUntil && existingFreeUntil > nowTs;

      if (isFreeActive) {
        const ok = await showConfirm('Cancelar Gratuidade', `Cancelar a liberação gratuita do horário ${hh}h? O horário voltará ao preço normal.`, 'Cancelar Gratuidade', 'Manter Grátis');
        if (!ok) return;
        if (existingDocId) {
          await updateDoc(doc(window.firebaseDb, 'schedule_overrides', existingDocId), { freeUntil: deleteField() });
        }
        showToast('info', `Horário ${hh}h voltou ao preço normal.`, 'Gratuidade Cancelada');
      } else {
        // Calcular freeUntil = hoje às hh:00 (hora do evento)
        const [ano, mes, dia] = date.split('-').map(Number);
        const horaNum = parseInt(hh, 10);
        const freeUntil = new Date(ano, mes - 1, dia, horaNum, 0, 0).toISOString();

        const ok = await showConfirm('Liberar Grátis', `Liberar o horário ${hh}h de ${date} como GRATUITO até o início?\n\nClientes verão "🆓 GRÁTIS" e não pagarão nada.`, 'Liberar Grátis', 'Cancelar');
        if (!ok) return;

        if (existingDocId) {
          await updateDoc(doc(window.firebaseDb, 'schedule_overrides', existingDocId), { freeUntil });
        } else {
          await addDoc(ovRef, { date, eventType: ovEventType, hour: hh, hh, locked: false, freeUntil, updatedAt: serverTimestamp() });
        }
        showToast('success', `Horário ${hh}h liberado gratuitamente até o início!`, 'Grátis Ativado 🆓');
      }
      await loadBoard();
    } catch (err) {
      console.error('[handleToggleFree]', err);
      showToast('error', 'Erro ao alterar gratuidade: ' + (err.message || err), 'Erro');
    }
  }

  // Trava permanente de horário individual (sem data)
  async function handleTogglePermanentLock(hour, ovEventType) {
    const hNum = parseInt(String(hour).match(/^(\d+)/)?.[1] || '', 10);
    console.log('[Fixar] chamado', { hour, hNum, ovEventType });
    if (isNaN(hNum)) { showToast('error','Horário inválido.','Erro'); return; }
    const docId = `${ovEventType}__${hNum}`;
    try {
      const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const ref = doc(window.firebaseDb, 'event_hour_locks', docId);
      console.log('[Fixar] lendo estado atual, docId:', docId);
      const snap = await getDoc(ref);
      const isCurrentlyLocked = snap.exists() && snap.data().locked === true;
      console.log('[Fixar] estado atual:', { exists: snap.exists(), isCurrentlyLocked });
      const msg = isCurrentlyLocked
        ? `🔓 Destravar o horário ${hNum}h de "${ovEventType}" em TODAS as datas?`
        : `🔒 Travar o horário ${hNum}h de "${ovEventType}" em TODAS as datas permanentemente?\n\nOs clientes não poderão reservar este horário em nenhuma data até você destravar.`;
      const ok = await showConfirm('Confirmar', msg);
      console.log('[Fixar] confirmação:', ok);
      if (!ok) return;
      console.log('[Fixar] gravando no Firestore...');
      await setDoc(ref, { eventType: ovEventType, hour: String(hNum), locked: !isCurrentlyLocked, updatedAt: Date.now() });
      console.log('[Fixar] gravado com sucesso');
      showToast('success', isCurrentlyLocked ? `Horário ${hNum}h destravado em todas as datas.` : `Horário ${hNum}h travado permanentemente em todas as datas.`, isCurrentlyLocked ? 'Destravado' : 'Fixado');
      await loadBoard();
    } catch(err) {
      console.error('[Fixar] ERRO:', err);
      const msg = 'Falha ao fixar horário: ' + (err.message || String(err));
      showToast('error', msg, 'Erro');
      alert('❌ ' + msg + '\n\nAbra o console do navegador (F12) para mais detalhes.');
    }
  }

  // Handler para toggle de travamento de horário
  async function handleToggleLock(hour, date, eventType, ovEventType, rawEventId = null) {
    
    const isFixedLock = false // (canonicalType(eventType) === 'modo-liga' && (hour === '16:00' || hour === '17:00'));
    
    
    if (isFixedLock) {
      // Verificar estado atual (se "Destravar" está visível)
      const btn = document.querySelector(`[data-toggle-lock="${hour}"]`);
      const isCurrentlyLocked = btn?.textContent.trim() === 'Destravar';
      
      
      if (isCurrentlyLocked) {
        const userConfirmed = await confirm(`⚠️ ATENÇÃO: Este horário (${hour}) está configurado como fixo travado para o Modo Liga.\n\nDeseja realmente destravar?`);
        
        if (!userConfirmed) {          
          return;
        }
      }
    }

    try {
      const hh = extractHour(hour);
      
      if (!hh) {
        alert('Erro: horário inválido');
        return;
      }      

      const docsArr = await findAllOverridesForHour(date, ovEventType, hh, rawEventId);       
      if (docsArr.length > 0) {        
        // Verificar estado atual
        const anyLocked = docsArr.some(d => d.data()?.locked === true);
        const newLocked = !anyLocked;
        
        // Atualizar em batch
        const { writeBatch, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const batch = writeBatch(window.firebaseDb);
        
        docsArr.forEach(d => {
          const ref = doc(window.firebaseDb, 'schedule_overrides', d.id);
          
          batch.update(ref, { locked: newLocked, eventType: ovEventType, hour: hh, hh });
        });
        
        await batch.commit();
        
      } else {
        
        // Criar novo documento
        const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const ovRef = collection(window.firebaseDb, 'schedule_overrides');
        const newDoc = await addDoc(ovRef, { 
          date, 
          eventType: ovEventType, 
          hour: hh, 
          hh, 
          locked: true, 
          extraOccupied: 0, 
          createdAt: Date.now() 
        });
        
      }

      await loadBoard();
      
    } catch (e) {
      console.error('❌ Erro ao alternar trava:', e);
      console.error('📋 Stack:', e.stack);
      alert('Falha ao alternar trava do horário.\n\nErro: ' + (e.message || 'Desconhecido'));
    }
  }



  function bindClearLocksButton(btn, date, ovEventType) {
    if (!btn || window.adminRoleLower === 'staff') return;

    // Remover listener anterior se existir (permite rebinding quando evento muda)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);    
    
    newBtn.addEventListener('click', async () => {
        try {
            const canon = canonicalType(ovEventType);
            const variants = resolveAliases(ovEventType);                     
            
            const userConfirmed = await confirm(`Destravar todas as travas e zerar ocupações extras de ${date} (${ovEventType})?`);
            
            if (!userConfirmed) {                
                return;
            }

            const { collection, query, where, getDocs, doc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ovRef = collection(window.firebaseDb, 'schedule_overrides');
            const updates = [];

            // Query 1: Buscar por variantes canônicas/aliases            
            for (const v of variants) {
                if (!v) continue;
                try {
                    const snap = await getDocs(query(ovRef, where('date', '==', date), where('eventType', '==', v)));
                    
                    snap.forEach(d => {
                        const data = d.data();

                        updates.push({ 
                            ref: doc(window.firebaseDb, 'schedule_overrides', d.id), 
                            data: { locked: false, extraOccupied: 0, eventType: canon } 
                        });
                    });
                } catch (e) {
                    console.warn(`  ⚠️  Erro na variante "${v}":`, e.message);
                }
            }

            // Query 2: Fallback - apenas documentos que AINDA não têm eventType ou que combinam com aliases            
            try {
                const snapAll = await getDocs(query(ovRef, where('date', '==', date)));               
                
                snapAll.forEach(d => {
                    // Pular se já foi adicionado na Query 1
                    if (updates.some(u => u.ref._key.path.segments[1] === d.id)) {                        
                        return;
                    }
                    
                    const raw = d.data();
                    const docFamily = canonicalType(raw.eventType || raw.event_type || '');                    
                    
                    // Incluir APENAS se:
                    // 1. Não tem eventType (docs antigos) OU
                    // 2. O eventType corresponde ao canonicalType do evento selecionado
                    if (!docFamily) {                        
                        updates.push({ 
                            ref: doc(window.firebaseDb, 'schedule_overrides', d.id), 
                            data: { locked: false, extraOccupied: 0, eventType: canon } 
                        });
                    } else if (docFamily === canon) {                        
                        updates.push({ 
                            ref: doc(window.firebaseDb, 'schedule_overrides', d.id), 
                            data: { locked: false, extraOccupied: 0, eventType: canon } 
                        });
                    } 
                });
            } catch (e) {
                console.warn('❌ Erro no fallback:', e.message);
            }            
            
            if (updates.length === 0) {                
                showToast('info', 'Nenhuma trava encontrada para este dia', 'Info');
                return;
            }

            // Commit em chunks de 400 (limite do Firestore é 500)
            const CHUNK_SIZE = 400;
            for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
                const chunk = updates.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(window.firebaseDb);
                chunk.forEach(u => {
                    batch.update(u.ref, u.data);
                });
                const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
                const totalChunks = Math.ceil(updates.length / CHUNK_SIZE);                
                await batch.commit();
            }            
            
            showToast('success', `trava(s) removida(s) e ocupações zeradas`, 'Sucesso');
            await loadBoard();
        } catch (error) {            
            showToast('error', `Falha ao destravar tudo: ${error.message}`, 'Erro');
        }
    });
  }

  // ── Travar dia inteiro ─────────────────────────────────────────────────────
  async function handleLockAllDay(date, ovEventType) {
    if (!date || !ovEventType) { showToast('error','Selecione evento e data antes de travar.','Erro'); return; }
    const ok = await confirm(`🔒 Travar TODOS os horários de ${date} para "${ovEventType}"?\nOs clientes não conseguirão reservar nenhum horário deste dia.`);
    if (!ok) return;
    try {
      const { collection, query, where, getDocs, doc, addDoc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const defaultHours = getDefaultHoursForEvent(ovEventType, false);
      const ovRef = collection(window.firebaseDb, 'schedule_overrides');
      // Usar ovEventType diretamente (já é ev.eventType || d.id — mesmo valor que script.js usa)
      const evType = ovEventType;

      // Buscar docs existentes para o dia DESTE evento (filtrar em JS por eventType para
      // não sobrescrever travas de outros eventos no mesmo dia)
      const existing = {};
      const snap = await getDocs(query(ovRef, where('date','==',date)));
      snap.forEach(d => {
        const r = d.data();
        const docEv = r.eventType || '';
        // Só reutilizar doc que já pertence ao mesmo evento
        if (docEv && docEv !== evType && canonicalType(docEv) !== canonicalType(evType)) return;
        const h = String(r.hour || r.hh || '').replace(/\D/g,'');
        if (h) existing[h] = d.id;
      });

      const batch = writeBatch(window.firebaseDb);
      const toCreate = [];

      defaultHours.forEach(hour => {
        const hh = extractHour(hour);
        if (!hh) return;
        const hStr = String(parseInt(hh, 10));
        if (existing[hStr] || existing[hh]) {
          const id = existing[hStr] || existing[hh];
          batch.update(doc(window.firebaseDb,'schedule_overrides',id), { locked: true, eventType: evType, hour: hStr, hh: hStr });
        } else {
          toCreate.push({ date, eventType: evType, hour: hStr, hh: hStr, locked: true, extraOccupied: 0, createdAt: Date.now() });
        }
      });

      await batch.commit();
      for (const d of toCreate) await addDoc(ovRef, d);

      showToast('success',`Todos os horários de ${date} foram travados.`,'Travado');
      await loadBoard();
    } catch (err) {
      console.error(err);
      showToast('error','Falha ao travar o dia: ' + (err.message||err),'Erro');
    }
  }

  // ── Trava geral (permanente até destravar) ──────────────────────────────────
  async function loadGlobalLockStatus(ovEventType) {
    const btn = document.getElementById('btnGlobalLock');
    if (!btn || window.adminRoleLower === 'staff') { if (btn) btn.style.display = 'none'; return; }
    btn.style.display = '';
    if (!window.firebaseDb || !ovEventType) { btn.textContent = '🔒 Trava Geral'; return; }
    try {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const snap = await getDoc(doc(window.firebaseDb, 'event_global_locks', ovEventType));
      const isLocked = snap.exists() && snap.data().locked === true;
      btn.textContent = isLocked ? '🔴 Destavar Geral (travado)' : '🔒 Travar Geral';
      btn.className = `px-3 py-2 rounded font-semibold text-white ${isLocked ? 'bg-red-700' : 'bg-gray-700 hover:bg-gray-900'}`;
      btn.dataset.globalLocked = isLocked ? '1' : '0';
    } catch(e) {
      btn.textContent = '🔒 Travar Geral';
    }
  }

  async function handleGlobalLock(ovEventType) {
    const btn = document.getElementById('btnGlobalLock');
    const isCurrentlyLocked = btn?.dataset.globalLocked === '1';
    const action = isCurrentlyLocked ? 'DESTRAVAR' : 'TRAVAR';
    const msg = isCurrentlyLocked
      ? `🔓 Destravar o evento "${ovEventType}" permanentemente?\nOs clientes voltarão a ver os horários normalmente.`
      : `🔒 TRAVAR GERAL o evento "${ovEventType}"?\n\nIsso bloqueia TODOS os horários em TODAS as datas até você destravar manualmente.`;
    const ok = await confirm(msg);
    if (!ok) return;
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      await setDoc(doc(window.firebaseDb,'event_global_locks',ovEventType), {
        locked: !isCurrentlyLocked,
        eventType: ovEventType,
        updatedAt: Date.now()
      });
      showToast('success', isCurrentlyLocked ? 'Evento destravado globalmente.' : 'Evento travado globalmente em todos os horários.', isCurrentlyLocked ? 'Destravado' : 'Travado');
      await loadGlobalLockStatus(ovEventType);
      await loadBoard();
    } catch(err) {
      console.error(err);
      showToast('error','Falha na trava geral: ' + (err.message||err),'Erro');
    }
  }

  // Troca a aba ativa no modal de gerenciar horário
  window.switchManageHourTab = function(tab) {
    const confirmedList = document.getElementById('manageHourListConfirmed');
    const pendingList   = document.getElementById('manageHourListPending');
    const tabConfirmed  = document.getElementById('mhTabConfirmed');
    const tabPending    = document.getElementById('mhTabPending');
    if (!confirmedList || !pendingList) return;

    if (tab === 'confirmed') {
      confirmedList.classList.remove('hidden');
      pendingList.classList.add('hidden');
      tabConfirmed.className = 'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all border-green-500 bg-green-50 text-green-700';
      tabPending.className   = 'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all border-gray-200 bg-white text-gray-500';
    } else {
      confirmedList.classList.add('hidden');
      pendingList.classList.remove('hidden');
      tabPending.className   = 'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all border-yellow-400 bg-yellow-50 text-yellow-700';
      tabConfirmed.className = 'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all border-gray-200 bg-white text-gray-500';
    }
  };

  async function openManageHourModal(date, eventType, hour, rawEventId = null, evFieldType = null){
    try{
      const title         = document.getElementById('manageHourTitle');
      const listConfirmed = document.getElementById('manageHourListConfirmed');
      const listPending   = document.getElementById('manageHourListPending');
      const modal         = document.getElementById('modalManageHour');
      if (!listConfirmed || !modal) return;

      // Salvar contexto para uso pelo botão SPEC
      window._currentManageHour = { date, eventType, hour, rawEventId };

      // Mostrar botão SPEC apenas para Modo Liga
      const specFooter = document.getElementById('specFooter');
      if (specFooter) {
        const _evL = String(eventType||'').toLowerCase() + String(rawEventId||'').toLowerCase();
        const _isLiga = _evL.includes('liga') || _evL.includes('modo');
        specFooter.classList.toggle('hidden', !_isLiga);
      }

      if (title) title.textContent = `Gerenciar ${hour} — ${date}`;

      // Reset: mostrar aba "Confirmados" por padrão
      listConfirmed.innerHTML = '<div class="text-sm text-gray-500 py-4 text-center">Carregando...</div>';
      if (listPending) listPending.innerHTML = '';
      switchManageHourTab('confirmed');

      const { collection, query, where, getDocs, doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const regs = collection(window.firebaseDb,'registrations');
      // CRÍTICO: query por campo único (sem composite index) — igual ao fetchOccupiedForDate do script.js
      // date e status filtrados em JS depois
      const _validManageStatuses = new Set(['paid','confirmed','approved','pending','lisagem_gratis']);
      const _typesToQuery = [...new Set([evFieldType, eventType, rawEventId].filter(Boolean))];
      const _allRegDocs = new Map();
      await Promise.all(_typesToQuery.map(async t => {
        try {
          const s = await getDocs(query(regs, where('eventType', '==', t)));
          s.forEach(d => _allRegDocs.set(d.id, d));
        } catch (_) {}
      }));
      // Filtrar por data e status em JS
      const _filteredByDate = [..._allRegDocs.values()].filter(d => {
        const r = d.data();
        return r.date === date && _validManageStatuses.has(r.status);
      });
      // Criar objeto snap compatível com código abaixo
      const snap = { forEach: cb => _filteredByDate.forEach(cb) };

      listConfirmed.innerHTML = '';
      if (listPending) listPending.innerHTML = '';

      const evLower    = String(eventType||'').toLowerCase();
      const rawIdLower = String(rawEventId||'').toLowerCase();
      const normalizeHour = (s)=>{ const m = String(s||'').match(/(\d{1,2})/); return m? String(parseInt(m[1],10)).padStart(2,'0') : null; };
      const targetHH = normalizeHour(hour);

      let countConfirmed = 0, countPending = 0;

      // Função auxiliar para criar uma linha de time
      // posIdx: índice posicional (1-based) dentro do grupo ordenado — igual ao "ver detalhes > Inscritos"
      const makeRow = (d, r, isPending, isFreeManual, posIdx) => {
        const _adminLogoUrl = r.teamLogoUrl || r.teamLogoThumb || null;
        const logoHtml = _adminLogoUrl
          ? `<img src="${_adminLogoUrl}" class="w-7 h-7 rounded object-cover flex-shrink-0">`
          : `<div class="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 text-xs">${(r.teamName||'?').charAt(0).toUpperCase()}</div>`;
        const isLisagemGratis = r.status === 'lisagem_gratis';
        const statusBadge = isLisagemGratis
          ? '<span class="text-xs bg-slate-100 text-slate-600 border border-slate-300 rounded px-1.5 py-0.5 font-bold">🆓 LISAGEM GRÁTIS</span>'
          : isFreeManual
          ? '<span class="text-xs bg-orange-100 text-orange-700 border border-orange-300 rounded px-1.5 py-0.5">🎁 Grátis</span>'
          : isPending
            ? '<span class="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 rounded px-1.5 py-0.5">⏳ Pendente</span>'
            : '<span class="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-1.5 py-0.5">✓ Pago</span>';
        const _mgEmail = r.email || r.clientEmail || '';
        const _mgPhone = r.contact || r.phone || '';
        // Badge posicional — igual ao painel Ver Detalhes > Inscritos
        // Modo Liga: exibe letra (A, B, C…) em vez de número
        // Usa r.eventType (campo do registro) para garantir detecção correta
        const _isLigaRow = (r.eventType || rawIdLower || '').toLowerCase() === 'modo-liga';
        const slotBadgeLabel = _isLigaRow
          ? String.fromCharCode(64 + posIdx)
          : `#${posIdx}`;
        const slotBadge = posIdx != null
          ? `<span class="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 flex-shrink-0">${slotBadgeLabel}</span>`
          : '';
        // Botão de verificar pagamento — só para pendentes com external_reference
        const extRef = r.external_reference || null;
        const verifyBtn = isPending
          ? `<button class="flex-shrink-0 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs hover:bg-blue-600 hover:text-white transition-colors font-medium"
                    data-verify-reg-id="${d.id}" data-ext-ref="${extRef || ''}" title="Consultar Mercado Pago e confirmar automaticamente">
               🔍 Verificar
             </button>`
          : '';
        const row = document.createElement('div');
        const isLisagemGratisRow = r.status === 'lisagem_gratis';
        row.className = 'flex items-center justify-between gap-3 p-2.5 rounded-lg border ' + (isLisagemGratisRow ? 'border-slate-200 bg-slate-50' : isPending ? 'border-yellow-200 bg-yellow-50' : 'border-green-100 bg-green-50/40');
        row.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            ${logoHtml}
            <div class="min-w-0">
              <div class="font-semibold text-sm flex items-center flex-wrap gap-1">
                ${slotBadge}
                <span class="truncate">${r.teamName||_mgEmail||'-'}</span>
                ${statusBadge}
              </div>
              ${_mgPhone ? `<div class="text-gray-500 text-xs">📞 ${_mgPhone}</div>` : ''}
              ${_mgEmail ? `<div class="text-gray-400 text-xs truncate">✉️ ${_mgEmail}</div>` : ''}
              ${extRef ? `<div class="text-gray-300 text-xs font-mono truncate">${extRef}</div>` : ''}
            </div>
          </div>
          <div class="flex flex-col gap-1 flex-shrink-0">
            ${verifyBtn}
            <button class="px-2.5 py-1 bg-orange-50 border border-orange-200 text-orange-600 rounded-lg text-xs hover:bg-orange-500 hover:text-white transition-colors font-medium"
                    data-edit-slot-reg-id="${d.id}" data-edit-slot-current="${posIdx}" title="Editar número da vaga">✏️ Vaga</button>
            <button class="px-2.5 py-1 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-600 hover:text-white transition-colors" data-remove-reg-id="${d.id}">Remover</button>
          </div>`;
        return row;
      };

      // Coletar e filtrar registros antes de ordenar
      const _matchedDocs = [];
      snap.forEach(d=>{
        const r = d.data();
        if (!_validManageStatuses.has(r.status)) return;
        // Aceitar registration se bate com tipo canônico OU com ID bruto do doc adminEvents
        if (evLower || rawIdLower) {
          const rEvL = String(r.eventType||'').toLowerCase();
          const matchCanon = evLower    && rEvL.includes(evLower);
          const matchRaw   = rawIdLower && rEvL.includes(rawIdLower);
          if (!matchCanon && !matchRaw) return;
        }
        const schedStr = String(r.schedule||'');
        const hourStr  = String(r.hour||'');
        const regHH    = normalizeHour(schedStr) || normalizeHour(hourStr);
        if (targetHH && !regHH) return;
        if (targetHH && regHH && targetHH !== regHH) return;
        _matchedDocs.push(d);
      });

      // Ordenar por tempo de chegada (createdAt) — posição sequencial global, igual ao painel bônus
      // Fallback: slotNumber quando createdAt ausente
      _matchedDocs.sort((a, b) => {
        const ra = a.data(), rb = b.data();
        const ta = ra.createdAt?.seconds ?? null;
        const tb = rb.createdAt?.seconds ?? null;
        if (ta !== null && tb !== null) return ta - tb;
        const sa = ra.slot != null ? Number(ra.slot) : (ra.slotNumber != null ? Number(ra.slotNumber) : null);
        const sb = rb.slot != null ? Number(rb.slot) : (rb.slotNumber != null ? Number(rb.slotNumber) : null);
        if (sa !== null && sb !== null) return sa - sb;
        if (sa !== null) return -1;
        if (sb !== null) return 1;
        return 0;
      });

      // Separar confirmados e pendentes antes de numerar — pendentes não ocupam slot
      const _confirmedDocs = _matchedDocs.filter(d => d.data().status !== 'pending');
      const _pendingDocs   = _matchedDocs.filter(d => d.data().status === 'pending');

      // Confirmados recebem posição sequencial real (1, 2, 3...)
      _confirmedDocs.forEach((d, idx) => {
        const r = d.data();
        const isFreeManual = r.freeSlot === true || r.listingType === 'free' || r.origem === 'bonus';
        const row = makeRow(d, r, false, isFreeManual, idx + 1);
        countConfirmed++;
        listConfirmed.appendChild(row);
      });

      // Pendentes aparecem sem número de slot (posIdx = null)
      _pendingDocs.forEach(d => {
        const r = d.data();
        const isFreeManual = r.freeSlot === true || r.listingType === 'free' || r.origem === 'bonus';
        const row = makeRow(d, r, true, isFreeManual, null);
        countPending++;
        if (listPending) listPending.appendChild(row);
      });

      // Atualizar contadores nas abas
      const elCC = document.getElementById('mhCountConfirmed');
      const elCP = document.getElementById('mhCountPending');
      if (elCC) elCC.textContent = countConfirmed;
      if (elCP) elCP.textContent = countPending;

      // Mensagens de vazio
      if (countConfirmed === 0) listConfirmed.innerHTML = '<div class="text-sm text-gray-400 py-6 text-center">Nenhum time confirmado neste horário.</div>';
      if (listPending && countPending === 0) listPending.innerHTML = '<div class="text-sm text-gray-400 py-6 text-center">Nenhum time aguardando pagamento.</div>';

      // Abre na aba com mais relevância: se só há pendentes, abre na aba pendentes
      if (countConfirmed === 0 && countPending > 0) switchManageHourTab('pending');

      // Delegação de eventos para botões "Remover", "✏️ Vaga" e "🔍 Verificar" em ambas as listas
      const handleListClick = async (e) => {
        // ── Editar número da vaga ─────────────────────────────────────
        const editBtn = e.target.closest('[data-edit-slot-reg-id]');
        if (editBtn) {
          const regId    = editBtn.getAttribute('data-edit-slot-reg-id');
          const current  = editBtn.getAttribute('data-edit-slot-current') || '';
          const novoStr  = window.prompt(`Novo número para a vaga (atual: #${current}):`, current);
          if (!novoStr || novoStr.trim() === '') return;
          const novoNum  = parseInt(novoStr.trim(), 10);
          if (isNaN(novoNum) || novoNum < 1) { alert('Número inválido.'); return; }
          try {
            const { doc: _doc, updateDoc: _upd } =
              await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const newDisplay = `Vaga #${novoNum}`;
            await _upd(_doc(window.firebaseDb, 'registrations', regId), {
              slot:        novoNum,
              slotNumber:  novoNum,
              slotDisplay: newDisplay,
            });
            showToast('success', `✅ Vaga atualizada para #${novoNum}`, 'Vaga editada');
            openManageHourModal(date, eventType, hour, rawEventId, evFieldType);
          } catch (err) {
            showToast('error', 'Erro ao editar vaga: ' + (err.message || err), 'Erro');
          }
          return;
        }

        // ── Remover ──────────────────────────────────────────────────
        const removeBtn = e.target.closest('[data-remove-reg-id]');
        if (removeBtn) {
          const id = removeBtn.getAttribute('data-remove-reg-id');
          try{
            await deleteDoc(doc(collection(window.firebaseDb,'registrations'), id));
            removeBtn.closest('.flex')?.remove();
            const inConfirmed = !!removeBtn.closest('#manageHourListConfirmed');
            if (inConfirmed) { countConfirmed--; if (elCC) elCC.textContent = Math.max(0, countConfirmed); }
            else             { countPending--;   if (elCP) elCP.textContent = Math.max(0, countPending);   }
            try{ await loadBoard(); }catch(_){ }
          }catch(_){ alert('Falha ao remover.'); }
          return;
        }

        // ── Verificar Pagamento ───────────────────────────────────────
        const verifyBtn = e.target.closest('[data-verify-reg-id]');
        if (!verifyBtn) return;
        const regId = verifyBtn.getAttribute('data-verify-reg-id');
        const extRef = verifyBtn.getAttribute('data-ext-ref') || '';
        if (!extRef) {
          showToast('warning', 'Esta inscrição não tem external_reference — confirme manualmente no Mercado Pago.', 'Atenção');
          return;
        }

        const origHtml = verifyBtn.innerHTML;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
          const resp = await fetch('/.netlify/functions/check-pix-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ external_reference: extRef })
          });

          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const data = await resp.json();

          if (data.status === 'approved') {
            // Atualizar status no Firestore
            const { doc: _doc, updateDoc: _upd, serverTimestamp: _sts } =
              await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            await _upd(_doc(window.firebaseDb, 'registrations', regId), {
              status: 'paid',
              paidAt: _sts(),
              confirmedByAdmin: true,
              confirmedAt: _sts()
            });
            showToast('success', '✅ Pagamento confirmado! Status atualizado para Pago.', 'Confirmado');
            // Reabrir o modal atualizado
            try{ await loadBoard(); }catch(_){}
            openManageHourModal(date, eventType, hour);
          } else if (data.status === 'pending') {
            showToast('warning', '⏳ Pagamento ainda pendente no Mercado Pago.', 'Pendente');
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = origHtml;
          } else if (data.status === 'rejected') {
            showToast('error', '❌ Pagamento rejeitado pelo Mercado Pago.', 'Rejeitado');
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = origHtml;
          } else {
            showToast('warning', `Status desconhecido: "${data.status}". Verifique no painel do Mercado Pago.`, 'Atenção');
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = origHtml;
          }
        } catch (err) {
          console.error('[Verificar pagamento] Erro:', err);
          showToast('error', 'Erro ao consultar o Mercado Pago: ' + (err.message || err), 'Erro');
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = origHtml;
        }
      };
      listConfirmed.addEventListener('click', handleListClick);
      if (listPending) listPending.addEventListener('click', handleListClick);

      modal.classList.remove('hidden');
    }catch(e){ console.error('openManageHourModal error', e); }
  }

  // Usuários ativos nos últimos 30 dias (baseado em lastLogin em users)
  async function renderActiveUsers(){
    try{
          const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const snap = await getDocs(collection(window.firebaseDb,'users'));
      const thirtyDaysAgo = Date.now() - 30*24*60*60*1000;
      let active = 0; snap.forEach(d=>{ const u=d.data(); if (Number(u.lastLogin||0) >= thirtyDaysAgo) active++; });
          const kpiActiveEl = document.getElementById('kpiActiveUsers');
          if (kpiActiveEl) kpiActiveEl.textContent = String(active);
    }catch(e){  }
  }

  // [removido duplicado]
})();

// ===== Dados estruturados da lista de slots (para notificações) =====
async function buildSlotData(date, eventType, hour) {
  try {
    const hh = String(hour).match(/(\d{1,2})/)?.[1] || '';
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const normalizeHour = s => { const m = String(s || '').match(/(\d{1,2})/); return m ? String(parseInt(m[1], 10)).padStart(2, '0') : null; };
    const evLower = normalize(eventType);
    const snap = await getDocs(query(collection(window.firebaseDb, 'registrations'), where('date', '==', date)));
    const teams = [];
    snap.forEach(doc => {
      const r = doc.data();
      const rType = normalize(r.eventType);
      if (evLower) {
        if (evLower.includes('liga') || evLower.includes('acesso')) {
          if (!(rType.includes('liga') || rType.includes('acesso'))) return;
        } else if (evLower.includes('semanal')) { if (!rType.includes('semanal')) return; }
        else if (evLower.includes('camp')) { if (!rType.includes('camp')) return; }
        else if (evLower.includes('xtreino') || evLower.includes('tokens')) {
          if (!(rType.includes('xtreino') || rType.includes('tokens'))) return;
        } else {
          // evLower é um docId — filtrar por correspondência exata para não misturar eventos
          if (rType !== evLower) return;
        }
      }
      const regHH = normalizeHour(r.schedule) || normalizeHour(r.hour);
      if (regHH !== hh) return;
      const st = String(r.status || '').toLowerCase();
      if (!['paid', 'confirmed', 'lisagem_gratis'].includes(st)) return;
      const slotNum = r.slot != null ? Number(r.slot) : (r.slotNumber != null ? Number(r.slotNumber) : null);
      teams.push({ teamName: r.teamName || r.name || r.email || 'Time', slot: slotNum, createdAt: r.createdAt?.toDate?.() || new Date(0) });
    });
    teams.sort((a, b) => {
      const ta = a.createdAt?.getTime?.() || 0;
      const tb = b.createdAt?.getTime?.() || 0;
      if (ta > 0 && tb > 0) return ta - tb;
      if (a.slot !== null && b.slot !== null) return a.slot - b.slot;
      if (a.slot !== null) return -1;
      if (b.slot !== null) return 1;
      return 0;
    });
    const _evN = normalize(eventType);
    const capacity = (_evN.includes('liga') || _evN.includes('acesso')) ? 15 : 12;
    const slots = [];
    for (let i = 1; i <= capacity; i++) {
      slots.push({ slot: i, teamName: teams[i - 1]?.teamName || '' });
    }
    return { slots, capacity };
  } catch (_) {
    return { slots: [], capacity: 12 };
  }
}

// ===== Exportação de lista por horário =====
async function buildExportList(date, eventType, hour){
  const hh = String(hour).match(/(\d{1,2})/)?.[1] || '';
  const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  const regs = collection(window.firebaseDb,'registrations');
  const snap = await getDocs(query(regs, where('date','==', date)));
  // Normalização robusta do tipo de evento para casar variações (ex.: 'XTREINO MODO LIGA', 'modo-liga', 'modoLiga')
  const normalize = (s)=> String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const evLower = normalize(eventType);
  const normalizeHour = (s)=>{ const m = String(s||'').match(/(\d{1,2})/); return m ? String(parseInt(m[1],10)).padStart(2,'0') : null; };
  const teams = [];
  snap.forEach(d=>{
    const r = d.data();
    // Aplicar filtro por tipo de evento com sinônimos
    const rType = normalize(r.eventType);
    if (evLower){
      if (evLower.includes('liga') || evLower.includes('acesso')) {
        if (!(rType.includes('liga') || rType.includes('acesso'))) return;
      } else if (evLower.includes('semanal')) { if (!rType.includes('semanal')) return; }
      else if (evLower.includes('camp')) { if (!rType.includes('camp')) return; }
      else if (evLower.includes('xtreino') || evLower.includes('tokens')) {
        if (!(rType.includes('xtreino') || rType.includes('tokens'))) return;
      } else {
        // docId ou tipo desconhecido — correspondência exata para não misturar eventos
        if (rType !== evLower) return;
      }
    }
    const regHH = normalizeHour(r.schedule) || normalizeHour(r.hour);
    if (regHH !== hh) return;
    const st = String(r.status||'').toLowerCase();
    if (!['paid','confirmed','lisagem_gratis'].includes(st)) return;
    const name = r.teamName || r.name || r.email || 'Time';
    const slotNum = r.slot != null ? Number(r.slot) : (r.slotNumber != null ? Number(r.slotNumber) : null);
    teams.push({ name, slot: slotNum, createdAt: r.createdAt?.toDate?.() || new Date(0) });
  });
  // Ordenar por createdAt (chegada) — slotNumber como fallback
  teams.sort((a, b) => {
    const ta = a.createdAt?.getTime?.() || 0;
    const tb = b.createdAt?.getTime?.() || 0;
    if (ta > 0 && tb > 0) return ta - tb;
    if (a.slot !== null && b.slot !== null) return a.slot - b.slot;
    if (a.slot !== null) return -1;
    if (b.slot !== null) return 1;
    return 0;
  });
  // Definir capacidade por tipo (modo liga = 15; demais = 12)
  const type = String(eventType||'').toLowerCase();
  const capacity = type.includes('liga') ? 15 : 12;
  const slots = [];
  for (let i=1;i<=capacity;i++){
    const t = teams[i-1]?.name || '';
    slots.push({ idx: i, team: t });
  }
  const dd = date.split('-');
  const dateBr = dd.length===3 ? `${dd[2]}/${dd[1]}` : date;
  const H = hh;
  if (type.includes('semanal')){
    const header = `░𝐒𝐄𝐌𝐀𝐍𝐀𝐋 𝐅𝐑𝐄𝐈𝐓𝐀𝐒//𝟏ª𝐅𝐀𝐒𝐄 ${H}𝐇░`;
    const rules = `\n\n🆔 𝐄 𝐒𝐄𝐍𝐇𝐀 𝟏𝟎 𝐌𝐈𝐍𝐔𝐓𝐎𝐒 𝐀𝐍𝐓𝐄𝐒\n📋𝐑𝐄𝐆𝐑𝐀𝐒 𝐍𝐀 𝐃𝐄𝐒𝐂𝐑𝐈ÇÃ𝐎\n`;
    const lines = slots.map((s,idx)=>{
      const prefix = (idx%2===0) ? '╭⊱💚⊱╮' : '╰⊱💚⊱╯';
      const num = String(s.idx).padStart(2,'0');
      return `${prefix}𝑺𝑳𝑶𝑻 ${num}: ${s.team}`;
    }).join('\n\n');
    const footer = `\n\n|🛡️|𝐂𝐋𝐀𝐒𝐒𝐈𝐅𝐈𝐂𝐀𝐌 𝟒 𝐄𝐐𝐔𝐈𝐏𝐄𝐒 𝐃𝐈𝐑𝐄𝐓𝐎 𝐏𝐑𝐀 𝐅𝐈𝐍𝐀𝐋 𝐇𝐎𝐉𝐄!\n\n𝐁𝐎𝐀 𝐒𝐎𝐑𝐓𝐄 𝐀 𝐓𝐎𝐃𝐎𝐒!`;
    return `${header}\n${rules}\n${lines}\n${footer}`;
  } else if (type.includes('camp')){
    const header = `𝐂𝐀𝐌𝐏𝐄𝐎𝐍𝐀𝐓𝐎 𝐅𝐑𝐄𝐈𝐓𝐀𝐒| 2ª𝐅𝐀𝐒𝐄 ${H}𝐇 \n\n🗓️ 𝐃𝐀𝐓𝐀 : ${dateBr}\n🆔 𝐄 𝐒𝐄𝐍𝐇𝐀 𝟏𝟎 𝐌𝐈𝐍𝐔𝐓𝐎𝐒 𝐀𝐍𝐓𝐄𝐒\n📋𝐑𝐄𝐆𝐑𝐀𝐒 𝐍𝐀 𝐃𝐄𝐒𝐂𝐑𝐈ÇÃ𝐎\n`;
    const lines = slots.map((s,idx)=>{
      const num = String(s.idx).padStart(2,'0');
      if (idx===0) return `╔❤️╗𝑺𝑳𝑶𝑻 ${num}: ${s.team}`;
      if (idx===slots.length-1) return `╚❤️╝𝑺𝑳𝑶𝑻 ${num}: ${s.team}`;
      return `╟❤️╢𝑺𝑳𝑶𝑻 ${num}: ${s.team}`;
    }).join('\n\n');
    const footer = `\n\n🛡️•𝑪𝑳𝑨𝑺𝑺𝑰𝐅𝐈𝐂𝐀𝐌 𝟔 𝑬𝑸𝑼𝐈𝐏𝐄𝐒 𝑷𝑹𝑨 𝑷𝑹𝑶́𝑿𝐈𝐌𝐀 𝑭𝐀𝐒𝐄!\n\n𝐁𝐎𝐀 𝐒𝐎𝐑𝐓𝐄 𝐀 𝐓𝐎𝐃𝐎𝐒!`;
    return `${header}\n${lines}\n${footer}`;
  } else if (type.includes('liga')) {
    // Modo Liga: formato conforme exemplo enviado
    const header = `:::𝑳𝑰𝑺𝑻𝑨 𝑴𝑶𝑫𝑶 𝑳𝑰𝑮𝑨 ⋮ 𝑿𝑻 𝑭𝑹𝑬𝑰𝑻𝑨𝑺 ${H}H:::\n\n\n\n➺🆔 𝑬  𝑺𝑬𝑵𝐇𝑨: 𝟏𝟎 𝑴𝐈𝑵𝑼𝑻𝑶𝑺 𝑨𝑵𝑻𝑬𝑺\n\n➺🏷️𝑹𝑬𝑮𝑹𝑨𝑺 𝑵𝑨 𝑫𝑬𝑺𝑪𝑹𝐈ÇÃ𝐎\n`;
    // Garantir que todos os slots sejam incluídos, mesmo vazios, sem pular linhas
    const lines = slots.map(s=>{
      const letra = String.fromCharCode(64 + s.idx); // A, B, C...
      const teamName = s.team || ''; // Slot vazio fica sem nome, mas linha é criada
      return `   ⃟🩵 ${letra}: ${teamName}`;
    }).filter(line => line.trim()).join('\n\n'); // Filtrar linhas completamente vazias
    const footer = `\n\n「📽️」𝑺𝑻𝑹𝑬𝑨𝑴𝑬𝑹: \n\n「🧑🏻‍🏫」𝑪𝑶𝑨𝑪𝑯:`;
    return `${header}\n${lines}\n\n${footer}`;
  } else {
    // XTreino normal (padrão)
    const header = `:::𝑳𝑰𝑺𝑻𝑨 𝑫𝑬 𝑺𝑳𝑶𝑻 ⋮ 𝑿𝑻 𝑭𝑹𝑬𝑰𝑻𝑨𝑺 ${H}H:::\n\n➺🆔 𝑬  𝑺𝑬𝑵𝐇𝑨: 𝟏𝟎 𝑴𝐈𝑵𝑼𝑻𝑶𝑺 𝑨𝑵𝑻𝑬𝑺\n➺🏷️𝑹𝑬𝑮𝑹𝑨𝑺 𝑵𝑨 𝑫𝑬𝑺𝑪𝑹𝐈ÇÃ𝐎\n`;
    // Garantir que todos os slots sejam incluídos, mesmo vazios, sem pular linhas
    const lines = slots.map(s=>{
      const num = String(s.idx).padStart(2,'0');
      const teamName = s.team || ''; // Slot vazio fica sem nome, mas linha é criada
      return `   ⃟🩵 𝑺𝑳𝑶𝑻 ${num}: ${teamName}`;
    }).filter(line => line.trim()).join('\n\n'); // Filtrar linhas completamente vazias
    const footer = `\n\n「📽️」𝑺𝑻𝑹𝑬𝑨𝑴𝑬𝑹: \n\n「🧑🏻‍🏫」𝑪𝑶𝑨𝑪𝑯:`;
    return `${header}\n\n${lines}\n${footer}`;
  }
}

// Admin logic: Auth gate, roles, Firestore reads, Chart.js rendering

async function ensureFirebase(maxWaitMs = 5000) {
    const start = Date.now();
    while (!window.firebaseReady && Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, 150));
    }
    return !!window.firebaseReady;
}

function currencyBRL(value) {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
async function fetchRole(uid) {
    const { doc, getDoc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    // 1) tentativa direta por docId == uid
    const ref = doc(collection(window.firebaseDb,'users'), uid);
    let snap = await getDoc(ref);
    if (snap.exists()) return { role: (snap.data().role || 'Usuario') };
    // 2) fallback: procurar por campo uid
    try{
        const q = query(collection(window.firebaseDb,'users'), where('uid','==', uid));
        const res = await getDocs(q);
        let found = null;
        res.forEach(d=>{ if (!found) found = d.data(); });
        if (found) return { role: (found.role || 'Usuario') };
    }catch(_){ }
    return { role: 'Usuario' };
}

function can(role, permission) {
    const matrix = {
        admin: ['view_all', 'manage_products', 'edit_content'],
        manager: ['view_all', 'manage_products'],
        editor: ['edit_content'],
        viewer: []
    };
    return (matrix[role?.role] || []).includes(permission);
}

async function loadKPIs() {
    const { collection, query, where, orderBy, limit, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const ordersCol = collection(window.firebaseDb, 'orders');

    

    // Today sales (sum) - apenas pedidos pagos
    const today = new Date();
    today.setHours(0,0,0,0);
    const qToday = query(ordersCol, where('createdAt', '>=', today));
    const todaySnap = await getDocsFromServer(qToday);
    let sumToday = 0;
    todaySnap.forEach(d => {
        const data = d.data();
        const status = (data.status || '').toLowerCase();
        if (status === 'paid' || status === 'approved' || status === 'confirmed') {
            sumToday += Number(data.amount || 0);
        }
    });
    document.getElementById('kpiToday').textContent = currencyBRL(sumToday);
    

    // Month sales - apenas pedidos pagos
    const firstMonth = new Date();
    firstMonth.setDate(1); firstMonth.setHours(0,0,0,0);
    const qMonth = query(ordersCol, where('createdAt', '>=', firstMonth));
    const monthSnap = await getDocsFromServer(qMonth);
    let sumMonth = 0, receivable = 0;
    monthSnap.forEach(d => {
        const data = d.data();
        const val = Number(data.amount || 0);
        const status = (data.status || '').toLowerCase();
        
        // Apenas pedidos pagos para o total do mês
        if (status === 'paid' || status === 'approved' || status === 'confirmed') {
            sumMonth += val;
        }
        
        // Pedidos pendentes para receber
        if (status === 'pending') {
            receivable += val;
        }
    });
    document.getElementById('kpiMonth').textContent = currencyBRL(sumMonth);
    document.getElementById('kpiReceivable').textContent = currencyBRL(receivable);
    
}

async function loadCharts() {
    const { collection, query, orderBy, limit, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const ordersCol = collection(window.firebaseDb, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocsFromServer(q);

    const byDay = new Map();
    const top = new Map();
    snap.forEach(d => {
        const data = d.data();
        const day = (data.createdAt?.toDate ? data.createdAt.toDate() : new Date()).toISOString().slice(0,10);
        byDay.set(day, (byDay.get(day) || 0) + Number(data.amount || 0));
        const name = data.itemName || 'Produto';
        top.set(name, (top.get(name) || 0) + Number(data.amount || 0));
    });

    const labels = Array.from(byDay.keys()).sort();
    const values = labels.map(k => byDay.get(k));

    const topEntries = Array.from(top.entries()).sort((a,b) => b[1]-a[1]).slice(0,5);
    const topLabels = topEntries.map(e => e[0]);
    const topValues = topEntries.map(e => e[1]);

    const salesCtx = document.getElementById('salesChart');
    new Chart(salesCtx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Vendas (R$)', data: values, borderColor: '#4a90e2', backgroundColor: 'rgba(74,144,226,0.15)', tension: 0.3 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    const topCtx = document.getElementById('topProductsChart');
    new Chart(topCtx, {
        type: 'bar',
        data: { labels: topLabels, datasets: [{ label: 'Faturamento', data: topValues, backgroundColor: '#4a90e2' }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// ===== SISTEMA DE FILTROS PARA HORÁRIOS MAIS PROCURADOS =====

// Variável global para armazenar o gráfico
let popularHoursChart = null;

// Lista fixa de tipos de eventos com nomes amigáveis
const EVENTOS_CONHECIDOS = [
    { id: 'xtreino-tokens',   label: 'XTreino Freitas'     },
    { id: 'modo-liga',        label: 'XTreino Modo Liga'   },
    { id: 'semanal-freitas',  label: 'Semanal Freitas'     },
    { id: 'camp-freitas',     label: 'Campeonato Freitas'  },
];

// Popula o select de evento com a lista fixa
function loadEventOptions() {
    const eventFilter = document.getElementById('eventFilter');
    if (!eventFilter) return;
    eventFilter.innerHTML = '<option value="">Todos os eventos</option>';
    EVENTOS_CONHECIDOS.forEach(({ id, label }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        eventFilter.appendChild(option);
    });
}

// Mapeia nome do dia (PT) → código para filtro
const _ptDayMap = {
    'segunda': 'monday', 'terca': 'tuesday', 'terça': 'tuesday',
    'quarta': 'wednesday', 'quinta': 'thursday', 'sexta': 'friday',
    'sabado': 'saturday', 'sábado': 'saturday', 'domingo': 'sunday'
};

// Extrai o horário numérico de um campo schedule (ex: "Segunda - 21h" → "21h")
function extrairHorario(schedule) {
    if (!schedule) return null;
    const m = String(schedule).match(/(\d{1,2})h/i);
    return m ? m[1] + 'h' : null;
}

// Extrai o dia da semana (código EN) do campo schedule (ex: "Segunda - 21h" → "monday")
function extrairDiaDaSchedule(schedule) {
    if (!schedule) return null;
    const parte = String(schedule).split('-')[0].trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos
    return _ptDayMap[parte] || null;
}

// Obtém o código do dia da semana a partir de uma string de data YYYY-MM-DD (fuso Brasília)
function getDayOfWeekFromDateStr(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const [y, mo, d] = dateStr.split('-').map(Number);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    // Usar Date.UTC para evitar conversão de fuso — queremos o dia calendário da data
    return days[new Date(y, mo - 1, d).getDay()];
}

// Função para carregar dados de horários com filtros
async function loadPopularHoursData(dayFilter = '', eventFilter = '') {
    try {
        if (!window.firebaseDb) {
            console.warn('Firebase não inicializado ainda');
            return { labels: [], data: [] };
        }
        
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(collection(window.firebaseDb, 'registrations'));
        
        const hourCounts = new Map();
        
        snap.forEach(doc => {
            const data = doc.data();
            
            // Filtrar por status (apenas confirmados/pagos)
            if (!['paid', 'confirmed', 'approved'].includes(data.status)) return;
            
            // Filtrar por evento se especificado
            if (eventFilter && data.eventType !== eventFilter) return;
            
            // Filtrar por dia da semana:
            // 1ª tentativa: extrair do campo schedule (mais confiável)
            // 2ª tentativa: extrair da data da inscrição
            if (dayFilter) {
                const diaSchedule = extrairDiaDaSchedule(data.schedule);
                const diaDate    = getDayOfWeekFromDateStr(data.date);
                const dia = diaSchedule || diaDate;
                if (dia !== dayFilter) return;
            }
            
            // Extrair apenas o horário numérico (ex: "21h") ignorando o dia embutido
            const horario = extrairHorario(data.schedule || data.hour || '');
            if (!horario) return; // schedule inválido (sem dígito de hora)
            
            hourCounts.set(horario, (hourCounts.get(horario) || 0) + 1);
        });
        
        // Converter para arrays ordenados pelo número da hora
        const entries = Array.from(hourCounts.entries());
        entries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        
        return {
            labels: entries.map(([h]) => h),
            data: entries.map(([, c]) => c)
        };
    } catch (error) {
        console.error('Erro ao carregar dados de horários:', error);
        return { labels: [], data: [] };
    }
}

// Função para renderizar o gráfico de horários mais procurados
async function renderPopularHours() {
    try {
        const dayFilter = document.getElementById('dayFilter')?.value || '';
        const eventFilter = document.getElementById('eventFilter')?.value || '';
        
        const chartData = await loadPopularHoursData(dayFilter, eventFilter);
        const ctx = document.getElementById('popularHoursChart');
        
        if (!ctx) return;
        
        // Destruir gráfico existente se houver
        if (popularHoursChart) {
            popularHoursChart.destroy();
        }
        
        // Criar novo gráfico
        popularHoursChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Demanda',
                    data: chartData.data,
                    backgroundColor: '#4a90e2',
                    borderColor: '#357abd',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2.5,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Demanda: ${context.parsed.y} reservas`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 10
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erro ao renderizar gráfico de horários:', error);
    }
}

// Função para configurar event listeners dos filtros
function setupPopularHoursFilters() {
    const dayFilter = document.getElementById('dayFilter');
    const eventFilter = document.getElementById('eventFilter');
    const resetBtn = document.getElementById('resetFiltersBtn');
    
    if (dayFilter) {
        dayFilter.addEventListener('change', renderPopularHours);
    }
    
    if (eventFilter) {
        eventFilter.addEventListener('change', renderPopularHours);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (dayFilter) dayFilter.value = '';
            if (eventFilter) eventFilter.value = '';
            renderPopularHours();
        });
    }
}
// ===== FIM DO SISTEMA DE FILTROS =====

async function loadTables(canManageProducts) {
    const { collection, query, orderBy, limit, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    // Orders
    const ordersCol = collection(window.firebaseDb, 'orders');
    const qOrders = query(ordersCol, orderBy('createdAt', 'desc'), limit(20));
    const snapOrders = await getDocsFromServer(qOrders);
    const ordersTbody = document.getElementById('ordersTbody');
    if (!ordersTbody) return; // card não existe nesta visão
    ordersTbody.innerHTML = '';
    let count = 0;
    snapOrders.forEach(docu => {
        const o = docu.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="py-2">${docu.id.slice(0,6)}</td>
        <td class="py-2">${o.customerName || '-'}</td>
        <td class="py-2">${o.itemName || '-'}</td>
        <td class="py-2">${currencyBRL(Number(o.amount||0))}</td>
        <td class="py-2">${o.status || '-'}</td>`;
        ordersTbody.appendChild(tr);
        count++;
    });
    const ordersCountEl = document.getElementById('ordersCount');
    if (ordersCountEl) ordersCountEl.textContent = `${count} pedidos`;

    // Products
    const productsTbody = document.getElementById('productsTbody');
    if (productsTbody) {
        const productsCol = collection(window.firebaseDb, 'products');
        const qProd = query(productsCol, orderBy('name'), limit(50));
        const snapProd = await getDocsFromServer(qProd);
        productsTbody.innerHTML = '';
        snapProd.forEach(docu => {
            const p = docu.data();
            const canEdit = canManageProducts;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="py-2">${p.name || '-'}</td>
            <td class="py-2">${currencyBRL(Number(p.price||0))}</td>
            <td class="py-2">${p.type || '-'}</td>
            <td class="py-2 space-x-2">${canEdit ? '<button data-id="'+docu.id+'" class="text-blue-600">Editar</button>' : '<span class="text-gray-400">-</span>'}</td>`;
            productsTbody.appendChild(tr);
        });
    }
}

async function upsertUserProfile(user) {
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    try {
        await setDoc(doc(window.firebaseDb, 'users', user.uid), {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            lastLoginAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('user profile upsert error', e);
    }
}

async function loadUsersAndRoles(currentRole) {
    const roleStr = String(currentRole || '').toLowerCase();
    const canEditRoles = ['ceo', 'gerente'].includes(roleStr); // CEO e Gerente podem editar
    const isCeo = roleStr==='ceo';
    const isGerente = roleStr==='gerente';
    const { collection, getDocsFromServer, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const usersCol = collection(window.firebaseDb, 'users');
    const snapUsers = await getDocsFromServer(usersCol);

    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    snapUsers.forEach(u => {
        const data = u.data();
        const role = (data.role || 'Vendedor');
        const tr = document.createElement('tr');
        // Gerar opções baseado na hierarquia de permissões
        let roleOptions = '';
        if (isCeo) {
            // CEO pode atribuir qualquer cargo
            roleOptions = `
                <option value="Vendedor" ${role==='Vendedor'?'selected':''}>Vendedor</option>
                <option value="Gerente" ${role==='Gerente'?'selected':''}>Gerente</option>
                <option value="Design" ${role==='Design'?'selected':''}>Design</option>
                <option value="Admin" ${role==='Admin'?'selected':''}>Admin</option>
                <option value="Sócio" ${role==='Sócio'?'selected':''}>Sócio</option>
                <option value="Ceo" ${role==='Ceo'?'selected':''}>Ceo</option>
            `;
        } else if (isGerente) {
            // Gerente pode atribuir apenas Vendedor
            roleOptions = `
                <option value="Vendedor" ${role==='Vendedor'?'selected':''}>Vendedor</option>
            `;
        } else {
            // Outros não podem alterar cargo
            roleOptions = `<option value="${role}" selected>${role}</option>`;
        }
        
        const selectHtml = `<select class="border border-gray-300 rounded px-2 py-1" data-uid="${u.id}" ${canEditRoles ? '' : 'disabled'}>
            ${roleOptions}
        </select>`;
        tr.innerHTML = `<td class="py-2">${data.email||'-'}</td>
        <td class="py-2">${u.id}</td>
        <td class="py-2">${selectHtml}</td>
        <td class="py-2">${canEditRoles ? '<button class="text-blue-600" data-save-role="'+u.id+'">Salvar</button>' : '<span class="text-gray-400">-</span>'}</td>`;
        tbody.appendChild(tr);
    });

    if (canEditRoles) {
        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-save-role]');
            if (!btn) return;
            const uid = btn.getAttribute('data-save-role');
            const sel = tbody.querySelector(`select[data-uid="${uid}"]`);
            if (!sel) return;
            try {
                await setDoc(doc(window.firebaseDb, 'users', uid), { role: sel.value }, { merge: true });
                btn.textContent = 'Salvo';
                setTimeout(() => btn.textContent = 'Salvar', 1200);
            } catch (err) {
                alert('Erro ao salvar role');
            }
        }, { once: true });
    }
}

async function main() {
    const ok = await ensureFirebase();
    const gate = document.getElementById('authGate');
    const dash = document.getElementById('dashboard');
    const emailForm = document.getElementById('emailLoginForm');
    const btnLogout = document.getElementById('btnLogout');
    const nameEl = document.getElementById('adminUserName');
    const initialsEl = document.getElementById('adminUserInitials');
    const roleBadge = document.getElementById('roleBadge');

    gate.classList.add('hidden');
    dash.classList.add('hidden');

    if (!ok) {
        gate.classList.remove('hidden');
        return;
    }

    const { onAuthStateChanged, signInWithEmailAndPassword, signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

    if (emailForm && !emailForm.dataset.listenerAttached) {
        emailForm.dataset.listenerAttached = '1';
        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            const errEl = document.getElementById('loginError');
            try {
                await signInWithEmailAndPassword(window.firebaseAuth, email, password);
            } catch (err) {
                if (errEl) { errEl.textContent = 'E-mail ou senha inválidos.'; errEl.classList.remove('hidden'); }
            }
        });
    }

    btnLogout?.addEventListener('click', async () => {
        try { await signOut(window.firebaseAuth); } catch {}
    });

    onAuthStateChanged(window.firebaseAuth, async (user) => {
        if (!user) {
            gate.classList.remove('hidden');
            dash.classList.add('hidden');
            return;
        }
        const userName = user.displayName || user.email || 'Usuário';
        if (nameEl) nameEl.textContent = userName;
        
        // Buscar foto de perfil do Firestore
        let photoURL = user.photoURL || '';
        try {
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const userDoc = await getDoc(doc(window.firebaseDb, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                photoURL = userData.photoURL || userData.photoUrl || photoURL;
            }
        } catch (err) {
            console.error('Erro ao buscar foto de perfil:', err);
        }
        
        // Atualizar avatar do admin (foto ou iniciais)
        const photoEl = document.getElementById('adminUserPhoto');
        if (initialsEl) {
            const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'A';
            initialsEl.textContent = initials;
        }
        
        if (photoEl) {
            if (photoURL) {
                photoEl.src = photoURL;
                photoEl.onload = function() {
                    photoEl.classList.remove('hidden');
                    if (initialsEl) initialsEl.classList.add('hidden');
                };
                photoEl.onerror = function() {
                    photoEl.classList.add('hidden');
                    if (initialsEl) initialsEl.classList.remove('hidden');
                };
                // Verificar se já está carregado
                if (photoEl.complete && photoEl.naturalHeight > 0) {
                    photoEl.classList.remove('hidden');
                    if (initialsEl) initialsEl.classList.add('hidden');
                }
            } else {
                photoEl.classList.add('hidden');
                if (initialsEl) initialsEl.classList.remove('hidden');
            }
        }
        
        let role = { role: 'viewer' };
        try {
            role = await fetchRole(user.uid);
        } catch {}
        roleBadge.textContent = `Permissões: ${role.role || 'viewer'}`;

        // Mostra o dashboard imediatamente, independentemente de erros posteriores
        gate.classList.add('hidden');
        dash.classList.remove('hidden');

        try { await loadKPIs(); } catch (e) { console.error('KPIs error', e); }
        // loadCharts() desabilitado — renderSalesChart() e renderTopProducts() em loadReports() já cobrem os gráficos
        try { await loadTables(can(role, 'manage_products')); } catch (e) { console.error('Tables error', e); }
        try { await upsertUserProfile(user); } catch {}
        try { await loadUsersAndRoles(role); } catch (e) { console.error('Users error', e); }
        try { await loadPendingOrders(); } catch (e) { console.error('Pending orders error', e); }
        // try { await loadConfirmedOrders(); } catch (e) { console.error('Confirmed orders error', e); } // Desabilitado - usando nova função com paginação
    });
}

// Função para carregar pedidos confirmados
async function loadConfirmedOrders() {
    try {
        const { collection, getDocs, query, where, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // Buscar pedidos com status 'paid' ou 'approved' - sem orderBy para evitar erro de índice
        const ordersRef = collection(window.firebaseDb, 'orders');
        const q = query(
            ordersRef,
            where('status', 'in', ['paid', 'approved', 'confirmed']),
            limit(50)
        );
        
        const snapshot = await getDocs(q);
        const confirmedTbody = document.getElementById('confirmedTbody');
        const confirmedCount = document.getElementById('confirmedCount');
        
        if (confirmedTbody) {
            confirmedTbody.innerHTML = '';
            
            if (snapshot.empty) {
                confirmedTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Nenhum pedido confirmado encontrado</td></tr>';
            } else {
                // Ordenar manualmente por data
                const orders = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    orders.push({ id: doc.id, ...data });
                });
                
                orders.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
                
                // Função auxiliar para obter nome do item/evento
                const getItemName = (order) => {
                  // Se tiver eventType, mapear para nome legível
                  if (order.eventType) {
                    const eventMap = {
                      'modo-liga': 'Modo Liga',
                      'xtreino-tokens': 'XTreino Tokens',
                      'xtreino': 'XTreino Tokens',
                      'semanal-freitas': 'Semanal Freitas',
                      'semanal': 'Semanal Freitas',
                      'camp-freitas': 'Camp Freitas',
                      'camp': 'Camp Freitas'
                    };
                    return eventMap[order.eventType.toLowerCase()] || order.eventType;
                  }
                  // Tentar outros campos
                  return order.title || order.item || order.productName || 'Item não informado';
                };
                
                orders.forEach(order => {
                    const row = document.createElement('tr');
                    const nameDisplay = order.customerName || order.name || order.customer || '-';
                    const contactDisplay = order.phone || order.contact || '-';
                    const teamDisplay = order.teamName || order.team || '-';
                    const emailDisplay = order.buyerEmail || order.customer || '-';
                    row.innerHTML = `
                        <td class="py-2 text-sm"><strong>${nameDisplay}</strong></td>
                        <td class="py-2 text-sm">${contactDisplay}</td>
                        <td class="py-2 text-sm">${teamDisplay}</td>
                        <td class="py-2 text-sm">${emailDisplay}</td>
                        <td class="py-2 text-sm">${getItemName(order)}</td>
                    `;
                    confirmedTbody.appendChild(row);
                });
            }
        }
        
        if (confirmedCount) {
            confirmedCount.textContent = `${snapshot.size} pedidos`;
        }
        
    } catch (error) {
        console.error('Erro ao carregar pedidos confirmados:', error);
    }
}

// Função para carregar pedidos pendentes
async function loadPendingOrders() {
    try {
        const { collection, getDocs, query, where, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // Buscar pedidos com status 'pending' - sem orderBy para evitar erro de índice
        const ordersRef = collection(window.firebaseDb, 'orders');
        const q = query(
            ordersRef,
            where('status', '==', 'pending'),
            limit(50)
        );
        
        const snapshot = await getDocs(q);
        const pendingTbody = document.getElementById('pendingTbody');
        const pendingCount = document.getElementById('pendingCount');
        
        if (pendingTbody) {
            pendingTbody.innerHTML = '';
            
            if (snapshot.empty) {
                pendingTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Nenhum pedido pendente encontrado</td></tr>';
            } else {
                // Ordenar manualmente por data
                const orders = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    orders.push({ id: doc.id, ...data });
                });
                
                orders.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
                
                // Função auxiliar para obter nome do item/evento
                const getItemName = (order) => {
                  // Se tiver eventType, mapear para nome legível
                  if (order.eventType) {
                    const eventMap = {
                      'modo-liga': 'Modo Liga',
                      'xtreino-tokens': 'XTreino Tokens',
                      'xtreino': 'XTreino Tokens',
                      'semanal-freitas': 'Semanal Freitas',
                      'semanal': 'Semanal Freitas',
                      'camp-freitas': 'Camp Freitas',
                      'camp': 'Camp Freitas'
                    };
                    return eventMap[order.eventType.toLowerCase()] || order.eventType;
                  }
                  // Tentar outros campos
                  return order.title || order.item || order.productName || 'Item não informado';
                };
                
                orders.forEach(order => {
                    const row = document.createElement('tr');
                    const nameDisplay = order.customerName || order.name || order.customer || '-';
                    const contactDisplay = order.phone || order.contact || '-';
                    const teamDisplay = order.teamName || order.team || '-';
                    const emailDisplay = order.buyerEmail || order.customer || '-';
                    row.innerHTML = `
                        <td class="py-2 text-sm"><strong>${nameDisplay}</strong></td>
                        <td class="py-2 text-sm">${contactDisplay}</td>
                        <td class="py-2 text-sm">${teamDisplay}</td>
                        <td class="py-2 text-sm">${emailDisplay}</td>
                        <td class="py-2 text-sm">${getItemName(order)}</td>
                        <td class="py-2 text-sm">
                            <button onclick="approveOrder('${order.id}')" class="text-green-600 hover:text-green-800 text-xs">Aprovar</button>
                        </td>
                    `;
                    pendingTbody.appendChild(row);
                });
            }
        }
        
        if (pendingCount) {
            pendingCount.textContent = `${snapshot.size} pedidos`;
        }
        
    } catch (error) {
        console.error('Erro ao carregar pedidos pendentes:', error);
    }
}

// Função para aprovar pedido
async function approveOrder(orderId) {
    try {
        const { doc, getDoc, updateDoc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const orderRef = doc(window.firebaseDb, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        const orderData = orderSnap.exists() ? orderSnap.data() : {};

        // Montar patch base
        const patch = { status: 'approved', approvedAt: Date.now() };

        // Se for Passe Booyah/Elite, marcar como enviado automaticamente
        const titleLow = (orderData.title || orderData.item || '').toLowerCase();
        const pidLow = (orderData.productId || '').toLowerCase();
        if (titleLow.includes('passe') || titleLow.includes('booyah') || titleLow.includes('elite') || pidLow.includes('passe') || pidLow.includes('booyah')) {
            patch.booyahConfirmed = true;
            patch.booyahConfirmedAt = new Date();
        }

        await updateDoc(orderRef, patch);

        // Atualizar também registrations com o mesmo external_reference (eventos)
        if (orderData.external_reference) {
            try {
                const regsRef = collection(window.firebaseDb, 'registrations');
                const regsSnap = await getDocs(query(regsRef, where('external_reference', '==', orderData.external_reference)));
                const { writeBatch } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                const batch = writeBatch(window.firebaseDb);
                regsSnap.forEach(d => batch.update(d.ref, { status: 'approved', approvedAt: Date.now() }));
                if (!regsSnap.empty) await batch.commit();
            } catch (_) {}
        }

        alert('Pedido aprovado com sucesso!');
        await loadPendingOrders();
        await loadConfirmedOrders();
    } catch (error) {
        console.error('Erro ao aprovar pedido:', error);
        alert('Erro ao aprovar pedido');
    }
}
// Função para dar tokens a um usuário
async function giveTokensToUser(userEmail, tokenAmount) {
    try {
        const { collection, getDocs, query, where, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // Buscar usuário por email
        const usersRef = collection(window.firebaseDb, 'users');
        const q = query(usersRef, where('email', '==', userEmail));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            alert('Usuário não encontrado com este email');
            return;
        }
        
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        const currentTokens = userData.tokens || 0;
        const newTokens = currentTokens + tokenAmount;
        
        // Atualizar tokens do usuário
        await updateDoc(doc(window.firebaseDb, 'users', userDoc.id), {
            tokens: newTokens
        });
        
        alert(`✅ ${tokenAmount} token(s) adicionado(s) ao usuário ${userEmail}. Novo saldo: ${newTokens} tokens`);
        
    } catch (error) {
        console.error('Erro ao dar tokens:', error);
        alert('Erro ao dar tokens ao usuário');
    }
}


// ===== GERENCIAMENTO DE DESTAQUES =====

let highlightsData = {};
let highlightCounter = 1;

// ===== GERENCIAMENTO DE NOTÍCIAS =====

let newsData = {};
let newsCounter = 1;

// Carregar destaques do Firestore
async function loadHighlights() {
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const highlightsRef = collection(window.firebaseDb, 'highlights');
        const snapshot = await getDocs(highlightsRef);
        
        highlightsData = {};
        snapshot.forEach(doc => {
            highlightsData[doc.id] = doc.data();
        });
        
        // Se não existem destaques, criar os padrão
        if (Object.keys(highlightsData).length === 0) {
            highlightsData = {
                highlight1: {
                    title: 'Modo Liga - Estratégia',
                    subtitle: 'Treinos competitivos',
                    description: 'Treinos competitivos com pontuação e ranking.',
                    image: '',
                    action: "openPurchaseModal('estrategia')",
                    hasRedirect: false,
                    redirectUrl: ''
                },
                highlight2: {
                    title: 'Campeonato Semanal',
                    subtitle: 'Etapas semanais',
                    description: 'Etapas semanais com premiações.',
                    image: '',
                    action: "openPurchaseModal('planilhas')",
                    hasRedirect: false,
                    redirectUrl: ''
                },
                highlight3: {
                    title: 'Camp de Fases',
                    subtitle: 'Eliminatórias',
                    description: 'Eliminatórias com melhores confrontos.',
                    image: '',
                    action: "openPurchaseModal('camp-fases')",
                    hasRedirect: false,
                    redirectUrl: ''
                }
            };
            
            // Salvar destaques padrão
            const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            for (const [id, data] of Object.entries(highlightsData)) {
                await setDoc(doc(window.firebaseDb, 'highlights', id), data);
            }
        }
        
        // Atualizar preview
        updateHighlightsPreview(highlightsData);
        
        return highlightsData;
    } catch (error) {
        console.error('Erro ao carregar destaques:', error);
        return {};
    }
}

// Atualizar preview dos destaques
function updateHighlightsPreview(highlights) {
    const preview = document.getElementById('highlightsPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    Object.keys(highlights).forEach((key, index) => {
        const highlight = highlights[key];
        if (highlight) {
            const div = document.createElement('div');
            div.className = 'border border-gray-200 rounded-lg p-3';
            div.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-sm">Destaque ${index + 1}</h4>
                    <span class="text-xs text-gray-500">${highlight.title}</span>
                </div>
                <p class="text-xs text-gray-600 mb-1">${highlight.subtitle}</p>
                <p class="text-xs text-gray-500">${highlight.description}</p>
                ${highlight.hasRedirect ? `<p class="text-xs text-blue-600 mt-1"><i class="fas fa-link mr-1"></i>Redireciona para: ${highlight.redirectUrl}</p>` : ''}
            `;
            preview.appendChild(div);
        }
    });
}

// Abrir modal de edição
function openHighlightsModal() {
    const modal = document.getElementById('modalHighlights');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Carregar dados atuais e renderizar formulários
    loadHighlights().then(() => {
        renderHighlightsForm();
    });
}

// Renderizar formulário de destaques
function renderHighlightsForm() {
    const container = document.getElementById('highlightsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.keys(highlightsData).forEach((key, index) => {
        const highlight = highlightsData[key];
        const highlightDiv = createHighlightForm(key, highlight, index + 1);
        container.appendChild(highlightDiv);
    });
}

// Criar formulário para um destaque
function createHighlightForm(key, highlight, index) {
    const div = document.createElement('div');
    div.className = 'border border-gray-200 rounded-lg p-4';
    div.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h4 class="font-semibold text-lg">Destaque ${index}</h4>
            <button onclick="removeHighlight('${key}')" class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                <i class="fas fa-trash mr-1"></i>Remover
            </button>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium mb-2">Título</label>
                <input id="${key}Title" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Ex: Modo Liga - Estratégia" value="${highlight.title || ''}">
            </div>
            <div>
                <label class="block text-sm font-medium mb-2">Subtítulo</label>
                <input id="${key}Subtitle" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Ex: Treinos competitivos" value="${highlight.subtitle || ''}">
            </div>
            <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-2">Descrição</label>
                <textarea id="${key}Description" class="w-full border border-gray-300 rounded-lg px-3 py-2" rows="2" placeholder="Ex: Treinos competitivos com pontuação e ranking.">${highlight.description || ''}</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium mb-2">URL da Imagem</label>
                <input id="${key}Image" type="url" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="https://exemplo.com/imagem.jpg" value="${highlight.image || ''}">
            </div>
            <div>
                <label class="block text-sm font-medium mb-2">Ação do Botão</label>
                <select id="${key}Action" class="w-full border border-gray-300 rounded-lg px-3 py-2" onchange="toggleCustomLinkField('${key}')">
                    <option value="openPurchaseModal('estrategia')" ${highlight.action === "openPurchaseModal('estrategia')" ? 'selected' : ''}>Abrir Modal de Compra</option>
                    <option value="buy_tokens" ${highlight.action === 'buy_tokens' ? 'selected' : ''}>Abrir Modal de Tokens</option>
                    <option value="scrollToSection('xtreinos')" ${highlight.action === "scrollToSection('xtreinos')" ? 'selected' : ''}>Ir para XTreinos</option>
                    <option value="scrollToSection('loja')" ${highlight.action === "scrollToSection('loja')" ? 'selected' : ''}>Ir para Loja</option>
                    <option value="openScheduleModal('modo-liga')" ${highlight.action === "openScheduleModal('modo-liga')" ? 'selected' : ''}>Abrir Agendamento</option>
                    <option value="openScheduleModal('semanal-freitas')" ${highlight.action === "openScheduleModal('semanal-freitas')" ? 'selected' : ''}>Abrir Agendamento Semanal</option>
                    <option value="openScheduleModal('camp-freitas')" ${highlight.action === "openScheduleModal('camp-freitas')" ? 'selected' : ''}>Abrir Agendamento Camp</option>
                    <option value="custom_link" ${highlight.action === "custom_link" ? 'selected' : ''}>Ir para Link</option>
                </select>
            </div>
            <div id="${key}CustomLinkField" class="mt-3 ${highlight.action === 'custom_link' ? '' : 'hidden'}">
                <label class="block text-sm font-medium mb-2">URL do Link</label>
                <input id="${key}CustomLinkUrl" type="url" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="https://exemplo.com" value="${highlight.customLinkUrl || ''}">
            </div>
            <div class="md:col-span-2">
                <div class="flex items-center gap-3">
                    <label class="flex items-center">
                        <input id="${key}HasRedirect" type="checkbox" class="mr-2" ${highlight.hasRedirect ? 'checked' : ''} onchange="toggleRedirectField('${key}')">
                        <span class="text-sm font-medium">Imagem com link de redirecionamento</span>
                    </label>
                </div>
                <div id="${key}RedirectField" class="mt-3 ${highlight.hasRedirect ? '' : 'hidden'}">
                    <label class="block text-sm font-medium mb-2">URL de Redirecionamento</label>
                    <input id="${key}RedirectUrl" type="url" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="https://exemplo.com" value="${highlight.redirectUrl || ''}">
                </div>
            </div>
        </div>
    `;
    return div;
}

// Fechar modal
function closeHighlightsModal() {
    const modal = document.getElementById('modalHighlights');
    if (modal) modal.classList.add('hidden');
}

// Adicionar novo destaque
function addHighlight() {
    const newKey = `highlight${Date.now()}`;
    const newHighlight = {
        title: '',
        subtitle: '',
        description: '',
        image: '',
        action: "openPurchaseModal('estrategia')",
        hasRedirect: false,
        redirectUrl: ''
    };
    
    highlightsData[newKey] = newHighlight;
    renderHighlightsForm();
}

// Remover destaque
function removeHighlight(key) {
    if (Object.keys(highlightsData).length <= 1) {
        alert('❌ Deve haver pelo menos um destaque!');
        return;
    }
    
    if (confirm('Tem certeza que deseja remover este destaque?')) {
        delete highlightsData[key];
        renderHighlightsForm();
    }
}

// Toggle campo de redirecionamento
function toggleRedirectField(key) {
    const checkbox = document.getElementById(`${key}HasRedirect`);
    const field = document.getElementById(`${key}RedirectField`);
    
    if (checkbox.checked) {
        field.classList.remove('hidden');
    } else {
        field.classList.add('hidden');
    }
}

// Toggle campo de link personalizado
function toggleCustomLinkField(key) {
    const select = document.getElementById(`${key}Action`);
    const field = document.getElementById(`${key}CustomLinkField`);
    
    if (select.value === 'custom_link') {
        field.classList.remove('hidden');
    } else {
        field.classList.add('hidden');
    }
}

// Salvar destaques
async function saveHighlights() {
    try {
        // Coletar dados dos formulários
        const highlights = {};
        
        Object.keys(highlightsData).forEach(key => {
            const title = document.getElementById(`${key}Title`)?.value.trim();
            const subtitle = document.getElementById(`${key}Subtitle`)?.value.trim();
            const description = document.getElementById(`${key}Description`)?.value.trim();
            const image = document.getElementById(`${key}Image`)?.value.trim();
            const action = document.getElementById(`${key}Action`)?.value;
            const hasRedirect = document.getElementById(`${key}HasRedirect`)?.checked || false;
            const redirectUrl = document.getElementById(`${key}RedirectUrl`)?.value.trim() || '';
            const customLinkUrl = document.getElementById(`${key}CustomLinkUrl`)?.value.trim() || '';
            
            if (title) { // Só salvar se tiver título
                highlights[key] = {
                    title,
                    subtitle,
                    description,
                    image,
                    action,
                    hasRedirect,
                    redirectUrl,
                    customLinkUrl,
                    updatedAt: new Date().toISOString()
                };
            }
        });
        
        // Limpar coleção atual
        const { collection, getDocs, deleteDoc, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const highlightsRef = collection(window.firebaseDb, 'highlights');
        const snapshot = await getDocs(highlightsRef);
        snapshot.forEach(doc => {
            deleteDoc(doc.ref);
        });
        
        // Salvar novos destaques
        for (const [id, data] of Object.entries(highlights)) {
            await setDoc(doc(window.firebaseDb, 'highlights', id), data);
        }
        
        // Atualizar dados locais
        highlightsData = highlights;
        
        // Atualizar preview
        updateHighlightsPreview(highlights);
        
        // Fechar modal
        closeHighlightsModal();
        
        alert('✅ Destaques salvos com sucesso!');
        
    } catch (error) {
        console.error('Erro ao salvar destaques:', error);
        alert('❌ Erro ao salvar destaques');
    }
}
// Tornar funções globais
window.approveOrder = approveOrder;
window.openHighlightsModal = openHighlightsModal;
window.closeHighlightsModal = closeHighlightsModal;
window.saveHighlights = saveHighlights;
window.addHighlight = addHighlight;
window.removeHighlight = removeHighlight;
window.toggleRedirectField = toggleRedirectField;
window.toggleCustomLinkField = toggleCustomLinkField;

// ===== FUNÇÕES DE NOTÍCIAS =====

// Carregar notícias do Firestore
async function loadNews() {
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const newsRef = collection(window.firebaseDb, 'news');
        const snapshot = await getDocs(newsRef);
        
        newsData = {};
        snapshot.forEach(doc => {
            newsData[doc.id] = doc.data();
        });
        
        // Se não existem notícias, criar as padrão
        if (Object.keys(newsData).length === 0) {
            newsData = {
                news1: {
                    title: 'Evento: Treinos Modo Liga Especial',
                    content: 'Vagas limitadas às 19h e 21h. Garanta sua inscrição.',
                    image: '',
                    date: new Date().toISOString(),
                    author: 'Equipe XTreino'
                },
                news2: {
                    title: 'Pausa em feriado',
                    content: 'Sem atividades nos dias 24 e 25. Retorno do semanal na semana seguinte.',
                    image: '',
                    date: new Date().toISOString(),
                    author: 'Equipe XTreino'
                },
                news3: {
                    title: 'Convidado verificado no próximo camp',
                    content: 'Participação especial em nosso campeonato de fases.',
                    image: '',
                    date: new Date().toISOString(),
                    author: 'Equipe XTreino'
                }
            };
            
            // Salvar notícias padrão
            const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            for (const [id, data] of Object.entries(newsData)) {
                await setDoc(doc(window.firebaseDb, 'news', id), data);
            }
        }
        
        // Atualizar preview
        updateNewsPreview(newsData);
        
        return newsData;
    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        return {};
    }
}

// Atualizar preview das notícias
function updateNewsPreview(news) {
    const preview = document.getElementById('newsPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    Object.keys(news).forEach((key, index) => {
        const newsItem = news[key];
        if (newsItem) {
            const div = document.createElement('div');
            div.className = 'border border-gray-200 rounded-lg p-3';
            div.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-sm">Notícia ${index + 1}</h4>
                    <span class="text-xs text-gray-500">${newsItem.title}</span>
                </div>
                <p class="text-xs text-gray-600 mb-1">${newsItem.content}</p>
                <p class="text-xs text-gray-500">Por: ${newsItem.author}</p>
            `;
            preview.appendChild(div);
        }
    });
}

// Abrir modal de edição de notícias
function openNewsModal() {
    const modal = document.getElementById('modalNews');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Carregar dados atuais e renderizar formulários
    loadNews().then(() => {
        renderNewsForm();
    });
}

// Renderizar formulário de notícias
function renderNewsForm() {
    const container = document.getElementById('newsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.keys(newsData).forEach((key, index) => {
        const newsItem = newsData[key];
        const newsDiv = createNewsForm(key, newsItem, index + 1);
        container.appendChild(newsDiv);
    });
}

// Criar formulário para uma notícia
function createNewsForm(key, newsItem, index) {
    const div = document.createElement('div');
    div.className = 'border border-gray-200 rounded-lg p-4';
    div.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h4 class="font-semibold text-lg">Notícia ${index}</h4>
            <button onclick="removeNews('${key}')" class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                <i class="fas fa-trash mr-1"></i>Remover
            </button>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium mb-2">Título</label>
                <input id="${key}Title" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Ex: Novo Sistema de Tokens" value="${newsItem.title || ''}">
            </div>
            <div>
                <label class="block text-sm font-medium mb-2">Autor</label>
                <input id="${key}Author" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Ex: Equipe XTreino" value="${newsItem.author || ''}">
            </div>
            <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-2">Conteúdo</label>
                <textarea id="${key}Content" class="w-full border border-gray-300 rounded-lg px-3 py-2" rows="3" placeholder="Ex: Agora você pode comprar tokens e usar para participar dos XTreinos!">${newsItem.content || ''}</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium mb-2">URL da Imagem</label>
                <input id="${key}Image" type="url" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="https://exemplo.com/imagem.jpg" value="${newsItem.image || ''}">
            </div>
            <div>
                <label class="block text-sm font-medium mb-2">Data</label>
                <input id="${key}Date" type="datetime-local" class="w-full border border-gray-300 rounded-lg px-3 py-2" value="${newsItem.date ? new Date(newsItem.date).toISOString().slice(0, 16) : ''}">
            </div>
        </div>
    `;
    return div;
}

// Fechar modal de notícias
function closeNewsModal() {
    const modal = document.getElementById('modalNews');
    if (modal) modal.classList.add('hidden');
}

// Adicionar nova notícia
function addNews() {
    const newKey = `news${Date.now()}`;
    const newNews = {
        title: '',
        content: '',
        image: '',
        date: new Date().toISOString(),
        author: 'Equipe XTreino'
    };
    
    newsData[newKey] = newNews;
    renderNewsForm();
}

// Remover notícia
function removeNews(key) {
    if (Object.keys(newsData).length <= 1) {
        alert('❌ Deve haver pelo menos uma notícia!');
        return;
    }
    
    if (confirm('Tem certeza que deseja remover esta notícia?')) {
        delete newsData[key];
        renderNewsForm();
    }
}

// Salvar notícias
async function saveNews() {
    try {
        // Coletar dados dos formulários
        const news = {};
        
        Object.keys(newsData).forEach(key => {
            const title = document.getElementById(`${key}Title`)?.value.trim();
            const content = document.getElementById(`${key}Content`)?.value.trim();
            const image = document.getElementById(`${key}Image`)?.value.trim();
            const author = document.getElementById(`${key}Author`)?.value.trim();
            const date = document.getElementById(`${key}Date`)?.value;
            
            if (title && content) { // Só salvar se tiver título e conteúdo
                news[key] = {
                    title,
                    content,
                    image,
                    author: author || 'Equipe XTreino',
                    date: date ? new Date(date).toISOString() : new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
        });
        
        // Limpar coleção atual
        const { collection, getDocs, deleteDoc, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const newsRef = collection(window.firebaseDb, 'news');
        const snapshot = await getDocs(newsRef);
        snapshot.forEach(doc => {
            deleteDoc(doc.ref);
        });
        
        // Salvar novas notícias
        for (const [id, data] of Object.entries(news)) {
            await setDoc(doc(window.firebaseDb, 'news', id), data);
        }
        
        // Atualizar dados locais
        newsData = news;
        
        // Atualizar preview
        updateNewsPreview(news);
        
        // Fechar modal
        closeNewsModal();
        
        alert('✅ Notícias salvas com sucesso!');
        
    } catch (error) {
        console.error('Erro ao salvar notícias:', error);
        alert('❌ Erro ao salvar notícias');
    }
}

// Tornar funções globais
window.openNewsModal = openNewsModal;
window.closeNewsModal = closeNewsModal;
window.saveNews = saveNews;
window.addNews = addNews;
window.removeNews = removeNews;

// Carregar destaques quando o admin estiver pronto
window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.firebaseDb && document.getElementById('highlightsPreview')) {
            loadHighlights();
        }
        if (window.firebaseDb && document.getElementById('newsPreview')) {
            loadNews();
        }
    }, 2000);
});

  // Security: Enhanced authentication system
  async function initAuth() {
    // Check for existing session
    const savedSession = sessionStorage.getItem('adminSession');
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        const SESSION_TIMEOUT_LOCAL = 30 * 60 * 1000; // 30 minutes
        if (Date.now() - sessionData.timestamp < SESSION_TIMEOUT_LOCAL) {
          // Session still valid, check with Firebase
          const user = window.firebaseAuth?.currentUser;
          if (user && await isAuthorizedAdmin(user)) {
            // Buscar role do Firestore, não usar user.role que pode não existir
            try {
              const { doc, getDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
              const userRef = doc(collection(window.firebaseDb, 'users'), user.uid);
              const userSnap = await getDoc(userRef);
              const userRole = userSnap.exists() ? (userSnap.data().role || 'admin') : 'admin';
              showDashboard(userRole);
            } catch (err) {
              console.error('Erro ao buscar role:', err);
              showDashboard('admin');
            }
            return;
          }
        }
      } catch (error) {
        console.error('Session validation error:', error);
      }
      // Clear invalid session
      sessionStorage.removeItem('adminSession');
    }

    // Show login form
    showAuthGate();
  }

  // Security: Enhanced login handler
  async function handleLogin(email, password) {
    try {
      
      const { signInWithEmailAndPassword: signIn, signOut: signOutFn } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const { doc: docRef, getDoc: getDocFn } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            
      const userCredential = await signIn(window.firebaseAuth, email, password);
      const user = userCredential.user;     

      // Check if user is authorized
      if (!user || !user.email) {
        await signOutFn(window.firebaseAuth);
        showLoginError('Erro ao fazer login.');
        return;
      }

      const userDoc = await getDocFn(docRef(window.firebaseDb, 'users', user.uid));     
      
      if (!userDoc.exists()) {              
        // Criar documento do usuário automaticamente
        const { setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const userData = {
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          role: 'socio', // Definir como socio por padrão
          createdAt: new Date(),
          lastLogin: Date.now()
        };
        
        await setDoc(docRef(window.firebaseDb, 'users', user.uid), userData);       
        
        // Agora tentar novamente
        const newUserDoc = await getDocFn(docRef(window.firebaseDb, 'users', user.uid));
        if (!newUserDoc.exists()) {
          await signOutFn(window.firebaseAuth);
          showLoginError('Erro ao criar documento do usuário.');
          return;
        }
        
        const newUserData = newUserDoc.data();
        const role = (newUserData.role || '').toLowerCase().trim();        
        
        // Continuar com o processo de login
        const authorizedRoles = ['admin', 'ceo', 'gerente', 'vendedor', 'design', 'designer', 'desgin',
                                 'socio', 'sócio', 'staff', 'moderador', 'operador', 'suporte'];
        const isAuthorized = authorizedRoles.includes(role);
        
        if (!isAuthorized) {
          await signOutFn(window.firebaseAuth);
          showLoginError('Acesso negado. Você não tem permissão para acessar o painel administrativo.');
          return;
        }
        
        // Todos os cargos autorizados acedem ao dashboard
        const sessionData = {
          uid: user.uid,
          email: user.email,
          role: role,
          timestamp: Date.now()
        };
        sessionStorage.setItem('adminSession', JSON.stringify(sessionData));

        const authGate = document.getElementById('authGate');
        const dashboard = document.getElementById('dashboard');
        if (authGate && dashboard) {
          authGate.classList.add('hidden');
          // Aplicar permissões ANTES de exibir — evita flash de conteúdo não autorizado
          if (typeof controlSectionVisibility === 'function') {
            window.visibilityApplied = false;
            controlSectionVisibility((role||'').toLowerCase().trim());
          }
          dashboard.classList.remove('hidden');
          setTimeout(() => {
            if (typeof setView === 'function') setView(role);
            if (typeof startSessionTimer === 'function') startSessionTimer();
          }, 100);
        }
        return;
      }
      
      const userData = userDoc.data();
      const role = (userData.role || '').toLowerCase();
      
      // Limpar espaços em branco e caracteres especiais do cargo
      const cleanRole = role.trim();     
      
      // Check if role is authorized (including variations and typos)
      const authorizedRoles = ['admin', 'ceo', 'gerente', 'vendedor', 'design', 'designer', 'desgin',
                               'socio', 'sócio', 'staff', 'moderador', 'operador', 'suporte'];
      const isAuthorized = authorizedRoles.includes(cleanRole);
            
      if (!isAuthorized) {        
        await signOutFn(window.firebaseAuth);
        showLoginError('Acesso negado. Você não tem permissão para acessar o painel administrativo.');
        return;
      }      
    
      // Gerente/design/socio/ceo não precisam estar na whitelist - apenas precisam ter o role correto
      if (['admin', 'vendedor'].includes(cleanRole)) {
        
        const ADMIN_EMAILS = [
          'cleitondouglass@gmail.com',
          'cleitondouglass123@hotmail.com',
          'gilmariofreitas378@gmail.com',
          'gilmariofreitas387@gmail.com',
          'flavetyr@gmail.com',
          'admin@xtreino.dev'
        ];                
        
        if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
          
          await signOutFn(window.firebaseAuth);
          showLoginError('Acesso negado. Email não autorizado para administração.');
          return;
        }               
      } 

      const sessionData = {
        uid: user.uid,
        email: user.email,
        role: cleanRole,
        timestamp: Date.now()
      };
      sessionStorage.setItem('adminSession', JSON.stringify(sessionData));     

      // Show dashboard      
      if (typeof showDashboard === 'function') {        
        showDashboard(role);
      } else {
        
        // Fallback: mostrar dashboard manualmente
        const authGate = document.getElementById('authGate');
        const dashboard = document.getElementById('dashboard');       
        
        if (authGate && dashboard) {
          authGate.classList.add('hidden');
          // Aplicar permissões ANTES de exibir — evita flash de conteúdo não autorizado
          if (typeof controlSectionVisibility === 'function') {
            window.visibilityApplied = false;
            controlSectionVisibility(cleanRole);
          }
          dashboard.classList.remove('hidden');          
          
          if (typeof setView === 'function') {
            setView(cleanRole);
          }
          if (typeof startSessionTimer === 'function') {
            startSessionTimer();
          }
        } else {
          console.error('❌ Elementos authGate ou dashboard não encontrados');
        }
      }
      
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Erro ao fazer login.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
      }

      showLoginError(errorMessage);
    }
  }

  // Security: Setup event listeners
  function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('emailLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        
        if (!email || !password) {
          showLoginError('Por favor, preencha todos os campos.');
          return;
        }
        
        await handleLogin(email, password);
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }

    // Reset session timer on user activity
    document.addEventListener('click', resetSessionTimer);
    document.addEventListener('keypress', resetSessionTimer);
    document.addEventListener('scroll', resetSessionTimer);
  }

  // Session timer fallbacks (no-op to avoid runtime errors)
  function startSessionTimer() {}
  function resetSessionTimer() {}

  // Auth gate helper (fallback)
  function showAuthGate() {
    try {
      const authGate = document.getElementById('authGate');
      const dashboard = document.getElementById('dashboard');
      if (authGate) authGate.classList.remove('hidden');
      if (dashboard) dashboard.classList.add('hidden');
    } catch(_) { /* noop */ }
  }

  // Basic login error renderer (fallback-safe)
  function showLoginError(message) {
    try {
      const box = document.getElementById('loginError');
      if (box) {
        box.textContent = message || 'Erro ao fazer login';
        box.classList.remove('hidden');
      } else {
        console.error('Login error:', message);
      }
    } catch (e) {
      console.error('Login error (fallback):', message, e);
    }
  }

  // Logout handler
  async function logout() {
    try {
      if (window.firebaseAuth && typeof window.firebaseAuth.signOut === 'function') {
        await window.firebaseAuth.signOut();
      }
      sessionStorage.removeItem('adminSession');
      location.reload();
    } catch (e) {
      console.error('Logout error:', e);
    }
  }
  // Initialize admin panel
  async function initAdmin() {
    try {
      setupEventListeners();
      await initAuth();
      
      // Load products if dashboard is visible
      setTimeout(() => {
        if (window.firebaseDb && document.getElementById('productsPreview') && !dashboard.classList.contains('hidden')) {
          loadProducts();
        }
      }, 2000);

      // Load Passe Booyah controls
      setTimeout(() => {
        if (window.firebaseDb && document.getElementById('booyahTbody')) {
          try { loadPasseBooyahControls(); } catch (_) {}
        }
      }, 2500);
      
      // Recomputar totais de tokens (evita contagens duplicadas)
      setTimeout(() => {
        if (window.firebaseDb) {
          try { recomputeTokenTotals(); } catch (_) {}
        }
      }, 2800);

      // Load users and setup guards
      setTimeout(() => {
        if (window.firebaseDb) {
          try {
            const roleLower = (window.adminRoleLower||'').toLowerCase();
            if (roleLower==='ceo' || roleLower==='gerente' || roleLower==='socio') {
              loadUsers();
            }
          } catch (_) {}
        }
        try { setupRoleGuards(); } catch (_) {}
      }, 800);
      
    } catch (error) {
      console.error('Admin initialization error:', error);
      showLoginError('Erro ao inicializar o painel administrativo.');
    }
  }

  // Função de teste para verificar permissões
  async function testFirestorePermissions() {
    try {
      
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      
      // Testar leitura de usuários
      const usersRef = collection(window.firebaseDb, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      
      // Testar leitura de pedidos
      const ordersRef = collection(window.firebaseDb, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      
      
      // Testar leitura de registros
      const regsRef = collection(window.firebaseDb, 'registrations');
      const regsSnapshot = await getDocs(regsRef);
      
      
      
      return true;
    } catch (error) {
      console.error('❌ Erro no teste de permissões:', error);
      return false;
    }
  }

  // Start admin panel
  initAdmin();
  
  // Testar permissões após inicialização
  setTimeout(() => {
    testFirestorePermissions();
  }, 2000);
  
  // Configurar filtros de usuários quando o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', () => {
    setupUserFilters();
    try { setupRoleGuards(); } catch (_) {}
    // Configurar filtros de cupons quando DOM estiver pronto
    setupCouponUsageFilters();
  });

// ==================== FUNÇÕES DE USUÁRIOS ====================

// Variáveis para usuários
let allUsers = [];
let filteredUsers = [];
let usersCurrentPage = 1;
const usersPerPage = 10;
let currentUserFilter = 'all'; // 'all', '30days', '7days', '1day'

// Carregar usuários do Firestore
async function loadUsers() {
  try {
    
    const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    // 1) Carrega usuários
    const usersRef = collection(window.firebaseDb, 'users');
    const snapshot = await getDocs(usersRef);
    
    allUsers = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      // Normaliza lastLogin para milissegundos
      let lastLoginMs = null;
      const ll = userData.lastLogin;
      if (ll) {
        if (typeof ll.toMillis === 'function') {
          lastLoginMs = ll.toMillis();
        } else if (typeof ll === 'number') {
          lastLoginMs = ll;
        } else if (typeof ll === 'object' && typeof ll.seconds === 'number') {
          lastLoginMs = ll.seconds * 1000;
        }
      }
      allUsers.push({
        id: doc.id,
        email: userData.email || 'N/A',
        role: userData.role || 'Usuário',
        lastLogin: lastLoginMs,
        name: userData.name || userData.email || 'Usuário',
        createdAt: userData.createdAt || null
      });
    });

    // 2) Usa atividade recente de pedidos como fallback de "último login"
    
    const ordersRef = collection(window.firebaseDb, 'orders');
    // Pega os mais recentes para manter leve
    const ordersSnap = await getDocs(query(ordersRef, orderBy('createdAt', 'desc'), limit(500)));
    const emailToLastActivity = new Map();
    ordersSnap.forEach(orderDoc => {
      const o = orderDoc.data() || {};
      const email = o.buyerEmail || o.customerEmail || o.customer || o.email;
      if (!email) return;
      let ts = null;
      const paid = o.paidAt || o.approvedAt || o.confirmedAt;
      const created = o.createdAt;
      const normalize = (v) => {
        if (!v) return null;
        if (typeof v.toMillis === 'function') return v.toMillis();
        if (typeof v === 'number') return v;
        if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
        return null;
      };
      ts = normalize(paid) || normalize(created);
      if (!ts) return;
      const prev = emailToLastActivity.get(email) || 0;
      if (ts > prev) emailToLastActivity.set(email, ts);
    });

    // 3) Mescla atividade aos usuários sem lastLogin
    allUsers = allUsers.map(u => {
      if (!u.lastLogin && emailToLastActivity.has(u.email)) {
        return { ...u, lastLogin: emailToLastActivity.get(u.email) };
      }
      return u;
    });
    
    
    applyUserFilter();
    updateUsersStats();
    displayUsers();
  } catch (error) {
    console.error('❌ Erro ao carregar usuários:', error);
  }
}

// Aplicar filtro de usuários
function applyUserFilter() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;
  
  filteredUsers = allUsers.filter(user => {
    if (currentUserFilter === 'all') return true;
    
    if (!user.lastLogin || isNaN(user.lastLogin)) return false;
    
    const lastLoginTime = user.lastLogin;
    const timeDiff = now - lastLoginTime;
    
    switch (currentUserFilter) {
      case '1day':
        return timeDiff <= oneDay;
      case '7days':
        return timeDiff <= sevenDays;
      case '30days':
        return timeDiff <= thirtyDays;
      default:
        return true;
    }
  });
  
  usersCurrentPage = 1; // Reset para primeira página
}

// Atualizar estatísticas de usuários
function updateUsersStats() {
  const totalUsers = allUsers.length;
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  
  const activeUsers = allUsers.filter(user => {
    if (!user.lastLogin) return false;
    return (now - user.lastLogin) <= thirtyDays;
  }).length;
  
  const inactiveUsers = totalUsers - activeUsers;
  
  document.getElementById('totalUsers').textContent = totalUsers;
  document.getElementById('activeUsers').textContent = activeUsers;
  document.getElementById('inactiveUsers').textContent = inactiveUsers;
}

// Exibir usuários na tabela
function displayUsers() {
  const tbody = document.getElementById('recentUsersTableBody') || document.getElementById('usersTableBody');
  if (!tbody) return;
  
  const startIndex = (usersCurrentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const pageUsers = filteredUsers.slice(startIndex, endIndex);
  
  if (pageUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-6 text-center text-gray-500">
          ${currentUserFilter === 'all' ? 'Nenhum usuário encontrado' : 'Nenhum usuário ativo neste período'}
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageUsers.map(user => {
      const lastLoginText = (user.lastLogin && !isNaN(user.lastLogin)) ? 
        new Date(user.lastLogin).toLocaleString('pt-BR') : 'Nunca';
      
      const statusClass = (user.lastLogin && !isNaN(user.lastLogin) && (Date.now() - user.lastLogin) <= (30 * 24 * 60 * 60 * 1000)) ? 
        'text-green-600' : 'text-orange-600';
      const statusText = (user.lastLogin && !isNaN(user.lastLogin) && (Date.now() - user.lastLogin) <= (30 * 24 * 60 * 60 * 1000)) ? 
        'Ativo' : 'Inativo';
      
      return `
        <tr class="border-b border-gray-100">
          <td class="py-2 px-2 text-gray-900">${user.email}</td>
          <td class="py-2 px-2 text-gray-600">${user.role}</td>
          <td class="py-2 px-2 text-gray-600">${lastLoginText}</td>
          <td class="py-2 px-2 ${statusClass}">${statusText}</td>
        </tr>
      `;
    }).join('');
  }
  
  updateUsersPagination();
  updateUsersCount();
}

// Atualizar paginação de usuários
function updateUsersPagination() {
  const paginationDiv = document.getElementById('usersPagination');
  if (!paginationDiv) return;
  
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  
  if (totalPages <= 1) {
    paginationDiv.innerHTML = '';
    return;
  }
  
  let paginationHTML = '';
  
  // Botão anterior
  if (usersCurrentPage > 1) {
    paginationHTML += `<button onclick="changeUsersPage(${usersCurrentPage - 1})" class="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">‹</button>`;
  }
  
  // Páginas
  for (let i = 1; i <= totalPages; i++) {
    if (i === usersCurrentPage) {
      paginationHTML += `<button class="px-2 py-1 bg-blue-matte text-white rounded text-xs">${i}</button>`;
    } else {
      paginationHTML += `<button onclick="changeUsersPage(${i})" class="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">${i}</button>`;
    }
  }
  
  // Botão próximo
  if (usersCurrentPage < totalPages) {
    paginationHTML += `<button onclick="changeUsersPage(${usersCurrentPage + 1})" class="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">›</button>`;
  }
  
  paginationDiv.innerHTML = paginationHTML;
}

// Mudar página de usuários
function changeUsersPage(page) {
  usersCurrentPage = page;
  displayUsers();
}

// Atualizar contador de usuários
function updateUsersCount() {
  const usersCount = document.getElementById('usersCount');
  const usersPageInfo = document.getElementById('usersPageInfo');
  
  if (usersCount) {
    usersCount.textContent = `${filteredUsers.length} usuários`;
  }
  
  if (usersPageInfo) {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    usersPageInfo.textContent = `Página ${usersCurrentPage} de ${totalPages}`;
  }
}
// Configurar filtros de usuários
function setupUserFilters() {
  const filterButtons = [
    { id: 'filterAllUsers', filter: 'all' },
    { id: 'filterActive30Days', filter: '30days' },
    { id: 'filterActive7Days', filter: '7days' },
    { id: 'filterActive1Day', filter: '1day' }
  ];
  
  filterButtons.forEach(({ id, filter }) => {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', () => {
        // Atualizar botões ativos
        filterButtons.forEach(({ id: btnId }) => {
          const btn = document.getElementById(btnId);
          if (btn) {
            btn.className = btn.className.replace('bg-blue-matte text-white', 'bg-gray-200 text-gray-700');
          }
        });
        
        // Ativar botão atual
        button.className = button.className.replace('bg-gray-200 text-gray-700', 'bg-blue-matte text-white');
        
        // Aplicar filtro
        currentUserFilter = filter;
        applyUserFilter();
        displayUsers();
      });
    }
  });
}

// Expor funções globalmente
window.changeUsersPage = changeUsersPage;

// Inicializar sistema de filtros de horários populares
setTimeout(() => {
  if (document.getElementById('popularHoursChart')) {
    loadEventOptions();
    setupPopularHoursFilters();
    renderPopularHours();
  }
}, 1000);

// ==================== RESTRIÇÕES DE PAPÉIS ====================

function getCurrentAdminRole() {
  // Usa o papel mais confiável disponível no momento
  try {
    const fromWindow = (window.adminRoleLower || '').toString();
    if (fromWindow) return fromWindow;
  } catch(_) {}
  try {
    const session = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
    if (session && session.role) return String(session.role);
  } catch(_) {}
  return undefined;
}

function canAssignRole(targetRole) {
  const role = (getCurrentAdminRole() || '').toLowerCase();
  const target = String(targetRole || '').toLowerCase();
  
  // CEO: pode atribuir qualquer cargo
  if (role === 'ceo') return true;
  
  // Gerente: pode atribuir apenas cargo de Vendedor
  if (role === 'gerente') {
    return target === 'vendedor';
  }
  
  // Outros cargos: não podem alterar funções de ninguém
  return false;
}

function setupRoleGuards() {
  const tables = [document.getElementById('usersTableBody'), document.getElementById('recentUsersTableBody')].filter(Boolean);
  tables.forEach((tbl) => {
    tbl.addEventListener('change', (e) => {
      const el = e.target;
      if (el && el.tagName === 'SELECT') {
        const newVal = el.value;
        if (!canAssignRole(newVal)) {
          e.preventDefault();
          // Reverter seleção
          const prev = el.getAttribute('data-prev') || '';
          if (prev) el.value = prev;
          alert('Gerente não pode definir cargo CEO.');
        } else {
          el.setAttribute('data-prev', newVal);
        }
      }
    });
  });
}

// Variáveis globais para filtros
let currentActiveFilter = 'all';
// allUsers já declarado na linha 3471

// Funções para gerenciar usuários (NOVA - para tabelas separadas)
let newTablesUsers = []; // Variável separada para as novas tabelas
let permissionsUsers = []; // Variável separada para a tabela de permissões
let filteredActiveUsers = []; // Usuários filtrados para a tabela de ativos
let activeUsersCurrentPage = 1; // Página atual da tabela de usuários ativos
const activeUsersPerPage = 10; // 10 usuários por página

async function loadUsersForTables() {
  try {
    const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const usersSnapshot = await getDocs(collection(window.firebaseDb, 'users'));
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        email: userData.email || 'N/A',
        role: userData.role || 'user',
        lastLogin: userData.lastLogin || null,
        createdAt: userData.createdAt || null
      });
    });
    
    // Armazenar usuários separadamente para cada tabela
    newTablesUsers = users; // Para Usuários Ativos
    permissionsUsers = users; // Para Usuários & Permissões (sempre todos os usuários)
    
    // Resetar paginação ao carregar
    activeUsersCurrentPage = 1;
    
    // Renderizar apenas a tabela de usuários ativos
    // A tabela de permissões é gerenciada separadamente por loadPermissionsUsers()
    renderActiveUsersTable(newTablesUsers); // Pode ser filtrado
    updateActiveUsersStats(newTablesUsers);
    
    // Adicionar event listeners para filtros (apenas para Usuários Ativos)
    setupFilterEventListeners();
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  }
}

function setupFilterEventListeners() {
  const filterAll = document.getElementById('filterAllUsers');
  const filter30 = document.getElementById('filterActive30Days');
  const filter7 = document.getElementById('filterActive7Days');
  const filter1 = document.getElementById('filterActive1Day');
  
  if (filterAll) filterAll.onclick = () => filterActiveUsers('all');
  if (filter30) filter30.onclick = () => filterActiveUsers('30');
  if (filter7) filter7.onclick = () => filterActiveUsers('7');
  if (filter1) filter1.onclick = () => filterActiveUsers('1');
}

// Esta função não é mais usada - foi substituída por renderPermissionsTable
// Mantida apenas para compatibilidade, mas não deve ser chamada
function renderUsersTable(users) {
  
  // Não fazer nada - a tabela de permissões é gerenciada separadamente
}

function renderActiveUsersTable(users) {
  const tbody = document.getElementById('activeUsersTableBody');
  if (!tbody) return;
  
  // Salvar usuários filtrados
  filteredActiveUsers = users;
  
  // Calcular paginação
  const totalPages = Math.ceil(users.length / activeUsersPerPage);
  const startIndex = (activeUsersCurrentPage - 1) * activeUsersPerPage;
  const endIndex = startIndex + activeUsersPerPage;
  const pageUsers = users.slice(startIndex, endIndex);
  
  if (pageUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-gray-500">Nenhum usuário encontrado</td></tr>';
    updateActiveUsersPagination(totalPages);
    updateActiveUsersCount();
    return;
  }
  
  tbody.innerHTML = pageUsers.map(user => {
    let lastLogin = 'Nunca';
    let isActive = false;
    
    if (user.lastLogin) {
      try {
        // Tentar diferentes formatos de data
        let date;
        if (user.lastLogin.seconds) {
          // Firestore Timestamp
          date = new Date(user.lastLogin.seconds * 1000);
        } else if (user.lastLogin.toDate) {
          // Firestore Timestamp com método toDate()
          date = user.lastLogin.toDate();
        } else if (typeof user.lastLogin === 'string') {
          // String ISO
          date = new Date(user.lastLogin);
        } else if (typeof user.lastLogin === 'number') {
          // Timestamp em milissegundos
          date = new Date(user.lastLogin);
        } else {
          date = new Date(user.lastLogin);
        }
        
        if (!isNaN(date.getTime())) {
          lastLogin = date.toLocaleDateString('pt-BR');
          isActive = (Date.now() - date.getTime()) < (7 * 24 * 60 * 60 * 1000);
        }
      } catch (error) {
        console.error('Erro ao processar data de login:', error);
        lastLogin = 'Erro';
      }
    }
    
    return `
      <tr class="border-b border-gray-100">
        <td class="py-2 px-2 text-gray-700">${user.email}</td>
        <td class="py-2 px-2">
          <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">${user.role}</span>
        </td>
        <td class="py-2 px-2 text-gray-600">${lastLogin}</td>
        <td class="py-2 px-2">
          <span class="px-2 py-1 rounded text-xs ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
            ${isActive ? 'Ativo' : 'Inativo'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
  
  // Atualizar paginação e contadores
  updateActiveUsersPagination(totalPages);
  updateActiveUsersCount();
}

// Atualizar controles de paginação de usuários ativos
function updateActiveUsersPagination(totalPages) {
  const paginationDiv = document.getElementById('activeUsersPagination');
  const pageInfo = document.getElementById('activeUsersPageInfo');
  
  if (!paginationDiv) return;
  
  // Atualizar info da página
  if (pageInfo) {
    pageInfo.textContent = `Página ${activeUsersCurrentPage} de ${totalPages || 1}`;
  }
  
  // Limpar paginação anterior
  paginationDiv.innerHTML = '';
  
  if (totalPages <= 1) {
    return; // Não mostrar paginação se houver apenas 1 página
  }
  
  // Botão Anterior
  const prevBtn = document.createElement('button');
  prevBtn.textContent = '« Anterior';
  prevBtn.className = `px-3 py-1 text-xs rounded ${activeUsersCurrentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
  prevBtn.disabled = activeUsersCurrentPage === 1;
  prevBtn.onclick = () => {
    if (activeUsersCurrentPage > 1) {
      activeUsersCurrentPage--;
      renderActiveUsersTable(filteredActiveUsers);
    }
  };
  paginationDiv.appendChild(prevBtn);
  
  // Números das páginas
  const maxVisiblePages = 5;
  let startPage = Math.max(1, activeUsersCurrentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.textContent = '1';
    firstBtn.className = 'px-2 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300';
    firstBtn.onclick = () => {
      activeUsersCurrentPage = 1;
      renderActiveUsersTable(filteredActiveUsers);
    };
    paginationDiv.appendChild(firstBtn);
    
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.className = 'px-2 py-1 text-xs text-gray-500';
      paginationDiv.appendChild(ellipsis);
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = i.toString();
    pageBtn.className = `px-2 py-1 text-xs rounded ${i === activeUsersCurrentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
    pageBtn.onclick = () => {
      activeUsersCurrentPage = i;
      renderActiveUsersTable(filteredActiveUsers);
    };
    paginationDiv.appendChild(pageBtn);
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.className = 'px-2 py-1 text-xs text-gray-500';
      paginationDiv.appendChild(ellipsis);
    }
    
    const lastBtn = document.createElement('button');
    lastBtn.textContent = totalPages.toString();
    lastBtn.className = 'px-2 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300';
    lastBtn.onclick = () => {
      activeUsersCurrentPage = totalPages;
      renderActiveUsersTable(filteredActiveUsers);
    };
    paginationDiv.appendChild(lastBtn);
  }
  
  // Botão Próximo
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Próximo »';
  nextBtn.className = `px-3 py-1 text-xs rounded ${activeUsersCurrentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
  nextBtn.disabled = activeUsersCurrentPage === totalPages;
  nextBtn.onclick = () => {
    if (activeUsersCurrentPage < totalPages) {
      activeUsersCurrentPage++;
      renderActiveUsersTable(filteredActiveUsers);
    }
  };
  paginationDiv.appendChild(nextBtn);
}

// Atualizar contador de usuários ativos
function updateActiveUsersCount() {
  const countEl = document.getElementById('activeUsersCount');
  if (countEl) {
    countEl.textContent = `${filteredActiveUsers.length} usuário${filteredActiveUsers.length !== 1 ? 's' : ''}`;
  }
}

async function updateUserRole(userId, newRole) {
  try {
    // Atualizar estado local primeiro (para feedback imediato)
    const userIndex = permissionsUsers.findIndex(user => user.id === userId);
    if (userIndex !== -1) {
      permissionsUsers[userIndex].role = newRole;
      // A tabela de permissões é gerenciada separadamente
    }
    
    // Atualizar no Firestore
    const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    await updateDoc(doc(window.firebaseDb, 'users', userId), {
      role: newRole,
      updatedAt: new Date()
    });
    
    // Atualizar também a variável newTablesUsers para manter consistência
    const activeUserIndex = newTablesUsers.findIndex(user => user.id === userId);
    if (activeUserIndex !== -1) {
      newTablesUsers[activeUserIndex].role = newRole;
    }
    
    
  } catch (error) {
    console.error('Erro ao atualizar função do usuário:', error);
    alert('Erro ao atualizar função do usuário');
    
    // Reverter mudança local em caso de erro
    loadUsersForTables();
  }
}

// Funções de filtro para Usuários Ativos

function filterActiveUsers(filter) {
  currentActiveFilter = filter;
  
  // Resetar para primeira página ao filtrar
  activeUsersCurrentPage = 1;
  
  // Atualizar botões de filtro
  const buttons = ['filterAllUsers', 'filterActive30Days', 'filterActive7Days', 'filterActive1Day'];
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      if (btnId === `filter${filter.charAt(0).toUpperCase() + filter.slice(1)}Users` || 
          (filter === 'all' && btnId === 'filterAllUsers') ||
          (filter === '30' && btnId === 'filterActive30Days') ||
          (filter === '7' && btnId === 'filterActive7Days') ||
          (filter === '1' && btnId === 'filterActive1Day')) {
        btn.className = 'px-2 py-1 bg-blue-matte text-white rounded text-xs hover:bg-blue-600 transition-colors';
      } else {
        btn.className = 'px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition-colors';
      }
    }
  });
  
  // Filtrar usuários usando a variável separada
  let filteredUsers = newTablesUsers;
  const now = Date.now();
  
  if (filter === '30') {
    filteredUsers = newTablesUsers.filter(user => {
      if (!user.lastLogin) return false;
      let date;
      if (user.lastLogin.seconds) {
        date = new Date(user.lastLogin.seconds * 1000);
      } else if (user.lastLogin.toDate) {
        date = user.lastLogin.toDate();
      } else {
        date = new Date(user.lastLogin);
      }
      return (now - date.getTime()) <= (30 * 24 * 60 * 60 * 1000);
    });
  } else if (filter === '7') {
    filteredUsers = newTablesUsers.filter(user => {
      if (!user.lastLogin) return false;
      let date;
      if (user.lastLogin.seconds) {
        date = new Date(user.lastLogin.seconds * 1000);
      } else if (user.lastLogin.toDate) {
        date = user.lastLogin.toDate();
      } else {
        date = new Date(user.lastLogin);
      }
      return (now - date.getTime()) <= (7 * 24 * 60 * 60 * 1000);
    });
  } else if (filter === '1') {
    filteredUsers = newTablesUsers.filter(user => {
      if (!user.lastLogin) return false;
      let date;
      if (user.lastLogin.seconds) {
        date = new Date(user.lastLogin.seconds * 1000);
      } else if (user.lastLogin.toDate) {
        date = user.lastLogin.toDate();
      } else {
        date = new Date(user.lastLogin);
      }
      return (now - date.getTime()) <= (24 * 60 * 60 * 1000);
    });
  }
  
  // Atualizar APENAS a tabela de usuários ativos (NÃO a de permissões)
  renderActiveUsersTable(filteredUsers);
  updateActiveUsersStats(filteredUsers);
  
  // NÃO atualizar a tabela de Usuários & Permissões - ela deve sempre mostrar todos os usuários
}

function updateActiveUsersStats(users) {
  const total = users.length;
  const active = users.filter(user => {
    if (!user.lastLogin) return false;
    let date;
    if (user.lastLogin.seconds) {
      date = new Date(user.lastLogin.seconds * 1000);
    } else if (user.lastLogin.toDate) {
      date = user.lastLogin.toDate();
    } else {
      date = new Date(user.lastLogin);
    }
    return (Date.now() - date.getTime()) <= (7 * 24 * 60 * 60 * 1000);
  }).length;
  const inactive = total - active;
  
  const totalEl = document.getElementById('totalUsers');
  const activeEl = document.getElementById('activeUsers');
  const inactiveEl = document.getElementById('inactiveUsers');
  
  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (inactiveEl) inactiveEl.textContent = inactive;
}
// Expor funções globalmente
window.loadUsers = loadUsers;
window.loadUsersForTables = loadUsersForTables;
window.updateUserRole = updateUserRole;
window.filterActiveUsers = filterActiveUsers;

// ==================== FUNÇÕES SEPARADAS PARA CARD DE PERMISSÕES ====================

// Variáveis separadas para o card de permissões
let permissionsUsersData = [];
let permissionsCurrentPage = 1;
const permissionsPerPage = 10;

// Filter state for Usuários & Permissões
window._permFilter = { search: '', role: '' };

function getPermissionsDisplayData() {
  const { search, role } = window._permFilter;
  if (!search && !role) return permissionsUsersData;
  const q = search.toLowerCase();
  return permissionsUsersData.filter(u => {
    const matchRole   = !role || (u.role || '').toLowerCase() === role;
    const matchSearch = !q ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q);
    return matchRole && matchSearch;
  });
}

window.setPermissionsRoleFilter = function(role, btn) {
  window._permFilter.role = role;
  permissionsCurrentPage = 1;
  document.querySelectorAll('.perm-role-btn').forEach(b => {
    b.className = b.className.replace('bg-blue-600 text-white', 'bg-gray-200 text-gray-700');
    if (!b.className.includes('hover:bg-gray-300')) b.className += ' hover:bg-gray-300';
  });
  if (btn) {
    btn.className = btn.className.replace('bg-gray-200 text-gray-700', 'bg-blue-600 text-white');
    btn.className = btn.className.replace(' hover:bg-gray-300', '');
  }
  renderPermissionsTable();
  updatePermissionsPagination();
};

window.filterPermissionsTable = function() {
  const input = document.getElementById('permissionsSearchInput');
  window._permFilter.search = input ? input.value.trim() : '';
  permissionsCurrentPage = 1;
  renderPermissionsTable();
  updatePermissionsPagination();
};

// Carregar usuários especificamente para o card de permissões
async function loadPermissionsUsers() {
  try {
    
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const usersRef = collection(window.firebaseDb, 'users');
    const snapshot = await getDocs(usersRef);
    
    permissionsUsersData = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      permissionsUsersData.push({
        id: doc.id,
        email: userData.email || 'N/A',
        displayName: userData.displayName || userData.name || 'N/A',
        role: userData.role || 'user',
        lastLogin: userData.lastLoginAt ? userData.lastLoginAt.toDate() : null
      });
    });
    
    
    renderPermissionsTable();
    updatePermissionsPagination();
  } catch (error) {
    console.error('❌ Erro ao carregar usuários para permissões:', error);
  }
}

// Renderizar tabela de permissões
function renderPermissionsTable() {
  const tbody = document.getElementById('permissionsTableBody');
  if (!tbody) {
    
    return;
  }
  
  const displayData = getPermissionsDisplayData();
  if (displayData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-gray-500">Nenhum usuário encontrado</td>
      </tr>
    `;
    return;
  }
  
  const startIndex = (permissionsCurrentPage - 1) * permissionsPerPage;
  const endIndex = startIndex + permissionsPerPage;
  const usersPage = displayData.slice(startIndex, endIndex);
  
  // Verificar se o usuário atual pode editar e quais cargos pode atribuir
  const roleFromWindow = (window.adminRoleLower || '').toLowerCase();
  const roleFromSession = (getCurrentAdminRole() || '').toLowerCase();
  const currentUserRole = roleFromWindow || roleFromSession;
  
  const canEdit = ['ceo', 'gerente'].includes(currentUserRole.toLowerCase()); // CEO e Gerente podem editar
  
  // Função para gerar opções de cargo baseado na permissão do usuário
  function getRoleOptions(userRole) {
    const allRoles = [
      { value: 'user', label: 'Usuário' },
      { value: 'vendedor', label: 'Vendedor' },
      { value: 'gerente', label: 'Gerente' },
      { value: 'design', label: 'Design' },
      { value: 'admin', label: 'Admin' },
      { value: 'socio', label: 'Sócio' },
      { value: 'ceo', label: 'Ceo' }
    ];
    
    if (currentUserRole === 'ceo') {
      // CEO pode atribuir qualquer cargo
      return allRoles.map(role => 
        `<option value="${role.value}" ${userRole === role.value ? 'selected' : ''}>${role.label}</option>`
      ).join('');
    } else if (currentUserRole === 'socio') {
      // Sócio vê todos os cargos mas não pode editar (somente leitura)
      return allRoles.map(role => 
        `<option value="${role.value}" ${userRole === role.value ? 'selected' : ''}>${role.label}</option>`
      ).join('');
    } else if (currentUserRole === 'gerente') {
      // Gerente pode atribuir apenas Vendedor
      return allRoles
        .filter(role => role.value === 'vendedor')
        .map(role => 
          `<option value="${role.value}" ${userRole === role.value ? 'selected' : ''}>${role.label}</option>`
        ).join('');
    } else {
      // Outros não podem atribuir nenhum cargo
      return allRoles
        .filter(role => role.value === userRole) // Apenas o cargo atual
        .map(role => 
          `<option value="${role.value}" selected>${role.label}</option>`
        ).join('');
    }
  }
  
  tbody.innerHTML = usersPage.map(user => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-3 px-2 text-gray-700 font-medium">${user.displayName}</td>
      <td class="py-3 px-2 text-gray-600">${user.email}</td>
      <td class="py-3 px-2">
        <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">${getRoleDisplayName(user.role)}</span>
      </td>
      <td class="py-3 px-2">
        <select class="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                data-user-id="${user.id}" data-current-role="${user.role}" ${!canEdit ? 'disabled' : ''}>
          ${getRoleOptions(user.role)}
        </select>
      </td>
      <td class="py-3 px-2">
        ${canEdit ? `
          <button onclick="updatePermissionsUserRole('${user.id}')" 
                  class="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
            Salvar
          </button>
        ` : currentUserRole === 'socio' ? `
          <span class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium cursor-not-allowed">
            Sócio - Somente Leitura
          </span>
        ` : `
          <span class="px-3 py-1 bg-gray-300 text-gray-600 rounded text-xs font-medium cursor-not-allowed">
            Somente Leitura
          </span>
        `}
      </td>
    </tr>
  `).join('');
}

// Função para obter nome de exibição da função
function getRoleDisplayName(role) {
  const roleNames = {
    'user': 'Usuário',
    'vendedor': 'Vendedor',
    'gerente': 'Gerente',
    'design': 'Design',
    'admin': 'Admin',
    'socio': 'Sócio',
    'ceo': 'Ceo'
  };
  return roleNames[role] || role;
}

// Atualizar função do usuário (específico para permissões)
async function updatePermissionsUserRole(userId) {
  try {
    const selectElement = document.querySelector(`select[data-user-id="${userId}"]`);
    if (!selectElement) {
      console.error('❌ Select element não encontrado para o usuário:', userId);
      return;
    }
    
    const newRole = selectElement.value;
    const currentRole = selectElement.getAttribute('data-current-role');
    
    if (newRole === currentRole) {
      
      return;
    }
    
    // Verificar se o usuário atual tem permissão para atribuir este cargo
    if (!canAssignRole(newRole)) {
      alert('❌ Você não tem permissão para atribuir este cargo.');
      // Reverter o select para o valor anterior
      selectElement.value = currentRole;
      return;
    }
    
    // Atualizar estado local primeiro
    const userIndex = permissionsUsersData.findIndex(user => user.id === userId);
    if (userIndex !== -1) {
      permissionsUsersData[userIndex].role = newRole;
      selectElement.setAttribute('data-current-role', newRole);
    }
    
    // Atualizar no Firestore
    const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const userRef = doc(window.firebaseDb, 'users', userId);
    await updateDoc(userRef, { role: newRole });
    
    // Log da ação
    const user = permissionsUsersData.find(u => u.id === userId);
    if (user) {
      await logAdminAction('change_role', `Alterou cargo de ${user.email} para ${getRoleDisplayName(newRole)}`);
    }
    
    
    
    // Mostrar feedback visual
    const button = selectElement.parentElement.nextElementSibling.querySelector('button');
    const originalText = button.textContent;
    button.textContent = 'Salvo!';
    button.className = 'px-3 py-1 bg-green-600 text-white rounded text-xs font-medium transition-colors';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.className = 'px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
    }, 2000);
    
  } catch (error) {
    console.error('❌ Erro ao atualizar função do usuário:', error);
    alert('Erro ao atualizar função do usuário');
    
    // Reverter mudança local em caso de erro
    loadPermissionsUsers();
  }
}

// Atualizar paginação do card de permissões
function updatePermissionsPagination() {
  const displayData = getPermissionsDisplayData();
  const totalPages = Math.ceil(displayData.length / permissionsPerPage);
  const paginationContainer = document.getElementById('permissionsPagination');
  const countElement = document.getElementById('permissionsUsersCount');
  
  if (countElement) {
    const total = permissionsUsersData.length;
    const showing = displayData.length;
    countElement.textContent = showing < total
      ? `${showing} de ${total} usuários`
      : `${total} usuários`;
  }
  
  if (!paginationContainer || totalPages <= 1) {
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }
  
  let paginationHTML = '';
  
  // Botão anterior
  if (permissionsCurrentPage > 1) {
    paginationHTML += `<button onclick="changePermissionsPage(${permissionsCurrentPage - 1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">‹</button>`;
  }
  
  // Páginas
  for (let i = 1; i <= totalPages; i++) {
    if (i === permissionsCurrentPage) {
      paginationHTML += `<button class="px-2 py-1 text-xs bg-blue-600 text-white rounded">${i}</button>`;
    } else {
      paginationHTML += `<button onclick="changePermissionsPage(${i})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">${i}</button>`;
    }
  }
  
  // Botão próximo
  if (permissionsCurrentPage < totalPages) {
    paginationHTML += `<button onclick="changePermissionsPage(${permissionsCurrentPage + 1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">›</button>`;
  }
  
  paginationContainer.innerHTML = paginationHTML;
}

// Mudar página do card de permissões
function changePermissionsPage(page) {
  permissionsCurrentPage = page;
  renderPermissionsTable();
  updatePermissionsPagination();
}

// ==================== GERENCIAMENTO DE TOKENS ====================

// Variáveis para tokens
let tokensUsersData = [];
let tokensFilteredData = [];
let tokensCurrentPage = 1;
const tokensPerPage = 5;

// Carregar usuários para gerenciamento de tokens
async function loadTokensUsers() {
  try {
    
    const { collection, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const usersCol = collection(window.firebaseDb, 'users');
    const snapUsers = await getDocsFromServer(usersCol);
    
    tokensUsersData = [];
    snapUsers.forEach(doc => {
      const data = doc.data();
      tokensUsersData.push({
        id: doc.id,
        email: data.email || 'N/A',
        role: data.role || 'Usuário',
        tokens: data.tokens || 0
      });
    });
    
    // Ordenar por quantidade de tokens (maior para menor)
    tokensUsersData.sort((a, b) => {
      const tokensA = Number(a.tokens || 0);
      const tokensB = Number(b.tokens || 0);
      return tokensB - tokensA; // Decrescente
    });
    
    
    tokensFilteredData = [...tokensUsersData]; // Inicializar dados filtrados (já ordenado)
    renderTokensTable();
    updateTokensPagination();
  } catch (error) {
    console.error('❌ Erro ao carregar usuários para tokens:', error);
  }
}
// Renderizar tabela de tokens
function renderTokensTable() {
  const tbody = document.getElementById('tokensTableBody');
  if (!tbody) return;
  
  const startIndex = (tokensCurrentPage - 1) * tokensPerPage;
  const endIndex = startIndex + tokensPerPage;
  const usersPage = tokensFilteredData.slice(startIndex, endIndex);
  
  // Verificar se o usuário atual pode gerenciar tokens
  const currentUserRole = (window.adminRoleLower || '').toLowerCase();
  const canManageTokens = ['ceo', 'gerente'].includes(currentUserRole);
  
  tbody.innerHTML = usersPage.map(user => `
    <tr class="border-b border-gray-100">
      <td class="py-3 px-2">
        <div class="font-medium text-gray-900">${user.email}</div>
      </td>
      <td class="py-3 px-2">
        <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">${getRoleDisplayName(user.role)}</span>
      </td>
      <td class="py-3 px-2">
        <span class="font-bold text-blue-600">${user.tokens}</span>
      </td>
      <td class="py-3 px-2">
        ${canManageTokens ? `
          <div class="flex gap-1">
            <button onclick="addTokens('${user.id}', '${user.email}')" 
                    class="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
              + Adicionar
            </button>
            <button onclick="removeTokens('${user.id}', '${user.email}')" 
                    class="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
              - Remover
            </button>
          </div>
        ` : `
          <span class="px-2 py-1 bg-gray-300 text-gray-600 rounded text-xs cursor-not-allowed">
            Somente Leitura
          </span>
        `}
      </td>
    </tr>
  `).join('');
  
  // Atualizar contador
  const countElement = document.getElementById('tokensUsersCount');
  if (countElement) {
    const totalUsers = tokensUsersData.length;
    const filteredUsers = tokensFilteredData.length;
    if (filteredUsers === totalUsers) {
      countElement.textContent = `${totalUsers} usuários`;
    } else {
      countElement.textContent = `${filteredUsers} de ${totalUsers} usuários`;
    }
  }
}

// Adicionar tokens
async function addTokens(userId, userEmail) {
  const amount = prompt(`Quantos tokens adicionar para ${userEmail}?`);
  if (!amount || isNaN(amount) || amount <= 0) {
    alert('Por favor, insira um número válido maior que zero.');
    return;
  }
  
  try {
    const { doc, updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const userRef = doc(window.firebaseDb, 'users', userId);
    await updateDoc(userRef, {
      tokens: increment(parseInt(amount))
    });
    
    // Log da ação
    await logAdminAction('add_tokens', `Adicionou ${amount} tokens para ${userEmail}`);
    
    alert(`✅ ${amount} tokens adicionados para ${userEmail}`);
    loadTokensUsers(); // Recarregar dados
  } catch (error) {
    console.error('❌ Erro ao adicionar tokens:', error);
    alert('❌ Erro ao adicionar tokens. Tente novamente.');
  }
}

// Remover tokens
async function removeTokens(userId, userEmail) {
  const amount = prompt(`Quantos tokens remover de ${userEmail}?`);
  if (!amount || isNaN(amount) || amount <= 0) {
    alert('Por favor, insira um número válido maior que zero.');
    return;
  }
  
  try {
    const { doc, updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const userRef = doc(window.firebaseDb, 'users', userId);
    await updateDoc(userRef, {
      tokens: increment(-parseInt(amount))
    });
    
    // Log da ação
    await logAdminAction('remove_tokens', `Removeu ${amount} tokens de ${userEmail}`);
    
    alert(`✅ ${amount} tokens removidos de ${userEmail}`);
    loadTokensUsers(); // Recarregar dados
  } catch (error) {
    console.error('❌ Erro ao remover tokens:', error);
    alert('❌ Erro ao remover tokens. Tente novamente.');
  }
}

// Paginação de tokens
function updateTokensPagination() {
  const totalPages = Math.ceil(tokensFilteredData.length / tokensPerPage);
  const paginationContainer = document.getElementById('tokensPagination');
  if (!paginationContainer) return;
  
  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }
  
  let paginationHTML = '';
  
  // Botão anterior
  if (tokensCurrentPage > 1) {
    paginationHTML += `<button onclick="changeTokensPage(${tokensCurrentPage - 1})" class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">‹</button>`;
  }
  
  // Páginas
  for (let i = 1; i <= totalPages; i++) {
    if (i === tokensCurrentPage) {
      paginationHTML += `<button class="px-2 py-1 text-xs bg-blue-600 text-white rounded">${i}</button>`;
    } else {
      paginationHTML += `<button onclick="changeTokensPage(${i})" class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i}</button>`;
    }
  }
  
  // Botão próximo
  if (tokensCurrentPage < totalPages) {
    paginationHTML += `<button onclick="changeTokensPage(${tokensCurrentPage + 1})" class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">›</button>`;
  }
  
  paginationContainer.innerHTML = paginationHTML;
}

function changeTokensPage(page) {
  const totalPages = Math.ceil(tokensFilteredData.length / tokensPerPage);
  
  // Validar página
  if (page < 1) {
    tokensCurrentPage = 1;
  } else if (page > totalPages) {
    tokensCurrentPage = totalPages;
  } else {
    tokensCurrentPage = page;
  }
  
  renderTokensTable();
  updateTokensPagination();
}

// Filtrar usuários de tokens
function filterTokensUsers() {
  const searchInput = document.getElementById('tokensSearchInput');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (searchTerm === '') {
    tokensFilteredData = [...tokensUsersData]; // Já está ordenado
  } else {
    tokensFilteredData = tokensUsersData.filter(user => 
      user.email.toLowerCase().includes(searchTerm) ||
      user.role.toLowerCase().includes(searchTerm) ||
      getRoleDisplayName(user.role).toLowerCase().includes(searchTerm)
    );
    // Manter ordenação por tokens após filtrar
    tokensFilteredData.sort((a, b) => {
      const tokensA = Number(a.tokens || 0);
      const tokensB = Number(b.tokens || 0);
      return tokensB - tokensA; // Decrescente
    });
  }
  
  tokensCurrentPage = 1; // Reset para primeira página
  renderTokensTable();
  updateTokensPagination();
}

// ==================== SISTEMA DE CUPONS ====================

// Variáveis globais para cupons
let couponsData = [];
let couponUsageData = [];
let filteredCouponUsageData = [];
let couponUsageFilters = { period: '7d', context: 'all', couponCode: 'all', productName: '' };
let _couponUsageUnsubscribe = null;

// Carregar cupons
async function loadCoupons() {
    try {
        
        const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const couponsRef = collection(window.firebaseDb, 'coupons');
        const q = query(couponsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        couponsData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            couponsData.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                expirationDate: data.expirationDate?.toDate() || null
            });
        });
        
        
        // Garantir que afiliados estejam carregados antes de renderizar
        if (affiliatesData.length === 0) {
            try {
                await loadAffiliates();
            } catch (err) {
                console.warn('⚠️ Erro ao carregar afiliados antes de renderizar cupons:', err);
            }
        }
        renderCouponsTable();
        populateCouponCodeFilter();
    } catch (error) {
        console.error('❌ Erro ao carregar cupons:', error);
        const tbody = document.getElementById('couponsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-6 text-center text-red-500">Erro ao carregar cupons</td>
                </tr>
            `;
        }
    }
}

// Renderizar tabela de cupons
function renderCouponsTable() {
    const tbody = document.getElementById('couponsTableBody');
    const countElement = document.getElementById('activeCouponsCount');
    
    if (!tbody) return;
    
    if (couponsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-6 text-center text-gray-500">Nenhum cupom encontrado</td>
            </tr>
        `;
        if (countElement) countElement.textContent = '0 cupons';
        return;
    }
    
    if (countElement) countElement.textContent = `${couponsData.length} cupons`;
    
    tbody.innerHTML = couponsData.map(coupon => {
        const isExpired = coupon.expirationDate && coupon.expirationDate < new Date();
        const isActive = coupon.isActive && !isExpired;
        
        const discountText = coupon.discountType === 'percentage' 
            ? `${coupon.discountValue}%` 
            : `R$ ${coupon.discountValue.toFixed(2)}`;
        
        const usageTypeText = {
            'both': 'Eventos + Loja',
            'events': 'Apenas Eventos',
            'store': 'Apenas Loja'
        }[coupon.usageType] || 'N/A';
        
        const statusBadge = isActive 
            ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Ativo</span>'
            : '<span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Inativo</span>';
        
        // Buscar nome do afiliado se houver
        let affiliateName = null;
        if (coupon.affiliateId) {
            const affiliate = affiliatesData.find(a => a.id === coupon.affiliateId);
            if (affiliate) {
                affiliateName = affiliate.name || affiliate.email?.split('@')[0] || 'Afiliado';
            } else {
                // Se não encontrou, pode ser que o ID seja o email ou outro formato
                const affiliateByEmail = affiliatesData.find(a => a.email === coupon.affiliateId);
                if (affiliateByEmail) {
                    affiliateName = affiliateByEmail.name || affiliateByEmail.email?.split('@')[0] || 'Afiliado';
                } else {
                    console.warn('⚠️ Afiliado não encontrado para cupom:', coupon.code, 'affiliateId:', coupon.affiliateId);
                }
            }
        }
        
        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-2">
                    <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">${coupon.code}</span>
                </td>
                <td class="py-2 px-2 text-xs">${discountText}</td>
                <td class="py-2 px-2">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${usageTypeText}</span>
                </td>
                <td class="py-2 px-2 text-xs">
                    ${affiliateName ? `<span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded" title="Vincular a: ${affiliateName}">👤 ${affiliateName}</span>` : '<span class="text-xs text-gray-400">-</span>'}
                </td>
                <td class="py-2 px-2">${statusBadge}</td>
                <td class="py-2 px-2">
                    <div class="flex gap-1">
                        <button onclick="editCoupon('${coupon.id}')" 
                                class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            Editar
                        </button>
                        <button onclick="toggleCouponStatus('${coupon.id}', ${!isActive})" 
                                class="px-2 py-1 text-xs rounded ${isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}">
                            ${isActive ? 'Desativar' : 'Ativar'}
                        </button>
                        <button onclick="deleteCoupon('${coupon.id}')" 
                                class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                            Excluir
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Carregar histórico de uso de cupons
async function loadCouponUsage() {
    // Cancelar listener anterior se existir
    if (_couponUsageUnsubscribe) { _couponUsageUnsubscribe(); _couponUsageUnsubscribe = null; }
    try {
        const { collection, query, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const usageRef = collection(window.firebaseDb, 'couponUsage');
        const q = query(usageRef);

        _couponUsageUnsubscribe = onSnapshot(q, (snapshot) => {
            couponUsageData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                couponUsageData.push({
                    id: doc.id,
                    ...data,
                    usedAt: data.usedAt?.toDate?.() || (data.usedAt ? new Date(data.usedAt) : new Date())
                });
            });
            // Ordenar localmente do mais recente
            couponUsageData.sort((a, b) => b.usedAt - a.usedAt);
            filteredCouponUsageData = [...couponUsageData];
            populateCouponCodeFilter();
            applyCouponUsageFilters();
        }, (error) => {
            console.error('❌ Erro no listener de cupons:', error);
            const tbody = document.getElementById('couponUsageTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-red-500">Erro ao carregar histórico</td></tr>';
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar listener de cupons:', error);
        const tbody = document.getElementById('couponUsageTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-red-500">Erro ao carregar histórico</td></tr>';
    }
}

// Popular select de cupons no filtro (mantido por compatibilidade, não exibe mais)
function populateCouponCodeFilter() {
    const sel = document.getElementById('couponUsageCodeSelect');
    if (!sel) return;
    // Coletar códigos únicos da lista de cupons cadastrados + dos registros já carregados
    const codes = new Set();
    couponsData.forEach(c => { if (c.code) codes.add(c.code.toUpperCase()); });
    couponUsageData.forEach(u => { if (u.couponCode) codes.add(u.couponCode.toUpperCase()); });
    const current = sel.value;
    sel.innerHTML = '<option value="all">— Todos —</option>';
    [...codes].sort().forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        if (code === current) opt.selected = true;
        sel.appendChild(opt);
    });
}
// Renderizar gráficos circulares por cupom (com retry se Chart.js ainda não carregou)
function renderCouponCharts(data, _retryCount) {
    if (typeof Chart === 'undefined') {
        const attempt = (_retryCount || 0) + 1;
        if (attempt <= 20) {
            setTimeout(() => renderCouponCharts(data, attempt), 500);
        }
        return;
    }
    const area = document.getElementById('couponChartsArea');
    if (!area) return;

    // Destruir gráficos anteriores
    area.querySelectorAll('canvas').forEach(c => {
        if (window.Chart) { const ch = window.Chart.getChart(c); if (ch) ch.destroy(); }
    });

    // Agrupar por cupom → evento/produto (a partir dos usos)
    const byCoupon = {};
    (data || []).forEach(u => {
        const code = u.couponCode || u.coupon_code || u.code || u.couponId || 'N/A';
        if (!byCoupon[code]) byCoupon[code] = {};
        const label = (u.productName || u.product_name || u.eventName || u.event_name || u.productId || 'Outro').slice(0, 28);
        byCoupon[code][label] = (byCoupon[code][label] || 0) + 1;
    });

    // Incluir TODOS os cupons definidos em couponsData (mesmo sem usos)
    if (Array.isArray(couponsData)) {
        couponsData.forEach(c => {
            const code = c.code || c.id;
            if (code && !byCoupon[code]) byCoupon[code] = {};
        });
    }

    const codes = Object.keys(byCoupon).sort();
    if (codes.length === 0) { area.innerHTML = ''; return; }

    const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4'];

    area.innerHTML = `
        <div class="border border-indigo-100 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-white mb-2">
            <h4 class="text-xs font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <i class="fas fa-chart-pie text-indigo-500"></i>
                Distribuição por Cupom nos Eventos/Produtos Ativos
            </h4>
            <div class="flex flex-wrap gap-8 justify-center" id="couponChartsGrid"></div>
        </div>`;

    const grid = document.getElementById('couponChartsGrid');
    codes.forEach(code => {
        const eventData = byCoupon[code];
        const labels = Object.keys(eventData);
        const values = labels.map(l => eventData[l]);
        const total = values.reduce((a, b) => a + b, 0);

        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center gap-1';

        if (total === 0) {
            // Cupom sem usos: exibe badge "sem usos"
            wrapper.innerHTML = `
                <span class="bg-indigo-100 border border-indigo-300 font-mono font-bold text-indigo-700 text-xs px-3 py-1 rounded-full">${escapeAdminHtml(code)}</span>
                <div style="width:190px;height:190px" class="flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                    <i class="fas fa-tag text-gray-300 text-3xl mb-2"></i>
                    <span class="text-xs text-gray-400 font-medium">Sem usos</span>
                </div>
                <span class="text-xs text-gray-400 font-medium">0 uso(s)</span>`;
            grid.appendChild(wrapper);
            return;
        }

        const safeId = `cc_${code.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
        wrapper.innerHTML = `
            <span class="bg-indigo-100 border border-indigo-300 font-mono font-bold text-indigo-700 text-xs px-3 py-1 rounded-full">${escapeAdminHtml(code)}</span>
            <canvas id="${safeId}" width="190" height="190"></canvas>
            <span class="text-xs text-gray-500 font-medium">${total} uso(s)</span>`;
        grid.appendChild(wrapper);

        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById(safeId);
        if (!canvas) return;
        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels.map((l, i) => `${l} — ${((values[i]/total)*100).toFixed(0)}%`),
                datasets: [{ data: values, backgroundColor: COLORS.slice(0, labels.length), borderWidth: 2, borderColor: '#fff' }]
            },
            options: {
                responsive: false, cutout: '52%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 9 }, boxWidth: 10, padding: 5 } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.label}` } }
                }
            }
        });
    });
}

// Renderizar tabela de uso de cupons (paginada, 7 colunas)
function renderCouponUsageTable() {
    const tbody = document.getElementById('couponUsageTableBody');
    const countEl = document.getElementById('couponUsageCount');
    const showingEl = document.getElementById('couponTableShowing');
    const totalEl = document.getElementById('couponTableTotal');

    if (!tbody) return;
    const data = Array.isArray(filteredCouponUsageData) ? filteredCouponUsageData : couponUsageData;

    if (countEl) countEl.textContent = `${data.length} usos`;
    if (totalEl) totalEl.textContent = data.length;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-500">Nenhum uso de cupom encontrado</td></tr>';
        if (showingEl) showingEl.textContent = '0';
        updateCouponStats([]);
        return;
    }

    const pageSizeEl = document.getElementById('couponUsagePageSize');
    const pageSize = parseInt(pageSizeEl?.value || '25');
    const displayData = pageSize > 0 ? data.slice(0, pageSize) : data;
    if (showingEl) showingEl.textContent = displayData.length;

    tbody.innerHTML = displayData.map(usage => {
        const orderValue = usage.orderValue || 0;
        const discountAmount = usage.discountAmount || 0;
        const finalValue = usage.finalValue ?? (orderValue - discountAmount);
        const discountPct = usage.discountPercentage || (orderValue > 0 ? ((discountAmount / orderValue) * 100).toFixed(1) : '0.0');
        const couponCode = usage.couponCode || usage.coupon_code || usage.code || usage.couponId || 'N/A';
        const productName = usage.productName || usage.product_name || usage.eventName || usage.event_name || usage.productId || usage.itemName || 'N/A';
        const customerName = usage.customerName || usage.customer_name || usage.userName || 'N/A';
        const customerEmail = usage.customerEmail || usage.customer_email || usage.email || '';
        const ctxBadge = usage.context === 'events'
            ? '<span class="ml-1 text-[9px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded">evento</span>'
            : usage.context === 'store'
            ? '<span class="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">loja</span>'
            : '';
        return `<tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-2 px-2 text-xs whitespace-nowrap">${usage.usedAt ? formatDateTime(usage.usedAt) : 'N/A'}</td>
            <td class="py-2 px-2"><span class="font-mono text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">${escapeAdminHtml(couponCode)}</span>${ctxBadge}</td>
            <td class="py-2 px-2 text-xs">
                <div class="font-medium">${escapeAdminHtml(customerName.split(' ')[0])}</div>
                <div class="text-gray-400 text-xs">${customerEmail ? customerEmail.split('@')[0] : ''}</div>
            </td>
            <td class="py-2 px-2 text-xs max-w-[180px]">
                <div class="font-medium truncate" title="${escapeAdminHtml(productName)}">${escapeAdminHtml(productName)}</div>
            </td>
            <td class="py-2 px-2 text-xs">R$ ${orderValue.toFixed(2).replace('.',',')}</td>
            <td class="py-2 px-2 text-xs font-medium text-green-700">-R$ ${discountAmount.toFixed(2).replace('.',',')} <span class="text-gray-400 font-normal">(${discountPct}%)</span></td>
            <td class="py-2 px-2 text-xs font-bold text-gray-800">R$ ${finalValue.toFixed(2).replace('.',',')}</td>
        </tr>`;
    }).join('');
}

// Atualizar estatísticas de cupons
function updateCouponStats(data) {
    const total = data.length;
    const totalDiscount = data.reduce((sum, u) => sum + (u.discountAmount || 0), 0);
    const totalRevenue = data.reduce((sum, u) => sum + (u.finalValue || u.orderValue - (u.discountAmount || 0)), 0);
    const averageTicket = total > 0 ? totalRevenue / total : 0;
    
    const statsTotal = document.getElementById('couponStatsTotal');
    const statsDiscount = document.getElementById('couponStatsDiscount');
    const statsRevenue = document.getElementById('couponStatsRevenue');
    const statsAverage = document.getElementById('couponStatsAverage');
    
    if (statsTotal) statsTotal.textContent = total.toLocaleString('pt-BR');
    if (statsDiscount) statsDiscount.textContent = `R$ ${totalDiscount.toFixed(2).replace('.', ',')}`;
    if (statsRevenue) statsRevenue.textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
    if (statsAverage) statsAverage.textContent = `R$ ${averageTicket.toFixed(2).replace('.', ',')}`;
}

// Aplicar filtros de período, contexto e busca ao histórico de cupons
function applyCouponUsageFilters() {
    try {
        // Ler valores dos controles HTML
        const period  = document.getElementById('couponUsagePeriod')?.value      || couponUsageFilters.period  || '7d';
        const context = document.getElementById('couponUsageContext')?.value     || couponUsageFilters.context || 'all';
        const search  = (document.getElementById('couponUsageSearch')?.value     || '').toLowerCase().trim();
        const selectedCode = (document.getElementById('couponUsageCodeSelect')?.value || 'all');

        // Sincronizar objeto de filtros
        couponUsageFilters.period  = period;
        couponUsageFilters.context = context;

        // Atualizar label do botão Zerar conforme seleção
        const btnZerar = document.querySelector('[onclick="zerarComissoes()"]');
        if (btnZerar) {
            btnZerar.innerHTML = selectedCode === 'all'
                ? '<i class="fas fa-eraser mr-1"></i>Zerar comissões'
                : `<i class="fas fa-eraser mr-1"></i>Zerar: ${selectedCode}`;
        }

        const now = new Date();
        let fromDate = null;
        switch (period) {
            case '1d':  fromDate = new Date(now.getTime() -  1 * 24 * 60 * 60 * 1000); break;
            case '7d':  fromDate = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000); break;
            case '15d': fromDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); break;
            case '30d': fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case 'all': default: fromDate = null; break;
        }

        filteredCouponUsageData = couponUsageData.filter(u => {
            // Filtro por período
            let usedAt = u.usedAt instanceof Date ? u.usedAt
                : (u.usedAt?.toDate ? u.usedAt.toDate() : new Date(u.usedAt));
            const inPeriod = fromDate ? (usedAt >= fromDate && usedAt <= now) : true;

            // Filtro por contexto
            const ctx = (u.context || '').toLowerCase();
            const inContext = context === 'all' ? true : ctx === context;

            // Filtro por cupom específico (select)
            const inCoupon = selectedCode === 'all'
                ? true
                : (u.couponCode || '').toUpperCase() === selectedCode.toUpperCase();

            // Busca de texto: produto ou cliente
            const searchMatch = !search ||
                (u.couponCode || '').toLowerCase().includes(search) ||
                (u.productName || '').toLowerCase().includes(search) ||
                (u.productId || '').toLowerCase().includes(search) ||
                (u.customerName || '').toLowerCase().includes(search);

            return inPeriod && inContext && inCoupon && searchMatch;
        });

        updateCouponStats(filteredCouponUsageData);
        renderCouponCharts(filteredCouponUsageData);
        renderCouponUsageTable();
    } catch (e) {
        console.error('❌ Erro ao aplicar filtros de cupons:', e);
        filteredCouponUsageData = couponUsageData.slice();
        updateCouponStats(filteredCouponUsageData);
        renderCouponCharts(filteredCouponUsageData);
        renderCouponUsageTable();
    }
    renderAffiliateRanking(filteredCouponUsageData.length > 0 ? filteredCouponUsageData : couponUsageData);
}

// ===== RANKING DE AFILIADOS =====
function renderAffiliateRanking(data) {
    const container = document.getElementById('affiliateRankingContainer');
    const cardsEl = document.getElementById('affiliateRankingCards');
    if (!container || !cardsEl) return;

    // Agrupar por afiliado usando couponUsageData
    const map = {};
    (data || []).forEach(u => {
        const affId = u.affiliateId || u.affiliateName || null;
        if (!affId) return;
        if (!map[affId]) {
            map[affId] = { id: affId, name: null, conversions: 0, commission: 0, discount: 0 };
        }
        map[affId].conversions++;
        map[affId].commission += (u.commissionAmount || 0);
        map[affId].discount   += (u.discountAmount  || 0);
        // Tentar pegar nome legível
        if (!map[affId].name) {
            const aff = (typeof affiliatesData !== 'undefined' ? affiliatesData : []).find(a => a.id === affId || a.email === affId);
            map[affId].name = aff ? (aff.name || aff.email?.split('@')[0] || affId) : (u.affiliateName || affId);
        }
    });

    const ranked = Object.values(map).sort((a, b) => b.conversions - a.conversions);

    if (ranked.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');

    const medals = ['🥇','🥈','🥉'];
    const colors = [
        'border-yellow-300 bg-yellow-50',
        'border-gray-300 bg-gray-50',
        'border-orange-200 bg-orange-50'
    ];

    cardsEl.innerHTML = ranked.map((aff, i) => {
        const medal  = medals[i] || `#${i+1}`;
        const color  = colors[i] || 'border-gray-200 bg-white';
        const barPct = ranked[0].conversions > 0 ? Math.round((aff.conversions / ranked[0].conversions) * 100) : 0;
        return `
        <div class="border ${color} rounded-xl p-3 flex flex-col gap-1">
            <div class="flex items-center justify-between">
                <span class="text-lg">${medal}</span>
                <span class="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">${aff.conversions} uso${aff.conversions !== 1 ? 's' : ''}</span>
            </div>
            <p class="text-xs font-bold text-gray-800 truncate" title="${aff.name}">${aff.name}</p>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div class="bg-purple-500 h-1.5 rounded-full" style="width:${barPct}%"></div>
            </div>
            <div class="flex justify-between mt-1">
                <span class="text-xs text-gray-500">Comissão</span>
                <span class="text-xs font-semibold text-green-700">R$ ${aff.commission.toFixed(2).replace('.',',')}</span>
            </div>
        </div>`;
    }).join('');
}
window.renderAffiliateRanking = renderAffiliateRanking;

// ===== ZERAR COMISSÕES (global ou por cupom selecionado) =====
async function zerarComissoes() {
    const selectedCode = (document.getElementById('couponUsageCodeSelect')?.value || 'all').trim();
    const isSingle = selectedCode !== 'all';

    const msg = isSingle
        ? `⚠️ Isso vai apagar TODOS os registros de uso do cupom "${selectedCode}" e zerar suas comissões.\n\nEssa ação não pode ser desfeita. Confirmar?`
        : '⚠️ Isso vai apagar TODO o histórico de uso de cupons e zerar comissões de todos os afiliados.\n\nEssa ação não pode ser desfeita. Confirmar?';
    if (!confirm(msg)) return;

    try {
        const { collection, getDocs, query, where, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        let total = 0;

        if (isSingle) {
            // 1. Apagar apenas registros do cupom selecionado
            const q = query(collection(db, 'couponUsage'), where('couponCode', '==', selectedCode));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const batch = writeBatch(db);
                snap.forEach(d => { batch.delete(d.ref); total++; });
                await batch.commit();
            }

            // 2. Zerar commissionAmount em affiliate_sales deste cupom
            const salesQ = query(collection(db, 'affiliate_sales'), where('couponCode', '==', selectedCode));
            const salesSnap = await getDocs(salesQ);
            if (!salesSnap.empty) {
                const batch2 = writeBatch(db);
                salesSnap.forEach(d => { batch2.update(d.ref, { commissionAmount: 0, status: 'zeroed' }); });
                await batch2.commit();
            }

            showToast('success', `Cupom "${selectedCode}" zerado! ${total} registros removidos.`, 'Concluído');
            // Remover do array local sem recarregar tudo
            couponUsageData = couponUsageData.filter(u => (u.couponCode || '').toUpperCase() !== selectedCode.toUpperCase());
        } else {
            // Zerar tudo
            const snap = await getDocs(collection(db, 'couponUsage'));
            if (!snap.empty) {
                const batch = writeBatch(db);
                snap.forEach(d => { batch.delete(d.ref); total++; });
                await batch.commit();
            }
            const salesSnap = await getDocs(collection(db, 'affiliate_sales'));
            if (!salesSnap.empty) {
                const batch2 = writeBatch(db);
                salesSnap.forEach(d => { batch2.update(d.ref, { commissionAmount: 0, status: 'zeroed' }); });
                await batch2.commit();
            }
            showToast('success', `Comissões zeradas! ${total} registros de uso de cupons removidos.`, 'Concluído');
            couponUsageData = [];
        }

        filteredCouponUsageData = [];
        renderCouponUsageTable();
        renderAffiliateRanking([]);
    } catch (err) {
        console.error('Erro ao zerar comissões:', err);
        showToast('error', 'Erro ao zerar: ' + (err.message || err), 'Erro');
    }
}
window.zerarComissoes = zerarComissoes;

// Exportar dados de uso de cupons
function exportCouponUsageData() {
    try {
        const data = filteredCouponUsageData.length > 0 ? filteredCouponUsageData : couponUsageData;
        
        if (data.length === 0) {
            alert('Nenhum dado para exportar');
            return;
        }
        
        // Criar CSV
        const headers = ['Data/Hora', 'Código Cupom', 'Cliente', 'Email', 'Produto', 'Valor Original', 'Desconto (%)', 'Valor Desconto', 'Valor Final'];
        const rows = data.map(u => {
            const orderValue = u.orderValue || 0;
            const discountAmount = u.discountAmount || 0;
            const finalValue = u.finalValue || (orderValue - discountAmount);
            const discountPercentage = u.discountPercentage || (orderValue > 0 ? ((discountAmount / orderValue) * 100).toFixed(2) : '0.00');
            const productName = u.productName || u.productId || 'N/A';
            const date = u.usedAt ? formatDateTime(u.usedAt) : 'N/A';
            
            return [
                date,
                u.couponCode || 'N/A',
                u.customerName || 'N/A',
                u.customerEmail || 'N/A',
                productName,
                orderValue.toFixed(2),
                discountPercentage,
                discountAmount.toFixed(2),
                finalValue.toFixed(2)
            ];
        });
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Download
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `cupons_uso_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        
    } catch (error) {
        console.error('❌ Erro ao exportar dados:', error);
        alert('Erro ao exportar dados: ' + error.message);
    }
}

// Abrir modal de criação de cupom
async function openCreateCouponModal() {
    const modal = document.getElementById('createCouponModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Limpar formulário
        const form = document.getElementById('createCouponForm');
        if (form) form.reset();
        
        // Popular select de afiliados (agora é async)
        await populateCouponAffiliateSelect();
    }
}

// Popular select de afiliados no modal de cupom
async function populateCouponAffiliateSelect() {
    const select = document.getElementById('couponAffiliateId');
    if (!select) return;
    
    // Limpar opções existentes (exceto a primeira)
    select.innerHTML = '<option value="">Carregando afiliados...</option>';
    
    // Se affiliatesData estiver vazio, carregar afiliados primeiro
    if (!affiliatesData || affiliatesData.length === 0) {
        try {
            await loadAffiliates();
        } catch (error) {
            console.error('Erro ao carregar afiliados:', error);
            select.innerHTML = '<option value="">Erro ao carregar afiliados</option>';
            return;
        }
    }
    
    // Limpar e adicionar opção padrão
    select.innerHTML = '<option value="">Nenhum afiliado</option>';
    
    // Adicionar afiliados ativos
    const activeAffiliates = affiliatesData.filter(a => a.affiliateStatus === 'active');
    
    if (activeAffiliates.length === 0) {
        select.innerHTML = '<option value="">Nenhum afiliado ativo</option>';
        return;
    }
    
    activeAffiliates.forEach(affiliate => {
        const option = document.createElement('option');
        option.value = affiliate.id;
        option.textContent = `${affiliate.name} (${affiliate.email})`;
        select.appendChild(option);
    });
}

// Fechar modal de criação/edição de cupom
function closeCreateCouponModal() {
    const modal = document.getElementById('createCouponModal');
    if (modal) {
        modal.classList.add('hidden');
        // Limpar ID de edição
        const editIdInput = document.getElementById('couponEditId');
        if (editIdInput) editIdInput.value = '';
        // Resetar título do modal
        const modalTitle = modal.querySelector('h3');
        if (modalTitle) modalTitle.textContent = 'Criar Novo Cupom';
        // Resetar botão de submit
        const submitBtn = document.querySelector('#createCouponForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Criar Cupom';
    }
}

// Editar cupom existente
async function editCoupon(couponId) {
    try {
        const coupon = couponsData.find(c => c.id === couponId);
        if (!coupon) {
            alert('Cupom não encontrado');
            return;
        }
        
        // Abrir modal
        const modal = document.getElementById('createCouponModal');
        if (!modal) {
            alert('Modal não encontrado');
            return;
        }
        
        modal.classList.remove('hidden');
        
        // Mudar título do modal
        const modalTitle = modal.querySelector('h3');
        if (modalTitle) modalTitle.textContent = 'Editar Cupom';
        
        // Popular select de afiliados (agora é async)
        await populateCouponAffiliateSelect();
        
        // Preencher formulário com dados do cupom
        document.getElementById('couponCode').value = coupon.code || '';
        document.getElementById('discountType').value = coupon.discountType || 'percentage';
        document.getElementById('discountValue').value = coupon.discountValue || 0;
        
        // Data de expiração
        if (coupon.expirationDate) {
            const expDate = coupon.expirationDate.toDate ? coupon.expirationDate.toDate() : new Date(coupon.expirationDate);
            const dateStr = expDate.toISOString().split('T')[0];
            document.getElementById('expirationDate').value = dateStr;
        } else {
            document.getElementById('expirationDate').value = '';
        }
        
        document.getElementById('couponUsageType').value = coupon.usageType || 'both';
        
        // Selecionar afiliado se houver
        if (coupon.affiliateId) {
            const affiliateSelect = document.getElementById('couponAffiliateId');
            if (affiliateSelect) {
                affiliateSelect.value = coupon.affiliateId;
            }
        }
        
        // Adicionar campo hidden com ID do cupom sendo editado
        let editIdInput = document.getElementById('couponEditId');
        if (!editIdInput) {
            editIdInput = document.createElement('input');
            editIdInput.type = 'hidden';
            editIdInput.id = 'couponEditId';
            document.getElementById('createCouponForm').appendChild(editIdInput);
        }
        editIdInput.value = couponId;
        
        // Mudar texto do botão de submit
        const submitBtn = document.querySelector('#createCouponForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Salvar Alterações';
        
    } catch (error) {
        console.error('Erro ao editar cupom:', error);
        alert('Erro ao carregar dados do cupom');
    }
}

// Criar ou atualizar cupom
async function createCoupon(event) {
    event.preventDefault();
    
    const editId = document.getElementById('couponEditId')?.value?.trim();
    const isEditing = !!editId;
    
    const affiliateIdValue = document.getElementById('couponAffiliateId')?.value?.trim() || null;
    
    const couponData = {
        code: document.getElementById('couponCode').value.toUpperCase().trim(),
        discountType: document.getElementById('discountType').value,
        discountValue: parseFloat(document.getElementById('discountValue').value),
        expirationDate: document.getElementById('expirationDate').value ? 
            new Date(document.getElementById('expirationDate').value) : null,
        usageType: document.getElementById('couponUsageType').value,
        specificEvents: [],
        affiliateId: affiliateIdValue || null // Vincular afiliado ao cupom
    };
    
    // Validações
    if (couponData.discountValue <= 0) {
        alert('O valor do desconto deve ser maior que zero');
        return;
    }
    
    if (couponData.discountType === 'percentage' && couponData.discountValue > 100) {
        alert('O desconto percentual não pode ser maior que 100%');
        return;
    }
    
    try {
        if (isEditing) {
            // Atualizar cupom existente
            
            
            const { doc, updateDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const couponRef = doc(window.firebaseDb, 'coupons', editId);
            const couponDoc = await getDoc(couponRef);
            
            if (!couponDoc.exists()) {
                alert('Cupom não encontrado');
                return;
            }
            
            const existingCoupon = couponDoc.data();
            
            // Verificar se o código mudou e se já existe outro cupom com esse código
            if (couponData.code !== existingCoupon.code) {
                const existingCouponWithCode = couponsData.find(c => c.code === couponData.code && c.id !== editId);
                if (existingCouponWithCode) {
                    alert('Já existe outro cupom com este código');
                    return;
                }
            }
            
            // Manter campos que não devem ser alterados
            couponData.isActive = existingCoupon.isActive;
            couponData.usageCount = existingCoupon.usageCount || 0;
            couponData.createdAt = existingCoupon.createdAt;
            couponData.createdBy = existingCoupon.createdBy;
            couponData.updatedAt = new Date();
            couponData.updatedBy = window.adminRoleLower || 'admin';
            
            await updateDoc(couponRef, couponData);
            
            
            // Log da ação
            await logAdminAction('update_coupon', `Atualizou cupom ${couponData.code} (${couponData.discountType === 'percentage' ? couponData.discountValue + '%' : 'R$ ' + couponData.discountValue})`);
            
            alert('Cupom atualizado com sucesso!');
        } else {           
            
            // Verificar se o código já existe
            const existingCoupon = couponsData.find(c => c.code === couponData.code);
            if (existingCoupon) {
                alert('Já existe um cupom com este código');
                return;
            }
            
            // Adicionar campos de criação
            couponData.isActive = true;
            couponData.usageCount = 0;
            couponData.createdAt = new Date();
            couponData.createdBy = window.adminRoleLower || 'admin';
            
            // Salvar no Firestore
            const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const docRef = await addDoc(collection(window.firebaseDb, 'coupons'), couponData);
            
            
            // Log da ação
            await logAdminAction('create_coupon', `Criou cupom ${couponData.code} (${couponData.discountType === 'percentage' ? couponData.discountValue + '%' : 'R$ ' + couponData.discountValue})`);
            
            alert('Cupom criado com sucesso!');
        }
        
        // Recarregar dados
        await loadCoupons();
        
        // Fechar modal
        closeCreateCouponModal();
        
    } catch (error) {
        console.error('❌ Erro ao salvar cupom:', error);
        alert('Erro ao salvar cupom: ' + error.message);
    }
}

// Alternar status do cupom
async function toggleCouponStatus(couponId, newStatus) {
    try {
        
        
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await updateDoc(doc(window.firebaseDb, 'coupons', couponId), {
            isActive: newStatus
        });
        
        // Log da ação
        const coupon = couponsData.find(c => c.id === couponId);
        await logAdminAction('toggle_coupon', `${newStatus ? 'Ativou' : 'Desativou'} cupom ${coupon?.code || couponId}`);
        
        // Recarregar dados
        await loadCoupons();
        
    } catch (error) {
        console.error('❌ Erro ao alterar status do cupom:', error);
        alert('Erro ao alterar status do cupom: ' + error.message);
    }
}

// Excluir cupom
async function deleteCoupon(couponId) {
    const coupon = couponsData.find(c => c.id === couponId);
    if (!coupon) return;
    
    if (!confirm(`Tem certeza que deseja excluir o cupom "${coupon.code}"?`)) {
        return;
    }
    
    try {
        
        
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await deleteDoc(doc(window.firebaseDb, 'coupons', couponId));
        
        // Log da ação
        await logAdminAction('delete_coupon', `Excluiu cupom ${coupon.code}`);
        
        // Recarregar dados
        await loadCoupons();
        
        alert('Cupom excluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao excluir cupom:', error);
        alert('Erro ao excluir cupom: ' + error.message);
    }
}

// ==================== HISTÓRICO DO ADMIN ====================

// Variáveis para histórico
let adminHistoryData = [];
let adminHistoryFilteredData = [];
let adminHistoryCurrentPage = 1;
const adminHistoryPerPage = 5;

// Carregar histórico do admin
async function loadAdminHistory() {
  try {
    
    const { collection, getDocsFromServer, orderBy, limit, query } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const historyCol = collection(window.firebaseDb, 'adminHistory');
    const q = query(historyCol, orderBy('timestamp', 'desc'), limit(50));
    const snapHistory = await getDocsFromServer(q);
    
    adminHistoryData = [];
    snapHistory.forEach(doc => {
      const data = doc.data();
      adminHistoryData.push({
        id: doc.id,
        ...data
      });
    });
    
    
    adminHistoryFilteredData = [...adminHistoryData]; // Inicializar dados filtrados
    renderAdminHistoryTable();
    updateAdminHistoryPagination();
  } catch (error) {
    console.error('❌ Erro ao carregar histórico do admin:', error);
    // Se não conseguir carregar, mostrar mensagem na tabela
    const tbody = document.getElementById('adminHistoryTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="py-6 text-center text-gray-500">
            Nenhum histórico encontrado. As ações aparecerão aqui conforme forem realizadas.
          </td>
        </tr>
      `;
    }
  }
}

// Renderizar tabela de histórico
function renderAdminHistoryTable() {
  const tbody = document.getElementById('adminHistoryTableBody');
  if (!tbody) return;
  
  const startIndex = (adminHistoryCurrentPage - 1) * adminHistoryPerPage;
  const endIndex = startIndex + adminHistoryPerPage;
  const historyPage = adminHistoryFilteredData.slice(startIndex, endIndex);
  
  tbody.innerHTML = historyPage.map(entry => `
    <tr class="border-b border-gray-100">
      <td class="py-3 px-2">
        <div class="text-xs text-gray-600">${formatDateTime(entry.timestamp)}</div>
      </td>
      <td class="py-3 px-2">
        <div class="space-y-1">
          <div class="font-medium text-xs text-gray-900">${entry.adminName || 'N/A'}</div>
        </div>
      </td>
      <td class="py-3 px-2">
        <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">${getActionDisplayName(entry.action)}</span>
      </td>
      <td class="py-3 px-2">
        <div class="text-xs text-gray-600 max-w-[200px] truncate" title="${entry.details || ''}">${entry.details || 'N/A'}</div>
      </td>
    </tr>
  `).join('');
  
  // Atualizar contador
  const countElement = document.getElementById('adminHistoryCount');
  if (countElement) {
    const totalActions = adminHistoryData.length;
    const filteredActions = adminHistoryFilteredData.length;
    if (filteredActions === totalActions) {
      countElement.textContent = `${totalActions} ações`;
    } else {
      countElement.textContent = `${filteredActions} de ${totalActions} ações`;
    }
  }
}
// Log de ação do admin
async function logAdminAction(action, details) {
  try {
    
    const { collection, addDoc, serverTimestamp, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const historyCol = collection(window.firebaseDb, 'adminHistory');
    
    // Coleta robusta dos dados do admin
    const sessionUser = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
    const authUser = (window.firebaseAuth && window.firebaseAuth.currentUser) ? window.firebaseAuth.currentUser : {};
    const uid = sessionUser.uid || authUser?.uid || null;
    let adminEmail = sessionUser.email || authUser?.email || 'N/A';
    let adminRole = sessionUser.role || (window.adminRoleLower || '').toLowerCase() || 'N/A';
    
    
    
    // Buscar dados completos do usuário para obter o nome
    let adminName = 'N/A';
    if (uid) {
      try {
        
        const userRef = doc(window.firebaseDb, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          
          
          // Tentar diferentes campos para o nome
          if (userData.name && userData.name.trim() !== '') {
            adminName = userData.name;
          } else if (userData.displayName && userData.displayName.trim() !== '') {
            adminName = userData.displayName;
          } else if (userData.email) {
            // Usar parte do email antes do @ como nome
            adminName = userData.email.split('@')[0];
          } else {
            adminName = 'Usuário';
          }

          // Completar email/role se faltarem
          if (adminEmail === 'N/A' && userData.email) adminEmail = userData.email;
          if (!adminRole || adminRole === 'N/A') adminRole = (userData.role || '').toLowerCase() || 'N/A';
          
          
        } else {
          console.warn('⚠️ Documento do usuário não existe no Firebase');
          // Usar parte do email como nome
          if (adminEmail && adminEmail !== 'N/A') {
            adminName = adminEmail.split('@')[0];
          } else {
            adminName = 'Usuário';
          }
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar nome do usuário:', error);
        // Usar parte do email como nome
        if (adminEmail && adminEmail !== 'N/A') {
          adminName = adminEmail.split('@')[0];
        } else {
          adminName = 'Usuário';
        }
      }
    } else {
      console.warn('⚠️ UID não encontrado na sessão');
      // Usar parte do email como nome
      if (adminEmail && adminEmail !== 'N/A') {
        adminName = adminEmail.split('@')[0];
      } else {
        adminName = 'Usuário';
      }
    }
    
    const logData = {
      action: action,
      details: details,
      adminName: adminName,
      timestamp: serverTimestamp()
    };
    
    
    
    await addDoc(historyCol, logData);
    
    
    // Recarregar histórico
    loadAdminHistory();
  } catch (error) {
    console.error('❌ Erro ao registrar ação do admin:', error);
    console.error('❌ Detalhes do erro:', error.message);
  }
}

// Obter nome de exibição da ação
function getActionDisplayName(action) {
  const actionNames = {
    'add_tokens': 'Adicionar Tokens',
    'remove_tokens': 'Remover Tokens',
    'change_role': 'Alterar Cargo',
    'login': 'Login',
    'logout': 'Logout',
    'export_data': 'Exportar Dados'
  };
  return actionNames[action] || action;
}

// Formatar data e hora
function formatDateTime(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Paginação do histórico
function updateAdminHistoryPagination() {
  const totalPages = Math.ceil(adminHistoryFilteredData.length / adminHistoryPerPage);
  const paginationContainer = document.getElementById('adminHistoryPagination');
  if (!paginationContainer) return;
  
  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }
  
  let paginationHTML = '';
  
  // Botão anterior
  if (adminHistoryCurrentPage > 1) {
    paginationHTML += `<button onclick="changeAdminHistoryPage(${adminHistoryCurrentPage - 1})" class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">‹</button>`;
  }
  
  // Páginas
  for (let i = 1; i <= totalPages; i++) {
    if (i === adminHistoryCurrentPage) {
      paginationHTML += `<button class="px-2 py-1 text-xs bg-blue-600 text-white rounded">${i}</button>`;
    } else {
      paginationHTML += `<button onclick="changeAdminHistoryPage(${i})" class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i}</button>`;
    }
  }
  
  // Botão próximo
  if (adminHistoryCurrentPage < totalPages) {
    paginationHTML += `<button onclick="changeAdminHistoryPage(${adminHistoryCurrentPage + 1})" class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">›</button>`;
  }
  
  paginationContainer.innerHTML = paginationHTML;
}

function changeAdminHistoryPage(page) {
  adminHistoryCurrentPage = page;
  renderAdminHistoryTable();
  updateAdminHistoryPagination();
}

// Filtrar histórico do admin
function filterAdminHistory() {
  const searchInput = document.getElementById('historySearchInput');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (searchTerm === '') {
    adminHistoryFilteredData = [...adminHistoryData];
  } else {
    adminHistoryFilteredData = adminHistoryData.filter(entry => 
      (entry.adminEmail && entry.adminEmail.toLowerCase().includes(searchTerm)) ||
      (entry.adminName && entry.adminName.toLowerCase().includes(searchTerm)) ||
      (entry.action && entry.action.toLowerCase().includes(searchTerm)) ||
      (entry.details && entry.details.toLowerCase().includes(searchTerm)) ||
      (entry.adminRole && entry.adminRole.toLowerCase().includes(searchTerm)) ||
      (getActionDisplayName(entry.action) && getActionDisplayName(entry.action).toLowerCase().includes(searchTerm))
    );
  }
  
  adminHistoryCurrentPage = 1; // Reset para primeira página
  renderAdminHistoryTable();
  updateAdminHistoryPagination();
}

// Expor funções globalmente
window.loadPermissionsUsers = loadPermissionsUsers;
// window.listAllSalesItems removido
window.updatePermissionsUserRole = updatePermissionsUserRole;
window.changePermissionsPage = changePermissionsPage;
window.loadTokensUsers = loadTokensUsers;
window.addTokens = addTokens;
window.removeTokens = removeTokens;
window.changeTokensPage = changeTokensPage;
window.filterTokensUsers = filterTokensUsers;
window.loadAdminHistory = loadAdminHistory;
window.changeAdminHistoryPage = changeAdminHistoryPage;
window.filterAdminHistory = filterAdminHistory;

// Expor funções de cupons globalmente
window.loadCoupons = loadCoupons;
window.loadCouponUsage = loadCouponUsage;

// ==================== SISTEMA DE AFILIADOS - ADMIN ====================

// Variáveis globais para afiliados
let affiliatesData = [];
let affiliateSalesData = [];

// Carregar afiliados
async function loadAffiliates() {
    try {
        
        const { collection, getDocs, query, where, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // Buscar usuários com role 'Afiliado'
        const usersRef = collection(window.firebaseDb, 'users');
        // Tentar com orderBy, se falhar, buscar sem orderBy
        let snapshot;
        try {
            const q = query(usersRef, where('role', '==', 'Afiliado'), orderBy('createdAt', 'desc'));
            snapshot = await getDocs(q);
        } catch (error) {
            // Se não houver índice, buscar sem orderBy
            console.warn('Índice não encontrado, buscando sem orderBy:', error);
            const q = query(usersRef, where('role', '==', 'Afiliado'));
            snapshot = await getDocs(q);
        }
        
        affiliatesData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Tratar createdAt de forma segura (pode ser Timestamp, Date, string ou número)
            let createdAt = new Date();
            if (data.createdAt) {
                if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
                    // É um Timestamp do Firestore
                    createdAt = data.createdAt.toDate();
                } else if (data.createdAt instanceof Date) {
                    // Já é uma Date
                    createdAt = data.createdAt;
                } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                    // É string ou número (timestamp)
                    createdAt = new Date(data.createdAt);
                }
            }
            
            affiliatesData.push({
                id: doc.id,
                email: data.email || '',
                name: data.name || data.displayName || data.email?.split('@')[0] || 'N/A',
                commissionRate: data.commissionRate || 10,
                commissionRateEvents: data.commissionRateEvents || data.commissionRate || 10,
                commissionRateProducts: data.commissionRateProducts || data.commissionRate || 10,
                status: data.affiliateStatus || 'active',
                affiliateStatus: data.affiliateStatus || 'active',
                managerId: data.managerId || null,
                managerEmail: data.managerEmail || null,
                managerCommissionRate: data.managerCommissionRate != null ? data.managerCommissionRate : 10,
                createdAt: createdAt
            });
        });
        
        
        
        // Carregar vendas e comissões para cada afiliado
        await loadAffiliateSales();
        
        // Popular filtro de afiliados
        populateAffiliateFilter();
        
        // Renderizar tabela
        renderAffiliatesTable();
        updateAffiliateStats();
        
        // Re-renderizar cupons para atualizar nomes de afiliados vinculados
        if (couponsData.length > 0) {
            renderCouponsTable();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar afiliados:', error);
        const tbody = document.getElementById('affiliatesTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-red-500">Erro ao carregar afiliados</td></tr>';
        }
    }
}

// Carregar vendas de afiliados
async function loadAffiliateSales() {
    try {
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const salesRef = collection(window.firebaseDb, 'affiliate_sales');
        
        // Tentar com orderBy, se falhar, buscar sem orderBy
        let snapshot;
        try {
            const q = query(salesRef, orderBy('createdAt', 'desc'));
            snapshot = await getDocs(q);
        } catch (error) {
            // Se não houver índice, buscar sem orderBy
            console.warn('Índice não encontrado para affiliate_sales, buscando sem orderBy:', error);
            const q = query(salesRef);
            snapshot = await getDocs(q);
        }
        
        affiliateSalesData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Tratar createdAt de forma segura (pode ser Timestamp, Date, string ou número)
            let createdAt = new Date();
            if (data.createdAt) {
                if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
                    // É um Timestamp do Firestore
                    createdAt = data.createdAt.toDate();
                } else if (data.createdAt instanceof Date) {
                    // Já é uma Date
                    createdAt = data.createdAt;
                } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                    // É string ou número (timestamp)
                    createdAt = new Date(data.createdAt);
                }
            }
            
            affiliateSalesData.push({
                id: doc.id,
                ...data,
                createdAt: createdAt
            });
        });
        
        
        renderAffiliateSalesTable();
    } catch (error) {
        console.error('❌ Erro ao carregar vendas de afiliados:', error);
    }
}

// Popular filtro de afiliados
function populateAffiliateFilter() {
    const select = document.getElementById('affiliateSalesFilter');
    if (!select) return;
    
    select.innerHTML = '<option value="all">Todos os afiliados</option>';
    affiliatesData.forEach(affiliate => {
        const option = document.createElement('option');
        option.value = affiliate.id;
        option.textContent = `${affiliate.name} (${affiliate.email})`;
        select.appendChild(option);
    });
}

// Filtrar tabela de afiliados por busca individual
function filterAffiliatesTable() {
    const search = (document.getElementById('affiliateSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('affiliateStatusFilter')?.value || 'all';

    const filtered = affiliatesData.filter(a => {
        const matchSearch = !search ||
            (a.name || '').toLowerCase().includes(search) ||
            (a.email || '').toLowerCase().includes(search);
        const matchStatus = statusFilter === 'all' || (a.status || 'active') === statusFilter;
        return matchSearch && matchStatus;
    });

    const tbody = document.getElementById('affiliatesTableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-gray-500">Nenhum afiliado encontrado para "${search}"</td></tr>`;
        return;
    }
    renderAffiliatesRows(filtered, tbody);
}

// Renderizar tabela de afiliados
function renderAffiliatesTable() {
    const tbody = document.getElementById('affiliatesTableBody');
    if (!tbody) return;

    if (affiliatesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-gray-500">Nenhum afiliado encontrado</td></tr>';
        return;
    }
    renderAffiliatesRows(affiliatesData, tbody);
}

function renderAffiliatesRows(affiliatesList, tbody) {
    tbody.innerHTML = affiliatesList.map(affiliate => {
        // Calcular estatísticas do afiliado
        const sales = affiliateSalesData.filter(s => s.affiliateId === affiliate.id);
        const totalSales = sales.length;
        const totalCommission = sales.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
        const pendingCommission = sales
            .filter(s => s.status === 'pending')
            .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
        
        const statusBadge = affiliate.status === 'active'
            ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Ativo</span>'
            : '<span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Inativo</span>';
        
        const managerBadge = affiliate.managerEmail
            ? `<div class="mt-1"><span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">👔 ${affiliate.managerEmail.split('@')[0]} (${affiliate.managerCommissionRate ?? 10}%)</span></div>`
            : '';

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-2 text-xs font-medium">${affiliate.name}</td>
                <td class="py-2 px-2 text-xs">
                    <div>${affiliate.email}</div>
                    ${managerBadge}
                </td>
                <td class="py-2 px-2 text-xs">
                    <div>Eventos: ${affiliate.commissionRateEvents || affiliate.commissionRate || 10}%</div>
                    <div class="text-gray-500">Produtos: ${affiliate.commissionRateProducts || affiliate.commissionRate || 10}%</div>
                </td>
                <td class="py-2 px-2 text-xs">${totalSales}</td>
                <td class="py-2 px-2 text-xs font-medium">R$ ${totalCommission.toFixed(2)}</td>
                <td class="py-2 px-2 text-xs text-orange-600">R$ ${pendingCommission.toFixed(2)}</td>
                <td class="py-2 px-2 text-xs">${statusBadge}</td>
                <td class="py-2 px-2 text-xs">
                    <div class="flex gap-1 flex-wrap">
                        <button onclick="editAffiliate('${affiliate.id}')" 
                                class="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs">
                            Editar
                        </button>
                        <button onclick="viewAffiliateDetails('${affiliate.id}')" 
                                class="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs">
                            Detalhes
                        </button>
                        <button onclick="deleteAffiliate('${affiliate.id}', '${(affiliate.name || '').replace(/'/g, "\\'")}')" 
                                class="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs">
                            Excluir
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Renderizar tabela de vendas de afiliados
function renderAffiliateSalesTable() {
    const tbody = document.getElementById('affiliateSalesTableBody');
    if (!tbody) return;
    
    const affiliateFilter = document.getElementById('affiliateSalesFilter')?.value || 'all';
    const statusFilter = document.getElementById('affiliateSalesStatusFilter')?.value || 'all';
    
    let filteredSales = affiliateSalesData;
    
    if (affiliateFilter !== 'all') {
        filteredSales = filteredSales.filter(s => s.affiliateId === affiliateFilter);
    }
    
    if (statusFilter !== 'all') {
        filteredSales = filteredSales.filter(s => s.status === statusFilter);
    }
    
    if (filteredSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-gray-500">Nenhuma venda encontrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredSales.map(sale => {
        const affiliate = affiliatesData.find(a => a.id === sale.affiliateId);
        const date = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('pt-BR') : 'N/A';
        const statusBadge = sale.status === 'paid'
            ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Paga</span>'
            : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pendente</span>';
        
        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-2 text-xs">${date}</td>
                <td class="py-2 px-2 text-xs">${affiliate?.name || sale.affiliateId || 'N/A'}</td>
                <td class="py-2 px-2 text-xs">${sale.customerName || sale.customerEmail || 'N/A'}</td>
                <td class="py-2 px-2 text-xs">
                    <div>${sale.productName || sale.productId || 'N/A'}</div>
                    <div class="text-xs text-gray-500">${sale.saleType === 'event' ? '📅 Evento' : '🛒 Produto'}</div>
                </td>
                <td class="py-2 px-2 text-xs font-medium">R$ ${(sale.saleValue || 0).toFixed(2)}</td>
                <td class="py-2 px-2 text-xs">${(sale.commissionRate || 0).toFixed(1)}%</td>
                <td class="py-2 px-2 text-xs font-medium text-green-600">R$ ${(sale.commissionAmount || 0).toFixed(2)}</td>
                <td class="py-2 px-2 text-xs">${statusBadge}</td>
                <td class="py-2 px-2 text-xs">
                    ${sale.status === 'pending' ? `
                        <button onclick="approveAffiliateCommission('${sale.id}')" 
                                class="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs">
                            Aprovar
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// Atualizar estatísticas de afiliados
function updateAffiliateStats() {
    const totalAffiliates = affiliatesData.length;
    const totalSales = affiliateSalesData.length;
    const totalCommission = affiliateSalesData.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
    const pendingCommission = affiliateSalesData
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
    
    const statsTotal = document.getElementById('affiliateStatsTotal');
    const statsSales = document.getElementById('affiliateStatsSales');
    const statsCommission = document.getElementById('affiliateStatsCommission');
    const statsPending = document.getElementById('affiliateStatsPending');
    
    if (statsTotal) statsTotal.textContent = totalAffiliates;
    if (statsSales) statsSales.textContent = totalSales;
    if (statsCommission) statsCommission.textContent = `R$ ${totalCommission.toFixed(2).replace('.', ',')}`;
    if (statsPending) statsPending.textContent = `R$ ${pendingCommission.toFixed(2).replace('.', ',')}`;
}

// Abrir modal de criação de afiliado
function openCreateAffiliateModal() {
    const modal = document.getElementById('createAffiliateModal');
    const title = document.getElementById('affiliateModalTitle');
    const form = document.getElementById('createAffiliateForm');
    const editId = document.getElementById('affiliateEditId');
    
    if (modal) {
        modal.classList.remove('hidden');
        if (title) title.textContent = 'Criar Novo Afiliado';
        if (form) form.reset();
        if (editId) editId.value = '';
    }
}

// Fechar modal de criação de afiliado
function closeCreateAffiliateModal() {
    const modal = document.getElementById('createAffiliateModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Mostrar/ocultar campo de comissão do gerente conforme e-mail preenchido
window.toggleManagerCommissionField = function() {
    const emailVal = (document.getElementById('affiliateManagerEmail')?.value || '').trim();
    const wrap = document.getElementById('affiliateManagerCommissionWrap');
    if (wrap) wrap.classList.toggle('hidden', !emailVal);
};

// Criar/editar afiliado
async function createOrUpdateAffiliate(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('affiliateEmail')?.value?.trim();
    const commissionRateEvents = parseFloat(document.getElementById('affiliateCommissionRateEvents')?.value || 0);
    const commissionRateProducts = parseFloat(document.getElementById('affiliateCommissionRateProducts')?.value || 0);
    const status = document.getElementById('affiliateStatus')?.value || 'active';
    const editId = document.getElementById('affiliateEditId')?.value;
    const managerEmail = (document.getElementById('affiliateManagerEmail')?.value || '').trim().toLowerCase() || null;
    const managerCommissionRate = managerEmail ? parseFloat(document.getElementById('affiliateManagerCommissionRate')?.value || 10) : null;

    if (!email) {
        showToast('error', 'Email é obrigatório', 'Erro');
        return;
    }
    if (commissionRateEvents < 0 || commissionRateEvents > 100) {
        showToast('error', 'Percentual de comissão de eventos deve estar entre 0 e 100', 'Erro');
        return;
    }
    if (commissionRateProducts < 0 || commissionRateProducts > 100) {
        showToast('error', 'Percentual de comissão de produtos deve estar entre 0 e 100', 'Erro');
        return;
    }
    if (managerEmail && (managerCommissionRate < 0 || managerCommissionRate > 100)) {
        showToast('error', 'Comissão do gerente deve estar entre 0 e 100', 'Erro');
        return;
    }

    try {
        const { collection, query, where, getDocs, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const usersRef = collection(window.firebaseDb, 'users');

        // Buscar usuário do afiliado pelo email
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            showToast('error', 'Usuário não encontrado. O usuário deve estar cadastrado no sistema primeiro.', 'Erro');
            return;
        }
        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;

        // Resolver UID do gerente pelo e-mail (se informado)
        let managerId = null;
        if (managerEmail) {
            try {
                const mqSnap = await getDocs(query(usersRef, where('email', '==', managerEmail)));
                if (!mqSnap.empty) managerId = mqSnap.docs[0].id;
                else showToast('warning', `Gerente "${managerEmail}" não encontrado no sistema — vínculo salvo apenas com o e-mail.`, 'Aviso');
            } catch (_) {}
        }

        // Atualizar role e dados do afiliado
        await updateDoc(doc(window.firebaseDb, 'users', userId), {
            role: 'Afiliado',
            commissionRate: commissionRateEvents,
            commissionRateEvents: commissionRateEvents,
            commissionRateProducts: commissionRateProducts,
            affiliateStatus: status,
            managerId: managerId || null,
            managerEmail: managerEmail || null,
            managerCommissionRate: managerEmail ? managerCommissionRate : null,
            updatedAt: new Date()
        });

        const gerenteMsg = managerEmail ? ` | gerente: ${managerEmail} (${managerCommissionRate}%)` : '';
        await logAdminAction('manage_affiliate', editId
            ? `Editou afiliado ${email}${gerenteMsg}`
            : `Criou afiliado ${email} — eventos:${commissionRateEvents}% produtos:${commissionRateProducts}%${gerenteMsg}`);

        await loadAffiliates();
        closeCreateAffiliateModal();
        showToast('success', editId ? 'Afiliado atualizado com sucesso!' : 'Afiliado criado com sucesso!', 'Sucesso');
    } catch (error) {
        console.error('❌ Erro ao criar/editar afiliado:', error);
        showToast('error', 'Erro ao criar/editar afiliado: ' + error.message, 'Erro');
    }
}

// Editar afiliado
function editAffiliate(affiliateId) {
    const affiliate = affiliatesData.find(a => a.id === affiliateId);
    if (!affiliate) return;
    
    const modal = document.getElementById('createAffiliateModal');
    const title = document.getElementById('affiliateModalTitle');
    const emailInput = document.getElementById('affiliateEmail');
    const commissionEventsInput = document.getElementById('affiliateCommissionRateEvents');
    const commissionProductsInput = document.getElementById('affiliateCommissionRateProducts');
    const statusSelect = document.getElementById('affiliateStatus');
    const editId = document.getElementById('affiliateEditId');
    
    if (modal) {
        modal.classList.remove('hidden');
        if (title) title.textContent = 'Editar Afiliado';
        if (emailInput) emailInput.value = affiliate.email;
        if (commissionEventsInput) commissionEventsInput.value = affiliate.commissionRateEvents || affiliate.commissionRate || 10;
        if (commissionProductsInput) commissionProductsInput.value = affiliate.commissionRateProducts || affiliate.commissionRate || 10;
        if (statusSelect) statusSelect.value = affiliate.status;
        if (editId) editId.value = affiliateId;

        // Preencher campos do gerente
        const mgrEmailEl = document.getElementById('affiliateManagerEmail');
        const mgrRateEl  = document.getElementById('affiliateManagerCommissionRate');
        const mgrWrap    = document.getElementById('affiliateManagerCommissionWrap');
        if (mgrEmailEl) mgrEmailEl.value = affiliate.managerEmail || '';
        if (mgrRateEl)  mgrRateEl.value  = affiliate.managerCommissionRate != null ? affiliate.managerCommissionRate : 10;
        if (mgrWrap)    mgrWrap.classList.toggle('hidden', !affiliate.managerEmail);
    }
}

// Ver detalhes do afiliado — modal completo com vendas + histórico de saque
async function viewAffiliateDetails(affiliateId) {
    const affiliate = affiliatesData.find(a => a.id === affiliateId);
    if (!affiliate) return;

    // Criar/reusar modal overlay
    let overlay = document.getElementById('affiliateDetailsOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'affiliateDetailsOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 10px';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    const sales = affiliateSalesData.filter(s => s.affiliateId === affiliateId);
    const totalCommission = sales.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
    const pendingCommission = sales.filter(s => s.status === 'pending').reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
    const paidCommission = sales.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.commissionAmount || 0), 0);

    const statusBadge = affiliate.status === 'active'
        ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Ativo</span>'
        : '<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Inativo</span>';

    const salesRows = sales.length === 0
        ? '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400 text-sm">Nenhuma venda registrada</td></tr>'
        : sales.map(s => {
            const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—';
            const badge = s.status === 'paid'
                ? '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">Paga</span>'
                : '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">Pendente</span>';
            const icon = s.saleType === 'event' ? '📅' : '🛒';
            return `<tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
                <td class="px-3 py-2">${date}</td>
                <td class="px-3 py-2">${s.customerName || s.customerEmail || '—'}</td>
                <td class="px-3 py-2">${icon} ${s.productName || s.productId || '—'}</td>
                <td class="px-3 py-2">R$ ${(s.saleValue || 0).toFixed(2)}</td>
                <td class="px-3 py-2 font-medium text-green-700">R$ ${(s.commissionAmount || 0).toFixed(2)}</td>
                <td class="px-3 py-2">${badge}</td>
            </tr>`;
        }).join('');

    overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;width:100%;max-width:860px;box-shadow:0 20px 60px rgba(0,0,0,0.25);overflow:hidden;margin:auto">
            <!-- Cabeçalho -->
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:20px 24px;display:flex;align-items:center;justify-content:space-between">
                <div>
                    <div style="color:#fff;font-size:18px;font-weight:700">${affiliate.name}</div>
                    <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">${affiliate.email}</div>
                </div>
                <button onclick="document.getElementById('affiliateDetailsOverlay').style.display='none'"
                        style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center">&times;</button>
            </div>

            <!-- Stats -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;padding:16px 24px;background:#f9fafb;border-bottom:1px solid #e5e7eb">
                <div style="text-align:center">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:2px">Status</div>
                    <div>${statusBadge}</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:2px">Vendas</div>
                    <div style="font-size:20px;font-weight:700;color:#1f2937">${sales.length}</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:2px">Comissão Total</div>
                    <div style="font-size:18px;font-weight:700;color:#059669">R$ ${totalCommission.toFixed(2)}</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:2px">Pago</div>
                    <div style="font-size:18px;font-weight:700;color:#2563eb">R$ ${paidCommission.toFixed(2)}</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:2px">Pendente</div>
                    <div style="font-size:18px;font-weight:700;color:#d97706">R$ ${pendingCommission.toFixed(2)}</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:2px">Comissão</div>
                    <div style="font-size:14px;font-weight:600;color:#374151">Eventos ${affiliate.commissionRateEvents || affiliate.commissionRate || 10}% / Prod. ${affiliate.commissionRateProducts || affiliate.commissionRate || 10}%</div>
                </div>
            </div>

            <!-- Ações do Admin -->
            <div style="padding:12px 24px;background:#fafafa;border-bottom:1px solid #e5e7eb;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span style="font-size:12px;color:#6b7280;font-weight:600;margin-right:4px">AÇÕES:</span>
                <button onclick="descontarComissaoAfiliado('${affiliateId}', '${affiliate.name.replace(/'/g, "\\'")}')"
                        style="background:#dc2626;color:#fff;border:none;padding:7px 14px;border-radius:8px;font-weight:600;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px">
                    💸 Descontar Comissão
                </button>
            </div>

            <!-- Abas -->
            <div style="padding:20px 24px">
                <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:2px solid #e5e7eb">
                    <button id="tabVendas" onclick="switchAffiliateTab('vendas')"
                            style="padding:8px 16px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid #4f46e5;margin-bottom:-2px;color:#4f46e5">
                        💰 Suas Vendas (${sales.length})
                    </button>
                    <button id="tabSaques" onclick="switchAffiliateTab('saques')"
                            style="padding:8px 16px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:#6b7280">
                        💸 Histórico de Saque
                    </button>
                </div>

                <!-- Vendas -->
                <div id="affiliateTabVendas">
                    <div style="overflow-x:auto;border-radius:8px;border:1px solid #e5e7eb">
                        <table style="width:100%;border-collapse:collapse;font-size:13px">
                            <thead style="background:#f3f4f6">
                                <tr>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Data</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Cliente</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Produto</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Valor</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Comissão</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                                </tr>
                            </thead>
                            <tbody>${salesRows}</tbody>
                        </table>
                    </div>
                </div>

                <!-- Saques -->
                <div id="affiliateTabSaques" style="display:none">
                    <div style="overflow-x:auto;border-radius:8px;border:1px solid #e5e7eb">
                        <table style="width:100%;border-collapse:collapse;font-size:13px">
                            <thead style="background:#f3f4f6">
                                <tr>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Data</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Valor</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Chave PIX</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Titular</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Processado em</th>
                                </tr>
                            </thead>
                            <tbody id="affiliateDetailsPayoutsBody">
                                <tr><td colspan="6" class="px-4 py-6 text-center text-gray-400 text-sm">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>Carregando saques...
                                </td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;

    // Fechar ao clicar fora
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };

    // Carregar saques do afiliado
    _loadAffiliatePayoutsForAdmin(affiliateId);
}

function switchAffiliateTab(tab) {
    const tabVendas  = document.getElementById('affiliateTabVendas');
    const tabSaques  = document.getElementById('affiliateTabSaques');
    const btnVendas  = document.getElementById('tabVendas');
    const btnSaques  = document.getElementById('tabSaques');
    if (!tabVendas || !tabSaques) return;
    if (tab === 'vendas') {
        tabVendas.style.display = '';
        tabSaques.style.display = 'none';
        btnVendas.style.borderBottomColor = '#4f46e5'; btnVendas.style.color = '#4f46e5';
        btnSaques.style.borderBottomColor = 'transparent'; btnSaques.style.color = '#6b7280';
    } else {
        tabVendas.style.display = 'none';
        tabSaques.style.display = '';
        btnVendas.style.borderBottomColor = 'transparent'; btnVendas.style.color = '#6b7280';
        btnSaques.style.borderBottomColor = '#4f46e5'; btnSaques.style.color = '#4f46e5';
    }
}
window.switchAffiliateTab = switchAffiliateTab;

async function _loadAffiliatePayoutsForAdmin(affiliateId) {
    const tbody = document.getElementById('affiliateDetailsPayoutsBody');
    if (!tbody) return;
    try {
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(query(
            collection(window.firebaseDb, 'affiliate_payouts'),
            where('affiliateId', '==', affiliateId)
        ));
        const payouts = [];
        snap.forEach(d => {
            const data = d.data();
            payouts.push({ id: d.id, ...data,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                processedAt: data.processedAt?.toDate?.() || null });
        });
        payouts.sort((a, b) => b.createdAt - a.createdAt);

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400 text-sm">Nenhum saque solicitado</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => {
            const date = p.createdAt.toLocaleDateString('pt-BR');
            const proc = p.processedAt ? p.processedAt.toLocaleDateString('pt-BR') : '—';
            const badge = p.status === 'approved'
                ? '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">✅ Aprovado</span>'
                : p.status === 'rejected'
                    ? `<span class="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs" title="${p.rejectionReason || ''}">❌ Recusado</span>`
                    : '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">⏳ Pendente</span>';
            return `<tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
                <td class="px-3 py-2">${date}</td>
                <td class="px-3 py-2 font-medium text-blue-700">R$ ${(p.amount || 0).toFixed(2)}</td>
                <td class="px-3 py-2 font-mono text-xs">${p.pixKey || '—'}</td>
                <td class="px-3 py-2">${p.pixAccountName || '—'}</td>
                <td class="px-3 py-2">${badge}</td>
                <td class="px-3 py-2 text-gray-500">${proc}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-red-500 text-sm">Erro ao carregar: ${err.message}</td></tr>`;
    }
}

// Excluir afiliado — remove o role Afiliado e limpa campos na coleção users
async function deleteAffiliate(affiliateId, affiliateName) {
    if (!confirm(`⚠️ Deseja remover o afiliado "${affiliateName}"?\n\nO usuário continuará existindo mas perderá o acesso à área de afiliado.\nAs vendas e comissões registradas não serão apagadas.\n\nEssa ação não pode ser desfeita.`)) return;
    try {
        const { doc, updateDoc, deleteField } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // O ID na lista é o uid do documento em /users
        await updateDoc(doc(window.firebaseDb, 'users', affiliateId), {
            role: 'user',
            affiliateStatus: deleteField(),
            affiliate: deleteField(),
            affiliateCode: deleteField(),
            commissionRate: deleteField(),
            commissionRateEvents: deleteField(),
            commissionRateProducts: deleteField(),
        });

        affiliatesData = affiliatesData.filter(a => a.id !== affiliateId);
        renderAffiliatesTable();
        showToast('success', `Afiliado "${affiliateName}" removido com sucesso.`, 'Concluído');
    } catch (err) {
        console.error('Erro ao remover afiliado:', err);
        showToast('error', 'Erro ao remover: ' + (err.message || err), 'Erro');
    }
}
window.deleteAffiliate = deleteAffiliate;

// ── Descontar / Quitar comissão manualmente ───────────────────────────────────
window.descontarComissaoAfiliado = async function (affiliateId, affiliateName) {
    // Calcular saldo pendente atual
    const pendente = affiliateSalesData
        .filter(s => s.affiliateId === affiliateId && s.status === 'pending')
        .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);

    const msg = `Descontar comissão de ${affiliateName}\n\nSaldo pendente: R$ ${pendente.toFixed(2)}\n\nValor a descontar (ex: 15.00):`;
    const valorStr = prompt(msg, pendente > 0 ? pendente.toFixed(2) : '');
    if (!valorStr) return;

    const valor = parseFloat(valorStr.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
        alert('Valor inválido. Informe um número positivo.');
        return;
    }

    const motivo = prompt(`Motivo / descrição (opcional):\n(ex: Pix enviado em ${new Date().toLocaleDateString('pt-BR')})`) || 'Desconto manual de comissão';

    if (!confirm(`Confirmar desconto de R$ ${valor.toFixed(2)} para ${affiliateName}?\n\nMotivo: ${motivo}`)) return;

    try {
        const { collection, doc, addDoc, updateDoc, serverTimestamp } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // 1. Registrar em affiliate_payouts como pagamento aprovado
        await addDoc(collection(window.firebaseDb, 'affiliate_payouts'), {
            affiliateId,
            affiliateName,
            amount: valor,
            status: 'approved',
            type: 'manual_deduction',
            notes: motivo,
            processedBy: window.firebaseAuth?.currentUser?.email || 'admin',
            processedAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });

        // 2. Marcar vendas pendentes como 'paid' do mais antigo pro mais novo até cobrir o valor
        const vendasPendentes = affiliateSalesData
            .filter(s => s.affiliateId === affiliateId && s.status === 'pending')
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        let restante = valor;
        for (const venda of vendasPendentes) {
            if (restante <= 0) break;
            await updateDoc(doc(window.firebaseDb, 'affiliate_sales', venda.id), {
                status: 'paid',
                paidAt: serverTimestamp()
            });
            // Atualizar cache local
            const idx = affiliateSalesData.findIndex(s => s.id === venda.id);
            if (idx >= 0) affiliateSalesData[idx].status = 'paid';
            restante -= (venda.commissionAmount || 0);
        }

        showToast('success', `R$ ${valor.toFixed(2)} descontado de ${affiliateName} com sucesso.`, 'Concluído', 5000);

        // Reabrir o modal para refletir os novos valores
        await viewAffiliateDetails(affiliateId);

    } catch (err) {
        console.error('[Afiliados] Erro ao descontar comissão:', err);
        showToast('error', 'Erro ao registrar desconto: ' + (err.message || err), 'Erro');
    }
};

// Aprovar comissão de afiliado
async function approveAffiliateCommission(saleId) {
    if (!confirm('Deseja aprovar e marcar esta comissão como paga?')) {
        return;
    }
    
    try {
        const { doc, updateDoc, collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        await updateDoc(doc(window.firebaseDb, 'affiliate_sales', saleId), {
            status: 'paid',
            paidAt: new Date(),
            paidBy: window.adminRoleLower || 'admin'
        });
        
        // Criar registro de comissão paga
        const sale = affiliateSalesData.find(s => s.id === saleId);
        if (sale) {
            await addDoc(collection(window.firebaseDb, 'affiliate_commissions'), {
                affiliateId: sale.affiliateId,
                saleId: saleId,
                amount: sale.commissionAmount,
                status: 'paid',
                paymentMethod: 'Manual',
                createdAt: new Date(),
                paidAt: new Date()
            });
        }
        
        await logAdminAction('approve_commission', `Aprovou comissão de venda ${saleId}`);
        
        // Recarregar dados
        await loadAffiliateSales();
        await loadAffiliates();
        
        alert('Comissão aprovada e marcada como paga!');
    } catch (error) {
        console.error('❌ Erro ao aprovar comissão:', error);
        alert('Erro ao aprovar comissão: ' + error.message);
    }
}

// Expor funções globalmente
window.loadAffiliates = loadAffiliates;
window.openCreateAffiliateModal = openCreateAffiliateModal;
window.closeCreateAffiliateModal = closeCreateAffiliateModal;
window.editAffiliate = editAffiliate;
window.viewAffiliateDetails = viewAffiliateDetails;
window.approveAffiliateCommission = approveAffiliateCommission;

// ============================================================
// GERENCIAMENTO DE SAQUES DE AFILIADOS
// ============================================================

let _allPayouts = [];

async function loadAffiliatePayouts() {
    try {
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(query(collection(window.firebaseDb, 'affiliate_payouts'), orderBy('createdAt', 'desc')));
        _allPayouts = [];
        snap.forEach(d => {
            const data = d.data();
            _allPayouts.push({
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
                processedAt: data.processedAt?.toDate?.() || (data.processedAt ? new Date(data.processedAt) : null)
            });
        });
        _updatePayoutStats();
        filterAffiliatePayouts();
    } catch (err) {
        console.error('Erro ao carregar saques:', err);
        const tb = document.getElementById('affiliatePayoutsTableBody');
        if (tb) tb.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-red-500">Erro ao carregar saques</td></tr>';
    }
}

function _updatePayoutStats() {
    const pending = _allPayouts.filter(p => p.status === 'pending');
    const approved = _allPayouts.filter(p => p.status === 'approved');
    const rejected = _allPayouts.filter(p => p.status === 'rejected');
    const approvedTotal = approved.reduce((s, p) => s + (p.amount || 0), 0);
    const pendingEl = document.getElementById('payoutsPendingCount');
    const approvedEl = document.getElementById('payoutsApprovedTotal');
    const rejectedEl = document.getElementById('payoutsRejectedCount');
    if (pendingEl) pendingEl.textContent = pending.length;
    if (approvedEl) approvedEl.textContent = `R$ ${approvedTotal.toFixed(2).replace('.', ',')}`;
    if (rejectedEl) rejectedEl.textContent = rejected.length;
}

function filterAffiliatePayouts() {
    const filter = document.getElementById('payoutsStatusFilter')?.value || 'all';
    const filtered = filter === 'all' ? _allPayouts : _allPayouts.filter(p => p.status === filter);
    renderAffiliatePayoutsTable(filtered);
}

function renderAffiliatePayoutsTable(payouts) {
    const tb = document.getElementById('affiliatePayoutsTableBody');
    if (!tb) return;
    if (payouts.length === 0) {
        tb.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-400">Nenhuma solicitação encontrada</td></tr>';
        return;
    }
    tb.innerHTML = payouts.map(p => {
        const date = p.createdAt ? p.createdAt.toLocaleDateString('pt-BR') : '—';
        const statusBadge = p.status === 'approved'
            ? '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">Aprovado</span>'
            : p.status === 'rejected'
            ? '<span class="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">Recusado</span>'
            : '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Pendente</span>';
        const obs = p.rejectionReason
            ? `<span class="text-red-600">${escapeAdminHtml(p.rejectionReason)}</span>`
            : (p.status === 'approved' ? `<span class="text-gray-400 text-xs">Aprovado em ${p.processedAt ? p.processedAt.toLocaleDateString('pt-BR') : '—'}</span>` : '—');
        const actions = p.status === 'pending'
            ? `<div class="flex gap-1">
                 <button onclick="approveAffiliatePayout('${p.id}')" class="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs">✓ Aprovar</button>
                 <button onclick="rejectAffiliatePayout('${p.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs">✗ Recusar</button>
               </div>`
            : `<span class="text-gray-400 text-xs">${p.processedBy ? `por ${escapeAdminHtml(p.processedBy)}` : '—'}</span>`;
        return `<tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-2 px-3">${date}</td>
            <td class="py-2 px-3">
                <div class="font-medium">${escapeAdminHtml(p.affiliateName || p.affiliateEmail || '—')}</div>
                <div class="text-gray-400 text-xs">${escapeAdminHtml(p.affiliateEmail || '')}</div>
            </td>
            <td class="py-2 px-3 font-semibold text-green-700">R$ ${(p.amount || 0).toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 font-mono text-xs max-w-[140px] truncate" title="${escapeAdminHtml(p.pixKey || '')}">${escapeAdminHtml(p.pixKey || '—')}</td>
            <td class="py-2 px-3">${escapeAdminHtml(p.pixAccountName || '—')}</td>
            <td class="py-2 px-3">${statusBadge}</td>
            <td class="py-2 px-3 max-w-[160px]">${obs}</td>
            <td class="py-2 px-3">${actions}</td>
        </tr>`;
    }).join('');
}

async function approveAffiliatePayout(payoutId) {
    if (!confirm('Confirmar aprovação deste saque?')) return;
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const adminEmail = window.firebaseAuth?.currentUser?.email || 'admin';
        await updateDoc(doc(window.firebaseDb, 'affiliate_payouts', payoutId), {
            status: 'approved',
            processedAt: new Date(),
            processedBy: adminEmail
        });
        showToast('success', 'Saque aprovado com sucesso!', 'Saque');
        await loadAffiliatePayouts();
    } catch (err) {
        console.error('Erro ao aprovar saque:', err);
        alert('Erro ao aprovar saque: ' + err.message);
    }
}

async function rejectAffiliatePayout(payoutId) {
    const reason = prompt('Digite a justificativa para recusar o saque:\n(Esta mensagem será visível ao afiliado)');
    if (reason === null) return;
    if (!reason.trim()) { alert('A justificativa não pode estar em branco.'); return; }
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const adminEmail = window.firebaseAuth?.currentUser?.email || 'admin';
        await updateDoc(doc(window.firebaseDb, 'affiliate_payouts', payoutId), {
            status: 'rejected',
            rejectionReason: reason.trim(),
            processedAt: new Date(),
            processedBy: adminEmail
        });
        showToast('success', 'Saque recusado.', 'Saque');
        await loadAffiliatePayouts();
    } catch (err) {
        console.error('Erro ao recusar saque:', err);
        alert('Erro ao recusar saque: ' + err.message);
    }
}

window.loadAffiliatePayouts = loadAffiliatePayouts;
window.filterAffiliatePayouts = filterAffiliatePayouts;
window.approveAffiliatePayout = approveAffiliatePayout;
window.rejectAffiliatePayout = rejectAffiliatePayout;

// Configurar formulário e filtros
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createAffiliateForm');
    if (form) {
        form.addEventListener('submit', createOrUpdateAffiliate);
    }
    
    // Configurar filtros de vendas
    const affiliateFilter = document.getElementById('affiliateSalesFilter');
    const statusFilter = document.getElementById('affiliateSalesStatusFilter');
    
    if (affiliateFilter) {
        affiliateFilter.addEventListener('change', () => {
            renderAffiliateSalesTable();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            renderAffiliateSalesTable();
        });
    }
});

// Configurar event listeners dos filtros de cupons
function setupCouponUsageFilters() {
  // Aguardar um pouco para garantir que o DOM está pronto
  setTimeout(() => {
    try {
      const applyBtn = document.getElementById('couponUsageApply');
      const resetBtn = document.getElementById('couponUsageReset');
      const exportBtn = document.getElementById('couponUsageExport');

      if (!applyBtn || !resetBtn || !exportBtn) {
        setTimeout(setupCouponUsageFilters, 500);
        return;
      }

      const applyFn = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } applyCouponUsageFilters(); };
      const resetFn = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const p = document.getElementById('couponUsagePeriod');
        const c = document.getElementById('couponUsageContext');
        const s = document.getElementById('couponUsageSearch');
        if (p) p.value = '7d';
        if (c) c.value = 'all';
        if (s) s.value = '';
        couponUsageFilters = { period: '7d', context: 'all', couponCode: 'all', productName: '' };
        applyCouponUsageFilters();
      };
      const exportFn = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } exportCouponUsageData(); };

      // Clonar para limpar listeners antigos
      const newApplyBtn = applyBtn.cloneNode(true);
      const newResetBtn = resetBtn.cloneNode(true);
      const newExportBtn = exportBtn.cloneNode(true);
      applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
      resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
      exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
      newApplyBtn.addEventListener('click', applyFn);
      newResetBtn.addEventListener('click', resetFn);
      newExportBtn.addEventListener('click', exportFn);
      
      
    } catch (error) {
      console.error('❌ Erro ao configurar filtros de cupons:', error);
    }
  }, 100);
}
// Listar pedidos de camisa e marcar envio
async function loadShirtOrders(){
  try{
    const body = document.getElementById('shirtOrdersBody');
    if (!body) return;
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const snap = await getDocs(collection(window.firebaseDb,'orders'));
    const rows = [];
    snap.forEach(d=>{
      const data = d.data();
      const t = String(data.title||data.item||'').toLowerCase();
      if (t.includes('camisa')){
        const shipping = data.shipping || (data.productOptions && data.productOptions.delivery) || {};
        const status = data.shippingStatus || (data.shirtShipped?'shipped':'pending') || 'pending';
        const addr = shipping.address ? `${shipping.address}, ${shipping.number||''} - ${shipping.district||''} - ${shipping.city||''}/${shipping.state||''}` : '';
        const nameOnShirt = (shipping.shirtName) || (data.productOptions && data.productOptions.name) || '';
        const extra = nameOnShirt ? ` • Nome na camisa: ${nameOnShirt}` : '';
        rows.push(`
          <tr class="border-b border-gray-100">
            <td class="py-2 px-2">${data.customer||data.buyerEmail||data.email||''}</td>
            <td class="py-2 px-2">${data.title||''}</td>
            <td class="py-2 px-2">${addr ? addr + extra : '<span class=\'text-gray-400\'>Sem dados</span>'}</td>
            <td class="py-2 px-2">${status==='shipped' ? '<span class="text-green-600">Enviado</span>' : '<span class="text-yellow-600">Aguardando</span>'}</td>
            <td class="py-2 px-2">
              <button class="px-2 py-1 border rounded mr-2" onclick="openShirtOrder('${d.id}')">Abrir</button>
              ${status==='shipped' ? '' : `<button class=\"px-2 py-1 bg-green-600 text-white rounded mr-2\" onclick=\"markShirtAsShipped('${d.id}')\">Marcar enviado</button>`}
              <button class="px-2 py-1 bg-red-600 text-white rounded" onclick="deleteShirtOrder('${d.id}')">🗑️ Remover</button>
            </td>
          </tr>
        `);
      }
    });
    body.innerHTML = rows.length? rows.join('') : '<tr><td colspan="5" class="py-6 text-center text-gray-500">Nenhum pedido de camisa encontrado</td></tr>';
  }catch(e){
    const body = document.getElementById('shirtOrdersBody');
    if (body) body.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-red-500">Erro ao carregar</td></tr>';
  }
}

async function markShirtAsShipped(orderId){
  try{
    const { doc, updateDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    await updateDoc(doc(collection(window.firebaseDb,'orders'), orderId),{
      shippingStatus: 'shipped',
      shippedAt: new Date()
    });
    await loadShirtOrders();
  }catch(e){
    alert('Erro ao marcar enviado');
  }
}
async function deleteShirtOrder(orderId) {
    if (!confirm('Remover este pedido de camisa? Esta ação não pode ser desfeita.')) return;
    try {
        const { doc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await deleteDoc(doc(collection(window.firebaseDb, 'orders'), orderId));
        await loadShirtOrders();
    } catch(e) {
        alert('Erro ao remover pedido: ' + e.message);
    }
}
window.deleteShirtOrder = deleteShirtOrder;
window.markShirtAsShipped = markShirtAsShipped;
window.loadShirtOrders = loadShirtOrders;
function closeShirtOrderModal(){
  const m = document.getElementById('shirtOrderModal');
  if (m){ m.classList.add('hidden'); m.classList.remove('flex'); }
}
async function openShirtOrder(orderId){
  try{
    const { doc, getDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const snap = await getDoc(doc(collection(window.firebaseDb,'orders'), orderId));
    if (!snap.exists()) return;
    const o = snap.data();
    const m = document.getElementById('shirtOrderModal');
    if (!m) return;
    const po = o.productOptions || {};
    const shipping = o.shipping || po.delivery || {};
    const cityUf = [shipping.city, shipping.state].filter(Boolean).join('/');
    const status = o.shippingStatus === 'shipped' || o.shirtShipped ? 'Enviado' : 'Aguardando';
    // preencher campos
    const set = (id, html) => { const el = m.querySelector('#'+id); if (el) el.innerHTML = html || ''; };
    set('shirtOrderTitle', o.title || o.item || '-');
    set('shirtOrderCustomer', o.customerName || o.customer || o.buyerEmail || '-');
    set('shirtOrderEmail', o.buyerEmail || o.customer || '-');
    set('shirtOrderStatus', status);
    set('shirtOrderId', orderId);
    set('shirtOrderAmount', (o.amount!=null? Number(o.amount) : 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
    set('shirtOrderSize', po.size || '-');
    set('shirtOrderNameOnShirt', (shipping.shirtName || po.name || '-') );
    set('shipNameVal', shipping.name || '');
    set('shipCpfVal', shipping.cpf || '');
    set('shipCepVal', shipping.cep || '');
    set('shipAddressVal', shipping.address || '');
    set('shipNumberVal', shipping.number || '');
    set('shipComplementVal', shipping.complement || '');
    set('shipDistrictVal', shipping.district || '');
    set('shipCityVal', shipping.city || '');
    set('shipStateVal', shipping.state || '');
    // abrir
    m.classList.remove('hidden'); m.classList.add('flex');
  }catch(_){ }
}
window.openShirtOrder = openShirtOrder;
window.closeShirtOrderModal = closeShirtOrderModal;
window.openCreateCouponModal = openCreateCouponModal;
window.closeCreateCouponModal = closeCreateCouponModal;
window.createCoupon = createCoupon;
window.editCoupon = editCoupon;
window.toggleCouponStatus = toggleCouponStatus;
window.deleteCoupon = deleteCoupon;

// Carregar usuários quando o admin for inicializado
document.addEventListener('DOMContentLoaded', function() {
  // Aguardar Firebase E usuário autenticado antes de carregar dados protegidos
  const waitForFirebaseAndAuth = () => {
    if (window.firebaseReady && window.firebaseDb && window.firebaseAuth) {
      const { onAuthStateChanged } = window.firebaseAuthModule || {};
      // Usar import dinâmico para aguardar auth state
      import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js').then(({ onAuthStateChanged }) => {
        onAuthStateChanged(window.firebaseAuth, (user) => {
          if (user) {
            loadUsersForTables();
          }
        });
      }).catch(() => {});
    } else {
      setTimeout(waitForFirebaseAndAuth, 150);
    }
  };
  waitForFirebaseAndAuth();
  
  // Event listener para formulário de criação de cupons
  const createCouponForm = document.getElementById('createCouponForm');
  if (createCouponForm) {
    createCouponForm.addEventListener('submit', createCoupon);
  }
  
  // Listener de formAddTeam já registrado via onsubmit dentro de initAdmin — não duplicar aqui
  
  // Listeners de filtros do uso de cupons
  // Event listeners já configurados acima na função initAdmin
});

// ===== Reset de Dados (Perigoso) =====
function openResetDataModal(){
  const m = document.getElementById('resetDataModal');
  if (m){ m.classList.remove('hidden'); m.classList.add('flex'); }
}
function closeResetDataModal(){
  const m = document.getElementById('resetDataModal');
  if (m){ m.classList.add('hidden'); m.classList.remove('flex'); }
}
async function deleteCollectionDocs(colName){
  const log = (t)=>{ const el = document.getElementById('resetDataLog'); if (el) el.innerHTML += `<div>${t}</div>`; };
  try{
    const { collection, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const snap = await getDocs(collection(window.firebaseDb, colName));
    let count = 0;
    for (const d of snap.docs){
      try{ await deleteDoc(doc(window.firebaseDb, colName, d.id)); count++; }catch(e){ log(`Erro ao apagar ${colName}/${d.id}`); }
    }
    log(`✔ ${colName}: ${count} documentos apagados.`);
  }catch(e){
    log(`❌ Falha ao apagar coleção ${colName}`);
  }
}
async function zeroUserTokens(){
  const log = (t)=>{ const el = document.getElementById('resetDataLog'); if (el) el.innerHTML += `<div>${t}</div>`; };
  try{
    const { collection, getDocs, updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const users = await getDocs(collection(window.firebaseDb,'users'));
    let count = 0;
    for (const u of users.docs){
      try{ await updateDoc(doc(window.firebaseDb,'users',u.id), { tokens: 0 }); count++; }catch(_){ }
    }
    log(`✔ users.tokens zerados (${count} usuários).`);
  }catch(e){ log('❌ Falha ao zerar tokens'); }
}
async function performDataReset(){
  const logEl = document.getElementById('resetDataLog'); if (logEl) logEl.innerHTML = '';
  const confirmText = (document.getElementById('resetConfirm')?.value||'').trim().toUpperCase();
  if (confirmText !== 'ZERAR'){ alert('Digite ZERAR para confirmar.'); return; }
  const wants = {
    orders: document.getElementById('resetOrders')?.checked,
    regs: document.getElementById('resetRegistrations')?.checked,
    couponUsage: document.getElementById('resetCouponUsage')?.checked,
    news: document.getElementById('resetNews')?.checked,
  };
  if (!wants.orders && !wants.regs && !wants.couponUsage && !wants.news){
    alert('Selecione pelo menos uma opção.'); return;
  }
  const tasks = [];
  if (wants.orders) tasks.push(deleteCollectionDocs('orders'));
  if (wants.regs) tasks.push(deleteCollectionDocs('registrations'));
  if (wants.couponUsage) tasks.push(deleteCollectionDocs('couponUsage'));
  if (wants.news) tasks.push(deleteCollectionDocs('news'));
  await Promise.allSettled(tasks);
  const log = (t)=>{ const el = document.getElementById('resetDataLog'); if (el) el.innerHTML += `<div>${t}</div>`; };
  log('<b>Concluído.</b> Atualize as seções para ver o efeito.');
}
window.openResetDataModal = openResetDataModal;
window.closeResetDataModal = closeResetDataModal;
window.performDataReset = performDataReset;

// Navegação rápida entre seções a partir do Gerenciamento de Tokens
function jumpToSelectedSection(selectId){
  try{
    const sel = document.getElementById(selectId);
    const target = sel && sel.value ? document.getElementById(sel.value) : null;
    if (target){ target.scrollIntoView({ behavior:'smooth', block:'start' }); }
  }catch(_){ }
}
window.jumpToSelectedSection = jumpToSelectedSection;

// ==================== PASSE BOOYAH CONTROLS ====================
async function loadPasseBooyahControls(){
  try{
    const tbody = document.getElementById('booyahTbody');
    const countEl = document.getElementById('booyahCount');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-500">Carregando registros...</td></tr>';

    const { collection, query, where, orderBy, getDocs, updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

    // Buscar pedidos de Passe Booyah aprovados/pendentes de confirmação
    const ordersRef = collection(window.firebaseDb, 'orders');
    const q = query(ordersRef, where('productId','==','passe-booyah'));
    const snap = await getDocs(q);

    const rows = [];
    let total = 0;
    snap.forEach(d => {
      const o = d.data() || {};
      const status = (o.status||'').toLowerCase();
      const isPaid = status==='paid' || status==='approved' || status==='confirmed';
      // Mostrar todos, mas com ação apenas para pagos não confirmados
      const confirmed = !!o.booyahConfirmed;
      const playerId = (o.productOptions && (o.productOptions.playerId || o.productOptions.id || o.playerId)) || '';
      rows.push({ id:d.id, name:o.customerName||'-', email:o.customer||o.buyerEmail||'-', playerId, confirmed, canConfirm: isPaid && !confirmed });
      total++;
    });

    if (countEl) countEl.textContent = `${total} registros`;

    if (rows.length === 0){
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-500">Nenhum registro encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="border-b border-gray-100">
        <td class="py-2 px-2">${r.name}</td>
        <td class="py-2 px-2">${r.email}</td>
        <td class="py-2 px-2">${r.playerId || '<span class="text-gray-400">—</span>'}</td>
        <td class="py-2 px-2">${r.confirmed ? '<span class="px-2 py-1 text-[10px] rounded-full bg-green-100 text-green-700">Confirmado</span>' : '<span class="px-2 py-1 text-[10px] rounded-full bg-yellow-100 text-yellow-700">Pendente</span>'}</td>
        <td class="py-2 px-2 flex items-center gap-2">
          ${r.canConfirm ? `<button class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs" onclick="confirmPasseBooyah('${r.id}')">Confirmar</button>` : ''}
          ${r.confirmed ? `<button class="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs" onclick="deleteBooyahOrder('${r.id}')" title="Excluir pedido">🗑️</button>` : ''}
          ${!r.canConfirm && !r.confirmed ? '<span class="text-gray-400 text-xs">—</span>' : ''}
        </td>
      </tr>
    `).join('');

    // Expor funções no escopo global
    window.confirmPasseBooyah = async function(orderId){
      try{
        const ok = confirm('Confirmar entrega do Passe Booyah?');
        if (!ok) return;
        const ref = doc(window.firebaseDb, 'orders', orderId);
        await updateDoc(ref, { booyahConfirmed: true, booyahConfirmedAt: new Date() });
        await loadPasseBooyahControls();
      }catch(err){
        console.error('Erro ao confirmar Passe Booyah:', err);
        alert('Erro ao confirmar. Tente novamente.');
      }
    };

    window.deleteBooyahOrder = async function(orderId){
      try{
        const ok = confirm('Excluir este pedido do Passe Booyah? Esta ação não pode ser desfeita.');
        if (!ok) return;
        const { deleteDoc, doc: docFn } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await deleteDoc(docFn(window.firebaseDb, 'orders', orderId));
        await loadPasseBooyahControls();
      }catch(err){
        console.error('Erro ao excluir pedido Booyah:', err);
        alert('Erro ao excluir. Tente novamente.');
      }
    };
  }catch(err){
    console.error('Erro ao carregar Passe Booyah:', err);
  }
}

// ==================== TOKEN TOTALS RECOMPUTE ====================
async function recomputeTokenTotals(){
  try{
    const { collection, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

    // 1) Total de tokens comprados: somar explicitamente a quantidade do título/item
    const ordersSnap = await getDocsFromServer(collection(window.firebaseDb,'orders'));
    let totalPurchased = 0;
    ordersSnap.forEach(d => {
      const o = d.data() || {};
      const title = (o.title||'') + ' ' + (o.item||'') + ' ' + (o.description||'');
      const lower = title.toLowerCase();
      if (lower.includes('token') && (o.status==='paid' || o.status==='approved' || o.status==='confirmed')){
        // Busca padrão: "NN Token" no texto
        const m = title.match(/(\d+)\s*Token/i);
        const qty = m ? parseInt(m[1],10) : (Number(o.quantity)||1);
        totalPurchased += isFinite(qty) ? qty : 0;
      }
    });

    // 2) Total de tokens usados: contar registrations com paidWithTokens
    const regsSnap = await getDocsFromServer(collection(window.firebaseDb,'registrations'));
    let totalUsed = 0;
    regsSnap.forEach(d => {
      const r = d.data() || {};
      if (r.paidWithTokens === true){
        totalUsed += Number(r.tokensUsed || r.tokenCost || 1);
      }
    });

    // 3) Atualizar UI
    const purchasedEl = document.getElementById('totalTokensPurchased');
    const usedEl = document.getElementById('totalTokensUsed');
    if (purchasedEl) purchasedEl.textContent = totalPurchased;
    if (usedEl) usedEl.textContent = totalUsed;

    // 4) Atualizar contagem de compras (cards e paginação)
    const countEl = document.getElementById('tokensCount');
    if (countEl) countEl.textContent = `${totalPurchased} compras`;

    
  }catch(err){
    console.error('❌ Error recomputing tokens:', err);
  }
}

// ==================== GERENCIAMENTO DE LINKS DO WHATSAPP ====================

// Função para mostrar notificações
function showNotification(message, type = 'info') {
  // Criar elemento de notificação
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg max-w-sm ${
    type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
    type === 'warning' ? 'bg-yellow-500 text-black' :
    'bg-blue-500 text-white'
  }`;
  notification.textContent = message;
  
  // Adicionar ao DOM
  document.body.appendChild(notification);
  
  // Remover após 3 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}


// ==================== PAINEL DO AFILIADO ====================

// Carregar dados do painel de afiliado
window.copyAffiliatePanelLink = function() {
  const input = document.getElementById('affiliatePanelLinkInput');
  if (!input) return;
  const url = input.value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = input.nextElementSibling;
      if (btn) { const orig = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i> Copiado!'; btn.classList.add('bg-green-600'); setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('bg-green-600'); }, 2000); }
    }).catch(() => { input.select(); document.execCommand('copy'); });
  } else {
    input.select();
    document.execCommand('copy');
  }
};

async function loadAffiliatePanelData(affiliateId) {
  try {
    // Gerar e exibir link de afiliado
    const linkInput = document.getElementById('affiliatePanelLinkInput');
    if (linkInput) {
      const baseUrl = window.location.origin + window.location.pathname.replace(/\/admin\.html$/, '/');
      linkInput.value = `${baseUrl}index.html?ref=${affiliateId}`;
    }

    // Carregar vendas do afiliado
    const { collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const salesRef = collection(window.firebaseDb, 'affiliate_sales');
    const salesQuery = query(
      salesRef,
      where('affiliateId', '==', affiliateId),
      orderBy('createdAt', 'desc')
    );
    const salesSnap = await getDocs(salesQuery);
    
    const sales = [];
    salesSnap.forEach(doc => {
      const data = doc.data();
      sales.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      });
    });
    
    // Atualizar estatísticas
    updateAffiliatePanelStats(sales);
    
    // Renderizar tabela de conversões
    renderAffiliatePanelSales(sales);
    
    // Configurar botão de solicitar pagamento
    setupPaymentRequestButton(affiliateId, sales);
    
    // Configurar filtro
    const filter = document.getElementById('affiliatePanelSalesFilter');
    if (filter) {
      filter.addEventListener('change', () => {
        renderAffiliatePanelSales(sales);
      });
    }
    
    
  } catch (error) {
    console.error('❌ Erro ao carregar dados do painel de afiliado:', error);
    const tbody = document.getElementById('affiliatePanelSalesTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-red-500">Erro ao carregar conversões</td></tr>';
    }
  }
}

// Atualizar estatísticas do painel
function updateAffiliatePanelStats(sales) {
  const totalSales = sales.length;
  const totalCommission = sales.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
  const pendingCommission = sales
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
  const paidCommission = sales
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
  
  const totalSalesEl = document.getElementById('affiliatePanelTotalSales');
  const totalCommissionEl = document.getElementById('affiliatePanelTotalCommission');
  const pendingCommissionEl = document.getElementById('affiliatePanelPendingCommission');
  const paidCommissionEl = document.getElementById('affiliatePanelPaidCommission');
  const availableBalanceEl = document.getElementById('affiliatePanelAvailableBalance');
  
  if (totalSalesEl) totalSalesEl.textContent = totalSales;
  if (totalCommissionEl) totalCommissionEl.textContent = `R$ ${totalCommission.toFixed(2).replace('.', ',')}`;
  if (pendingCommissionEl) pendingCommissionEl.textContent = `R$ ${pendingCommission.toFixed(2).replace('.', ',')}`;
  if (paidCommissionEl) paidCommissionEl.textContent = `R$ ${paidCommission.toFixed(2).replace('.', ',')}`;
  if (availableBalanceEl) availableBalanceEl.textContent = `R$ ${pendingCommission.toFixed(2).replace('.', ',')}`;
}

// Renderizar vendas do afiliado
function renderAffiliatePanelSales(sales) {
  const tbody = document.getElementById('affiliatePanelSalesTableBody');
  if (!tbody) return;
  
  const filter = document.getElementById('affiliatePanelSalesFilter')?.value || 'all';
  const filteredSales = filter === 'all' ? sales : sales.filter(s => s.status === filter);
  
  if (filteredSales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-500">Nenhuma conversão encontrada</td></tr>';
    return;
  }
  
  tbody.innerHTML = filteredSales.map(sale => {
    const date = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('pt-BR') : 'N/A';
    const statusBadge = sale.status === 'paid' 
      ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Paga</span>'
      : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pendente</span>';
    
    const saleTypeIcon = sale.saleType === 'event' ? '📅' : sale.saleType === 'product' ? '🛒' : '📦';
    const saleTypeText = sale.saleType === 'event' ? 'Evento' : sale.saleType === 'product' ? 'Produto' : 'N/A';
    
    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-3 px-4 text-sm">${date}</td>
        <td class="py-3 px-4 text-sm">${sale.customerName || sale.customerEmail || 'N/A'}</td>
        <td class="py-3 px-4 text-sm">
          <div>${sale.productName || sale.productId || 'N/A'}</div>
          <div class="text-xs text-gray-500">${saleTypeIcon} ${saleTypeText}</div>
        </td>
        <td class="py-3 px-4 text-sm font-medium">R$ ${(sale.saleValue || 0).toFixed(2).replace('.', ',')}</td>
        <td class="py-3 px-4 text-sm">${(sale.commissionRate || 0).toFixed(1)}%</td>
        <td class="py-3 px-4 text-sm font-medium text-green-600">R$ ${(sale.commissionAmount || 0).toFixed(2).replace('.', ',')}</td>
        <td class="py-3 px-4 text-sm">${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

// Configurar botão de solicitar pagamento
function setupPaymentRequestButton(affiliateId, sales) {
  const pendingCommission = sales
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
  
  const minAmount = 25.00;
  const canRequest = pendingCommission >= minAmount;
  
  const form = document.getElementById('affiliatePaymentRequestForm');
  const message = document.getElementById('affiliatePaymentRequestMessage');
  const messageText = document.getElementById('affiliatePaymentRequestText');
  const amountInput = document.getElementById('affiliateRequestAmount');
  const submitBtn = document.getElementById('btnSubmitPaymentRequest');
  
  if (canRequest) {
    if (form) form.classList.remove('hidden');
    if (message) message.classList.add('hidden');
    if (amountInput) {
      amountInput.max = pendingCommission;
      amountInput.value = pendingCommission.toFixed(2);
    }
    
    if (submitBtn) {
      submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processando...';
        try {
          await submitPaymentRequest(affiliateId, pendingCommission);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Pagamento';
        }
      };
    }
  } else {
    if (form) form.classList.add('hidden');
    if (message) {
      message.classList.remove('hidden');
      if (messageText) {
        const missing = (minAmount - pendingCommission).toFixed(2);
        messageText.textContent = `Você precisa de mais R$ ${missing.replace('.', ',')} para solicitar pagamento. Valor mínimo: R$ 25,00`;
      }
    }
  }
}

// Solicitar pagamento
async function submitPaymentRequest(affiliateId, maxAmount) {
  try {
    const amountInput = document.getElementById('affiliateRequestAmount');
    const amount = parseFloat(amountInput?.value || 0);
    
    if (!amount || amount < 25.00) {
      alert('O valor mínimo para solicitação é R$ 25,00');
      return;
    }
    
    if (amount > maxAmount) {
      alert(`O valor solicitado não pode ser maior que o saldo disponível (R$ ${maxAmount.toFixed(2)})`);
      return;
    }
    
    if (!confirm(`Confirmar solicitação de pagamento no valor de R$ ${amount.toFixed(2).replace('.', ',')}?`)) {
      return;
    }
    
    // Criar solicitação de pagamento
    const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const paymentRequestsRef = collection(window.firebaseDb, 'affiliate_payment_requests');
    
    await addDoc(paymentRequestsRef, {
      affiliateId: affiliateId,
      amount: amount,
      status: 'pending',
      requestedAt: serverTimestamp(),
      createdAt: new Date()
    });
    
    // Usar toast se disponível, senão alert
    if (typeof showSuccessToast === 'function') {
      showSuccessToast('Solicitação de pagamento enviada com sucesso! Aguarde a aprovação.', 'Sucesso');
    } else {
      alert('Solicitação de pagamento enviada com sucesso! Aguarde a aprovação.');
    }
    
    // Recarregar dados
    await loadAffiliatePanelData(affiliateId);
  } catch (error) {
    console.error('❌ Erro ao solicitar pagamento:', error);
    alert('Erro ao solicitar pagamento. Por favor, tente novamente.');
  }
}

// Expor funções globalmente
window.loadAffiliatePanelData = loadAffiliatePanelData;
window.submitPaymentRequest = submitPaymentRequest;

// ===== GERENCIAMENTO DE PRODUTOS =====

let productsData = [];

function openProductsModal() {
    loadProducts();
    const modal = document.getElementById('modalProducts');
    if (modal) modal.classList.remove('hidden');
}

function closeProductsModal() {
    const modal = document.getElementById('modalProducts');
    if (modal) modal.classList.add('hidden');
}

async function loadProducts() {
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snapshot = await getDocs(collection(window.firebaseDb, 'products'));
        productsData = [];
        snapshot.forEach(d => productsData.push({ id: d.id, ...d.data() }));
        renderProducts();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showToast('error', 'Erro ao carregar produtos', 'Erro');
    }
}

function _prodBadgeClass(active) {
    return active
        ? 'px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 bg-green-100 text-green-700'
        : 'px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 bg-red-100 text-red-700';
}

function updateProdStatus(idx, val) {
    productsData[idx].active = val === 'true';
    const badge = document.getElementById('prod-badge-' + idx);
    if (badge) {
        badge.className = _prodBadgeClass(val === 'true');
        badge.textContent = val === 'true' ? 'Ativo' : 'Inativo';
    }
}

function updateProdTitle(idx, val) {
    productsData[idx].name = val;
    const el = document.getElementById('prod-title-' + idx);
    if (el) el.textContent = val || 'Novo Produto';
}

function _prodCatConfig(cat) {
    const c = (cat || 'digital').toLowerCase();
    if (c === 'passe') return { label: 'Passe de Elite', icon: 'fas fa-gamepad', headerClass: 'bg-gradient-to-r from-green-600 to-emerald-500', badgeClass: 'bg-white/20 text-white' };
    if (c === 'fisico' || c === 'physical') return { label: 'Produto Físico', icon: 'fas fa-box', headerClass: 'bg-gradient-to-r from-purple-600 to-pink-500', badgeClass: 'bg-white/20 text-white' };
    if (c === 'aereas') return { label: 'Imagens Aéreas', icon: 'fas fa-map', headerClass: 'bg-gradient-to-r from-orange-500 to-amber-400', badgeClass: 'bg-white/20 text-white' };
    if (c === 'sensibilidade') return { label: 'Sensibilidade', icon: 'fas fa-sliders-h', headerClass: 'bg-gradient-to-r from-cyan-600 to-blue-500', badgeClass: 'bg-white/20 text-white' };
    return { label: 'Produto Digital', icon: 'fas fa-download', headerClass: 'bg-gradient-to-r from-blue-600 to-indigo-500', badgeClass: 'bg-white/20 text-white' };
}

function _renderPriceOptionsHtml(idx) {
    const options = productsData[idx]?.priceOptions || [];
    if (options.length === 0) return '<p class="text-xs text-gray-400 italic">Nenhum valor cadastrado. Clique em "Adicionar Valor".</p>';
    return options.map((opt, pIdx) => `
        <div class="flex items-center gap-2">
            <input type="text" value="${(opt.label || '').replace(/"/g, '&quot;')}" oninput="updatePriceOption(${idx},${pIdx},'label',this.value)" placeholder="Ex.: Básico, Premium..." class="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" style="min-width:0">
            <span class="text-gray-500 text-sm font-medium flex-shrink-0">R$</span>
            <input type="number" value="${opt.price || 0}" step="0.01" min="0" oninput="updatePriceOption(${idx},${pIdx},'price',parseFloat(this.value)||0)" class="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-shrink-0">
            ${options.length > 1 ? `<button onclick="removePriceOption(${idx},${pIdx})" class="text-red-400 hover:text-red-600 flex-shrink-0 text-lg leading-none">&times;</button>` : ''}
        </div>`).join('');
}

function addPriceOption(idx) {
    if (!Array.isArray(productsData[idx].priceOptions)) productsData[idx].priceOptions = [];
    productsData[idx].priceOptions.push({ label: '', price: 0 });
    const el = document.getElementById(`prod-prices-${idx}`);
    if (el) el.innerHTML = _renderPriceOptionsHtml(idx);
}

function removePriceOption(idx, pIdx) {
    if (!Array.isArray(productsData[idx].priceOptions)) return;
    productsData[idx].priceOptions.splice(pIdx, 1);
    if (productsData[idx].priceOptions[0]) productsData[idx].price = productsData[idx].priceOptions[0].price || 0;
    const el = document.getElementById(`prod-prices-${idx}`);
    if (el) el.innerHTML = _renderPriceOptionsHtml(idx);
}

function updatePriceOption(idx, pIdx, field, val) {
    if (!Array.isArray(productsData[idx].priceOptions)) return;
    productsData[idx].priceOptions[pIdx] = { ...(productsData[idx].priceOptions[pIdx] || {}), [field]: val };
    if (pIdx === 0 && field === 'price') productsData[idx].price = val;
}

function setProdCategory(idx, cat) {
    productsData[idx].category = cat;
    renderProducts();
    // Scroll to card after re-render
    setTimeout(() => {
        const card = document.getElementById(`prod-card-${idx}`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
}

function updateMapLink(idx, key, val) {
    if (!productsData[idx]) return;
    if (!productsData[idx].mapLinks || typeof productsData[idx].mapLinks !== 'object') productsData[idx].mapLinks = {};
    productsData[idx].mapLinks[key] = val;
}

function updateSensibLink(idx, platform, val) {
    if (!productsData[idx]) return;
    if (!productsData[idx].downloadLinks || typeof productsData[idx].downloadLinks !== 'object') productsData[idx].downloadLinks = {};
    productsData[idx].downloadLinks[platform] = val;
}
window.updateSensibLink = updateSensibLink;

function updateProdBannerPreview(idx, url) {
    const el = document.getElementById(`prod-banner-preview-${idx}`);
    if (!el) return;
    if (url) {
        el.classList.remove('hidden');
        el.innerHTML = `<img src="${url.replace(/"/g, '&quot;')}" class="w-full h-full object-cover" onerror="this.parentElement.classList.add('hidden')">`;
    } else {
        el.classList.add('hidden');
        el.innerHTML = '';
    }
}

function renderProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (productsData.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fas fa-box-open text-4xl mb-3 block opacity-40"></i><p>Nenhum produto cadastrado.</p><p class="text-sm mt-1">Clique em "Adicionar" para criar um novo.</p></div>';
        return;
    }
    productsData.forEach((product, index) => {
        const cat = (product.category || 'digital').toLowerCase();
        const isActive = product.active !== false;
        const cc = _prodCatConfig(cat);

        // Garantir priceOptions
        if (!Array.isArray(product.priceOptions) || product.priceOptions.length === 0) {
            product.priceOptions = [{ label: 'Padrão', price: product.price || 0 }];
        }

        const safeTitle = (product.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const safeImg   = (product.image || '').replace(/"/g, '&quot;');
        const safeDl    = (product.downloadLink || '').replace(/"/g, '&quot;');
        const safeDesc  = (product.description || '').replace(/</g, '&lt;');

        const isDigital = cat === 'digital' || cat === 'servico' || cat === 'service';
        const isFisico  = cat === 'fisico' || cat === 'physical';
        const isPasse   = cat === 'passe';
        const isAereas  = cat === 'aereas';
        const isSensib  = cat === 'sensibilidade';
        const MAP_KEYS  = ['bermuda','purgatorio','solara','kalahari','novaTerra'];
        const MAP_NAMES = { bermuda: 'Bermuda', purgatorio: 'Purgatório', solara: 'Solara', kalahari: 'Kalahari', novaTerra: 'Nova Terra' };
        if (!product.mapLinks || typeof product.mapLinks !== 'object') product.mapLinks = {};
        const ml = product.mapLinks;

        const div = document.createElement('div');
        div.id = `prod-card-${index}`;
        div.className = 'bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden';
        div.innerHTML = `
<div class="${cc.headerClass} px-5 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
        <i class="${cc.icon} text-white text-sm"></i>
        <span id="prod-title-${index}" class="text-white font-semibold text-sm truncate max-w-xs">${safeTitle || 'Novo Produto'}</span>
        <span id="prod-badge-${index}" class="px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-red-200 text-red-800'}">${isActive ? 'Ativo' : 'Inativo'}</span>
    </div>
    <button onclick="deleteProduct(${index})" class="flex-shrink-0 text-white/70 hover:text-white text-xs transition-colors ml-3">
        <i class="fas fa-trash-alt mr-1"></i>Excluir
    </button>
</div>
<div class="p-5 space-y-4">

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Título</label>
            <input type="text" value="${safeTitle}" oninput="updateProdTitle(${index},this.value)"
                   class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Nome do produto">
        </div>
        <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Status</label>
            <select oninput="updateProdStatus(${index},this.value)"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="true"  ${isActive  ? 'selected' : ''}>Ativo</option>
                <option value="false" ${!isActive ? 'selected' : ''}>Inativo</option>
            </select>
        </div>
    </div>

    <div>
        <label class="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Categoria</label>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button onclick="setProdCategory(${index},'passe')"
                    class="flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-colors ${isPasse ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-green-300'}">
                <i class="fas fa-gamepad text-base"></i>Passe Elite
            </button>
            <button onclick="setProdCategory(${index},'fisico')"
                    class="flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-colors ${isFisico ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-purple-300'}">
                <i class="fas fa-box text-base"></i>Físico
            </button>
            <button onclick="setProdCategory(${index},'digital')"
                    class="flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-colors ${isDigital ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-blue-300'}">
                <i class="fas fa-download text-base"></i>Digital
            </button>
            <button onclick="setProdCategory(${index},'aereas')"
                    class="flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-colors ${isAereas ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-orange-300'}">
                <i class="fas fa-map text-base"></i>Img. Aéreas
            </button>
            <button onclick="setProdCategory(${index},'sensibilidade')"
                    class="flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-colors ${isSensib ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-500 hover:border-cyan-300'}">
                <i class="fas fa-sliders-h text-base"></i>Sensibilidade
            </button>
        </div>
        <p class="text-xs text-gray-400 mt-1">
            ${isPasse    ? '<i class="fas fa-gamepad text-green-500 mr-1"></i>Coleta Nick, ID e WhatsApp do jogador após compra.' : ''}
            ${isFisico   ? '<i class="fas fa-box text-purple-500 mr-1"></i>Coleta nome, endereço, CPF e tamanho após compra.' : ''}
            ${isDigital  ? '<i class="fas fa-download text-blue-500 mr-1"></i>Link único liberado automaticamente após pagamento.' : ''}
            ${isAereas   ? '<i class="fas fa-map text-orange-500 mr-1"></i>5 mapas com links individuais. Cliente escolhe qual baixar na área do cliente.' : ''}
            ${isSensib   ? '<i class="fas fa-sliders-h text-cyan-500 mr-1"></i>Links por plataforma: PC, iOS e Android (por marca). Cliente escolhe e recebe o link correspondente.' : ''}
        </p>
    </div>

    <div>
        <label class="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider"><i class="fas fa-image mr-1"></i>URL da Imagem / Banner</label>
        <input type="url" value="${safeImg}" oninput="productsData[${index}].image=this.value;updateProdBannerPreview(${index},this.value)"
               class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="https://...">
        <div id="prod-banner-preview-${index}" class="mt-2 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden ${safeImg ? '' : 'hidden'}">
            ${safeImg ? `<img src="${safeImg}" class="w-full h-full object-cover" onerror="this.parentElement.classList.add('hidden')">` : ''}
        </div>
    </div>

    <div>
        <label class="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Infos do Produto</label>
        <textarea oninput="productsData[${index}].description=this.value" rows="3"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  placeholder="Descrição, o que está incluso, benefícios...">${safeDesc}</textarea>
    </div>

    ${isDigital ? `
    <div>
        <label class="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
            <i class="fab fa-google-drive text-blue-500 mr-1"></i>Link de Download (Google Drive)
        </label>
        <input type="url" value="${safeDl}" oninput="productsData[${index}].downloadLink=this.value"
               class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
               placeholder="https://drive.google.com/...">
        <p class="text-xs text-blue-600 mt-1">
            <i class="fas fa-bolt mr-1"></i>Liberado automaticamente ao confirmar pagamento. Você também pode enviar manualmente na aba de pedidos.
        </p>
    </div>` : ''}

    ${isSensib ? `
    <div class="border border-cyan-200 rounded-xl p-4 bg-cyan-50">
        <div class="flex items-center gap-2 mb-3">
            <i class="fas fa-sliders-h text-cyan-500"></i>
            <span class="text-sm font-semibold text-cyan-700">Links de Download por Plataforma</span>
        </div>
        <p class="text-xs text-cyan-600 mb-3">Preencha os links de download para cada plataforma/marca. Apenas as opções com link serão exibidas ao cliente.</p>
        <div class="space-y-3">
            <div>
                <label class="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1 mb-1"><i class="fas fa-desktop text-cyan-500"></i> PC (Windows)</label>
                <input type="url" value="${((product.downloadLinks?.pc) || '').replace(/"/g,'&quot;')}"
                       oninput="updateSensibLink(${index},'pc',this.value)"
                       class="w-full border border-cyan-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                       placeholder="https://drive.google.com/...">
            </div>
            <div>
                <label class="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1 mb-1"><i class="fab fa-apple text-cyan-500"></i> iOS (iPhone / iPad)</label>
                <input type="url" value="${((product.downloadLinks?.ios) || '').replace(/"/g,'&quot;')}"
                       oninput="updateSensibLink(${index},'ios',this.value)"
                       class="w-full border border-cyan-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                       placeholder="https://drive.google.com/...">
            </div>
            <div class="border-t border-cyan-200 pt-3">
                <label class="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1 mb-2"><i class="fab fa-android text-cyan-500"></i> Android — Links por Marca</label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${[['lg','LG'],['motorola','Motorola'],['samsung','Samsung'],['xiaomi','Xiaomi / Realme']].map(([key,label]) => `
                    <div class="flex items-center gap-2">
                        <label class="text-xs font-semibold text-gray-600 w-28 flex-shrink-0">${label}</label>
                        <input type="url" value="${((product.downloadLinks?.[key]) || '').replace(/"/g,'&quot;')}"
                               oninput="updateSensibLink(${index},'${key}',this.value)"
                               class="flex-1 border border-cyan-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                               placeholder="https://drive.google.com/...">
                    </div>`).join('')}
                </div>
            </div>
        </div>
    </div>` : ''}

    ${isAereas ? `
    <div class="border border-orange-200 rounded-xl p-4 bg-orange-50">
        <div class="flex items-center gap-2 mb-3">
            <i class="fas fa-map text-orange-500"></i>
            <span class="text-sm font-semibold text-orange-700">Links por Mapa (Google Drive)</span>
        </div>
        <p class="text-xs text-orange-600 mb-3">Cole o link do Google Drive para cada mapa. O cliente verá somente os mapas que tiverem link preenchido.</p>
        <div class="space-y-2">
            ${MAP_KEYS.map(key => `
            <div class="flex items-center gap-2">
                <label class="text-xs font-semibold text-gray-600 w-24 flex-shrink-0">${MAP_NAMES[key]}</label>
                <input type="url" value="${((ml[key]) || '').replace(/"/g,'&quot;')}"
                       oninput="updateMapLink(${index},'${key}',this.value)"
                       class="flex-1 border border-orange-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                       placeholder="https://drive.google.com/...">
            </div>`).join('')}
        </div>
    </div>` : ''}

    <div>
        <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <i class="fas fa-tags mr-1"></i>Valores / Planos
            </label>
            <button onclick="addPriceOption(${index})"
                    class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors">
                <i class="fas fa-plus mr-1"></i>Adicionar Valor
            </button>
        </div>
        <div id="prod-prices-${index}" class="space-y-2">
            ${_renderPriceOptionsHtml(index)}
        </div>
        <p class="text-xs text-gray-400 mt-1">O primeiro valor será o preço padrão. Adicione vários planos/faixas de preço se quiser.</p>
    </div>

</div>`;
        container.appendChild(div);
    });
}

function addProduct() {
    const existing = document.getElementById('_catSelectorOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = '_catSelectorOverlay';
    overlay.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 class="text-lg font-bold text-gray-800 mb-1 text-center">Tipo de Produto</h3>
            <p class="text-sm text-gray-500 text-center mb-5">Escolha a categoria do novo produto:</p>
            <div class="space-y-3">
                <button onclick="_createProductWithCat('passe')" class="w-full flex items-center gap-3 px-4 py-3 bg-green-50 border-2 border-green-200 rounded-xl hover:border-green-400 hover:bg-green-100 transition-colors text-left">
                    <i class="fas fa-gamepad text-green-600 text-xl w-7 text-center flex-shrink-0"></i>
                    <div>
                        <div class="font-semibold text-gray-800">Passe de Elite</div>
                        <div class="text-xs text-gray-500">Coleta Nick, ID do Free Fire e WhatsApp</div>
                    </div>
                </button>
                <button onclick="_createProductWithCat('fisico')" class="w-full flex items-center gap-3 px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:bg-purple-100 transition-colors text-left">
                    <i class="fas fa-box text-purple-600 text-xl w-7 text-center flex-shrink-0"></i>
                    <div>
                        <div class="font-semibold text-gray-800">Produto Físico</div>
                        <div class="text-xs text-gray-500">Coleta nome, endereço, CPF e tamanho</div>
                    </div>
                </button>
                <button onclick="_createProductWithCat('digital')" class="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-100 transition-colors text-left">
                    <i class="fas fa-download text-blue-600 text-xl w-7 text-center flex-shrink-0"></i>
                    <div>
                        <div class="font-semibold text-gray-800">Produto Digital</div>
                        <div class="text-xs text-gray-500">Link único de download. Coleta nome, e-mail e WhatsApp</div>
                    </div>
                </button>
                <button onclick="_createProductWithCat('aereas')" class="w-full flex items-center gap-3 px-4 py-3 bg-orange-50 border-2 border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-100 transition-colors text-left">
                    <i class="fas fa-map text-orange-500 text-xl w-7 text-center flex-shrink-0"></i>
                    <div>
                        <div class="font-semibold text-gray-800">Imagens Aéreas</div>
                        <div class="text-xs text-gray-500">5 links por mapa: Bermuda, Purgatório, Solara, Kalahari, Nova Terra</div>
                    </div>
                </button>
                <button onclick="_createProductWithCat('sensibilidade')" class="w-full flex items-center gap-3 px-4 py-3 bg-cyan-50 border-2 border-cyan-200 rounded-xl hover:border-cyan-400 hover:bg-cyan-100 transition-colors text-left">
                    <i class="fas fa-sliders-h text-cyan-600 text-xl w-7 text-center flex-shrink-0"></i>
                    <div>
                        <div class="font-semibold text-gray-800">Sensibilidade</div>
                        <div class="text-xs text-gray-500">Links por plataforma: PC, iOS e Android (LG, Motorola, Samsung, Xiaomi/Realme)</div>
                    </div>
                </button>
            </div>
            <button onclick="document.getElementById('_catSelectorOverlay').remove()" class="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
        </div>`;
    document.body.appendChild(overlay);
}

function _createProductWithCat(cat) {
    const overlay = document.getElementById('_catSelectorOverlay');
    if (overlay) overlay.remove();
    const base = {
        id: `product_${Date.now()}`,
        name: '',
        description: '',
        price: 0,
        priceOptions: [{ label: 'Padrão', price: 0 }],
        category: cat,
        image: '',
        downloadLink: '',
        active: true,
        createdAt: new Date()
    };
    if (cat === 'aereas') {
        base.mapLinks = { bermuda: '', purgatorio: '', solara: '', kalahari: '', novaTerra: '' };
    }
    if (cat === 'sensibilidade') {
        base.downloadLinks = { pc: '', ios: '', lg: '', motorola: '', samsung: '', xiaomi: '' };
    }
    productsData.push(base);
    renderProducts();
    setTimeout(() => {
        const c = document.getElementById('productsContainer');
        if (c) c.scrollTop = c.scrollHeight;
    }, 100);
}

function deleteProduct(index) {
    if (confirm('Tem certeza que deseja deletar este produto?')) {
        productsData.splice(index, 1);
        renderProducts();
    }
}

async function uploadProductBanner(index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const card = document.getElementById(`prod-card-${index}`);
        const btn = card ? card.querySelector('button[onclick^="uploadProductBanner"]') : null;
        try {
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Enviando...'; }
            const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
            const storage = window.firebaseStorage;
            if (!storage) throw new Error('Firebase Storage não disponível');
            const storageRef = ref(storage, `products/${productsData[index].id}/banner`);
            const snap = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snap.ref);
            productsData[index].image = url;
            const bannerEl = document.getElementById(`prod-banner-${index}`);
            if (bannerEl) bannerEl.innerHTML = `<img src="${url}" class="w-full h-full object-cover" alt="Banner">`;
            showToast('success', 'Banner enviado com sucesso!', 'Sucesso');
        } catch (e) {
            console.error('Erro upload banner:', e);
            showToast('error', 'Erro ao enviar banner: ' + e.message, 'Erro');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload mr-1"></i>Upload Banner'; }
        }
    };
    input.click();
}

async function saveProducts() {
    try {
        if (productsData.length === 0) { showToast('warning', 'Nenhum produto para salvar', 'Aviso'); return; }
        // Sincronizar price com o primeiro priceOption antes de salvar
        for (const product of productsData) {
            if (Array.isArray(product.priceOptions) && product.priceOptions.length > 0) {
                product.price = Number(product.priceOptions[0].price) || 0;
            }
        }
        const { collection, doc, setDoc, deleteDoc, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const productsRef = collection(window.firebaseDb, 'products');
        const existingSnap = await getDocs(productsRef);
        const keepIds = new Set(productsData.map(p => p.id));
        for (const ed of existingSnap.docs) {
            if (!keepIds.has(ed.id)) await deleteDoc(doc(window.firebaseDb, 'products', ed.id));
        }
        for (const product of productsData) {
            const { id, ...data } = product;
            await setDoc(doc(window.firebaseDb, 'products', id), { ...data, updatedAt: new Date() });
        }
        showToast('success', `${productsData.length} produto(s) salvo(s) com sucesso!`, 'Sucesso');
        closeProductsModal();
    } catch (error) {
        console.error('Erro ao salvar produtos:', error);
        showToast('error', 'Erro ao salvar: ' + error.message, 'Erro');
    }
}

async function sendDownloadLink(orderId, userId, downloadLink, productName) {
    if (!orderId || !downloadLink) { showToast('error', 'Pedido ou link inválido.', 'Erro'); return; }
    try {
        const { doc, collection, addDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        // Marca o pedido como link enviado manualmente
        await updateDoc(doc(window.firebaseDb, 'orders', orderId), {
            downloadSent: true,
            downloadSentAt: Date.now(),
            downloadSentBy: window.firebaseAuth?.currentUser?.uid || null
        });
        // Envia notificação ao usuário no app
        if (userId) {
            await addDoc(collection(window.firebaseDb, 'notifications'), {
                userId,
                title: '📦 Seu produto digital está pronto!',
                message: `Olá! Seu produto "${productName || 'digital'}" está disponível para download. Acesse o link abaixo.`,
                link: downloadLink,
                type: 'download_ready',
                read: false,
                createdAt: serverTimestamp()
            });
        }
        // Copia o link para área de transferência também
        try { await navigator.clipboard.writeText(downloadLink); } catch(_) {}
        showToast('success', 'Link enviado ao cliente! Link também copiado para área de transferência.', 'Enviado');
    } catch (e) {
        console.error('Erro ao enviar link:', e);
        showToast('error', 'Erro ao enviar link: ' + (e.message || e), 'Erro');
    }
}

window.openProductsModal = openProductsModal;
window.closeProductsModal = closeProductsModal;
window.addProduct = addProduct;
window._createProductWithCat = _createProductWithCat;
window.deleteProduct = deleteProduct;
window.uploadProductBanner = uploadProductBanner;
window.saveProducts = saveProducts;
window.sendDownloadLink = sendDownloadLink;
window.updateProdStatus = updateProdStatus;
window.updateProdTitle = updateProdTitle;
window.addPriceOption = addPriceOption;
window.removePriceOption = removePriceOption;
window.updatePriceOption = updatePriceOption;
window.updateMapLink = updateMapLink;
window.setProdCategory = setProdCategory;
window.updateProdBannerPreview = updateProdBannerPreview;

// ==================== ADMIN NOTIFICATION SYSTEM ====================

function toggleNotifUserField() {
    const target = document.getElementById('notifTarget');
    const row = document.getElementById('notifUserIdRow');
    if (!target || !row) return;
    if (target.value === 'user') {
        row.classList.remove('hidden');
    } else {
        row.classList.add('hidden');
    }
}

async function sendAdminNotification() {
    const titleEl = document.getElementById('notifTitle');
    const messageEl = document.getElementById('notifMessage');
    const targetEl = document.getElementById('notifTarget');
    const userIdEl = document.getElementById('notifUserId');

    if (!titleEl || !messageEl || !targetEl) return;

    const title = titleEl.value.trim();
    const message = messageEl.value.trim();
    const target = targetEl.value;
    const emailInput = (target === 'user' && userIdEl) ? userIdEl.value.trim().toLowerCase() : null;

    if (!title) { showToast('warning', 'Informe o título da notificação.', 'Atenção'); return; }
    if (!message) { showToast('warning', 'Informe a mensagem da notificação.', 'Atenção'); return; }
    if (target === 'user' && !emailInput) { showToast('warning', 'Informe o e-mail do usuário destinatário.', 'Atenção'); return; }

    if (!window.firebaseDb) { showToast('error', 'Firebase não inicializado.', 'Erro'); return; }

    const btn = document.querySelector('[onclick="sendAdminNotification()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...'; }

    try {
        const { collection, addDoc, serverTimestamp, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const adminUser = window.firebaseAuth?.currentUser;

        let targetUserId = null;
        if (target === 'user' && emailInput) {
            const q = query(collection(window.firebaseDb, 'users'), where('email', '==', emailInput));
            const snap = await getDocs(q);
            if (snap.empty) {
                showToast('error', `Nenhum usuário encontrado com o e-mail: ${emailInput}`, 'Usuário não encontrado');
                return;
            }
            targetUserId = snap.docs[0].id;
        }

        await addDoc(collection(window.firebaseDb, 'notifications'), {
            title,
            message,
            type: target,
            targetUserId: targetUserId || null,
            createdAt: serverTimestamp(),
            createdBy: adminUser ? (adminUser.displayName || adminUser.email || adminUser.uid) : 'Admin',
            createdByUid: adminUser ? adminUser.uid : null
        });

        showToast('success', `Notificação enviada para ${target === 'all' ? 'todos os usuários' : emailInput}.`, 'Sucesso');
        titleEl.value = '';
        messageEl.value = '';
        if (userIdEl) userIdEl.value = '';
        await loadAdminNotifications();
    } catch (err) {
        console.error('Erro ao enviar notificação:', err);
        showToast('error', 'Erro ao enviar notificação: ' + (err.message || err), 'Erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar Notificação'; }
    }
}

async function premiarVencedorTreino() {
    const emailEl = document.getElementById('premiacaoEmail');
    const eventoEl = document.getElementById('premiacaoEvento');
    const email = emailEl?.value?.trim().toLowerCase();
    const evento = eventoEl?.value || 'xtreino-tokens';
    const eventoNome = evento === 'modo-liga' ? 'XTreino Modo Liga' : 'XTreino Freitas';
    const premioTokens = 3.5;

    if (!email) { showToast('warning', 'Informe o e-mail do vencedor.', 'Atenção'); return; }
    if (!window.firebaseDb) { showToast('error', 'Firebase não inicializado.', 'Erro'); return; }

    const btn = document.querySelector('[onclick="premiarVencedorTreino()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Premiando...'; }

    try {
        const { collection, query, where, getDocs, doc, updateDoc, increment, addDoc, serverTimestamp } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Buscar usuário pelo e-mail
        const q = query(collection(window.firebaseDb, 'users'), where('email', '==', email));
        const snap = await getDocs(q);
        if (snap.empty) {
            showToast('error', `Nenhum usuário encontrado com o e-mail: ${email}`, 'Usuário não encontrado');
            return;
        }

        const userId = snap.docs[0].id;
        const userNome = snap.docs[0].data().displayName || snap.docs[0].data().name || email;

        // Creditar tokens
        await updateDoc(doc(window.firebaseDb, 'users', userId), {
            tokens: increment(premioTokens)
        });

        // Enviar notificação in-app
        await addDoc(collection(window.firebaseDb, 'notifications'), {
            title: '🏆 Você foi premiado!',
            message: `Parabéns! Você ganhou ${premioTokens} tokens como prêmio do ${eventoNome}. Use para se inscrever no Semanal Freitas!`,
            type: 'user',
            targetUserId: userId,
            createdAt: serverTimestamp(),
            createdBy: window.firebaseAuth?.currentUser?.email || 'Admin',
            createdByUid: window.firebaseAuth?.currentUser?.uid || null
        });

        // Log
        await logAdminAction('premiar_vencedor', `Premiou ${email} (${userNome}) com ${premioTokens} tokens — ${eventoNome}`);

        showToast('success', `✅ ${premioTokens} tokens creditados para ${userNome} (${email})!`, 'Premiação realizada');
        if (emailEl) emailEl.value = '';
    } catch (err) {
        console.error('Erro ao premiar vencedor:', err);
        showToast('error', 'Erro ao premiar: ' + (err.message || err), 'Erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trophy mr-1"></i> Premiar Vencedor (+3,50 tokens)'; }
    }
}
window.premiarVencedorTreino = premiarVencedorTreino;

// ==================== PACOTE SPEC (Modo Liga) ====================
async function baixarPacoteSPEC() {
    const ctx = window._currentManageHour;
    if (!ctx || !window.firebaseDb) { showToast('error', 'Contexto do horário não encontrado.', 'Erro'); return; }

    const { date, eventType, hour, rawEventId } = ctx;
    const btn = document.getElementById('specDownloadBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando ZIP...'; }

    try {
        // Carregar JSZip dinamicamente se necessário
        if (typeof JSZip === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Buscar inscrições confirmadas do horário (inclui grátis pela lisagem)
        const snap = await getDocs(query(collection(window.firebaseDb, 'registrations'), where('date', '==', date)));
        const validStatuses = new Set(['paid', 'confirmed', 'approved', 'lisagem_gratis']);
        const normalizeHour = (s) => { const m = String(s || '').match(/(\d{1,2})/); return m ? String(parseInt(m[1], 10)).padStart(2, '0') : null; };
        const targetHH = normalizeHour(hour);
        const evLower = String(eventType || '').toLowerCase();
        const rawIdLower = String(rawEventId || '').toLowerCase();

        const matched = [];
        snap.forEach(d => {
            const r = d.data();
            if (!validStatuses.has(r.status)) return;
            const rEvL = String(r.eventType || '').toLowerCase();
            if (!(evLower && rEvL.includes(evLower)) && !(rawIdLower && rEvL.includes(rawIdLower))) return;
            const regHH = normalizeHour(String(r.schedule || '')) || normalizeHour(String(r.hour || ''));
            if (targetHH && regHH && targetHH !== regHH) return;
            matched.push({ id: d.id, ...r });
        });

        matched.sort((a, b) => {
            const sa = a.slot != null ? Number(a.slot) : (a.slotNumber != null ? Number(a.slotNumber) : 9999);
            const sb = b.slot != null ? Number(b.slot) : (b.slotNumber != null ? Number(b.slotNumber) : 9999);
            if (sa !== sb) return sa - sb;
            return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
        });

        if (matched.length === 0) { showToast('warning', 'Nenhuma inscrição confirmada neste horário.', 'Atenção'); return; }

        // Código SPEC: A=902000034, B=902000035, ... Z=902000059
        const letterCode = (posIdx) => String(902000033 + posIdx);

        // Buscar imagens como blob (com fallback para placeholder)
        const PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABmJLR0QA/wD/AP+gvaeTAAAADUlEQVRo3mNkYGBgAAAABAABJjarzgAAAABJRU5ErkJggg==';
        const placeholderBlob = await (await fetch(PLACEHOLDER)).blob();

        const fetchBlob = async (url) => {
            if (!url) return null;
            try {
                const r = await fetch(url, { mode: 'cors' });
                if (!r.ok) throw new Error();
                return await r.blob();
            } catch { return null; }
        };

        // Montar entradas
        const entries = [];
        for (let i = 0; i < matched.length; i++) {
            const r = matched[i];
            const posIdx = i + 1;
            const letter = String.fromCharCode(64 + posIdx);
            const code = letterCode(posIdx);
            const logoUrl = r.teamLogoUrl || r.teamLogoThumb || null;
            const blob = (await fetchBlob(logoUrl)) || placeholderBlob;
            entries.push({ code, letter, teamName: r.teamName || `Time ${letter}`, blob });
        }

        // Criar ZIP com 3 pastas
        const zip = new JSZip();
        for (const pasta of ['BackPackPics', 'HeadPics', 'GloowallPics']) {
            const folder = zip.folder(pasta);
            for (const e of entries) {
                folder.file(`${e.code}.png`, e.blob);
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `spec_modoliga_${hour.replace(':', 'h')}_${date}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);

        await logAdminAction('spec_download', `Gerou pacote SPEC Modo Liga — ${hour} / ${date} — ${entries.length} times`);
        showToast('success', `✅ Pacote SPEC gerado com ${entries.length} times! Verifique seus downloads.`, 'Download iniciado');

    } catch (err) {
        console.error('Erro ao gerar pacote SPEC:', err);
        showToast('error', 'Erro ao gerar ZIP: ' + (err.message || err), 'Erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download mr-2"></i>Baixar Pacote SPEC'; }
    }
}
window.baixarPacoteSPEC = baixarPacoteSPEC;

// Wrapper chamado pelos botões SPEC no modal de Slots por Horário
window.baixarPacoteSPECPorGrupo = function(eventType, rawEventId, date, hour) {
    window._currentManageHour = { date, eventType, hour, rawEventId };
    baixarPacoteSPEC();
};

async function loadAdminNotifications() {
    const listEl = document.getElementById('adminNotifList');
    if (!listEl) return;
    if (!window.firebaseDb) { listEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Firebase não disponível.</p>'; return; }

    listEl.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando...</div>';

    try {
        const { collection, getDocs, query, orderBy, limit, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const q = query(collection(window.firebaseDb, 'notifications'), orderBy('createdAt', 'desc'), limit(300));
        const snap = await getDocs(q);

        if (snap.empty) {
            listEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">Nenhuma notificação enviada ainda.</p>';
            return;
        }

        // Agrupar por batchId para não duplicar envios em lote (credenciais de evento, etc.)
        // Notificações sem batchId são exibidas individualmente
        const groups = [];
        const seenBatch = new Map(); // batchId → índice no array groups

        snap.docs.forEach(d => {
            const n = d.data();
            const bid = n.batchId || null;
            if (bid) {
                if (seenBatch.has(bid)) {
                    // Incrementar contagem do grupo existente
                    groups[seenBatch.get(bid)].count++;
                } else {
                    const idx = groups.length;
                    seenBatch.set(bid, idx);
                    groups.push({ doc: d, data: n, count: 1, batchId: bid });
                }
            } else {
                // Notificação individual (sem lote)
                groups.push({ doc: d, data: n, count: 1, batchId: null });
            }
        });

        listEl.innerHTML = groups.map(g => {
            const n = g.data;
            const d = g.doc;
            const dateStr = n.createdAt ? new Date(n.createdAt.toDate ? n.createdAt.toDate() : n.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const isLote = !!g.batchId;
            const targetLabel = isLote
                ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">${g.count} participante${g.count !== 1 ? 's' : ''}</span>`
                : (n.type === 'all'
                    ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Todos</span>'
                    : `<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${'Específico'}</span>`);
            const deleteAction = isLote
                ? `deleteAdminNotificationBatch('${escapeAdminHtml(g.batchId)}')`
                : `deleteAdminNotification('${d.id}')`;
            return `<div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <span class="font-semibold text-sm text-gray-900">${escapeAdminHtml(n.title || '-')}</span>
                        ${targetLabel}
                    </div>
                    <p class="text-xs text-gray-600 leading-relaxed">${escapeAdminHtml(n.message || '')}</p>
                    <div class="text-xs text-gray-400 mt-1">Enviado em ${dateStr} por ${escapeAdminHtml(n.createdBy || 'Admin')}</div>
                </div>
                <button onclick="${deleteAction}" title="Excluir" class="flex-shrink-0 text-red-400 hover:text-red-600 p-1">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar notificações:', err);
        listEl.innerHTML = '<p class="text-red-400 text-sm text-center py-4">Erro ao carregar notificações.</p>';
    }
}

async function deleteAdminNotification(notifId) {
    if (!notifId || !window.firebaseDb) return;
    if (!confirm('Tem certeza que deseja excluir esta notificação?')) return;
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await deleteDoc(doc(window.firebaseDb, 'notifications', notifId));
        showToast('success', 'Notificação excluída.', 'Sucesso');
        await loadAdminNotifications();
    } catch (err) {
        console.error('Erro ao excluir notificação:', err);
        showToast('error', 'Erro ao excluir notificação.', 'Erro');
    }
}

async function deleteAdminNotificationBatch(batchId) {
    if (!batchId || !window.firebaseDb) return;
    if (!confirm('Excluir todas as notificações deste envio em lote?')) return;
    try {
        const { collection, query, where, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const q = query(collection(window.firebaseDb, 'notifications'), where('batchId', '==', batchId));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map(d => deleteDoc(doc(window.firebaseDb, 'notifications', d.id))));
        showToast('success', `Lote excluído (${snap.size} notificações removidas).`, 'Sucesso');
        await loadAdminNotifications();
    } catch (err) {
        console.error('Erro ao excluir lote de notificações:', err);
        showToast('error', 'Erro ao excluir lote.', 'Erro');
    }
}

function escapeAdminHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.toggleNotifUserField = toggleNotifUserField;
window.sendAdminNotification = sendAdminNotification;
window.loadAdminNotifications = loadAdminNotifications;
window.deleteAdminNotification = deleteAdminNotification;
window.deleteAdminNotificationBatch = deleteAdminNotificationBatch;
window.saveProducts = saveProducts;

// ============================================================
// GERENCIAR EVENTOS
// ============================================================

let currentEventTab = 'camp';

function openEventsModal() {
    const modal = document.getElementById('modalEvents');
    if (!modal) return;
    modal.classList.remove('hidden');
    switchEventTab('camp');
}

function closeEventsModal() {
    const modal = document.getElementById('modalEvents');
    if (modal) modal.classList.add('hidden');
    cancelEventForm();
}

function switchEventTab(tab) {
    currentEventTab = tab;
    const tabs = ['camp', 'xtreino', 'diario'];
    const titles = { camp: 'Campeonatos Criados', xtreino: 'X-Treinos Criados', diario: 'Diário Criados' };
    const activeClass = 'bg-white shadow text-orange-600';
    const inactiveClass = 'text-gray-600 hover:bg-white';

    tabs.forEach(t => {
        const btn = document.getElementById('evtTab-' + t);
        if (!btn) return;
        btn.className = 'flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ' + (t === tab ? activeClass : inactiveClass);
    });

    const listTitle = document.getElementById('evtListTitle');
    if (listTitle) listTitle.textContent = titles[tab];

    // SOLO só disponível em CAMP
    const tipoWrapper = document.getElementById('evtTipoWrapper');
    const tipoSelect = document.getElementById('evtTipo');
    if (tab === 'camp') {
        if (tipoWrapper) tipoWrapper.style.display = '';
        if (tipoSelect) {
            tipoSelect.innerHTML = '<option value="SOLO">SOLO</option><option value="DUO">DUO</option><option value="SQUAD">SQUAD</option>';
        }
        const gruposWrapper = document.getElementById('evtGruposWrapper');
        if (gruposWrapper) gruposWrapper.style.display = '';
    } else {
        if (tipoWrapper) tipoWrapper.style.display = '';
        if (tipoSelect) {
            tipoSelect.innerHTML = '<option value="DUO">DUO</option><option value="SQUAD">SQUAD</option>';
        }
        const gruposWrapper = document.getElementById('evtGruposWrapper');
        if (gruposWrapper) gruposWrapper.style.display = 'none';
    }

    cancelEventForm();
    loadEventsList(tab);
}

function onEvtModoChange() {
    const modo = document.getElementById('evtModo')?.value;
    const hint = document.getElementById('evtVagasHint');
    if (!hint) return;
    if (modo === 'LIGA') {
        hint.textContent = 'Modo LIGA: deve ser 12 ou 15';
    } else {
        hint.textContent = 'Modo NORMAL: múltiplos de 12';
    }
}

function openNewEventForm() {
    document.getElementById('evtEditId').value = '';
    document.getElementById('evtEditCategory').value = currentEventTab;
    document.getElementById('evtFormTitle').textContent = 'Novo Evento';
    document.getElementById('evtName').value = '';
    const evtEtNew = document.getElementById('evtEventType');
    if (evtEtNew) evtEtNew.value = '';
    document.getElementById('evtTipo').value = currentEventTab === 'camp' ? 'SOLO' : 'DUO';
    document.getElementById('evtModo').value = 'NORMAL';
    const fmtElNew = document.getElementById('evtFormato');
    if (fmtElNew) fmtElNew.value = 'Misto';
    document.getElementById('evtStatus').value = 'Aberto';
    const _ordemEl = document.getElementById('evtOrdem');
    if (_ordemEl) _ordemEl.value = '';
    document.getElementById('evtPremiado').value = 'NÃO';
    document.getElementById('evtEntrada').value = 'GRÁTIS';
    document.getElementById('evtVagas').value = '';
    const gruposEl = document.getElementById('evtGrupos');
    if (gruposEl) gruposEl.value = '';
    document.getElementById('evtData').value = '';
    document.getElementById('evtDescricao').value = '';
    document.getElementById('evtFormError').classList.add('hidden');
    onEvtModoChange();
    document.getElementById('evtFormArea').scrollIntoView({ behavior: 'smooth' });
}

function cancelEventForm() {
    document.getElementById('evtEditId').value = '';
    document.getElementById('evtFormTitle').textContent = 'Novo Evento';
    document.getElementById('evtName').value = '';
    const evtEtCancel = document.getElementById('evtEventType');
    if (evtEtCancel) evtEtCancel.value = '';
    document.getElementById('evtVagas').value = '';
    const gruposEl = document.getElementById('evtGrupos');
    if (gruposEl) gruposEl.value = '';
    document.getElementById('evtData').value = '';
    document.getElementById('evtDescricao').value = '';
    document.getElementById('evtFormError').classList.add('hidden');
    // Limpar campos novos
    const precoInput = document.getElementById('evtPreco');
    if (precoInput) precoInput.value = '';
    const precoWrapper = document.getElementById('evtPrecoWrapper');
    if (precoWrapper) precoWrapper.style.display = 'none';
    clearEvtImage();
    const firstSize = document.querySelector('input[name="evtBannerSize"][value="1920x1080"]');
    if (firstSize) firstSize.checked = true;
    const regrasEl = document.getElementById('evtRegras');
    if (regrasEl) regrasEl.value = '';
    const rodadasEl = document.getElementById('evtRodadas');
    if (rodadasEl) rodadasEl.value = '';
    const pontuacaoEl = document.getElementById('evtPontuacao');
    if (pontuacaoEl) pontuacaoEl.value = '';
    const youtubeEl = document.getElementById('evtYoutubeUrl');
    if (youtubeEl) youtubeEl.value = '';
}

function validateEventForm(category) {
    const name = document.getElementById('evtName').value.trim();
    const modo = document.getElementById('evtModo').value;
    const vagas = parseInt(document.getElementById('evtVagas').value, 10);

    if (!name) return 'Informe o nome do evento.';
    if (!vagas || vagas < 1) return 'Informe a quantidade de vagas.';

    if (modo === 'NORMAL') {
        if (vagas % 12 !== 0) return `Modo NORMAL: a quantidade de vagas deve ser múltiplo de 12. Você informou ${vagas}.`;
    } else if (modo === 'LIGA') {
        if (vagas !== 12 && vagas !== 15) return `Modo LIGA: a quantidade de vagas deve ser 12 ou 15. Você informou ${vagas}.`;
    }

    if (category === 'camp') {
        const grupos = parseInt(document.getElementById('evtGrupos')?.value, 10);
        if (!grupos || grupos < 1) return 'Informe a quantidade de grupos para o Campeonato.';
    }

    return null;
}

let _isSavingEvent = false;

// ---- Helpers de upload de imagem do evento ----
function onEvtEntradaChange() {
    const isPago = document.getElementById('evtEntrada').value === 'PAGO';
    const wrapper = document.getElementById('evtPrecoWrapper');
    if (wrapper) wrapper.style.display = isPago ? '' : 'none';
}

function onEvtImageSelected(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const preview = document.getElementById('evtImagePreview');
    const previewImg = document.getElementById('evtImagePreviewImg');
    const previewName = document.getElementById('evtImagePreviewName');
    if (preview && previewImg) {
        previewImg.src = URL.createObjectURL(file);
        if (previewName) previewName.textContent = file.name;
        preview.classList.remove('hidden');
    }
    document.getElementById('evtImageUrl').value = '';
    const urlDirect = document.getElementById('evtImageUrlDirect');
    if (urlDirect) urlDirect.value = '';
}

function onEvtImageUrlInput(input) {
    const url = input.value.trim();
    const preview = document.getElementById('evtImagePreview');
    const previewImg = document.getElementById('evtImagePreviewImg');
    const previewName = document.getElementById('evtImagePreviewName');
    const fileInput = document.getElementById('evtImageInput');
    if (url) {
        if (fileInput) fileInput.value = '';
        document.getElementById('evtImageUrl').value = url;
        if (previewImg) previewImg.src = url;
        if (previewName) previewName.textContent = 'Link direto';
        if (preview) preview.classList.remove('hidden');
    } else {
        document.getElementById('evtImageUrl').value = '';
        if (preview) preview.classList.add('hidden');
    }
}

function clearEvtImage() {
    const input = document.getElementById('evtImageInput');
    const preview = document.getElementById('evtImagePreview');
    const previewImg = document.getElementById('evtImagePreviewImg');
    if (input) input.value = '';
    if (previewImg) previewImg.src = '';
    if (preview) preview.classList.add('hidden');
    const urlField = document.getElementById('evtImageUrl');
    if (urlField) urlField.value = '';
    const urlDirect = document.getElementById('evtImageUrlDirect');
    if (urlDirect) urlDirect.value = '';
}

async function uploadEvtImage(file, eventId) {
    const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

    // Diagnóstico: verificar auth e bucket
    const auth = getAuth(window.firebaseApp);
    const currentUser = auth.currentUser;
    const bucketUrl = window.firebaseStorage?._url || window.firebaseStorage?.app?.options?.storageBucket || 'desconhecido';
    console.log('[Storage Upload] Auth user:', currentUser ? currentUser.email : 'NÃO AUTENTICADO');
    console.log('[Storage Upload] Bucket:', bucketUrl);
    console.log('[Storage Upload] File:', file.name, file.size, 'bytes');

    if (!currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
    }

    const path = `events/${eventId || ('new_' + Date.now())}_${file.name}`;
    console.log('[Storage Upload] Path:', path);
    const storageRef = ref(window.firebaseStorage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    console.log('[Storage Upload] Sucesso! URL:', url);
    return url;
}
// ---- Fim helpers ----

async function saveEventForm() {
    if (_isSavingEvent) return;

    const category = currentEventTab;
    const error = validateEventForm(category);
    const errorEl = document.getElementById('evtFormError');

    if (error) {
        errorEl.textContent = error;
        errorEl.classList.remove('hidden');
        return;
    }
    errorEl.classList.add('hidden');

    const saveBtn = document.querySelector('#evtFormArea button[onclick="saveEventForm()"]');
    const originalHtml = saveBtn ? saveBtn.innerHTML : null;

    _isSavingEvent = true;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Salvando...';
    }

    const editId = document.getElementById('evtEditId').value;
    const bannerSizeEl = document.querySelector('input[name="evtBannerSize"]:checked');
    const entrada = document.getElementById('evtEntrada').value;

    const data = {
        category,
        name: document.getElementById('evtName').value.trim(),
        eventType: (document.getElementById('evtEventType')?.value || '').trim() || null,
        tipo: document.getElementById('evtTipo').value,
        modo: document.getElementById('evtModo').value,
        formato: (document.getElementById('evtFormato')?.value || 'MISTO').toUpperCase(),
        status: document.getElementById('evtStatus').value,
        premiado: document.getElementById('evtPremiado').value,
        premiacao: (document.getElementById('evtPremiacao')?.value || '').trim(),
        entrada,
        vagas: parseInt(document.getElementById('evtVagas').value, 10),
        quedas: parseInt(document.getElementById('evtQuedas')?.value, 10) || null,
        mapas: Array.from(document.querySelectorAll('input[name="evtMapas"]:checked')).map(el => el.value),
        descricao: document.getElementById('evtDescricao').value.trim(),
        regras: (document.getElementById('evtRegras')?.value || '').trim(),
        rodadas: (document.getElementById('evtRodadas')?.value || '').trim(),
        pontuacao: (document.getElementById('evtPontuacao')?.value || '').trim(),
        youtubeUrl: (document.getElementById('evtYoutubeUrl')?.value || '').trim(),
        bannerSize: bannerSizeEl ? bannerSizeEl.value : '1920x1080',
        ordem: parseInt(document.getElementById('evtOrdem')?.value, 10) || null,
        updatedAt: new Date().toISOString()
    };

    if (entrada === 'PAGO') {
        const preco = parseFloat(document.getElementById('evtPreco').value);
        if (preco > 0) data.preco = preco;
    } else {
        data.preco = null;
    }

    const dataVal = document.getElementById('evtData').value;
    if (dataVal) data.eventDate = new Date(dataVal).toISOString();

    if (category === 'camp') {
        data.grupos = parseInt(document.getElementById('evtGrupos')?.value, 10) || 0;
    }

    if (!editId) data.createdAt = new Date().toISOString();

    // Manter imageUrl existente como default
    const existingImageUrl = document.getElementById('evtImageUrl').value;
    if (existingImageUrl) data.imageUrl = existingImageUrl;

    try {
        // Fazer upload da imagem se uma nova foi selecionada
        const imageFile = document.getElementById('evtImageInput').files?.[0];
        if (imageFile && window.firebaseStorage) {
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Enviando imagem...';
            const tempId = editId || ('tmp_' + Date.now());
            try {
                data.imageUrl = await uploadEvtImage(imageFile, tempId);
            } catch (uploadErr) {
                console.error('Erro no upload da imagem:', uploadErr);
                showToast('warning', 'Imagem não enviada (permissão negada). O evento será salvo sem imagem. Verifique as regras do Firebase Storage.', 'Atenção');
                // Continua sem imageUrl — o evento é salvo mesmo assim
            }
        }

        const { collection, doc, addDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        if (editId) {
            await updateDoc(doc(window.firebaseDb, 'adminEvents', editId), data);
            showToast('success', 'Evento atualizado com sucesso.', 'Salvo');
        } else {
            await addDoc(collection(window.firebaseDb, 'adminEvents'), data);
            showToast('success', 'Evento criado com sucesso.', 'Criado');
        }
        cancelEventForm();
        await loadEventsList(category);
    } catch (err) {
        console.error('Erro ao salvar evento:', err);
        errorEl.textContent = 'Erro ao salvar evento: ' + (err.message || err);
        errorEl.classList.remove('hidden');
    } finally {
        _isSavingEvent = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml || '<i class="fas fa-save mr-1"></i>Salvar Evento';
        }
    }
}

async function loadEventsList(category) {
    const listEl = document.getElementById('evtList');
    if (!listEl || !window.firebaseDb) return;
    listEl.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';

    try {
        const { collection, query, where, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const colRef = collection(window.firebaseDb, 'adminEvents');
        let snap;
        try {
            snap = await getDocs(query(colRef, where('category', '==', category), orderBy('createdAt', 'desc')));
        } catch (indexErr) {
            if (indexErr?.code === 'failed-precondition') {
                snap = await getDocs(query(colRef, where('category', '==', category)));
            } else {
                throw indexErr;
            }
        }

        if (snap.empty) {
            listEl.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fas fa-calendar-times text-3xl mb-2 block"></i>Nenhum evento cadastrado ainda.</div>';
            return;
        }

        const categoryLabels = { camp: 'CAMP', xtreino: 'XTREINO', diario: 'DIÁRIO' };
        const statusColors = {
            'Aberto': 'bg-green-100 text-green-700',
            'Em andamento': 'bg-blue-100 text-blue-700',
            'Em breve': 'bg-yellow-100 text-yellow-700',
            'Fechado': 'bg-red-100 text-red-700'
        };

        listEl.innerHTML = snap.docs.map(d => {
            const ev = d.data();
            const statusCls = statusColors[ev.status] || 'bg-gray-100 text-gray-600';
            const dateStr = ev.eventDate ? new Date(ev.eventDate).toLocaleString('pt-BR') : '—';
            const gruposStr = category === 'camp' && ev.grupos ? `<span class="text-xs text-gray-500">Grupos: <b>${ev.grupos}</b></span>` : '';
            return `<div class="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <span class="font-bold text-sm text-gray-800 truncate">${escapeAdminHtml(ev.name)}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${statusCls}">${ev.status || 'Aberto'}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">${ev.tipo}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">${ev.modo}</span>
                    </div>
                    <div class="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span>Vagas: <b>${ev.vagas}</b></span>
                        ${gruposStr}
                        <span>Premiado: <b>${ev.premiado}</b></span>
                        <span>Entrada: <b>${ev.entrada}</b></span>
                        <span>Data: <b>${dateStr}</b></span>
                    </div>
                    ${ev.descricao ? `<p class="text-xs text-gray-400 mt-1 truncate">${escapeAdminHtml(ev.descricao)}</p>` : ''}
                </div>
                <div class="flex gap-2 flex-shrink-0 flex-wrap">
                    ${category === 'camp' ? `<button onclick="openCampGroupsModal('${d.id}', this.dataset.name)" data-name="${escapeAdminHtml(ev.name || '')}" title="Gerenciar grupos" class="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-semibold hover:bg-orange-100"><i class="fas fa-users mr-1"></i>Grupos</button>` : ''}
                    <a href="evento.html?event=${encodeURIComponent(ev.eventType || d.id)}" target="_blank" class="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100 inline-flex items-center" title="Ver página do evento">
                        <i class="fas fa-external-link-alt mr-1"></i>Ver Página
                    </a>
                    <button onclick="openEventSlotsModal('${d.id}', this.dataset.name)" data-name="${escapeAdminHtml(ev.name || '')}" title="Ver slots por horário" class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100">
                        <i class="fas fa-hashtag mr-1"></i>Slots
                    </button>
                    <button onclick="openEventNotifyModal('${d.id}', this.dataset.name)" data-name="${escapeAdminHtml(ev.name || '')}" title="Enviar mensagem aos participantes" class="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-100">
                        <i class="fas fa-paper-plane mr-1"></i>Notificar
                    </button>
                    <button onclick="editEventItem('${d.id}')" title="Editar" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100">
                        <i class="fas fa-pen mr-1"></i>Editar
                    </button>
                    <button onclick="deleteEventItem('${d.id}')" title="Excluir" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100">
                        <i class="fas fa-trash mr-1"></i>Excluir
                    </button>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar eventos:', err);
        listEl.innerHTML = '<div class="text-center py-8 text-red-400">Erro ao carregar eventos.</div>';
    }
}

async function editEventItem(eventId) {
    if (!window.firebaseDb) return;
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDoc(doc(window.firebaseDb, 'adminEvents', eventId));
        if (!snap.exists()) { showToast('error', 'Evento não encontrado.', 'Erro'); return; }
        const ev = snap.data();

        document.getElementById('evtEditId').value = eventId;
        document.getElementById('evtFormTitle').textContent = 'Editar Evento';
        document.getElementById('evtName').value = ev.name || '';
        const evtEventTypeEl = document.getElementById('evtEventType');
        if (evtEventTypeEl) evtEventTypeEl.value = ev.eventType || '';
        document.getElementById('evtTipo').value = ev.tipo || 'SOLO';
        document.getElementById('evtModo').value = ev.modo || 'NORMAL';
        const fmtEl = document.getElementById('evtFormato');
        if (fmtEl) fmtEl.value = (ev.formato || 'MISTO').toUpperCase();
        document.getElementById('evtStatus').value = ev.status || 'Aberto';
        const ordemEl = document.getElementById('evtOrdem');
        if (ordemEl) ordemEl.value = ev.ordem != null ? ev.ordem : '';
        document.getElementById('evtPremiado').value = ev.premiado || 'NÃO';
        const premiacaoEl = document.getElementById('evtPremiacao');
        if (premiacaoEl) premiacaoEl.value = ev.premiacao || '';
        document.getElementById('evtEntrada').value = ev.entrada || 'GRÁTIS';
        document.getElementById('evtVagas').value = ev.vagas || '';
        const gruposEl = document.getElementById('evtGrupos');
        if (gruposEl) gruposEl.value = ev.grupos || '';
        if (ev.eventDate) {
            const dt = new Date(ev.eventDate);
            const pad = n => String(n).padStart(2, '0');
            document.getElementById('evtData').value = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        } else {
            document.getElementById('evtData').value = '';
        }
        document.getElementById('evtDescricao').value = ev.descricao || '';
        const regrasEl = document.getElementById('evtRegras');
        if (regrasEl) regrasEl.value = ev.regras || '';
        const rodadasEl = document.getElementById('evtRodadas');
        if (rodadasEl) rodadasEl.value = ev.rodadas || '';
        const pontuacaoEl = document.getElementById('evtPontuacao');
        if (pontuacaoEl) pontuacaoEl.value = ev.pontuacao || '';
        const youtubeEl = document.getElementById('evtYoutubeUrl');
        if (youtubeEl) youtubeEl.value = ev.youtubeUrl || '';

        // Quedas
        const quedasEl = document.getElementById('evtQuedas');
        if (quedasEl) quedasEl.value = ev.quedas || '';

        // Mapas — desmarcar tudo e marcar os salvos
        document.querySelectorAll('input[name="evtMapas"]').forEach(cb => {
            cb.checked = Array.isArray(ev.mapas) && ev.mapas.includes(cb.value);
        });

        // Preço
        const precoInput = document.getElementById('evtPreco');
        if (precoInput) precoInput.value = ev.preco || '';
        onEvtEntradaChange();

        // Banner size
        if (ev.bannerSize) {
            const sizeRadio = document.querySelector(`input[name="evtBannerSize"][value="${ev.bannerSize}"]`);
            if (sizeRadio) sizeRadio.checked = true;
        }

        // Imagem existente
        clearEvtImage();
        if (ev.imageUrl) {
            const preview = document.getElementById('evtImagePreview');
            const previewImg = document.getElementById('evtImagePreviewImg');
            const previewName = document.getElementById('evtImagePreviewName');
            const urlField = document.getElementById('evtImageUrl');
            if (previewImg) previewImg.src = ev.imageUrl;
            if (previewName) previewName.textContent = 'Imagem atual';
            if (preview) preview.classList.remove('hidden');
            if (urlField) urlField.value = ev.imageUrl;
        }

        document.getElementById('evtFormError').classList.add('hidden');
        onEvtModoChange();
        document.getElementById('evtFormArea').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Erro ao carregar evento para edição:', err);
        showToast('error', 'Erro ao carregar evento.', 'Erro');
    }
}

// ===== CAMP GRUPOS (Multi-Phase) =====
let _campGroupsEventId = null;
let _campGroupsPhase = 'fase1';
let _campPhaseList = []; // phases found in Firestore for this event, sorted

function _phaseLabel(key) {
    if (!key) return '';
    if (key === 'semifinal') return 'Semifinal';
    if (key === 'final') return 'Final 🏆';
    if (key === 'classificatoria') return 'Fase 1';
    const m = key.match(/^fase(\d+)$/i);
    if (m) return `Fase ${m[1]}`;
    return key;
}
function _phaseOrder(key) {
    if (key === 'final') return 99;
    if (key === 'semifinal') return 98;
    if (key === 'classificatoria') return 1;
    const m = key.match(/^fase(\d+)$/i);
    return m ? parseInt(m[1]) : 50;
}
function _phaseTeamSize(key) {
    return (key === 'semifinal' || key === 'final') ? 15 : 12;
}
function _prevPhaseKey(key) {
    if (key === 'final') return 'semifinal';
    if (key === 'semifinal') {
        const fases = _campPhaseList.filter(p => /^fase\d+$/.test(p.key));
        return fases.length ? fases[fases.length - 1].key : 'fase1';
    }
    const m = key.match(/^fase(\d+)$/i);
    if (m) { const n = parseInt(m[1]); return n > 1 ? `fase${n - 1}` : null; }
    return null;
}

function openCampGroupsModal(eventId, eventName) {
    _campGroupsEventId = eventId;
    _campGroupsPhase = 'fase1';
    _campPhaseList = [];
    const modal = document.getElementById('campGroupsModal');
    if (!modal) return;
    const titleEl = document.getElementById('campGroupsTitle');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-users text-orange-500 mr-2"></i>Grupos — ${escapeAdminHtml(eventName || 'Campeonato')}`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    loadCampPhaseList(false);
}

function closeCampGroupsModal() {
    const modal = document.getElementById('campGroupsModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    _campGroupsEventId = null;
    _campPhaseList = [];
}

async function loadCampPhaseList(keepCurrentPhase = false) {
    const tabsEl = document.getElementById('campPhaseTabs');
    if (!window.firebaseDb || !_campGroupsEventId) return;
    if (tabsEl) tabsEl.innerHTML = '<span class="text-xs text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>Carregando...</span>';

    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        // Probe known keys directly — no index needed, no collection query
        const keysToProbe = [
            'classificatoria', // legacy alias
            'fase1','fase2','fase3','fase4','fase5','fase6','fase7','fase8',
            'semifinal','final'
        ];
        const seen = new Set();
        const phases = [];
        const reads = keysToProbe.map(k =>
            getDoc(doc(window.firebaseDb, 'camp_groups', `${_campGroupsEventId}_${k}`))
                .then(snap => ({ k, snap }))
                .catch(() => ({ k, snap: null }))
        );
        const results = await Promise.all(reads);
        results.forEach(({ k, snap }) => {
            if (!snap || !snap.exists()) return;
            let key = k === 'classificatoria' ? 'fase1' : k;
            if (seen.has(key)) return;
            seen.add(key);
            phases.push({ key, label: _phaseLabel(key), order: _phaseOrder(key) });
        });
        phases.sort((a, b) => a.order - b.order);
        _campPhaseList = phases;

        _renderCampPhaseTabs(phases);
        _updateNextPhaseSelect(phases);

        const toSelect = keepCurrentPhase && phases.find(p => p.key === _campGroupsPhase)
            ? _campGroupsPhase : (phases[0]?.key || 'fase1');
        setCampGroupsPhase(toSelect, true);

    } catch (err) {
        console.error('Erro ao carregar fases:', err);
        if (tabsEl) tabsEl.innerHTML = '<span class="text-xs text-red-400">Erro ao carregar fases.</span>';
    }
}

function _renderCampPhaseTabs(phases) {
    const tabsEl = document.getElementById('campPhaseTabs');
    if (!tabsEl) return;
    if (!phases.length) {
        tabsEl.innerHTML = '<span class="text-xs text-gray-400 italic">Nenhuma fase gerada ainda.</span>';
        return;
    }
    let html = '';
    phases.forEach((p, i) => {
        html += `<button id="campPhaseBtn_${p.key}" onclick="setCampGroupsPhase('${p.key}')"
            class="px-3 py-1.5 rounded-lg font-bold text-xs bg-gray-100 text-gray-700 transition-colors whitespace-nowrap">
            ${escapeAdminHtml(p.label.toUpperCase())}
        </button>`;
        if (i < phases.length - 1) html += `<i class="fas fa-arrow-right text-gray-400 text-xs self-center"></i>`;
    });
    tabsEl.innerHTML = html;
}

function _updateNextPhaseSelect(phases) {
    const sel = document.getElementById('campNextPhaseSelect');
    if (!sel) return;
    const existingKeys = new Set(phases.map(p => p.key));
    const opts = [];

    if (!existingKeys.has('fase1')) {
        opts.push({ key: 'fase1', label: 'Fase 1 (inscritos)' });
    } else {
        const lastN = phases.filter(p => /^fase\d+$/.test(p.key))
            .reduce((mx, p) => Math.max(mx, parseInt(p.key.replace('fase', ''))), 0);
        if (lastN > 0 && !existingKeys.has('semifinal')) {
            opts.push({ key: `fase${lastN + 1}`, label: `Fase ${lastN + 1}` });
            opts.push({ key: 'semifinal', label: 'Semifinal (direto)' });
        }
        if (existingKeys.has('semifinal') && !existingKeys.has('final')) {
            opts.push({ key: 'final', label: 'Final' });
        }
    }
    if (!opts.length) opts.push({ key: 'regenerar', label: '— Regenerar fase atual —' });

    sel.innerHTML = opts.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
    _onNextPhaseSelectChange();
}

function _onNextPhaseSelectChange() {
    const sel = document.getElementById('campNextPhaseSelect');
    const key = sel?.value || '';
    const advWrapper = document.getElementById('campAdvancingWrapper');
    const labelEl = document.getElementById('campAdvancingLabel');
    const genBtn = document.getElementById('campGenerateBtn');
    const isFinal = key === 'final';
    if (advWrapper) advWrapper.style.display = isFinal ? 'none' : '';
    if (labelEl) {
        if (key === 'semifinal' || key === 'final') labelEl.textContent = `Times que avançam para a ${_phaseLabel(key)}`;
        else { const n = key.match(/^fase(\d+)$/)?.[1]; labelEl.textContent = n ? `Times que avançam para Fase ${n}` : 'Times que avançam'; }
    }
    if (genBtn) genBtn.innerHTML = `<i class="fas fa-list-ol mr-1"></i>Gerar ${_phaseLabel(key)}`;
}

function setCampGroupsPhase(phase, reload = true) {
    _campGroupsPhase = phase;
    document.querySelectorAll('[id^="campPhaseBtn_"]').forEach(btn => {
        const isActive = btn.id === `campPhaseBtn_${phase}`;
        btn.className = isActive
            ? 'px-3 py-1.5 rounded-lg font-bold text-xs bg-orange-600 text-white transition-colors whitespace-nowrap'
            : 'px-3 py-1.5 rounded-lg font-bold text-xs bg-gray-100 text-gray-700 transition-colors whitespace-nowrap';
    });
    const teamSize = _phaseTeamSize(phase);
    const phaseLabel = _phaseLabel(phase);
    const descTextEl = document.getElementById('campPhaseDescText');
    if (descTextEl) {
        if (phase === 'final') descTextEl.textContent = `Final: ${teamSize} times por grupo. Times vêm dos que avançaram na Semifinal.`;
        else if (phase === 'semifinal') descTextEl.textContent = `Semifinal: ${teamSize} times por grupo, vindos da fase anterior. Informe quantos avançam para a Final.`;
        else { const n = phase.match(/^fase(\d+)$/)?.[1] || '1'; descTextEl.textContent = `${phaseLabel}: ${teamSize} times por grupo${n === '1' ? ', ordem de inscrição' : ', top 6 de cada grupo anterior'}. 6 avançam por grupo.`; }
    }
    const infoEl = document.getElementById('campPhaseInfo');
    if (infoEl) infoEl.classList.add('hidden');
    if (reload) loadCampGroups();
}

async function loadCampGroups() {
    const container = document.getElementById('campGroupsContent');
    if (!container || !window.firebaseDb || !_campGroupsEventId) return;
    container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const phase = _campGroupsPhase;
        // Try the phase key; also try 'classificatoria' as alias when phase=fase1
        const keysToTry = [phase];
        if (phase === 'fase1') keysToTry.push('classificatoria');
        let data = null;
        for (const k of keysToTry) {
            const snap = await getDoc(doc(window.firebaseDb, 'camp_groups', `${_campGroupsEventId}_${k}`));
            if (snap.exists()) { data = snap.data(); break; }
        }
        if (!data) {
            container.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">Nenhum grupo gerado para esta fase.<br>Use o seletor abaixo para gerar.</div>`;
            return;
        }
        renderCampGroups(data.groups || [], data.advancingPerGroup || 0, data.generatedAt, data.teamSize);
    } catch (err) {
        console.error('Erro ao carregar grupos:', err);
        container.innerHTML = '<div class="text-center py-4 text-red-400 text-sm">Erro ao carregar grupos.</div>';
    }
}

function renderCampGroups(groups, advancingPerGroup, generatedAt, teamSize) {
    const container = document.getElementById('campGroupsContent');
    if (!container) return;
    if (!groups || !groups.length) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">Nenhum grupo gerado.</div>';
        return;
    }
    const capacity = teamSize || (_campGroupsPhase === 'classificatoria' ? 12 : 15);
    const totalTeams = groups.reduce((s, g) => s + g.teams.length, 0);
    const dateStr = generatedAt?.toDate ? generatedAt.toDate().toLocaleString('pt-BR') : (generatedAt ? new Date(generatedAt).toLocaleString('pt-BR') : '');
    const advInfo = advancingPerGroup
        ? `<div class="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
               <i class="fas fa-arrow-up"></i>
               <span><b>${advancingPerGroup}</b> time(s) avançam por grupo</span>
               <span class="ml-auto text-xs text-blue-400">${totalTeams} times · ${groups.length} grupos</span>
           </div>` : '';
    const dateInfo = dateStr ? `<p class="text-xs text-gray-400 mb-3">Gerado em: ${dateStr}</p>` : '';
    container.innerHTML = advInfo + dateInfo + groups.map(g => {
        const count = g.teams.length;
        const isFull = count >= capacity;
        const statusBadge = isFull
            ? `<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">COMPLETO</span>`
            : `<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">AGUARDANDO</span>`;
        return `
        <div class="border border-gray-200 rounded-xl overflow-hidden mb-3">
            <div class="bg-orange-50 border-b border-orange-100 px-4 py-2 flex justify-between items-center gap-2">
                <span class="font-bold text-orange-700 text-sm">${g.name} <span class="font-normal text-gray-500">(${count}/${capacity})</span></span>
                ${statusBadge}
            </div>
            <ul class="divide-y divide-gray-100">
                ${g.teams.map((t, j) => `
                <li class="flex items-center gap-3 px-4 py-2">
                    <span class="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">${j + 1}</span>
                    <span class="text-sm text-gray-800 flex-1">${escapeAdminHtml(t)}</span>
                    ${advancingPerGroup && j < advancingPerGroup ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">Avança ↑</span>' : ''}
                </li>`).join('')}
            </ul>
        </div>`;
    }).join('');
}

async function _getTeamsFromPrevPhase(eventId, prevKey) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const keysToTry = [prevKey];
    if (prevKey === 'fase1') keysToTry.push('classificatoria');
    for (const k of keysToTry) {
        const snap = await getDoc(doc(window.firebaseDb, 'camp_groups', `${eventId}_${k}`));
        if (snap.exists()) return snap.data();
    }
    return null;
}

async function generateCampGroups() {
    const eventId = _campGroupsEventId;
    if (!eventId) return;

    // Phase to generate comes from the selector
    const sel = document.getElementById('campNextPhaseSelect');
    const phase = sel?.value || 'fase1';
    if (phase === 'regenerar') { await reorganizarGrupos(); return; }

    const advancingInput = document.getElementById('campAdvancingInput');
    const totalAdvancing = parseInt(advancingInput?.value || '0', 10) || 0;
    const teamSize = _phaseTeamSize(phase);

    const btn = document.getElementById('campGenerateBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Gerando...'; }

    try {
        const { collection, query, where, getDocs, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        let teams = [];

        const isFirstPhase = phase === 'fase1' || phase === 'classificatoria';
        if (isFirstPhase) {
            // Fase 1: from registrations sorted by inscription date
            const regsSnap = await getDocs(query(
                collection(window.firebaseDb, 'registrations'),
                where('eventType', '==', eventId)
            ));
            const validSt = new Set(['confirmed', 'paid', 'approved']);
            const entries = []; const seen = new Set();
            regsSnap.docs.forEach(d => {
                const data = d.data();
                if (!validSt.has(data.status) || !data.teamName) return;
                const norm = data.teamName.trim().toLowerCase().replace(/\s+/g, ' ');
                if (seen.has(norm)) return;
                seen.add(norm);
                const ts = data.createdAt?.toMillis?.() || (data.createdAt?.seconds || 0) * 1000;
                entries.push({ name: data.teamName, ts });
            });
            entries.sort((a, b) => a.ts - b.ts);
            teams = entries.map(e => e.name);
        } else {
            // Subsequent phases: top-N from previous phase groups
            const prevKey = _prevPhaseKey(phase);
            if (!prevKey) { showToast('warning', 'Fase anterior não encontrada.', 'Atenção'); return; }
            const prevData = await _getTeamsFromPrevPhase(eventId, prevKey);
            if (!prevData) {
                showToast('warning', `Gere os grupos de "${_phaseLabel(prevKey)}" primeiro.`, 'Atenção');
                return;
            }
            const prevAdv = prevData.advancingPerGroup || 6;
            if (!prevAdv) { showToast('warning', 'Defina quantos avançam na fase anterior antes de gerar a próxima.', 'Atenção'); return; }
            (prevData.groups || []).forEach(g => g.teams.slice(0, prevAdv).forEach(t => { if (t) teams.push(t); }));
        }

        if (!teams.length) { showToast('warning', 'Nenhum time encontrado para esta fase.', 'Sem times'); return; }

        const groups = [];
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < teams.length; i += teamSize) {
            const gIdx = groups.length;
            const letter = letters[gIdx] || String(gIdx + 1);
            groups.push({ name: `Grupo ${letter}`, teams: teams.slice(i, i + teamSize) });
        }

        const defaultAdv = phase === 'final' ? 0 : 6;
        const advancingPerGroup = totalAdvancing > 0 && groups.length > 0
            ? Math.ceil(totalAdvancing / groups.length) : defaultAdv;

        await setDoc(doc(window.firebaseDb, 'camp_groups', `${eventId}_${phase}`), {
            eventId, phaseKey: phase, phaseOrder: _phaseOrder(phase),
            teamSize, advancingPerGroup, totalAdvancing: totalAdvancing || advancingPerGroup * groups.length,
            groups, generatedAt: serverTimestamp()
        });

        const advMsg = advancingPerGroup ? ` · ${advancingPerGroup} avançam por grupo` : '';
        showToast('success', `${_phaseLabel(phase)}: ${groups.length} grupo(s) · ${teams.length} times${advMsg}.`, 'Gerado');
        _updatePhaseInfo(phase, groups.length, teams.length, advancingPerGroup);

        await loadCampPhaseList(false);
        setCampGroupsPhase(phase, false);
        renderCampGroups(groups, advancingPerGroup, null, teamSize);

    } catch (err) {
        console.error('Erro ao gerar grupos:', err);
        showToast('error', 'Erro ao gerar grupos: ' + (err.message || ''), 'Erro');
    } finally {
        if (btn) { btn.disabled = false; _onNextPhaseSelectChange(); }
    }
}

async function reorganizarGrupos() {
    const eventId = _campGroupsEventId;
    const phase = _campGroupsPhase;
    if (!eventId) return;
    if (!confirm(`Reorganizar redistribuirá todos os grupos de "${_phaseLabel(phase)}" pela ordem atual. Confirmar?`)) return;

    const btn = document.getElementById('campReorganizeBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Reorganizando...'; }

    try {
        const { collection, query, where, getDocs, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const teamSize = _phaseTeamSize(phase);
        const advancingInput = document.getElementById('campAdvancingInput');
        const totalAdvancing = parseInt(advancingInput?.value || '0', 10) || 0;
        let teams = [];

        const isFirst = phase === 'fase1' || phase === 'classificatoria';
        if (isFirst) {
            const regsSnap = await getDocs(query(
                collection(window.firebaseDb, 'registrations'),
                where('eventType', '==', eventId)
            ));
            const validSt = new Set(['confirmed', 'paid', 'approved']);
            const entries = []; const seen = new Set();
            regsSnap.docs.forEach(d => {
                const data = d.data();
                if (!validSt.has(data.status) || !data.teamName) return;
                const norm = data.teamName.trim().toLowerCase().replace(/\s+/g, ' ');
                if (seen.has(norm)) return; seen.add(norm);
                const ts = data.createdAt?.toMillis?.() || (data.createdAt?.seconds || 0) * 1000;
                entries.push({ name: data.teamName, ts });
            });
            entries.sort((a, b) => a.ts - b.ts);
            teams = entries.map(e => e.name);
        } else {
            const prevKey = _prevPhaseKey(phase);
            const prevData = prevKey ? await _getTeamsFromPrevPhase(eventId, prevKey) : null;
            if (!prevData) { showToast('warning', 'Fase anterior não encontrada.', 'Atenção'); return; }
            const prevAdv = prevData.advancingPerGroup || 6;
            (prevData.groups || []).forEach(g => g.teams.slice(0, prevAdv).forEach(t => { if (t) teams.push(t); }));
        }

        if (!teams.length) { showToast('warning', 'Nenhum time encontrado.', 'Sem times'); return; }

        const groups = [];
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < teams.length; i += teamSize) {
            const gIdx = groups.length;
            const letter = letters[gIdx] || String(gIdx + 1);
            groups.push({ name: `Grupo ${letter}`, teams: teams.slice(i, i + teamSize) });
        }
        const advancingPerGroup = totalAdvancing > 0 && groups.length > 0 ? Math.ceil(totalAdvancing / groups.length) : (phase === 'final' ? 0 : 6);

        await setDoc(doc(window.firebaseDb, 'camp_groups', `${eventId}_${phase}`), {
            eventId, phaseKey: phase, phaseOrder: _phaseOrder(phase),
            teamSize, advancingPerGroup, totalAdvancing: totalAdvancing || advancingPerGroup * groups.length,
            groups, generatedAt: serverTimestamp()
        });

        renderCampGroups(groups, advancingPerGroup, null, teamSize);
        _updatePhaseInfo(phase, groups.length, teams.length, advancingPerGroup);
        showToast('success', `Grupos reorganizados: ${groups.length} grupo(s), ${teams.length} time(s).`, 'Reorganizado');

    } catch (err) {
        console.error('Erro ao reorganizar grupos:', err);
        showToast('error', 'Erro ao reorganizar: ' + (err.message || ''), 'Erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-redo mr-1"></i>Reorganizar'; }
    }
}

function _updatePhaseInfo(phase, numGroups, numTeams, advancingPerGroup) {
    const infoEl = document.getElementById('campPhaseInfo');
    if (!infoEl) return;
    const totalAdv = advancingPerGroup * numGroups;
    if (phase === 'final') {
        infoEl.textContent = `Final: ${numTeams} times em ${numGroups} grupo(s).`;
    } else if (phase === 'semifinal') {
        infoEl.textContent = `Semifinal: ${numGroups} grupo(s) · ${numTeams} times · ${totalAdv} avançam para a Final`;
    } else {
        const nextLabel = _phaseLabel(`fase${(_phaseOrder(phase) || 1) + 1}`);
        infoEl.textContent = `${numGroups} grupo(s) · ${numTeams} times · ${totalAdv} avançam → ${nextLabel}`;
    }
    infoEl.classList.remove('hidden');
}

async function deleteEventItem(eventId) {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await deleteDoc(doc(window.firebaseDb, 'adminEvents', eventId));
        showToast('success', 'Evento excluído.', 'Excluído');
        await loadEventsList(currentEventTab);
    } catch (err) {
        console.error('Erro ao excluir evento:', err);
        showToast('error', 'Erro ao excluir evento.', 'Erro');
    }
}

async function loadEventsPreview() {
    const previewEl = document.getElementById('eventsPreview');
    if (!previewEl || !window.firebaseDb) return;

    try {
        const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const colRef = collection(window.firebaseDb, 'adminEvents');
        let snap;
        try {
            snap = await getDocs(query(colRef, orderBy('createdAt', 'desc'), limit(6)));
        } catch (indexErr) {
            if (indexErr?.code === 'failed-precondition') {
                snap = await getDocs(query(colRef, limit(6)));
            } else {
                throw indexErr;
            }
        }

        if (snap.empty) {
            previewEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-3">Nenhum evento cadastrado. Clique em "Criar / Gerenciar" para começar.</p>';
            return;
        }

        const catLabel = { camp: '🏆 Campeonato', xtreino: '🎮 X-Treino', diario: '📅 Diário' };
        const statusColors = { 'Aberto': 'bg-green-100 text-green-700', 'Em andamento': 'bg-blue-100 text-blue-700', 'Fechado': 'bg-red-100 text-red-700' };

        previewEl.innerHTML = snap.docs.map(d => {
            const ev = d.data();
            const statusCls = statusColors[ev.status] || 'bg-gray-100 text-gray-600';
            // Normaliza category para lowercase antes de buscar no mapa (evita 'CAMP' não encontrado)
            const catStr = catLabel[(ev.category || '').toLowerCase()] || ev.category || '—';
            return `<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs text-gray-500 whitespace-nowrap">${catStr}</span>
                    <span class="font-medium text-sm truncate">${escapeAdminHtml(ev.name || '(sem nome)')}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded-full ${statusCls} whitespace-nowrap">${ev.status || 'Aberto'}</span>
                </div>
                <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${ev.tipo} · ${ev.modo} · ${ev.vagas} vagas</span>
            </div>`;
        }).join('');
    } catch (err) {
        const previewEl2 = document.getElementById('eventsPreview');
        if (previewEl2) previewEl2.innerHTML = '<p class="text-sm text-gray-400 text-center py-3">Não foi possível carregar eventos.</p>';
    }
}

// ===== NOTIFICAR PARTICIPANTES DO EVENTO =====
let _notifyEventDocs = [];
let _notifyScheduleMap = {};
let _notifySelectedSlotKey = 'all';
let _notifySelectedType = 'credentials';
let _notifyOtherDaysVisible = false;
let _finalistUserIds = [];
let _finalistTeams = [];

function selectNotifyType(type) {
    _notifySelectedType = type;
    const colorMap = { credentials: 'purple', tabela: 'green', custom: 'blue', finalists: 'yellow' };
    const hexMap   = { purple: '#a855f7', green: '#22c55e', blue: '#3b82f6', yellow: '#eab308' };
    const bgMap    = { purple: '#faf5ff', green: '#f0fdf4', blue: '#eff6ff', yellow: '#fefce8' };
    document.querySelectorAll('.notify-type-card').forEach(card => {
        const t = card.dataset.type;
        const c = colorMap[t] || 'purple';
        const isSelected = t === type;
        card.style.borderColor     = isSelected ? (hexMap[c] || '#a855f7') : '';
        card.style.backgroundColor = isSelected ? (bgMap[c]  || '#faf5ff') : '';
    });
    const roomSec        = document.getElementById('eventNotifyRoomLinkSection');
    const tabSec         = document.getElementById('eventNotifyTabelaSection');
    const finalistsSec   = document.getElementById('eventNotifyFinalistsSection');
    const msgEl          = document.getElementById('eventNotifyMessage');
    const optLabel       = document.getElementById('notifyMsgOptLabel');
    const stepSchedule   = document.getElementById('notifyStepSchedule');
    const stepContentLbl = document.getElementById('notifyStepContentLabel');
    // Finalistas = credenciais enviadas apenas para os times da final
    if (roomSec)      roomSec.classList.toggle('hidden', type !== 'credentials' && type !== 'finalists');
    if (tabSec)       tabSec.classList.toggle('hidden',  type !== 'tabela');
    if (finalistsSec) finalistsSec.classList.toggle('hidden', type !== 'finalists');
    if (optLabel) optLabel.textContent = (type === 'custom') ? '(obrigatória)' : '(opcional)';
    // Finalistas: oculta etapa de horário (data já está no card) e renumera Conteúdo
    if (stepSchedule)   stepSchedule.classList.toggle('hidden', type === 'finalists');
    if (stepContentLbl) stepContentLbl.textContent = (type === 'finalists') ? '2 · Conteúdo' : '3 · Conteúdo';
    if (type === 'credentials' || type === 'finalists') {
        if (msgEl) msgEl.placeholder = 'Ex: Use as credenciais abaixo para entrar na sala. Boa sorte!';
    } else if (type === 'tabela') {
        if (msgEl) msgEl.placeholder = 'Ex: A tabela do evento já está disponível!';
    } else {
        if (msgEl) msgEl.placeholder = 'Digite sua mensagem para os participantes...';
    }
    if (type === 'finalists') _updateNotifyCount();
}

function selectNotifySlot(key) {
    _notifySelectedSlotKey = key;
    document.querySelectorAll('.notify-slot-btn').forEach(btn => {
        const sel = btn.dataset.key === key;
        btn.style.borderColor       = sel ? '#a855f7' : '#e5e7eb';
        btn.style.backgroundColor   = sel ? '#faf5ff' : '#ffffff';
        btn.style.color             = sel ? '#7e22ce' : '#374151';
        btn.style.fontWeight        = sel ? '700'     : '400';
    });
    _updateNotifyCount();
}

function _updateNotifyCount() {
    const countEl = document.getElementById('eventNotifyCount');
    if (!countEl) return;
    if (_notifySelectedType === 'finalists') {
        countEl.textContent = _finalistUserIds.length > 0
            ? `Vai enviar para ${_finalistUserIds.length} finalista(s)`
            : 'Carregue os finalistas acima';
        return;
    }
    if (_notifySelectedSlotKey === 'all') {
        const total = new Set(_notifyEventDocs.map(d => d.data().userId).filter(Boolean)).size;
        countEl.textContent = `Vai enviar para ${total} participante(s)`;
    } else {
        const entry = _notifyScheduleMap[_notifySelectedSlotKey];
        const n = entry ? entry.users.size : 0;
        countEl.textContent = `Vai enviar para ${n} participante(s)${entry ? ' — ' + entry.sched : ''}`;
    }
}

function toggleNotifyOtherDays() {
    _notifyOtherDaysVisible = !_notifyOtherDaysVisible;
    const sec  = document.getElementById('notifyOtherDaysSection');
    const icon = document.getElementById('notifyToggleIcon');
    const txt  = document.getElementById('notifyToggleText');
    if (sec)  sec.classList.toggle('hidden', !_notifyOtherDaysVisible);
    if (icon) icon.className = _notifyOtherDaysVisible ? 'fas fa-chevron-up fa-xs' : 'fas fa-chevron-down fa-xs';
    if (txt)  txt.textContent = _notifyOtherDaysVisible ? 'Ocultar outros dias' : 'Ver outros dias';
}

function _buildSlotButton(key, entry) {
    const safeKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<button class="notify-slot-btn border-2 rounded-xl px-3 py-2 text-xs transition-all cursor-pointer"
        style="border-color:#e5e7eb;background:#fff;color:#374151"
        data-key="${key.replace(/"/g, '&quot;')}"
        onclick="selectNotifySlot('${safeKey}')">
        <span style="display:block;font-weight:600">${entry.sched}</span>
        <span style="display:block;color:#9ca3af">${entry.users.size} pessoa(s)</span>
    </button>`;
}

window.carregarFinalistas = async function () {
    const data = document.getElementById('notifyFinalistsDate')?.value;
    if (!data) { showToast('warning', 'Informe a data da final.', 'Atenção'); return; }

    const loadingEl = document.getElementById('notifyFinalistsLoading');
    const listEl    = document.getElementById('notifyFinalistsList');
    const namesEl   = document.getElementById('notifyFinalistsNames');
    const emptyEl   = document.getElementById('notifyFinalistsEmpty');

    [listEl, emptyEl].forEach(el => el?.classList.add('hidden'));
    loadingEl?.classList.remove('hidden');
    _finalistUserIds = [];
    _updateNotifyCount();

    try {
        const { doc, getDoc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Carregar resultado da final (22h) do championship_results
        // Formato do docId: semanal-freitas_{data}_{hora} (igual ao usado em championship.js)
        const docId = `semanal-freitas_${data}_22h`;
        const snap = await getDoc(doc(window.firebaseDb, 'championship_results', docId));
        if (!snap.exists() || !snap.data().teams?.length) {
            loadingEl?.classList.add('hidden');
            emptyEl?.classList.remove('hidden');
            return;
        }

        const teams = snap.data().teams || [];
        _finalistTeams = teams; // salvar para uso no slotList da notificação
        // Obter registrationIds de cada time
        const regIds = [...new Set(teams.map(t => t.registrationId).filter(Boolean))];
        const nomes  = teams.map(t => t.nome || '').filter(Boolean);

        const userIdsSet = new Set();

        // Buscar userId por registrationId (inscrição na semifinal)
        for (const rid of regIds) {
            try {
                const rSnap = await getDoc(doc(window.firebaseDb, 'registrations', rid));
                if (rSnap.exists()) {
                    const uid = rSnap.data().userId;
                    if (uid) userIdsSet.add(uid);
                }
            } catch (_) {}
        }

        // Fallback: buscar inscrições pelo nome do time no evento semanal-freitas
        if (nomes.length > 0 && userIdsSet.size < teams.length) {
            try {
                const regsSnap = await getDocs(query(
                    collection(window.firebaseDb, 'registrations'),
                    where('eventType', '==', 'semanal-freitas')
                ));
                regsSnap.docs.forEach(d => {
                    const r = d.data();
                    const tName = r.teamName || r.name || '';
                    if (nomes.some(n => n && tName && n.toLowerCase() === tName.toLowerCase())) {
                        if (r.userId) userIdsSet.add(r.userId);
                    }
                });
            } catch (_) {}
        }

        // Expandir para membros do time se tiver teamId/teamName
        try {
            const teamNames = [...new Set(teams.map(t => t.nome).filter(Boolean))];
            if (teamNames.length > 0) {
                const teamsSnap = await getDocs(collection(window.firebaseDb, 'teams'));
                teamsSnap.docs.forEach(td => {
                    const t = td.data();
                    if (t.nome && teamNames.some(n => n.toLowerCase() === (t.nome || '').toLowerCase())) {
                        (t.membrosUids || []).forEach(uid => userIdsSet.add(uid));
                    }
                });
            }
        } catch (_) {}

        _finalistUserIds = [...userIdsSet];

        // Montar lista visual
        loadingEl?.classList.add('hidden');
        if (teams.length === 0) {
            emptyEl?.classList.remove('hidden');
        } else {
            if (namesEl) {
                namesEl.innerHTML = teams.map((t, i) => {
                    const semi = t.deSemifinal ? ` <span class="text-gray-400">[${t.deSemifinal}]</span>` : '';
                    return `<div class="flex items-center gap-2 text-xs py-1 border-b border-yellow-100">
                        <span class="font-bold text-yellow-700 w-5 text-center">${i + 1}º</span>
                        <span class="font-semibold text-gray-800">${t.nome || '?'}</span>${semi}
                    </div>`;
                }).join('');
            }
            listEl?.classList.remove('hidden');
            if (_finalistUserIds.length === 0) {
                showToast('warning', 'Times encontrados mas sem e-mails vinculados. Verifique as inscrições.', 'Atenção');
            }
        }
        _updateNotifyCount();
    } catch (err) {
        loadingEl?.classList.add('hidden');
        showToast('error', 'Erro ao carregar finalistas: ' + (err.message || err));
    }
};

async function openEventNotifyModal(eventId, eventName) {
    const modal = document.getElementById('eventNotifyModal');
    if (!modal) return;

    _notifyEventDocs = [];
    _notifyScheduleMap = {};
    _notifySelectedSlotKey = 'all';
    _notifyOtherDaysVisible = false;
    _finalistUserIds = [];
    _finalistTeams = [];

    document.getElementById('eventNotifyEventId').value = eventId;
    document.getElementById('eventNotifyEventName').textContent = eventName;
    document.getElementById('eventNotifyTitle').value = '';
    document.getElementById('eventNotifyMessage').value = '';
    ['eventNotifyRoomId','eventNotifyRoomPassword','eventNotifyRoomLink','eventNotifyTabelaLink']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    // Pré-preencher data dos finalistas com hoje (fuso BR)
    const _brHoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
    const _finDateEl = document.getElementById('notifyFinalistsDate');
    if (_finDateEl) _finDateEl.value = _brHoje;
    ['notifyFinalistsList','notifyFinalistsEmpty','notifyFinalistsLoading'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });

    document.getElementById('eventNotifyCount').textContent = '—';
    document.getElementById('notifyLoadingSlots').classList.remove('hidden');
    document.getElementById('notifyTodaySlots').classList.add('hidden');
    document.getElementById('notifyTodaySlots').innerHTML = '';
    document.getElementById('notifyNoTodaySlots').classList.add('hidden');
    document.getElementById('notifyOtherDaysSection').classList.add('hidden');
    document.getElementById('notifyToggleOtherDays').classList.add('hidden');
    document.getElementById('notifyOtherSlots').innerHTML = '';

    selectNotifyType('credentials');

    // Mostrar card "Finalistas" apenas para o Campeonato Semanal — check rápido antes do async
    const _finalistsBtn = document.getElementById('notifyTypeFinalistsBtn');
    if (_finalistsBtn) {
        const _quickSemanal = eventId.toLowerCase().includes('semanal') ||
                              (eventName || '').toLowerCase().includes('semanal');
        _finalistsBtn.style.display = _quickSemanal ? '' : 'none';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
        const { collection, query, where, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Construir conjunto de variantes do eventType para encontrar todas as inscrições
        // CRÍTICO: usar APENAS eventType e docId — nunca ev.name, pois nomes podem
        // corresponder a aliases de outros eventos e puxar registros incorretos.
        const _notifyTypes = new Set([eventId]);
        let _evEventType = null;
        try {
            const _evSnap = await getDoc(doc(window.firebaseDb, 'adminEvents', eventId));
            if (_evSnap.exists()) {
                const _evData = _evSnap.data();
                _evEventType = _evData.eventType || null;
                if (_evEventType) _notifyTypes.add(_evEventType);
            }
        } catch(_) {}

        // Confirmar visibilidade do card "Finalistas" com eventType real resolvido
        if (_finalistsBtn) {
            const _isSemanal = (_evEventType || '').toLowerCase().includes('semanal') ||
                               eventId.toLowerCase().includes('semanal');
            _finalistsBtn.style.display = _isSemanal ? '' : 'none';
            // Se o tipo selecionado é 'finalists' mas o evento não é semanal, voltar p/ credentials
            if (!_isSemanal && _notifySelectedType === 'finalists') selectNotifyType('credentials');
        }
        // Aliases via resolveAliases apenas para o eventType canônico (não para o nome)
        if (_evEventType) {
            try { resolveAliases(_evEventType).forEach(a => { if (a) _notifyTypes.add(a); }); } catch(_) {}
        }

        // Buscar registrações por cada variante e mesclar (deduplicando por doc.id)
        const _docsMap = new Map();
        const validStatuses = new Set(['confirmed', 'paid', 'approved', 'lisagem_gratis']);
        for (const _et of _notifyTypes) {
            try {
                const snap = await getDocs(query(
                    collection(window.firebaseDb, 'registrations'),
                    where('eventType', '==', _et)
                ));
                snap.docs.forEach(d => { if (!_docsMap.has(d.id)) _docsMap.set(d.id, d); });
            } catch(_) {}
        }
        // Mesma lógica do painel Gerenciar: filtra status inválidos E datas passadas (inclui grátis pela lisagem)
        const _brNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const _todayStr = _brNow.toISOString().split('T')[0];
        _notifyEventDocs = [..._docsMap.values()].filter(d => {
            const r = d.data();
            if (!validStatuses.has(r.status)) return false;
            if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date < _todayStr) return false;
            return true;
        });

        // Normaliza horário: "Terça - 22h", "22:00", "22h" → "22h"
        const _normSchedH = s => {
            const m = String(s || '').match(/(\d{1,2})(?:h|:00)?\s*$/i);
            return m ? String(parseInt(m[1], 10)) + 'h' : String(s || '—').trim();
        };

        for (const d of _notifyEventDocs) {
            const r = d.data();
            const schedRaw = r.schedule || r.slotDisplay || '—';
            const sched    = _normSchedH(schedRaw);   // canonical: "22h"
            const date     = r.date || '';
            const key      = date ? `${date}||${sched}` : `||${sched}`;
            if (!_notifyScheduleMap[key]) {
                let dateLabel = '';
                if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    const [, m, dd] = date.split('-');
                    dateLabel = `${dd}/${m}`;
                } else if (date) {
                    dateLabel = date;
                }
                _notifyScheduleMap[key] = {
                    label: dateLabel ? `${dateLabel} — ${sched}` : sched,
                    users: new Set(), date, sched
                };
            }
            // só adiciona ao conjunto de destinatários se tiver userId
            // (o slot aparece de qualquer forma, mesmo sem userId, para admin saber que existe)
            if (r.userId) _notifyScheduleMap[key].users.add(r.userId);
        }

        // Expandir para todos os membros do time (via teamId ou teamName como fallback)
        try {
            const teamIds = [...new Set(_notifyEventDocs.map(d => d.data().teamId).filter(Boolean))];
            const teamNames = [...new Set(_notifyEventDocs.map(d => d.data().teamName).filter(Boolean))];
            if (teamIds.length > 0 || teamNames.length > 0) {
                const teamsSnap = await getDocs(collection(window.firebaseDb, 'teams'));
                // mapa schedKey → membrosUids expandidos
                teamsSnap.docs.forEach(td => {
                    const t = td.data();
                    const matchId   = teamIds.includes(td.id);
                    const matchNome = t.nome && teamNames.includes(t.nome);
                    if (!matchId && !matchNome) return;
                    const membros = t.membrosUids || [];
                    if (!membros.length) return;
                    // Adiciona membros a todos os slots que têm esse time inscrito
                    for (const d of _notifyEventDocs) {
                        const r = d.data();
                        if ((td.id && r.teamId === td.id) || (t.nome && r.teamName === t.nome)) {
                            const sched = _normSchedH(r.schedule || r.slotDisplay || '—');
                            const date  = r.date || '';
                            const key   = date ? `${date}||${sched}` : `||${sched}`;
                            if (_notifyScheduleMap[key]) {
                                membros.forEach(uid => _notifyScheduleMap[key].users.add(uid));
                            }
                        }
                    }
                });
            }
        } catch(_) {}

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const todayDD  = String(today.getDate()).padStart(2,'0');
        const todayMM  = String(today.getMonth()+1).padStart(2,'0');
        document.getElementById('notifyTodayLabel').textContent = `— ${todayDD}/${todayMM}`;

        const allKeys   = Object.keys(_notifyScheduleMap).sort();
        // Chaves sem data (k.startsWith('||')) são slots recorrentes (ex: Modo Liga semanal)
        // — aparecem sempre no "hoje" pois acontecem toda semana
        const todayKeys = allKeys.filter(k => k.startsWith(todayStr + '||') || k.startsWith('||'));
        const otherKeys = allKeys.filter(k => !k.startsWith(todayStr + '||') && !k.startsWith('||'));

        document.getElementById('notifyLoadingSlots').classList.add('hidden');
        document.getElementById('notifyTodaySlots').classList.remove('hidden');

        // Totaliza membros únicos já expandidos (inclui membros do time)
        const totalUnique = new Set([...Object.values(_notifyScheduleMap).flatMap(v => [...v.users])]).size || new Set(_notifyEventDocs.map(d => d.data().userId).filter(Boolean)).size;
        const todaySlotsEl = document.getElementById('notifyTodaySlots');

        if (todayKeys.length === 0) {
            document.getElementById('notifyNoTodaySlots').classList.remove('hidden');
            todaySlotsEl.innerHTML = `<button class="notify-slot-btn border-2 rounded-xl px-3 py-2 text-xs transition-all cursor-pointer"
                style="border-color:#a855f7;background:#faf5ff;color:#7e22ce;font-weight:700"
                data-key="all" onclick="selectNotifySlot('all')">
                <span style="display:block;font-weight:700">Todos</span>
                <span style="display:block;color:#a855f7">${totalUnique} pessoa(s)</span>
            </button>`;
        } else {
            const todayUserSet = new Set();
            todayKeys.forEach(k => _notifyScheduleMap[k].users.forEach(u => todayUserSet.add(u)));
            let html = `<button class="notify-slot-btn border-2 rounded-xl px-3 py-2 text-xs transition-all cursor-pointer"
                style="border-color:#a855f7;background:#faf5ff;color:#7e22ce;font-weight:700"
                data-key="all" onclick="selectNotifySlot('all')">
                <span style="display:block;font-weight:700">Todos de hoje</span>
                <span style="display:block;color:#a855f7">${todayUserSet.size} pessoa(s)</span>
            </button>`;
            todayKeys.forEach(k => { html += _buildSlotButton(k, _notifyScheduleMap[k]); });
            todaySlotsEl.innerHTML = html;
        }

        if (otherKeys.length > 0) {
            document.getElementById('notifyOtherSlots').innerHTML =
                otherKeys.map(k => _buildSlotButton(k, _notifyScheduleMap[k])).join('');
            document.getElementById('notifyToggleOtherDays').classList.remove('hidden');
        }

        selectNotifySlot('all');

    } catch(e) {
        document.getElementById('notifyLoadingSlots').classList.add('hidden');
        document.getElementById('eventNotifyCount').textContent = 'Erro ao carregar participantes';
        document.getElementById('notifyTodaySlots').classList.remove('hidden');
        document.getElementById('notifyTodaySlots').innerHTML =
            '<p class="text-xs text-red-400">Não foi possível carregar os horários.</p>';
    }
}

function closeEventNotifyModal() {
    const modal = document.getElementById('eventNotifyModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    _notifyEventDocs = [];
    _notifyScheduleMap = {};
}

function onEventNotifyScheduleChange() {}
function onEventNotifyTypeChange() {}


async function sendEventNotification() {
    const eventId = document.getElementById('eventNotifyEventId').value;
    const eventName = document.getElementById('eventNotifyEventName').textContent;
    const title = document.getElementById('eventNotifyTitle').value.trim();
    const message = document.getElementById('eventNotifyMessage').value.trim();
    const selectedSchedule = _notifySelectedSlotKey || 'all';
    const notifyType = _notifySelectedType || 'custom';

    if (!title) { showToast('warning', 'Informe o título da notificação.', 'Atenção'); return; }
    if (notifyType !== 'credentials' && notifyType !== 'tabela' && notifyType !== 'finalists' && !message) { showToast('warning', 'Informe a mensagem.', 'Atenção'); return; }

    // Validação de finalistas
    if (notifyType === 'finalists' && _finalistUserIds.length === 0) {
        showToast('warning', 'Carregue os finalistas antes de enviar.', 'Atenção'); return;
    }

    // Validação de credenciais
    let roomId = null, roomPassword = null, roomLink = null;
    if (notifyType === 'credentials' || notifyType === 'finalists') {
        roomId = (document.getElementById('eventNotifyRoomId')?.value || '').trim();
        roomPassword = (document.getElementById('eventNotifyRoomPassword')?.value || '').trim();
        roomLink = (document.getElementById('eventNotifyRoomLink')?.value || '').trim() || null;
        if (!roomId) { showToast('warning', 'Informe o ID da sala.', 'Atenção'); return; }
        if (!roomPassword) { showToast('warning', 'Informe a senha da sala.', 'Atenção'); return; }
    }

    // Validação de tabela
    let tabelaLink = null;
    if (notifyType === 'tabela') {
        tabelaLink = (document.getElementById('eventNotifyTabelaLink')?.value || '').trim() || null;
        if (!tabelaLink) { showToast('warning', 'Informe o link da tabela de pontuação.', 'Atenção'); return; }
    }

    const btn = document.getElementById('eventNotifySendBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...'; }

    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Opção 2: buscar dados frescos antes de enviar (captura inscrições feitas após abrir o modal)
        try {
            const { collection: _frc, query: _frq, where: _frw, getDocs: _frg } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const _freshTypes = [...new Set([
                ..._notifyEventDocs.map(d => d.data().eventType).filter(Boolean),
                eventId
            ].filter(Boolean))];
            const _freshMap = new Map(_notifyEventDocs.map(d => [d.id, d]));
            const _freshValidStatuses = new Set(['paid', 'confirmed', 'approved', 'lisagem_gratis']);
            for (const _ft of _freshTypes) {
                try {
                    const _fs = await _frg(_frq(_frc(window.firebaseDb, 'registrations'), _frw('eventType', '==', _ft)));
                    _fs.forEach(d => { if (_freshValidStatuses.has(d.data().status || '')) _freshMap.set(d.id, d); });
                } catch (_) {}
            }
            const _brNow2 = new Date(Date.now() - 3 * 60 * 60 * 1000);
            const _todayStr2 = _brNow2.toISOString().split('T')[0];
            _notifyEventDocs = [..._freshMap.values()].filter(d => {
                const r = d.data();
                if (!_freshValidStatuses.has(r.status || '')) return false;
                if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date < _todayStr2) return false;
                return true;
            });
        } catch (_fe) {
            console.warn('[Notify] Falha ao buscar dados frescos, usando cache:', _fe.message);
        }

        let docsToNotify = _notifyEventDocs;
        let filterLabel = '';
        if (selectedSchedule !== 'all') {
            const [selDate, ...schedParts] = selectedSchedule.split('||');
            const selSched = schedParts.join('||');
            docsToNotify = _notifyEventDocs.filter(d => {
                const r = d.data();
                const rawSched = r.schedule || r.slotDisplay || '—';
                const mNorm = String(rawSched).match(/(\d{1,2})(?:h|:00)?\s*$/i);
                const normSched = mNorm ? String(parseInt(mNorm[1], 10)) + 'h' : String(rawSched).trim();
                return (r.date || '') === selDate && normSched === selSched;
            });
            if (selDate && /^\d{4}-\d{2}-\d{2}$/.test(selDate)) {
                const [, m, dd] = selDate.split('-');
                filterLabel = `${dd}/${m} — ${selSched}`;
            } else {
                filterLabel = selSched;
            }
        }

        // Finalistas: usar lista já resolvida por carregarFinalistas()
        let uniqueUsers;
        if (notifyType === 'finalists') {
            uniqueUsers = [..._finalistUserIds];
        } else {
            // Coletar usuários das inscrições e expandir para todos os membros do time
            // Usa teamId (inscrições novas) OU teamName como fallback (inscrições antigas)
            const regUsers = [...new Set(docsToNotify.map(d => d.data().userId).filter(Boolean))];
            const allUsersSet = new Set(regUsers);
            const teamIds   = [...new Set(docsToNotify.map(d => d.data().teamId).filter(Boolean))];
            const teamNames = [...new Set(docsToNotify.map(d => d.data().teamName).filter(Boolean))];
            if (teamIds.length > 0 || teamNames.length > 0) {
                try {
                    const { collection: _col2, getDocs: _gd2, query: _q2 } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                    const teamsSnap = await _gd2(_q2(_col2(window.firebaseDb, 'teams')));
                    teamsSnap.docs.forEach(td => {
                        const t = td.data();
                        if (teamIds.includes(td.id) || (t.nome && teamNames.includes(t.nome))) {
                            (t.membrosUids || []).forEach(u => allUsersSet.add(u));
                        }
                    });
                } catch(_) {}
            }
            uniqueUsers = [...allUsersSet];
        }
        if (uniqueUsers.length === 0) {
            showToast('warning', 'Nenhum participante encontrado para o dia/horário selecionado.', 'Atenção');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar'; }
            return;
        }

        const user = window.firebaseAuth?.currentUser;
        const createdBy = user ? (user.displayName || user.email || user.uid) : 'Admin';
        const scheduleLabel = filterLabel ? ` [${filterLabel}]` : '';
        // batchId agrupa todas as notificações deste envio — evita duplicatas na listagem do admin
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Para finalistas: montar slotList com os times classificados
        let slotList = null;
        let slotCapacity = null;
        if (notifyType === 'finalists' && _finalistTeams.length > 0) {
            slotList = _finalistTeams.map((t, i) => ({
                slot: i + 1,
                teamName: t.nome || ''
            }));
            slotCapacity = slotList.length;
        }

        // Ao enviar credenciais para um horário específico, incluir lista de slots na notificação.
        // CRÍTICO: usar docsToNotify (já filtrado ao slot/evento correto) — evita re-query com docId
        // que retornaria vazio porque registrations são salvas com eventType='acesso', não com o docId.
        if (notifyType === 'credentials' && selectedSchedule !== 'all') {
            try {
                const { doc: _sd, getDoc: _sgd } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                // Buscar eventType do doc adminEvents para determinar a capacidade correta
                let _evType = '';
                try {
                    const _evSnap2 = await _sgd(_sd(window.firebaseDb, 'adminEvents', eventId));
                    if (_evSnap2.exists()) _evType = (_evSnap2.data().eventType || '').toLowerCase();
                } catch(_) {}
                const _isLigaType = _evType.includes('liga') || _evType.includes('acesso') || _evType === 'modo-liga';
                const _cap = _isLigaType ? 15 : 12;

                // Montar lista a partir de docsToNotify (já filtrado ao slot correto)
                // ordenado por slotNumber → slot → createdAt
                const _sorted = [...docsToNotify].sort((a, b) => {
                    const ra = a.data(), rb = b.data();
                    const ta = ra.createdAt?.toDate?.()?.getTime() || 0;
                    const tb = rb.createdAt?.toDate?.()?.getTime() || 0;
                    if (ta > 0 && tb > 0) return ta - tb;
                    const sa = ra.slotNumber ?? ra.slot ?? 9999;
                    const sb = rb.slotNumber ?? rb.slot ?? 9999;
                    return sa - sb;
                });
                const _teams = _sorted.map(d => d.data().teamName || d.data().name || '');
                const _slots = [];
                for (let i = 0; i < _cap; i++) {
                    _slots.push({ slot: i + 1, teamName: _teams[i] || '' });
                }
                slotList = _slots;
                slotCapacity = _cap;
            } catch (_) {}
        }

        // Para finalistas, usar título simplificado (sem o nome longo do evento)
        const notifTitle = notifyType === 'finalists'
            ? `Final Semanal - ${title}`
            : `[${eventName}]${scheduleLabel} ${title}`;

        await Promise.all(uniqueUsers.map(uid =>
            addDoc(collection(window.firebaseDb, 'notifications'), {
                title: notifTitle,
                message: message || null,
                type: 'user',
                targetUserId: uid,
                eventId,
                eventName,
                schedule: filterLabel || null,
                notifyType,
                roomId: roomId || null,
                roomPassword: roomPassword || null,
                roomLink: roomLink || null,
                tabelaLink: tabelaLink || null,
                slotList: slotList || null,
                slotCapacity: slotCapacity || null,
                createdAt: serverTimestamp(),
                createdBy,
                createdByUid: user?.uid || null,
                batchId,
                batchTotal: uniqueUsers.length,
            })
        ));

        const horarioMsg = filterLabel ? ` (${filterLabel})` : '';
        showToast('success', `Notificação enviada para ${uniqueUsers.length} participante(s)${horarioMsg}!`, 'Sucesso');
        closeEventNotifyModal();
        // Atualizar lista de notificações enviadas no painel
        if (document.getElementById('adminNotifList')) loadAdminNotifications();
    } catch (err) {
        console.error('Erro ao enviar notificação de evento:', err);
        showToast('error', 'Erro ao enviar: ' + (err.message || err), 'Erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar'; }
    }
}

// ===== SLOTS POR HORÁRIO =====
async function openEventSlotsModal(eventId, eventName) {
    const modal = document.getElementById('eventSlotsModal');
    if (!modal) return;
    document.getElementById('eventSlotsEventName').textContent = eventName;
    document.getElementById('eventSlotsEventId').value = eventId;
    document.getElementById('eventSlotsBody').innerHTML =
        '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2 text-sm">Carregando slots...</p></div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
        const { collection, query, where, getDocs, doc: _fbDoc, getDoc: _fbGetDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        // Buscar o doc adminEvents para obter o campo eventType real e o nome
        // CRÍTICO: booking flow salva r.eventType = canonical ('xtreino-tokens'), não o doc ID
        // Se adminEvents.eventType for null, derivar pelo nome do evento (ex: 'XTreino Freitas' → 'xtreino-tokens')
        // Canonização inline (não depende de canonicalType do escopo interno)
        const _canonInline = t => {
            const s = String(t || '').toLowerCase().replace(/[\s_]+/g, '-');
            if (s.includes('xtreino') || s === 'xtreino-tokens') return 'xtreino-tokens';
            if (s === 'modo-liga' || s.includes('modo') && s.includes('liga')) return 'modo-liga';
            if (s === 'camp-freitas' || s.includes('camp') && s.includes('freitas')) return 'camp-freitas';
            if (s === 'camp-final' || s.includes('camp') && s.includes('final') || s.includes('vaga') && s.includes('final')) return 'camp-final';
            if (s === 'semanal-freitas' || s.includes('semanal')) return 'semanal-freitas';
            return t;
        };

        let _evFieldType = null;
        try {
            const _evDocSnap = await _fbGetDoc(_fbDoc(window.firebaseDb, 'adminEvents', eventId));
            if (_evDocSnap.exists()) {
                const _evData = _evDocSnap.data();
                _evFieldType = _canonInline(_evData?.eventType || _evData?.name || eventId);
            }
        } catch (_) {}

        const _regsRef = collection(window.firebaseDb, 'registrations');
        // CRÍTICO: nunca usar eventName como tipo de query — pode casar com aliases de outros eventos.
        // Usar apenas: eventType canônico derivado do doc, e o docId bruto.
        const _typesToQuery = new Set([_evFieldType, eventId].filter(Boolean));

        // Executar as queries (uma por tipo distinto) e mesclar
        const _allDocs = new Map();
        await Promise.all([..._typesToQuery].map(async t => {
            try {
                const s = await getDocs(query(_regsRef, where('eventType', '==', t)));
                s.docs.forEach(d => _allDocs.set(d.id, d));
            } catch (_) {}
        }));
        const snap = { docs: [..._allDocs.values()] };
        // Apenas inscrições confirmadas/pagas/grátis (sem pendentes)
        const validStatuses = new Set(['confirmed', 'paid', 'approved', 'lisagem_gratis']);
        // Data de hoje em horário de Brasília (UTC-3)
        const _brNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const todayStr = _brNow.toISOString().split('T')[0];

        const docs = snap.docs.filter(d => {
            const r = d.data();
            if (!validStatuses.has(r.status)) return false;
            // Remove registros de datas passadas (mantém: sem data, data inválida, hoje ou futuro)
            if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date < todayStr) return false;
            return true;
        });

        if (docs.length === 0) {
            document.getElementById('eventSlotsBody').innerHTML =
                '<div class="text-center py-8 text-gray-400"><i class="fas fa-users text-3xl mb-2 block"></i><p class="text-sm">Nenhum participante inscrito ainda.</p></div>';
            return;
        }

        // Buscar logos dos times da coleção teams (fallback para inscrições sem teamLogoUrl)
        const _slotsLogoMap = {};
        try {
            const teamsSnap = await getDocs(collection(window.firebaseDb, 'teams'));
            teamsSnap.docs.forEach(td => {
                const t = td.data();
                if (t.nome && t.logoUrl) _slotsLogoMap[t.nome.toLowerCase().trim()] = t.logoUrl;
            });
        } catch(_) {}

        // Normaliza formato de horário para comparação uniforme:
        // "21:00" → "21h", "Domingo 21h" → "21h", "Segunda 14:00" → "14h"
        const normSched = s => {
            if (!s) return '—';
            const str = String(s).trim();
            // Extrai padrão HH:MM (ex: "21:00", "09:30")
            const mColon = str.match(/(\d{1,2}):(\d{2})/);
            if (mColon) return `${parseInt(mColon[1], 10)}h`;
            // Extrai padrão Nh, NNh, N h, NN h (com ou sem espaço antes do h)
            const mH = str.match(/(\d{1,2})\s*h/i);
            if (mH) return `${parseInt(mH[1], 10)}h`;
            // Extrai número puro no final (ex: "Domingo 21")
            const mNum = str.match(/(\d{1,2})\s*$/);
            if (mNum) return `${parseInt(mNum[1], 10)}h`;
            return str;
        };

        // Agrupar por DATA + HORÁRIO (normalizado) — evita misturar inscritos de dias diferentes
        // Isso garante que cada seção mostre exatamente os mesmos participantes que
        // o modal "Gerenciar" mostra ao filtrar por data específica no board de horários.
        const bySchedule = {};
        docs.forEach(d => {
            const r = { ...d.data(), _docId: d.id };
            const sched = normSched(r.schedule);
            const dateKey = r.date || '—';
            const key = `${dateKey}||${sched}`;
            if (!bySchedule[key]) bySchedule[key] = { date: dateKey, sched, regs: [] };
            bySchedule[key].regs.push(r);
        });

        // Ordenar por createdAt (chegada) — slotNumber como fallback
        Object.values(bySchedule).forEach(group => {
            group.regs.sort((a, b) => {
                const ta = a.createdAt?.seconds ?? null;
                const tb = b.createdAt?.seconds ?? null;
                if (ta !== null && tb !== null) return ta - tb;
                const sa = a.slot != null ? Number(a.slot) : (a.slotNumber != null ? Number(a.slotNumber) : null);
                const sb = b.slot != null ? Number(b.slot) : (b.slotNumber != null ? Number(b.slotNumber) : null);
                if (sa !== null && sb !== null) return sa - sb;
                if (sa !== null) return -1;
                if (sb !== null) return 1;
                return 0;
            });
            // Deduplica apenas por ID de documento
            const seenIds = new Set();
            group.regs = group.regs.filter(r => {
                if (r._docId && seenIds.has(r._docId)) return false;
                if (r._docId) seenIds.add(r._docId);
                return true;
            });
        });

        // Ordenar seções: primeiro por data, depois por horário
        const schedKeys = Object.keys(bySchedule).sort((a, b) => {
            const ga = bySchedule[a], gb = bySchedule[b];
            if (ga.date !== gb.date) return ga.date.localeCompare(gb.date);
            return ga.sched.localeCompare(gb.sched);
        });

        const statusLabel = { confirmed: 'Confirmado', paid: 'Pago', approved: 'Aprovado', pending: 'Ag. Pagamento' };
        const statusCls = {
            confirmed: 'bg-green-100 text-green-700',
            paid: 'bg-blue-100 text-blue-700',
            approved: 'bg-emerald-100 text-emerald-700',
            pending: 'bg-orange-100 text-orange-700'
        };

        // Detectar se é Modo Liga para exibir botão SPEC
        const _isLigaEv = eventId === 'modo-liga' || (_evFieldType || '').includes('liga') || (_evFieldType || '').includes('modo');

        let html = '';
        for (const key of schedKeys) {
            const { date: groupDate, sched, regs } = bySchedule[key];
            const dateFmtHeader = groupDate && /^\d{4}-\d{2}-\d{2}$/.test(groupDate)
                ? groupDate.split('-').reverse().slice(0,2).join('/') : groupDate;
            const _specBtn = _isLigaEv
                ? `<button onclick="baixarPacoteSPECPorGrupo('${escapeAdminHtml(_evFieldType||'')}','${escapeAdminHtml(eventId)}','${escapeAdminHtml(groupDate)}','${escapeAdminHtml(sched)}')"
                          class="ml-auto px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
                          title="Baixar Pacote SPEC para este horário">
                     <i class="fas fa-download"></i> SPEC
                   </button>`
                : '';
            html += `
            <div class="mb-6">
                <div class="flex items-center gap-2 mb-3 flex-wrap">
                    <span class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold"><i class="fas fa-clock mr-1"></i>${escapeAdminHtml(sched)}</span>
                    <span class="text-xs font-semibold text-gray-600">${escapeAdminHtml(dateFmtHeader)}</span>
                    <span class="text-xs text-gray-400">${regs.length} inscrito(s)</span>
                    ${_specBtn}
                </div>
                <div class="overflow-x-auto rounded-lg border border-gray-200">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-xs text-gray-500 uppercase">
                            <th class="px-3 py-2 text-left w-20">Slot</th>
                            <th class="px-3 py-2 text-center w-14">Logo</th>
                            <th class="px-3 py-2 text-left">Equipe / Nome</th>
                            <th class="px-3 py-2 text-left w-28">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${regs.map((r, idx) => {
                            // Exibir posição dentro do grupo data+horário,
                            // igual ao que o cliente vê — independente do slotNumber armazenado
                            const _rEvType = (r.eventType || '').toLowerCase();
                            const _isLigaSlot = eventId === 'modo-liga' || _rEvType === 'modo-liga' || _rEvType === 'acesso' || _rEvType.includes('acesso');
                            const slotLabel = _isLigaSlot
                                ? `Vaga ${String.fromCharCode(64 + idx + 1)}`
                                : `Vaga #${idx + 1}`;
                            const st = r.status || 'pending';
                            const leaderName = r.leaderName && r.leaderName !== r.teamName ? r.leaderName : null;
                            const nomeArq = (r.teamName || 'time').replace(/[^a-zA-Z0-9]/g,'_');
                            const _slotLogoUrl = r.teamLogoUrl || r.teamLogoThumb || _slotsLogoMap[(r.teamName||'').toLowerCase().trim()] || null;
                            const logoCell = _slotLogoUrl
                                ? `<div class="flex flex-col items-center gap-1">
                                    <img src="${_slotLogoUrl}" class="w-9 h-9 rounded-lg object-contain" style="background:transparent" title="${escapeAdminHtml(r.teamName||'')}">
                                    <a href="${_slotLogoUrl}" download="logo_${nomeArq}.png" class="text-xs text-blue-600 hover:text-blue-800 font-medium" title="Baixar logo"><i class="fas fa-download"></i></a>
                                   </div>`
                                : `<div class="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-300 mx-auto" title="Sem logo cadastrada"><i class="fas fa-image text-lg"></i></div>`;
                            const isFreeEntry = r.freeSlot === true || r.listingType === 'free';
                            const isPendingEntry = st === 'pending';
                            const statusDisplay = isFreeEntry
                                ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">🎁 Grátis</span>`
                                : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${statusCls[st] || 'bg-gray-100 text-gray-500'}">${statusLabel[st] || st}</span>`;
                            const rowBg = isFreeEntry ? 'bg-orange-50/40' : isPendingEntry ? 'bg-yellow-50' : '';
                            return `<tr class="border-t border-gray-100 hover:bg-orange-50 transition-colors ${rowBg}">
                                <td class="px-3 py-2 font-bold ${isPendingEntry ? 'text-yellow-600' : 'text-orange-600'} text-base">${escapeAdminHtml(slotLabel)}</td>
                                <td class="px-3 py-2 text-center">${logoCell}</td>
                                <td class="px-3 py-2">
                                    <p class="font-medium text-gray-800">${escapeAdminHtml(r.teamName || r.email || '—')}</p>
                                    ${leaderName ? `<p class="text-xs text-gray-400">Líder: ${escapeAdminHtml(leaderName)}</p>` : ''}
                                </td>
                                <td class="px-3 py-2">${statusDisplay}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                </div>
            </div>`;
        }

        document.getElementById('eventSlotsBody').innerHTML = html;
    } catch(e) {
        document.getElementById('eventSlotsBody').innerHTML =
            '<div class="text-center py-8 text-red-400"><i class="fas fa-exclamation-circle text-2xl mb-2 block"></i><p class="text-sm">Erro ao carregar slots.</p></div>';
    }
}

function closeEventSlotsModal() {
    const modal = document.getElementById('eventSlotsModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function repairEventSlots() {
    const eventId = document.getElementById('eventSlotsEventId').value;
    const eventName = document.getElementById('eventSlotsEventName').textContent;
    if (!eventId) return;

    const btn = document.getElementById('repairSlotsBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Corrigindo...'; }

    try {
        const { collection, query, where, getDocs, writeBatch, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(query(
            collection(window.firebaseDb, 'registrations'),
            where('eventType', '==', eventId)
        ));
        const validStatuses = new Set(['confirmed', 'paid', 'approved', 'lisagem_gratis']);
        // Data de hoje em horário de Brasília (UTC-3)
        const _brNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const todayStr = _brNow.toISOString().split('T')[0];

        const docs = snap.docs.filter(d => {
            const r = d.data();
            if (!validStatuses.has(r.status)) return false;
            // Ignora registros de datas passadas ao reparar slots
            if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date < todayStr) return false;
            return true;
        });

        if (docs.length === 0) {
            alert('Nenhum participante encontrado para corrigir.');
            return;
        }

        // Normaliza schedule (mesma lógica do modal de exibição)
        const _normSched = s => {
            if (!s) return '—';
            const str = String(s).trim();
            const mColon = str.match(/(\d{1,2}):(\d{2})/);
            if (mColon) return `${parseInt(mColon[1], 10)}h`;
            const mH = str.match(/(\d{1,2})\s*h/i);
            if (mH) return `${parseInt(mH[1], 10)}h`;
            const mNum = str.match(/(\d{1,2})\s*$/);
            if (mNum) return `${parseInt(mNum[1], 10)}h`;
            return str;
        };

        // Agrupar por horário NORMALIZADO (evita grupos separados p/ "21h" e "Domingo 21h")
        const bySchedule = {};
        docs.forEach(d => {
            const r = d.data();
            const sched = _normSched(r.schedule);
            if (!bySchedule[sched]) bySchedule[sched] = [];
            bySchedule[sched].push({ id: d.id, data: r });
        });

        // Dentro de cada horário, ordenar por createdAt (chegada) — slotNumber como fallback
        Object.values(bySchedule).forEach(arr => {
            arr.sort((a, b) => {
                const ta = a.data.createdAt?.seconds ?? null;
                const tb = b.data.createdAt?.seconds ?? null;
                if (ta !== null && tb !== null) return ta - tb;
                const sa = a.data.slot != null ? Number(a.data.slot) : (a.data.slotNumber != null ? Number(a.data.slotNumber) : null);
                const sb = b.data.slot != null ? Number(b.data.slot) : (b.data.slotNumber != null ? Number(b.data.slotNumber) : null);
                if (sa !== null && sb !== null) return sa - sb;
                if (sa !== null) return -1;
                if (sb !== null) return 1;
                return 0;
            });
        });

        // Preencher apenas slots SEM número atribuído — slots ocupados NUNCA são alterados
        const batch = writeBatch(window.firebaseDb);
        let updateCount = 0;

        for (const regs of Object.values(bySchedule)) {
            // Encontrar max slot já atribuído (imutável)
            let maxSlot = 0;
            const semSlot = [];
            regs.forEach(entry => {
                const s = entry.data.slot != null ? Number(entry.data.slot)
                        : (entry.data.slotNumber != null ? Number(entry.data.slotNumber) : null);
                if (s !== null && !isNaN(s) && s > 0) {
                    if (s > maxSlot) maxSlot = s;
                } else {
                    semSlot.push(entry);
                }
            });
            // Ordenar sem-slot por data de compra (cronológico)
            semSlot.sort((a, b) => (a.data.createdAt?.seconds ?? 0) - (b.data.createdAt?.seconds ?? 0));
            // Atribuir apenas as vagas sem número, continuando do último slot ocupado
            semSlot.forEach(entry => {
                maxSlot++;
                const newSlot = maxSlot;
                const newSlotDisplay = eventId === 'modo-liga'
                    ? `Vaga ${String.fromCharCode(64 + newSlot)}`
                    : `Vaga #${newSlot}`;
                batch.update(doc(window.firebaseDb, 'registrations', entry.id), {
                    slot: newSlot,
                    slotNumber: newSlot,
                    slotDisplay: newSlotDisplay
                });
                updateCount++;
            });
        }

        if (updateCount === 0) {
            alert('Nenhum slot duplicado encontrado — tudo certo!');
            return;
        }

        await batch.commit();

        // Sincronizar slotCounters com a contagem real após o reparo
        try {
            const { doc: _doc, setDoc: _setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const counterData = {};
            for (const [sched, regs] of Object.entries(bySchedule)) {
                counterData[sched] = regs.length; // total de slots usados neste horário
            }
            await _setDoc(_doc(window.firebaseDb, 'slotCounters', eventId), counterData);
        } catch(_se) { console.warn('slotCounters sync falhou após reparo:', _se.message); }

        alert(`✅ ${updateCount} registro(s) corrigido(s) com sucesso!`);
        // Recarregar o modal para exibir os slots atualizados
        await openEventSlotsModal(eventId, eventName);

    } catch(e) {
        console.error('Erro ao corrigir slots:', e);
        alert('Erro ao corrigir slots: ' + (e.message || 'tente novamente.'));
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wrench mr-1"></i>Corrigir Slots Duplicados'; }
    }
}

window.openEventSlotsModal = openEventSlotsModal;
window.closeEventSlotsModal = closeEventSlotsModal;
window.repairEventSlots = repairEventSlots;

window.openEventNotifyModal = openEventNotifyModal;
window.closeEventNotifyModal = closeEventNotifyModal;
window.onEventNotifyTypeChange = onEventNotifyTypeChange;
window.onEventNotifyScheduleChange = onEventNotifyScheduleChange;
window.sendEventNotification = sendEventNotification;
window.selectNotifyType = selectNotifyType;
window.selectNotifySlot = selectNotifySlot;
window.toggleNotifyOtherDays = toggleNotifyOtherDays;

window.loadEventsPreview = loadEventsPreview;
window.openEventsModal = openEventsModal;
window.closeEventsModal = closeEventsModal;
window.switchEventTab = switchEventTab;
window.onEvtModoChange = onEvtModoChange;
window.openNewEventForm = openNewEventForm;
window.cancelEventForm = cancelEventForm;
window.saveEventForm = saveEventForm;
window.editEventItem = editEventItem;
window.deleteEventItem = deleteEventItem;
window.onEvtImageSelected = onEvtImageSelected;
window.onEvtImageUrlInput = onEvtImageUrlInput;
window.clearEvtImage = clearEvtImage;
window.onEvtEntradaChange = onEvtEntradaChange;
// ========== ADMIN PAGE LAZY LOADING ==========
// Tracks which pages have had their data loaded so each page only fetches
// Firebase data the first time it becomes visible.
window._adminPages = { initialized: new Set() };

window.loadPageData = async function(page) {
    if (!window.firebaseDb) return;
    if (window._adminPages.initialized.has(page)) return;
    window._adminPages.initialized.add(page);

    const role = (window.adminRoleLower || '').toLowerCase();

    if (page === 'principal') {
        // loadKPIs() e loadCharts() legados REMOVIDOS — o handler do onAuthStateChanged
        // em initAdmin já carrega tudo via loadReports() (modern). Chamá-los aqui causava
        // o efeito "aparece e some": os dados corretos eram sobrescritos pelos legados.
        try { await loadKpis(); } catch(e) { console.warn('[page:principal] KPIs', e); }
        try { await loadTables(true); } catch(e) { console.warn('[page:principal] Tables', e); }
        try { await loadPendingOrders(); } catch(e) { console.warn('[page:principal] PendingOrders', e); }
        try { await loadEventOptions(); } catch(e) {}
        try { renderPopularHours(); } catch(e) {}
        try { setupPopularHoursFilters(); } catch(e) {}

    } else if (page === 'usuarios') {
        try { await loadUsersAndRoles({ role: role || 'ceo' }); } catch(e) { console.warn('[page:usuarios] UsersAndRoles', e); }
        try { await loadUsers(); } catch(e) { console.warn('[page:usuarios] loadUsers', e); }
        try { setupRoleGuards(); } catch(e) {}
        try { recomputeTokenTotals(); } catch(e) {}

    } else if (page === 'financeiro') {
        try { loadPasseBooyahControls(); } catch(e) {}
        try { setupCouponUsageFilters(); } catch(e) {}

    } else if (page === 'conteudo') {
        try { await loadHighlights(); } catch(e) { console.warn('[page:conteudo] Highlights', e); }
        try { await loadNews(); } catch(e) { console.warn('[page:conteudo] News', e); }
        try { loadProducts(); } catch(e) {}
        try { loadEventsPreview(); } catch(e) {}
        try { loadShirtOrders(); } catch(e) {}
        try { loadBonusSlots(); } catch(e) { console.warn('[page:conteudo] BonusSlots', e); }

    } else if (page === 'operacoes') {
        try { loadWhatsAppLinks(); } catch(e) {}
        try { loadAdminNotifications(); } catch(e) {}
    }
};

// ===== LIMPEZA: remover inscrições sem horário válido =====
window.limparInscricoesSemHorario = async function() {
    if (!window.firebaseDb) { alert('Firebase não conectado.'); return; }
    const { collection, query, where, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

    const hasDigit = (s) => /\d/.test(String(s ?? ''));

    // Usar a data do board se disponível, senão usar hoje (BR)
    const boardDateEl = document.getElementById('boardDate');
    const dateRef = boardDateEl?.value || new Date(Date.now() - 3*60*60*1000).toISOString().split('T')[0];

    // Buscar TODAS as inscrições da data selecionada e filtrar em JS
    const snap = await getDocs(
        query(collection(window.firebaseDb, 'registrations'), where('date', '==', dateRef))
    );

    const invalidos = [];
    snap.docs.forEach(d => {
        const f = d.data();
        if (!hasDigit(f.schedule)) {
            invalidos.push({ id: d.id, data: f });
        }
    });

    if (invalidos.length === 0) {
        alert(`Nenhuma inscrição sem horário válido encontrada para ${dateRef}.`);
        return;
    }

    const lista = invalidos.map(({ id, data: f }) =>
        `• ${f.teamName || f.email || id} | schedule: "${f.schedule ?? 'null'}" | status: ${f.status || '?'}`
    ).join('\n');

    const confirmar = confirm(`Encontradas ${invalidos.length} inscrição(ões) sem horário válido em ${dateRef}:\n\n${lista}\n\nDeseja deletar TODAS?`);
    if (!confirmar) return;

    let deletadas = 0;
    for (const { id } of invalidos) {
        try {
            await deleteDoc(doc(window.firebaseDb, 'registrations', id));
            deletadas++;
        } catch (e) {
            console.error('Erro ao deletar', id, e);
        }
    }
    alert(`✅ ${deletadas} inscrição(ões) removida(s) com sucesso.`);
    try { await loadBoard(); } catch(_) {}
};

// ===== UTILITÁRIO: APROVAR PEDIDO PRESO EM PENDING =====
// Uso no console do admin: markOrderPaid('email@cliente.com')
// Ou por ID do pedido: markOrderPaid(null, 'ORDER_ID')
window.markOrderPaid = async function(targetEmail, orderId = null) {
    if (!targetEmail && !orderId) { alert('Informe o e-mail do cliente ou o ID do pedido.'); return; }
    if (!window.firebaseDb) { alert('Firebase não conectado.'); return; }
    try {
        const { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;

        let ordersToApprove = [];

        if (orderId) {
            // Buscar pelo ID direto
            const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const snap = await getDoc(doc(db, 'orders', orderId));
            if (snap.exists()) ordersToApprove.push({ id: snap.id, ...snap.data() });
        } else {
            // Buscar pedidos pending pelo e-mail do cliente
            const email = targetEmail.toLowerCase().trim();
            const q = query(collection(db, 'orders'),
                where('status', '==', 'pending'),
                where('buyerEmail', '==', email));
            const snap = await getDocs(q);
            if (snap.empty) {
                // Tenta pelo campo 'customer'
                const q2 = query(collection(db, 'orders'),
                    where('status', '==', 'pending'),
                    where('customer', '==', email));
                const snap2 = await getDocs(q2);
                snap2.forEach(d => ordersToApprove.push({ id: d.id, ...d.data() }));
            } else {
                snap.forEach(d => ordersToApprove.push({ id: d.id, ...d.data() }));
            }
        }

        if (ordersToApprove.length === 0) {
            alert('Nenhum pedido pendente encontrado para este cliente.');
            return;
        }

        const lista = ordersToApprove.map(o => `• ${o.id} | ${o.title || o.item || 'Produto'} | R$ ${o.amount || o.total || '?'}`).join('\n');
        const ok = confirm(`Aprovar ${ordersToApprove.length} pedido(s) como PAGO?\n\n${lista}`);
        if (!ok) return;

        let count = 0;
        for (const order of ordersToApprove) {
            await updateDoc(doc(db, 'orders', order.id), {
                status: 'paid',
                paidAt: serverTimestamp()
            });
            count++;
        }

        alert(`✅ ${count} pedido(s) marcado(s) como pago(s). O cliente já pode acessar em Minha Conta → Meus Produtos.`);
        console.log(`[markOrderPaid] ${count} pedido(s) aprovado(s).`, ordersToApprove.map(o => o.id));
    } catch (err) {
        console.error('[markOrderPaid] Erro:', err);
        alert('Erro: ' + (err.message || err));
    }
};

// ===== UTILITÁRIO: ZERAR HISTÓRICO DE VENDAS DE AFILIADO =====
window.zeroCouponUsageForEmail = async function(targetEmail) {
    if (!targetEmail) { alert('Informe o e-mail do afiliado.'); return; }
    if (!window.firebaseDb) { alert('Firebase não conectado.'); return; }
    const email = targetEmail.toLowerCase().trim();
    try {
        const { collection, query, where, getDocs, deleteDoc, doc } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;

        // 1. Achar o cupom do afiliado pelo e-mail
        let couponCode = null;
        const affSnap = await getDocs(collection(db, 'affiliates'));
        affSnap.forEach(d => {
            const data = d.data();
            if ((data.email || '').toLowerCase() === email) {
                couponCode = data.couponCode || data.code || null;
            }
        });
        if (!couponCode) {
            // Tenta na coleção coupons
            const coupSnap = await getDocs(collection(db, 'coupons'));
            coupSnap.forEach(d => {
                const data = d.data();
                if ((data.affiliateEmail || data.email || '').toLowerCase() === email) {
                    couponCode = d.id;
                }
            });
        }
        if (!couponCode) { alert(`Afiliado não encontrado para: ${email}`); return; }

        const ok = confirm(`Zerar TODOS os registros de vendas do cupom "${couponCode}" (${email})?\nEsta ação não pode ser desfeita.`);
        if (!ok) return;

        // 2. Deletar couponUsage pelo couponCode
        const q = query(collection(db, 'couponUsage'), where('couponCode', '==', couponCode));
        const snap = await getDocs(q);
        let count = 0;
        for (const d of snap.docs) {
            await deleteDoc(doc(db, 'couponUsage', d.id));
            count++;
        }
        // Tenta também pela versão em maiúsculas (alguns sistemas salvam assim)
        if (count === 0) {
            const q2 = query(collection(db, 'couponUsage'), where('couponCode', '==', couponCode.toUpperCase()));
            const snap2 = await getDocs(q2);
            for (const d of snap2.docs) {
                await deleteDoc(doc(db, 'couponUsage', d.id));
                count++;
            }
        }

        alert(`✅ ${count} registro(s) de vendas removido(s) para ${email} (cupom: ${couponCode}).`);
        console.log(`[zeroCouponUsageForEmail] ${count} docs deletados para ${email} / ${couponCode}`);
    } catch (err) {
        console.error('[zeroCouponUsageForEmail] Erro:', err);
        alert('Erro: ' + (err.message || err));
    }
};

// Utilitário: corrigir slot de um time específico
// Uso no console: await fixTeamSlot('X GOD', 'xtreino-tokens', '2026-05-26', 9)
window.fixTeamSlot = async function(teamName, eventType, date, newSlot) {
    if (!window.firebaseDb) { alert('Firebase não conectado.'); return; }
    try {
        const { collection, query, where, getDocs, doc, updateDoc } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        const q = query(
            collection(db, 'registrations'),
            where('teamName', '==', teamName),
            where('eventType', '==', eventType),
            where('date', '==', date)
        );
        const snap = await getDocs(q);
        if (snap.empty) { alert(`Nenhum registro encontrado para "${teamName}" em ${date}.`); return; }
        const newSlotDisplay = eventType === 'modo-liga'
            ? `Vaga ${String.fromCharCode(64 + newSlot)}`
            : `Vaga #${newSlot}`;
        let count = 0;
        for (const d of snap.docs) {
            await updateDoc(doc(db, 'registrations', d.id), {
                slot: newSlot,
                slotNumber: newSlot,
                slotDisplay: newSlotDisplay
            });
            count++;
            console.log(`[fixTeamSlot] Atualizado: ${d.id} → slot ${newSlot}`);
        }
        alert(`✅ ${count} registro(s) do time "${teamName}" atualizados para ${newSlotDisplay}.`);
    } catch (err) {
        console.error('[fixTeamSlot] Erro:', err);
        alert('Erro: ' + (err.message || err));
    }
};

// Utilitário: renumerar slots de um evento para uma data específica (ou hoje)
// Uso: await repairDateSlots('xtreino-tokens', '2026-05-26')
// Ou para hoje: await repairDateSlots('xtreino-tokens')
window.repairDateSlots = async function(eventType, targetDate) {
    if (!window.firebaseDb) { alert('Firebase não conectado.'); return; }
    try {
        const { collection, query, where, getDocs, writeBatch, doc, setDoc } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;

        // Usar data de hoje em Brasília se não informada
        if (!targetDate) {
            const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
            targetDate = now.toISOString().slice(0, 10);
        }

        const snap = await getDocs(query(
            collection(db, 'registrations'),
            where('eventType', '==', eventType),
            where('date', '==', targetDate)
        ));

        const validStatuses = new Set(['confirmed', 'paid', 'approved']);
        const docs = snap.docs.filter(d => validStatuses.has(d.data().status));

        if (docs.length === 0) {
            alert(`Nenhum registro encontrado para ${eventType} em ${targetDate}.`);
            return;
        }

        // Agrupar por horário
        const bySchedule = {};
        docs.forEach(d => {
            const r = d.data();
            const sched = r.schedule || '—';
            if (!bySchedule[sched]) bySchedule[sched] = [];
            bySchedule[sched].push({ id: d.id, data: r });
        });

        // Ordenar por slot crescente → createdAt como fallback (mesma lógica do repairEventSlots)
        Object.values(bySchedule).forEach(arr => {
            arr.sort((a, b) => {
                const sa = a.data.slot != null ? Number(a.data.slot) : (a.data.slotNumber != null ? Number(a.data.slotNumber) : null);
                const sb = b.data.slot != null ? Number(b.data.slot) : (b.data.slotNumber != null ? Number(b.data.slotNumber) : null);
                if (sa !== null && sb !== null) return sa - sb;
                if (sa !== null) return -1;
                if (sb !== null) return 1;
                return (a.data.createdAt?.seconds ?? 0) - (b.data.createdAt?.seconds ?? 0);
            });
        });

        // Deduplicar por nome de time dentro de cada horário (manter o mais antigo)
        Object.keys(bySchedule).forEach(sched => {
            const seenTeams = new Set();
            bySchedule[sched] = bySchedule[sched].filter(entry => {
                const key = (entry.data.teamName || '').toLowerCase().trim();
                if (seenTeams.has(key)) return false;
                seenTeams.add(key);
                return true;
            });
        });

        // Preencher apenas slots SEM número atribuído — slots ocupados NUNCA são alterados
        const batch = writeBatch(db);
        let updateCount = 0;
        const counterData = {};

        for (const [sched, regs] of Object.entries(bySchedule)) {
            let maxSlot = 0;
            const semSlot = [];
            regs.forEach(entry => {
                const s = entry.data.slot != null ? Number(entry.data.slot)
                        : (entry.data.slotNumber != null ? Number(entry.data.slotNumber) : null);
                if (s !== null && !isNaN(s) && s > 0) {
                    if (s > maxSlot) maxSlot = s;
                } else {
                    semSlot.push(entry);
                }
            });
            semSlot.sort((a, b) => (a.data.createdAt?.seconds ?? 0) - (b.data.createdAt?.seconds ?? 0));
            semSlot.forEach(entry => {
                maxSlot++;
                const newSlot = maxSlot;
                const newSlotDisplay = eventType === 'modo-liga'
                    ? `Vaga ${String.fromCharCode(64 + newSlot)}`
                    : `Vaga #${newSlot}`;
                batch.update(doc(db, 'registrations', entry.id), {
                    slot: newSlot,
                    slotNumber: newSlot,
                    slotDisplay: newSlotDisplay
                });
                updateCount++;
            });
            counterData[sched] = regs.length;
        }

        await batch.commit();

        // Sincronizar slotCounters
        try {
            await setDoc(doc(db, 'slotCounters', eventType), counterData, { merge: true });
        } catch(_) {}

        const resumo = Object.entries(bySchedule)
            .map(([s, r]) => `  ${s}: ${r.length} time(s)`)
            .join('\n');
        alert(`✅ ${updateCount} registro(s) corrigidos em ${targetDate}:\n${resumo}`);
        console.log(`[repairDateSlots] ${eventType} | ${targetDate} | ${updateCount} updates\n${resumo}`);
    } catch(err) {
        console.error('[repairDateSlots] Erro:', err);
        alert('Erro: ' + (err.message || err));
    }
};

// ===== VAGAS BÔNUS =====

const _BONUS_EVENT_LABELS = {
    'xtreino-tokens': 'XTreino Freitas',
    'modo-liga': 'Modo Liga',
    'semanal-freitas': 'Semanal Freitas',
    'semanal': 'Semanal Freitas',
    'camp-freitas': 'Campeonato Freitas'
};

function _gerarCodigoBonus() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Popula o select de eventos do form bônus a partir do adminEvents no Firestore
async function _popularSelectEventoBonus() {
    const sel = document.getElementById('bonusFormEventType');
    if (!sel || !window.firebaseDb) return;
    try {
        const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(query(collection(window.firebaseDb, 'adminEvents'), orderBy('name')));
        sel.innerHTML = '';
        if (snap.empty) {
            // Fallback para eventos fixos caso adminEvents esteja vazio
            [['xtreino-tokens','XTreino Freitas'],['modo-liga','XTreino Modo Liga'],['semanal-freitas','Semanal Freitas'],['camp-freitas','Campeonato Freitas']]
                .forEach(([v,t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
            return;
        }
        snap.forEach(d => {
            const ev = d.data();
            const value = ev.eventType || d.id;
            const label = ev.name || ev.eventType || d.id;
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.warn('[BonusSlots] Erro ao carregar eventos:', err);
    }
}

window.loadBonusSlots = async function() {
    if (!window.firebaseDb) return;
    const tbody = document.getElementById('bonusSlotsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-gray-400">Carregando...</td></tr>';

    try {
        const { collection, query, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(query(
            collection(window.firebaseDb, 'bonus_links'),
            orderBy('createdAt', 'desc')
        ));

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-gray-500">Nenhum link bônus criado ainda.</td></tr>';
            return;
        }

        tbody.innerHTML = snap.docs.map(docSnap => {
            const d = { id: docSnap.id, ...docSnap.data() };
            const statusClass = d.status === 'ativo'
                ? 'bg-green-100 text-green-700'
                : d.status === 'pausado' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700';
            const vagasStr = `${d.usedCount || 0}/${d.quantity || 0}`;
            const expiry = d.expiresAt
                ? new Date(d.expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';
            const [ano, mes, dia] = (d.date || '').split('-');
            const dataFmt = d.date ? `${dia}/${mes}/${ano}` : '—';
            const eventLabel = _BONUS_EVENT_LABELS[d.eventType] || d.eventType;
            const toggleTitle = d.status === 'ativo' ? 'Pausar' : 'Reativar';
            const toggleIcon = d.status === 'ativo' ? 'pause' : 'play';
            const toggleClass = d.status === 'ativo' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700';

            return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-3 py-2 font-mono font-bold text-orange-600 text-sm">${d.code}</td>
                <td class="px-3 py-2 text-xs">${eventLabel}</td>
                <td class="px-3 py-2 text-xs">${dataFmt}</td>
                <td class="px-3 py-2 text-xs font-medium">${d.schedule || '—'}</td>
                <td class="px-3 py-2 text-xs font-medium">${vagasStr}</td>
                <td class="px-3 py-2 text-xs">${expiry}</td>
                <td class="px-3 py-2">
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass}">${d.status}</span>
                </td>
                <td class="px-3 py-2">
                    <div class="flex gap-1 flex-wrap">
                        <button onclick="copyBonusLink('${d.code}')"
                            class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" title="Copiar link">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="toggleBonusStatus('${d.id}','${d.status}')"
                            class="px-2 py-1 text-xs ${toggleClass} text-white rounded" title="${toggleTitle}">
                            <i class="fas fa-${toggleIcon}"></i>
                        </button>
                        <button onclick="deleteBonusLink('${d.id}')"
                            class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error('[BonusSlots] Erro:', err);
        tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-center text-red-500 text-xs">Erro: ${err.message}</td></tr>`;
    }
};

window.createBonusLink = async function() {
    if (!window.firebaseDb) { alert('Firebase não conectado.'); return; }

    const eventType = document.getElementById('bonusFormEventType')?.value;
    const schedule = document.getElementById('bonusFormSchedule')?.value;
    const date = document.getElementById('bonusFormDate')?.value;
    const quantity = parseInt(document.getElementById('bonusFormQuantity')?.value || '0', 10);
    const limitPerTeam = parseInt(document.getElementById('bonusFormLimitPerTeam')?.value || '1', 10);
    const expiresAtRaw = document.getElementById('bonusFormExpiresAt')?.value;

    if (!eventType || !schedule || !date || !quantity || quantity < 1) {
        alert('Preencha todos os campos obrigatórios: evento, horário, data e vagas disponíveis (mínimo 1).');
        return;
    }

    const code = _gerarCodigoBonus();
    // Pega o nome do evento do texto visível da opção selecionada (vem do adminEvents)
    const selEl = document.getElementById('bonusFormEventType');
    const eventName = selEl?.selectedOptions?.[0]?.textContent?.trim() || _BONUS_EVENT_LABELS[eventType] || eventType;

    try {
        const { collection, addDoc, serverTimestamp, getDocs, query: _bq, where: _bw } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Captura o offset de vagas regulares no momento da criação do link.
        // Usado para fixar totalCap = initialOffset + quantity (não cresce com novas vendas).
        let initialOffset = 0;
        try {
            const _snap = await getDocs(_bq(
                collection(window.firebaseDb, 'registrations'),
                _bw('eventType', '==', eventType),
                _bw('date', '==', date)
            ));
            const _linkH = String(schedule || '').match(/(\d+)/)?.[1] || '';
            const _validStInit = new Set(['paid', 'confirmed', 'approved']);
            _snap.forEach(d => {
                const r = d.data();
                if (!_validStInit.has(r.status)) return; // ignorar pending no offset inicial
                const _regH = String(r.schedule || r.hour || '').match(/(\d+)/)?.[1] || '';
                if (!_linkH || _regH === _linkH) initialOffset++;
            });
        } catch (_) {}

        await addDoc(collection(window.firebaseDb, 'bonus_links'), {
            code,
            eventType,
            eventName,
            schedule,
            date,
            quantity,
            usedCount: 0,
            initialOffset,
            limitPerTeam: Math.max(1, limitPerTeam || 1),
            expiresAt: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
            status: 'ativo',
            createdAt: serverTimestamp()
        });

        document.getElementById('bonusCreateForm').classList.add('hidden');

        const linkUrl = `${window.location.origin}/bonus.html?code=${code}`;
        const msg = `✅ Link bônus criado!\n\nCódigo: ${code}\nEvento: ${eventName}\nData: ${date} | ${schedule}\nVagas: ${quantity}\n\nLink:\n${linkUrl}`;
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(linkUrl).catch(() => {});
        }
        alert(msg + '\n\n(Link copiado para a área de transferência)');
        await loadBonusSlots();

    } catch (err) {
        console.error('[BonusSlots] Erro ao criar:', err);
        alert('Erro ao criar link bônus: ' + err.message);
    }
};

window.copyBonusLink = async function(code) {
    const link = `${window.location.origin}/bonus.html?code=${code}`;
    try {
        await navigator.clipboard.writeText(link);
        alert(`✅ Link copiado!\n\n${link}`);
    } catch {
        prompt('Copie o link abaixo:', link);
    }
};

window.toggleBonusStatus = async function(id, currentStatus) {
    if (!window.firebaseDb) return;
    const novoStatus = currentStatus === 'ativo' ? 'pausado' : 'ativo';
    const confirmar = confirm(`${novoStatus === 'pausado' ? 'Pausar' : 'Reativar'} este link bônus?`);
    if (!confirmar) return;

    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await updateDoc(doc(window.firebaseDb, 'bonus_links', id), { status: novoStatus });
        await loadBonusSlots();
    } catch (err) {
        alert('Erro ao alterar status: ' + err.message);
    }
};

window.deleteBonusLink = async function(id) {
    if (!confirm('Excluir este link bônus permanentemente? Inscrições já realizadas NÃO serão afetadas.')) return;
    if (!window.firebaseDb) return;

    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await deleteDoc(doc(window.firebaseDb, 'bonus_links', id));
        await loadBonusSlots();
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    }
};

// ── Migração: corrigir slots bônus corrompidos ────────────────────────────────
// Uso: no console do navegador rode  fixarSlotsBonus('ID_DO_BONUS_LINK')
// Corrige registrations bônus com slots inflados + redefine usedCount correto.
window.fixarSlotsBonus = async function(bonusLinkId) {
    if (!window.firebaseDb) { console.error('[Fix] firebaseDb não disponível.'); return; }
    if (!bonusLinkId) { console.error('[Fix] Passe o ID do bonus_link como argumento.'); return; }

    const FS = 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
    const {
        collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp
    } = await import(FS);

    const db = window.firebaseDb;

    // 1. Ler o bonus_link
    const blSnap = await getDoc(doc(db, 'bonus_links', bonusLinkId));
    if (!blSnap.exists()) { console.error('[Fix] bonus_link não encontrado:', bonusLinkId); return; }
    const bl = blSnap.data();
    console.log('[Fix] bonus_link carregado:', bl.eventType, bl.date, bl.schedule, '| quantity:', bl.quantity, '| usedCount atual:', bl.usedCount);

    // 2. Buscar inscrições bônus (pelo bonusCode)
    const bonusSnap = await getDocs(query(
        collection(db, 'registrations'),
        where('bonusCode', '==', bl.code)
    ));
    const bonusRegs = bonusSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    bonusRegs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
        return ta - tb;
    });
    console.log('[Fix]', bonusRegs.length, 'inscrições bônus encontradas');

    // 3. Contar vagas regulares no mesmo horário (para calcular offset)
    let offsetRegulares = 0;
    const regSnap = await getDocs(query(
        collection(db, 'registrations'),
        where('eventType', '==', bl.eventType),
        where('date', '==', bl.date)
    ));
    const linkH = String(bl.schedule || '').match(/(\d+)/)?.[1] || '';
    regSnap.forEach(d => {
        const r = d.data();
        if (r.bonusCode === bl.code) return; // pular as bônus desta vaga
        const regH = String(r.schedule || r.hour || '').match(/(\d+)/)?.[1] || '';
        if (!linkH || regH === linkH) offsetRegulares++;
    });
    console.log('[Fix] offset regulares:', offsetRegulares);

    // 4. Re-atribuir slots: offset+1, offset+2, offset+3...
    const batch = writeBatch(db);
    bonusRegs.forEach((reg, i) => {
        const novoSlot        = offsetRegulares + (i + 1);
        const novoSlotDisplay = `Vaga #${novoSlot}`;
        const regRef = doc(db, 'registrations', reg.id);
        batch.update(regRef, { slot: novoSlot, slotDisplay: novoSlotDisplay, slotNumber: novoSlot });
        console.log(`[Fix]  ${reg.teamName || reg.id}: slot ${reg.slot} → ${novoSlot} (${novoSlotDisplay})`);
    });

    // 5. Corrigir usedCount no bonus_link (= quantidade real de bônus inscritos)
    const novoUsedCount = bonusRegs.length;
    const novoStatus = novoUsedCount >= bl.quantity ? 'expirado' : 'ativo';
    batch.update(doc(db, 'bonus_links', bonusLinkId), {
        usedCount: novoUsedCount,
        status: novoStatus
    });
    console.log(`[Fix] bonus_link usedCount: ${bl.usedCount} → ${novoUsedCount} | status: ${novoStatus}`);

    await batch.commit();
    console.log('[Fix] ✅ Migração concluída com sucesso!');
};
