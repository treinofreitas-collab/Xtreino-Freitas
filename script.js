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

// --- Auth (novo) ---
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    return re.test(phone);
}

function validateAge(age) {
    const num = parseInt(age);
    return num >= 12 && num <= 100;
}

function formatPhone(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length <= 2) {
        input.value = value;
    } else if (value.length <= 6) {
        input.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length <= 10) {
        input.value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    } else {
        input.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
    }
}

function openLoginModal(){
    const m = document.getElementById('loginModal');
    if (m) m.classList.remove('hidden');
}
function closeLoginModal(){
    const m = document.getElementById('loginModal');
    if (m) m.classList.add('hidden');
}
function showAuthTab(tab){
    const tabs = ['login','register','reset'];
    tabs.forEach(t=>{
        const el = document.getElementById('auth'+t.charAt(0).toUpperCase()+t.slice(1));
        const btn = document.getElementById('tab'+t.charAt(0).toUpperCase()+t.slice(1));
        if (!el || !btn) return;
        if (t===tab){ el.classList.remove('hidden'); btn.classList.add('border-blue-matte'); btn.classList.remove('text-gray-500'); }
        else { el.classList.add('hidden'); btn.classList.remove('border-blue-matte'); btn.classList.add('text-gray-500'); }
    });
    const msg = document.getElementById('authMsg'); if (msg) msg.textContent='';
}

async function loginWithGoogle(){
    try{
        if (!window.firebaseReady){ throw new Error('Firebase não inicializado'); }
        const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        const provider = new GoogleAuthProvider();
        const res = await signInWithPopup(window.firebaseAuth, provider);
        onAuthLogged(res.user);
    }catch(e){ document.getElementById('authMsg').textContent = 'Erro no login Google.'; }
}

async function loginWithEmailPassword(){
    try{
        if (!window.firebaseReady){ throw new Error('Firebase não inicializado'); }
        const email = document.getElementById('authEmail').value.trim();
        const pass = document.getElementById('authPassword').value.trim();
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        const res = await signInWithEmailAndPassword(window.firebaseAuth, email, pass);
        onAuthLogged(res.user);
    }catch(e){ document.getElementById('authMsg').textContent = 'Email ou senha inválidos.'; }
}

async function registerWithEmailPassword(){
    try{
        if (!window.firebaseReady){ throw new Error('Firebase não inicializado'); }
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPassword').value.trim();
        const name = document.getElementById('regName').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const nickname = document.getElementById('regNickname').value.trim();
        const team = document.getElementById('regTeam').value.trim();
        const age = document.getElementById('regAge').value.trim();
        
        // Validações
        if (!email || !pass || !name || !phone || !nickname || !team || !age) {
            throw new Error('Todos os campos são obrigatórios');
        }
        if (!validateEmail(email)) {
            throw new Error('Email inválido');
        }
        if (pass.length < 6) {
            throw new Error('Senha deve ter pelo menos 6 caracteres');
        }
        if (!validatePhone(phone)) {
            throw new Error('Telefone inválido. Use o formato (11) 99999-9999');
        }
        if (!validateAge(age)) {
            throw new Error('Idade deve ser entre 12 e 100 anos');
        }
        
        const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        const cred = await createUserWithEmailAndPassword(window.firebaseAuth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        
        // salva perfil completo no Firestore
        try{
            if (window.firebaseReady){
                const { collection, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                const ref = doc(collection(window.firebaseDb,'users'), cred.user.uid);
                await setDoc(ref, { 
                    name, 
                    email, 
                    phone, 
                    nickname, 
                    teamName: team, 
                    age, 
                    role: 'Usuario',
                    level: 'Associado Treino',
                    tokens: 0,
                    createdAt: Date.now() 
                }, { merge: true });
            }
        }catch(e){ 
            console.error('Erro ao salvar perfil:', e);
        }
        onAuthLogged(cred.user);
    }catch(e){ document.getElementById('authMsg').textContent = e.message || 'Não foi possível criar a conta.'; }
}

async function sendPasswordReset(){
    try{
        if (!window.firebaseReady){ throw new Error('Firebase não inicializado'); }
        const email = document.getElementById('resetEmail').value.trim();
        const btn = document.getElementById('resetBtn');
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
            const alertEl = document.getElementById('resetAlert');
            if (alertEl){
                alertEl.className = 'text-sm px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200';
                alertEl.textContent = 'Digite um email válido.';
                alertEl.classList.remove('hidden');
            } else {
                document.getElementById('authMsg').textContent = 'Digite um email válido.';
            }
            return;
        }
        if (btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }
        const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        await sendPasswordResetEmail(window.firebaseAuth, email);
        const alertEl = document.getElementById('resetAlert');
        if (alertEl){
            alertEl.className = 'text-sm px-3 py-2 rounded-md bg-green-50 text-green-700 border border-green-200';
            alertEl.textContent = 'Pronto! Enviamos um link de recuperação para seu email.';
            alertEl.classList.remove('hidden');
        } else {
            document.getElementById('authMsg').textContent = 'Enviamos um link de recuperação para seu email. Confira também a caixa de spam.';
        }
        if (btn){ btn.textContent = 'Email enviado'; }
    }catch(e){
        const msg = (e && e.code) ? String(e.code).replace('auth/','').replaceAll('-',' ') : 'Erro ao enviar recuperação.';
        const alertEl = document.getElementById('resetAlert');
        if (alertEl){
            alertEl.className = 'text-sm px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200';
            alertEl.textContent = msg;
            alertEl.classList.remove('hidden');
        } else {
            document.getElementById('authMsg').textContent = msg;
        }
    } finally {
        const btn = document.getElementById('resetBtn');
        if (btn){ btn.disabled = false; }
    }
}

function onAuthLogged(user){
    // Atualiza lastLogin no Firestore
    try{
        if (window.firebaseReady && window.firebaseDb && user?.uid){
            (async()=>{
                const { doc, setDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                const ref = doc(collection(window.firebaseDb,'users'), user.uid);
                await setDoc(ref, { lastLogin: serverTimestamp(), email: user.email || null }, { merge: true });
            })().catch(()=>{});
        }
    }catch(_){/* noop */}
    try{
        const name = user?.displayName || user?.email || 'Usuário';
        const welcome = document.getElementById('accWelcome');
        if (welcome) welcome.textContent = `Bem-vindo, ${name}!`;
    }catch(_){ }
    window.isLoggedIn = true;
    toggleAccountButtons(true);
    closeLoginModal();
    updateAdminLinkVisibility();
    // registra lastLogin
    try{
        if (window.firebaseReady && window.firebaseAuth?.currentUser){
            import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
                .then(({ doc, setDoc, collection }) => {
                    const uid = window.firebaseAuth.currentUser.uid;
                    const ref = doc(collection(window.firebaseDb,'users'), uid);
                    return setDoc(ref, { lastLogin: Date.now() }, { merge:true });
                }).catch(()=>{});
        }
    }catch(_){ }
    // Redireciono para o admin se foi solicitado e o usuário tiver permissão
    if (window.postLoginRedirect === 'admin') {
        setTimeout(async () => {
            try {
                const uid = user?.uid || window.firebaseAuth?.currentUser?.uid;
                if (uid) {
                    await loadUserProfile(uid);
                    const role = (window.currentUserProfile?.role || '').toLowerCase();
                    if (['ceo','gerente','vendedor','design','socio'].includes(role)) {
                        window.postLoginRedirect = null;
                        window.location.href = 'admin.html';
                        return;
                    }
                }
                showErrorToast('Acesso ao painel restrito (CEO, Gerente, Vendedor, Design ou Sócio).', 'Acesso Negado');
                window.postLoginRedirect = null;
            } catch (_) { window.postLoginRedirect = null; }
        }, 100);
    }
    // Redireciono para a aba de Meus Tokens se foi solicitado a partir do agendamento
    if (window.postLoginRedirect === 'myTokens'){
        window.postLoginRedirect = null;
        setTimeout(()=>{ window.location.href = 'client.html?tab=myTokens'; }, 100);
        return;
    }
    
    // Sincronização automática removida para evitar reset do saldo
    // setTimeout(async () => {
    //     try {
    //         // Só sincronizar se não há perfil local
    //         if (!window.currentUserProfile || !window.currentUserProfile.tokens) {
    //             await syncUserTokens();
    //         }
    //     } catch (error) {
    //         console.error('Erro ao sincronizar tokens:', error);
    //     }
    // }, 1000);
    
    // Não abre automaticamente a área do cliente - só quando clicar em MINHA CONTA
}

function toggleAccountButtons(isLogged){
    const loginDesk = document.getElementById('loginBtnDesktop');
    const accountSectionDesktop = document.getElementById('accountSectionDesktop');
    const loginMob = document.getElementById('loginBtnMobile');
    const profileAvatarMobile = document.getElementById('profileAvatarMobile');
    const accountBtnMobileExpanded = document.getElementById('accountBtnMobileExpanded');
    
    // Desktop
    if (loginDesk && accountSectionDesktop){ 
        loginDesk.classList.toggle('hidden', isLogged); 
        accountSectionDesktop.classList.toggle('hidden', !isLogged); 
    }
    
    // Mobile - Avatar sempre visível quando logado, botão CONTA no menu expandido
    if (loginMob && profileAvatarMobile){ 
        loginMob.classList.toggle('hidden', isLogged); 
        profileAvatarMobile.classList.toggle('hidden', !isLogged); 
    }
    
    // Botão CONTA no menu expandido
    if (accountBtnMobileExpanded) {
        accountBtnMobileExpanded.classList.toggle('hidden', !isLogged);
    }
    
    updateHeaderTokenBadges();
}

// Garantir estado inicial correto dos botões ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    try{
        const loginDesk = document.getElementById('loginBtnDesktop');
        const accDesk = document.getElementById('accountBtnDesktop');
        const loginMob = document.getElementById('loginBtnMobile');
        const accMob = document.getElementById('accountBtnMobile');
        if (accDesk) accDesk.classList.add('hidden');
        if (accMob) accMob.classList.add('hidden');
        if (profileAvatarMobile) profileAvatarMobile.classList.add('hidden');
        if (loginDesk) loginDesk.classList.remove('hidden');
        if (loginMob) loginMob.classList.remove('hidden');
        updateHeaderTokenBadges();
    }catch(_){ /* noop */ }
});

// Verificar se usuário é admin autorizado
async function checkAdminAccess() {
    console.log('🔍 Verificando acesso admin...');
    
    if (!window.isLoggedIn || !window.firebaseAuth?.currentUser) {
        console.log('❌ Usuário não logado');
        return false;
    }
    
    const user = window.firebaseAuth.currentUser;
    const authorizedEmails = ['cleitondouglass@gmail.com', 'cleitondouglass123@hotmail.com', 'gilmariofreitas378@gmail.com', 'gilmariofreitas387@gmail.com'];
    
    console.log('📧 Email do usuário:', user.email);
    
    // Verificar role no Firestore primeiro
    try {
        const uid = user.uid;
        console.log('🔍 UID do usuário:', uid);
        console.log('🔍 Firebase DB disponível:', !!window.firebaseDb);
        
        const { doc, getDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDoc(doc(collection(window.firebaseDb,'users'), uid));
        if (snap.exists()) {
            const userData = snap.data();
            const role = (userData.role || '').toLowerCase();
            console.log('🎭 Role encontrado:', userData.role, '-> normalizado:', role);
            console.log('📊 Dados completos do usuário:', userData);
            
            // Para design e socio, permitir qualquer email (incluindo variações)
            const designVariations = ['design', 'designer', 'desgin', 'desgine'];
            const socioVariations = ['socio', 'sócio'];
            
            console.log('🔍 Verificando cargo:', role);
            console.log('🔍 É design?', designVariations.includes(role));
            console.log('🔍 É socio?', socioVariations.includes(role));
            
            // Verificação adicional para socio com diferentes variações
            const isSocio = role === 'socio' || role === 'sócio' || role.includes('socio') || role.includes('sócio');
            console.log('🔍 É socio (verificação adicional)?', isSocio);
            
            if (designVariations.includes(role) || socioVariations.includes(role) || isSocio) {
                console.log('✅ Acesso liberado para Design/Sócio (cargo:', role, ')');
                return true;
            }
            
            console.log('❌ Cargo não autorizado:', role, '- Variações de design:', designVariations, '- Variações de socio:', socioVariations);
            
            // Para outros cargos, verificar email na whitelist
            if (['admin', 'ceo', 'gerente', 'vendedor'].includes(role)) {
                if (!authorizedEmails.includes(user.email.toLowerCase())) {
                    console.log('❌ Email não autorizado:', user.email);
                    return false;
                }
                console.log('✅ Email autorizado para', role);
                return true;
            }
        } else {
            console.log('❌ Documento de usuário não encontrado no Firestore');
        }
    } catch (error) {
        console.error('❌ Erro ao verificar acesso admin:', error);
    }
    
    console.log('❌ Retornando false - nenhuma condição de acesso foi atendida');
    return false;
}

// Mostrar/esconder link ADMIN baseado no acesso
async function updateAdminLinkVisibility() {
    console.log('🔄 Atualizando visibilidade do link ADMIN...');
    const adminLink = document.getElementById('adminLink');
    const adminLinkMobile = document.getElementById('adminLinkMobile');
    if (!adminLink && !adminLinkMobile) {
        console.log('❌ Elementos adminLink/adminLinkMobile não encontrados');
        return;
    }
    
    console.log('👤 Usuário logado:', window.isLoggedIn);
    console.log('🔥 Firebase Auth:', !!window.firebaseAuth?.currentUser);
    
    const hasAccess = await checkAdminAccess();
    console.log('🔐 Has access:', hasAccess);
    
    const toggle = (el, show) => {
        if (!el) return;
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    };
    toggle(adminLink, hasAccess);
    toggle(adminLinkMobile, hasAccess);
    if (adminLinkMobileExpanded) {
        toggle(adminLinkMobileExpanded, hasAccess);
    }
    console.log(hasAccess ? '✅ Link ADMIN mostrado' : '❌ Link ADMIN escondido');
}

function requestAdminAccess(){
    // Se já estiver logado, valida papel; senão, abre modal de login e marca redirecionamento
    if (!window.isLoggedIn) {
        window.postLoginRedirect = 'admin';
        openLoginModal();
        return;
    }
    (async () => {
        const hasAccess = await checkAdminAccess();
        if (hasAccess) {
            window.location.href = 'admin.html';
        } else {
            showErrorToast('Acesso ao painel restrito. Apenas administradores autorizados.', 'Acesso Negado');
        }
    })();
}

// Modal de conta removido - agora redireciona para client.html

async function logout(){
    try{
        if (window.firebaseReady){
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
            await signOut(window.firebaseAuth);
        }
    }catch(_){ }
    window.currentUserProfile = null;
    window.isLoggedIn = false;
    toggleAccountButtons(false);
    // Modal removido
}

// Funções do modal de conta removidas - agora usa client.html

// Função removida - agora usa client.html

// Função removida - agora usa client.html


// Todas as funções do modal de conta removidas - agora usa client.html
// Mobile menu toggle - Removido, menu agora é sempre visível
// Função mantida para compatibilidade mas não faz nada
function toggleMobileMenu() {
    // Menu mobile agora é sempre visível, não precisa de toggle
}

// Smooth scroll to sections
function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({
        behavior: 'smooth'
    });
}

// Redireciona para a compra/aba Meus Tokens a partir do modal de reserva
function goToTokensFromSchedule(){
    // Se não estiver logado, abre login e, após login, direciona para client.html na aba Meus Tokens
    if (!window.isLoggedIn) {
        window.postLoginRedirect = 'myTokens';
        openLoginModal();
        return;
    }
    // Se já estiver logado, vai direto para a aba Meus Tokens
    window.location.href = 'client.html?tab=myTokens';
}

// Função para abrir modal de compra de tokens (compatibilidade)
function openTokensPurchaseModal() {
    // Redirecionar para a área do cliente na aba de tokens
    if (!window.isLoggedIn) {
        window.postLoginRedirect = 'myTokens';
        openLoginModal();
        return;
    }
    window.location.href = 'client.html?tab=myTokens';
}

// [login removed]

// [login removed]

// Email/senha
// [login removed]

// [login removed]

function showRegisterForm() {
    alert('Formulário de cadastro será implementado. Esta é uma demonstração da interface.');
}

// Alterna botões Login/Minha Conta conforme estado
function refreshAuthButtons(){ /* removed */ }

// Abrir modal de cadastro direto (atalho)
function openRegisterModal(){ /* removed */ }

// Submissão de cadastro: salva no perfil e persiste
async function submitRegister(){ /* removed */ }

// Inicializa header conforme sessão prévia
window.addEventListener('load', () => { 
    try{ 
        initShopCartHook(); 
        // Aguardar um pouco para garantir que o Firebase esteja carregado
        setTimeout(() => {
            updateAdminLinkVisibility();
        }, 1000);
    }catch(_){ } 
});

// ---------------- Área de Associados: cargos, níveis, permissões e tokens ----------------
// Configuração centralizada acessível via window.AssocConfig
window.AssocConfig = {
    roles: {
        GERENTE: 'Gerente',
        CEO: 'Ceo',
        STAFF: 'Staff',
        VENDEDOR: 'Vendedor'
    },
    levels: {},
    // Permissões por cargo
    permissionsByRole: {
        Gerente: {
            redeemTokens: true,
            purchaseItems: true,
            accessExclusive: true,
            manageSalesFlow: false
        },
        Ceo: {
            redeemTokens: true,
            purchaseItems: true,
            accessExclusive: true,
            manageSalesFlow: true
        },
        Staff: {
            redeemTokens: true,
            purchaseItems: true,
            accessExclusive: true,
            manageSalesFlow: false
        },
        Vendedor: {
            redeemTokens: false,
            purchaseItems: false,
            accessExclusive: false,
            manageSalesFlow: false,
            salesAndChat: true
        }
    },
    // Regras de valor dos tokens (BRL -> tipo de vaga)
    tokenPricingBRL: [
        { amount: 1.00, benefit: '1 vaga XTreino Freitas', key: 'xtreino-tokens' },
        { amount: 3.00, benefit: '1 vaga XTreino Modo Liga', key: 'modo-liga' },
        { amount: 3.50, benefit: '1 vaga Semanal Freitas', key: 'semanal-freitas' },
        { amount: 5.00, benefit: '1 vaga Campeonato Freitas', key: 'camp-freitas' }
    ]
};

// Estado local do usuário autenticado (perfil minimalista)
window.currentUserProfile = null;
window.isLoggedIn = false;

// Verifica se há usuário logado ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
    // Aguarda o Firebase estar pronto
    const checkFirebaseReady = () => {
        if (window.firebaseReady) {
            checkAuthState();
            // Tenta sincronizar dados offline quando Firebase estiver pronto
            syncOfflineData();
            // Trata retorno do Mercado Pago e atualiza vagas
            try{
                const sp = new URLSearchParams(location.search);
                const mpStatus = sp.get('mp_status');
                const preferenceId = sp.get('preference-id');
                console.log('MP Return Check:', { mpStatus, preferenceId, url: window.location.href });
                
                // Só verificar pagamentos se há evidência real de uma tentativa de pagamento
                const hasPaymentEvidence = mpStatus || preferenceId || sessionStorage.getItem('lastExternalRef') || sessionStorage.getItem('lastRegId');
                
                if (!mpStatus && preferenceId) {
                    console.log('No mp_status but has preference-id, checking payment status...');
                    // Mostrar modal de processamento enquanto verifica
                    openPaymentConfirmModal('Pagamento em processamento', 'Estamos aguardando a confirmação do PIX. Assim que aprovado, avisaremos aqui.');
                    checkPaymentStatus(preferenceId);
                } else if (!mpStatus && hasPaymentEvidence) {
                    // Se não tem mp_status mas há evidência de pagamento, tentar usar external_reference salvo
                    const externalRef = sessionStorage.getItem('lastExternalRef');
                    if (externalRef) {
                        console.log('No mp_status or preference-id, checking with external_reference...');
                        // Mostrar modal de processamento enquanto verifica
                        openPaymentConfirmModal('Pagamento em processamento', 'Estamos aguardando a confirmação do PIX. Assim que aprovado, avisaremos aqui.');
                        checkPaymentStatus(externalRef);
                    }
                } else if (!hasPaymentEvidence) {
                    console.log('No payment evidence found - user is just visiting the site normally');
                    // Limpar dados antigos de pagamento se existirem
                    sessionStorage.removeItem('lastExternalRef');
                    sessionStorage.removeItem('lastRegId');
                    sessionStorage.removeItem('lastRegInfo');
                    // Não fazer nada mais - usuário está apenas visitando o site
                    return;
                } else if (mpStatus === 'success') {
                    if (mpStatus === 'success') {
                        console.log('Payment successful, processing...');
                        const regId = sessionStorage.getItem('lastRegId');
                        console.log('RegId from sessionStorage:', regId);
                        if (regId) {
                            import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
                                .then(({ doc, setDoc, getDoc, collection }) => {
                                    const ref = doc(collection(window.firebaseDb,'registrations'), regId);
                                    return setDoc(ref, { status:'paid' }, { merge:true })
                                      .then(()=> getDoc(ref))
                                      .then(snap=>{ const d = snap.exists()? snap.data():{}; return d.groupLink || null; });
                                }).then((groupLink)=>{
                                    console.log('Registration updated, showing modal');
                                    openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.', groupLink);
                                }).catch((e)=>{
                                    console.error('Error updating registration:', e);
                                    openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.');
                                });
                        } else {
                            console.log('No regId, creating local order');
                            // Fallback: cria registro local para exibir na aba pedidos
                            try{
                                const info = JSON.parse(sessionStorage.getItem('lastRegInfo')||'{}');
                                const orders = JSON.parse(localStorage.getItem('localOrders')||'[]');
                                orders.unshift({ title: info.title||'Reserva', amount: info.price||0, status:'paid', date: new Date().toISOString() });
                                localStorage.setItem('localOrders', JSON.stringify(orders));
                                console.log('Local order created:', orders[0]);
                            }catch(e){ console.error('Error creating local order:', e); }
                            openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.');
                        }
                    }
                    history.replaceState({}, document.title, location.pathname);
                }
            }catch(_){ }
        } else {
            setTimeout(checkFirebaseReady, 100);
        }
    };
    checkFirebaseReady();
});


// Função para sincronizar dados offline quando a conexão voltar
async function syncOfflineData() {
    try {
        if (!window.firebaseAuth?.currentUser) return;
        
        const uid = window.firebaseAuth.currentUser.uid;
        const localProfile = localStorage.getItem(`userProfile_${uid}`);
        
        if (localProfile && window.firebaseReady) {
            const profile = JSON.parse(localProfile);
            const { doc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'users'), uid);
            await setDoc(ref, profile, { merge: true });
            console.log('Dados offline sincronizados com Firestore');
        }
    } catch (e) {
        console.log('Erro ao sincronizar dados offline:', e);
    }
}

async function checkAuthState() {
    try {
        if (window.firebaseReady && window.firebaseAuth) {
            const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
            onAuthStateChanged(window.firebaseAuth, (user) => {
                console.log('Auth state changed:', user ? 'Logged in' : 'Logged out');
                if (user) {
                    // Usuário está logado
                    window.isLoggedIn = true;
                    toggleAccountButtons(true);
                    // Carrega perfil do usuário
                    loadUserProfile(user.uid);
                    updateAdminLinkVisibility();
                } else {
                    // Usuário não está logado
                    window.isLoggedIn = false;
                    window.currentUserProfile = null;
                    toggleAccountButtons(false);
                    updateAdminLinkVisibility();
                }
            });
        }
    } catch (e) {
        console.error('Erro ao verificar estado de autenticação:', e);
    }
}

async function loadUserProfile(uid) {
    try {
        // Sempre priorizar Firestore (desabilitado uso de localStorage)
        if (window.firebaseReady) {
            const { doc, getDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'users'), uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                window.currentUserProfile = snap.data();
                console.log('Perfil carregado do Firestore');
            } else {
                // Cria perfil básico se não existir
                window.currentUserProfile = {
                    uid: uid,
                    email: window.firebaseAuth.currentUser.email,
                    name: window.firebaseAuth.currentUser.displayName || 'Usuário',
                    tokens: 0,
                    role: 'Vendedor',
                    level: 'Associado Treino'
                };
                console.log('Perfil básico criado (Firebase pronto, sem doc)');
            }
        } else {
            // Fallback: cria perfil básico se Firebase não estiver pronto (sem localStorage)
            window.currentUserProfile = {
                uid: uid,
                email: window.firebaseAuth.currentUser.email,
                name: window.firebaseAuth.currentUser.displayName || 'Usuário',
                tokens: 0,
                role: 'Usuario',
                level: 'Associado Treino'
            };
            console.log('Perfil básico criado (Firebase offline, em memória)');
        }
    } catch (e) {
        console.error('Erro ao carregar perfil:', e);
        // Fallback final: perfil básico
        window.currentUserProfile = {
            uid: uid,
            email: window.firebaseAuth.currentUser.email,
            name: window.firebaseAuth.currentUser.displayName || 'Usuário',
            tokens: 0,
            role: 'Usuario',
            level: 'Associado Treino'
        };
    }
    updateHeaderTokenBadges();
}

// Atualiza o badge de tokens no header (desktop e mobile)
function updateHeaderTokenBadges(){
    try{
        const isLogged = !!(window.isLoggedIn && window.currentUserProfile);
        const bal = isLogged ? Math.round(getTokenBalance()) : 0;
        const d = document.getElementById('tokenBadgeDesktop');
        const m = document.getElementById('tokenBadgeMobile');
        if (d) { d.classList.toggle('hidden', !isLogged); d.textContent = `💎 ${bal}`; }
        if (m) { m.classList.toggle('hidden', !isLogged); m.textContent = `💎 ${bal}`; }
        
        // Atualizar foto de perfil no header
        updateHeaderProfilePhoto();
    }catch(_){ }
}

