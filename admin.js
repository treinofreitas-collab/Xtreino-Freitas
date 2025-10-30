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
        console.log('✅ Firebase completamente inicializado');
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
    
    console.log('🔍 Verificando autorização para:', user.email);
    console.log('🔍 Firebase Auth disponível:', !!window.firebaseAuth);
    console.log('🔍 Firebase DB disponível:', !!window.firebaseDb);
    
    // Para socio, permitir qualquer email
    if (user.email.toLowerCase().includes('cleitondouglass') || user.email.toLowerCase().includes('gilmario')) {
      console.log('✅ Email autorizado (socio/admin):', user.email);
    } else {
      console.log('⚠️ Email não está na lista, mas continuando para verificar cargo...');
    }

    // Check user role in Firestore
    try {
      console.log('🔍 Tentando acessar documento do usuário:', user.uid);
      const userDoc = await getDoc(doc(window.firebaseDb, 'users', user.uid));
      if (!userDoc.exists()) {
        console.log('❌ Documento de usuário não encontrado no Firestore');
        console.log('🔧 Criando documento do usuário automaticamente...');
        
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
        console.log('✅ Documento do usuário criado com sucesso!');
        
        // Agora tentar novamente
        const newUserDoc = await getDoc(doc(window.firebaseDb, 'users', user.uid));
        if (!newUserDoc.exists()) {
          console.log('❌ Erro ao criar documento do usuário');
          return false;
        }
        
        const newUserData = newUserDoc.data();
        const role = (newUserData.role || '').toLowerCase();
        console.log('🎭 Cargo definido:', role);
        
        if (role === 'socio' || role === 'sócio' || role === 'ceo') {
          console.log('✅ Acesso liberado para Socio (documento criado)');
          return true;
        }
        
        return false;
      }
      
      const userData = userDoc.data();
      const role = (userData.role || '').toLowerCase();
      
      console.log('🎭 Cargo encontrado:', userData.role, '-> normalizado:', role);
      console.log('📊 Dados completos do usuário:', userData);
      
      // Para socio, permitir acesso total
      if (role === 'socio' || role === 'sócio' || role === 'ceo') {
        console.log('✅ Acesso liberado para Socio');
        return true;
      }
      
      const isAuthorized = ['admin', 'gerente', 'vendedor', 'design', 'designer', 'desgin'].includes(role);
      console.log('🔐 Autorizado para outros cargos:', isAuthorized);
      
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
      console.log('Session timeout - logging out');
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
    dashboard.classList.remove('hidden');
    setView(userRole);
    startSessionTimer();
  }
  
  // Expor showDashboard globalmente imediatamente
  window.showDashboard = showDashboard;

  // Control section visibility based on role
  function controlSectionVisibility(userRole) {
    const role = (userRole || '').toLowerCase();
    
    // Get all section elements
    const sectionKPIs = document.getElementById('sectionKPIs');
    const sectionFilters = document.getElementById('sectionFilters');
    const sectionCharts = document.getElementById('sectionCharts');
    const sectionUsers = document.getElementById('sectionUsers');
    const sectionTokenStats = document.getElementById('sectionTokenStats');
    const sectionUsersManagement = document.getElementById('sectionUsersManagement');
    const sectionTokens = document.getElementById('sectionTokens');
    const sectionCoupons = document.getElementById('sectionCoupons');
    const sectionCouponUsage = document.getElementById('sectionCouponUsage');
    const sectionPasseBooyah = document.getElementById('sectionPasseBooyah');
    const sectionHighlights = document.getElementById('sectionHighlights');
    const sectionNews = document.getElementById('sectionNews');
    const sectionProducts = document.getElementById('sectionProducts');
    const sectionSchedules = document.getElementById('sectionSchedules');
    const sectionAdminHistory = document.getElementById('sectionAdminHistory');
    
    // Ocultar todas as seções por padrão
    if (sectionKPIs) sectionKPIs.style.display = 'none';
    if (sectionFilters) sectionFilters.style.display = 'none';
    if (sectionCharts) sectionCharts.style.display = 'none';
    if (sectionUsers) sectionUsers.style.display = 'none';
    if (sectionTokenStats) sectionTokenStats.style.display = 'none';
    if (sectionUsersManagement) sectionUsersManagement.style.display = 'none';
    if (sectionTokens) sectionTokens.style.display = 'none';
    if (sectionCoupons) sectionCoupons.style.display = 'none';
    if (sectionCouponUsage) sectionCouponUsage.style.display = 'none';
    if (sectionPasseBooyah) sectionPasseBooyah.style.display = 'none';
    if (sectionProducts) sectionProducts.style.display = 'none';
    if (sectionSchedules) sectionSchedules.style.display = 'none';
    if (sectionHighlights) sectionHighlights.style.display = 'none';
    if (sectionNews) sectionNews.style.display = 'none';
    if (sectionAdminHistory) sectionAdminHistory.style.display = 'none';
    
    // Design: Apenas destaques e notícias
    if (role === 'design' || role === 'desgin' || role === 'designer') {
      // Mostrar apenas Notícias e Destaques
      if (sectionHighlights) sectionHighlights.style.display = 'block';
      if (sectionNews) sectionNews.style.display = 'block';
      
      // Ocultar todas as outras seções
      if (sectionKPIs) sectionKPIs.style.display = 'none';
      if (sectionFilters) sectionFilters.style.display = 'none';
      if (sectionCharts) sectionCharts.style.display = 'none';
      if (sectionUsers) sectionUsers.style.display = 'none';
      if (sectionTokenStats) sectionTokenStats.style.display = 'none';
      if (sectionUsersManagement) sectionUsersManagement.style.display = 'none';
      if (sectionTokens) sectionTokens.style.display = 'none';
      if (sectionCoupons) sectionCoupons.style.display = 'none';
      if (sectionCouponUsage) sectionCouponUsage.style.display = 'none';
      if (sectionPasseBooyah) sectionPasseBooyah.style.display = 'none';
      if (sectionProducts) sectionProducts.style.display = 'none';
      if (sectionSchedules) sectionSchedules.style.display = 'none';
      if (sectionAdminHistory) sectionAdminHistory.style.display = 'none';
    }
    // Sócio: Limited access - only basic sections
    else if (role === 'socio' || role === 'sócio' || role === 'ceo') {
      // Mostrar apenas seções básicas para sócio
      if (sectionKPIs) sectionKPIs.style.display = 'block';
      if (sectionFilters) sectionFilters.style.display = 'block';
      if (sectionCharts) sectionCharts.style.display = 'block';
      if (sectionUsers) sectionUsers.style.display = 'block';
      if (sectionTokenStats) sectionTokenStats.style.display = 'block';
      if (sectionCouponUsage) sectionCouponUsage.style.display = 'block';
      
      if (sectionPasseBooyah) {
        sectionPasseBooyah.style.display = 'block';
        console.log('✅ Passe Booyah section displayed for Socio');
      } else {
        console.log('❌ sectionPasseBooyah not found');
      }
      
      if (sectionSchedules) {
        sectionSchedules.style.display = 'block';
        console.log('✅ Schedules section displayed for Socio');
      } else {
        console.log('❌ sectionSchedules not found');
      }
      
      // Ocultar seções administrativas
      if (sectionUsersManagement) sectionUsersManagement.style.display = 'none';
      if (sectionTokens) sectionTokens.style.display = 'none';
      if (sectionCoupons) sectionCoupons.style.display = 'none';
      if (sectionProducts) sectionProducts.style.display = 'none';
      if (sectionHighlights) sectionHighlights.style.display = 'none';
      if (sectionNews) sectionNews.style.display = 'none';
      if (sectionAdminHistory) sectionAdminHistory.style.display = 'none';
      
      console.log('✅ Socio permissions applied - limited access');
    } else {
      console.log('❌ Role does not match socio. Role:', role);
    }
    // CEO: Can see and edit everything
    if (role === 'ceo') {
      // Mostrar todas as seções
      if (sectionKPIs) sectionKPIs.style.display = 'block';
      if (sectionFilters) sectionFilters.style.display = 'block';
      if (sectionCharts) sectionCharts.style.display = 'block';
      if (sectionUsers) sectionUsers.style.display = 'block';
      if (sectionTokenStats) sectionTokenStats.style.display = 'block';
      if (sectionUsersManagement) sectionUsersManagement.style.display = 'block';
      if (sectionTokens) sectionTokens.style.display = 'block';
      if (sectionCoupons) sectionCoupons.style.display = 'block';
      if (sectionCouponUsage) sectionCouponUsage.style.display = 'block';
      if (sectionPasseBooyah) sectionPasseBooyah.style.display = 'block';
      if (sectionProducts) sectionProducts.style.display = 'block';
      if (sectionSchedules) sectionSchedules.style.display = 'block';
      if (sectionHighlights) sectionHighlights.style.display = 'block';
      if (sectionNews) sectionNews.style.display = 'block';
      if (sectionAdminHistory) sectionAdminHistory.style.display = 'block';
    }
    // Admin: Can see and edit everything
    if (role === 'admin') {
      // Mostrar todas as seções
      if (sectionKPIs) sectionKPIs.style.display = 'block';
      if (sectionFilters) sectionFilters.style.display = 'block';
      if (sectionCharts) sectionCharts.style.display = 'block';
      if (sectionUsers) sectionUsers.style.display = 'block';
      if (sectionTokenStats) sectionTokenStats.style.display = 'block';
      if (sectionUsersManagement) sectionUsersManagement.style.display = 'block';
      if (sectionTokens) sectionTokens.style.display = 'block';
      if (sectionCoupons) sectionCoupons.style.display = 'block';
      if (sectionCouponUsage) sectionCouponUsage.style.display = 'block';
      if (sectionPasseBooyah) sectionPasseBooyah.style.display = 'block';
      if (sectionProducts) sectionProducts.style.display = 'block';
      if (sectionSchedules) sectionSchedules.style.display = 'block';
      if (sectionHighlights) sectionHighlights.style.display = 'block';
      if (sectionNews) sectionNews.style.display = 'block';
      if (sectionAdminHistory) sectionAdminHistory.style.display = 'block';
    }
    // Gerente: Acesso a vendas gerais do mês
    else if (role === 'gerente') {
      // Mostrar seções de vendas e relatórios gerais
      if (sectionKPIs) sectionKPIs.style.display = 'block';
      if (sectionFilters) sectionFilters.style.display = 'block';
      if (sectionCharts) sectionCharts.style.display = 'block';
      if (sectionTokenStats) sectionTokenStats.style.display = 'block';
      if (sectionUsers) sectionUsers.style.display = 'block';
      if (sectionAdminHistory) sectionAdminHistory.style.display = 'block';
      
      // Ocultar seções administrativas específicas
      if (sectionUsersManagement) sectionUsersManagement.style.display = 'none';
      if (sectionTokens) sectionTokens.style.display = 'none';
      if (sectionCoupons) sectionCoupons.style.display = 'none';
      if (sectionCouponUsage) sectionCouponUsage.style.display = 'none';
      if (sectionPasseBooyah) sectionPasseBooyah.style.display = 'none';
      if (sectionProducts) sectionProducts.style.display = 'none';
      if (sectionSchedules) sectionSchedules.style.display = 'none';
      if (sectionHighlights) sectionHighlights.style.display = 'none';
      if (sectionNews) sectionNews.style.display = 'none';
    }
    // Vendedor: Vendas recentes, cupons, vendas para aprovação, controle de passe e gerenciamento de tokens
    else if (role === 'vendedor') {
      // Mostrar seções específicas para vendedor
      if (sectionKPIs) sectionKPIs.style.display = 'block';
      if (sectionCharts) sectionCharts.style.display = 'block';
      if (sectionTokenStats) sectionTokenStats.style.display = 'block';
      if (sectionTokens) sectionTokens.style.display = 'block';
      if (sectionCoupons) sectionCoupons.style.display = 'block';
      if (sectionCouponUsage) sectionCouponUsage.style.display = 'block';
      if (sectionPasseBooyah) sectionPasseBooyah.style.display = 'block';
      if (sectionUsers) sectionUsers.style.display = 'block';
      
      // Ocultar seções administrativas
      if (sectionFilters) sectionFilters.style.display = 'none';
      if (sectionUsersManagement) sectionUsersManagement.style.display = 'none';
      if (sectionProducts) sectionProducts.style.display = 'none';
      if (sectionSchedules) sectionSchedules.style.display = 'none';
      if (sectionHighlights) sectionHighlights.style.display = 'none';
      if (sectionNews) sectionNews.style.display = 'none';
      if (sectionAdminHistory) sectionAdminHistory.style.display = 'none';
    }
    
  }

  // Control edit permissions based on role
  function controlEditPermissions(userRole) {
    const role = (userRole || '').toLowerCase();
    
    // Get all input elements, buttons, and editable elements
    const inputs = document.querySelectorAll('input, textarea, select');
    const buttons = document.querySelectorAll('button');
    const editButtons = document.querySelectorAll('.edit-btn, .save-btn, .delete-btn, .add-btn, [class*="btn"]');
    const editableElements = document.querySelectorAll('[contenteditable="true"]');
    
    // Combine all editable elements
    const allEditableElements = [...inputs, ...buttons, ...editButtons, ...editableElements];
    
    
    // Design: Can only edit highlights and news sections
    if (role === 'design' || role === 'desgin' || role === 'designer') {
      
      allEditableElements.forEach((element, index) => {
        // Check if element is in highlights or news sections
        const isInHighlights = element.closest('#sectionHighlights');
        const isInNews = element.closest('#sectionNews');
        
        if (isInHighlights || isInNews) {
          // Enable editing for highlights and news
          element.disabled = false;
          element.readOnly = false;
          element.style.pointerEvents = 'auto';
          element.style.opacity = '1';
        } else {
          // Disable editing for all other sections
          element.disabled = true;
          element.readOnly = true;
          element.style.pointerEvents = 'none';
          element.style.opacity = '0.5';
        }
      });
      
    }
    // Socio: Read-only access (can see but not edit)
    else if (role === 'socio' || role === 'sócio' || role === 'ceo') {
      
      allEditableElements.forEach(element => {
        element.disabled = true;
        element.readOnly = true;
        element.style.pointerEvents = 'none';
        element.style.opacity = '0.5';
      });
      
    }
    // CEO, Admin, Gerente: Full edit access
    else if (role === 'ceo' || role === 'admin' || role === 'gerente') {
      
      allEditableElements.forEach(element => {
        element.disabled = false;
        element.readOnly = false;
        element.style.pointerEvents = 'auto';
        element.style.opacity = '1';
      });
      
    }
    // Vendedor: Limited edit access
    else if (role === 'vendedor') {
      
      allEditableElements.forEach(element => {
        // Vendedor can edit in specific sections: tokens, coupons, passe, users
        const isInAllowedSection = element.closest('#sectionTokens, #sectionCoupons, #sectionCouponUsage, #sectionPasseBooyah, #sectionUsers, #sectionKPIs, #sectionCharts');
        
        if (isInAllowedSection) {
          element.disabled = false;
          element.readOnly = false;
          element.style.pointerEvents = 'auto';
          element.style.opacity = '1';
        } else {
          element.disabled = true;
          element.readOnly = true;
          element.style.pointerEvents = 'none';
          element.style.opacity = '0.5';
        }
      });
      
    }
    
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
    
    // Apply role-based section visibility and edit permissions with a delay to ensure DOM is ready
    // REMOVIDO: controlSectionVisibility agora é chamada após carregamento de dados no onAuthStateChanged
    
    // Apply edit permissions with a longer delay to ensure all elements are loaded
    setTimeout(() => {
      controlEditPermissions(role);
      
      // Verificação adicional para vendedor - garantir que elementos estejam habilitados
      if (role === 'vendedor') {
        const allowedSections = ['sectionTokens', 'sectionCoupons', 'sectionCouponUsage', 'sectionPasseBooyah', 'sectionUsers', 'sectionKPIs', 'sectionCharts'];
        
        allowedSections.forEach(sectionId => {
          const section = document.getElementById(sectionId);
          if (section) {
            const elements = section.querySelectorAll('input, textarea, select, button, [contenteditable="true"]');
            elements.forEach(element => {
              // Só habilitar se não estiver em uma operação temporária
              if (!element.hasAttribute('data-temp-disabled')) {
                element.disabled = false;
                element.readOnly = false;
                element.style.pointerEvents = 'auto';
                element.style.opacity = '1';
              }
            });
          }
        });
      }
    }, 500);
    
    // Controle de visão
    const kpiCards = document.querySelectorAll('#kpiToday, #kpiMonth, #kpiReceivable');
    const productsCard = document.getElementById('popularHoursChart')?.closest('.bg-white');
    const salesChartCard = document.getElementById('salesChart')?.closest('.bg-white');
    const topProductsCard = document.getElementById('topProductsChart')?.closest('.bg-white');
    
    if (role === 'vendedor'){
      // Vendedor: vê pedidos recentes e KPIs (visibilidade controlada por controlSectionVisibility)
      // Removido: ocultação de KPIs - agora controlado por controlSectionVisibility
      if (productsCard) productsCard.classList.add('hidden');
      if (salesChartCard) salesChartCard.classList.add('hidden');
      if (topProductsCard) topProductsCard.classList.add('hidden');
    } else if (role === 'gerente'){
      // Gerente: vê financeiro, exceto fluxo total mensal e gráfico de Vendas 30d
      const kpiMonthCard = document.getElementById('kpiMonth')?.closest('.bg-white');
      if (kpiMonthCard) kpiMonthCard.classList.add('hidden');
      if (salesChartCard) salesChartCard.classList.add('hidden');
    } else if (role === 'design'){
      // Design: esconde todos os KPIs e gráficos
      kpiCards.forEach(e => e && (e.closest('.bg-white').classList.add('hidden')));
      if (productsCard) productsCard.classList.add('hidden');
      if (salesChartCard) salesChartCard.classList.add('hidden');
      if (topProductsCard) topProductsCard.classList.add('hidden');
    } else if (role === 'socio' || role === 'ceo'){
      // Sócio: vê tudo (read-only)
      // Nenhuma ocultação de elementos
    }
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
      
      console.log('🔍 Tentando carregar usuários...');
      // Buscar usuários no Firestore
      const usersRef = collection(window.firebaseDb, 'users');
      const snapshot = await getDocs(usersRef);
      console.log('✅ Usuários carregados com sucesso:', snapshot.size);
      
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
            <option value="Vendedor" ${user.role === 'Vendedor' ? 'selected' : ''}>Vendedor</option>
            <option value="Gerente" ${user.role === 'Gerente' ? 'selected' : ''}>Gerente</option>
            <option value="Ceo" ${user.role === 'Ceo' ? 'selected' : ''}>Ceo</option>
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
      
      // console.log('🔍 Carregando dados de tokens...');
      // Buscar pedidos de tokens
      const ordersRef = collection(window.firebaseDb, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      // console.log('📊 Total de pedidos encontrados:', ordersSnapshot.size);
      
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
      
      // Atualizar contador
      document.getElementById('tokensCount').textContent = `${tokensData.length} compras`;
      document.getElementById('totalTokensPurchased').textContent = tokensData.length;
      // console.log('✅ Tokens carregados:', tokensData.length);
      
      // Mostrar primeira página
      mostrarTokensPagina(1);
      
    } catch (error) {
      console.error('Erro ao carregar dados de tokens:', error);
    }
  }

  // Função para mostrar tokens da página específica
  function mostrarTokensPagina(pagina) {
    const tbody = document.getElementById('tokensTbody');
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
    gerarBotoesPaginacao('tokensPagination', pagina, totalPages, (p) => mostrarTokensPagina(p));
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
            evento: reg.eventType || reg.title || 'Evento',
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
      
      // Atualizar contador
      document.getElementById('totalTokensUsed').textContent = tokenUsageData.length;
      
      // Mostrar primeira página
      mostrarUsoTokensPagina(1);
      
    } catch (error) {
      console.error('Erro ao carregar dados de uso de tokens:', error);
    }
  }

  // Função para mostrar uso de tokens da página específica
  function mostrarUsoTokensPagina(pagina) {
    const tbody = document.getElementById('tokenUsageTbody');
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
      
      // console.log('🔍 Carregando pedidos confirmados...');
      // Buscar pedidos confirmados
      const ordersRef = collection(window.firebaseDb, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      // console.log('📊 Total de pedidos encontrados:', ordersSnapshot.size);
      
      confirmedOrdersData = [];
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        // Log detalhado removido
        if (['paid','approved','confirmed'].includes(String(order.status||'').toLowerCase())) {
          const originalDate = order.createdAt ? (order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt)) : new Date(0);
          confirmedOrdersData.push({
            id: doc.id,
            cliente: order.customer || order.customerName || order.buyerEmail || 'Cliente não informado',
            item: order.title || order.item || order.productName || 'Item não informado',
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
      // console.log('✅ Pedidos confirmados carregados:', confirmedOrdersData.length);
      
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
  async function submitAddTeam(e){
    try{
      e?.preventDefault();
  	  const hourEl = document.getElementById('addHour');
  	  const teamEl = document.getElementById('addTeamName');
  	  const contactEl = document.getElementById('addContact');
  	  const personEl = document.getElementById('addPerson');
  	  const notesEl = document.getElementById('addNotes');
  	  const msgEl = document.getElementById('addTeamMsg');
  	  const dateEl = document.getElementById('boardDate');
  	  const typeEl = document.getElementById('boardEventType');
  	  const schedule = (hourEl?.value || '').trim();
  	  const teamName = (teamEl?.value || '').trim();
  	  const contact = (contactEl?.value || '').trim();
  	  const person = (personEl?.value || '').trim();
  	  const notes = (notesEl?.value || '').trim();
  	  const date = (dateEl?.value || '').trim();
  	  const eventType = (typeEl?.value || '').trim();
  	  if (!teamName || !contact){
  	    alert('Informe ao menos Time/Org e Contato.');
  	    return;
  	  }
  	  if (!date){
  	    alert('Selecione uma data no painel de horários.');
  	    return;
  	  }
  	  // Se horário não estiver definido, cria sem horário específico
  	  const payload = {
  	    teamName,
  	    contact,
  	    person: person || null,
  	    notes: notes || null,
  	    date,
  	    schedule: schedule || '—',
  	    eventType: eventType || null,
  	    status: 'confirmed'
  	  };
  	  try{
  	    const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  	    await addDoc(collection(window.firebaseDb,'registrations'), { ...payload, createdAt: serverTimestamp() });
  	    if (msgEl) msgEl.textContent = 'Time adicionado com sucesso!';
  	    // limpar campos
  	    if (teamEl) teamEl.value = '';
  	    if (contactEl) contactEl.value = '';
  	    if (personEl) personEl.value = '';
  	    if (notesEl) notesEl.value = '';
  	    // Atualiza quadro e pendências
  	    try { await loadBoard(); } catch(_){}
  	    try { await loadPending(true); } catch(_){}
  	  }catch(err){
  	    alert('Falha ao salvar time.');
  	  }
    }catch(_){ }
  }

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

    // console.log('ADMIN UID:', uid, 'ROLE:', role);
    if (!['ceo','gerente','vendedor','design','designer','desgin','socio','sócio'].includes((role||'').toLowerCase())){
      authGate.classList.remove('hidden');
      dashboard.classList.add('hidden');
      return;
    }
    authGate.classList.add('hidden');
    dashboard.classList.remove('hidden');
    const roleLower = (role||'').toLowerCase();
    const isManager = ['ceo','gerente'].includes(roleLower);
    const isCeo = roleLower==='ceo';
    const isSocio = roleLower==='socio' || roleLower==='ceo';
    const canViewAll = ['ceo','gerente','socio'].includes(roleLower);
    window.adminRoleLower = roleLower;
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
        await carregarDadosTokens();
        await carregarDadosUsoTokens();
        await carregarPedidosConfirmados();
      } else {
        // Vendedor: evita coleções com restrição global
        // Mostra apenas relatórios simplificados e pedidos próprios (já feito abaixo)
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
    const formAddTeam = document.getElementById('formAddTeam');
    if (formAddTeam) formAddTeam.onsubmit = submitAddTeam;
    // Carrega relatórios e pendências para todas as funções
    await loadReports().catch(()=>{});
    if (canViewAll){
      await loadRecentSchedules().catch(()=>{});
      await loadPending(true).catch(()=>{});
    } else {
      await loadRecentOrders().catch(()=>{});
      await loadPending(false).catch(()=>{});
    }
    
    // APLICAR CONTROLE DE VISIBILIDADE APÓS CARREGAMENTO DE TODOS OS DADOS
    setTimeout(() => {
      controlSectionVisibility(roleLower);
    }, 1000); // Delay maior para garantir que tudo foi carregado
  });

  // ---- Relatórios ----
  let charts = {};
  let period = { from: null, to: null };

  // Unifica pedidos: orders + registrations
  async function fetchUnifiedOrders() {
    const items = [];
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      // Orders
      try{
        const snap = await getDocs(collection(window.firebaseDb,'orders'));
        snap.forEach(d => {
          const o = d.data();
          const ts = new Date(o.createdAt || o.timestamp || 0);
          items.push({ ts, amount: Number(o.amount||o.total||0), item: (o.item||o.productName||'Pedido'), customer:(o.customer||o.buyerEmail||'-'), status:(o.status||'') });
        });
      }catch(_){}
      // Registrations
      try{
        const regs = await getDocs(collection(window.firebaseDb,'registrations'));
        regs.forEach(d => {
          const r = d.data();
          const ts = (r.createdAt?.toDate ? r.createdAt.toDate() : (r.timestamp? new Date(r.timestamp) : new Date()));
          items.push({ ts, amount: Number(r.price||0), item:(r.title||r.eventType||'Reserva'), customer:(r.email||'-'), status:(r.status||'') });
        });
      }catch(_){}
    } catch(_){}
    return items;
  }

  async function loadReports(){
    try{
      await loadKpis().catch(()=>{});
      // await loadTokensData().catch(()=>{}); // Desabilitado - usando novas funções de paginação
      await renderSalesChart().catch(()=>{});
      await renderTopProducts().catch(()=>{});
      await renderPopularHours().catch(()=>{});
      await renderActiveUsers().catch(()=>{});
    }catch(e){ console.error('Erro ao carregar relatórios', e); }
  }

  // Funções para gerenciar tokens
  async function loadTokensData() {
    console.log('🔍 Loading tokens data...');
    try {
      await loadTokenPurchases();
      await loadTokenUsage();
      await updateTokenStats();
    } catch (error) {
      console.error('❌ Error loading tokens data:', error);
    }
  }

  async function loadTokenPurchases() {
    console.log('🔍 Loading token purchases...');
    try {
      const ordersSnap = await getDocs(collection(window.firebaseDb, 'orders'));
      const orders = [];
      
      ordersSnap.forEach(doc => {
        const data = doc.data();
        if (data.item && (data.item.includes('Token') || data.item.includes('token'))) {
          orders.push({
            id: doc.id,
            ...data
          });
        }
      });

      console.log('🔍 Found token orders:', orders.length);
      
      // Ordenar por data mais recente
      orders.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.timestamp || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.timestamp || 0);
        return dateB - dateA;
      });

      // Mostrar apenas os últimos 10
      const recentOrders = orders.slice(0, 10);
      
      const tbody = document.getElementById('tokensTbody');
      if (tbody) {
        tbody.innerHTML = '';
        
        recentOrders.forEach(order => {
          const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.timestamp || 0);
          const formattedDate = date.toLocaleDateString('pt-BR');
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="px-4 py-2">${order.customer || order.customerEmail || '-'}</td>
            <td class="px-4 py-2">${order.item || '-'}</td>
            <td class="px-4 py-2">${extractTokenQuantity(order.item)}</td>
            <td class="px-4 py-2">${brl(order.amount || order.total || 0)}</td>
            <td class="px-4 py-2">${formattedDate}</td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (error) {
      console.error('❌ Error loading token purchases:', error);
    }
  }

  async function loadTokenUsage() {
    console.log('🔍 Loading token usage...');
    try {
      const regsSnap = await getDocs(collection(window.firebaseDb, 'registrations'));
      const usages = [];
      
      regsSnap.forEach(doc => {
        const data = doc.data();
        if (data.paidWithTokens === true) {
          usages.push({
            id: doc.id,
            ...data
          });
        }
      });

      console.log('🔍 Found token usages:', usages.length);
      
      // Ordenar por data mais recente
      usages.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.timestamp || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.timestamp || 0);
        return dateB - dateA;
      });

      // Mostrar apenas os últimos 10
      const recentUsages = usages.slice(0, 10);
      
      const tbody = document.getElementById('tokenUsageTbody');
      if (tbody) {
        tbody.innerHTML = '';
        
        recentUsages.forEach(usage => {
          const date = usage.createdAt?.toDate ? usage.createdAt.toDate() : new Date(usage.timestamp || 0);
          const formattedDate = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="px-4 py-2">${usage.email || '-'}</td>
            <td class="px-4 py-2">${usage.eventType || '-'}</td>
            <td class="px-4 py-2">${getTokenCountForEvent(usage.eventType)}</td>
            <td class="px-4 py-2">${formattedDate}</td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (error) {
      console.error('❌ Error loading token usage:', error);
    }
  }

  async function updateTokenStats() {
    console.log('🔍 Updating token stats...');
    try {
      // Calcular tokens comprados
      const ordersSnap = await getDocs(collection(window.firebaseDb, 'orders'));
      let totalTokensPurchased = 0;
      
      ordersSnap.forEach(doc => {
        const data = doc.data();
        if (data.item && (data.item.includes('Token') || data.item.includes('token'))) {
          totalTokensPurchased += extractTokenQuantity(data.item);
        }
      });

      // Calcular tokens usados
      const regsSnap = await getDocs(collection(window.firebaseDb, 'registrations'));
      let totalTokensUsed = 0;
      
      regsSnap.forEach(doc => {
        const data = doc.data();
        if (data.paidWithTokens === true) {
          totalTokensUsed += getTokenCountForEvent(data.eventType);
        }
      });

      console.log('🔍 Token stats:', { totalTokensPurchased, totalTokensUsed });

      // Atualizar UI
      const purchasedEl = document.getElementById('totalTokensPurchased');
      const usedEl = document.getElementById('totalTokensUsed');
      
      if (purchasedEl) purchasedEl.textContent = totalTokensPurchased;
      if (usedEl) usedEl.textContent = totalTokensUsed;
    } catch (error) {
      console.error('❌ Error updating token stats:', error);
    }
  }

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
    const kpiTodayEl = document.getElementById('kpiToday');
    const kpiMonthEl = document.getElementById('kpiMonth');
    const kpiRecEl = document.getElementById('kpiReceivable');
    const kpiActiveEl = document.getElementById('kpiActiveUsers');
    if (!kpiTodayEl || !kpiMonthEl || !kpiRecEl) return;

    console.log('🔍 loadKpis: Calculando vendas...');

    // Usar a mesma lógica da loadKPIs() que está funcionando corretamente
    const { collection, query, where, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
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
    
    console.log('📊 loadKpis - Vendas hoje:', sumToday, 'Vendas mês:', sumMonth, 'A receber:', receivable);
    
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
        // Vendedor não tem permissão para ler users
        kpiActiveEl.textContent = '—';
      }
    }
  }

  async function renderSalesChart(){
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const all = await fetchUnifiedOrders();
    // agrega últimos 30 dias
    const days = [...Array(30)].map((_,i)=>{ const d = new Date(); d.setDate(d.getDate()-(29-i)); return d;});
    const labels = days.map(d=>d.toLocaleDateString('pt-BR'));
    const dataMap = Object.fromEntries(labels.map(l=>[l,0]));
    all.forEach(o => {
      const ts = o.ts;
      if (period.from && ts < period.from) return;
      if (period.to && ts > period.to) return;
      const label = ts.toLocaleDateString('pt-BR');
      if (dataMap[label] !== undefined && (o.status||'').toLowerCase()==='paid') dataMap[label] += Number(o.amount||0);
    });
    const data = labels.map(l=>dataMap[l]);
    try { if (charts.sales) { charts.sales.destroy(); } } catch(_){}
    charts.sales = new Chart(canvas.getContext('2d'), {
      type: 'line', data: { labels, datasets: [{label:'Vendas', data, borderColor:'#2563eb', tension:.3}]}, options:{plugins:{legend:{display:false}}}
    });
  }

  async function renderTopProducts(){
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;
    const all = await fetchUnifiedOrders();
    const map = {};
    all.forEach(o=>{ if ((o.status||'').toLowerCase()!=='paid') return; const name=(o.item||'Item'); map[name]=(map[name]||0)+Number(o.amount||0); });
    const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
    try { if (charts.top) { charts.top.destroy(); } } catch(_){}
    charts.top = new Chart(canvas.getContext('2d'), { type:'bar', data:{ labels: entries.map(e=>e[0]), datasets:[{label:'Receita', data: entries.map(e=>e[1]), backgroundColor:'#60a5fa'}] }, options:{plugins:{legend:{display:false}}} });
  }

  // Atualiza todos os componentes do dashboard
  async function refreshDashboard(){
    try { await loadKpis(); } catch(_){ }
    try { await renderSalesChart(); } catch(_){ }
    try { await renderTopProducts(); } catch(_){ }
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

  // Nova função para carregar dados de tokens
  async function loadTokensData(){
    try {
      console.log('=== DEBUG: Carregando dados de tokens ===');
      
      // Debug: mostrar todos os orders
      const ordersSnap = await getDocs(collection(window.firebaseDb,'orders'));
      console.log('Total orders:', ordersSnap.size);
      ordersSnap.forEach(d => {
        const o = d.data();
        console.log('Order:', {
          id: d.id,
          description: o.description,
          item: o.item,
          status: o.status,
          customer: o.customer || o.buyerEmail
        });
      });
      
      // Debug: mostrar todas as registrations
      const regsSnap = await getDocs(collection(window.firebaseDb,'registrations'));
      console.log('Total registrations:', regsSnap.size);
      regsSnap.forEach(d => {
        const r = d.data();
        console.log('Registration:', {
          id: d.id,
          email: r.email,
          eventType: r.eventType,
          paidWithTokens: r.paidWithTokens,
          status: r.status
        });
      });
      
      // Carregar compras de tokens
      await loadTokenPurchases();
      // Carregar uso de tokens
      await loadTokenUsage();
      // Atualizar estatísticas gerais
      await updateTokenStats();
    } catch(e) { 
      console.error('Erro ao carregar dados de tokens:', e); 
    }
  }

  // Carregar compras de tokens
  async function loadTokenPurchases(){
    const tbody = document.getElementById('tokensTbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    try {
      const snap = await getDocs(collection(window.firebaseDb,'orders'));
      const tokenPurchases = [];
      
      snap.forEach(d => {
        const o = d.data();
        const description = o.description || o.item || '';
        
        // Verifica se é uma compra de tokens (mais flexível)
        if (description.toLowerCase().includes('token') || 
            description.toLowerCase().includes('xtreino') ||
            (o.item && o.item.toLowerCase().includes('token'))) {
          const ts = new Date(o.createdAt || o.timestamp || 0);
          if (period.from && ts < period.from) return;
          if (period.to && ts > period.to) return;
          
          // Extrai quantidade de tokens da descrição (mais flexível)
          const tokenMatch = description.match(/(\d+)\s*token/i) || 
                           description.match(/token[:\s]*(\d+)/i) ||
                           description.match(/(\d+)\s*xtreino/i);
          const tokenCount = tokenMatch ? parseInt(tokenMatch[1]) : 1;
          
          console.log('Token purchase found:', {
            description,
            tokenCount,
            client: o.customer || o.buyerEmail,
            status: o.status
          });
          
          tokenPurchases.push({
            ts,
            client: o.customer || o.buyerEmail || '',
            package: description,
            tokens: tokenCount,
            value: Number(o.amount || o.total || 0),
            id: d.id
          });
        }
      });
      
      // Ordenar por data desc e mostrar últimos 10
      tokenPurchases.sort((a,b) => b.ts - a.ts);
      const recentPurchases = tokenPurchases.slice(0, 10);
      
      recentPurchases.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2">${row.client}</td>
          <td class="py-2">${row.package}</td>
          <td class="py-2 font-semibold text-green-600">${row.tokens}</td>
          <td class="py-2 font-semibold">${brl(row.value)}</td>
          <td class="py-2 text-gray-500">${row.ts.toLocaleDateString('pt-BR')}</td>
        `;
        tbody.appendChild(tr);
      });
      
    } catch(e) { 
      console.error('Erro ao carregar compras de tokens:', e); 
    }
  }

  // Carregar uso de tokens
  async function loadTokenUsage(){
    const tbody = document.getElementById('tokenUsageTbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    try {
      const snap = await getDocs(collection(window.firebaseDb,'registrations'));
      const tokenUsage = [];
      
      snap.forEach(d => {
        const r = d.data();
        
        // Verifica se foi pago com tokens
        if (r.paidWithTokens === true) {
          console.log('Token usage found:', {
            client: r.email,
            event: r.title || r.eventType,
            paidWithTokens: r.paidWithTokens,
            status: r.status
          });
          const ts = (r.createdAt?.toDate ? r.createdAt.toDate() : (r.timestamp ? new Date(r.timestamp) : new Date()));
          if (period.from && ts < period.from) return;
          if (period.to && ts > period.to) return;
          
          // Determina quantidade de tokens baseado no tipo de evento
          let tokenCount = 1; // padrão
          const eventType = (r.eventType || '').toLowerCase();
          if (eventType.includes('modo liga')) tokenCount = 3;
          else if (eventType.includes('semanal')) tokenCount = 3.5;
          else if (eventType.includes('final semanal')) tokenCount = 7;
          else if (eventType.includes('camp')) tokenCount = 5;
          
          tokenUsage.push({
            ts,
            client: r.email || '',
            event: r.title || r.eventType || 'Evento',
            tokens: tokenCount,
            schedule: r.schedule || '',
            id: d.id
          });
        }
      });
      
      // Ordenar por data desc e mostrar últimos 10
      tokenUsage.sort((a,b) => b.ts - a.ts);
      const recentUsage = tokenUsage.slice(0, 10);
      
      recentUsage.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2">${row.client}</td>
          <td class="py-2">${row.event}</td>
          <td class="py-2 font-semibold text-blue-600">${row.tokens}</td>
          <td class="py-2 text-gray-500">${row.ts.toLocaleDateString('pt-BR')} ${row.schedule}</td>
        `;
        tbody.appendChild(tr);
      });
      
    } catch(e) { 
      console.error('Erro ao carregar uso de tokens:', e); 
    }
  }

  // Atualizar estatísticas gerais de tokens
  async function updateTokenStats(){
    try {
      let totalPurchased = 0;
      let totalUsed = 0;
      
      // Contar tokens comprados
      const ordersSnap = await getDocs(collection(window.firebaseDb,'orders'));
      ordersSnap.forEach(d => {
        const o = d.data();
        const description = o.description || o.item || '';
        
        if ((description.toLowerCase().includes('token') || 
             description.toLowerCase().includes('xtreino') ||
             (o.item && o.item.toLowerCase().includes('token'))) && 
            o.status === 'paid') {
          const tokenMatch = description.match(/(\d+)\s*token/i);
          const tokenCount = tokenMatch ? parseInt(tokenMatch[1]) : 1;
          totalPurchased += tokenCount;
        }
      });
      
      // Contar tokens usados
      const regsSnap = await getDocs(collection(window.firebaseDb,'registrations'));
      regsSnap.forEach(d => {
        const r = d.data();
        
        if (r.paidWithTokens === true) {
          const eventType = (r.eventType || '').toLowerCase();
          let tokenCount = 1;
          if (eventType.includes('modo liga')) tokenCount = 3;
          else if (eventType.includes('semanal')) tokenCount = 3.5;
          else if (eventType.includes('final semanal')) tokenCount = 7;
          else if (eventType.includes('camp')) tokenCount = 5;
          
          totalUsed += tokenCount;
        }
      });
      
      // Atualizar elementos
      const purchasedEl = document.getElementById('totalTokensPurchased');
      const usedEl = document.getElementById('totalTokensUsed');
      
      if (purchasedEl) purchasedEl.textContent = totalPurchased;
      if (usedEl) usedEl.textContent = totalUsed;
      
    } catch(e) { 
      console.error('Erro ao atualizar estatísticas de tokens:', e); 
    }
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
  function parsePeriod(){
    const sel = document.getElementById('reportPeriod');
    const fromEl = document.getElementById('dateFrom');
    const toEl = document.getElementById('dateTo');
    const v = sel?.value || 'today';
    const now = new Date();
    if (v==='today'){ period.from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); period.to = null; }
    else if (v==='7d'){ const d=new Date(); d.setDate(d.getDate()-7); period.from = d; period.to = null; }
    else if (v==='30d'){ const d=new Date(); d.setDate(d.getDate()-30); period.from = d; period.to = null; }
    else { period.from = fromEl?.value? new Date(fromEl.value) : null; period.to = toEl?.value? new Date(toEl.value) : null; }
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

  // Carrega quadro de horários por data/evento
  async function loadBoard(){
    try{
      const dateEl = document.getElementById('boardDate');
      const typeEl = document.getElementById('boardEventType');
      const tbody = document.getElementById('boardTbody');
      if (!dateEl || !typeEl || !tbody) return;
      const date = dateEl.value;
      const eventType = typeEl.value;
      tbody.innerHTML = '';
      if (!date) return;
      
      // Definir horários padrão para mostrar mesmo quando não há registros
      const defaultHours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
      
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const regs = collection(window.firebaseDb,'registrations');
      // status pago/confirmado para computar ocupação
      const q = query(regs, where('date','==', date), where('status','in',['paid','confirmed']));
      const snap = await getDocs(q);
      const map = {};
      snap.forEach(d=>{
        const r = d.data();
        // filtro por tipo (aceita contains, case-insensitive)
        if (eventType && r.eventType && !String(r.eventType).toLowerCase().includes(String(eventType).toLowerCase())) return;
        const key = r.schedule || r.hour || '—';
        map[key] = (map[key]||0) + 1;
      });
      
      // Criar entradas para todos os horários padrão, mesmo os vazios
      const allHours = new Set([...defaultHours, ...Object.keys(map)]);
      const entries = Array.from(allHours).sort((a,b)=>{
        const na = parseInt(String(a).replace(/\D/g,''))||0;
        const nb = parseInt(String(b).replace(/\D/g,''))||0;
        return na-nb;
      });
      
      entries.forEach((hour)=>{
        const cnt = map[hour] || 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="py-2">${hour}</td><td class="py-2">${cnt}/12</td><td class="py-2 space-x-2">
          <button class="px-2 py-1 bg-blue-600 text-white rounded text-xs" data-add-hour="${hour}">Adicionar</button>
          <button class="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs" data-manage-hour="${hour}">Gerenciar</button>
        </td>`;
        tbody.appendChild(tr);
      });
      // Bind actions para adicionar/gerenciar
      tbody.addEventListener('click', (e)=>{
        const btnAdd = e.target.closest('[data-add-hour]');
        const btnManage = e.target.closest('[data-manage-hour]');
        if (btnAdd){
          const h = btnAdd.getAttribute('data-add-hour');
          const modal = document.getElementById('modalAddTeam');
          const hourInput = document.getElementById('addHour');
          if (hourInput) hourInput.value = h;
          if (modal) modal.classList.remove('hidden');
        } else if (btnManage){
          const h = btnManage.getAttribute('data-manage-hour');
          openManageHourModal(date, eventType, h);
        }
      });

      if (entries.length===0){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td class="py-2" colspan="3">Sem reservas para esta data.</td>';
        tbody.appendChild(tr);
      }
    }catch(e){ console.error('loadBoard error', e); }
  }

  async function openManageHourModal(date, eventType, hour){
    try{
      const title = document.getElementById('manageHourTitle');
      const list = document.getElementById('manageHourList');
      const modal = document.getElementById('modalManageHour');
      if (!list || !modal) return;
      if (title) title.textContent = `Gerenciar ${hour} — ${date}`;
      list.innerHTML = '<div class="text-sm text-gray-500">Carregando...</div>';
      const { collection, query, where, getDocs, doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const regs = collection(window.firebaseDb,'registrations');
      // Busca todas as reservas do dia; filtra por eventType e hora com normaliza e7 e3o (schedule ou hour)
      const snap = await getDocs(query(regs, where('date','==', date)));
      list.innerHTML = '';
      let any = false;
      const evLower = String(eventType||'').toLowerCase();
      const hourDigits = (String(hour).match(/\d+/g)||[]).join('');
      snap.forEach(d=>{
        const r = d.data();
        if (evLower && r.eventType && !String(r.eventType).toLowerCase().includes(evLower)) return;
        const schedStr = String(r.schedule||'');
        const hourStr = String(r.hour||'');
        const combined = `${schedStr} ${hourStr}`.toLowerCase();
        const combinedDigits = (combined.match(/\d+/g)||[]).join('');
        const matches = combined.includes(String(hour).toLowerCase()) || (!!hourDigits && combinedDigits.includes(hourDigits));
        if (!matches) return;
        any = true;
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between border-b py-2';
        row.innerHTML = `<div class="text-sm"><div class="font-semibold">${r.teamName||r.email||'-'}</div><div class="text-gray-500">${r.contact||r.phone||''}</div></div>
          <button class="px-2 py-1 bg-red-600 text-white rounded text-xs" data-remove-reg-id="${d.id}">Remover</button>`;
        list.appendChild(row);
      });
      if (!any){ list.innerHTML = '<div class="text-sm text-gray-500">Nenhum time neste horário.</div>'; }
      list.addEventListener('click', async (e)=>{
        const btn = e.target.closest('[data-remove-reg-id]');
        if (!btn) return;
        const id = btn.getAttribute('data-remove-reg-id');
        try{
          await deleteDoc(doc(collection(window.firebaseDb,'registrations'), id));
          btn.closest('.flex')?.remove();
          try{ await loadBoard(); }catch(_){ }
        }catch(_){ alert('Falha ao remover.'); }
      });
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
    }catch(e){ console.log('Erro ativos', e); }
  }

  // [removido duplicado]
})();

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

    console.log('🔍 loadKPIs: Calculando vendas...');

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
    console.log('📊 Vendas hoje:', sumToday);

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
    console.log('📊 Vendas mês:', sumMonth, 'A receber:', receivable);
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

// Função para carregar eventos únicos do banco de dados
async function loadEventOptions() {
    try {
        if (!window.firebaseDb) {
            console.warn('Firebase não inicializado ainda');
            return;
        }
        
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const registrationsCol = collection(window.firebaseDb, 'registrations');
        const snap = await getDocs(registrationsCol);
        
        const events = new Set();
        snap.forEach(doc => {
            const data = doc.data();
            if (data.eventType && data.eventType.trim()) {
                events.add(data.eventType.trim());
            }
        });
        
        const eventFilter = document.getElementById('eventFilter');
        if (eventFilter) {
            // Limpar opções existentes (exceto a primeira)
            eventFilter.innerHTML = '<option value="">Todos os eventos</option>';
            
            // Adicionar eventos únicos ordenados alfabeticamente
            Array.from(events).sort().forEach(event => {
                const option = document.createElement('option');
                option.value = event;
                option.textContent = event;
                eventFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
    }
}

// Função para obter o dia da semana em português
function getDayOfWeek(date) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
}

// Função para carregar dados de horários com filtros
async function loadPopularHoursData(dayFilter = '', eventFilter = '') {
    try {
        if (!window.firebaseDb) {
            console.warn('Firebase não inicializado ainda');
            return { labels: [], data: [] };
        }
        
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const registrationsCol = collection(window.firebaseDb, 'registrations');
        const snap = await getDocs(registrationsCol);
        
        const hourCounts = new Map();
        
        snap.forEach(doc => {
            const data = doc.data();
            
            // Filtrar por status (apenas confirmados/pagos)
            if (!['paid', 'confirmed'].includes(data.status)) return;
            
            // Filtrar por evento se especificado
            if (eventFilter && data.eventType !== eventFilter) return;
            
            // Filtrar por dia da semana se especificado
            if (dayFilter) {
                const registrationDate = data.date ? new Date(data.date) : new Date();
                const dayOfWeek = getDayOfWeek(registrationDate);
                if (dayOfWeek !== dayFilter) return;
            }
            
            // Extrair horário
            const hour = data.schedule || data.hour || '—';
            if (hour && hour !== '—') {
                hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
            }
        });
        
        // Converter para arrays ordenados
        const entries = Array.from(hourCounts.entries());
        entries.sort((a, b) => {
            // Extrair número do horário para ordenação
            const hourA = parseInt(String(a[0]).replace(/\D/g, '')) || 0;
            const hourB = parseInt(String(b[0]).replace(/\D/g, '')) || 0;
            return hourA - hourB;
        });
        
        return {
            labels: entries.map(([hour]) => hour),
            data: entries.map(([, count]) => count)
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
    const roleBadge = document.getElementById('roleBadge');

    gate.classList.add('hidden');
    dash.classList.add('hidden');

    if (!ok) {
        gate.classList.remove('hidden');
        return;
    }

    const { onAuthStateChanged, signInWithEmailAndPassword, signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

    emailForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        try {
            await signInWithEmailAndPassword(window.firebaseAuth, email, password);
        } catch (err) {
            alert('Credenciais inválidas.');
        }
    });

    btnLogout?.addEventListener('click', async () => {
        try { await signOut(window.firebaseAuth); } catch {}
    });

    onAuthStateChanged(window.firebaseAuth, async (user) => {
        if (!user) {
            gate.classList.remove('hidden');
            dash.classList.add('hidden');
            return;
        }
        nameEl.textContent = user.displayName || user.email || 'Usuário';
        let role = { role: 'viewer' };
        try {
            role = await fetchRole(user.uid);
        } catch {}
        roleBadge.textContent = `Permissões: ${role.role || 'viewer'}`;

        // Mostra o dashboard imediatamente, independentemente de erros posteriores
        gate.classList.add('hidden');
        dash.classList.remove('hidden');

        try { await loadKPIs(); } catch (e) { console.error('KPIs error', e); }
        try { await loadCharts(); } catch (e) { console.error('Charts error', e); }
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
                confirmedTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhum pedido confirmado encontrado</td></tr>';
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
                
                orders.forEach(order => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="py-2">${order.customerName || order.customer || '-'}</td>
                        <td class="py-2">${order.title || order.item || '-'}</td>
                        <td class="py-2">R$ ${(order.amount || order.total || 0).toFixed(2)}</td>
                        <td class="py-2">${order.createdAt ? new Date(order.createdAt.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
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
                pendingTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhum pedido pendente encontrado</td></tr>';
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
                
                orders.forEach(order => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="py-2">${order.customerName || order.customer || '-'}</td>
                        <td class="py-2">${order.title || order.item || '-'}</td>
                        <td class="py-2">R$ ${(order.amount || order.total || 0).toFixed(2)}</td>
                        <td class="py-2">${order.createdAt ? new Date(order.createdAt.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
                        <td class="py-2">
                            <button onclick="approveOrder('${order.id}')" class="text-green-600 hover:text-green-800 text-sm">Aprovar</button>
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
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const orderRef = doc(window.firebaseDb, 'orders', orderId);
        await updateDoc(orderRef, { status: 'approved' });
        
        alert('Pedido aprovado com sucesso!');
        
        // Recarregar as listas
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

// ==================== SISTEMA DE PRODUTOS ====================

let productsData = {};
let productCounter = 0;

// Carregar produtos do Firestore
async function loadProducts() {
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const productsSnapshot = await getDocs(collection(window.firebaseDb, 'products'));
        
        if (productsSnapshot.empty) {
            // Criar produtos padrão se não existirem
            await createDefaultProducts();
            return;
        }
        
        productsData = {};
        productsSnapshot.forEach(doc => {
            productsData[doc.id] = doc.data();
        });
        
        updateProductsPreview();
        console.log('Produtos carregados:', Object.keys(productsData).length);
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

// Criar produtos padrão
async function createDefaultProducts() {
    const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const defaultProducts = {
        'sensibilidades': {
            id: 'sensibilidades',
            name: 'Sensibilidade no Free Fire',
            description: 'Passo a passo de como configurar e ajustar a sensibilidade no Free Fire e no próprio dispositivo',
            category: 'digital',
            price: 8.00,
            type: 'download',
            downloadType: 'file',
            platforms: ['Android', 'PC', 'iOS'],
            active: true,
            createdAt: new Date()
        },
        'imagens': {
            id: 'imagens',
            name: 'Imagens Aéreas',
            description: 'Mapas do Free Fire com visão aérea para estudo de calls, formação de rush, marcação e rotação',
            category: 'digital',
            price: 2.00,
            type: 'download',
            downloadType: 'maps',
            maps: ['Bermuda', 'Purgatório', 'Kalahari', 'Nova Terra', 'Alpine'],
            baseUrl: 'https://freitasteste.netlify.app/downloads/',
            active: true,
            createdAt: new Date()
        },
        'planilhas': {
            id: 'planilhas',
            name: 'Planilha de Análise de Times',
            description: 'Planilha desenvolvida para estudo e aprimoramento de Times, com detalhes de cada player em suas respectivas partidas',
            category: 'digital',
            price: 19.90,
            type: 'download',
            downloadType: 'file',
            features: ['Análise de até 8 integrantes', 'Pontuação total e abates', 'Tempo de sobrevivência', 'Gráficos e top 3'],
            active: true,
            createdAt: new Date()
        },
        'camisa': {
            id: 'camisa',
            name: 'Camisa Oficial Org Freitas',
            description: 'Camisa de manga curta com design exclusivo da Org Freitas, tecido leve e personalização com nome',
            category: 'physical',
            price: 89.90,
            type: 'delivery',
            sizes: ['P', 'M', 'G', 'GG'],
            features: ['Tecido leve', 'Bom caimento', 'Secagem rápida', 'Personalização com nome'],
            active: true,
            createdAt: new Date()
        },
        'passe-booyah': {
            id: 'passe-booyah',
            name: 'Passe de Elite',
            description: 'Passe de Elite para desbloqueio de recompensas, trajes e itens no jogo',
            category: 'digital',
            price: 11.00,
            type: 'gift',
            features: ['Entrega em até 24h', 'Suporte completo', 'Compra segura via ID'],
            active: true,
            createdAt: new Date()
        }
    };
    
    for (const [productId, productData] of Object.entries(defaultProducts)) {
        await setDoc(doc(window.firebaseDb, 'products', productId), productData);
    }
    
    productsData = defaultProducts;
    updateProductsPreview();
    console.log('Produtos padrão criados');
}

// Atualizar preview dos produtos
function updateProductsPreview() {
    const preview = document.getElementById('productsPreview');
    if (!preview) return;
    
    const products = Object.values(productsData);
    if (products.length === 0) {
        preview.innerHTML = '<div class="text-center text-gray-500 text-sm">Nenhum produto encontrado</div>';
        return;
    }
    
    preview.innerHTML = products.map(product => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <i class="fas fa-${getProductIcon(product.category)} text-blue-600 text-sm"></i>
                </div>
                <div>
                    <div class="font-medium text-sm">${product.name}</div>
                    <div class="text-xs text-gray-500">${product.category} • R$ ${product.price.toFixed(2)}</div>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <span class="px-2 py-1 text-xs rounded-full ${product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${product.active ? 'Ativo' : 'Inativo'}
                </span>
            </div>
        </div>
    `).join('');
}

// Obter ícone do produto
function getProductIcon(category) {
    switch (category) {
        case 'digital': return 'download';
        case 'physical': return 'shipping-fast';
        case 'gift': return 'gift';
        default: return 'box';
    }
}

// Abrir modal de produtos
function openProductsModal() {
    const modal = document.getElementById('modalProducts');
    if (modal) {
        modal.classList.remove('hidden');
        renderProductsForm();
    }
}

// Renderizar formulário de produtos
function renderProductsForm() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(productsData).forEach(([key, product], index) => {
        container.appendChild(createProductForm(key, product, index));
    });
}

// Criar formulário de produto
function createProductForm(key, product, index) {
    const div = document.createElement('div');
    div.className = 'border border-gray-200 rounded-lg p-6';
    div.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h4 class="font-bold text-lg">${product.name || 'Novo Produto'}</h4>
            <button onclick="removeProduct('${key}')" class="text-red-500 hover:text-red-700">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">ID do Produto</label>
                <input type="text" id="product_${key}_id" value="${product.id || ''}" 
                       class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" 
                       placeholder="Ex: imagens, planilhas">
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" id="product_${key}_name" value="${product.name || ''}" 
                       class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" 
                       placeholder="Nome do produto">
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea id="product_${key}_description" 
                          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" 
                          rows="2" placeholder="Descrição do produto">${product.description || ''}</textarea>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select id="product_${key}_category" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="digital" ${product.category === 'digital' ? 'selected' : ''}>Digital</option>
                    <option value="physical" ${product.category === 'physical' ? 'selected' : ''}>Físico</option>
                    <option value="gift" ${product.category === 'gift' ? 'selected' : ''}>Presente</option>
                </select>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                <input type="number" id="product_${key}_price" value="${product.price || 0}" 
                       step="0.01" min="0" 
                       class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" 
                       placeholder="0.00">
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select id="product_${key}_type" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="download" ${product.type === 'download' ? 'selected' : ''}>Download</option>
                    <option value="delivery" ${product.type === 'delivery' ? 'selected' : ''}>Entrega</option>
                    <option value="gift" ${product.type === 'gift' ? 'selected' : ''}>Presente</option>
                </select>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="product_${key}_active" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="true" ${product.active === true ? 'selected' : ''}>Ativo</option>
                    <option value="false" ${product.active === false ? 'selected' : ''}>Inativo</option>
                </select>
            </div>
        </div>
        
        <!-- Configurações específicas para downloads -->
        <div id="downloadConfig_${key}" class="mt-4 ${product.type === 'download' ? '' : 'hidden'}">
            <h5 class="font-medium text-gray-700 mb-2">Configurações de Download</h5>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Download</label>
                    <select id="product_${key}_downloadType" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                        <option value="file" ${product.downloadType === 'file' ? 'selected' : ''}>Arquivo Único</option>
                        <option value="maps" ${product.downloadType === 'maps' ? 'selected' : ''}>Múltiplos Mapas</option>
                    </select>
                </div>
                
                <div id="downloadUrl_${key}" class="${product.downloadType === 'file' ? '' : 'hidden'}">
                    <label class="block text-sm font-medium text-gray-700 mb-1">URL de Download</label>
                    <input type="url" id="product_${key}_downloadUrl" value="${product.downloadUrl || ''}" 
                           class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" 
                           placeholder="https://drive.google.com/...">
                </div>
                
                <div id="mapsConfig_${key}" class="${product.downloadType === 'maps' ? '' : 'hidden'}">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Mapas Disponíveis</label>
                    <input type="text" id="product_${key}_maps" value="${(product.maps || []).join(', ')}" 
                           class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" 
                           placeholder="Bermuda, Purgatório, Kalahari">
                </div>
                
                <div id="baseUrl_${key}" class="${product.downloadType === 'maps' ? '' : 'hidden'}">
                    <label class="block text-sm font-medium text-gray-700 mb-1">URL Base</label>
                    <input type="url" id="product_${key}_baseUrl" value="${product.baseUrl || ''}" 
                           class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" 
                           placeholder="https://freitasteste.netlify.app/downloads/">
                </div>
            </div>
        </div>
    `;
    
    // Adicionar event listeners para mostrar/ocultar configurações
    const typeSelect = div.querySelector(`#product_${key}_type`);
    const downloadConfig = div.querySelector(`#downloadConfig_${key}`);
    
    typeSelect.addEventListener('change', function() {
        if (this.value === 'download') {
            downloadConfig.classList.remove('hidden');
        } else {
            downloadConfig.classList.add('hidden');
        }
    });
    
    const downloadTypeSelect = div.querySelector(`#product_${key}_downloadType`);
    const downloadUrlDiv = div.querySelector(`#downloadUrl_${key}`);
    const mapsConfigDiv = div.querySelector(`#mapsConfig_${key}`);
    const baseUrlDiv = div.querySelector(`#baseUrl_${key}`);
    
    downloadTypeSelect.addEventListener('change', function() {
        if (this.value === 'file') {
            downloadUrlDiv.classList.remove('hidden');
            mapsConfigDiv.classList.add('hidden');
            baseUrlDiv.classList.add('hidden');
        } else {
            downloadUrlDiv.classList.add('hidden');
            mapsConfigDiv.classList.remove('hidden');
            baseUrlDiv.classList.remove('hidden');
        }
    });
    
    return div;
}

// Fechar modal de produtos
function closeProductsModal() {
    const modal = document.getElementById('modalProducts');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Adicionar novo produto
function addProduct() {
    const newKey = `product_${Date.now()}`;
    const newProduct = {
        id: '',
        name: '',
        description: '',
        category: 'digital',
        price: 0,
        type: 'download',
        active: true,
        createdAt: new Date()
    };
    
    productsData[newKey] = newProduct;
    renderProductsForm();
}

// Remover produto
function removeProduct(key) {
    if (Object.keys(productsData).length <= 1) {
        alert('Você deve manter pelo menos um produto.');
        return;
    }
    
    if (confirm('Tem certeza que deseja remover este produto?')) {
        delete productsData[key];
        renderProductsForm();
    }
}

// Salvar produtos
async function saveProducts() {
    try {
        const { collection, getDocs, deleteDoc, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // Limpar coleção existente
        const productsSnapshot = await getDocs(collection(window.firebaseDb, 'products'));
        for (const docSnapshot of productsSnapshot.docs) {
            await deleteDoc(docSnapshot.ref);
        }
        
        // Salvar novos produtos
        for (const [key, productData] of Object.entries(productsData)) {
            const productId = document.getElementById(`product_${key}_id`)?.value || key;
            const product = {
                id: productId,
                name: document.getElementById(`product_${key}_name`)?.value || '',
                description: document.getElementById(`product_${key}_description`)?.value || '',
                category: document.getElementById(`product_${key}_category`)?.value || 'digital',
                price: parseFloat(document.getElementById(`product_${key}_price`)?.value || 0),
                type: document.getElementById(`product_${key}_type`)?.value || 'download',
                active: document.getElementById(`product_${key}_active`)?.value === 'true',
                downloadType: document.getElementById(`product_${key}_downloadType`)?.value || 'file',
                downloadUrl: document.getElementById(`product_${key}_downloadUrl`)?.value || '',
                maps: document.getElementById(`product_${key}_maps`)?.value?.split(',').map(s => s.trim()).filter(Boolean) || [],
                baseUrl: document.getElementById(`product_${key}_baseUrl`)?.value || '',
                updatedAt: new Date()
            };
            
            await setDoc(doc(window.firebaseDb, 'products', productId), product);
        }
        
        // Recarregar dados
        await loadProducts();
        closeProductsModal();
        
        alert('Produtos salvos com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar produtos:', error);
        alert('Erro ao salvar produtos: ' + error.message);
    }
}

// Expor funções globalmente
window.openProductsModal = openProductsModal;
window.closeProductsModal = closeProductsModal;
window.addProduct = addProduct;
window.removeProduct = removeProduct;
window.saveProducts = saveProducts;

  // Security: Enhanced authentication system
  async function initAuth() {
    // Check for existing session
    const savedSession = sessionStorage.getItem('adminSession');
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        if (Date.now() - sessionData.timestamp < SESSION_TIMEOUT) {
          // Session still valid, check with Firebase
          const user = window.firebaseAuth.currentUser;
          if (user && await isAuthorizedAdmin(user)) {
            showDashboard(user.role || 'admin');
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
      console.log('🔍 Iniciando processo de login...');
      console.log('🔍 Email:', email);
      console.log('🔍 Firebase Auth disponível:', !!window.firebaseAuth);
      
      const { signInWithEmailAndPassword: signIn, signOut: signOutFn } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const { doc: docRef, getDoc: getDocFn } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      
      console.log('🔍 Tentando fazer login...');
      const userCredential = await signIn(window.firebaseAuth, email, password);
      const user = userCredential.user;
      console.log('✅ Login bem-sucedido!', user.email);
      
      // Check if user is authorized
      if (!user || !user.email) {
        await signOutFn(window.firebaseAuth);
        showLoginError('Erro ao fazer login.');
        return;
      }
      
      // Get user role from Firestore
      console.log('🔍 Verificando documento do usuário no Firestore...');
      console.log('🔍 UID do usuário:', user.uid);
      const userDoc = await getDocFn(docRef(window.firebaseDb, 'users', user.uid));
      console.log('🔍 Documento existe?', userDoc.exists());
      
      if (!userDoc.exists()) {
        console.log('🔧 Criando documento do usuário automaticamente...');
        
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
        console.log('✅ Documento do usuário criado com sucesso!');
        
        // Agora tentar novamente
        const newUserDoc = await getDocFn(docRef(window.firebaseDb, 'users', user.uid));
        if (!newUserDoc.exists()) {
          await signOutFn(window.firebaseAuth);
          showLoginError('Erro ao criar documento do usuário.');
          return;
        }
        
        const newUserData = newUserDoc.data();
        const role = (newUserData.role || '').toLowerCase().trim();
        console.log('🎭 Cargo definido:', role);
        
        // Continuar com o processo de login
        const authorizedRoles = ['admin', 'gerente', 'vendedor', 'design', 'designer', 'desgin', 'socio', 'sócio'];
        const isAuthorized = authorizedRoles.includes(role);
        
        if (!isAuthorized) {
          await signOutFn(window.firebaseAuth);
          showLoginError('Acesso negado. Você não tem permissão para acessar o painel administrativo.');
          return;
        }
        
        // Para socio, permitir qualquer email
        if (role === 'socio' || role === 'sócio' || role === 'ceo') {
          console.log('✅ Acesso liberado para Socio (documento criado)');
          
          // Save session
          const sessionData = {
            uid: user.uid,
            email: user.email,
            role: role,
            timestamp: Date.now()
          };
          sessionStorage.setItem('adminSession', JSON.stringify(sessionData));

          // Mostrar dashboard diretamente
          const authGate = document.getElementById('authGate');
          const dashboard = document.getElementById('dashboard');
          if (authGate && dashboard) {
            authGate.classList.add('hidden');
            dashboard.classList.remove('hidden');
            console.log('✅ Dashboard mostrado com sucesso');
            
            // Inicializar dashboard
            setTimeout(() => {
              if (typeof setView === 'function') {
                setView(role);
              }
              if (typeof startSessionTimer === 'function') {
                startSessionTimer();
              }
            }, 100);
          }
          return;
        }
        
        await signOutFn(window.firebaseAuth);
        showLoginError('Acesso negado. Você não tem permissão para acessar o painel administrativo.');
        return;
      }
      
      const userData = userDoc.data();
      const role = (userData.role || '').toLowerCase();
      
      console.log('🔍 Documento encontrado!');
      console.log('🔍 Dados do usuário:', userData);
      console.log('🔍 Cargo encontrado no Firestore:', userData.role, '-> normalizado:', role);
      
      // Limpar espaços em branco e caracteres especiais do cargo
      const cleanRole = role.trim();
      console.log('🔍 Cargo limpo:', `"${cleanRole}"`);
      
      // Check if role is authorized (including variations and typos)
      const authorizedRoles = ['admin', 'gerente', 'vendedor', 'design', 'designer', 'desgin', 'socio', 'sócio'];
      const isAuthorized = authorizedRoles.includes(cleanRole);
      
      console.log('🔍 Cargos autorizados:', authorizedRoles);
      console.log('🔍 Cargo do usuário (original):', `"${role}"`);
      console.log('🔍 Cargo do usuário (limpo):', `"${cleanRole}"`);
      console.log('🔍 Está autorizado?', isAuthorized);
      
      if (!isAuthorized) {
        console.log('❌ Cargo não autorizado, negando acesso');
        await signOutFn(window.firebaseAuth);
        showLoginError('Acesso negado. Você não tem permissão para acessar o painel administrativo.');
        return;
      }
      
      console.log('✅ Cargo autorizado, continuando...');
      
      // For admin/gerente/vendedor/ceo, check email whitelist
      // For design/designer/socio/sócio, allow any email with the correct role
      console.log('🔍 Verificando se precisa validar email...');
      console.log('🔍 Cargo é admin/gerente/vendedor/ceo?', ['admin', 'gerente', 'vendedor', 'ceo'].includes(cleanRole));
      
      if (['admin', 'gerente', 'vendedor', 'ceo'].includes(cleanRole)) {
        console.log('🔍 Validando email para cargo:', role);
        const ADMIN_EMAILS = [
          'cleitondouglass@gmail.com',
          'cleitondouglass123@hotmail.com',
          'gilmariofreitas378@gmail.com',
          'gilmariofreitas387@gmail.com',
          'flavetyr@gmail.com'
        ];
        
        console.log('🔍 Verificando email:', user.email, 'na lista:', ADMIN_EMAILS);
        console.log('🔍 Email em minúsculas:', user.email.toLowerCase());
        console.log('🔍 Está na lista?', ADMIN_EMAILS.includes(user.email.toLowerCase()));
        
        if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
          console.log('❌ Email não autorizado:', user.email);
          await signOutFn(window.firebaseAuth);
          showLoginError('Acesso negado. Email não autorizado para administração.');
          return;
        }
        
        console.log('✅ Email autorizado:', user.email);
      } else {
        console.log('✅ Cargo é socio/design, não precisa validar email');
      }

      // Save session
      console.log('🔍 Salvando sessão...');
      const sessionData = {
        uid: user.uid,
        email: user.email,
        role: cleanRole,
        timestamp: Date.now()
      };
      sessionStorage.setItem('adminSession', JSON.stringify(sessionData));
      console.log('✅ Sessão salva:', sessionData);

      // Show dashboard
      console.log('🔍 Tentando mostrar dashboard...');
      if (typeof showDashboard === 'function') {
        console.log('✅ Usando função showDashboard');
        showDashboard(role);
      } else {
        console.log('⚠️ showDashboard não está disponível, usando fallback');
        // Fallback: mostrar dashboard manualmente
        const authGate = document.getElementById('authGate');
        const dashboard = document.getElementById('dashboard');
        console.log('🔍 authGate encontrado:', !!authGate);
        console.log('🔍 dashboard encontrado:', !!dashboard);
        
        if (authGate && dashboard) {
          authGate.classList.add('hidden');
          dashboard.classList.remove('hidden');
          console.log('✅ Dashboard mostrado com sucesso!');
          
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
      console.log('🧪 Testando permissões do Firestore...');
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      
      // Testar leitura de usuários
      const usersRef = collection(window.firebaseDb, 'users');
      const usersSnapshot = await getDocs(usersRef);
      console.log('✅ Teste de usuários: OK -', usersSnapshot.size, 'documentos');
      
      // Testar leitura de pedidos
      const ordersRef = collection(window.firebaseDb, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      console.log('✅ Teste de pedidos: OK -', ordersSnapshot.size, 'documentos');
      
      // Testar leitura de registros
      const regsRef = collection(window.firebaseDb, 'registrations');
      const regsSnapshot = await getDocs(regsRef);
      console.log('✅ Teste de registros: OK -', regsSnapshot.size, 'documentos');
      
      console.log('🎉 Todos os testes de permissão passaram!');
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
    console.log('🔄 Carregando usuários...');
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
    console.log('🔎 Buscando atividade recente em pedidos...');
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
    
    console.log(`✅ ${allUsers.length} usuários carregados`);
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
  try {
    const session = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
    if (session && session.role) {
      return String(session.role);
    }
  } catch (e) {
    // Erro ao ler sessão
  }
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
  console.log('⚠️ renderUsersTable está obsoleta - use renderPermissionsTable');
  // Não fazer nada - a tabela de permissões é gerenciada separadamente
}

function renderActiveUsersTable(users) {
  const tbody = document.getElementById('activeUsersTableBody');
  if (!tbody) return;
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-gray-500">Nenhum usuário encontrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(user => {
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
    
    console.log('✅ Função do usuário atualizada com sucesso!');
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

// Carregar usuários especificamente para o card de permissões
async function loadPermissionsUsers() {
  try {
    console.log('🔄 Carregando usuários para permissões...');
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
    
    console.log(`✅ ${permissionsUsersData.length} usuários carregados para permissões`);
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
    console.log('❌ permissionsTableBody não encontrado');
    return;
  }
  
  if (permissionsUsersData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-gray-500">Nenhum usuário encontrado</td>
      </tr>
    `;
    return;
  }
  
  const startIndex = (permissionsCurrentPage - 1) * permissionsPerPage;
  const endIndex = startIndex + permissionsPerPage;
  const usersPage = permissionsUsersData.slice(startIndex, endIndex);
  
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
      console.log('ℹ️ Função não alterada para o usuário:', userId);
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
    
    console.log('✅ Função do usuário atualizada com sucesso!');
    
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
  const totalPages = Math.ceil(permissionsUsersData.length / permissionsPerPage);
  const paginationContainer = document.getElementById('permissionsPagination');
  const countElement = document.getElementById('permissionsUsersCount');
  const pageInfoElement = document.getElementById('permissionsUsersPageInfo');
  
  if (countElement) {
    countElement.textContent = `${permissionsUsersData.length} usuários`;
  }
  
  if (pageInfoElement) {
    pageInfoElement.textContent = `Página ${permissionsCurrentPage} de ${totalPages}`;
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
    console.log('🔄 Carregando usuários para tokens...');
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
    
    console.log(`✅ ${tokensUsersData.length} usuários carregados para tokens`);
    tokensFilteredData = [...tokensUsersData]; // Inicializar dados filtrados
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
  tokensCurrentPage = page;
  renderTokensTable();
  updateTokensPagination();
}

// Filtrar usuários de tokens
function filterTokensUsers() {
  const searchInput = document.getElementById('tokensSearchInput');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (searchTerm === '') {
    tokensFilteredData = [...tokensUsersData];
  } else {
    tokensFilteredData = tokensUsersData.filter(user => 
      user.email.toLowerCase().includes(searchTerm) ||
      user.role.toLowerCase().includes(searchTerm) ||
      getRoleDisplayName(user.role).toLowerCase().includes(searchTerm)
    );
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
let couponUsageFilters = { period: '7d', context: 'all' };

// Carregar cupons
async function loadCoupons() {
    try {
        console.log('🔄 Carregando cupons...');
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
        
        console.log(`✅ ${couponsData.length} cupons carregados`);
        renderCouponsTable();
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
                <td colspan="5" class="py-6 text-center text-gray-500">Nenhum cupom encontrado</td>
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
        
        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-2">
                    <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">${coupon.code}</span>
                </td>
                <td class="py-2 px-2 text-xs">${discountText}</td>
                <td class="py-2 px-2">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${usageTypeText}</span>
                </td>
                <td class="py-2 px-2">${statusBadge}</td>
                <td class="py-2 px-2">
                    <div class="flex gap-1">
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
    try {
        console.log('🔄 Carregando histórico de uso de cupons...');
        const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const usageRef = collection(window.firebaseDb, 'couponUsage');
        const q = query(usageRef, orderBy('usedAt', 'desc'));
        const snapshot = await getDocs(q);
        
        couponUsageData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            couponUsageData.push({
                id: doc.id,
                ...data,
                usedAt: data.usedAt?.toDate() || new Date()
            });
        });
        
        console.log(`✅ ${couponUsageData.length} usos de cupons carregados`);
        // Inicializa filtros padrão e aplica
        applyCouponUsageFilters();
    } catch (error) {
        console.error('❌ Erro ao carregar histórico de cupons:', error);
        const tbody = document.getElementById('couponUsageTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-6 text-center text-red-500">Erro ao carregar histórico</td>
                </tr>
            `;
        }
    }
}

// Renderizar tabela de uso de cupons
function renderCouponUsageTable() {
    const tbody = document.getElementById('couponUsageTableBody');
    const countElement = document.getElementById('couponUsageCount');
    
    if (!tbody) return;
    
    const data = Array.isArray(filteredCouponUsageData) && filteredCouponUsageData.length ? filteredCouponUsageData : couponUsageData;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-6 text-center text-gray-500">Nenhum uso de cupom encontrado</td>
            </tr>
        `;
        if (countElement) countElement.textContent = '0 usos';
        return;
    }
    
    if (countElement) countElement.textContent = `${data.length} usos`;
    
    tbody.innerHTML = data.map(usage => {
        // Usar os campos que realmente existem no banco
        const orderValue = usage.orderValue || 0;
        const discountAmount = usage.discountAmount || 0;
        const finalValue = usage.finalValue || (orderValue - discountAmount);
        
        // Calcular percentual se possível
        const discountPercentage = orderValue > 0 ? ((discountAmount / orderValue) * 100).toFixed(1) : 0;
        const discountText = discountAmount > 0 ? `R$ ${discountAmount.toFixed(2)} (${discountPercentage}%)` : 'R$ 0,00';
        
        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-2 text-xs">${usage.usedAt ? formatDateTime(usage.usedAt) : 'N/A'}</td>
                <td class="py-2 px-2">
                    <span class="font-mono text-xs bg-blue-100 px-2 py-1 rounded">${usage.couponCode || 'N/A'}</span>
                </td>
                <td class="py-2 px-2 text-xs">${usage.customerName ? usage.customerName.split(' ')[0] : (usage.customerEmail ? usage.customerEmail.split('@')[0] : 'N/A')}</td>
                <td class="py-2 px-2 text-xs">R$ ${orderValue.toFixed(2)}</td>
                <td class="py-2 px-2 text-xs text-green-600">-${discountText}</td>
                <td class="py-2 px-2 text-xs font-medium">R$ ${finalValue.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
}

// Aplicar filtros de período e contexto ao histórico de cupons
function applyCouponUsageFilters() {
    try {
        const now = new Date();
        let fromDate = null;
        switch (couponUsageFilters.period) {
            case '1d': fromDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); break;
            case '7d': fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case '15d': fromDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); break;
            case '30d': fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case 'all': default: fromDate = null; break;
        }
        
        filteredCouponUsageData = couponUsageData.filter(u => {
            // Filtro por período
            const usedAt = u.usedAt instanceof Date ? u.usedAt : new Date(u.usedAt);
            const inPeriod = fromDate ? usedAt >= fromDate && usedAt <= now : true;
            
            // Filtro por contexto (events, store ou ambos)
            const ctx = (u.context || '').toLowerCase();
            const inContext = couponUsageFilters.context === 'all' ? true : ctx === couponUsageFilters.context;
            
            return inPeriod && inContext;
        });
        
        renderCouponUsageTable();
    } catch (e) {
        console.error('Erro ao aplicar filtros de cupons:', e);
        // fallback
        filteredCouponUsageData = couponUsageData.slice();
        renderCouponUsageTable();
    }
}

// Abrir modal de criação de cupom
function openCreateCouponModal() {
    const modal = document.getElementById('createCouponModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Limpar formulário
        const form = document.getElementById('createCouponForm');
        if (form) form.reset();
    }
}

// Fechar modal de criação de cupom
function closeCreateCouponModal() {
    const modal = document.getElementById('createCouponModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Criar novo cupom
async function createCoupon(event) {
    event.preventDefault();
    
    const couponData = {
        code: document.getElementById('couponCode').value.toUpperCase().trim(),
        discountType: document.getElementById('discountType').value,
        discountValue: parseFloat(document.getElementById('discountValue').value),
        expirationDate: document.getElementById('expirationDate').value ? 
            new Date(document.getElementById('expirationDate').value) : null,
        usageType: document.getElementById('couponUsageType').value,
        specificEvents: [],
        isActive: true,
        usageCount: 0,
        createdAt: new Date(),
        createdBy: window.adminRoleLower || 'admin'
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
        console.log('🔄 Criando cupom:', couponData.code);
        
        // Verificar se o código já existe
        const existingCoupon = couponsData.find(c => c.code === couponData.code);
        if (existingCoupon) {
            alert('Já existe um cupom com este código');
            return;
        }
        
        // Salvar no Firestore
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const docRef = await addDoc(collection(window.firebaseDb, 'coupons'), couponData);
        console.log('✅ Cupom criado com ID:', docRef.id);
        
        // Log da ação
        await logAdminAction('create_coupon', `Criou cupom ${couponData.code} (${couponData.discountType === 'percentage' ? couponData.discountValue + '%' : 'R$ ' + couponData.discountValue})`);
        
        // Recarregar dados
        await loadCoupons();
        
        // Fechar modal
        closeCreateCouponModal();
        
        alert('Cupom criado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao criar cupom:', error);
        alert('Erro ao criar cupom: ' + error.message);
    }
}

// Alternar status do cupom
async function toggleCouponStatus(couponId, newStatus) {
    try {
        console.log(`🔄 ${newStatus ? 'Ativando' : 'Desativando'} cupom:`, couponId);
        
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
        console.log('🔄 Excluindo cupom:', couponId);
        
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
    console.log('🔄 Carregando histórico do admin...');
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
    
    console.log(`✅ ${adminHistoryData.length} ações carregadas do histórico`);
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
    console.log('🔄 Registrando ação do admin:', action, details);
    const { collection, addDoc, serverTimestamp, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const historyCol = collection(window.firebaseDb, 'adminHistory');
    
    // Coleta robusta dos dados do admin
    const sessionUser = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
    const authUser = (window.firebaseAuth && window.firebaseAuth.currentUser) ? window.firebaseAuth.currentUser : {};
    const uid = sessionUser.uid || authUser?.uid || null;
    let adminEmail = sessionUser.email || authUser?.email || 'N/A';
    let adminRole = sessionUser.role || (window.adminRoleLower || '').toLowerCase() || 'N/A';
    console.log('👤 Session user:', sessionUser);
    console.log('👤 Auth user:', { uid: authUser?.uid, email: authUser?.email });
    
    // Buscar dados completos do usuário para obter o nome
    let adminName = 'N/A';
    if (uid) {
      try {
        console.log('🔍 Buscando dados do usuário no Firebase...');
        const userRef = doc(window.firebaseDb, 'users', uid);
        const userSnap = await getDoc(userRef);
        console.log('📄 Documento do usuário existe:', userSnap.exists());
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('📊 Dados do usuário:', userData);
          
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
          
          console.log('👤 Nome extraído:', adminName);
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
    
    console.log('📝 Dados do log:', logData);
    
    await addDoc(historyCol, logData);
    console.log('✅ Ação registrada com sucesso no histórico');
    
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
        const shipping = data.shipping || {};
        const status = data.shippingStatus || (data.shirtShipped?'shipped':'pending') || 'pending';
        const addr = shipping.address ? `${shipping.address}, ${shipping.number||''} - ${shipping.district||''} - ${shipping.city||''}/${shipping.state||''}` : '';
        rows.push(`
          <tr class="border-b border-gray-100">
            <td class="py-2 px-2">${data.customer||data.buyerEmail||data.email||''}</td>
            <td class="py-2 px-2">${data.title||''}</td>
            <td class="py-2 px-2">${addr || '<span class=\'text-gray-400\'>Sem dados</span>'}</td>
            <td class="py-2 px-2">${status==='shipped' ? '<span class="text-green-600">Enviado</span>' : '<span class="text-yellow-600">Aguardando</span>'}</td>
            <td class="py-2 px-2">
              ${status==='shipped' ? '' : `<button class="px-2 py-1 bg-green-600 text-white rounded" onclick="markShirtAsShipped('${d.id}')">Marcar enviado</button>`}
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
window.markShirtAsShipped = markShirtAsShipped;
window.loadShirtOrders = loadShirtOrders;
window.openCreateCouponModal = openCreateCouponModal;
window.closeCreateCouponModal = closeCreateCouponModal;
window.createCoupon = createCoupon;
window.toggleCouponStatus = toggleCouponStatus;
window.deleteCoupon = deleteCoupon;

// Carregar usuários quando o admin for inicializado
document.addEventListener('DOMContentLoaded', function() {
  // Aguardar o Firebase estar pronto
  const waitForFirebase = () => {
    if (window.firebaseReady && window.firebaseDb) {
      loadUsersForTables();
      // Carregar links do WhatsApp automaticamente
      loadAdminWhatsAppLinks();
      // loadPermissionsUsers será chamada depois do login via setView
    } else {
      setTimeout(waitForFirebase, 100);
    }
  };
  waitForFirebase();
  
  // Event listener para formulário de criação de cupons
  const createCouponForm = document.getElementById('createCouponForm');
  if (createCouponForm) {
    createCouponForm.addEventListener('submit', createCoupon);
  }
  
  // Listeners de filtros do uso de cupons
  const couponUsagePeriod = document.getElementById('couponUsagePeriod');
  const couponUsageContext = document.getElementById('couponUsageContext');
  const couponUsageApply = document.getElementById('couponUsageApply');
  if (couponUsagePeriod) {
    couponUsagePeriod.addEventListener('change', (e)=>{ couponUsageFilters.period = e.target.value; });
  }
  if (couponUsageContext) {
    couponUsageContext.addEventListener('change', (e)=>{ couponUsageFilters.context = e.target.value; });
  }
  if (couponUsageApply) {
    couponUsageApply.addEventListener('click', ()=> applyCouponUsageFilters());
  }
});

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
        <td class="py-2 px-2">
          ${r.canConfirm ? `<button class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs" onclick="confirmPasseBooyah('${r.id}')">Confirmar</button>` : '<span class="text-gray-400 text-xs">—</span>'}
        </td>
      </tr>
    `).join('');

    // Expor função no escopo global
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
    }
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

    console.log('✅ Tokens recomputed:', { totalPurchased, totalUsed });
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

let currentEditingWhatsAppLink = null;

// Abrir modal de links do WhatsApp
function openWhatsAppLinksModal() {
  const modal = document.getElementById('modalWhatsAppLinks');
  if (modal) {
    modal.classList.remove('hidden');
    // Não recarregar aqui, já foi carregado automaticamente
  }
}

// Fechar modal de links do WhatsApp
function closeWhatsAppLinksModal() {
  const modal = document.getElementById('modalWhatsAppLinks');
  if (modal) {
    modal.classList.add('hidden');
    clearWhatsAppLinkForm();
  }
}

// Limpar formulário de link do WhatsApp
function clearWhatsAppLinkForm() {
  currentEditingWhatsAppLink = null;
  document.getElementById('whatsappLinkFormTitle').textContent = 'Adicionar Novo Link';
  document.getElementById('whatsappLinkForm').reset();
}

// Carregar links do WhatsApp do Firestore
async function loadAdminWhatsAppLinks() {
  try {
    if (!window.firebaseDb) {
      console.warn('Firebase não inicializado ainda');
      return;
    }
    
    const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const whatsappLinksRef = collection(window.firebaseDb, 'whatsapp_links');
    const q = query(whatsappLinksRef, orderBy('eventType', 'asc'));
    const snapshot = await getDocs(q);
    
    const links = [];
    snapshot.forEach(doc => {
      links.push({ id: doc.id, ...doc.data() });
    });
    
    // Ordenar manualmente por eventType e depois por schedule
    links.sort((a, b) => {
      if (a.eventType !== b.eventType) {
        return a.eventType.localeCompare(b.eventType);
      }
      // Se eventType for igual, ordenar por schedule (null primeiro)
      if (!a.schedule && !b.schedule) return 0;
      if (!a.schedule) return -1;
      if (!b.schedule) return 1;
      return a.schedule.localeCompare(b.schedule);
    });
    
    // Armazenar todos os links para filtro
    allWhatsAppLinks = links;
    
    // Configurar filtros se ainda não foram configurados
    if (!window.whatsappFiltersSetup) {
      setupWhatsAppFilters();
      window.whatsappFiltersSetup = true;
    }
    
    renderWhatsAppLinksTable(links);
    renderWhatsAppLinksList(links);
    
  } catch (error) {
    console.error('❌ Erro ao carregar links do WhatsApp:', error);
    showNotification('Erro ao carregar links do WhatsApp', 'error');
  }
}

// Renderizar tabela de links do WhatsApp
function renderWhatsAppLinksTable(links) {
  const tbody = document.getElementById('whatsappLinksTableBody');
  if (!tbody) return;
  
  if (links.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhum link cadastrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = links.map(link => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-2 px-3">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${getEventTypeLabel(link.eventType)}
        </span>
      </td>
      <td class="py-2 px-3">${link.schedule || 'Todos'}</td>
      <td class="py-2 px-3">
        <a href="${link.link}" target="_blank" class="text-green-600 hover:text-green-800 text-xs truncate max-w-xs block">
          ${link.link}
        </a>
      </td>
      <td class="py-2 px-3">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${link.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${link.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td class="py-2 px-3">
        <div class="flex gap-2">
          <button onclick="editWhatsAppLink('${link.id}')" class="text-blue-600 hover:text-blue-800 text-xs">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteWhatsAppLink('${link.id}')" class="text-red-600 hover:text-red-800 text-xs">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Renderizar lista de links do WhatsApp no modal
function renderWhatsAppLinksList(links) {
  const container = document.getElementById('whatsappLinksList');
  if (!container) return;
  
  if (links.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-4">Nenhum link cadastrado</div>';
    return;
  }
  
  container.innerHTML = links.map(link => `
    <div class="bg-white border border-gray-200 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              ${getEventTypeLabel(link.eventType)}
            </span>
            <span class="text-sm text-gray-600">${link.schedule || 'Todos os horários'}</span>
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${link.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
              ${link.status === 'active' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p class="text-sm text-gray-800 mb-1">${link.description || 'Sem descrição'}</p>
          <a href="${link.link}" target="_blank" class="text-green-600 hover:text-green-800 text-sm">
            ${link.link}
          </a>
        </div>
        <div class="flex gap-2 ml-4">
          <button onclick="editWhatsAppLink('${link.id}')" class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            <i class="fas fa-edit mr-1"></i>Editar
          </button>
          <button onclick="deleteWhatsAppLink('${link.id}')" class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
            <i class="fas fa-trash mr-1"></i>Excluir
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Obter label do tipo de evento
function getEventTypeLabel(eventType) {
  const labels = {
    'xtreino-tokens': 'XTreino Tokens',
    'xtreino-gratuito': 'XTreino Gratuito',
    'modo-liga': 'Modo Liga',
    'camp-freitas': 'Camp Freitas',
    'semanal-freitas': 'Semanal Freitas',
    'treino': 'Treino Normal'
  };
  return labels[eventType] || eventType;
}

// Salvar link do WhatsApp
async function saveWhatsAppLink() {
  try {
    if (!window.firebaseDb) {
      showNotification('Firebase não inicializado ainda', 'error');
      return;
    }
    
    const eventType = document.getElementById('whatsappEventType').value;
    const schedule = document.getElementById('whatsappSchedule').value.trim();
    const link = document.getElementById('whatsappLink').value.trim();
    const status = document.getElementById('whatsappStatus').value;
    const description = document.getElementById('whatsappDescription').value.trim();
    
    if (!eventType || !link) {
      showNotification('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    
    const { collection, addDoc, updateDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const linkData = {
      eventType,
      schedule: schedule || null,
      link,
      status,
      description: description || null,
      updatedAt: serverTimestamp()
    };
    
    if (currentEditingWhatsAppLink) {
      // Atualizar link existente
      const linkRef = doc(window.firebaseDb, 'whatsapp_links', currentEditingWhatsAppLink);
      await updateDoc(linkRef, linkData);
      showNotification('Link atualizado com sucesso!', 'success');
    } else {
      // Criar novo link
      linkData.createdAt = serverTimestamp();
      await addDoc(collection(window.firebaseDb, 'whatsapp_links'), linkData);
      showNotification('Link criado com sucesso!', 'success');
    }
    
    // Limpar cache para forçar atualização
    whatsappLinksCache.clear();
    console.log('🔍 Cache de links limpo após salvar');
    
    clearWhatsAppLinkForm();
    loadAdminWhatsAppLinks();
    
  } catch (error) {
    console.error('❌ Erro ao salvar link do WhatsApp:', error);
    showNotification('Erro ao salvar link do WhatsApp', 'error');
  }
}

// Editar link do WhatsApp
async function editWhatsAppLink(linkId) {
  try {
    console.log('🔍 Editando link:', linkId);
    
    if (!window.firebaseDb) {
      showNotification('Firebase não inicializado ainda', 'error');
      return;
    }
    
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const linkRef = doc(window.firebaseDb, 'whatsapp_links', linkId);
    const linkSnap = await getDoc(linkRef);
    
    if (linkSnap.exists()) {
      const linkData = linkSnap.data();
      console.log('🔍 Dados do link:', linkData);
      
      currentEditingWhatsAppLink = linkId;
      
      // Preencher o formulário
      document.getElementById('whatsappLinkFormTitle').textContent = 'Editar Link';
      document.getElementById('whatsappEventType').value = linkData.eventType || '';
      document.getElementById('whatsappSchedule').value = linkData.schedule || '';
      document.getElementById('whatsappLink').value = linkData.link || '';
      document.getElementById('whatsappStatus').value = linkData.status || 'active';
      document.getElementById('whatsappDescription').value = linkData.description || '';
      
      // Abrir o modal
      openWhatsAppLinksModal();
      
      console.log('✅ Formulário preenchido e modal aberto');
    } else {
      console.log('❌ Link não encontrado');
      showNotification('Link não encontrado', 'error');
    }
    
  } catch (error) {
    console.error('❌ Erro ao carregar link para edição:', error);
    showNotification('Erro ao carregar link para edição', 'error');
  }
}

// Excluir link do WhatsApp
async function deleteWhatsAppLink(linkId) {
  if (!confirm('Tem certeza que deseja excluir este link?')) {
    return;
  }
  
  try {
    if (!window.firebaseDb) {
      showNotification('Firebase não inicializado ainda', 'error');
      return;
    }
    
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const linkRef = doc(window.firebaseDb, 'whatsapp_links', linkId);
    await deleteDoc(linkRef);
    
    showNotification('Link excluído com sucesso!', 'success');
    loadAdminWhatsAppLinks();
    
  } catch (error) {
    console.error('❌ Erro ao excluir link do WhatsApp:', error);
    showNotification('Erro ao excluir link do WhatsApp', 'error');
  }
}

// Cache para links do WhatsApp (com TTL)
let whatsappLinksCache = new Map();
const CACHE_TTL = 30000; // 30 segundos

// Função para obter link do WhatsApp dinamicamente
async function getWhatsAppLink(eventType, schedule = null) {
  try {
    console.log('🔍 getWhatsAppLink - EventType:', eventType, 'Schedule:', schedule);
    
    if (!window.firebaseDb) {
      console.warn('⚠️ Firebase não inicializado ainda');
      return 'https://chat.whatsapp.com/SEU_GRUPO_PADRAO';
    }
    
    // Verificar cache primeiro
    const cacheKey = `${eventType}_${schedule || 'general'}`;
    const cached = whatsappLinksCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('🔍 Link encontrado no cache:', cached.link);
      return cached.link;
    }
    
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const whatsappLinksRef = collection(window.firebaseDb, 'whatsapp_links');
    
    // Primeiro, tentar encontrar link específico para o horário
    if (schedule) {
      console.log('🔍 Buscando link específico para horário:', schedule);
      const specificQuery = query(
        whatsappLinksRef,
        where('eventType', '==', eventType),
        where('schedule', '==', schedule),
        where('status', '==', 'active')
      );
      const specificSnapshot = await getDocs(specificQuery);
      
      console.log('🔍 Resultado busca específica:', specificSnapshot.docs.length, 'documentos');
      
      if (!specificSnapshot.empty) {
        const link = specificSnapshot.docs[0].data().link;
        console.log('✅ Link específico encontrado:', link);
        
        // Salvar no cache
        whatsappLinksCache.set(cacheKey, {
          link: link,
          timestamp: Date.now()
        });
        
        return link;
      }
    }
    
    // Se não encontrou específico, buscar link geral para o evento
    console.log('🔍 Buscando link geral para evento:', eventType);
    const generalQuery = query(
      whatsappLinksRef,
      where('eventType', '==', eventType),
      where('schedule', '==', null),
      where('status', '==', 'active')
    );
    const generalSnapshot = await getDocs(generalQuery);
    
    console.log('🔍 Resultado busca geral:', generalSnapshot.docs.length, 'documentos');
    
    if (!generalSnapshot.empty) {
      const link = generalSnapshot.docs[0].data().link;
      console.log('✅ Link geral encontrado:', link);
      
      // Salvar no cache
      whatsappLinksCache.set(cacheKey, {
        link: link,
        timestamp: Date.now()
      });
      
      return link;
    }
    
    // Fallback para links padrão se não encontrar no Firestore
    const defaultLinks = {
      'xtreino-tokens': 'https://chat.whatsapp.com/SEU_GRUPO_TOKENS',
      'xtreino-gratuito': 'https://chat.whatsapp.com/SEU_GRUPO_GRATUITO',
      'modo-liga': 'https://chat.whatsapp.com/SEU_GRUPO_MODO_LIGA',
      'camp-freitas': 'https://chat.whatsapp.com/SEU_GRUPO_CAMP_FREITAS',
      'semanal-freitas': 'https://chat.whatsapp.com/SEU_GRUPO_SEMANAL',
      'treino': 'https://chat.whatsapp.com/SEU_GRUPO_TREINO'
    };
    
    const fallbackLink = defaultLinks[eventType] || 'https://chat.whatsapp.com/SEU_GRUPO_PADRAO';
    console.log('🔍 Usando link padrão:', fallbackLink);
    
    // Salvar fallback no cache também
    whatsappLinksCache.set(cacheKey, {
      link: fallbackLink,
      timestamp: Date.now()
    });
    
    return fallbackLink;
    
  } catch (error) {
    console.error('❌ Erro ao obter link do WhatsApp:', error);
    return 'https://chat.whatsapp.com/SEU_GRUPO_PADRAO';
  }
}

// Função para criar automaticamente todos os links do WhatsApp
async function createAllWhatsAppLinks() {
  try {
    if (!window.firebaseDb) {
      showNotification('Firebase não inicializado', 'error');
      return;
    }

    const { collection, addDoc, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    // Definir todos os eventos e seus horários
    const eventConfigs = {
      'xtreino-tokens': {
        name: 'XTreino Freitas',
        schedules: ['14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h'],
        defaultLink: 'https://chat.whatsapp.com/SEU_GRUPO_XTREINO_FREITAS'
      },
      'modo-liga': {
        name: 'XTreino Modo Liga',
        schedules: ['14h', '15h', '17h', '18h'],
        defaultLink: 'https://chat.whatsapp.com/SEU_GRUPO_MODO_LIGA'
      },
      'camp-freitas': {
        name: 'Campeonato Freitas Season⁴',
        schedules: ['20h', '21h', '22h', '23h'],
        defaultLink: 'https://chat.whatsapp.com/SEU_GRUPO_CAMP_FREITAS'
      },
      'semanal-freitas': {
        name: 'Semanal Freitas',
        schedules: ['20h', '21h', '22h'],
        defaultLink: 'https://chat.whatsapp.com/SEU_GRUPO_SEMANAL_FREITAS'
      }
    };

    const whatsappLinksRef = collection(window.firebaseDb, 'whatsapp_links');
    let createdCount = 0;
    let skippedCount = 0;

    for (const [eventType, config] of Object.entries(eventConfigs)) {
      // Criar link geral para o evento (sem horário específico)
      const generalQuery = query(
        whatsappLinksRef,
        where('eventType', '==', eventType),
        where('schedule', '==', null)
      );
      const generalSnapshot = await getDocs(generalQuery);
      
      if (generalSnapshot.empty) {
        await addDoc(whatsappLinksRef, {
          eventType: eventType,
          schedule: null,
          link: config.defaultLink,
          status: 'active',
          description: `Link geral para ${config.name}`,
          createdAt: new Date(),
          createdBy: 'system'
        });
        createdCount++;
        console.log(`✅ Link geral criado para ${config.name}`);
      } else {
        skippedCount++;
        console.log(`⏭️ Link geral já existe para ${config.name}`);
      }

      // Criar links específicos para cada horário
      for (const schedule of config.schedules) {
        const specificQuery = query(
          whatsappLinksRef,
          where('eventType', '==', eventType),
          where('schedule', '==', schedule)
        );
        const specificSnapshot = await getDocs(specificQuery);
        
        if (specificSnapshot.empty) {
          await addDoc(whatsappLinksRef, {
            eventType: eventType,
            schedule: schedule,
            link: config.defaultLink,
            status: 'active',
            description: `${config.name} - ${schedule}`,
            createdAt: new Date(),
            createdBy: 'system'
          });
          createdCount++;
          console.log(`✅ Link criado para ${config.name} - ${schedule}`);
        } else {
          skippedCount++;
          console.log(`⏭️ Link já existe para ${config.name} - ${schedule}`);
        }
      }
    }

    showNotification(`Links criados: ${createdCount} | Já existiam: ${skippedCount}`, 'success');
    
    // Recarregar a lista de links
    await loadAdminWhatsAppLinks();
    
  } catch (error) {
    console.error('Erro ao criar links automaticamente:', error);
    showNotification('Erro ao criar links automaticamente', 'error');
  }
}

// Variável para armazenar todos os links (para filtro)
let allWhatsAppLinks = [];

// Função para filtrar links do WhatsApp
function filterWhatsAppLinks() {
  const eventFilter = document.getElementById('whatsappEventFilter')?.value || '';
  const statusFilter = document.getElementById('whatsappStatusFilter')?.value || '';
  const searchFilter = document.getElementById('whatsappSearchFilter')?.value.toLowerCase() || '';
  
  console.log('🔍 Filtros aplicados:', { eventFilter, statusFilter, searchFilter });
  
  let filteredLinks = allWhatsAppLinks.filter(link => {
    // Filtro por evento
    if (eventFilter && link.eventType !== eventFilter) {
      return false;
    }
    
    // Filtro por status
    if (statusFilter && link.status !== statusFilter) {
      return false;
    }
    
    // Filtro por busca (busca em eventType, schedule, link, description)
    if (searchFilter) {
      const searchText = `${link.eventType} ${link.schedule || ''} ${link.link} ${link.description || ''}`.toLowerCase();
      if (!searchText.includes(searchFilter)) {
        return false;
      }
    }
    
    return true;
  });
  
  console.log('🔍 Links filtrados:', filteredLinks.length);
  
  // Renderizar apenas os links filtrados
  renderWhatsAppLinksTable(filteredLinks);
  renderWhatsAppLinksList(filteredLinks);
}

// Função para configurar os filtros
function setupWhatsAppFilters() {
  const eventFilter = document.getElementById('whatsappEventFilter');
  const statusFilter = document.getElementById('whatsappStatusFilter');
  const searchFilter = document.getElementById('whatsappSearchFilter');
  
  if (eventFilter) {
    eventFilter.addEventListener('change', filterWhatsAppLinks);
  }
  
  if (statusFilter) {
    statusFilter.addEventListener('change', filterWhatsAppLinks);
  }
  
  if (searchFilter) {
    searchFilter.addEventListener('input', filterWhatsAppLinks);
  }
}

// Expor funções globalmente
window.openWhatsAppLinksModal = openWhatsAppLinksModal;
window.closeWhatsAppLinksModal = closeWhatsAppLinksModal;
window.clearWhatsAppLinkForm = clearWhatsAppLinkForm;
window.saveWhatsAppLink = saveWhatsAppLink;
window.editWhatsAppLink = editWhatsAppLink;
window.deleteWhatsAppLink = deleteWhatsAppLink;
window.getWhatsAppLink = getWhatsAppLink;
window.createAllWhatsAppLinks = createAllWhatsAppLinks;
window.filterWhatsAppLinks = filterWhatsAppLinks;