// Atualiza a foto de perfil no header
function updateHeaderProfilePhoto() {
    try {
        const isLogged = !!(window.isLoggedIn && window.currentUserProfile);
        const profile = window.currentUserProfile;
        
        if (!isLogged || !profile) {
            // Esconder seções de conta
            const accountSectionDesktop = document.getElementById('accountSectionDesktop');
            const profileAvatarMobile = document.getElementById('profileAvatarMobile');
            if (accountSectionDesktop) accountSectionDesktop.classList.add('hidden');
            if (profileAvatarMobile) profileAvatarMobile.classList.add('hidden');
            return;
        }
        
        // Mostrar seções de conta (botão + foto desktop, apenas avatar mobile)
        const accountSectionDesktop = document.getElementById('accountSectionDesktop');
        const profileAvatarMobile = document.getElementById('profileAvatarMobile');
        if (accountSectionDesktop) accountSectionDesktop.classList.remove('hidden');
        if (profileAvatarMobile) profileAvatarMobile.classList.remove('hidden');
        
        // Garantir que o botão desktop também está visível
        const accountBtnDesktop = document.getElementById('accountBtnDesktop');
        if (accountBtnDesktop) accountBtnDesktop.classList.remove('hidden');
        
        // Obter nome para iniciais
        const name = profile.name || window.firebaseAuth?.currentUser?.displayName || window.firebaseAuth?.currentUser?.email?.split('@')[0] || 'Usuário';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
        
        // Obter foto de perfil
        const photoURL = profile.photoURL || profile.photoUrl || '';
        
        // Desktop
        const avatarImageDesktop = document.getElementById('profileAvatarImageDesktop');
        const avatarInitialsDesktop = document.getElementById('profileAvatarInitialsDesktop');
        if (avatarImageDesktop && avatarInitialsDesktop) {
            if (photoURL && photoURL.trim() !== '') {
                avatarImageDesktop.src = photoURL;
                avatarImageDesktop.onload = function() {
                    avatarImageDesktop.classList.remove('hidden');
                    avatarInitialsDesktop.classList.add('hidden');
                };
                avatarImageDesktop.onerror = function() {
                    // Se a imagem falhar ao carregar, mostrar iniciais
                    avatarInitialsDesktop.textContent = initials;
                    avatarImageDesktop.classList.add('hidden');
                    avatarInitialsDesktop.classList.remove('hidden');
                };
                // Se já estiver carregada
                if (avatarImageDesktop.complete && avatarImageDesktop.naturalHeight !== 0) {
                    avatarImageDesktop.classList.remove('hidden');
                    avatarInitialsDesktop.classList.add('hidden');
                }
            } else {
                avatarInitialsDesktop.textContent = initials;
                avatarImageDesktop.classList.add('hidden');
                avatarInitialsDesktop.classList.remove('hidden');
            }
        }
        
        // Mobile
        const avatarImageMobile = document.getElementById('profileAvatarImageMobile');
        const avatarInitialsMobile = document.getElementById('profileAvatarInitialsMobile');
        if (avatarImageMobile && avatarInitialsMobile) {
            if (photoURL && photoURL.trim() !== '') {
                avatarImageMobile.src = photoURL;
                avatarImageMobile.onload = function() {
                    avatarImageMobile.classList.remove('hidden');
                    avatarInitialsMobile.classList.add('hidden');
                };
                avatarImageMobile.onerror = function() {
                    // Se a imagem falhar ao carregar, mostrar iniciais
                    avatarInitialsMobile.textContent = initials;
                    avatarImageMobile.classList.add('hidden');
                    avatarInitialsMobile.classList.remove('hidden');
                };
                // Se já estiver carregada
                if (avatarImageMobile.complete && avatarImageMobile.naturalHeight !== 0) {
                    avatarImageMobile.classList.remove('hidden');
                    avatarInitialsMobile.classList.add('hidden');
                }
            } else {
                avatarInitialsMobile.textContent = initials;
                avatarImageMobile.classList.add('hidden');
                avatarInitialsMobile.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar foto de perfil no header:', error);
    }
}

// Helpers de permissão
function hasPermission(permission) {
    const profile = window.currentUserProfile;
    if (!profile) return false;
    const role = profile.role || 'Vendedor';
    const perms = window.AssocConfig.permissionsByRole[role] || {};
    return !!perms[permission];
}

function updateUIForPermissions() {
    const isAdmin = hasPermission('admin_tokens');
    const adminPanel = document.getElementById('accTokensAdmin');
    const historyPanel = document.getElementById('accTokensHistory');
    
    if (adminPanel) {
        adminPanel.classList.toggle('hidden', !isAdmin);
    }
    if (historyPanel) {
        historyPanel.classList.toggle('hidden', !isAdmin);
        if (isAdmin) {
            loadTokenHistory();
        }
    }
    
    // Outras permissões podem ser aplicadas aqui
    const canViewSales = hasPermission('view_sales');
    const salesElements = document.querySelectorAll('[data-permission="view_sales"]');
    salesElements.forEach(el => el.style.display = canViewSales ? 'block' : 'none');
}

function loadTokenHistory() {
    const container = document.getElementById('tokenHistoryList');
    if (!container) return;
    
    if (!window.tokenHistory || window.tokenHistory.length === 0) {
        container.innerHTML = '<div class="text-gray-400">Nenhum histórico encontrado</div>';
        return;
    }
    
    const history = window.tokenHistory.slice(-10).reverse(); // Últimos 10, mais recentes primeiro
    container.innerHTML = history.map(log => {
        const date = new Date(log.timestamp).toLocaleString('pt-BR');
        const action = log.action === 'add' ? 'Adicionado' : 'Removido';
        const color = log.action === 'add' ? 'text-green-600' : 'text-red-600';
        return `<div class="flex justify-between ${color}">
            <span>${action} ${log.amount} token(s)</span>
            <span class="text-gray-400">${date}</span>
        </div>`;
    }).join('');
}

// Helpers de token (saldo simples em perfil.tokens, número decimal em BRL)
function getTokenBalance() {
    const balance = Number(window.currentUserProfile?.tokens || 0);
    console.log('🔍 Token balance check:', { 
        profile: window.currentUserProfile, 
        tokens: window.currentUserProfile?.tokens, 
        balance 
    });
    return balance;
}
function canSpendTokens(amountBRL) {
    const balance = getTokenBalance();
    const amount = Number(amountBRL || 0);
    const canSpend = balance >= amount;
    console.log('🔍 Can spend tokens check:', { balance, amount, canSpend });
    return canSpend;
}
async function spendTokens(amountBRL) {
    const amt = Number(amountBRL || 0);
    if (!canSpendTokens(amt)) return false;
    
    const newBalance = Number((getTokenBalance() - amt).toFixed(2));
    window.currentUserProfile.tokens = newBalance;
    
    console.log(`🔍 Spending ${amt} tokens. New balance: ${newBalance}`);
    
    // Persistir no Firestore (sem localStorage)
    await persistUserProfile(window.currentUserProfile);
    
    // Atualizar interface se estiver na área do cliente
    if (window.location.pathname.includes('client.html')) {
        // Recarregar dados do cliente
        if (typeof loadMyTokens === 'function') {
            await loadMyTokens();
        }
        if (typeof loadTokenUsageHistory === 'function') {
            await loadTokenUsageHistory();
        }
    }
    
    // Atualizar interface na página principal
    renderClientArea();
    updateHeaderTokenBadges();
    
    // Re-sync do Firestore para refletir saldo final
    await syncUserTokens();
    
    return true;
}
function grantTokens(amountBRL) {
    const amt = Number(amountBRL || 0);
    window.currentUserProfile = window.currentUserProfile || {};
    window.currentUserProfile.tokens = Number(((window.currentUserProfile.tokens || 0) + amt).toFixed(2));
    persistUserProfile(window.currentUserProfile);
}

// Função para sincronizar tokens do usuário
async function syncUserTokens() {
    try {
        if (!window.firebaseAuth || !window.firebaseAuth.currentUser) return;
        
        const { doc, getDoc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const userRef = doc(collection(window.firebaseDb, 'users'), window.firebaseAuth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentTokens = userData.tokens || 0;
            
            // Só atualizar se o perfil local não existe ou se os tokens do Firestore são significativamente maiores
            // (isso evita sobrescrever tokens que foram gastos recentemente)
            window.currentUserProfile = window.currentUserProfile || {};
            const localTokens = window.currentUserProfile.tokens || 0;
            
            if (localTokens === 0 || currentTokens > localTokens + 5) {
                window.currentUserProfile.tokens = currentTokens;
                console.log('✅ Tokens synced from Firestore:', currentTokens);
            } else {
                console.log('🔍 Local tokens are more recent, keeping:', localTokens);
            }
            
            // Dar token inicial apenas se o usuário realmente não tem tokens (não é 0, mas undefined/null)
            if (window.currentUserProfile.tokens === undefined || window.currentUserProfile.tokens === null) {
                await setDoc(userRef, { tokens: 1 }, { merge: true });
                window.currentUserProfile.tokens = 1;
                console.log('🎁 Initial token given to user with undefined tokens');
            }
            
            // Atualizar localStorage também
            localStorage.setItem('assoc_profile', JSON.stringify(window.currentUserProfile));
            
            console.log('✅ Final token balance:', window.currentUserProfile.tokens);
            
            // Atualizar interface
            renderClientArea();
            updateHeaderTokenBadges();
        }
    } catch (error) {
        console.error('❌ Error syncing tokens:', error);
    }
}

// Persistência de perfil: Firestore quando possível; fallback localStorage
async function ensureUserProfile(user) {
    const baseProfile = {
        uid: user?.uid || null,
        name: user?.displayName || '',
        email: user?.email || '',
        phone: '',
        nickname: '',
        teamName: '',
        orgName: '',
        age: '',
        role: window.AssocConfig.roles.VENDEDOR, // padrão mínimo
        level: undefined,
        tokens: 0
    };
    try {
        const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        const isNetlify = /netlify\.app$/i.test(location.hostname);
        // Sempre tentar Firestore quando disponível e com usuário logado
        if (window.firebaseReady && user?.uid){
            const { doc, getDoc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'users'), user.uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                await setDoc(ref, baseProfile);
                window.currentUserProfile = baseProfile;
                console.log('✅ Perfil criado no Firestore');
            } else {
                const data = snap.data();
                window.currentUserProfile = { ...baseProfile, ...data };
                console.log('✅ Perfil carregado do Firestore:', { tokens: data.tokens });
            }
        } else {
            // Sem Firebase: usa somente base em memória (não persiste em localStorage)
                window.currentUserProfile = baseProfile;
            console.log('⚠️ Firebase indisponível — usando perfil em memória.');
        }
        
        // Sincronização automática removida para evitar reset do saldo
        // if (window.firebaseReady && !isLocal && !isNetlify && user?.uid) {
        //     await syncUserTokens();
        // }
    } catch (err) {
        console.warn('Perfil: erro ao carregar, usando perfil em memória.', err);
        window.currentUserProfile = baseProfile;
    }
}

async function persistUserProfile(profile){
    try {
        console.log('🔍 Persisting profile:', { firebaseReady: window.firebaseReady, hasUid: !!profile?.uid });

        // Garantir UID presente
        if (!profile.uid && window.firebaseAuth && window.firebaseAuth.currentUser) {
            profile.uid = window.firebaseAuth.currentUser.uid;
        }
        // Normalizar tokens
        if (profile.tokens === undefined || profile.tokens === null) {
            profile.tokens = 0;
        }

        if (window.firebaseReady && profile?.uid){
            const { doc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'users'), profile.uid);
            await setDoc(ref, profile, { merge: true });
            console.log('✅ Profile saved to Firestore');
        } else {
            console.warn('⚠️ Firebase unavailable when persisting profile; keeping in memory only');
        }
    } catch(error) {
        console.error('❌ Error persisting profile:', error);
    }
}

// Client Area Functions
function openClientArea() {
    document.getElementById('clientAreaModal').classList.remove('hidden');
    try { renderClientArea(); } catch(_) {}
    if (window.innerWidth <= 767) document.body.classList.add('modal-open-mobile');
}

function closeClientArea() { /* removed - client area não existe mais */ }

// Renderiza informações dinâmicas do cliente (nome, tokens, etc.)
function renderClientArea(){
    const p = window.currentUserProfile || {};
    const nameEl = document.querySelector('#clientAreaModal p.text-gray-300');
    if (nameEl) nameEl.textContent = `Bem-vindo, ${p.name || p.email || 'Usuário'}!`;
    // Overview: cards numéricos (usa saldo de tokens real)
    const overviewTokens = document.querySelector('#overviewTab .bg-blue-matte.bg-opacity-20:nth-child(3) h3');
    if (overviewTokens) overviewTokens.textContent = String(Math.round(getTokenBalance()));
    // Tokens Tab: saldo
    const tokensTab = document.querySelector('#tokensTab .bg-blue-matte.bg-opacity-20 h3');
    if (tokensTab) tokensTab.textContent = String(Math.round(getTokenBalance()));
    // Habilitar/Desabilitar botão de tokens no card
    const assocBtn = document.getElementById('assocTokensBtn');
    if (assocBtn){
        const hasTokens = p && p.tokens && p.tokens > 0;
        assocBtn.disabled = !hasTokens;
        assocBtn.classList.toggle('opacity-60', !hasTokens);
        assocBtn.textContent = hasTokens ? 'USAR 1 TOKEN' : 'COMPRAR TOKENS';
        
        // Adicionar evento de clique se não existir
        if (!assocBtn.hasAttribute('data-listener-added')) {
            assocBtn.addEventListener('click', function() {
                if (hasTokens) {
                    openScheduleModal('xtreino-tokens');
                } else {
                    // Redirecionar para área do cliente para comprar tokens
                    window.location.href = 'client.html?tab=myTokens';
                }
            });
            assocBtn.setAttribute('data-listener-added', 'true');
        }
    }
}

function showClientTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.client-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.client-tab').forEach(btn => {
        btn.classList.remove('active', 'border-blue-matte', 'text-blue-matte');
        btn.classList.add('border-transparent', 'text-gray-400');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    
    // Add active class to clicked button
    event.target.classList.add('active', 'border-blue-matte', 'text-blue-matte');
    event.target.classList.remove('border-transparent', 'text-gray-400');
    // atualizar dados dinâmicos ao trocar de aba
    if (tabName === 'overview' || tabName === 'tokens') {
        try { renderClientArea(); } catch(_) {}
    } else if (tabName === 'profile') {
        try { loadProfileData(); } catch(_) {}
    } else if (tabName === 'orders') {
        try { loadOrders(); } catch(_) {}
    } else if (tabName === 'products') {
        try { loadProducts(); } catch(_) {}
    }
}

function downloadFile(fileType) {
    // Direciona o usuário para a área de cliente, onde os downloads reais
    // consultam os pedidos e liberam arquivos via Netlify Function.
    try {
        const url = new URL('client.html', window.location.origin);
        url.searchParams.set('tab', 'products');
        window.location.href = url.toString();
    } catch (_) {
        window.location.href = 'client.html?tab=products';
    }
}

function viewOnline(contentType) {
    alert('Abrindo conteúdo online...\n\nEm uma implementação real, isso abriria uma nova aba com o conteúdo exclusivo.');
}

function scheduleTraining(trainingType) {
    const trainings = {
        'aim': { label: 'Aim Training', cost: 1.00 },
        'strategy': { label: 'Estratégia', cost: 2.00 },
        'mental': { label: 'Mentalidade', cost: 1.00 }
    };
    const t = trainings[trainingType];
    if (!t) return;
    if (!canSpendTokens(t.cost)){
        showErrorToast(`Saldo insuficiente. Você precisa de ${t.cost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`, 'Saldo Insuficiente');
        return;
    }
    if (confirm(`Confirmar uso de ${t.cost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens para ${t.label}?`)){
        spendTokens(t.cost);
        renderClientArea();
        showSuccessToast('Token resgatado! Nossa equipe entrará em contato para agendar.', 'Sucesso');
    }
}

function handleContactForm(event) {
    event.preventDefault();
    const form = event.target;
    // Honeypot simples: se preenchido, descarta
    const botField = form.querySelector('input[name="website"]');
    if (botField && botField.value) {
        form.reset();
        return;
    }
    const nome = form.querySelector('input[type="text"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const assunto = form.querySelector('select').value;
    const mensagem = form.querySelector('textarea').value;

    // Se Firestore estiver configurado, salvar
    if (window.firebaseReady) {
        (async () => {
            try {
                const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                await addDoc(collection(window.firebaseDb, 'contatos'), {
                    nome,
                    email,
                    assunto,
                    mensagem,
                    criadoEm: serverTimestamp()
                });
                showSuccessToast('Mensagem enviada com sucesso!', 'Sucesso');
                form.reset();
            } catch (err) {
                console.error('Erro ao salvar contato:', err);
                showErrorToast('Não foi possível enviar agora. Tente novamente mais tarde.', 'Erro');
            }
        })();
    } else {
        alert('Mensagem enviada com sucesso!\n\n(Offline: configure o Firebase para salvar no banco)');
        form.reset();
    }
}

// Purchase modal functions
let currentProduct = null;
let appliedCoupon = null;
let appliedScheduleCoupon = null;
let originalPrice = 0;
const products = {
    'passe-booyah': { name: 'Passe de Elite', price: 'R$ 11,00', description: 'Passe de Elite para desbloqueio de recompensas, trajes e itens no jogo' },
    'aim-training': { name: 'XTreino - Aim Training', price: 'R$ 49,90', description: 'Sessão de 2 horas de treinamento' },
    'estrategia': { name: 'XTreino - Estratégia', price: 'R$ 79,90', description: 'Sessão de 3 horas de treinamento' },
    'mentalidade': { name: 'XTreino - Mentalidade', price: 'R$ 39,90', description: 'Sessão de 1.5 horas de treinamento' },
    'camisa': { name: 'Camisa Oficial Org Freitas', price: 'R$ 89,90', description: 'Camisa de manga curta com design exclusivo da Org Freitas' },
    'planilhas': { name: 'Planilha de Análise de Times', price: 'R$ 19,00', description: 'Planilha para Coach e Analista com análise detalhada de jogadores' },
    'imagens': { name: 'Imagens Aéreas', price: 'R$ 2,00', description: 'Mapas do Free Fire com visão aérea para estudo de calls e estratégias' },
    'sensibilidades': { name: 'Sensibilidade no Free Fire', price: 'R$ 8,00', description: 'Passo a passo para configurar sensibilidade Android, PC e iOS' },
    // Eventos e Reservas (cupom ADMFALL = 5% off)
    'evt-xtreino-tokens': { name: 'XTreino Freitas', price: 'R$ 1,00', description: '1 token — 10 horários diários (14h-23h) — Misto | Squad | 2 quedas' },
    'evt-modo-liga': { name: 'XTreino Modo Liga', price: 'R$ 3,00', description: '4 horários (14h, 15h, 17h, 18h) — 15 slots — Transmissão ao vivo' },
    'evt-camp-freitas': { name: 'Campeonato Freitas Season⁴', price: 'R$ 5,00', description: '4 horários (20h-23h) — Premiação R$ 2.000,00 + Troféu + MVP' },
    'evt-semanal-freitas': { name: 'Semanal Freitas', price: 'R$ 3,50', description: '3 fases (20h, 21h, 22h) — Premiação R$ 65,00 — Termina no mesmo dia' }
};

function openPurchaseModal(productId) {
    showProductModal(productId);
}

function showProductModal(productId){
    currentProduct = productId;
    const product = products[productId];
    if (!product) return;
    
    // Adicionar classe para esconder botões flutuantes no mobile
    document.body.classList.add('modal-open');
    const detailsMap = {
        'sensibilidades': {
            desc: '💚 SENSIBILIDADE NO FREE FIRE\n\n📱 ITEM: Sensibilidade ANDROID | PC | IOS\n\n📋 SOBRE O PRODUTO:\nPasso a passo de como configurar e ajustar a sensibilidade no Free Fire e no próprio dispositivo.\n\n✅ BENEFÍCIOS OFERECIDOS:\n• Precisão\n• Estabilidade\n• Cursor secreto\n\n🔧 DETALHES:\nAtualizações que se adaptam a cada temporada e vídeo explicativo de como usar.',
            options: null
        },
        'imagens': {
            desc: '💚 IMAGENS AÉREAS\n\n🗺️ ITEM: Mapas do Free Fire com visão aérea\n\n📋 SOBRE O PRODUTO:\nImagens aéreas dos seguintes Mapas: Bermuda | Purgatório | Kalahari | Nova Terra | Alpine. Obtenha a visão aérea dos mais diversos locais do jogo em seus respectivos Mapas.\n\n✅ BENEFÍCIOS OFERECIDOS:\n• Visão privilegiada para estudo de calls\n• Formação de rush\n• Marcação e rotação\n• Conhecimento do local\n• Montagem de estratégias\n\n🔧 DETALHES:\nOferecemos até 5 Mapas para estudos, cada um com no mínimo 20 imagens aéreas.',
            options: ['Bermuda','Purgatório','Kalahari','Nova Terra','Alpine']
        },
        'planilhas': {
            desc: '💚 PLANILHA DE ANÁLISE DE TIMES PARA COACH E ANALISTA\n\n📊 ITEM: Planilha para Coach e Analista\n\n📋 SOBRE O PRODUTO:\nPlanilha desenvolvida para estudo e aprimoramento de Times, com detalhes de cada player em suas respectivas partidas, bem como os mapas e Eventos jogados diariamente.\n\n✅ BENEFÍCIOS OFERECIDOS:\n• Cálculo de cada partida de até 8 integrantes\n• Pontuação total, abates, taxa de abates\n• Tempo de sobrevivência, média de sobrevivência\n• Assistências, danos e quedas jogadas no dia\n\n🔧 DETALHES:\nObserve o desempenho de até 4 titulares e + 4 reservas em cada partida. Destaque de top 3 e gráficos.',
            options: null
        },
        'passe-booyah': {
            desc: '💚 PASSE DE ELITE NO FREE FIRE\n\n🎮 ITEM: Passe de Elite\n\n📋 SOBRE O PRODUTO:\nPasse de Elite para desbloqueio de recompensas, trajes e itens no jogo.\n\n✅ BENEFÍCIOS OFERECIDOS:\n• Esteja à frente obtendo o Passe de Elite atual\n• Compra rápida e segura através do ID do player\n\n🔧 DETALHES:\nItem no seu correio em até 24h, oferecemos suporte.',
            options: null
        },
        'camisa': {
            desc: '💚 CAMISA OFICIAL ORG FREITAS\n\n👕 ITEM: Camisa Oficial Freitas\n\n📋 SOBRE O PRODUTO:\nCamisa de manga curta para homens e mulheres que veste super bem no corpo, com qualidade e conforto. A Camisa traz o Design exclusivo da Org Freitas, bem como sua logo.\n\n✅ BENEFÍCIOS OFERECIDOS:\n• Adicionamos o seu nome na Camisa\n• Tecido leve que proporciona sensação de frescor\n• Bom caimento e secagem rápida\n\n🔧 DETALHES:\nEntrega para todo Brasil. Temos todos os tamanhos.',
            options: ['P','M','G','GG']
        }
    };

    const details = detailsMap[productId] || { desc: product.description, options: null };
    document.getElementById('purchaseTitle').textContent = product.name;
    document.getElementById('purchaseDescription').textContent = details.desc;
    document.getElementById('purchasePrice').textContent = product.price;

    // imagem do produto
    const imgMap = {
        'sensibilidades': 'assets/images/products/SENSIBILIDADE ORG FREITAS FORMATO YOUTUBE.png',
        'imagens': 'assets/images/products/IMAGENS AÉREAS ORG FREITAS FORMATO YOUTUBE.png',
        'planilhas': 'assets/images/products/PLANILHAS ORG FREITAS FORMATO YOUTUBE.png',
        'passe-booyah': 'assets/images/products/PASSE ORG FREITAS FEED.png',
        'camisa': 'assets/images/products/MANTO ORG FREITAS FORMATO YOUTUBE.png',
        // imagens dos eventos (JPGs no projeto)
        'evt-xtreino-gratuito': 'assets/images/events/XTREINO TOKENS.jpeg',
        'evt-modo-liga': 'assets/images/events/Modo Liga.jpeg',
        'evt-camp-freitas': 'assets/images/events/CAMP.jpeg',
        'evt-semanal-freitas': 'assets/images/events/SEMANAL FREITAS.jpg'
    };
    const imgEl = document.getElementById('purchaseImage');
    if (imgEl) imgEl.src = imgMap[productId] || '';

    // opções dinâmicas
    const optContainer = document.getElementById('purchaseOptions');
    optContainer.innerHTML = '';
    // Opções para camisa (campos adicionais)
    if (productId === 'camisa' && details.options){
        // Tamanho
        const sizeLabel = document.createElement('label');
        sizeLabel.className = 'block text-sm font-medium mb-2';
        sizeLabel.textContent = 'Tamanho';
        const sizeSelect = document.createElement('select');
        sizeSelect.id = 'shirtSize';
        sizeSelect.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black focus:border-blue-matte focus:outline-none';
        details.options.forEach(o=>{ const op = document.createElement('option'); op.value = o; op.textContent = o; sizeSelect.appendChild(op); });
        optContainer.appendChild(sizeLabel);
        optContainer.appendChild(sizeSelect);
        // Nome (opcional)
        const nameLabel = document.createElement('label'); nameLabel.className='block text-sm font-medium mb-2 mt-4'; nameLabel.textContent='Nome (camisa) — opcional';
        const nameInput = document.createElement('input'); nameInput.id='shirtName'; nameInput.type='text'; nameInput.placeholder='Ex.: FREITAS'; nameInput.className='w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(nameLabel); optContainer.appendChild(nameInput);

        // Quantidade
        const qtyLabel = document.createElement('label'); qtyLabel.className='block text-sm font-medium mb-2 mt-4'; qtyLabel.textContent='Quantidade';
        const qtyInput = document.createElement('input'); qtyInput.id='shirtQty'; qtyInput.type='number'; qtyInput.min='1'; qtyInput.value='1'; qtyInput.className='w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(qtyLabel); optContainer.appendChild(qtyInput);

        // Endereço de Entrega — campos separados + CPF
        const addrGrid = document.createElement('div'); addrGrid.className='grid grid-cols-1 md:grid-cols-2 gap-3 mt-4';
        const ruaDiv = document.createElement('div'); const ruaLabel = document.createElement('label'); ruaLabel.className='block text-sm font-medium mb-2'; ruaLabel.textContent='Rua'; const ruaInput = document.createElement('input'); ruaInput.id='addrRua'; ruaInput.type='text'; ruaInput.placeholder='Rua Exemplo'; ruaInput.className='w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none'; ruaDiv.appendChild(ruaLabel); ruaDiv.appendChild(ruaInput);
        const numDiv = document.createElement('div'); const numLabel = document.createElement('label'); numLabel.className='block text-sm font-medium mb-2'; numLabel.textContent='Número'; const numInput = document.createElement('input'); numInput.id='addrNumero'; numInput.type='text'; numInput.placeholder='123'; numInput.className='w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none'; numDiv.appendChild(numLabel); numDiv.appendChild(numInput);
        addrGrid.appendChild(ruaDiv); addrGrid.appendChild(numDiv);
        optContainer.appendChild(addrGrid);

        const refLabel = document.createElement('label'); refLabel.className='block text-sm font-medium mb-2 mt-3'; refLabel.textContent='Ponto de referência (opcional)';
        const refInput = document.createElement('input'); refInput.id='addrReferencia'; refInput.type='text'; refInput.placeholder='Próximo à praça...'; refInput.className='w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(refLabel); optContainer.appendChild(refInput);

        const cpfLabel = document.createElement('label'); cpfLabel.className='block text-sm font-medium mb-2 mt-3'; cpfLabel.textContent='CPF';
        const cpfInput = document.createElement('input'); cpfInput.id='customerCPF'; cpfInput.type='text'; cpfInput.placeholder='000.000.000-00'; cpfInput.className='w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(cpfLabel); optContainer.appendChild(cpfInput);

        // Observações
        const obsLabel = document.createElement('label'); obsLabel.className='block text-sm font-medium mb-2 mt-4'; obsLabel.textContent='Observações (opcional)';
        const obsInput = document.createElement('textarea'); obsInput.id='shirtNotes'; obsInput.rows=2; obsInput.placeholder='Ex.: Ajustar modelagem, presente, etc.'; obsInput.className='w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(obsLabel); optContainer.appendChild(obsInput);
    }

    // Opções para imagens: campo texto para mapas + quantidade
    if (productId === 'imagens'){
        // Seleção múltipla de mapas
        const hint = document.createElement('div'); hint.className='text-sm text-gray-600 mb-2'; hint.textContent='Selecione um ou mais mapas ou digite os nomes.';
        optContainer.appendChild(hint);
        const maps = ['Bermuda','Purgatório','Kalahari','Nova Terra','Alpine'];
        const grid = document.createElement('div'); grid.className='grid grid-cols-2 gap-2 mb-3';
        maps.forEach(m=>{
            const label = document.createElement('label'); label.className='flex items-center gap-2';
            const cb = document.createElement('input'); cb.type='checkbox'; cb.name='mapOption'; cb.value=m;
            const span = document.createElement('span'); span.className='text-sm'; span.textContent=m;
            label.appendChild(cb); label.appendChild(span); grid.appendChild(label);
        });
        optContainer.appendChild(grid);

        const mapsLabel = document.createElement('label');
        mapsLabel.className = 'block text-sm font-medium mb-2';
        mapsLabel.textContent = 'Ou digite os mapas (separe por vírgula)';
        const mapsInput = document.createElement('input');
        mapsInput.id = 'mapsNames';
        mapsInput.type = 'text';
        mapsInput.placeholder = 'Ex.: Bermuda, Kalahari';
        mapsInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(mapsLabel);
        optContainer.appendChild(mapsInput);

        const qtyWrap = document.createElement('div');
        qtyWrap.className = 'mt-3';
        qtyWrap.innerHTML = '<label class="block text-sm font-medium mb-2">Quantidade de mapas (1 a 5)</label><input id="mapsQty" type="number" min="1" max="5" value="1" class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black focus:border-blue-matte focus:outline-none">';
        optContainer.appendChild(qtyWrap);
    }

    // Campo de cupom apenas para eventos (ids iniciando com evt-), exceto Xtreino Tokens
    console.log('🔍 Debug cupom - productId:', productId, 'startsWith evt-:', productId.startsWith('evt-'), 'is not xtreino-gratuito:', productId !== 'evt-xtreino-gratuito');
    if (productId.startsWith('evt-') && productId !== 'evt-xtreino-gratuito'){
        console.log('✅ Adicionando campo de cupom para:', productId);
        const cupomWrap = document.createElement('div');
        cupomWrap.className = 'mt-3';
        cupomWrap.innerHTML = '<label class="block text-sm font-medium mb-2">Cupom de desconto</label><input id="couponCode" type="text" placeholder="ADMFALL" class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none">\n<p class="text-xs text-gray-500 mt-1">Use <strong>ADMFALL</strong> para 5% de desconto.</p>';
        optContainer.appendChild(cupomWrap);
    } else {
        console.log('❌ NÃO adicionando campo de cupom para:', productId);
    }

    // Preço inicial e atualização dinâmica
    updatePurchaseTotal(productId);
    const qtyEl = document.getElementById('mapsQty');
    if (qtyEl) qtyEl.addEventListener('input', ()=> updatePurchaseTotal(productId));
    const mapsNamesEl = document.getElementById('mapsNames');
    if (mapsNamesEl) mapsNamesEl.addEventListener('input', ()=> syncMapsQtyWithNames());
    const couponEl = document.getElementById('couponCode');
    if (couponEl) couponEl.addEventListener('input', ()=> updatePurchaseTotal(productId));

    document.getElementById('purchaseModal').classList.remove('hidden');
    if (window.innerWidth <= 767) document.body.classList.add('modal-open-mobile');
}

function updatePurchaseTotal(productId){
    let total = 0;
    if (productId === 'imagens'){
        const qty = Math.max(1, Math.min(5, Number(document.getElementById('mapsQty')?.value || 1)));
        const pricing = {1:2, 2:4, 3:5, 4:6, 5:7};
        total = pricing[qty] || 2;
    } else {
        const product = products[productId];
        total = Number((product.price || '0').replace(/[^0-9,]/g,'').replace(',','.')) || 0;
    }
    
    // Armazenar preço original
    originalPrice = total;
    
    // Atualizar subtotal
    const subtotalEl = document.getElementById('purchaseSubtotal');
    if (subtotalEl) {
        subtotalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    
    // Se há cupom aplicado, recalcular com desconto
    if (appliedCoupon) {
        updatePriceWithCoupon();
    } else {
        // Sem cupom, mostrar preço original
        const priceEl = document.getElementById('purchasePrice');
        if (priceEl) {
            priceEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        
        // Esconder linha de desconto
        const discountRowEl = document.getElementById('discountRow');
        if (discountRowEl) {
            discountRowEl.classList.add('hidden');
        }
    }
}

function syncMapsQtyWithNames(){
    const names = (document.getElementById('mapsNames')?.value || '')
        .split(',')
        .map(s=>s.trim())
        .filter(Boolean);
    const qtyEl = document.getElementById('mapsQty');
    if (!qtyEl) return;
    if (names.length) qtyEl.value = Math.min(5, Math.max(1, names.length));
    updatePurchaseTotal('imagens');
}

function closePurchaseModal() {
    document.getElementById('purchaseModal').classList.add('hidden');
    currentProduct = null;
    appliedCoupon = null;
    originalPrice = 0;
    
    // Remover classe para mostrar botões flutuantes novamente
    document.body.classList.remove('modal-open');
    
    // Limpar campos de cupom
    const couponInput = document.getElementById('couponCodeInput');
    const couponMessage = document.getElementById('couponMessage');
    if (couponInput) couponInput.value = '';
    if (couponMessage) {
        couponMessage.classList.add('hidden');
        couponMessage.textContent = '';
    }
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}

// Pagar produto atual com Tokens
async function payCurrentProductWithTokens(){
    try{
        if (!window.isLoggedIn){
            closePurchaseModal();
            if (typeof openLoginModal === 'function') openLoginModal();
            alert('Faça login para pagar com tokens.');
            return;
        }
        const productId = currentProduct;
        const product = products[productId];
        if (!product) { alert('Produto inválido'); return; }
        // preço final exibido
        const totalText = document.getElementById('purchasePrice')?.textContent || '0';
        const total = Number(totalText.replace(/[^0-9,]/g,'').replace(',','.')) || 0;
        // saldo suficiente?
        if (!canSpendTokens(total)){
            alert(`Saldo insuficiente. Você precisa de ${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`);
            return;
        }
        // Coletar opções
        let productOptions = {};
        if (productId === 'imagens'){
            const selected = Array.from(document.querySelectorAll('input[name="mapOption"]:checked')).map(i=>i.value);
            const names = (document.getElementById('mapsNames')?.value || '')
              .split(',').map(s=>s.trim()).filter(Boolean);
            productOptions.maps = selected.length ? selected : names;
            productOptions.quantity = productOptions.maps.length || 1;
        }
        if (productId === 'passe-booyah'){
            productOptions.playerId = document.getElementById('playerId')?.value || '';
        }
        if (productId === 'camisa'){
            const size = document.getElementById('shirtSize')?.value || 'M';
            const nameOnShirt = document.getElementById('shirtName')?.value || '';
            const nome = document.getElementById('addrNome')?.value || '';
            const cpf = document.getElementById('customerCPF')?.value || '';
            const cep = document.getElementById('addrCEP')?.value || '';
            const rua = document.getElementById('addrRua')?.value || '';
            const numero = document.getElementById('addrNumero')?.value || '';
            const complemento = document.getElementById('addrComplemento')?.value || '';
            const bairro = document.getElementById('addrBairro')?.value || '';
            const cidade = document.getElementById('addrCidade')?.value || '';
            const estado = document.getElementById('addrEstado')?.value || '';
            // valida CPF básico (mesmo formato do checkout normal)
            const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
            if (!cpf || !cpfRegex.test(cpf)) { alert('CPF inválido. Use o formato 000.000.000-00.'); return; }
            productOptions.size = size;
            productOptions.name = nameOnShirt;
            productOptions.delivery = { nome, cpf, cep, address:rua, number:numero, complement:complemento, district:bairro, city:cidade, state:estado };
        }
        // Debitar tokens
        const ok = await spendTokens(total);
        if (!ok){ alert('Não foi possível debitar os tokens.'); return; }
        // Criar pedido pago
        const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const orderData = {
            title: product.name,
            description: product.description,
            item: product.name,
            amount: total,
            total: total,
            quantity: 1,
            currency: 'BRL',
            status: 'paid',
            paidWithTokens: true,
            tokensUsed: total,
            customer: window.firebaseAuth?.currentUser?.email || '',
            customerName: window.currentUserProfile?.name || '',
            buyerEmail: window.firebaseAuth?.currentUser?.email || '',
            userId: window.firebaseAuth?.currentUser?.uid,
            uid: window.firebaseAuth?.currentUser?.uid,
            productId: productId,
            productOptions: productOptions,
            shippingStatus: (productId === 'camisa') ? 'pending' : undefined,
            createdAt: new Date(),
            timestamp: Date.now(),
            type: 'digital_product'
        };
        const docRef = await addDoc(collection(window.firebaseDb,'orders'), orderData);
        closePurchaseModal();
        if (typeof openPaymentConfirmModal === 'function'){
            openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento em tokens foi aprovado. Confira em Minha Conta.');
        } else {
            alert('Pagamento confirmado com tokens!');
        }
    }catch(e){
        console.error('Erro ao pagar com tokens:', e);
        alert('Erro ao pagar com tokens.');
    }
}

// Ação do botão "Pagar com Tokens" do agendamento
function payScheduleWithTokens(){
    submitSchedule({ preventDefault:()=>{} }, true);
}

// Função para aplicar cupom
async function applyCoupon() {
    const couponCode = document.getElementById('couponCodeInput')?.value?.trim().toUpperCase();
    const couponMessage = document.getElementById('couponMessage');
    
    if (!couponCode) {
        showCouponMessage('Digite um código de cupom', 'error');
        return;
    }
    
    if (!currentProduct) {
        showCouponMessage('Erro: produto não selecionado', 'error');
        return;
    }
    
    try {
        console.log('🔄 Validando cupom:', couponCode);
        
        // Importar Firebase
        const { collection, getDocs, query, where, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // Buscar cupom no Firestore
        const couponsRef = collection(window.firebaseDb, 'coupons');
        const q = query(couponsRef, where('code', '==', couponCode), limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            showCouponMessage('Cupom não encontrado', 'error');
            return;
        }
        
        const couponDoc = snapshot.docs[0];
        const coupon = { id: couponDoc.id, ...couponDoc.data() };
        
        // Validar cupom
        const validation = validateCoupon(coupon);
        if (!validation.valid) {
            showCouponMessage(validation.message, 'error');
            return;
        }
        
        // Aplicar cupom
        appliedCoupon = coupon;
        updatePriceWithCoupon();
        showCouponMessage(`Cupom aplicado! Desconto: ${getDiscountText(coupon)}`, 'success');
        
        console.log('✅ Cupom aplicado:', coupon);
        
    } catch (error) {
        console.error('❌ Erro ao validar cupom:', error);
        showCouponMessage('Erro ao validar cupom. Tente novamente.', 'error');
    }
}

// Validar cupom
function validateCoupon(coupon) {
    // Verificar se está ativo
    if (!coupon.isActive) {
        return { valid: false, message: 'Cupom inativo' };
    }
    
    // Verificar data de expiração
    if (coupon.expirationDate) {
        const expirationDate = coupon.expirationDate.toDate ? coupon.expirationDate.toDate() : new Date(coupon.expirationDate);
        if (expirationDate < new Date()) {
            return { valid: false, message: 'Cupom expirado' };
        }
    }
    
    // Verificar tipo de uso do cupom
    const currentContext = getCurrentPurchaseContext();
    if (!isCouponValidForContext(coupon, currentContext)) {
        return { valid: false, message: 'Cupom não válido para este tipo de compra' };
    }
    
    return { valid: true };
}

// Determinar contexto atual da compra
function getCurrentPurchaseContext() {
    // Verificar se estamos no modal de compra de produtos da loja
    const purchaseModal = document.getElementById('purchaseModal');
    if (purchaseModal && !purchaseModal.classList.contains('hidden')) {
        return 'store';
    }
    
    // Verificar se estamos no modal de agendamento de eventos
    const scheduleModal = document.getElementById('scheduleModal');
    if (scheduleModal && !scheduleModal.classList.contains('hidden')) {
        return 'events';
    }
    
    return 'unknown';
}

// Verificar se cupom é válido para o contexto atual
function isCouponValidForContext(coupon, context) {
    // Se o cupom pode ser usado em ambos os contextos
    if (coupon.usageType === 'both') return true;
    
    // Se o cupom é específico para eventos e estamos em contexto de eventos
    if (coupon.usageType === 'events' && context === 'events') return true;
    
    // Se o cupom é específico para loja e estamos em contexto de loja
    if (coupon.usageType === 'store' && context === 'store') return true;
    
    return false;
}

// Atualizar preço com cupom aplicado
function updatePriceWithCoupon() {
    if (!appliedCoupon) return;
    
    const subtotalEl = document.getElementById('purchaseSubtotal');
    const discountRowEl = document.getElementById('discountRow');
    const discountAmountEl = document.getElementById('discountAmount');
    const totalEl = document.getElementById('purchasePrice');
    
    if (!subtotalEl || !discountRowEl || !discountAmountEl || !totalEl) return;
    
    // Calcular desconto
    let discountAmount = 0;
    if (appliedCoupon.discountType === 'percentage') {
        discountAmount = originalPrice * (appliedCoupon.discountValue / 100);
    } else {
        discountAmount = appliedCoupon.discountValue;
    }
    
    // Garantir que o desconto não seja maior que o preço
    discountAmount = Math.min(discountAmount, originalPrice);
    
    const finalPrice = originalPrice - discountAmount;
    
    // Atualizar elementos
    subtotalEl.textContent = originalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    discountAmountEl.textContent = `-${discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    totalEl.textContent = finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // Mostrar linha de desconto
    discountRowEl.classList.remove('hidden');
}

// Mostrar mensagem de cupom
function showCouponMessage(message, type) {
    const couponMessage = document.getElementById('couponMessage');
    if (!couponMessage) return;
    
    couponMessage.textContent = message;
    couponMessage.classList.remove('hidden', 'text-green-600', 'text-red-600');
    
    if (type === 'success') {
        couponMessage.classList.add('text-green-600');
    } else if (type === 'error') {
        couponMessage.classList.add('text-red-600');
    }
}

// Obter texto do desconto
function getDiscountText(coupon) {
    if (coupon.discountType === 'percentage') {
        return `${coupon.discountValue}%`;
    } else {
        return `R$ ${coupon.discountValue.toFixed(2)}`;
    }
}


async function handlePurchase(event) {
    event.preventDefault();
    const product = products[currentProduct];
    if (!product) {
        alert('Produto inválido.');
        return;
    }
    
    // total atual do modal
    const totalText = document.getElementById('purchasePrice')?.textContent || '0';
    const totalNum = Number(totalText.replace(/[^0-9,]/g,'').replace(',','.')) || 0;
    
    // Informações do cupom aplicado
    const couponInfo = appliedCoupon ? {
        code: appliedCoupon.code,
        discountType: appliedCoupon.discountType,
        discountValue: appliedCoupon.discountValue,
        originalPrice: originalPrice,
        finalPrice: totalNum
    } : null;
    
    // validação específica para imagens (quantidade vs nomes)
    if (currentProduct === 'imagens'){
        const qty = Math.max(1, Math.min(5, Number(document.getElementById('mapsQty')?.value || 1)));
        const names = (document.getElementById('mapsNames')?.value || '')
            .split(',').map(s=>s.trim()).filter(Boolean);
        if (names.length && names.length !== qty){
            alert('Quantidade de mapas deve corresponder ao número de mapas escritos.');
            return;
        }
    }

    // Coletar dados do formulário
    const formData = new FormData(event.target);
    const customerName = formData.get('name') || document.querySelector('#purchaseModal input[type="text"]')?.value || '';
    const customerEmail = formData.get('email') || document.querySelector('#purchaseModal input[type="email"]')?.value || '';
    
    // Coletar opções específicas do produto
    let productOptions = {};
    if (currentProduct === 'camisa') {
        const sizeSelect = document.querySelector('#purchaseModal select');
        productOptions.size = sizeSelect?.value || '';
    } else if (currentProduct === 'imagens') {
        const selected = Array.from(document.querySelectorAll('input[name="mapOption"]:checked')).map(i=>i.value);
        productOptions.maps = selected;
        productOptions.quantity = selected.length || 1;
    } else if (currentProduct === 'camisa') {
        productOptions.size = document.getElementById('shirtSize')?.value || '';
        productOptions.color = document.getElementById('shirtColor')?.value || '';
        productOptions.name = document.getElementById('shirtName')?.value || '';
        productOptions.number = document.getElementById('shirtNumber')?.value || '';
        productOptions.quantity = Number(document.getElementById('shirtQty')?.value || 1);
        productOptions.deliveryAddress = document.getElementById('deliveryAddress')?.value || '';
        productOptions.notes = document.getElementById('shirtNotes')?.value || '';
    }

    try {
        // Salvar order no Firestore ANTES de redirecionar
        if (window.firebaseDb) {
            const { addDoc, collection, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            
            // Validação de formato de CPF para camisa (obrigatório no padrão 000.000.000-00)
            if (currentProduct === 'camisa') {
                const cpfVal = (document.getElementById('customerCPF')?.value || '').trim();
                const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
                if (!cpfVal || !cpfRegex.test(cpfVal)) {
                    alert('CPF inválido. Use o formato 000.000.000-00.');
                    return;
                }
            }
            
            const orderData = {
                title: product.name,
                description: product.description,
                item: product.name,
                amount: totalNum,
                total: totalNum,
                quantity: 1,
                currency: 'BRL',
                status: 'pending',
                customer: customerEmail,
                customerName: customerName,
                buyerEmail: customerEmail,
                userId: window.firebaseAuth.currentUser?.uid,
                uid: window.firebaseAuth.currentUser?.uid,
                productId: currentProduct,
                productOptions: productOptions,
                createdAt: new Date(),
                timestamp: Date.now(),
                type: 'digital_product' // Marcar como produto digital
            };
            
            console.log('🔍 Attempting to save digital product order:', orderData);
            const docRef = await addDoc(collection(window.firebaseDb, 'orders'), orderData);
            console.log('✅ Digital product order saved to Firestore with ID:', docRef.id);
            
            // Salvar external_reference para o webhook
            const externalRef = `digital_${docRef.id}`;
            await updateDoc(docRef, { external_reference: externalRef });
        }

        // Chamar function segura (Netlify) para criar Preference
        const response = await fetch('/.netlify/functions/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: product.name,
                unit_price: totalNum,
                currency_id: 'BRL',
                quantity: 1,
                back_url: window.location.origin,
                coupon_info: couponInfo,
                external_reference: externalRef
            })
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        
        // Registrar uso do cupom se aplicado
        if (appliedCoupon) {
            const discountAmount = originalPrice - totalNum;
            await recordCouponUsage(
                appliedCoupon.id,
                appliedCoupon.code,
                originalPrice,
                discountAmount,
                'store',
                data.external_reference || 'product_' + Date.now()
            );
        }
        
        closePurchaseModal();
        
        // Redireciona para o checkout do Mercado Pago
        if (data.init_point) {
            try { sessionStorage.setItem('lastCheckoutUrl', data.init_point); } catch(_) {}
            window.location.href = data.init_point;
        } else {
            alert('Não foi possível iniciar o checkout.');
        }
    } catch (error) {
        console.error('Erro no checkout:', error);
        alert('Falha ao iniciar checkout.');
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const loginModal = document.getElementById('loginModal');
    const purchaseModal = document.getElementById('purchaseModal');
    const clientAreaModal = document.getElementById('clientAreaModal');
    const tokensModal = document.getElementById('tokensModal');
    const freeWhatsModal = document.getElementById('freeWhatsModal');
    const scheduleModal = document.getElementById('scheduleModal');
    
    // login modal removido
    if (event.target === purchaseModal) {
        closePurchaseModal();
    }
    // client area removida
    if (event.target === tokensModal) {
        closeTokensModal();
    }
    if (event.target === freeWhatsModal) {
        closeFreeWhatsModal();
    }
    if (event.target === scheduleModal) {
        closeScheduleModal();
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Carregar destaques do Firestore
async function loadHighlightsFromFirestore() {
    try {
        if (!window.firebaseDb) return;
        
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const highlightsRef = collection(window.firebaseDb, 'highlights');
        const snapshot = await getDocs(highlightsRef);
        
        const highlights = {};
        snapshot.forEach(doc => {
            highlights[doc.id] = doc.data();
        });
        
        // Se não há destaques, usar os padrão
        if (Object.keys(highlights).length === 0) {
            highlights.highlight1 = {
                title: 'Modo Liga - Estratégia',
                subtitle: 'Treinos competitivos',
                description: 'Treinos competitivos com pontuação e ranking.',
                image: '',
                action: "openPurchaseModal('estrategia')",
                hasRedirect: false,
                redirectUrl: '',
                customLinkUrl: ''
            };
            highlights.highlight2 = {
                title: 'Campeonato Semanal',
                subtitle: 'Etapas semanais',
                description: 'Etapas semanais com premiações.',
                image: '',
                action: "openPurchaseModal('planilhas')",
                hasRedirect: false,
                redirectUrl: '',
                customLinkUrl: ''
            };
            highlights.highlight3 = {
                title: 'Camp de Fases',
                subtitle: 'Eliminatórias',
                description: 'Eliminatórias com melhores confrontos.',
                image: '',
                action: "openPurchaseModal('camp-fases')",
                hasRedirect: false,
                redirectUrl: '',
                customLinkUrl: ''
            };
        }
        
        // Renderizar destaques
        const track = document.getElementById('carouselTrack');
        if (!track) return;
        
        track.innerHTML = '';
        
        Object.keys(highlights).forEach(key => {
            const highlight = highlights[key];
            if (highlight && highlight.title) {
                const slide = document.createElement('div');
                slide.className = 'min-w-full p-8 bg-white';
                
                // Criar imagem com ou sem link
                let imageHtml = '';
                if (highlight.image) {
                    if (highlight.hasRedirect && highlight.redirectUrl) {
                        imageHtml = `<a href="${highlight.redirectUrl}" target="_blank" rel="noopener noreferrer" class="block w-full h-full">
                            <img src="${highlight.image}" alt="${highlight.title}" class="w-full h-full object-cover hover:opacity-90 transition-opacity">
                        </a>`;
                    } else {
                        imageHtml = `<img src="${highlight.image}" alt="${highlight.title}" class="w-full h-full object-cover">`;
                    }
                } else {
                    imageHtml = '';
                }
                
                // Criar botão com ou sem link personalizado
                let buttonHtml = '';
                if (highlight.action === 'buy_tokens') {
                    buttonHtml = `<button onclick="openHeroTokensModal()" class="bg-blue-matte hover-blue-matte px-6 py-2 rounded-lg text-white font-semibold">Comprar Tokens</button>`;
                } else if (highlight.action === 'custom_link' && highlight.customLinkUrl) {
                    buttonHtml = `<a href="${highlight.customLinkUrl}" target="_blank" rel="noopener noreferrer" class="bg-blue-matte hover-blue-matte px-6 py-2 rounded-lg text-white font-semibold inline-block">Ver Mais</a>`;
                } else {
                    buttonHtml = `<button onclick="${highlight.action}" class="bg-blue-matte hover-blue-matte px-6 py-2 rounded-lg text-white font-semibold">Ver Mais</button>`;
                }
                
                slide.innerHTML = `
                    <div class="grid md:grid-cols-2 gap-6 items-center">
                        <div>
                            <h3 class="text-xl font-bold mb-2">${highlight.title}</h3>
                            ${highlight.subtitle ? `<p class="text-gray-500 mb-2">${highlight.subtitle}</p>` : ''}
                            <p class="text-gray-600 mb-4">${highlight.description}</p>
                            ${buttonHtml}
                        </div>
                        <div class="rounded-xl ${highlight.image ? '' : 'bg-blue-matte bg-opacity-20'} h-48 overflow-hidden flex items-center justify-center">
                            ${imageHtml}
                        </div>
                    </div>
                `;
                track.appendChild(slide);
            }
        });
        
        // Apply animations after rendering
        setTimeout(() => {
            reinitAnimations(track);
        }, 50);
        
        // Inicializar carousel
        initCarousel();
        
    } catch (error) {
        console.error('Erro ao carregar destaques:', error);
    }
}

// Simple carousel with auto-advance
function initCarousel() {
    const track = document.getElementById('carouselTrack');
    const prev = document.getElementById('carouselPrev');
    const next = document.getElementById('carouselNext');
    if (!track || !prev || !next) return;
    
    let index = 0;
    const slides = track.children.length;
    let autoAdvanceInterval;
    
    function update() { 
        track.style.transform = `translateX(-${index*100}%)`; 
    }
    
    function nextSlide() {
        index = (index + 1) % slides;
        update();
    }
    
    function prevSlide() {
        index = (index - 1 + slides) % slides;
        update();
    }
    
    function startAutoAdvance() {
        autoAdvanceInterval = setInterval(nextSlide, 11500); // +1.5s -> 11.5 segundos
    }
    
    function stopAutoAdvance() {
        if (autoAdvanceInterval) {
            clearInterval(autoAdvanceInterval);
        }
    }
    
    // Event listeners para botões manuais
    prev.addEventListener('click', () => {
        stopAutoAdvance();
        prevSlide();
        startAutoAdvance();
    });
    
    next.addEventListener('click', () => {
        stopAutoAdvance();
        nextSlide();
        startAutoAdvance();
    });
    
    // Pausar auto-advance quando hover
    track.addEventListener('mouseenter', stopAutoAdvance);
    track.addEventListener('mouseleave', startAutoAdvance);
    
    // Iniciar auto-advance
    if (slides > 1) {
        startAutoAdvance();
    }
}

// Carregar destaques quando o Firebase estiver pronto
if (window.firebaseReady) {
    loadHighlightsFromFirestore();
    loadNewsFromFirestore();
    
    // Initialize smooth animations
    initSmoothAnimations();
    initChat();
} else {
    window.addEventListener('load', () => {
        setTimeout(() => {
            loadHighlightsFromFirestore();
            loadNewsFromFirestore();
            initChat();
        }, 1000);
    });
}

// ===== Modal Comprar Tokens (Home/Destaques) =====
let heroAppliedCoupon = null;
let heroSelectedQty = 0;
function openHeroTokensModal(){
    const modal = document.getElementById('heroTokensModal');
    if (!modal) return;
    const msg = document.getElementById('heroTokensCouponMsg'); if (msg){ msg.textContent=''; msg.className='text-xs text-gray-500'; }
    const input = document.getElementById('heroTokensCoupon'); if (input) input.value = '';
    heroAppliedCoupon = null; heroSelectedQty = 0; updateHeroTokensSummary();
    modal.classList.remove('hidden'); modal.classList.add('flex');
}
function closeHeroTokensModal(){ const m = document.getElementById('heroTokensModal'); if (m){ m.classList.add('hidden'); m.classList.remove('flex'); } }
function heroSetTokensQty(qty){ heroSelectedQty = qty; updateHeroTokensSummary(); }
async function heroApplyTokenCoupon(){
    try{
        const code = (document.getElementById('heroTokensCoupon')?.value || '').trim().toUpperCase();
        const msg = document.getElementById('heroTokensCouponMsg');
        if (!code){ msg.textContent='Digite um código de cupom'; msg.className='text-xs text-red-600'; return; }
        const { collection, getDocs, query, where, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const q = query(collection(window.firebaseDb,'coupons'), where('code','==', code), limit(1));
        const snap = await getDocs(q);
        if (snap.empty){ msg.textContent='Cupom não encontrado'; msg.className='text-xs text-red-600'; return; }
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (!data.isActive){ msg.textContent='Cupom inativo'; msg.className='text-xs text-red-600'; return; }
        if (data.expirationDate){ const exp = data.expirationDate.toDate ? data.expirationDate.toDate() : new Date(data.expirationDate); if (exp < new Date()){ msg.textContent='Cupom expirado'; msg.className='text-xs text-red-600'; return; } }
        heroAppliedCoupon = { id: data.id, code: data.code, discountType: data.discountType, discountValue: Number(data.discountValue||0) };
        msg.textContent = `Cupom aplicado: ${data.code}`; msg.className='text-xs text-green-600'; updateHeroTokensSummary();
    }catch(_){ const msg = document.getElementById('heroTokensCouponMsg'); if (msg){ msg.textContent='Erro ao aplicar cupom'; msg.className='text-xs text-red-600'; } }
}
function updateHeroTokensSummary(){
    const subtotalEl = document.getElementById('heroTokensSubtotal');
    const discountRow = document.getElementById('heroTokensDiscountRow');
    const discountEl = document.getElementById('heroTokensDiscount');
    const totalEl = document.getElementById('heroTokensTotal');
    const summary = document.getElementById('heroTokensSummary');
    const btn = document.getElementById('heroTokensBuyBtn');
    const base = heroSelectedQty || 0;
    const discount = heroAppliedCoupon ? (heroAppliedCoupon.discountType==='percentage' ? base*(heroAppliedCoupon.discountValue/100) : heroAppliedCoupon.discountValue) : 0;
    const total = Math.max(0, base - discount);
    if (subtotalEl) subtotalEl.textContent = base.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    if (discountRow) discountRow.style.display = heroAppliedCoupon ? '' : 'none';
    if (discountEl) discountEl.textContent = `- ${discount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
    if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    if (summary) summary.classList.remove('hidden');
    if (btn){ btn.disabled = base<=0; btn.textContent = base>0 ? `Comprar ${base} token${base>1?'s':''} por ${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}` : 'Selecionar quantidade'; }
}
async function heroPurchaseTokens(){
    try{
        if (!window.firebaseAuth?.currentUser){ openLoginModal(); return; }
        const qty = heroSelectedQty || 0; if (!qty){ alert('Selecione a quantidade'); return; }
        const basePrice = qty; let price = basePrice;
        if (heroAppliedCoupon){ const d = heroAppliedCoupon.discountType==='percentage' ? basePrice*(heroAppliedCoupon.discountValue/100) : heroAppliedCoupon.discountValue; price = Math.max(0, basePrice - d); }
        // Criar ordem no Firestore para associar external_reference e permitir confirmação automática
        let externalRef;
        try {
            const { addDoc, updateDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const orderData = {
                title: `${qty} Token${qty>1?'s':''} XTreino`,
                amount: price,
                quantity: qty,
                currency: 'BRL',
                customer: window.firebaseAuth.currentUser?.email || null,
                customerName: window.firebaseAuth.currentUser?.displayName || null,
                uid: window.firebaseAuth.currentUser?.uid || null,
                type: 'tokens_purchase',
                createdAt: new Date(),
                timestamp: Date.now()
            };
            const docRef = await addDoc(collection(window.firebaseDb, 'orders'), orderData);
            externalRef = `tokens_${docRef.id}`;
            await updateDoc(docRef, { external_reference: externalRef });
            try { sessionStorage.setItem('lastExternalRef', externalRef); } catch(_) {}
        } catch(e) {
            console.warn('Não foi possível criar ordem local para tokens:', e);
        }

        const response = await fetch('/.netlify/functions/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${qty} Token${qty>1?'s':''} XTreino`, unit_price: price, currency_id: 'BRL', quantity: 1, back_url: window.location.origin, coupon_info: heroAppliedCoupon ? { id: heroAppliedCoupon.id, code: heroAppliedCoupon.code, discountType: heroAppliedCoupon.discountType, discountValue: heroAppliedCoupon.discountValue, context: 'tokens' } : undefined, external_reference: externalRef }) });
        if (!response.ok) throw new Error('Erro');
        const data = await response.json();
        if (data.init_point){ try{ sessionStorage.setItem('lastCheckoutUrl', data.init_point); }catch(_){} closeHeroTokensModal(); window.location.href = data.init_point; } else { alert('Erro ao iniciar pagamento'); }
    }catch(_){ alert('Erro ao comprar tokens'); }
}
window.openHeroTokensModal = openHeroTokensModal;
window.closeHeroTokensModal = closeHeroTokensModal;
window.heroSetTokensQty = heroSetTokensQty;
window.heroApplyTokenCoupon = heroApplyTokenCoupon;
window.heroPurchaseTokens = heroPurchaseTokens;
// ==================== CHAT INTERNO ====================

// Chat sempre disponível 24 horas
function isBusinessHours() {
    // Chat sempre online
    return true;
}

// ===== Helpers de chat inteligente (sem APIs externas) =====
function stripDiacritics(s){ try{ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(_){ return s; } }
function normalizeText(s){
    const t = stripDiacritics(String(s||'').toLowerCase());
    return t.replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
}
function levenshtein(a,b){
    a = String(a); b = String(b);
    const m = Array.from({length: a.length+1}, (_,i)=>[i]);
    for (let j=1;j<=b.length;j++){ m[0][j]=j; }
    for (let i=1;i<=a.length;i++){
        for (let j=1;j<=b.length;j++){
            const cost = a[i-1]===b[j-1] ? 0 : 1;
            m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+cost);
        }
    }
    return m[a.length][b.length];
}
function similarity(a,b){
    const na = normalizeText(a), nb = normalizeText(b);
    if (!na || !nb) return 0;
    const maxLen = Math.max(na.length, nb.length);
    const dist = levenshtein(na, nb);
    return 1 - (dist / Math.max(1, maxLen));
}
const EVENT_SYNONYMS = {
    'modo-liga': ['modo liga','liga','modoliga','xtreino liga','liga freitas'],
    'semanal-freitas': ['semanal','semanal freitas','final semanal','final do semanal'],
    'camp-freitas': ['camp','campeonato','camp freitas','campeonato freitas'],
    'xtreino-tokens': ['xtreino','treino','freitas','xtreino freitas','token','tokens']
};
function detectEventType(text){
    const n = normalizeText(text);
    for (const [key, list] of Object.entries(EVENT_SYNONYMS)){
        if (list.some(s => n.includes(normalizeText(s)))) return key;
    }
    return null;
}
function parseHourFromText(text){
    const t = String(text||'').toLowerCase();
    const m1 = t.match(/\b(\d{1,2})\s*h\b/); if (m1){ const h=parseInt(m1[1],10); if(h>=0&&h<=23) return `${h}h`; }
    const m2 = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/); if (m2){ const h=parseInt(m2[1],10); if(h>=0&&h<=23) return `${h}h`; }
    return null;
}
function parseDateFromText(text){
    try{
        const n = normalizeText(text);
        const today = new Date();
        if (/\bhoje\b/.test(n)) return today.toISOString().slice(0,10);
        if (/\bamanha\b/.test(n)) { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
        const m = n.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/);
        if (m){
            const dd = parseInt(m[1],10), MM=parseInt(m[2],10), yyyy = m[3]? parseInt(m[3],10) : today.getFullYear();
            const y4 = yyyy<100 ? 2000+yyyy : yyyy;
            const ds = `${y4}-${String(MM).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
            const d = new Date(ds+'T00:00:00'); if (!isNaN(d)) return ds;
        }
    }catch(_){}
    return null;
}
let __faqKbCache = null;
async function loadFaqKb(){
    if (__faqKbCache !== null) return __faqKbCache;
    try{
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(collection(window.firebaseDb,'faq_kb'));
        __faqKbCache = [];
        snap.forEach(d=>{ const data=d.data(); if (data?.q && data?.a) __faqKbCache.push({q:String(data.q), a:String(data.a)}); });
        return __faqKbCache;
    }catch(_){ __faqKbCache = []; return __faqKbCache; }
}
async function smartChatAnswer(message){
    const text = String(message||'');
    const ntext = normalizeText(text);
    // 1) FAQ KB por similaridade
    const kb = await loadFaqKb();
    let best = {score:0, a:''};
    for (const item of kb){
        const s = similarity(ntext, item.q);
        if (s > best.score) best = { score: s, a: item.a };
    }
    if (best.score >= 0.72) return { answer: best.a, confidence: best.score };
    // 2) Intenções: preço / vagas / horários
    const ev = detectEventType(ntext);
    const hour = parseHourFromText(ntext);
    const date = parseDateFromText(ntext) || new Date().toISOString().slice(0,10);
    const wantsPrice = /\b(preco|preço|valor|custa|quanto)\b/.test(ntext);
    const wantsVacancy = /\b(vaga|vagas|lotado|tem vaga|disponivel|disponível)\b/.test(ntext);
    const wantsHours = /\b(horario|horário|hora|horas|que horas)\b/.test(ntext);
    if (ev && (wantsPrice || wantsHours || wantsVacancy)){
        // Horários: listar horários do evento
        if (wantsHours && !hour){
            let slots = [];
            if (ev==='modo-liga' || ev==='xtreino-tokens') slots = ['14h','15h','16h','17h','18h','19h','20h','21h','22h','23h'];
            else if (ev==='semanal-freitas') slots = ['20h','21h','22h'];
            else if (ev==='camp-freitas') slots = ['20h','21h','22h','23h'];
            return { answer: `⏰ Horários de ${scheduleConfig[ev]?.label||'evento'}: ${slots.join(', ')}`, confidence: 0.9 };
        }
        // Preço: considerar preço por horário (ex.: 22h semanal = 7)
        if (wantsPrice){
            const p = getEventPrice(ev, hour || '');
            return { answer: `💰 Valor de ${scheduleConfig[ev]?.label||'Evento'}${hour?` (${hour})`:''}: ${p.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`, confidence: 0.9 };
        }
        // Vagas: usar checkSlotAvailability
        if (wantsVacancy && hour){
            try{
                const scheduleStr = `${new Date(date+'T00:00:00').toLocaleDateString('pt-BR',{ weekday:'long' })} - ${hour}`;
                const ok = await checkSlotAvailability(date, scheduleStr, ev);
                const cap = getEventCapacity(ev, hour);
                return { answer: ok ? `✅ Há vagas no ${hour} (${cap} no total) para ${scheduleConfig[ev]?.label||'o evento'} em ${date.split('-').reverse().join('/')}.` : `❌ ${hour} está lotado para ${scheduleConfig[ev]?.label||'o evento'} em ${date.split('-').reverse().join('/')}.`, confidence: 0.85 };
            }catch(_){}
        }
    }
    // 3) Fallback leve: retorno vazio para usar canned
    return { answer: '', confidence: 0 };
}

// Inicializar chat
function initChat() {
    const chatToggle = document.getElementById('chatToggle');
    const chatWindow = document.getElementById('chatWindow');
    const chatClose = document.getElementById('chatClose');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const onlineStatus = document.getElementById('onlineStatus');
    const offlineStatus = document.getElementById('offlineStatus');
    
    if (!chatToggle || !chatWindow) return;
    
    // Verificar horário de atendimento
    let isOnline = isBusinessHours();
    
    if (isOnline) {
        onlineStatus.classList.remove('hidden');
        offlineStatus.classList.add('hidden');
        chatInput.disabled = false;
        chatSend.disabled = false;
        chatInput.placeholder = 'Digite sua mensagem...';
    } else {
        onlineStatus.classList.add('hidden');
        offlineStatus.classList.remove('hidden');
        chatInput.disabled = true;
        chatSend.disabled = true;
        chatInput.placeholder = 'Fora do horário de atendimento';
    }
    
    // Toggle chat window
    chatToggle.addEventListener('click', () => {
        chatWindow.classList.toggle('hidden');
        if (!chatWindow.classList.contains('hidden')) {
            chatInput.focus();
            // Carregar histórico quando abrir o chat
            loadChatHistory();
        }
    });
    
    // Fechar chat
    chatClose.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
    });
    
    // Enviar mensagem
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message || !isOnline) return;
        
        // Adicionar mensagem do usuário
        addMessage(message, 'user');
        chatInput.value = '';
        
        // Tenta primeiro resposta inteligente
        try{
            const smart = await smartChatAnswer(message);
            if (smart && smart.answer){
                showTypingIndicator();
                setTimeout(() => { hideTypingIndicator(); addMessage(smart.answer, 'support'); }, 1200);
                return;
            }
        }catch(_){}
        
        // Respostas prontas (FAQ curto). Se não bater, encaminha para WhatsApp
        const textLower = message.toLowerCase();
        const whatsNumber = '5511949830454';
        const whatsLink = `https://wa.me/${whatsNumber}?text=${encodeURIComponent('Olá! Preciso de ajuda no site XTreino Freitas.')}`;

        const canned = [
            // Valores e preços (prioridade alta)
            {
                match: ['valor','valores','preço','preços','quanto','custa','custo','precificar','orçamento','tabela','tabela de preços','preço dos','valor dos','quanto custa','quanto é','quanto sai','quanto fica','preço do','valor do','custo do','preço da','valor da','custo da','preço das','valor das','custo das','preço dos','valor dos','custo dos'],
                reply: '💰 **VALORES DOS PRODUTOS:**\n\n📱 **Sensibilidade no Free Fire:** R$ 8,00\n🗺️ **Imagens Aéreas:** A partir de R$ 2,00\n📊 **Planilha de Análise:** R$ 19,00\n🎮 **Passe de Elite:** R$ 11,00\n👕 **Camisa Oficial:** R$ 89,90\n\n🎯 **EVENTOS:**\n• **XTREINO FREITAS:** R$ 1,00 (1 token) - 14h às 23h\n• **XTREINO MODO LIGA:** R$ 3,00 - 14h, 15h, 17h, 18h\n• **CAMPEONATO FREITAS:** R$ 5,00 - 20h às 23h\n• **SEMANAL FREITAS:** R$ 3,50 - 20h, 21h, 22h\n\n💡 Precisa de mais detalhes sobre algum evento específico?'
            },
            
            // Horários e funcionamento (prioridade alta)
            {
                match: ['horário','horários','hora','horas','que horas','funcionamento','atendimento','quando','disponível','disponibilidade','aberto','fechado','funciona','trabalha','atende','expediente','jornada','turno','período','tempo','schedule','time','hours','working','available','open','closed','business hours','operating hours'],
                reply: '⏰ **HORÁRIOS DE FUNCIONAMENTO:**\n\n🕐 **Chat:** Disponível 24 horas\n🎮 **Treinos:** Geralmente entre 14h-23h\n📞 **WhatsApp:** Para dúvidas específicas\n\n💡 **DICAS:**\n• Eventos têm horários específicos\n• Tokens podem ser usados a qualquer hora\n• Suporte via WhatsApp é mais rápido para questões complexas'
            },
            {
                match: ['online','disponível','atendendo','suporte'],
                reply: '✅ **SUPORTE DISPONÍVEL:**\n\n🤖 **Chat:** Online 24 horas (respostas automáticas)\n📱 **WhatsApp:** Para atendimento personalizado\n🎮 **Treinos:** Segunda a sexta, 14h-23h\n\n💡 Para dúvidas específicas sobre pedidos, use o WhatsApp!'
            },
            
            // Tokens (prioridade alta)
            {
                match: ['token','tokens','comprar tokens','meus tokens','saldo','saldo de tokens','quantos tokens','tenho tokens','token balance','balance','crédito','créditos','moeda','moedas','pontos','pontuação','coin','coins','currency','wallet','carteira','dinheiro virtual','moeda virtual','comprar','adicionar tokens','recarregar','recarga','depositar','depósito','investir','investimento em tokens','token system','sistema de tokens','pagamento com token','pagar com token','usar token','gastar token','consumir token','token usado','tokens usados','token gasto','tokens gastos'],
                reply: 'Tokens custam R$ 1,00 cada. Compre e veja seu saldo em Minha Conta > Meus Tokens. Use tokens para pagar eventos!'
            },
            
            // Preços e valores (prioridade baixa - só se não for horário ou token)
            {
                match: ['preço','preços','valor','valores','quanto','cust','custa','quanto custa','quanto é','quanto vale','cobrança','cobrar','pagar','pagamento','dinheiro','reais','r$','barato','caro','econômico','custo','gasto','investimento','vale a pena','compensa','financeiro','monetário','tarifa','taxa','valor total','preço final','desconto','promoção','oferta','liquidação','sale','price','cost','money','cheap','expensive','affordable'],
                reply: 'Tokens: R$ 1,00 cada. Planilhas: R$ 19,00. Sensibilidades: R$ 8,00. Imagens Aéreas: R$ 2,00 por mapa. Camisa: R$ 89,90. Passe Booyah: R$ 11,00. Eventos: R$ 3,00-5,00.'
            },
            
            // Produtos digitais
            {
                match: ['sensibilidade','sensibilidades','sensis','configuração','config','configs','ajuste','ajustes','calibração','calibrar','mouse','teclado','dpi','fps','fps boost','otimização','otimizar','performance','rendimento','melhorar','melhoria','setup','settings','configurar','configurações','sens','sensibilidade do mouse','mouse sens','sens do mouse','sensibilidade da mira','mira','aim','apontar','apontamento','precisão','preciso','estabilidade','estável','controle','controlar','movimento','movimentação','crosshair','mira personalizada','personalizar','customizar','custom','personalização','personalizações','sensitivity','mouse sensitivity','aim sensitivity','game settings','jogo','gaming','gamer','free fire','ff','mobile','pc','android','ios','celular','computador','notebook','desktop','laptop','device','dispositivo','aparelho','equipamento','hardware','periférico','periféricos','mouse pad','mousepad','teclado mecânico','mechanical keyboard','gaming mouse','mouse gamer','teclado gamer','gaming keyboard','headset','fone','microfone','microphone','headphone','fone de ouvido','audio','som','sound','volume','vol','microfone','mic','micro','microfone gamer','gaming headset','headset gamer','fone gamer','gaming audio','audio gamer','som gamer','sound gamer','volume gamer','audio settings','configurações de áudio','configurações de som','configurações de audio','configurações de volume','configurações de microfone','configurações de mic','configurações de fone','configurações de headset','configurações de headphone','configurações de audio','configurações de som','configurações de volume','configurações de microfone','configurações de mic','configurações de fone','configurações de headset','configurações de headphone'],
                reply: 'Sensibilidades: R$ 8,00. Inclui configuração para PC/Android/iOS. Após compra, baixe em Minha Conta > Meus Produtos.'
            },
            {
                match: ['imagens aéreas','mapa','mapas','calls','bermuda','purgatório','kalahari','nova terra','alpine'],
                reply: 'Imagens Aéreas: R$ 2,00 por mapa. Escolha: Bermuda, Purgatório, Kalahari, Nova Terra, Alpine. Baixe em Minha Conta > Meus Produtos.'
            },
            {
                match: ['planilha','planilhas','analise','análise','coach','analista'],
                reply: 'Planilhas de Análise: R$ 19,00. Para coaches e analistas. Inclui dados precisos e gráficos. Download em Minha Conta > Meus Produtos.'
            },
            {
                match: ['passe','booyah','player id','id do jogador'],
                reply: 'Passe Booyah: R$ 11,00. Informe seu Player ID na compra. Após confirmação, um admin valida e entrega.'
            },
            {
                match: ['camisa','camiseta','roupa','física','entrega'],
                reply: 'Camisa Oficial: R$ 89,90. Produto físico com entrega. Escolha tamanho, cor, nome e endereço na compra.'
            },
            
            // Eventos e treinos
            {
                match: ['evento','eventos','treino','treinos','xtreino'],
                reply: '🎯 **EVENTOS DISPONÍVEIS:**\n\n• **XTREINO FREITAS:** R$ 1,00 (1 token) - 14h às 23h\n• **XTREINO MODO LIGA:** R$ 3,00 - 14h, 15h, 17h, 18h\n• **CAMPEONATO FREITAS:** R$ 5,00 - 20h às 23h\n• **SEMANAL FREITAS:** R$ 3,50 - 20h, 21h, 22h\n\nVeja na seção Eventos para mais detalhes!'
            },
            {
                match: ['modo liga','liga','competitivo'],
                reply: '🏆 **XTREINO MODO LIGA:**\n\n💰 **Valor:** R$ 3,00\n⏰ **Horários:** 14h, 15h, 17h, 18h\n🎮 **Modalidade:** Misto | Squad | 2 quedas | 15 slots\n🏅 **Premiação:** Vaga em campeonato pro top¹ da tabela\n📅 **Funcionamento:** Segunda a Sexta\n\n🎯 **Diferencial:** Transmissão modo liga ao vivo, montagem de cronograma, 15 slots e Troféu.'
            },
            {
                match: ['camp freitas','camp','campeonato'],
                reply: '🏆 **CAMPEONATO FREITAS SEASON⁴:**\n\n💰 **Valor:** R$ 14,00\n⏰ **Horários:** 20h, 21h, 22h, 23h\n🎮 **Modalidade:** Misto | Squad | 2 quedas nas fases | 5 quedas nas Semifinais | 8 quedas na final\n🏅 **Premiação:** R$ 2.000,00 + Troféu + MVP\n📅 **Funcionamento:** Segunda a Sexta\n\n🎯 **Diferencial:** Narrador e comentarista. Transmissão Ao vivo modo liga com logo na mochila e gelo a partir das semifinais + Sorteio de uma camisa Oficial da Org para os Patrocinadores.'
            },
            {
                match: ['semanal','semanal freitas'],
                reply: '🏆 **SEMANAL FREITAS:**\n\n💰 **Valor:** R$ 3,50\n⏰ **Horários:** 1ª Fase às 20h e 21h | Final às 22h\n🎁 **Bônus:** Vaga direto na Final por apenas R$ 7,00\n🎮 **Modalidade:** Misto | Squad | 2 quedas\n🏅 **Premiação:** R$ 65,00\n📅 **Funcionamento:** Segunda a Sexta\n\n🎯 **Diferencial:** Termina no mesmo dia + premiação em dinheiro pro top¹.'
            },
            {
                match: ['xtreino freitas','xtreino','token','tokens','treino normal'],
                reply: '🎯 **XTREINO FREITAS:**\n\n💰 **Valor:** R$ 1,00 (1 token)\n⏰ **Horários:** 14h, 15h, 16h, 17h, 18h, 19h, 20h, 21h, 22h, 23h\n🎮 **Modalidade:** Misto | Squad | 2 quedas\n🏅 **Premiação:** Vaga em Campeonato pro top¹ da tabela\n📅 **Funcionamento:** Segunda a Sexta\n\n🎯 **Sobre o Evento:** Xtreino que visa o treinamento e aperfeiçoamento de Equipes amadoras e profissionais, onde Coach pode telar seu Time para avaliá-los. Oferecemos Tabela de pontuação, Banner de top³, Transmissão ao Vivo, Verificados, Ranking de melhor equipe com Troféu e mais...\n\n🎯 **Diferencial:** 10 horários diários, montagem de cronograma e Troféu.'
            },
            
            // Conta e pedidos
            {
                match: ['minha conta','conta','login','entrar','cadastro','registro'],
                reply: 'Acesse Minha Conta no menu. Faça login ou cadastre-se. Lá você vê pedidos, tokens, downloads e mais!'
            },
            {
                match: ['pedido','pedidos','compra','compras','histórico'],
                reply: 'Veja seus pedidos em Minha Conta > Meus Pedidos. Lá aparecem links de WhatsApp e status dos pagamentos.'
            },
            {
                match: ['download','baixar','meus produtos','produtos'],
                reply: 'Downloads ficam em Minha Conta > Meus Produtos. Sensibilidades, mapas, planilhas - tudo lá!'
            },
            
            // WhatsApp e grupos
            {
                match: ['whatsapp','grupo','link do grupo','id e senha','sala','discord'],
                reply: 'Links de WhatsApp das salas aparecem em Minha Conta > Meus Pedidos quando seu pedido estiver confirmado.'
            },
            {
                match: ['contato','falar','ajuda','suporte','problema'],
                reply: 'Precisa de ajuda? Use este chat 24 horas ou WhatsApp: (11) 94983-0454. Chat sempre disponível!'
            },
            
            // Pagamento e cupons
            {
                match: ['pagamento','pagar','mercado pago','cartão','pix'],
                reply: 'Aceitamos Mercado Pago (cartão, PIX, boleto). Pagamento seguro e rápido. Cupons de desconto disponíveis!'
            },
            {
                match: ['cupom','desconto','promoção','promo','código'],
                reply: 'Cupons de desconto disponíveis! Digite o código na compra. Alguns são específicos para eventos ou loja.'
            },
            
            // Informações gerais
            {
                match: ['freitas','mario','quem é','sobre','empresa'],
                reply: 'XTreino Freitas - Treinamentos e produtos para Free Fire. Mario Freitas e equipe especializada em estratégia e performance.'
            },
            {
                match: ['free fire','ff','jogo','gaming'],
                reply: 'Especialistas em Free Fire! Treinos, estratégias, sensibilidades, mapas e muito mais para melhorar sua performance.'
            },
            {
                match: ['obrigado','valeu','thanks','obg'],
                reply: 'De nada! Fico feliz em ajudar. Qualquer dúvida, estou aqui! 😊'
            },
            {
                match: ['oi','olá','hello','hi','bom dia','boa tarde','boa noite'],
                reply: 'Olá! Bem-vindo ao XTreino Freitas! Como posso te ajudar hoje? 😊'
            }
        ];

        let matchedReply = '';
        
        // Sistema mais inteligente de matching
        for (const c of canned){
            let matchFound = false;
            
            // Verificar matches exatos
            if (c.match.some(k => textLower.includes(k))){
                matchFound = true;
            }
            
            // Verificar variações comuns
            if (!matchFound) {
                for (const keyword of c.match) {
                    // Variações com acentos
                    const variations = [
                        keyword,
                        keyword.replace('ç', 'c'),
                        keyword.replace('ã', 'a'),
                        keyword.replace('é', 'e'),
                        keyword.replace('í', 'i'),
                        keyword.replace('ó', 'o'),
                        keyword.replace('ú', 'u'),
                        keyword.replace('á', 'a'),
                        keyword.replace('ê', 'e'),
                        keyword.replace('ô', 'o'),
                        keyword.replace('â', 'a'),
                        keyword.replace('õ', 'o'),
                        keyword.replace('à', 'a'),
                        keyword.replace('è', 'e'),
                        keyword.replace('ì', 'i'),
                        keyword.replace('ò', 'o'),
                        keyword.replace('ù', 'u')
                    ];
                    
                    if (variations.some(v => textLower.includes(v))) {
                        matchFound = true;
                        break;
                    }
                }
            }
            
            // Verificar palavras similares (primeiras 3 letras)
            if (!matchFound) {
                for (const keyword of c.match) {
                    if (keyword.length >= 3) {
                        const prefix = keyword.substring(0, 3);
                        if (textLower.includes(prefix)) {
                            matchFound = true;
                            break;
                        }
                    }
                }
            }
            
            if (matchFound) {
                matchedReply = c.reply;
                break;
            }
        }

        if (!matchedReply){
            // Tentar responder com base em palavras-chave genéricas
            if (textLower.includes('planilha') || textLower.includes('analise') || textLower.includes('analise') || textLower.includes('coach') || textLower.includes('analista')) {
                matchedReply = 'Planilhas de Análise: R$ 19,00. Para coaches e analistas. Inclui dados precisos e gráficos. Download em Minha Conta > Meus Produtos.';
            } else if (textLower.includes('mapa') || textLower.includes('call') || textLower.includes('bermuda') || textLower.includes('purgatorio') || textLower.includes('kalahari') || textLower.includes('alpine') || textLower.includes('nova terra')) {
                matchedReply = 'Imagens Aéreas: R$ 2,00 por mapa. Escolha: Bermuda, Purgatório, Kalahari, Nova Terra, Alpine. Baixe em Minha Conta > Meus Produtos.';
            } else if (textLower.includes('evento') || textLower.includes('treino') || textLower.includes('xtreino') || textLower.includes('liga') || textLower.includes('camp') || textLower.includes('semanal')) {
                matchedReply = '🎯 **EVENTOS DISPONÍVEIS:**\n\n• **XTREINO FREITAS:** R$ 1,00 (1 token) - 14h às 23h\n• **XTREINO MODO LIGA:** R$ 3,00 - 14h, 15h, 17h, 18h\n• **CAMPEONATO FREITAS:** R$ 5,00 - 20h às 23h\n• **SEMANAL FREITAS:** R$ 3,50 - 20h, 21h, 22h\n\nVeja na seção Eventos para mais detalhes!';
            } else if (textLower.includes('conta') || textLower.includes('login') || textLower.includes('cadastro') || textLower.includes('registro')) {
                matchedReply = 'Acesse Minha Conta no menu. Faça login ou cadastre-se. Lá você vê pedidos, tokens, downloads e mais!';
            } else if (textLower.includes('download') || textLower.includes('baixar') || textLower.includes('produto')) {
                matchedReply = 'Downloads ficam em Minha Conta > Meus Produtos. Sensibilidades, mapas, planilhas - tudo lá!';
            } else if (textLower.includes('whatsapp') || textLower.includes('grupo') || textLower.includes('sala')) {
                matchedReply = 'Links de WhatsApp das salas aparecem em Minha Conta > Meus Pedidos quando seu pedido estiver confirmado.';
            } else if (textLower.includes('pagamento') || textLower.includes('pagar') || textLower.includes('mercado pago') || textLower.includes('cartao') || textLower.includes('pix')) {
                matchedReply = 'Aceitamos Mercado Pago (cartão, PIX, boleto). Pagamento seguro e rápido. Cupons de desconto disponíveis!';
            } else if (textLower.includes('cupom') || textLower.includes('desconto') || textLower.includes('promocao') || textLower.includes('promo')) {
                matchedReply = 'Cupons de desconto disponíveis! Digite o código na compra. Alguns são específicos para eventos ou loja.';
            } else {
                matchedReply = `❌ Não temos essa resposta no chat.\n\nChame no WhatsApp para saber melhor:\n\n📱 (11) 94983-0454\n\n🔗 [Clique aqui para abrir o WhatsApp](${whatsLink})`;
            }
        }
        
        // Mostrar indicador de "digitando..." e simular digitação com atraso de 4 segundos
        showTypingIndicator();
        setTimeout(() => {
            hideTypingIndicator();
            addMessage(matchedReply, 'support');
        }, 3000);
    }
    
    // Event listeners
    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Atualizar status a cada minuto
    setInterval(() => {
        const isOnlineNow = isBusinessHours();
        if (isOnlineNow !== isOnline) {
            isOnline = isOnlineNow;
            if (isOnline) {
                onlineStatus.classList.remove('hidden');
                offlineStatus.classList.add('hidden');
                chatInput.disabled = false;
                chatSend.disabled = false;
                chatInput.placeholder = 'Digite sua mensagem...';
            } else {
                onlineStatus.classList.add('hidden');
                offlineStatus.classList.remove('hidden');
                chatInput.disabled = true;
                chatSend.disabled = true;
                chatInput.placeholder = 'Fora do horário de atendimento';
            }
        }
    }, 60000);
}

// Mostrar indicador de "digitando..."
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Remover indicador anterior se existir
    const existingTyping = document.getElementById('typingIndicator');
    if (existingTyping) {
        existingTyping.remove();
    }
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'flex items-center space-x-2 p-3 bg-gray-100 rounded-lg mb-2';
    typingDiv.innerHTML = `
        <div class="flex space-x-1">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        </div>
        <span class="text-sm text-gray-500">Digitando...</span>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Esconder indicador de "digitando..."
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Adicionar mensagem ao chat
function addMessage(text, sender) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    const isUser = sender === 'user';
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
    // Converter links markdown para HTML clicável
    const textWithLinks = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="underline hover:no-underline">$1</a>');
    
    messageDiv.innerHTML = `
        <div class="${isUser ? 'bg-blue-matte text-white' : 'bg-gray-100'} rounded-lg p-3 max-w-xs">
            <p class="text-sm whitespace-pre-line">${textWithLinks}</p>
            <span class="text-xs ${isUser ? 'text-blue-100' : 'text-gray-500'}">${time}</span>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Salvar mensagem no histórico
    saveMessageToHistory(text, sender, now.toISOString());
}

// Salvar mensagem no histórico (localStorage)
function saveMessageToHistory(text, sender, timestamp) {
    try {
        const history = getChatHistory();
        history.push({ text, sender, timestamp });
        // Manter apenas as últimas 100 mensagens
        if (history.length > 100) {
            history.shift();
        }
        localStorage.setItem('chatHistory', JSON.stringify(history));
    } catch (e) {
        console.error('Erro ao salvar histórico:', e);
    }
}

// Carregar histórico do chat
function loadChatHistory() {
    try {
        const history = getChatHistory();
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Se não houver histórico, manter mensagem inicial
        if (history.length === 0) {
            // Verificar se já tem a mensagem inicial
            const hasInitialMessage = chatMessages.querySelector('.bg-gray-100');
            if (!hasInitialMessage) {
                chatMessages.innerHTML = `
                    <div class="flex justify-start">
                        <div class="bg-gray-100 rounded-lg p-3 max-w-xs">
                            <p class="text-sm text-gray-700">Olá! Como posso ajudá-lo hoje?</p>
                            <span class="text-xs text-gray-500">Agora</span>
                        </div>
                    </div>
                `;
            }
            return;
        }
        
        // Limpar mensagem inicial e adicionar histórico
        chatMessages.innerHTML = '';
        
        // Adicionar todas as mensagens do histórico
        history.forEach(msg => {
            const messageDiv = document.createElement('div');
            const isUser = msg.sender === 'user';
            const date = new Date(msg.timestamp);
            const time = date.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
            const textWithLinks = msg.text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="underline hover:no-underline">$1</a>');
            
            messageDiv.innerHTML = `
                <div class="${isUser ? 'bg-blue-matte text-white' : 'bg-gray-100'} rounded-lg p-3 max-w-xs">
                    <p class="text-sm whitespace-pre-line">${textWithLinks}</p>
                    <span class="text-xs ${isUser ? 'text-blue-100' : 'text-gray-500'}">${time}</span>
                </div>
            `;
            
            chatMessages.appendChild(messageDiv);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (e) {
        console.error('Erro ao carregar histórico:', e);
    }
}

// Obter histórico do localStorage
function getChatHistory() {
    try {
        const stored = localStorage.getItem('chatHistory');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

// Limpar histórico do chat
function clearChatHistory() {
    showConfirm('Limpar Histórico', 'Deseja limpar todo o histórico de conversas? Esta ação não pode ser desfeita.', 'Limpar', 'Cancelar').then((confirmed) => {
        if (confirmed) {
            localStorage.removeItem('chatHistory');
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="flex justify-start">
                        <div class="bg-gray-100 rounded-lg p-3 max-w-xs">
                            <p class="text-sm text-gray-700">Histórico limpo! Como posso ajudá-lo hoje?</p>
                            <span class="text-xs text-gray-500">Agora</span>
                        </div>
                    </div>
                `;
            }
            showSuccessToast('Histórico limpo com sucesso!');
        }
    });
}

// Enviar mensagem rápida (sugestões)
function sendQuickMessage(message) {
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    
    if (chatInput && chatSend && !chatInput.disabled) {
        chatInput.value = message;
        chatSend.click();
    }
}

// Abrir WhatsApp diretamente
function openWhatsAppDirect() {
    const whatsNumber = '5511949830454';
    const message = encodeURIComponent('Olá! Preciso de ajuda no site XTreino Freitas.');
    const whatsLink = `https://wa.me/${whatsNumber}?text=${message}`;
    window.open(whatsLink, '_blank');
}

// Carregar notícias do Firestore
async function loadNewsFromFirestore() {
    try {
        if (!window.firebaseDb) return;
        
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const newsRef = collection(window.firebaseDb, 'news');
        const snapshot = await getDocs(newsRef);
        
        const news = [];
        snapshot.forEach(doc => {
            news.push(doc.data());
        });
        
        // Ordenar por data (mais recente primeiro)
        news.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Guardar lista global para o modal
        window._newsList = news;

        // Garantir modal de notícia no DOM
        ensureNewsModal();

        // Renderizar notícias
        const container = document.getElementById('newsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (news.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex items-center justify-center py-12">
                    <p class="text-gray-500">Nenhuma notícia disponível no momento.</p>
                </div>
            `;
            return;
        }
        
        // Apply animations after rendering
        setTimeout(() => {
            reinitAnimations(container);
        }, 50);
        
        // função de truncar texto para o card
        const truncate = (txt, max = 160) => {
            try{
                const s = String(txt || '');
                if (s.length <= max) return s;
                return s.slice(0, max).trimEnd() + '…';
            }catch(_){ return ''; }
        };

        news.forEach((raw, idx) => {
            const newsItem = { ...raw };
            // Normalizar data (Timestamp do Firestore ou string)
            const asDate = newsItem.date?.toDate ? newsItem.date.toDate() : (newsItem.date ? new Date(newsItem.date) : new Date());
            // Normalizar imagem (aceita imageUrl ou image)
            newsItem.imageUrl = newsItem.imageUrl || newsItem.image || '';
            const newsCard = document.createElement('article');
            newsCard.className = 'bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-200';
            
            const date = asDate;
            const formattedDate = date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            // Determinar ícone baseado no tipo de notícia
            let iconClass = 'fas fa-newspaper';
            let category = 'Notícia';
            
            if (newsItem.title.toLowerCase().includes('evento') || newsItem.title.toLowerCase().includes('treino')) {
                iconClass = 'fas fa-calendar-alt';
                category = 'Evento';
            } else if (newsItem.title.toLowerCase().includes('aviso') || newsItem.title.toLowerCase().includes('pausa')) {
                iconClass = 'fas fa-bell';
                category = 'Aviso';
            } else if (newsItem.title.toLowerCase().includes('confirmado') || newsItem.title.toLowerCase().includes('verificado')) {
                iconClass = 'fas fa-check-circle';
                category = 'Confirmado';
            }
            
            const hasImage = newsItem.imageUrl && typeof newsItem.imageUrl === 'string';
            const headerHtml = hasImage
                ? `<div class="h-48 overflow-hidden bg-gray-100"><img src="${newsItem.imageUrl}" alt="${newsItem.title}" class="w-full h-48 object-cover" loading="lazy" referrerpolicy="no-referrer" /></div>`
                : '';

            const contentPreview = truncate(newsItem.content, 180);
            newsCard.innerHTML = `
                ${headerHtml}
                <div class="p-6">
                    <div class="text-sm text-blue-matte mb-2">${category}</div>
                    <h3 class="text-xl font-bold mb-3 text-gray-800">${newsItem.title}</h3>
                    <p class="text-gray-600 mb-4">${contentPreview}</p>
                    <div class="flex items-center justify-between text-sm text-gray-500 mb-3">
                        <span>Por: ${newsItem.author}</span>
                        <span>${formattedDate}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(newsCard);
        });
        
    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        const container = document.getElementById('newsContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full flex items-center justify-center py-12">
                    <p class="text-red-500">Erro ao carregar notícias.</p>
                </div>
            `;
        }
    }
}

// Modal de notícias
function ensureNewsModal(){
    if (document.getElementById('newsModal')) return;
    const modal = document.createElement('div');
    modal.id = 'newsModal';
    modal.className = 'fixed inset-0 z-50 hidden';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black bg-opacity-60" onclick="closeNewsModal()"></div>
        <div class="relative max-w-3xl w-[92%] md:w-[800px] mx-auto my-8 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div id="newsModalHeader"></div>
            <div class="p-6">
                <div class="text-sm text-blue-matte mb-2" id="newsModalCategory"></div>
                <h3 class="text-2xl font-bold mb-3 text-gray-800" id="newsModalTitle"></h3>
                <div class="text-sm text-gray-500 mb-4" id="newsModalMeta"></div>
                <div class="prose max-w-none text-gray-700" id="newsModalContent"></div>
                <div class="mt-6 flex justify-end">
                    <button class="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50" onclick="closeNewsModal()">Fechar</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    // Esc para fechar
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeNewsModal(); });
}

window.openNewsModal = function(index){
    const list = window._newsList || [];
    const item = list[index];
    if (!item) return;
    const date = item.date?.toDate ? item.date.toDate() : (item.date ? new Date(item.date) : new Date());
    const meta = `${item.author || ''} • ${date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })}`;
    const img = item.imageUrl || item.image || '';
    // Abrir imagem completa no modal
    const header = img ? `<img src="${img}" alt="${item.title||''}" class="w-full object-contain max-h-[70vh] bg-black" loading="lazy" referrerpolicy="no-referrer" />` : '';
    document.getElementById('newsModalHeader').innerHTML = header;
    document.getElementById('newsModalCategory').textContent = '';
    document.getElementById('newsModalTitle').textContent = item.title || '';
    document.getElementById('newsModalMeta').textContent = meta;
    document.getElementById('newsModalContent').textContent = item.content || '';
    document.getElementById('newsModal').classList.remove('hidden');
}

window.closeNewsModal = function(){
    const m = document.getElementById('newsModal');
    if (m) m.classList.add('hidden');
}

// Função para abrir modal do FAQ
window.openFAQModal = function(faqId) {
    const faqData = {
        'faq1': {
            title: 'Treinos Modo Liga',
            content: `
                <p>Os <strong>Treinos Modo Liga</strong> são compostos por <strong>2 quedas consecutivas</strong> (15 times) no formato competitivo.</p>
                <p>As partidas acontecem em <strong>salas Modo Liga</strong>, com visibilidade ativa, simulando o ambiente dos grandes campeonatos.</p>
                <p>O <strong>Top 1 de cada horário</strong> ganha vaga no <strong>Camp Freitas</strong> como premiação.</p>
                <p class="text-blue-600 font-medium">💡 <strong>Ideal para equipes que buscam treinar em formato profissional e conquistar espaço no cenário.</strong></p>
            `
        },
        'faq2': {
            title: 'Cancelamento de Inscrição',
            content: `
                <p>Após o pagamento, a inscrição não pode ser cancelada, pois o slot é reservado exclusivamente para sua equipe.</p>
                <p>Porém, se houver erro de horário, duplicidade ou imprevisto, entre em contato com o suporte antes do início da sala — analisamos caso a caso.</p>
                <p class="text-orange-600 font-medium">⚠ Sempre confirme o horário e nome da equipe antes de finalizar o pagamento.</p>
            `
        },
        'faq3': {
            title: 'Formas de Pagamento',
            content: `
                <p>Aceitamos:</p>
                <ul class="list-disc list-inside space-y-1 ml-4">
                    <li>Pix (instantâneo)</li>
                    <li>Pix Copia e Cola</li>
                    <li>Transferência bancária</li>
                    <li>PAYPAL (em casos específicos)</li>
                </ul>
                <p class="text-green-600 font-medium">⚡ Pagamentos confirmados garantem a vaga automaticamente.</p>
            `
        },
        'faq4': {
            title: 'Grupos das Salas',
            content: `
                <p>Assim que sua inscrição é confirmada, você recebe o link do grupo oficial (whatsapp), aqui mesmo no site. Vá em "meus pedidos" e clique em "acessar grupo de whatsapp"</p>
                <p>Lá serão enviadas as informações da sala (ID e senha) e as atualizações do cronograma.</p>
                <p class="text-blue-600 font-medium">💬 Fique atento — o ID e a Senha são enviados cerca de 10 minutos antes do início da partida.</p>
            `
        },
        'faq5': {
            title: 'Premiações',
            content: `
                <p>Sim! Em muitos horários, os Top 1 dos treinos recebem vagas gratuitas para os campeonatos ou bônus especiais.</p>
                <p>Além disso, os associados participam de premiações exclusivas e sorteios mensais.</p>
                <p class="text-yellow-600 font-medium">🎁 Treine, ganhe destaque e conquiste prêmios com a Org Freitas.</p>
            `
        },
        'faq6': {
            title: 'Benefícios de Associado',
            content: `
                <p>Os associados têm acesso a benefícios exclusivos, como:</p>
                <ul class="list-disc list-inside space-y-1 ml-4">
                    <li>Concorrer a campeonatos com vantagens</li>
                    <li>Concorrer a troféus e banners personalizados</li>
                    <li>Jogar até 10 horários por dia</li>
                    <li>Participar de ranking geral das melhores equipes do Mês</li>
                </ul>
                <p class="text-purple-600 font-medium">📢 Ser associado é ter prioridade e visibilidade dentro da comunidade Freitas.</p>
            `
        },
        'faq7': {
            title: 'Horários dos Treinos',
            content: `
                <p>Os X Treinos Freitas acontecem de segunda a sexta, das 14h às 23h (horário de Brasília).</p>
                <p>As vagas são limitadas e organizadas por horário.</p>
                <p class="text-blue-600 font-medium">💡 Compre suas vagas com antecedência e garanta seu espaço.</p>
            `
        },
        'faq8': {
            title: 'Resgate da Premiação',
            content: `
                <p>Após o resultado oficial ser divulgado, um representante da Org Freitas entrará em contato com o líder da equipe premiada via WhatsApp para confirmar os dados de pagamento.</p>
                <p>O prêmio é enviado diretamente ao responsável cadastrado na inscrição, dentro do prazo informado no regulamento.</p>
                <p class="text-green-600 font-medium">💬 Certifique-se de que o número de contato esteja correto no momento da inscrição para evitar atrasos no resgate.</p>
            `
        },
        'faq9': {
            title: 'Modalidade do Jogo',
            content: `
                <p>A modalidade é Misto, ou seja, permitimos jogadores de todas as plataformas (mobile, emulador e iPad).</p>
                <p class="text-blue-600 font-medium">💡 O foco é oferecer treinos equilibrados, acessíveis e competitivos para todos os estilos de jogo.</p>
            `
        }
    };

    const faq = faqData[faqId];
    if (faq) {
        document.getElementById('faqModalTitle').textContent = faq.title;
        document.getElementById('faqModalContent').innerHTML = faq.content;
        document.getElementById('faqModal').classList.remove('hidden');
    }
}

// Função para fechar modal do FAQ
window.closeFAQModal = function() {
    document.getElementById('faqModal').classList.add('hidden');
}

// ==================== SMOOTH ANIMATIONS SYSTEM ====================

// Initialize fade-in animations for cards
function initFadeInAnimations() {
    const cards = document.querySelectorAll('.product-card, .news-card, article');
    cards.forEach((card, index) => {
        card.classList.add('fade-in');
        if (index < 4) {
            card.classList.add(`fade-in-delay-${index + 1}`);
        }
        
        // Use Intersection Observer for better performance
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        observer.observe(card);
    });
}

// Initialize scroll reveal animations
function initScrollReveal() {
    const elements = document.querySelectorAll('section, h2, h3');
    elements.forEach(el => {
        el.classList.add('scroll-reveal');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        
        observer.observe(el);
    });
}

// Handle lazy loaded images
function initLazyImageAnimations() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
        // Se a imagem já está carregada, marcar como loaded imediatamente
        if (img.complete && img.naturalHeight !== 0) {
            img.classList.add('loaded');
        } else {
            // Adicionar listeners para quando a imagem carregar
            const handleLoad = () => {
                img.classList.add('loaded');
            };
            
            img.addEventListener('load', handleLoad);
            img.addEventListener('error', handleLoad); // Mostrar mesmo se houver erro
            
            // Fallback: se a imagem já carregou mas o evento não disparou
            if (img.complete) {
                setTimeout(() => {
                    if (!img.classList.contains('loaded')) {
                        img.classList.add('loaded');
                    }
                }, 100);
            }
        }
    });
    
    // Também verificar todas as imagens sem loading="lazy" para garantir que apareçam
    const allImages = document.querySelectorAll('img:not([loading="lazy"])');
    allImages.forEach(img => {
        img.style.opacity = '1'; // Forçar visibilidade
    });
}

// Main initialization function
function initSmoothAnimations() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initFadeInAnimations();
            initScrollReveal();
            initLazyImageAnimations();
        });
    } else {
        // DOM already loaded
        setTimeout(() => {
            initFadeInAnimations();
            initScrollReveal();
            initLazyImageAnimations();
        }, 100);
    }
}

// Re-initialize animations when new content is loaded (e.g., news, products)
function reinitAnimations(container) {
    if (!container) return;
    const newCards = container.querySelectorAll('.product-card, .news-card, article, .min-w-full');
    newCards.forEach((card, index) => {
        card.classList.add('fade-in');
        if (index < 4) {
            card.classList.add(`fade-in-delay-${index + 1}`);
        }
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        observer.observe(card);
    });
    
    // Also handle images in the container
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        if (img.hasAttribute('loading') && img.getAttribute('loading') === 'lazy') {
            // Imagens lazy
            if (img.complete && img.naturalHeight !== 0) {
                img.classList.add('loaded');
            } else {
                const handleLoad = () => {
                    img.classList.add('loaded');
                };
                img.addEventListener('load', handleLoad);
                img.addEventListener('error', handleLoad);
                
                // Fallback
                if (img.complete) {
                    setTimeout(() => {
                        if (!img.classList.contains('loaded')) {
                            img.classList.add('loaded');
                        }
                    }, 100);
                }
            }
        } else {
            // Imagens sem lazy - garantir que apareçam
            img.style.opacity = '1';
        }
    });
}

// Make functions globally available
window.reinitAnimations = reinitAnimations;
window.initSmoothAnimations = initSmoothAnimations;

// --- Agendamento nativo (Firestore + Netlify Function) ---
const scheduleConfig = {
    'modo-liga': { label: 'XTreino Modo Liga', price: 3.00 },
    'camp-freitas': { label: 'Camp Freitas', price: 14.00 },
    'semanal-freitas': { label: 'Semanal Freitas', price: 3.50 },
    'xtreino-tokens': { label: 'XTreino Tokens', price: 1.00, payWithToken: true },
    // Produtos da loja virtual
    'sensibilidades': { label: 'Sensibilidade no Free Fire – PC / Android / iOS', price: 8.00, isProduct: true },
    'imagens': { label: 'Imagens Aéreas dos Mapas', price: 2.00, isProduct: true },
    'planilhas': { label: 'Planilha de Análise de Times', price: 19.00, isProduct: true },
    'passe-booyah': { label: 'Passe de Elite', price: 11.00, isProduct: true },
    'camisa': { label: 'Camisa Oficial Org Freitas', price: 89.90, isProduct: true }
};

// Função para controlar a exibição da seleção de marcas Android
function handlePlatformChange() {
    const platformSelect = document.getElementById('platformSelect');
    const androidBrandContainer = document.getElementById('androidBrandContainer');
    const androidBrandSelect = document.getElementById('androidBrandSelect');
    
    if (platformSelect && androidBrandContainer && androidBrandSelect) {
        if (platformSelect.value === 'android') {
            androidBrandContainer.classList.remove('hidden');
            androidBrandSelect.required = true;
        } else {
            androidBrandContainer.classList.add('hidden');
            androidBrandSelect.required = false;
            androidBrandSelect.value = '';
        }
    }
}

// Função para adicionar opções específicas de cada produto
function addProductOptions(productId) {
    // Limpar opções anteriores
    const optionsContainer = document.getElementById('productOptions');
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
    } else {
        // Criar container se não existir
        const container = document.createElement('div');
        container.id = 'productOptions';
        container.className = 'mt-6';
        
        // Inserir antes da seção "Finalizar Reservas" (Payment Section)
        const paymentSection = document.querySelector('#schedForm .bg-white.rounded-2xl.p-6.border.border-gray-200:last-child');
        if (paymentSection) {
            paymentSection.parentNode.insertBefore(container, paymentSection);
        } else {
            // Fallback: inserir no final do formulário
            const form = document.getElementById('schedForm');
            if (form) {
                form.appendChild(container);
            }
        }
    }
    
    const container = document.getElementById('productOptions');
    
    switch (productId) {
        case 'sensibilidades':
            // Sensibilidades com seleção de plataforma
            container.innerHTML = `
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </div>
                        <h4 class="text-lg font-semibold text-gray-800">Configuração Completa</h4>
                    </div>
                    <p class="text-gray-600 text-sm mb-4">Inclui: Sensibilidade otimizada, Pack de Otimização, Configuração Completa, Aprimoramento de Mira e Reação.</p>
                    
                    <div class="space-y-3">
                        <label class="block text-sm font-medium text-gray-700">
                            <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg>
                            Escolha sua plataforma:
                        </label>
                        <select id="platformSelect" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700" onchange="handlePlatformChange()">
                            <option value="">Selecione uma plataforma</option>
                            <option value="pc">🖥️ PC (Windows)</option>
                            <option value="android">📱 Android</option>
                            <option value="ios">🍎 iOS (iPhone/iPad)</option>
                        </select>
                        
                        <div id="androidBrandContainer" class="hidden">
                            <label class="block text-sm font-medium text-gray-700">
                                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                </svg>
                                Escolha a marca do seu dispositivo:
                            </label>
                            <select id="androidBrandSelect" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700">
                                <option value="">Selecione a marca</option>
                                <option value="samsung">📱 Samsung</option>
                                <option value="motorola">📱 Motorola</option>
                                <option value="lg">📱 LG</option>
                                <option value="xiaomi">📱 Xiaomi</option>
                            </select>
                        </div>
                        
                        <p class="text-xs text-gray-500">O arquivo será personalizado para sua plataforma e dispositivo escolhidos</p>
                    </div>
                </div>
            `;
            break;
            
        case 'imagens':
            // Opções para imagens aéreas (checkboxes com IDs padronizados)
            container.innerHTML = `
                <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                            </svg>
                        </div>
                        <h4 class="text-lg font-semibold text-gray-800">Selecionar Mapas</h4>
                    </div>
                    <div class="grid md:grid-cols-2 gap-4">
                        <label class="flex items-center gap-3 p-3 border rounded-lg bg-white"><input type="checkbox" name="mapOption" value="bermuda" class="w-4 h-4"> <span>Bermuda</span></label>
                        <label class="flex items-center gap-3 p-3 border rounded-lg bg-white"><input type="checkbox" name="mapOption" value="purgatorio" class="w-4 h-4"> <span>Purgatório</span></label>
                        <label class="flex items-center gap-3 p-3 border rounded-lg bg-white"><input type="checkbox" name="mapOption" value="kalahari" class="w-4 h-4"> <span>Kalahari</span></label>
                        <label class="flex items-center gap-3 p-3 border rounded-lg bg-white"><input type="checkbox" name="mapOption" value="alpina" class="w-4 h-4"> <span>Alpine</span></label>
                        <label class="flex items-center gap-3 p-3 border rounded-lg bg-white"><input type="checkbox" name="mapOption" value="novaterra" class="w-4 h-4"> <span>Nova Terra</span></label>
                        </div>
                    <div class="mt-4 bg-blue-100 rounded-lg p-3">
                        <div class="flex items-center">
                            <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="text-sm text-blue-800 font-medium">Preços: 1 mapa R$2 | 2 por R$4 | 3 por R$5 | 4 por R$6 | 5 por R$7 • Selecionados: <b id="mapsCount">0</b> • Total: <b id="mapsPrice">R$ 0,00</b></span>
                        </div>
                    </div>
                </div>
            `;
            // Atualizar contagem/preço conforme seleção
            (function(){
                const prices = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 }; // Ajustado: 4 mapas = R$ 6,00
                const update = () => {
                    const count = document.querySelectorAll('input[name="mapOption"]:checked').length;
                    const price = prices[count] || (count>5?prices[5]:0);
                    const c = document.getElementById('mapsCount'); if (c) c.textContent = String(count);
                    const p = document.getElementById('mapsPrice'); if (p) p.textContent = `R$ ${price.toFixed(2)}`;
                };
                document.querySelectorAll('input[name="mapOption"]').forEach(i=>i.addEventListener('change', update));
                update();
            })();
            break;
            
        case 'planilhas':
            // Planilhas
            container.innerHTML = `
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                        </div>
                        <h4 class="text-lg font-semibold text-gray-800">Análises Profissionais</h4>
                    </div>
                    <p class="text-gray-600 text-sm">Para coachs e analistas: análises (kills, dano, tempo), gráficos, ajuste total e vídeo explicativo.</p>
                </div>
            `;
            break;
            
        case 'passe-booyah':
            // Opções para passe Booyah
            container.innerHTML = `
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <h4 class="text-lg font-semibold text-gray-800">Informações do Jogo</h4>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">ID do Jogador (Free Fire)</label>
                        <input type="text" id="playerId" placeholder="Ex.: 123456789" 
                               class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none transition-colors">
                    </div>
                    
                    <div class="mt-4 bg-green-100 rounded-lg p-3">
                        <div class="flex items-center">
                            <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="text-sm text-green-800 font-medium">Entrega rápida! Não pedimos senha/email, apenas o ID.</span>
                        </div>
                    </div>
                </div>
            `;
            break;
            
        case 'camisa':
            // Opções para camisa
            container.innerHTML = `
                <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                        </div>
                        <h4 class="text-lg font-semibold text-gray-800">Informações da Camisa</h4>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tamanho</label>
                            <select id="shirtSize" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                                <option value="P">P</option>
                                <option value="M" selected>M</option>
                                <option value="G">G</option>
                                <option value="GG">GG</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Nome na Camisa</label>
                            <input id="shirtName" type="text" placeholder="Ex.: FREITAS" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                            <input id="addrNome" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                            <input id="customerCPF" type="text" placeholder="000.000.000-00" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                            <input id="addrCEP" type="text" placeholder="00000-000" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                            <input id="addrRua" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Número</label>
                            <input id="addrNumero" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
                            <input id="addrComplemento" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Bairro</label>
                            <input id="addrBairro" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                            <input id="addrCidade" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                            <input id="addrEstado" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors" />
                        </div>
                    </div>
                    
                    <div class="mt-4 bg-purple-100 rounded-lg p-3">
                        <div class="flex items-center">
                            <svg class="w-4 h-4 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="text-sm text-purple-800 font-medium">Produto físico - será enviado pelo correio</span>
                        </div>
                    </div>
                </div>
            `;
            break;
    }
    
    // Adicionar event listeners para atualizar preço dinamicamente
    if (productId === 'imagens') {
        const qtyInput = document.getElementById('mapsQty');
        const namesInput = document.getElementById('mapsNames');
        
        if (qtyInput) {
            qtyInput.addEventListener('input', () => updateProductPrice(productId));
        }
        if (namesInput) {
            namesInput.addEventListener('input', () => syncMapsQtyWithNames());
        }
    }
}

// Função para atualizar preço baseado nas opções
function updateProductPrice(productId) {
    const cfg = scheduleConfig[productId];
    if (!cfg) return;
    
    let finalPrice = cfg.price;
    
    if (productId === 'imagens') {
        const qty = parseInt(document.getElementById('mapsQty')?.value || 1);
        // Preços: 1 mapa R$2 | 2 por R$4 | 3 por R$5 | 5 por R$7
        const prices = { 1: 2, 2: 4, 3: 5, 4: 5, 5: 7 };
        finalPrice = prices[qty] || 2;
    }
    
    document.getElementById('schedPrice').textContent = finalPrice.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

// Função para sincronizar quantidade com nomes de mapas
function syncMapsQtyWithNames() {
    const namesInput = document.getElementById('mapsNames');
    const qtyInput = document.getElementById('mapsQty');
    
    if (namesInput && qtyInput) {
        const names = namesInput.value.split(',').map(s => s.trim()).filter(Boolean);
        if (names.length > 0) {
            qtyInput.value = names.length;
            updateProductPrice('imagens');
        }
    }
}

// Global variables for multiple reservations
let selectedTimes = [];
let teams = [];
let teamCounter = 0;
let selectedDates = [];

function openScheduleModal(eventType){
    const cfg = scheduleConfig[eventType];
    const modal = document.getElementById('scheduleModal');
    if (!cfg || !modal) return;
    
    // Reset global variables
    selectedTimes = [];
    teams = [];
    teamCounter = 0;
    
    modal.dataset.eventType = eventType;
    document.getElementById('schedPrice').textContent = cfg.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('schedEventType').textContent = cfg.label;

    // Mostrar/ocultar seção de cupom conforme tipo de pagamento
    (function(){
        const couponSection = document.getElementById('scheduleCouponSection');
        if (couponSection){
            // Esconde cupom quando pagamento é via tokens
            couponSection.style.display = cfg.payWithToken ? 'none' : 'block';
        }
        if (cfg.payWithToken){
            // Garante que nenhum cupom de agendamento fique aplicado
            try { window.appliedScheduleCoupon = null; } catch(_) {}
            const msg = document.getElementById('schedCouponMessage');
            if (msg){ msg.classList.add('hidden'); msg.textContent = ''; }
            const input = document.getElementById('schedCouponCodeInput');
            if (input){ input.value = ''; }
        }
    })();
    
    // Initialize with one team
    addTeam();
    
    // Sincronizar tokens do usuário antes de qualquer checagem
    try { if (typeof syncUserTokens === 'function') { syncUserTokens(); } } catch(_) {}

    // Ocultar botão de tokens (não usamos compra de tokens)
    const hideBuyTokens = document.getElementById('buyTokensBtn');
    if (hideBuyTokens) hideBuyTokens.classList.add('hidden');
    
    // Se for produto da loja, esconder seleção de data/hora e adicionar opções específicas
    if (cfg.isProduct) {
        // Esconder TODAS as seções de data e horários para produtos
        const grid = document.querySelector('#scheduleModal .lg\\:grid-cols-2');
        const leftColumn = document.querySelector('#scheduleModal .lg\\:grid-cols-2 > div:first-child');
        if (leftColumn) {
            leftColumn.style.display = 'none';
        }
        // Expandir coluna direita para 100% quando produto (ex.: Sensibilidades)
        if (grid) {
            grid.classList.remove('lg:grid-cols-2');
            grid.classList.add('grid-cols-1');
        }
        
        // Esconder seções específicas para produtos
        const reservationsSummarySection = document.getElementById('reservationsSummarySection');
        if (reservationsSummarySection) {
            reservationsSummarySection.style.display = 'none';
        }
        
        const teamsSection = document.getElementById('teamsSection');
        if (teamsSection) {
            teamsSection.style.display = 'none';
        }
        
        // Alterar texto do botão para "Finalizar Compra" quando for produto
        const submitBtn = document.getElementById('schedSubmit');
        if (submitBtn) {
            submitBtn.textContent = '🛒 Finalizar Compra';
        }
        
        console.log('Modal de produto aberto - coluna esquerda escondida');
        
        // Esconder botão "Comprar tokens"
        const buyTokensBtn = document.getElementById('buyTokensBtn');
        if (buyTokensBtn) buyTokensBtn.classList.add('hidden');
        
        // Adicionar opções específicas do produto
        addProductOptions(eventType);
        
        // Mostrar modal
        modal.classList.remove('hidden');
        return;
    }
    
    // Para eventos, mostrar seleção de data/hora
    const leftColumn = document.querySelector('#scheduleModal .lg\\:grid-cols-2 > div:first-child');
    if (leftColumn) {
        leftColumn.style.display = 'block';
    }
    
    // Mostrar seções específicas para eventos
    const reservationsSummarySection = document.getElementById('reservationsSummarySection');
    if (reservationsSummarySection) {
        reservationsSummarySection.style.display = 'block';
    }
    
    const teamsSection = document.getElementById('teamsSection');
    if (teamsSection) {
        teamsSection.style.display = 'block';
    }
    
    // Restaurar texto original do botão para eventos
    const submitBtn = document.getElementById('schedSubmit');
    if (submitBtn) {
        submitBtn.textContent = '✅ Confirmar e Pagar';
    }
    
    // Se havia opções de produto (ex.: seleção de mapas), remover ao abrir um evento
    const prodOpts = document.getElementById('productOptions');
    if (prodOpts && prodOpts.parentNode) {
        prodOpts.parentNode.removeChild(prodOpts);
    }
    // Garantir grid em 2 colunas para eventos
    const gridEv = document.querySelector('#scheduleModal .grid');
    if (gridEv) {
        gridEv.classList.remove('grid-cols-1');
        if (!gridEv.classList.contains('lg:grid-cols-2')) gridEv.classList.add('lg:grid-cols-2');
    }
    
    // Garantir que o botão de tokens permaneça oculto
    const buyTokensBtn = document.getElementById('buyTokensBtn');
    if (buyTokensBtn) buyTokensBtn.classList.add('hidden');
    
    initScheduleDate();
    // Ajustar limites de data por tipo de evento
    (function(){
        const dateInput = document.getElementById('schedDate');
        if (!dateInput) return;
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth()+1).padStart(2,'0');
        const d = String(today.getDate()).padStart(2,'0');
        const todayStr = `${y}-${m}-${d}`;
        // Para camp-freitas, travar compra apenas para HOJE
        if (eventType === 'camp-freitas') {
            dateInput.min = todayStr;
            dateInput.max = todayStr;
            dateInput.value = todayStr;
            updateSelectedDate();
        } else {
            // Para outros eventos, permitir de hoje em diante
            dateInput.min = todayStr;
            dateInput.removeAttribute('max');
        }
    })();
    // re-render quando a data mudar
    const dateInput = document.getElementById('schedDate');
    if (dateInput && !dateInput._schedBound){
        dateInput.addEventListener('change', () => {
            updateSelectedDate();
            renderScheduleTimes();
        });
        dateInput._schedBound = true;
    }
    // Resetar datas múltiplas selecionadas ao abrir
    selectedDates = [];
    renderSelectedDatesList();
    renderScheduleTimes();
    // Preenche dados se logado
    try{
        if (window.isLoggedIn && window.currentUserProfile){
            const p = window.currentUserProfile;
            const team = document.getElementById('schedTeam');
            const email = document.getElementById('schedEmail');
            const phone = document.getElementById('schedPhone');
            if (team) team.value = p.teamName || '';
            if (email) email.value = p.email || '';
            if (phone) phone.value = p.phone || '';
        }
    }catch(_){ }
    modal.classList.remove('hidden');
    
    // Ajustes para mobile
    if (window.innerWidth <= 767) {
        document.body.classList.add('modal-open-mobile');
        // Força o modal a ocupar toda a tela no mobile
        const modalContent = modal.querySelector('div');
        if (modalContent) {
            modalContent.style.height = '100vh';
            modalContent.style.maxHeight = '100vh';
            modalContent.style.overflowY = 'auto';
            modalContent.style.webkitOverflowScrolling = 'touch';
        }
    }
    
    const hint = document.getElementById('schedHint');
    if (hint) hint.textContent = cfg.label;
    
    // Atualizações periódicas e ao voltar o foco (evita tela antiga ficar válida)
    try{
        if (window.__schedRefreshInterval) { clearInterval(window.__schedRefreshInterval); window.__schedRefreshInterval = null; }
        window.__schedRefreshInterval = setInterval(()=>{ try{ renderScheduleTimes(); }catch(_){ } }, 60000); // 60s
        // Handlers para quando o usuário volta à aba/janela
        window.__schedVisibilityHandler = ()=>{ if (document.visibilityState === 'visible') { try{ renderScheduleTimes(); }catch(_){ } } };
        window.__schedFocusHandler = ()=>{ try{ renderScheduleTimes(); }catch(_){ } };
        document.addEventListener('visibilitychange', window.__schedVisibilityHandler);
        window.addEventListener('focus', window.__schedFocusHandler);
    }catch(_){ }
}
function closeScheduleModal(){
    const modal = document.getElementById('scheduleModal');
    if (modal) {
        modal.classList.add('hidden');
        // Remove estilos inline aplicados no mobile
        const modalContent = modal.querySelector('div');
        if (modalContent && window.innerWidth <= 767) {
            modalContent.style.height = '';
            modalContent.style.maxHeight = '';
            modalContent.style.overflowY = '';
            modalContent.style.webkitOverflowScrolling = '';
        }
        // Restaurar grid padrão (2 colunas) quando fechar o modal de produto
        const grid = document.querySelector('#scheduleModal .grid');
        if (grid) {
            grid.classList.remove('grid-cols-1');
            if (!grid.classList.contains('lg:grid-cols-2')) grid.classList.add('lg:grid-cols-2');
        }
        
        // Limpar times e resetar contador quando fechar o modal
        const teamsContainer = document.getElementById('teamsContainer');
        if (teamsContainer) {
            teamsContainer.innerHTML = '';
        }
        teams = [];
        teamCounter = 0;
        selectedTimes = [];
        selectedDates = [];
        
        // Limpar resumo de reservas
        const summaryContainer = document.getElementById('reservationsSummary');
        if (summaryContainer) {
            summaryContainer.innerHTML = '<p class="text-gray-600">Nenhuma reserva selecionada</p>';
        }
        const totalPriceElement = document.getElementById('totalPrice');
        if (totalPriceElement) {
            totalPriceElement.textContent = 'R$ 0,00';
        }
    }
    // Remover timers/handlers de atualização
    try{
        if (window.__schedRefreshInterval) { clearInterval(window.__schedRefreshInterval); window.__schedRefreshInterval = null; }
        if (window.__schedVisibilityHandler) { document.removeEventListener('visibilitychange', window.__schedVisibilityHandler); window.__schedVisibilityHandler = null; }
        if (window.__schedFocusHandler) { window.removeEventListener('focus', window.__schedFocusHandler); window.__schedFocusHandler = null; }
    }catch(_){ }
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}
// Renderizar lista de datas selecionadas para agendamento múltiplo
function renderSelectedDatesList(){
    const list = document.getElementById('selectedDatesList');
    if (!list) return;
    if (!selectedDates || selectedDates.length === 0){
        list.innerHTML = '';
        updateReservationsSummary();
        return;
    }
    const fmt = (d)=> {
        try{
            const [y,m,dd] = d.split('-').map(n=>parseInt(n,10));
            const date = new Date(y, m-1, dd);
            return date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', weekday:'short' });
        }catch(_){ return d; }
    };
    list.innerHTML = selectedDates.map(d=>(
        `<div class="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span>${fmt(d)}</span>
            <button type="button" class="text-red-600 hover:text-red-800 text-xs" onclick="removeSelectedDate('${d}')">remover</button>
         </div>`
    )).join('');
    updateReservationsSummary();
}
function addSelectedDate(){
    const input = document.getElementById('schedDate');
    const modal = document.getElementById('scheduleModal');
    const eventType = modal?.dataset?.eventType || null;
    if (!input || !input.value) return;
    const date = input.value;
    if (!isValidScheduleDate(date, eventType)) {
        alert('Data inválida para este evento.');
        return;
    }
    if (!selectedDates.includes(date)){
        selectedDates.push(date);
        renderSelectedDatesList();
    }
}
function removeSelectedDate(dateStr){
    selectedDates = selectedDates.filter(d => d !== dateStr);
    renderSelectedDatesList();
}
function clearSelectedDates(){
    selectedDates = [];
    renderSelectedDatesList();
}
function initScheduleDate(){
    const input = document.getElementById('schedDate');
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,'0');
    const d = String(today.getDate()).padStart(2,'0');
    input.value = `${y}-${m}-${d}`;
}
function setSchedToday(){ 
    initScheduleDate(); 
    updateSelectedDate();
    renderScheduleTimes(); 
}
function setSchedTomorrow(){
    const input = document.getElementById('schedDate');
    const t = new Date();
    t.setDate(t.getDate()+1);
    const y = t.getFullYear();
    const m = String(t.getMonth()+1).padStart(2,'0');
    const d = String(t.getDate()).padStart(2,'0');
    input.value = `${y}-${m}-${d}`;
    updateSelectedDate();
    renderScheduleTimes();
}

// Função para atualizar a data selecionada
function updateSelectedDate() {
    const dateInput = document.getElementById('schedDate');
    const selectedDateDisplay = document.getElementById('schedSelectedDate');
    if (dateInput && selectedDateDisplay) {
        const raw = dateInput.value;
        let date = null;
        if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            // Criar Date no fuso local para evitar retroceder um dia (UTC)
            const [y, m, d] = raw.split('-').map(n => parseInt(n, 10));
            date = new Date(y, m - 1, d);
        } else if (raw) {
            // Fallback seguro: normalizar para meia-noite local
            const tmp = new Date(raw);
            if (!isNaN(tmp.getTime())) {
                date = new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
            }
        }
        selectedDateDisplay.textContent = (date && !isNaN(date.getTime()))
            ? date.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : '--';
    }
}
const scheduleCache = {};

// Capacidade de vagas por tipo de evento e horário (casos especiais)
function getEventCapacity(eventType, hourStr){
    const type = String(eventType||'').toLowerCase();
    const hour = String(hourStr||'').toLowerCase().replace(/\s/g,'');
    // Modo liga: 15
    if (type === 'modo-liga') return 15;
    // Semanal Freitas 22h: capacidade 4
    if (type === 'semanal-freitas' && (hour === '22h' || hour.includes('22'))) return 4;
    // Demais: 12
    return 12;
}

// Preço por tipo de evento e horário (casos especiais)
function getEventPrice(eventType, hourStr, dateStr){
    const type = String(eventType||'').toLowerCase();
    const hour = String(hourStr||'').toLowerCase().replace(/\s/g,'');
    const dateIso = dateStr || (document.getElementById('schedDate')?.value || null);
    // Semanal Freitas 22h: R$ 7,00 (vaga direto na final)
    if (type === 'semanal-freitas' && (hour === '22h' || hour.includes('22'))) return 7.00;
    // Camp Freitas PROMO: dias específicos a R$20,00
    try{
        if (type === 'camp-freitas' && dateIso){
            // Datas em ISO (YYYY-MM-DD)
            const promos = {
                '2025-11-13': ['21h','22h','23h'],
                '2025-11-14': ['20h']
            };
            const hours = promos[dateIso];
            if (hours && hours.includes(hour)) return 20.00;
        }
    }catch(_){}
    // Padrão: usar preço do config
    const cfg = scheduleConfig[eventType] || {};
    return Number(cfg.price || 0);
}

// Valida se a data é válida para agendamento (segunda a sexta, não passado)
function isValidScheduleDate(dateStr, eventType){
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Regras específicas por evento
    if (eventType === 'camp-freitas') {
        // Camp de Fases: somente no dia atual
        return date.getTime() === today.getTime();
    }
    
    // Não pode ser no passado (padrão)
    if (date < today) return false;
    
    // Só segunda a sexta (1-5)
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
}

async function renderScheduleTimes(){
    const timesWrap = document.getElementById('schedTimes');
    if (!timesWrap) return;
    timesWrap.innerHTML = '';
    const date = document.getElementById('schedDate').value;
    // eventType do modal atual
    const modal = document.getElementById('scheduleModal');
    const eventType = modal?.dataset?.eventType || null;
    
    // Valida data antes de renderizar
    if (!isValidScheduleDate(date, eventType)){
        const msg = (eventType === 'camp-freitas')
            ? 'Para o Campeonato de Fases, as vagas só podem ser compradas para HOJE.'
            : 'Agendamentos apenas de segunda a sexta-feira e não em datas passadas.';
        timesWrap.innerHTML = `<p class="text-red-500 text-center py-4">${msg}</p>`;
        return;
    }
    
    const dayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const d = new Date(date + 'T00:00:00');
    const day = dayNames[d.getDay()];
    
    // Definir horários baseados no tipo de evento
    let slots = [];
    if (eventType === 'xtreino-tokens') {
        // XTreino Tokens: 14h às 23h
        slots = ['14h','15h','16h','17h','18h','19h','20h','21h','22h','23h'];
    } else if (eventType === 'modo-liga') {
        // XTreino Modo Liga: 14h às 23h
        slots = ['14h','15h','16h','17h','18h','19h','20h','21h','22h','23h'];
    } else if (eventType === 'camp-freitas') {
        // Camp Freitas: verificar se é hoje - se for, apenas 20h
        const now = new Date();
        const selectedDate = new Date(date + 'T00:00:00');
        const isToday = selectedDate.toDateString() === now.toDateString();
        
        if (isToday) {
            // Hoje: apenas 20h disponível
            slots = ['20h'];
        } else {
            // Outros dias: 19h às 23h
            slots = ['19h','20h','21h','22h','23h'];
        }
    } else if (eventType === 'semanal-freitas') {
        // Semanal Freitas: 19h, 20h, 21h, 22h
        slots = ['19h','20h','21h','22h'];
    } else {
        // Fallback padrão
        slots = ['19h','20h','21h','22h','23h'];
    }
    const now = new Date();
    const selectedDate = new Date(date + 'T00:00:00');
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    
    // Render imediato com estado neutro e atualiza assíncrono
    slots.forEach(time => {
        const schedule = `${day} - ${time}`;
        const btn = document.createElement('button');
        btn.className = 'slot-btn';
        btn.dataset.schedule = schedule;
        
        // Verificar se o horário já passou (apenas para hoje)
        let isPastTime = false;
        if (isToday) {
            const hour = parseInt(time.replace('h', ''));
            const currentHour = now.getHours();
            isPastTime = hour <= currentHour;
        }
        
        if (isPastTime) {
            btn.className = 'slot-btn bg-gray-300 text-gray-500 cursor-not-allowed';
            btn.disabled = true;
            btn.textContent = `${time} (Horário passou)`;
            btn.onclick = null;
        } else if (eventType === 'semanal-freitas' && time === '19h') {
            // Semanal Freitas: 19h sempre esgotado
            btn.className = 'slot-btn bg-red-100 text-red-600 cursor-not-allowed';
            btn.disabled = true;
            btn.textContent = `${time} (Lotado)`;
            btn.onclick = null;
        } else {
            btn.textContent = `${time} (.. /${String(getEventCapacity(eventType, time)).padStart(2,'0')})`;
            btn.onclick = ()=>{ 
                document.getElementById('schedSelectedTime').value = schedule; 
                document.getElementById('schedSelectedTimeDisplay').textContent = time;
                highlightSelectedSlot(btn, timesWrap); 
            };
        }
        
        timesWrap.appendChild(btn);
    });
    // Atualiza com dados reais e mantém em tempo real
    updateOccupiedAndRefreshButtons(day, date, eventType, timesWrap);
    try{
        const { collection, query, where, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        if (window.__schedUnsub) { try{ window.__schedUnsub(); }catch(_){ } }
        const baseQ = [ where('date','==', date) ];
        if (eventType) baseQ.push(where('eventType','==', eventType));
        window.__schedUnsub = onSnapshot(
            query(collection(window.firebaseDb,'registrations'), ...baseQ),
            ()=> updateOccupiedAndRefreshButtons(day, date, eventType, timesWrap)
        );
    }catch(_){ }
}
function highlightSelectedSlot(selectedBtn, container){
    Array.from(container.children).forEach(el=> el.classList.remove('selected'));
    selectedBtn.classList.add('selected');
}
async function fetchOccupiedForDate(day, date, eventType){
    const map = {};
    try {
        if (!window.firebaseReady) return map;
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const regsRef = collection(window.firebaseDb, 'registrations');
        const clauses = [ where('date','==', date), where('status','in',['paid','confirmed']) ];
        if (eventType) clauses.push(where('eventType','==', eventType));
        const q = query(regsRef, ...clauses);
        const snap = await getDocs(q);
        const normalizeToScheduleKey = (r) => {
            // Extrair hora de 'schedule' (ex.: 'Segunda - 19h') ou de 'hour'/'19:00'
            const rawSchedule = String(r.schedule || '');
            const rawHour = String(r.hour || '');
            let hh = null;
            // Tenta '19h'
            const mH = rawSchedule.match(/(\d{1,2})\s*h/);
            if (mH) hh = parseInt(mH[1], 10);
            // Tenta '19:00'
            if (hh == null) {
                const m2 = (rawSchedule || rawHour).match(/(\d{1,2})\s*:/);
                if (m2) hh = parseInt(m2[1], 10);
            }
            // Fallback: qualquer número na string
            if (hh == null) {
                const m3 = (rawSchedule || rawHour).match(/(\d{1,2})/);
                if (m3) hh = parseInt(m3[1], 10);
            }
            if (hh == null || Number.isNaN(hh)) return null;
            const hourStr = `${hh}h`;
            return `${day} - ${hourStr}`;
        };
        snap.forEach(doc=>{
            const r = doc.data();
            const key = normalizeToScheduleKey(r);
            if (!key) return;
            map[key] = (map[key]||0)+1;
        });
        // Aplicar travas manuais (schedule_overrides): se locked, marcar como lotado; se extraOccupied, somar
        try {
            const { collection: col2, query: q2, where: w2, getDocs: get2 } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const overridesRef = col2(window.firebaseDb, 'schedule_overrides');
            const ovSnap = await get2(q2(
                overridesRef,
                w2('date','==', date),
                eventType ? w2('eventType','==', eventType) : w2('eventType','==', null)
            ));
            ovSnap.forEach(d=>{
                const ov = d.data();
                const hourNum = parseInt(String(ov.hour||ov.hh||'').replace(/\D/g,''),10);
                if (Number.isNaN(hourNum)) return;
                const key = `${day} - ${hourNum}h`;
                if (ov.extraOccupied) {
                    map[key] = (map[key]||0) + Number(ov.extraOccupied||0);
                }
                if (ov.locked) {
                    // usar capacidade do tipo para forçar lotado
                    const cap = getEventCapacity(eventType, `${hourNum}h`);
                    map[key] = cap;
                }
            });
        } catch(_){}
    } catch(_) {}
    return map;
}

// Verifica disponibilidade por horário (capacidade por tipo de evento)
async function checkSlotAvailability(date, schedule, eventType){
    try{
        if (!window.firebaseReady) return true;
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const regsRef = collection(window.firebaseDb, 'registrations');
        const clauses = [ where('date','==', date), where('status','in',['paid','confirmed']) ];
        if (eventType) clauses.push(where('eventType','==', eventType));
        const q = query(regsRef, ...clauses);
        const snap = await getDocs(q);
        // Normalizar para comparar por hora
        const wantedHour = parseInt(String(schedule).match(/(\d{1,2})\s*h/)?.[1] || 'NaN', 10);
        let occupied = 0;
        snap.forEach(d=>{
            const r = d.data();
            const rawSchedule = String(r.schedule || '');
            const rawHour = String(r.hour || '');
            let hh = rawSchedule.match(/(\d{1,2})\s*h/)?.[1] 
                || rawSchedule.match(/(\d{1,2})\s*:/)?.[1]
                || rawHour.match(/(\d{1,2})/)?.[1];
            hh = parseInt(hh||'NaN', 10);
            if (!Number.isNaN(hh) && hh === wantedHour) occupied++;
        });
        // Considerar overrides
        try{
            const { collection: c2, query: q2, where: w2, getDocs: g2 } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ovRef = c2(window.firebaseDb, 'schedule_overrides');
            const ovSnap = await g2(q2(ovRef, w2('date','==', date), eventType ? w2('eventType','==', eventType) : w2('eventType','==', null)));
            ovSnap.forEach(d=>{
                const ov = d.data();
                const ovHour = parseInt(String(ov.hour||ov.hh||'').replace(/\D/g,''),10);
                if (ovHour === wantedHour){
                    if (ov.locked) occupied = getEventCapacity(eventType, `${wantedHour}h`);
                    if (ov.extraOccupied) occupied += Number(ov.extraOccupied||0);
                }
            });
        }catch(_){}
        return occupied < getEventCapacity(eventType, `${wantedHour}h`);
    }catch(_){ return true; }
}

// Verifica disponibilidade para múltiplos horários e times
async function checkMultipleSlotAvailability(date, selectedTimes, eventType, numberOfTeams) {
    try {
        if (!window.firebaseReady) return { available: true };
        
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const regsRef = collection(window.firebaseDb, 'registrations');
        
        const unavailableSlots = [];
        const partiallyAvailableSlots = [];
        
        // Verificar cada horário selecionado
        for (let schedule of selectedTimes) {
            const clauses = [ 
                where('date','==', date), 
                where('status','in',['paid','confirmed']) 
            ];
            if (eventType) clauses.push(where('eventType','==', eventType));
            const q = query(regsRef, ...clauses);
            const snap = await getDocs(q);
            const wantedHour = parseInt(String(schedule).match(/(\d{1,2})\s*h/)?.[1] || 'NaN', 10);
            let occupiedSlots = 0;
            snap.forEach(d=>{
                const r = d.data();
                const rawSchedule = String(r.schedule || '');
                const rawHour = String(r.hour || '');
                let hh = rawSchedule.match(/(\d{1,2})\s*h/)?.[1] 
                    || rawSchedule.match(/(\d{1,2})\s*:/)?.[1]
                    || rawHour.match(/(\d{1,2})/)?.[1];
                hh = parseInt(hh||'NaN', 10);
                if (!Number.isNaN(hh) && hh === wantedHour) occupiedSlots++;
            });
            // Overrides
            try{
                const { collection: c2, query: q2, where: w2, getDocs: g2 } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                const ovRef = c2(window.firebaseDb, 'schedule_overrides');
                const ovSnap = await g2(q2(ovRef, w2('date','==', date), eventType ? w2('eventType','==', eventType) : w2('eventType','==', null)));
                ovSnap.forEach(d=>{
                    const ov = d.data();
                    const ovHour = parseInt(String(ov.hour||ov.hh||'').replace(/\D/g,''),10);
                    if (ovHour === wantedHour){
                        if (ov.locked) occupiedSlots = getEventCapacity(eventType, `${wantedHour}h`);
                        if (ov.extraOccupied) occupiedSlots += Number(ov.extraOccupied||0);
                    }
                });
            }catch(_){}
            const capacity = getEventCapacity(eventType, `${wantedHour}h`);
            const availableSlots = capacity - occupiedSlots;
            
            if (availableSlots === 0) {
                unavailableSlots.push(schedule);
            } else if (availableSlots < numberOfTeams) {
                partiallyAvailableSlots.push({
                    schedule: schedule,
                    available: availableSlots,
                    requested: numberOfTeams
                });
            }
        }
        
        // Gerar mensagem de erro apropriada
        if (unavailableSlots.length > 0) {
            return {
                available: false,
                message: `❌ Horários sem vagas: ${unavailableSlots.join(', ')}\n\nLimite: ${getEventCapacity(eventType)} times por horário`
            };
        }
        
        if (partiallyAvailableSlots.length > 0) {
            const details = partiallyAvailableSlots.map(slot => 
                `${slot.schedule}: ${slot.available} vagas disponíveis (você quer ${slot.requested})`
            ).join('\n');
            
            return {
                available: false,
                message: `⚠️ Vagas insuficientes:\n\n${details}\n\nLimite: ${getEventCapacity(eventType)} times por horário\n\nSugestão: Reduza o número de times ou escolha outros horários.`
            };
        }
        
        return { available: true };
        
    } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        return { available: true }; // Em caso de erro, permite continuar
    }
}
async function updateOccupiedAndRefreshButtons(day, date, eventType, container){
    // cache por data
    const cacheKey = `${date}__${eventType||'all'}`;
    let occupied = scheduleCache[cacheKey];
    if (!occupied) {
        try { occupied = await fetchOccupiedForDate(day, date, eventType); } catch(_) { occupied = {}; }
        scheduleCache[cacheKey] = occupied;
    }
    const now = new Date();
    const selectedDate = new Date(date + 'T00:00:00');
    const isToday = selectedDate.toDateString() === now.toDateString();
    
    Array.from(container.children).forEach(btn => {
        const schedule = btn.dataset.schedule;
        const time = (schedule || '').split(' - ')[1] || '';
        const taken = occupied[schedule] || 0;
        const capacity = getEventCapacity(eventType, time);
        const available = Math.max(0, capacity - taken);
        
        // Verificar se o horário já passou (apenas para hoje)
        let isPastTime = false;
        if (isToday) {
            const hour = parseInt(time.replace('h', ''));
            const currentHour = now.getHours();
            isPastTime = hour <= currentHour;
        }
        
        if (isPastTime) {
            btn.className = 'slot-btn bg-gray-300 text-gray-500 cursor-not-allowed';
            btn.disabled = true;
            btn.textContent = `${time} (Horário passou)`;
            btn.onclick = null;
        } else if (eventType === 'semanal-freitas' && time === '19h'){
            // Semanal Freitas: 19h sempre esgotado
            btn.className = 'slot-btn bg-red-100 text-red-600 cursor-not-allowed';
            btn.disabled = true;
            btn.textContent = `${time} (Lotado)`;
            btn.onclick = null;
        } else if (available === 0){
            btn.className = 'slot-btn bg-red-100 text-red-600 cursor-not-allowed';
            btn.disabled = true;
            btn.textContent = `${time} (Lotado)`;
            btn.onclick = null;
        } else {
            btn.className = 'slot-btn';
            btn.disabled = false;
            btn.textContent = `${time} (${String(available).padStart(2,'0')}/${String(capacity).padStart(2,'0')})`;
            btn.onclick = ()=>{ 
                selectTime(schedule, btn);
            };
        }
    });
}

// Function to add a new team
function addTeam() {
    teamCounter++;
    const teamId = `team_${teamCounter}`;
    const teamData = {
        id: teamId,
        name: '',
        email: '',
        phone: ''
    };
    teams.push(teamData);
    
    const container = document.getElementById('teamsContainer');
    const teamDiv = document.createElement('div');
    teamDiv.id = teamId;
    teamDiv.className = 'bg-gray-50 rounded-xl p-4 border border-gray-200';
    teamDiv.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h5 class="font-semibold text-gray-900">Time ${teamCounter}</h5>
            ${teamCounter > 1 ? `<button type="button" onclick="removeTeam('${teamId}')" class="text-red-600 hover:text-red-800 text-sm">Remover</button>` : ''}
        </div>
        <div class="space-y-3">
            <input type="text" placeholder="Nome do time" 
                   class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                   onchange="updateTeam('${teamId}', 'name', this.value)">
            <input type="email" placeholder="Email" 
                   class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                   onchange="updateTeam('${teamId}', 'email', this.value)">
            <input type="tel" placeholder="WhatsApp (11) 99999-9999" 
                   class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                   onchange="updateTeam('${teamId}', 'phone', this.value)">
        </div>
    `;
    container.appendChild(teamDiv);
    updateReservationsSummary();
}

// Function to remove a team
function removeTeam(teamId) {
    teams = teams.filter(team => team.id !== teamId);
    const teamElement = document.getElementById(teamId);
    if (teamElement) {
        teamElement.remove();
    }
    updateReservationsSummary();
}

// Function to update team data
function updateTeam(teamId, field, value) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
        team[field] = value;
        updateReservationsSummary();
    }
}

// Function to update reservations summary
async function updateReservationsSummary() {
    const summaryContainer = document.getElementById('reservationsSummary');
    const totalPriceElement = document.getElementById('totalPrice');
    
    if (selectedTimes.length === 0 || teams.length === 0) {
        summaryContainer.innerHTML = '<p class="text-gray-600">Nenhuma reserva selecionada</p>';
        totalPriceElement.textContent = 'R$ 0,00';
        return;
    }
    
    const modal = document.getElementById('scheduleModal');
    const eventType = modal?.dataset?.eventType || 'modo-liga';
    const cfg = scheduleConfig[eventType];
    
    let summaryHTML = '';
    let totalReservations = 0;
    
    // Calculate total reservations (times × selected times × datas)
    const datesFactor = (selectedDates && selectedDates.length > 0) ? selectedDates.length : 1;
    totalReservations = teams.length * selectedTimes.length * datesFactor;
    
    // Verificar disponibilidade e mostrar avisos
    const date = document.getElementById('schedDate')?.value;
    let availabilityWarning = '';
    
    if (eventType && window.firebaseReady) {
        try {
            const datesToCheck = (selectedDates && selectedDates.length > 0) ? selectedDates : (date ? [date] : []);
            for (const d of datesToCheck){
                const availabilityCheck = await checkMultipleSlotAvailability(d, selectedTimes, eventType, teams.length);
                if (!availabilityCheck.available) {
                    availabilityWarning = `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                            <div class="flex items-center">
                                <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                                <span class="text-red-700 font-medium">⚠️ Vagas insuficientes em ${d}!</span>
                            </div>
                            <p class="text-red-600 text-sm mt-1">Reduza o número de times ou escolha outros horários.</p>
                        </div>
                    `;
                    break;
                }
            }
        } catch (error) {
            console.error('Erro ao verificar disponibilidade:', error);
        }
    }
    
    // Build summary
    let computedTotal = 0;
    // Montar por data×horário (preços podem variar por data)
    const datesToUse = (selectedDates && selectedDates.length > 0) ? [...selectedDates] : [document.getElementById('schedDate')?.value];
    datesToUse.forEach(d=>{
        selectedTimes.forEach(time => {
            const hour = (time.split(' - ')[1] || '').trim();
            const pricePerReservation = getEventPrice(eventType, hour, d);
            const lineTotal = pricePerReservation * teams.length;
            computedTotal += lineTotal;
        });
        // Exibição consolidada por horário (com nota de datas)
        selectedTimes.forEach(time=>{
            const hour = (time.split(' - ')[1] || '').trim();
            const pricePerReservation = getEventPrice(eventType, hour, d);
            summaryHTML += `<div class="flex justify-between items-center py-1">
                <span class="text-gray-700">${time} (${new Date(d+'T00:00:00').toLocaleDateString('pt-BR')}) × ${teams.length} time(s)</span>
                <span class="font-semibold">R$ ${(pricePerReservation * teams.length).toFixed(2)}</span>
            </div>`;
        });
    });
    
    summaryContainer.innerHTML = availabilityWarning + summaryHTML;
    
    const totalPrice = computedTotal;
    totalPriceElement.textContent = `R$ ${Number(totalPrice||0).toFixed(2)}`;
}

// Function to handle time selection (multiple)
function selectTime(timeValue, element) {
    const isSelected = selectedTimes.includes(timeValue);
    
    if (isSelected) {
        // Remove from selection
        selectedTimes = selectedTimes.filter(t => t !== timeValue);
        element.classList.remove('bg-blue-600', 'text-white');
        element.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
    } else {
        // Add to selection
        selectedTimes.push(timeValue);
        element.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
        element.classList.add('bg-blue-600', 'text-white');
    }
    
    updateReservationsSummary();
    // Atualizar o preço em Detalhes do Evento conforme o horário selecionado
    try {
        const modal = document.getElementById('scheduleModal');
        const eventType = modal?.dataset?.eventType || '';
        const dateStr = document.getElementById('schedDate')?.value || null;
        const priceEl = document.getElementById('schedPrice');
        if (priceEl) {
            if (selectedTimes.length === 1) {
                const hour = (selectedTimes[0].split(' - ')[1] || '').trim();
                const p = getEventPrice(eventType, hour, dateStr);
                priceEl.textContent = p.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
            } else if (selectedTimes.length === 0) {
                const cfg = scheduleConfig[eventType] || {};
                priceEl.textContent = Number(cfg.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
            } else {
                // Múltiplos horários: exibir a partir do menor preço
                let min = Infinity;
                for (const t of selectedTimes) {
                    const h = (t.split(' - ')[1] || '').trim();
                    const p = getEventPrice(eventType, h, dateStr);
                    if (p < min) min = p;
                }
                if (Number.isFinite(min)) {
                    priceEl.textContent = min.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
                }
            }
        }
    } catch(_) {}
}

// Função para lidar com compra de produtos da loja
async function handleProductPurchase(productId, cfg) {
    try {
        // Coletar dados do formulário (apenas se existirem)
        const teamElement = document.getElementById('schedTeam');
        const emailElement = document.getElementById('schedEmail');
        const phoneElement = document.getElementById('schedPhone');
        
        const team = teamElement ? teamElement.value.trim() : '';
        const email = emailElement ? emailElement.value.trim() : '';
        const phone = phoneElement ? phoneElement.value.trim() : '';

        // Resolver dados a partir do perfil/autenticação quando os campos do formulário não existem
        const authUser = window.firebaseAuth?.currentUser || {};
        const profile = window.currentUserProfile || {};
        const resolvedName = team || profile.name || authUser.displayName || '';
        const resolvedEmail = email || authUser.email || profile.email || '';
        const resolvedPhone = phone || profile.phone || '';
        
        // Email não é mais obrigatório
        
        // Coletar opções específicas do produto
        let productOptions = {};
        let finalPrice = cfg.price;
        
        if (productId === 'sensibilidades') {
            const platform = document.getElementById('platformSelect').value;
            if (!platform) {
                alert('Por favor, selecione uma plataforma.');
                return;
            }
            productOptions.platform = platform;
            
            // Se for Android, coletar também a marca
            if (platform === 'android') {
                const brand = document.getElementById('androidBrandSelect').value;
                if (!brand) {
                    alert('Por favor, selecione a marca do seu dispositivo Android.');
                    return;
                }
                productOptions.brand = brand;
            }
        } else if (productId === 'imagens') {
            const selected = Array.from(document.querySelectorAll('input[name="mapOption"]:checked')).map(i=>i.value);
            productOptions.maps = selected;
            productOptions.quantity = selected.length || 1;
            // Atualizar preço baseado na quantidade selecionada
            const prices = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 }; // Ajustado: 4 mapas = R$ 6,00
            finalPrice = prices[productOptions.quantity] || 2;
        } else if (productId === 'passe-booyah') {
            const playerId = document.getElementById('playerId')?.value || '';
            productOptions.playerId = playerId;
        } else if (productId === 'camisa') {
            const shirtSize = document.getElementById('shirtSize')?.value || 'M';
            const nameOnShirt = document.getElementById('shirtName')?.value || '';
            const nome = document.getElementById('addrNome')?.value || '';
            const cpf = document.getElementById('customerCPF')?.value || '';
            const cep = document.getElementById('addrCEP')?.value || '';
            const rua = document.getElementById('addrRua')?.value || '';
            const numero = document.getElementById('addrNumero')?.value || '';
            const complemento = document.getElementById('addrComplemento')?.value || '';
            const bairro = document.getElementById('addrBairro')?.value || '';
            const cidade = document.getElementById('addrCidade')?.value || '';
            const estado = document.getElementById('addrEstado')?.value || '';
            productOptions.size = shirtSize;
            productOptions.name = nameOnShirt;
            productOptions.delivery = { nome, cpf, cep, rua, numero, complemento, bairro, cidade, estado };
        }

        // Salvar order no Firestore ANTES de redirecionar
        if (window.firebaseDb) {
            const { addDoc, collection, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            
            const orderData = {
                title: cfg.label,
                description: cfg.label,
                item: cfg.label,
                amount: finalPrice,
                total: finalPrice,
                quantity: 1,
                currency: 'BRL',
                status: 'pending',
                customer: resolvedEmail,
                customerName: resolvedName,
                buyerEmail: resolvedEmail,
                userId: window.firebaseAuth.currentUser?.uid,
                uid: window.firebaseAuth.currentUser?.uid,
                phone: resolvedPhone,
                productId: productId,
                productOptions: productOptions,
                createdAt: new Date(),
                timestamp: Date.now(),
                type: 'digital_product'
            };
            
            console.log('🔍 Attempting to save product order:', orderData);
            const docRef = await addDoc(collection(window.firebaseDb, 'orders'), orderData);
            console.log('✅ Product order saved to Firestore with ID:', docRef.id);
            
            // Salvar external_reference para o webhook
            var externalRef = `digital_${docRef.id}`;
            await updateDoc(docRef, { external_reference: externalRef });
            try { sessionStorage.setItem('lastExternalRef', externalRef); } catch(_) {}
        }

        // Chamar function segura (Netlify) para criar Preference
        const response = await fetch('/.netlify/functions/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: cfg.label,
                unit_price: finalPrice,
                currency_id: 'BRL',
                quantity: 1,
                back_url: window.location.origin,
                external_reference: externalRef || (`digital_${docRef?.id || Date.now()}`)
            })
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        
        closeScheduleModal();
        
        // Redireciona para o checkout do Mercado Pago
        if (data.init_point) {
            try { sessionStorage.setItem('lastCheckoutUrl', data.init_point); } catch(_) {}
            window.location.href = data.init_point;
        } else {
            alert('Não foi possível iniciar o checkout.');
        }
    } catch (error) {
        console.error('Erro na compra do produto:', error);
        alert('Falha ao processar compra.');
    }
}

// Compra de produtos da loja usando Tokens (no modal de agendamento)
async function handleProductPurchaseWithTokens(productId, cfg){
    try{
        // Resolver dados do perfil/usuário
        const authUser = window.firebaseAuth?.currentUser || {};
        const profile = window.currentUserProfile || {};
        const resolvedEmail = authUser.email || profile.email || '';
        const resolvedName = profile.name || authUser.displayName || '';

        // Coletar opções e calcular preço final
        let productOptions = {};
        let finalPrice = cfg.price;
        if (productId === 'sensibilidades'){
            const platform = document.getElementById('platformSelect')?.value;
            if (!platform){ alert('Selecione a plataforma.'); return; }
            productOptions.platform = platform;
            if (platform === 'android'){
                const brand = document.getElementById('androidBrandSelect')?.value;
                if (!brand){ alert('Selecione a marca do Android.'); return; }
                productOptions.brand = brand;
            }
        } else if (productId === 'imagens'){
            const selected = Array.from(document.querySelectorAll('input[name="mapOption"]:checked')).map(i=>i.value);
            productOptions.maps = selected;
            productOptions.quantity = selected.length || 1;
            const prices = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 };
            finalPrice = prices[productOptions.quantity] || 2;
        } else if (productId === 'passe-booyah'){
            productOptions.playerId = document.getElementById('playerId')?.value || '';
        } else if (productId === 'camisa'){
            const shirtSize = document.getElementById('shirtSize')?.value || 'M';
            const nameOnShirt = document.getElementById('shirtName')?.value || '';
            const nome = document.getElementById('addrNome')?.value || '';
            const cpf = document.getElementById('customerCPF')?.value || '';
            const cep = document.getElementById('addrCEP')?.value || '';
            const rua = document.getElementById('addrRua')?.value || '';
            const numero = document.getElementById('addrNumero')?.value || '';
            const complemento = document.getElementById('addrComplemento')?.value || '';
            const bairro = document.getElementById('addrBairro')?.value || '';
            const cidade = document.getElementById('addrCidade')?.value || '';
            const estado = document.getElementById('addrEstado')?.value || '';
            const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
            if (!cpf || !cpfRegex.test(cpf)) { alert('CPF inválido. Use o formato 000.000.000-00.'); return; }
            productOptions.size = shirtSize;
            productOptions.name = nameOnShirt;
            productOptions.delivery = { nome, cpf, cep, address:rua, number:numero, complement:complemento, district:bairro, city:cidade, state:estado };
        }

        // Aplicar cupom do schedule se houver
        if (typeof appliedScheduleCoupon !== 'undefined' && appliedScheduleCoupon){
            let discountAmount = 0;
            if (appliedScheduleCoupon.discountType === 'percentage'){
                discountAmount = finalPrice * (appliedScheduleCoupon.discountValue/100);
            } else {
                discountAmount = appliedScheduleCoupon.discountValue;
            }
            finalPrice = Math.max(0, finalPrice - discountAmount);
        }

        // Validar saldo
        if (!canSpendTokens(finalPrice)){
            alert(`Saldo insuficiente. Você precisa de ${finalPrice.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`);
            return;
        }
        const ok = await spendTokens(finalPrice);
        if (!ok){ alert('Não foi possível debitar tokens.'); return; }

        // Criar pedido pago
        const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const orderData = {
            title: cfg.label,
            description: cfg.label,
            item: cfg.label,
            amount: finalPrice,
            total: finalPrice,
            quantity: 1,
            currency: 'BRL',
            status: 'paid',
            paidWithTokens: true,
            tokensUsed: finalPrice,
            customer: resolvedEmail,
            customerName: resolvedName,
            buyerEmail: resolvedEmail,
            userId: window.firebaseAuth?.currentUser?.uid,
            uid: window.firebaseAuth?.currentUser?.uid,
            productId: productId,
            productOptions: productOptions,
            createdAt: new Date(),
            timestamp: Date.now(),
            type: 'digital_product'
        };
        // Firestore não aceita campos undefined. Adicionar shippingStatus apenas quando aplicável
        if (productId === 'camisa') {
            orderData.shippingStatus = 'pending';
        }
        await addDoc(collection(window.firebaseDb,'orders'), orderData);
        closeScheduleModal();
        if (typeof openPaymentConfirmModal === 'function'){
            openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento em tokens foi aprovado. Confira em Minha Conta.');
        } else {
            alert('Pagamento confirmado com tokens!');
        }
    }catch(e){
        console.error('Erro ao comprar com tokens (produto loja):', e);
        alert('Erro ao pagar com tokens.');
    }
}

async function submitSchedule(e, useTokens=false){
    e.preventDefault();
    const submitBtn = document.getElementById('schedSubmit');
    const oldText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Processando...'; }
    const modal = document.getElementById('scheduleModal');
    const eventType = modal?.dataset?.eventType || 'modo-liga';
    const cfg = scheduleConfig[eventType];
    
    // Se for produto da loja, usar lógica de compra
    if (cfg.isProduct) {
        if (useTokens){
            await handleProductPurchaseWithTokens(eventType, cfg);
        } else {
            await handleProductPurchase(eventType, cfg);
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
        return;
    }
    
    // Para eventos que usam tokens, seguimos o fluxo normal de criação de reservas
    // e o débito proporcional (times × horários × preço) é aplicado mais abaixo
    
    // Lógica para eventos (agendamento múltiplo)
    const date = document.getElementById('schedDate').value;
    const datesToUse = (selectedDates && selectedDates.length > 0) ? [...selectedDates] : [date];
    
    // Validar seleções
    if (selectedTimes.length === 0) {
        alert('Selecione pelo menos um horário.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
        return;
    }
    
    if (teams.length === 0) {
        alert('Adicione pelo menos um time.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
        return;
    }
    
    // Verificar disponibilidade de vagas para cada data e horário
    for (const d of datesToUse){
        const availabilityCheck = await checkMultipleSlotAvailability(d, selectedTimes, eventType, teams.length);
        if (!availabilityCheck.available) {
            const message = availabilityCheck.message || 'Não há vagas suficientes para os horários selecionados.';
            alert(message);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }
    }
    
    // Validar dados dos times
    for (let team of teams) {
        if (!team.name.trim() || !team.email.trim() || !team.phone.trim()) {
            alert('Preencha todos os dados dos times.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }
    }
    
    // Verificar se algum horário já passou em cada data
    const now = new Date();
    for (const d of datesToUse){
        const selectedDate = new Date(d + 'T00:00:00');
        const isToday = selectedDate.toDateString() === now.toDateString();
        if (isToday) {
            for (let schedule of selectedTimes) {
                const timeStr = schedule.split(' - ')[1] || '';
                const hour = parseInt(timeStr.replace('h', ''));
                const currentHour = now.getHours();
                if (hour <= currentHour) {
                    alert(`O horário ${timeStr} já passou (${d}). Remova horários passados da seleção.`);
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                    return;
                }
            }
        }
    }

    // Se pagar com token: validar saldo total
    if (useTokens || (cfg && cfg.payWithToken)){
        const datesToUse = (selectedDates && selectedDates.length > 0) ? [...selectedDates] : [document.getElementById('schedDate')?.value];
        let totalCost = 0;
        for (const d of datesToUse){
            for (const t of selectedTimes){
                const hour = (t.split(' - ')[1] || '').trim();
                totalCost += getEventPrice(eventType, hour, d) * teams.length;
            }
        }
        const profile = window.currentUserProfile || {};
        if (!profile || !profile.tokens || profile.tokens < totalCost){ 
            alert(`Saldo de tokens insuficiente. Você precisa de ${totalCost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`); 
            if(submitBtn){submitBtn.disabled=false; submitBtn.textContent=oldText;} 
            return; 
        }
    }
    
    // Verificar disponibilidade de todos os horários por data
    for (const d of datesToUse){
        for (let schedule of selectedTimes) {
            const canBook = await checkSlotAvailability(d, schedule, eventType);
            if (!canBook){ 
                alert(`O horário ${schedule} não possui vagas em ${d}. Remova da seleção.`); 
                if (submitBtn){ submitBtn.disabled=false; submitBtn.textContent=oldText; } 
                return; 
            }
        }
    }

    // Criar múltiplas reservas no Firestore
    let regIds = [];
    // Gerar uma referência única para todas as reservas desta compra
    const externalRef = `schedule_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    try {
        const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        
        if (window.firebaseReady && !isLocal){
            const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            
            // Criar uma reserva para cada combinação de data × time × horário
            for (const d of datesToUse){
                for (let team of teams) {
                    for (let schedule of selectedTimes) {
                        const docRef = await addDoc(collection(window.firebaseDb,'registrations'),{
                            userId: (window.firebaseAuth && window.firebaseAuth.currentUser ? window.firebaseAuth.currentUser.uid : null),
                            teamName: team.name,
                            email: team.email,
                            phone: team.phone,
                            schedule,
                            date: d,
                            eventType,
                        title: `${cfg.label} - ${schedule} - ${d} - ${team.name}`,
                        price: Number(getEventPrice(eventType, (schedule.split(' - ')[1]||'').trim()) || 0),
                            status:'pending',
                            createdAt: serverTimestamp(),
                            external_reference: externalRef
                        });
                        regIds.push(docRef.id);
                    }
                }
            }
            
            // Salvar informações da última reserva para compatibilidade
            if (regIds.length > 0) {
                try{ sessionStorage.setItem('lastRegId', regIds[0]); }catch(_){ }
                try{ sessionStorage.setItem('lastRegInfo', JSON.stringify({ 
                    schedule: selectedTimes[0], 
                    date: datesToUse[0], 
                    eventType: modal.dataset.eventType, 
                    price: cfg.price, 
                    title: `${cfg.label} - ${selectedTimes[0]} - ${datesToUse[0]}`,
                    totalReservations: regIds.length
                })); }catch(_){ }
            }
        }
    } catch(error) {
        console.error('Erro ao criar reservas:', error);
    }
    if (useTokens || (cfg && cfg.payWithToken)){
        // Validar saldo de tokens antes de confirmar
        const totalCost = teams.length * selectedTimes.length * cfg.price;
        
        // Verificar se tem tokens suficientes
        const profile = window.currentUserProfile || {};
        if (!profile || profile.tokens === undefined || profile.tokens === null || Number(profile.tokens) < Number(totalCost)) {
            alert(`Saldo insuficiente. Você precisa de ${totalCost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`);
            // Remover reservas criadas se não tiver saldo
            if (regIds.length > 0 && window.firebaseDb) {
                try {
                    const { doc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                    for (let regId of regIds) {
                        await deleteDoc(doc(collection(window.firebaseDb, 'registrations'), regId));
                    }
                } catch (delError) {
                    console.error('Erro ao remover reservas:', delError);
                }
            }
            if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }
        
        if (!canSpendTokens(totalCost)) {
            alert(`Saldo insuficiente. Você precisa de ${totalCost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`);
            // Remover reservas criadas se não tiver saldo
            if (regIds.length > 0 && window.firebaseDb) {
                try {
                    const { doc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                    for (let regId of regIds) {
                        await deleteDoc(doc(collection(window.firebaseDb, 'registrations'), regId));
                    }
                } catch (delError) {
                    console.error('Erro ao remover reservas:', delError);
                }
            }
            if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }
        
        // Debita tokens totais
        spendTokens(totalCost);
        
        // Atualizar todas as reservas para 'confirmed' e adicionar campos de pagamento com tokens
        if (regIds.length > 0 && window.firebaseDb && window.firebaseReady) {
            try {
                const { doc, updateDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                
                for (let regId of regIds) {
                    await updateDoc(doc(collection(window.firebaseDb, 'registrations'), regId), {
                        status: 'confirmed',
                        paidWithTokens: true,
                        tokenCost: cfg.price,
                        tokensUsed: cfg.price,
                        confirmedAt: new Date(),
                        updatedAt: new Date()
                    });
                }
                
                console.log(`✅ ${regIds.length} reservas confirmadas e atualizadas com pagamento via tokens`);
            } catch (updateError) {
                console.error('Erro ao atualizar reservas:', updateError);
                alert('Reservas criadas mas houve erro ao confirmar. Contate o suporte.');
            }
        }
        
        closeScheduleModal();
        alert(`${regIds.length} reservas confirmadas com uso de tokens!`);
        
        // Forçar atualização da área do cliente se estiver na página do cliente
        try {
            if (window.location.pathname.includes('client.html') || window.location.pathname.includes('client')) {
                if (typeof loadRecentOrders === 'function') {
                    loadRecentOrders().catch(() => {});
                }
                if (typeof loadOrders === 'function') {
                    loadOrders().catch(() => {});
                }
            }
        } catch(_) {}
        
        if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = oldText; }
        return;
    }

    // Se não logado, exige login primeiro
    if (!window.isLoggedIn){
        closeScheduleModal();
        openLoginModal && openLoginModal();
        alert('Faça login para continuar a compra.');
        if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = oldText; }
        return;
    }
    // Fluxo normal: Checkout via Netlify Function
    const datesToUse2 = (selectedDates && selectedDates.length > 0) ? [...selectedDates] : [document.getElementById('schedDate')?.value];
    const datesCount = datesToUse2.length;
    let originalTotal = 0;
    for (const d of datesToUse2){
        for (const t of selectedTimes){
            const hour = (t.split(' - ')[1] || '').trim();
            originalTotal += getEventPrice(eventType, hour, d) * teams.length;
        }
    }
    originalTotal = Number(originalTotal.toFixed(2));
    
    // Calcular preço final com cupom aplicado
    let finalPrice = originalTotal;
    let couponInfo = null;
    
    if (appliedScheduleCoupon) {
        let discountAmount = 0;
        if (appliedScheduleCoupon.discountType === 'percentage') {
            discountAmount = originalTotal * (appliedScheduleCoupon.discountValue / 100);
        } else {
            discountAmount = appliedScheduleCoupon.discountValue;
        }
        finalPrice = Math.max(0, originalTotal - discountAmount);
        
        couponInfo = {
            code: appliedScheduleCoupon.code,
            discountType: appliedScheduleCoupon.discountType,
            discountValue: appliedScheduleCoupon.discountValue,
            originalPrice: originalTotal,
            finalPrice: finalPrice,
            discountAmount: discountAmount
        };
    }
    
    // Calcular número total de reservas
    const totalReservations = teams.length * selectedTimes.length * datesCount;
    
    fetch('/.netlify/functions/create-preference',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ 
            title: `${cfg.label} - ${totalReservations} reservas - ${datesCount > 1 ? `${datesCount} datas` : date}`, 
            unit_price: finalPrice, 
            currency_id:'BRL', 
            quantity: 1, // Mudamos para 1 pois já calculamos o preço total
            back_url: window.location.origin,
            coupon_info: couponInfo,
            multiple_reservations: {
                teams: teams.map(t => t.name),
                schedules: selectedTimes,
                dates: datesToUse2,
                eventType: eventType
            },
            external_reference: externalRef
        })
    }).then(async res=>{ if(!res.ok){ const t = await res.text(); throw new Error(t || 'Erro na função de pagamento'); } return res.json(); })
    .then(async data=>{
        closeScheduleModal();
        // Salvar external_reference para verificação posterior
        if (data.external_reference) {
            sessionStorage.setItem('lastExternalRef', data.external_reference);
            // Persistir no registro (se existir) para rastrear via painel
            try{
                const regId = sessionStorage.getItem('lastRegId');
                if (regId && window.firebaseDb){
                    import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
                      .then(({ doc, setDoc, collection }) => {
                          const ref = doc(collection(window.firebaseDb,'registrations'), regId);
                          return setDoc(ref, { external_reference: data.external_reference }, { merge:true });
                      }).catch(()=>{});
                }
            }catch(_){ }
        }
        // Registrar uso do cupom se aplicado
        if (appliedScheduleCoupon && couponInfo) {
            try {
                await recordCouponUsage(
                    appliedScheduleCoupon.id,
                    appliedScheduleCoupon.code,
                    originalTotal,
                    couponInfo.discountAmount,
                    'events',
                    data.external_reference || 'schedule_' + Date.now()
                );
            } catch (error) {
                console.error('❌ Erro ao registrar uso do cupom:', error);
                // Não bloquear o pagamento se houver erro no registro
            }
        }
        
        const url = data.init_point || data.sandbox_init_point; // prioriza produção
        if (url) { try{ sessionStorage.setItem('lastCheckoutUrl', url);}catch(_){} window.location.href = url; } else { alert('Não foi possível iniciar o pagamento.'); }
    }).catch((err)=> { alert('Falha ao iniciar pagamento. ' + (err && err.message ? err.message : '')); })
    .finally(()=>{ if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = oldText; }});
}

// XTreino Gratuito: abrir WhatsApp com mensagem
function openFreeWhatsModal(){
    const modal = document.getElementById('freeWhatsModal');
    const link = document.getElementById('freeWhatsLink');
    const number = '5581986103152'; // ajuste se necessário
    const message = 'Vim do site e quero uma vaga gratuita. Quais horários têm disponível?';
    if (link) link.href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    if (modal) modal.classList.remove('hidden');
    if (window.innerWidth <= 767) document.body.classList.add('modal-open-mobile');
}
function closeFreeWhatsModal(){
    const modal = document.getElementById('freeWhatsModal');
    if (modal) modal.classList.add('hidden');
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}

// Modal confirmação
function openPaymentConfirmModal(title, msg, groupLink){
    console.log('Opening payment confirmation modal:', { title, msg, groupLink });
    const m = document.getElementById('paymentConfirmModal');
    const t = document.getElementById('paymentConfirmTitle');
    const p = document.getElementById('paymentConfirmMsg');
    const g = document.getElementById('paymentGroupBtn');
    const payBtn = document.getElementById('paymentPayNowBtn');
    const acctBtn = document.getElementById('paymentGoAccountBtn');
    
    if (!m) {
        console.error('Payment confirmation modal not found');
        return;
    }
    
    if (t) t.textContent = title || 'Pagamento';
    if (p) p.textContent = msg || '';
    if (g){
        if (groupLink){ g.href = groupLink; g.classList.remove('hidden'); }
        else { g.classList.add('hidden'); }
    }

    // Lógica dos botões conforme o estado
    const isProcessing = String(title || '').toLowerCase().includes('processamento') || String(title || '').toLowerCase().includes('pendente');
    const lastUrl = (()=>{ try { return sessionStorage.getItem('lastCheckoutUrl') || ''; } catch(_) { return ''; } })();
    
    if (payBtn){
        if (isProcessing && lastUrl){
            payBtn.classList.remove('hidden');
            payBtn.onclick = function(){
                const u = (()=>{ try { return sessionStorage.getItem('lastCheckoutUrl'); } catch(_) { return null; } })();
                if (u) { window.location.href = u; }
                else { alert('Link de pagamento indisponível. Volte ao produto para gerar um novo.'); }
            };
        } else {
            payBtn.classList.add('hidden');
            payBtn.onclick = null;
        }
    }
    if (acctBtn){
        if (isProcessing){ acctBtn.classList.add('hidden'); } else { acctBtn.classList.remove('hidden'); }
    }
    // Garantir centralização: container precisa estar em display:flex
    m.classList.remove('hidden');
    m.classList.add('flex');
    console.log('Payment confirmation modal opened successfully');
}
function closePaymentConfirmModal(){
    const m = document.getElementById('paymentConfirmModal');
    if (m) m.classList.add('hidden');
}

// Verificar status do pagamento via API do Mercado Pago
async function checkPaymentStatus(preferenceId) {
    try {
        console.log('Checking payment status for preference:', preferenceId);
        
        // Marcar que estamos verificando um pagamento real
        sessionStorage.setItem('checkingPayment', 'true');
        
        // Fazer requisição para nossa Netlify Function que verifica o status
        const response = await fetch('/.netlify/functions/check-payment-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                preference_id: preferenceId,
                external_reference: sessionStorage.getItem('lastExternalRef')
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to check payment status');
        }
        
        const data = await response.json();
        console.log('Payment status response:', data);
        
        if (data.status === 'approved') {
            console.log('Payment approved, processing...');
            processSuccessfulPayment();
        } else if (data.status === 'pending') {
            console.log('Payment still pending, will check again in 10 seconds...');
            setTimeout(() => checkPaymentStatus(preferenceId), 10000);
        } else if (data.status === 'rejected') {
            console.log('Payment was rejected');
            openPaymentConfirmModal('Pagamento Rejeitado', 'Seu pagamento foi rejeitado. Tente novamente ou use outro método de pagamento.');
        } else {
            console.log('Payment status:', data.status);
            // Para outros status, não mostrar modal automaticamente
            // O usuário pode verificar o status na área do cliente
        }
        
    } catch (error) {
        console.error('Error checking payment status:', error);
        // Fallback: apenas logar o erro, não mostrar modal
        // O usuário pode verificar o status na área do cliente
    }
}

// Processar pagamento bem-sucedido
function processSuccessfulPayment() {
    const regId = sessionStorage.getItem('lastRegId');
    const extRef = sessionStorage.getItem('lastExternalRef');
    console.log('Processing successful payment, regId:', regId);
    
    // Limpar dados de pagamento após processar com sucesso
    sessionStorage.removeItem('lastExternalRef');
    sessionStorage.removeItem('lastRegId');
    sessionStorage.removeItem('lastRegInfo');
    try { sessionStorage.removeItem('lastCheckoutUrl'); } catch(_) {}
    
    if (extRef) {
        // Atualizar TODAS as reservas desta compra pela external_reference
        import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
            .then(({ collection, query, where, getDocs, doc, updateDoc }) => {
                const regs = collection(window.firebaseDb,'registrations');
                return getDocs(query(regs, where('external_reference','==', extRef))).then(async (snap)=>{
                    let link = null;
                    const updates = [];
                    snap.forEach(d=>{
                        updates.push(updateDoc(doc(collection(window.firebaseDb,'registrations'), d.id), { status:'paid', paidAt: Date.now() }));
                        const data = d.data();
                        if (!link && data && data.groupLink) link = data.groupLink;
                    });
                    return Promise.allSettled(updates).then(()=> link);
                });
            }).then((groupLink)=>{
                openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.', groupLink);
            }).catch((e)=>{
                console.error('Error updating registrations by external_reference:', e);
                openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.');
            });
    } else if (regId) {
        // Fallback: atualizar apenas o primeiro registro conhecido
        import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
            .then(({ doc, setDoc, getDoc, collection }) => {
                const ref = doc(collection(window.firebaseDb,'registrations'), regId);
                return setDoc(ref, { status:'paid', paidAt: Date.now() }, { merge:true })
                  .then(()=> getDoc(ref))
                  .then(snap=>{ const d = snap.exists()? snap.data():{}; return d.groupLink || null; });
            }).then((groupLink)=>{
                console.log('Registration updated, showing modal');
                openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.', groupLink);
            }).catch((e)=>{
                console.error('Error updating registration:', e);
                openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.');
            });
    } else {
        console.log('No regId, creating local order');
        // Fallback: cria registro local para exibir na aba pedidos
        try{
            const info = JSON.parse(sessionStorage.getItem('lastRegInfo')||'{}');
            const orders = JSON.parse(localStorage.getItem('localOrders')||'[]');
            orders.unshift({ title: info.title||'Reserva', amount: info.price||0, status:'paid', date: new Date().toISOString() });
            localStorage.setItem('localOrders', JSON.stringify(orders));
            console.log('Local order created:', orders[0]);
        }catch(e){ console.error('Error creating local order:', e); }
        openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento foi aprovado. Confira seus acessos na área Minha Conta.');
    }
}

// --- Modal de Tokens ---
function openTokensModal(){
    const modal = document.getElementById('tokensModal');
    if (!modal) return;
    
    // Atualizar saldo de tokens
    const balanceEl = document.getElementById('tokensBalance');
    if (balanceEl) balanceEl.textContent = String(Math.round(getTokenBalance()));
    
    // Atualizar total ao mudar quantidade
    const qtyInput = document.getElementById('tokensQuantity');
    const totalEl = document.getElementById('tokensTotal');
    if (qtyInput && totalEl) {
        qtyInput.addEventListener('input', () => {
            const qty = Math.max(1, Math.min(100, Number(qtyInput.value) || 1));
            const total = qty * 1.00; // R$ 1,00 por token
            totalEl.textContent = total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        });
    }
    
    modal.classList.remove('hidden');
    if (window.innerWidth <= 767) document.body.classList.add('modal-open-mobile');
}

function closeTokensModal(){
    const modal = document.getElementById('tokensModal');
    if (modal) modal.classList.add('hidden');
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}

// Compra de tokens removida (somente usuários recebem tokens)

async function useTokensForEvent(eventType){
    const eventCosts = {
        'treino': 1.00,
        'modoLiga': 3.00,
        'semanal': 3.50,
        'finalSemanal': 7.00,
        'campFases': 5.00,
        'xtreino-tokens': 1.00
    };
    
    const cost = eventCosts[eventType];
    if (!cost) {
        console.error('Event type not found:', eventType);
        return;
    }
    
    // Sincronização forçada removida para evitar reset do saldo
    // console.log('🔄 Forcing token sync before use...');
    // await syncUserTokens();
    
    // Verificar se tem tokens suficientes
    const profile = window.currentUserProfile || {};
    console.log('🔍 useTokensForEvent - Profile check:', { profile, tokens: profile.tokens, cost });
    
    if (!profile || profile.tokens === undefined || profile.tokens === null || Number(profile.tokens) < Number(cost)) {
        console.log('❌ Insufficient tokens:', { profile, tokens: profile.tokens, cost });
        alert(`Saldo insuficiente. Você precisa de ${cost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`);
        return;
    }
    
    if (!canSpendTokens(cost)) {
        alert(`Saldo insuficiente. Você precisa de ${cost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens.`);
        return;
    }
    
    const eventNames = {
        'treino': 'Treino Normal',
        'modoLiga': 'Modo Liga',
        'semanal': 'Semanal',
        'finalSemanal': 'Final Semanal',
        'campFases': 'Camp de Fases',
        'xtreino-tokens': 'XTreino Tokens'
    };
    
    // Verificar disponibilidade do horário selecionado ANTES de debitar tokens
    try{
        const date = document.getElementById('schedDate')?.value || new Date().toISOString().split('T')[0];
        const rawSchedule = document.getElementById('schedSelectedTime')?.value || document.querySelector('#schedTimes .selected')?.textContent || '';
        const normalizeHour = (h)=>{ if (!h) return null; const m=String(h).match(/(\\d{1,2})/); return m? `${parseInt(m[1],10)}h` : null; };
        const hour = normalizeHour(rawSchedule);
        const weekday = (()=>{
            try{ const d = new Date(`${date}T00:00:00`); const wd = d.toLocaleDateString('pt-BR',{ weekday:'long' }); return wd.charAt(0).toUpperCase()+wd.slice(1); }catch(_){ return ''; }
        })();
        const schedule = (weekday && hour) ? `${weekday} - ${hour}` : null;
        // Mapear tipo de evento dos tokens -> tipo do site (para overrides/capacidade)
        const mapTokenToSite = (t)=>{
            switch(String(t||'')){
                case 'modoLiga': return 'modo-liga';
                case 'semanal':
                case 'finalSemanal': return 'semanal-freitas';
                case 'campFases': return 'camp-freitas';
                case 'treino': return 'xtreino-tokens';
                default: return t;
            }
        };
        const siteEventType = mapTokenToSite(eventType);
        if (schedule && siteEventType){
            const canBook = await checkSlotAvailability(date, schedule, siteEventType);
            if (!canBook){
                alert('Horário indisponível para este evento (lotado ou travado). Escolha outro horário.');
                return;
            }
        }
    }catch(_){ /* se falhar, deixa seguir para manter fluxo atual */ }
    
    if (confirm(`Confirmar uso de ${cost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em tokens para ${eventNames[eventType]}?`)) {
        const success = await spendTokens(cost);
        if (success) {
            // Criar agendamento direto
            await createTokenSchedule(eventType, cost);
            closeTokensModal();
            renderClientArea();
            alert('✅ Token usado com sucesso! Agendamento criado. Verifique na sua área do cliente.');
        } else {
            alert('Erro ao processar o resgate de tokens. Tente novamente.');
        }
    }
}

// Função para obter link do WhatsApp dinamicamente
async function getWhatsAppLink(eventType, schedule = null) {
  try {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    
    const whatsappLinksRef = collection(window.firebaseDb, 'whatsapp_links');
    // Normalizar parâmetros
    const normalizeType = (t)=> String(t||'').toLowerCase().trim()
      .replace(/\s+/g,'-')
      .replace('xtreino-tokens','xtreino-tokens')
      .replace('xtreino-gratuito','xtreino-gratuito')
      .replace('modo-liga','modo-liga')
      .replace('camp','camp-freitas');
    const normalizeHour = (h)=> {
      if (!h) return null;
      const s = String(h).toLowerCase().trim();
      const m = s.match(/(\d{1,2})/);
      return m ? `${parseInt(m[1],10)}h` : s;
    };
    const type = normalizeType(eventType);
    const hour = normalizeHour(schedule);
    // Aliases para compatibilidade com cadastros antigos
    const typeAliases = Array.from(new Set([
      type,
      type.replace('semanal-freitas', 'semanal'),
      type.replace('semanal-freitas', 'semanal freitas'),
      type.replace('camp-freitas', 'camp'),
      type.replace('camp-freitas', 'camp freitas'),
    ])).filter(Boolean);
    const generalScheduleAliases = [null, '', 'geral', 'general', 'todos', 'all'];
    
    // Primeiro, tentar encontrar link específico para o horário (testando aliases)
    if (hour) {
      for (const t of typeAliases) {
        const specificQuery = query(
          whatsappLinksRef,
          where('eventType', '==', t),
          where('schedule', '==', hour),
          where('status', '==', 'active')
        );
        const specificSnapshot = await getDocs(specificQuery);
        if (!specificSnapshot.empty) {
          return specificSnapshot.docs[0].data().link;
        }
      }
    }
    
    // Se não encontrou específico, buscar link geral para o evento
    // Depois, tentar links gerais (sem horário), testando aliases e variações de schedule
    for (const t of typeAliases) {
      for (const sched of generalScheduleAliases) {
        const generalQuery = query(
          whatsappLinksRef,
          where('eventType', '==', t),
          where('schedule', '==', sched),
          where('status', '==', 'active')
        );
        const generalSnapshot = await getDocs(generalQuery);
        if (!generalSnapshot.empty) {
          return generalSnapshot.docs[0].data().link;
        }
      }
    }
    
    // Fallback para links padrão se não encontrar no Firestore
    const defaultLinks = {
      'xtreino-tokens': '',
      'xtreino-gratuito': '',
      'modo-liga': '',
      'camp-freitas': '',
      'semanal-freitas': '',
      'treino': ''
    };
    
    return defaultLinks[type] || '';
    
  } catch (error) {
    console.error('❌ Erro ao obter link do WhatsApp:', error);
    return '';
  }
}

// Expor função globalmente
window.getWhatsAppLink = getWhatsAppLink;

// Função para criar agendamento quando usar tokens
async function createTokenSchedule(eventType, cost) {
    try {
        const team = document.getElementById('schedTeam')?.value?.trim() || 'Time';
        const email = document.getElementById('schedEmail')?.value?.trim() || window.firebaseAuth.currentUser?.email;
        const phone = document.getElementById('schedPhone')?.value?.trim() || '';
        const date = document.getElementById('schedDate')?.value || new Date().toISOString().split('T')[0];
        // Pegar horário selecionado sem defaultar para 19h
        const rawSchedule = document.getElementById('schedSelectedTime')?.value || document.querySelector('#schedTimes .selected')?.textContent || '';
        const normalizeHour = (h)=>{
            if (!h) return null;
            const s = String(h).toLowerCase().trim();
            const m = s.match(/(\d{1,2})/);
            return m ? `${parseInt(m[1],10)}h` : s;
        };
        const hour = normalizeHour(rawSchedule);
        // Montar "Dia - 14h" para compatibilidade com o controle de vagas
        const weekday = (()=>{
            try{
                const d = new Date(`${date}T00:00:00`);
                const wd = d.toLocaleDateString('pt-BR',{ weekday:'long' });
                return wd.charAt(0).toUpperCase() + wd.slice(1);
            }catch(_){ return ''; }
        })();
        const schedule = weekday && hour ? `${weekday} - ${hour}` : (hour || null);
        
        const eventNames = {
            'treino': 'Treino Normal',
            'modoLiga': 'Modo Liga',
            'semanal': 'Semanal',
            'finalSemanal': 'Final Semanal',
            'campFases': 'Camp de Fases',
            'xtreino-tokens': 'XTreino Tokens'
        };
        
        // Re-checar disponibilidade logo antes de criar (evita corrida)
        try{
            const siteTypeMap = { modoLiga:'modo-liga', semanal:'semanal-freitas', finalSemanal:'semanal-freitas', campFases:'camp-freitas', treino:'xtreino-tokens' };
            const siteEventType = siteTypeMap[eventType] || eventType;
            if (schedule && siteEventType){
                const canBook = await checkSlotAvailability(date, schedule, siteEventType);
                if (!canBook){
                    alert('Horário indisponível (lotado/travado). Seus tokens não foram perdidos.');
                    return;
                }
            }
        }catch(_){}
        
        // Obter link do WhatsApp dinamicamente do Firestore
        const whatsappLink = await getWhatsAppLink(eventType, schedule);
        
        const scheduleData = {
            teamName: team,
            contact: email,
            email: email, // Campo duplicado para compatibilidade
            phone: phone,
            date: date,
            schedule: schedule || null,
            eventType: eventType,
            status: 'confirmed',
            paidWithTokens: true,
            tokenCost: cost,
            tokensUsed: cost, // Campo para histórico
            eventName: eventNames[eventType],
            title: eventNames[eventType], // Campo para compatibilidade
            whatsappLink: whatsappLink,
            userId: window.firebaseAuth.currentUser?.uid,
            uid: window.firebaseAuth.currentUser?.uid,
            createdAt: new Date(),
            timestamp: Date.now()
        };
        
        console.log('🔍 Creating token schedule:', scheduleData);
        
        // Salvar no Firestore
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // 1. Salvar na coleção 'registrations' (para histórico de tokens)
        const regDocRef = await addDoc(collection(window.firebaseDb, 'registrations'), {
            ...scheduleData,
            createdAt: serverTimestamp() // Usar serverTimestamp para consistência
        });
        console.log('✅ Token schedule created with ID:', regDocRef.id);
        
        // 2. Criar registro leve em 'orders' para aparecer no "Meus Pedidos"
        try {
            await addDoc(collection(window.firebaseDb, 'orders'), {
                userId: window.firebaseAuth.currentUser?.uid,
                uid: window.firebaseAuth.currentUser?.uid,
                customer: email,
                buyerEmail: email,
                title: scheduleData.title,
                item: scheduleData.title,
                eventType: eventType, // 'xtreino-tokens'
                schedule: hour || null,
                date: date,
                amount: 0,
                total: 0,
                currency: 'BRL',
                status: 'approved',
                paidWithTokens: true,
                tokensUsed: cost,
                whatsappLink: whatsappLink,
                createdAt: serverTimestamp(),
                timestamp: Date.now()
            });
        } catch(orderErr) {
            console.warn('⚠️ Falha ao criar ordem leve para tokens (seguindo com registrations):', orderErr);
        }
        // Apenas salvar o registration acima e atualizar UI/local
        
        // Fechar modal
        const modal = document.getElementById('scheduleModal');
        if (modal) modal.classList.add('hidden');
        
        // Forçar atualização da área do cliente
        setTimeout(async () => {
            if (window.location.pathname.includes('client.html')) {
                await loadTokenUsageHistory();
                if (typeof loadRecentOrders === 'function') await loadRecentOrders();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error creating token schedule:', error);
        alert('Erro ao criar agendamento. Tente novamente.');
    }
}

// --- Edição de Perfil ---
function loadProfileData(){
    const p = window.currentUserProfile || {};
    document.getElementById('profileName').value = p.name || '';
    document.getElementById('profileEmail').value = p.email || '';
    document.getElementById('profilePhone').value = p.phone || '';
    document.getElementById('profileNickname').value = p.nickname || '';
    document.getElementById('profileTeam').value = p.teamName || '';
    document.getElementById('profileAge').value = p.age || '';
    document.getElementById('profileRole').value = p.role || 'Vendedor';
    document.getElementById('profileLevel').value = p.level || 'Associado Treino';
}

function updateProfile(event){
    event.preventDefault();
    
    const profile = {
        ...window.currentUserProfile,
        name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        nickname: document.getElementById('profileNickname').value.trim(),
        teamName: document.getElementById('profileTeam').value.trim(),
        age: document.getElementById('profileAge').value.trim()
        // role e level não são editáveis pelo usuário
    };
    
    // Validar campos obrigatórios
    if (!profile.name || !profile.email) {
        alert('Nome e email são obrigatórios.');
        return;
    }
    
    // Validações adicionais
    if (!validateEmail(profile.email)) {
        alert('Email inválido.');
        return;
    }
    if (profile.phone && !validatePhone(profile.phone)) {
        alert('Telefone inválido. Use o formato (11) 99999-9999');
        return;
    }
    if (profile.age && !validateAge(profile.age)) {
        alert('Idade deve ser entre 12 e 100 anos');
        return;
    }
    
    // Salvar no localStorage primeiro (sempre funciona)
    if (window.firebaseAuth?.currentUser) {
        localStorage.setItem(`userProfile_${window.firebaseAuth.currentUser.uid}`, JSON.stringify(profile));
    }
    
    // Tenta salvar no Firestore (pode falhar se offline)
    try {
        if (window.firebaseReady && window.firebaseAuth?.currentUser) {
            import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
                .then(({ doc, setDoc, collection }) => {
                    const ref = doc(collection(window.firebaseDb, 'users'), window.firebaseAuth.currentUser.uid);
                    return setDoc(ref, profile, { merge: true });
                })
                .then(() => {
                    console.log('Perfil salvo no Firestore');
                })
                .catch((e) => {
                    console.log('Firestore offline, perfil salvo localmente');
                });
        }
    } catch (e) {
        console.log('Firestore offline, perfil salvo localmente');
    }
    
    // Atualizar perfil local
    window.currentUserProfile = profile;
    
    alert('Perfil atualizado com sucesso!');
}

// Top alert control (example trigger)
window.addEventListener('load', () => {
    const alertBar = document.getElementById('topAlert');
    if (!alertBar) return;
    // Lê configuração do Firestore: collection 'config', doc 'topAlert'
    (async () => {
        try{
            if (!window.firebaseReady) { alertBar.classList.add('hidden'); return; }
            const { doc, getDoc, collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb,'config'), 'topAlert');
            const apply = (data) => {
                const enabled = !!data?.enabled;
                const text = data?.text || '';
                if (enabled && text){
                    alertBar.innerHTML = text;
                    alertBar.classList.remove('hidden');
                } else {
                    alertBar.classList.add('hidden');
                }
            };
            try{
                const snap = await getDoc(ref);
                if (snap.exists()) apply(snap.data()); else alertBar.classList.add('hidden');
            }catch(_){ alertBar.classList.add('hidden'); }
            try{
                onSnapshot(ref, (snap)=>{ if (snap.exists()) apply(snap.data()); });
            }catch(_){ }
        }catch(_){ /* fallback: manter oculto */ }
    })();
});

// Back to top logic
const backBtn = document.getElementById('backToTop');
if (backBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) backBtn.classList.remove('hidden');
        else backBtn.classList.add('hidden');
    });
    backBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Mobile menu expandido - aparece ao rolar para baixo
let lastScrollY = 0;
const mobileMenuExpanded = document.getElementById('mobileMenuExpanded');
if (mobileMenuExpanded) {
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        // Mostrar menu expandido quando rolar para baixo (scroll > 50px)
        if (currentScrollY > 50) {
            mobileMenuExpanded.classList.remove('hidden');
        } else {
            mobileMenuExpanded.classList.add('hidden');
        }
        
        lastScrollY = currentScrollY;
    }, { passive: true });
}

function maybeClearMobileModalState(){
    const anyOpen = [
        document.getElementById('loginModal'),
        document.getElementById('purchaseModal'),
        document.getElementById('clientAreaModal'),
        document.getElementById('tokensModal'),
        document.getElementById('freeWhatsModal'),
        document.getElementById('scheduleModal')
    ].some(el => el && !el.classList.contains('hidden'));
    if (!anyOpen) document.body.classList.remove('modal-open-mobile');
}

// Expor função de cupom globalmente
// Aplicar cupom no modal de agendamento
async function applyScheduleCoupon() {
    const couponCode = document.getElementById('schedCouponCodeInput')?.value?.trim().toUpperCase();
    const messageDiv = document.getElementById('schedCouponMessage');
    
    if (!couponCode) {
        showScheduleCouponMessage('Digite um código de cupom', 'error');
        return;
    }
    
    try {
        console.log('🔄 Validando cupom para eventos:', couponCode);
        
        // Importar Firebase
        const { collection, getDocs, query, where, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        // Buscar cupom no Firestore
        const couponsRef = collection(window.firebaseDb, 'coupons');
        const q = query(couponsRef, where('code', '==', couponCode), limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            showScheduleCouponMessage('Cupom não encontrado', 'error');
            return;
        }
        
        const couponDoc = snapshot.docs[0];
        const coupon = { id: couponDoc.id, ...couponDoc.data() };
        
        // Validar cupom para eventos
        const validation = validateScheduleCoupon(coupon);
        if (!validation.valid) {
            showScheduleCouponMessage(validation.message, 'error');
            return;
        }
        
        // Aplicar cupom
        appliedScheduleCoupon = coupon;
        updateSchedulePriceWithCoupon();
        showScheduleCouponMessage(`Cupom aplicado! Desconto: ${getDiscountText(coupon)}`, 'success');
        
        console.log('✅ Cupom aplicado para eventos:', coupon);
        
    } catch (error) {
        console.error('❌ Erro ao validar cupom:', error);
        showScheduleCouponMessage('Erro ao validar cupom. Tente novamente.', 'error');
    }
}

// Validar cupom para eventos
function validateScheduleCoupon(coupon) {
    // Verificar se está ativo
    if (!coupon.isActive) {
        return { valid: false, message: 'Cupom inativo' };
    }
    
    // Verificar data de expiração
    if (coupon.expirationDate) {
        const expirationDate = coupon.expirationDate.toDate ? coupon.expirationDate.toDate() : new Date(coupon.expirationDate);
        if (expirationDate < new Date()) {
            return { valid: false, message: 'Cupom expirado' };
        }
    }
    
    // Verificar se o cupom pode ser usado em eventos
    if (coupon.usageType === 'store') {
        return { valid: false, message: 'Cupom válido apenas para loja virtual' };
    }
    
    return { valid: true };
}

// Obter total atual do agendamento
function getCurrentScheduleTotal() {
    const totalElement = document.getElementById('totalPrice');
    if (!totalElement) return 0;
    
    const totalText = totalElement.textContent.replace('R$ ', '').replace(',', '.');
    return parseFloat(totalText) || 0;
}

// Atualizar preço do agendamento com cupom
function updateSchedulePriceWithCoupon() {
    if (!appliedScheduleCoupon) return;
    
    const totalElement = document.getElementById('totalPrice');
    if (!totalElement) return;
    
    const currentTotal = getCurrentScheduleTotal();
    let discountAmount = 0;
    
    if (appliedScheduleCoupon.discountType === 'percentage') {
        discountAmount = currentTotal * (appliedScheduleCoupon.discountValue / 100);
    } else {
        discountAmount = appliedScheduleCoupon.discountValue;
    }
    
    const finalTotal = Math.max(0, currentTotal - discountAmount);
    totalElement.textContent = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
}

// Mostrar mensagem de cupom no agendamento
function showScheduleCouponMessage(message, type) {
    const messageDiv = document.getElementById('schedCouponMessage');
    messageDiv.textContent = message;
    messageDiv.className = `text-sm ${type === 'success' ? 'text-green-600' : 'text-red-600'}`;
    messageDiv.classList.remove('hidden');
    
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 3000);
}

// Registrar uso de cupom
async function recordCouponUsage(couponId, couponCode, orderValue, discountAmount, context, orderId) {
    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        const usageData = {
            couponId: couponId,
            couponCode: couponCode,
            customerEmail: window.currentUser?.email || 'guest',
            customerName: window.currentUser?.displayName || 'Cliente',
            orderValue: orderValue,
            discountAmount: discountAmount,
            finalValue: orderValue - discountAmount,
            context: context, // 'store' ou 'events'
            orderId: orderId,
            usedAt: new Date(),
            userId: window.currentUser?.uid || null
        };
        
        await addDoc(collection(window.firebaseDb, 'couponUsage'), usageData);
        
        // Atualizar contador de uso do cupom
        await updateCouponUsageCount(couponId);
        
        console.log('✅ Uso de cupom registrado:', usageData);
    } catch (error) {
        console.error('❌ Erro ao registrar uso de cupom:', error);
    }
}

// Atualizar contador de uso do cupom
async function updateCouponUsageCount(couponId) {
    try {
        const { doc, updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        
        const couponRef = doc(window.firebaseDb, 'coupons', couponId);
        await updateDoc(couponRef, {
            usageCount: increment(1)
        });
        
        console.log('✅ Contador de uso do cupom atualizado');
    } catch (error) {
        console.error('❌ Erro ao atualizar contador de uso:', error);
    }
}

window.applyCoupon = applyCoupon;
window.applyScheduleCoupon = applyScheduleCoupon;
window.recordCouponUsage = recordCouponUsage;
window.openScheduleModal = openScheduleModal;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.openTokensModal = openTokensModal;
window.closeTokensModal = closeTokensModal;
window.openFreeWhatsModal = openFreeWhatsModal;
window.closeFreeWhatsModal = closeFreeWhatsModal;


