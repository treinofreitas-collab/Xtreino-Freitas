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
window.alert = function (message) {
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
window.confirm = function (message) {
    return showConfirm('Confirmar', message);
};

// Helper functions for different toast types
window.showSuccessToast = function (message, title = 'Sucesso') {
    showToast('success', message, title);
};

window.showErrorToast = function (message, title = 'Erro') {
    showToast('error', message, title);
};

window.showInfoToast = function (message, title = 'Informação') {
    showToast('info', message, title);
};

window.showWarningToast = function (message, title = 'Atenção') {
    showToast('warning', message, title);
};

const CAMP_SEMIFINAL_DATES = ['2024-11-22', '2024-11-23', '2025-11-22', '2025-11-23'];
const CAMP_FINAL_DATES = ['2024-11-28', '2025-11-28'];
const CAMP_SEMIFINAL_LINK_CACHE_TTL = 60000;
let campSemifinalLinksCache = { data: null, timestamp: 0 };

const AFFILIATE_REF_KEY = 'xf_affiliate_ref';
const AFFILIATE_REF_TS_KEY = 'xf_affiliate_ref_ts';
const AFFILIATE_REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function captureAffiliateRefFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref && typeof ref === 'string' && ref.trim().length >= 6) {
            storeAffiliateRef(ref.trim());          
        }
    } catch (error) {
        
    }
}

function storeAffiliateRef(ref) {
    try {
        localStorage.setItem(AFFILIATE_REF_KEY, ref);
        localStorage.setItem(AFFILIATE_REF_TS_KEY, Date.now().toString());
    } catch (_) { }
    try {
        sessionStorage.setItem(AFFILIATE_REF_KEY, ref);
        sessionStorage.setItem(AFFILIATE_REF_TS_KEY, Date.now().toString());
    } catch (_) { }
}

function clearStoredAffiliateRef() {
    try {
        localStorage.removeItem(AFFILIATE_REF_KEY);
        localStorage.removeItem(AFFILIATE_REF_TS_KEY);
    } catch (_) { }
    try {
        sessionStorage.removeItem(AFFILIATE_REF_KEY);
        sessionStorage.removeItem(AFFILIATE_REF_TS_KEY);
    } catch (_) { }
}

function getStoredAffiliateRef() {
    try {
        const ref = sessionStorage.getItem(AFFILIATE_REF_KEY) || localStorage.getItem(AFFILIATE_REF_KEY);
        if (!ref) return null;
        const tsStr = sessionStorage.getItem(AFFILIATE_REF_TS_KEY) || localStorage.getItem(AFFILIATE_REF_TS_KEY);
        const ts = tsStr ? parseInt(tsStr, 10) : null;
        if (ts && (Date.now() - ts) > AFFILIATE_REF_TTL_MS) {
            clearStoredAffiliateRef();
            return null;
        }
        return ref;
    } catch (_) {
        return null;
    }
}

function getActiveAffiliateCode(preferredAffiliateId = null) {
    if (preferredAffiliateId) return preferredAffiliateId;
    const storedRef = getStoredAffiliateRef();
    if (!storedRef) return null;
    const currentUid = window.currentUserProfile?.uid || window.firebaseAuth?.currentUser?.uid || null;
    if (currentUid && storedRef === currentUid) return null; // evita auto-comissão
    return storedRef;
}

// Função especializada para exibir erros de pagamento com tokens de forma elegante
function showTokenPaymentError(errorCode, errorMessage, details = null) {
    // Mapeamento de mensagens amigáveis para cada código de erro
    const friendlyMessages = {
        'ERR_TKN_001': 'Erro ao processar dados da reserva',
        'ERR_TKN_002': 'Saldo de tokens insuficiente',
        'ERR_TKN_003': 'Erro ao criar reservas',
        'ERR_TKN_004': 'Erro ao calcular valores',
        'ERR_TKN_005': 'Erro ao validar saldo',
        'ERR_TKN_006': 'Validação de pagamento falhou',
        'ERR_TKN_007': 'Erro ao processar pagamento',
        'ERR_TKN_008': 'Erro ao processar reservas',
        'ERR_TKN_009': 'Erro ao confirmar pagamento',
        'ERR_TKN_010': 'Erro crítico - contate o suporte',
        'ERR_TKN_011': 'Erro inesperado',
        'ERR_SPEND_001': 'Valor inválido',
        'ERR_SPEND_002': 'Saldo insuficiente',
        'ERR_SPEND_003': 'Erro ao acessar sua conta',
        'ERR_SPEND_004': 'Erro no cálculo',
        'ERR_SPEND_005': 'Erro ao salvar alterações'
    };

    const friendlyTitle = friendlyMessages[errorCode] || 'Erro no Pagamento';

    // Mensagem formatada de forma elegante
    let formattedMessage = errorMessage;
    if (details) {
        formattedMessage += `\n\n${details}`;
    }

    // Criar toast customizado com código de erro destacado
    const container = document.getElementById('toastContainer');
    if (!container) {
        // Fallback para alert se o container não existir
        alert(`${friendlyTitle}\n\n${formattedMessage}\n\nCódigo: ${errorCode}`);
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-error';

    toast.innerHTML = `
        <div class="toast-icon" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
        </div>
        <div class="toast-content" style="flex: 1;">
            <div class="toast-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span>${friendlyTitle}</span>
                <span style="background: rgba(239, 68, 68, 0.1); color: #dc2626; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; font-family: monospace;">
                    ${errorCode}
                </span>
            </div>
            <div class="toast-message" style="white-space: pre-line; line-height: 1.6;">
                ${formattedMessage}
            </div>
            ${details ? `
            <div style="margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 12px; color: #7f1d1d;">
                ${details}
            </div>
            ` : ''}
        </div>
        <button class="toast-close" onclick="removeToast(this.parentElement)">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove após 8 segundos (mais tempo para erros)
    setTimeout(() => {
        removeToast(toast);
    }, 8000);

    // Também logar no console para debug
    
    if (details) {
        
    }

    return toast;
}

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

function openLoginModal() {
    const m = document.getElementById('loginModal');
    if (m) m.classList.remove('hidden');
}
function closeLoginModal() {
    const m = document.getElementById('loginModal');
    if (m) m.classList.add('hidden');
    if (!window.isLoggedIn) {
        const url = new URL(window.location.href);
        if (url.searchParams.has('marketplaceLogin')) {
            url.searchParams.delete('marketplaceLogin');
            window.history.replaceState({}, '', url);
        }
    }
}
function showAuthTab(tab) {
    const tabs = ['login', 'register', 'reset'];
    tabs.forEach(t => {
        const el = document.getElementById('auth' + t.charAt(0).toUpperCase() + t.slice(1));
        const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (!el || !btn) return;
        if (t === tab) { el.classList.remove('hidden'); btn.classList.add('border-blue-matte'); btn.classList.remove('text-gray-500'); }
        else { el.classList.add('hidden'); btn.classList.remove('border-blue-matte'); btn.classList.add('text-gray-500'); }
    });
    const msg = document.getElementById('authMsg'); if (msg) msg.textContent = '';
}

async function loginWithGoogle() {
    try {
        if (!window.firebaseReady) { throw new Error('Firebase não inicializado'); }
        const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        const provider = new GoogleAuthProvider();
        const res = await signInWithPopup(window.firebaseAuth, provider);
        onAuthLogged(res.user);
    } catch (e) { document.getElementById('authMsg').textContent = 'Erro no login Google.'; }
}


async function loginWithEmailPassword() {
    try {
        if (!window.firebaseReady) { throw new Error('Firebase não inicializado'); }
        const email = document.getElementById('authEmail').value.trim();
        const pass = document.getElementById('authPassword').value.trim();
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        const res = await signInWithEmailAndPassword(window.firebaseAuth, email, pass);
        onAuthLogged(res.user);
    } catch (e) { document.getElementById('authMsg').textContent = 'Email ou senha inválidos.'; }
}

async function registerWithEmailPassword() {
    try {
        if (!window.firebaseReady) { throw new Error('Firebase não inicializado'); }
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
        try {
            if (window.firebaseReady) {
                const { collection, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                const ref = doc(collection(window.firebaseDb, 'users'), cred.user.uid);
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
        } catch (e) {
            
        }
        onAuthLogged(cred.user);
    } catch (e) { document.getElementById('authMsg').textContent = e.message || 'Não foi possível criar a conta.'; }
}

async function sendPasswordReset() {
    try {
        if (!window.firebaseReady) { throw new Error('Firebase não inicializado'); }
        const email = document.getElementById('resetEmail').value.trim();
        const btn = document.getElementById('resetBtn');
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            const alertEl = document.getElementById('resetAlert');
            if (alertEl) {
                alertEl.className = 'text-sm px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200';
                alertEl.textContent = 'Digite um email válido.';
                alertEl.classList.remove('hidden');
            } else {
                document.getElementById('authMsg').textContent = 'Digite um email válido.';
            }
            return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
        const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        await sendPasswordResetEmail(window.firebaseAuth, email);
        const alertEl = document.getElementById('resetAlert');
        if (alertEl) {
            alertEl.className = 'text-sm px-3 py-2 rounded-md bg-green-50 text-green-700 border border-green-200';
            alertEl.textContent = 'Pronto! Enviamos um link de recuperação para seu email.';
            alertEl.classList.remove('hidden');
        } else {
            document.getElementById('authMsg').textContent = 'Enviamos um link de recuperação para seu email. Confira também a caixa de spam.';
        }
        if (btn) { btn.textContent = 'Email enviado'; }
    } catch (e) {
        const msg = (e && e.code) ? String(e.code).replace('auth/', '').replaceAll('-', ' ') : 'Erro ao enviar recuperação.';
        const alertEl = document.getElementById('resetAlert');
        if (alertEl) {
            alertEl.className = 'text-sm px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200';
            alertEl.textContent = msg;
            alertEl.classList.remove('hidden');
        } else {
            document.getElementById('authMsg').textContent = msg;
        }
    } finally {
        const btn = document.getElementById('resetBtn');
        if (btn) { btn.disabled = false; }
    }
}

function onAuthLogged(user) {
    const returnToMarketplace = new URLSearchParams(window.location.search).get('marketplaceLogin') === '1';
    // Atualiza lastLogin no Firestore
    try {
        if (window.firebaseReady && window.firebaseDb && user?.uid) {
            (async () => {
                const { doc, setDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                const ref = doc(collection(window.firebaseDb, 'users'), user.uid);
                await setDoc(ref, { lastLogin: serverTimestamp(), email: user.email || null }, { merge: true });
            })().catch(() => { });
        }
    } catch (_) {/* noop */ }
    try {
        const name = user?.displayName || user?.email || 'Usuário';
        const welcome = document.getElementById('accWelcome');
        if (welcome) welcome.textContent = `Bem-vindo, ${name}!`;
    } catch (_) { }
    window.isLoggedIn = true;
    toggleAccountButtons(true);
    closeLoginModal();
    updateAdminLinkVisibility();
    if (returnToMarketplace) {
        const url = new URL(window.location.href);
        url.searchParams.delete('marketplaceLogin');
        window.history.replaceState({}, '', url);
        window.location.href = 'mercado-da-bala/';
        return;
    }
    // registra lastLogin
    try {
        if (window.firebaseReady && window.firebaseAuth?.currentUser) {
            import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
                .then(({ doc, setDoc, collection }) => {
                    const uid = window.firebaseAuth.currentUser.uid;
                    const ref = doc(collection(window.firebaseDb, 'users'), uid);
                    return setDoc(ref, { lastLogin: Date.now() }, { merge: true });
                }).catch(() => { });
        }
    } catch (_) { }
    // Redireciono para o admin se foi solicitado e o usuário tiver permissão
    if (window.postLoginRedirect === 'admin') {
        setTimeout(async () => {
            try {
                const uid = user?.uid || window.firebaseAuth?.currentUser?.uid;
                if (uid) {
                    await loadUserProfile(uid);
                    const role = (window.currentUserProfile?.role || '').toLowerCase();
                    if (['ceo', 'gerente', 'vendedor', 'design', 'socio', 'afiliado', 'staff',
                         'moderador', 'operador', 'suporte'].includes(role)) {
                        window.postLoginRedirect = null;
                        window.location.href = 'admin.html';
                        return;
                    }
                }
                showErrorToast('Acesso ao painel restrito (CEO, Gerente, Vendedor, Design, Sócio, Afiliado ou Staff).', 'Acesso Negado');
                window.postLoginRedirect = null;
            } catch (_) { window.postLoginRedirect = null; }
        }, 100);
    }
    // Redireciono para a aba de Meus Tokens se foi solicitado a partir do agendamento
    if (window.postLoginRedirect === 'myTokens') {
        window.postLoginRedirect = null;
        setTimeout(() => { window.location.href = 'client.html?tab=myTokens'; }, 100);
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
    //         
    //     }
    // }, 1000);

    // Não abre automaticamente a área do cliente - só quando clicar em MINHA CONTA
}

function toggleAccountButtons(isLogged) {
    const loginDesk = document.getElementById('loginBtnDesktop');
    const accountSectionDesktop = document.getElementById('accountSectionDesktop');
    const loginMob = document.getElementById('loginBtnMobile');
    const profileAvatarMobile = document.getElementById('profileAvatarMobile');
    const accountBtnMobileExpanded = document.getElementById('accountBtnMobileExpanded');

    // Desktop
    if (loginDesk && accountSectionDesktop) {
        loginDesk.classList.toggle('hidden', isLogged);
        accountSectionDesktop.classList.toggle('hidden', !isLogged);
    }

    // Mobile - Avatar sempre visível quando logado, botão CONTA no menu expandido
    if (loginMob && profileAvatarMobile) {
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
    try {
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
    } catch (_) { /* noop */ }
});

// Verificar se usuário é admin autorizado
async function checkAdminAccess() {
    

    if (!window.isLoggedIn || !window.firebaseAuth?.currentUser) {
        
        return false;
    }

    const user = window.firebaseAuth.currentUser;
    const authorizedEmails = ['cleitondouglass@gmail.com', 'cleitondouglass123@hotmail.com', 'gilmariofreitas378@gmail.com', 'gilmariofreitas387@gmail.com'];

    

    // Verificar role no Firestore primeiro
    try {
        const uid = user.uid;
        
        

        const { doc, getDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDoc(doc(collection(window.firebaseDb, 'users'), uid));
        if (snap.exists()) {
            const userData = snap.data();
            const role = (userData.role || '').toLowerCase();
            
            

            // Para design e socio, permitir qualquer email (incluindo variações)
            const designVariations = ['design', 'designer', 'desgin', 'desgine'];
            const socioVariations = ['socio', 'sócio'];

            
            
            

            // Verificação adicional para socio com diferentes variações
            const isSocio = role === 'socio' || role === 'sócio' || role.includes('socio') || role.includes('sócio');
            

            if (designVariations.includes(role) || socioVariations.includes(role) || isSocio) {
                
                return true;
            }

            

            // Cargos sem whitelist adicional (segurança garantida pelo login do admin.html)
            if (['ceo', 'gerente', 'staff', 'moderador', 'operador', 'suporte'].includes(role)) {
                return true;
            }
            // Qualquer cargo admin reconhecido tem acesso ao botão
            if (['admin', 'vendedor'].includes(role)) {
                return true;
            }
        }
    } catch (error) {
        
    }

    
    return false;
}

// Mostrar/esconder link ADMIN baseado no acesso
async function updateAdminLinkVisibility() {
   
    const adminLink = document.getElementById('adminLink');
    const adminLinkMobile = document.getElementById('adminLinkMobile');
    if (!adminLink && !adminLinkMobile) {
        
        return;
    }

    const hasAccess = await checkAdminAccess();

    const toggle = (el, show) => {
        if (!el) return;
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    };
    toggle(adminLink, hasAccess);
    toggle(adminLinkMobile, hasAccess);
    const adminLinkMobileExpanded = document.getElementById('adminLinkMobileExpanded');
    if (adminLinkMobileExpanded) {
        toggle(adminLinkMobileExpanded, hasAccess);
    }
   
}

function requestAdminAccess() {
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

async function logout() {
    try {
        if (window.firebaseReady) {
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
            await signOut(window.firebaseAuth);
        }
    } catch (_) { }
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
function goToTokensFromSchedule() {
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
function refreshAuthButtons() { /* removed */ }

// Abrir modal de cadastro direto (atalho)
function openRegisterModal() { /* removed */ }

// Submissão de cadastro: salva no perfil e persiste
async function submitRegister() { /* removed */ }

// Inicializa header conforme sessão prévia
window.addEventListener('load', () => {
    try {
        initShopCartHook();
        // Aguardar um pouco para garantir que o Firebase esteja carregado
        setTimeout(() => {
            updateAdminLinkVisibility();
        }, 1000);
    } catch (_) { }
});

// ---------------- Área de Associados: cargos, níveis, permissões e tokens ----------------
// Configuração centralizada acessível via window.AssocConfig
window.AssocConfig = {
    roles: {
        GERENTE: 'Gerente',
        CEO: 'Ceo',
        STAFF: 'Staff',
        VENDEDOR: 'Vendedor',
        AFILIADO: 'Afiliado'
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
        },
        Afiliado: {
            redeemTokens: false,
            purchaseItems: true,
            accessExclusive: false,
            manageSalesFlow: false,
            viewCommissions: true,
            viewSales: true
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
document.addEventListener('DOMContentLoaded', function () {
    captureAffiliateRefFromUrl();
    // Aguarda o Firebase estar pronto
    const checkFirebaseReady = () => {
        if (window.firebaseReady) {
            checkAuthState();
            // Tenta sincronizar dados offline quando Firebase estiver pronto
            syncOfflineData();
            // Trata retorno do Mercado Pago e atualiza vagas
            try {
                const sp = new URLSearchParams(location.search);

                // Parâmetros reais enviados pelo Mercado Pago no redirect de volta
                const mpCollectionStatus = sp.get('collection_status'); // "approved" | "rejected" | "pending"
                const mpPaymentStatus    = sp.get('status');            // "approved" | "rejected" | "pending"
                const mpExternalRef      = sp.get('external_reference');
                const mpPreferenceId     = sp.get('preference_id') || sp.get('preference-id');

                const mpApproved = mpCollectionStatus === 'approved' || mpPaymentStatus === 'approved';
                const mpRejected = mpCollectionStatus === 'rejected'  || mpPaymentStatus === 'rejected';
                const mpPending  = mpCollectionStatus === 'pending'   || mpPaymentStatus === 'pending';

                // Evidência de pagamento pendente em sessão (usuário voltou sem passar pelos params do MP)
                // localStorage como fallback se sessionStorage foi limpo (aba fechada, outro dispositivo, etc.)
                const _lsRaw = (() => { try { return JSON.parse(localStorage.getItem('_pendingPagamento') || 'null'); } catch(_){return null;} })();
                const _lsRef = (_lsRaw && (Date.now() - (_lsRaw.ts||0)) < 7200000) ? _lsRaw.ref : null;
                const storedRef = sessionStorage.getItem('lastExternalRef') || _lsRef;

                if (mpApproved && mpExternalRef) {
                    // ✅ Retorno direto do MP com pagamento aprovado — processar imediatamente
                    history.replaceState({}, document.title, location.pathname);
                    if (mpExternalRef !== storedRef) {
                        try { sessionStorage.setItem('lastExternalRef', mpExternalRef); } catch (_) {}
                    }
                    processSuccessfulPayment(mpExternalRef);

                } else if (mpRejected && mpExternalRef) {
                    // ❌ Pagamento rejeitado
                    history.replaceState({}, document.title, location.pathname);
                    openPaymentConfirmModal('Pagamento Rejeitado', 'Seu pagamento foi rejeitado pelo Mercado Pago. Tente novamente ou use outro cartão.');

                } else if ((mpPending || mpPreferenceId) && (mpExternalRef || storedRef)) {
                    // ⏳ Pagamento pendente — verificar via Netlify function com polling
                    history.replaceState({}, document.title, location.pathname);
                    const refToCheck = mpExternalRef || storedRef;
                    if (refToCheck !== storedRef) {
                        try { sessionStorage.setItem('lastExternalRef', refToCheck); } catch (_) {}
                    }
                    checkPaymentStatus(mpPreferenceId || refToCheck);

                } else if (storedRef && !mpCollectionStatus && !mpPaymentStatus) {
                    // 🔄 Usuário voltou ao site manualmente (sem params do MP) mas havia uma sessão de pagamento
                    // Verificar via Netlify function se o pagamento foi aprovado
                    checkPaymentStatus(storedRef);

                } else if (!storedRef && !mpCollectionStatus && !mpPaymentStatus) {
                    // Sem evidência nenhuma — limpar e ignorar
                    sessionStorage.removeItem('lastExternalRef');
                    sessionStorage.removeItem('lastRegId');
                    sessionStorage.removeItem('lastRegIds');
                    sessionStorage.removeItem('lastRegInfo');
                }
            } catch (_) { }
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
            
        }
    } catch (e) {
        
    }
}

async function checkAuthState() {
    try {
        if (window.firebaseReady && window.firebaseAuth) {
            const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
            onAuthStateChanged(window.firebaseAuth, (user) => {
                window.currentUser = user || null;
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
                    // Unsubscribe profile listener if exists
                    if (window._userProfileUnsubscribe && typeof window._userProfileUnsubscribe === 'function') {
                        try { window._userProfileUnsubscribe(); } catch (_) { }
                        window._userProfileUnsubscribe = null;
                    }
                    toggleAccountButtons(false);
                    updateAdminLinkVisibility();
                }
            });
        }
    } catch (e) {
        
    }
}

async function loadUserProfile(uid) {
    try {
        // Sempre priorizar Firestore: usar listener onSnapshot para receber atualizações em tempo real
        // Isso garante que créditos de tokens aplicados pelo webhook apareçam imediatamente
        if (window._userProfileUnsubscribe && typeof window._userProfileUnsubscribe === 'function') {
            try { window._userProfileUnsubscribe(); } catch (_) { }
            window._userProfileUnsubscribe = null;
        }
        if (window.firebaseReady) {
            const { doc, collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'users'), uid);
            // onSnapshot will call immediately with current data and on further updates
            window._userProfileUnsubscribe = onSnapshot(ref, (snap) => {
                if (snap.exists && typeof snap.data === 'function') {
                    window.currentUserProfile = snap.data();
                    
                } else {
                    // Criar perfil básico em memória se não existir
                    window.currentUserProfile = {
                        uid: uid,
                        email: window.firebaseAuth.currentUser?.email || '',
                        name: window.firebaseAuth.currentUser?.displayName || 'Usuário',
                        tokens: 0,
                        role: 'Usuario',
                        level: 'Associado Treino'
                    };
                    
                }
                updateHeaderTokenBadges();
            }, (err) => {
                
            });
        } else {
            // Fallback: cria perfil básico se Firebase não estiver pronto (em memória)
            window.currentUserProfile = {
                uid: uid,
                email: window.firebaseAuth.currentUser?.email || '',
                name: window.firebaseAuth.currentUser?.displayName || 'Usuário',
                tokens: 0,
                role: 'Usuario',
                level: 'Associado Treino'
            };
            
        }
    } catch (e) {
        
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
function updateHeaderTokenBadges() {
    try {
        const isLogged = !!(window.isLoggedIn && window.currentUserProfile);
        const bal = isLogged ? Math.round(getTokenBalance()) : 0;
        const d = document.getElementById('tokenBadgeDesktop');
        const m = document.getElementById('tokenBadgeMobile');
        if (d) { d.classList.toggle('hidden', !isLogged); d.textContent = `💎 ${bal}`; }
        if (m) { m.classList.toggle('hidden', !isLogged); m.textContent = `💎 ${bal}`; }

        // Atualizar foto de perfil no header
        updateHeaderProfilePhoto();
    } catch (_) { }
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
                avatarImageDesktop.onload = function () {
                    avatarImageDesktop.classList.remove('hidden');
                    avatarInitialsDesktop.classList.add('hidden');
                };
                avatarImageDesktop.onerror = function () {
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
                avatarImageMobile.onload = function () {
                    avatarImageMobile.classList.remove('hidden');
                    avatarInitialsMobile.classList.add('hidden');
                };
                avatarImageMobile.onerror = function () {
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
// Validar se pode gastar tokens
function canSpendTokens(amountBRL) {
    try {
        // Verificar se usuário está autenticado e perfil carregado
        if (!window.firebaseAuth?.currentUser) return false;
        if (!window.currentUserProfile) return false;

        const balance = Number(window.currentUserProfile.tokens || 0);
        const amount = Number(amountBRL || 0);

        if (isNaN(amount) || amount <= 0) return false;
        if (isNaN(balance) || balance < 0) return false;

        const canSpend = balance >= amount;
        
        return canSpend;
    } catch (error) {
        
        return false;
    }
}

// Debitar tokens localmente (retorna novo saldo)
function spendTokensSync(amountBRL) {
    const amt = Number(amountBRL || 0);
    if (isNaN(amt) || amt <= 0) throw new Error('TOKEN_005');
    if (!window.currentUserProfile) throw new Error('AUTH_001');

    const currentBalance = Number(window.currentUserProfile.tokens || 0);
    if (currentBalance < amt) throw new Error('TOKEN_001');

    const newBalance = Number((currentBalance - amt).toFixed(2));
    if (newBalance < 0) throw new Error('TOKEN_005');

    window.currentUserProfile.tokens = newBalance;
    try { localStorage.setItem('assoc_profile', JSON.stringify(window.currentUserProfile)); } catch (_) { }
    
    return newBalance;
}


// Debitar tokens e persistir no Firestore (Versão Segura com Rollback)
async function spendTokens(amountBRL) {
    const amt = Number(amountBRL || 0);
    // Guarda o saldo original
    const originalBalance = Number(window.currentUserProfile?.tokens || 0);

    try {
        
        
        if (isNaN(amt) || amt <= 0) { showErrorToast('Valor inválido', 'TOKEN_005'); return false; }
        if (!window.firebaseAuth?.currentUser) { showErrorToast('Faça login novamente', 'AUTH_001'); return false; }
        
        // Verificação visual imediata
        if (!canSpendTokens(amt)) { showErrorToast('Saldo insuficiente', 'TOKEN_001'); return false; }

        // 1. Debita Localmente (Visual Rápido)
        const newBalance = spendTokensSync(amt);
        updateHeaderTokenBadges(); 

        // 2. Persiste no Banco
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const userRef = doc(window.firebaseDb, 'users', window.firebaseAuth.currentUser.uid);
        
        await updateDoc(userRef, { tokens: newBalance });
        
        return true;

    } catch (error) {
        
        
        // --- ROLLBACK (Devolve o token visualmente) ---
        
        if (window.currentUserProfile) {
            window.currentUserProfile.tokens = originalBalance;
            try { localStorage.setItem('assoc_profile', JSON.stringify(window.currentUserProfile)); } catch(_) {}
            updateHeaderTokenBadges(); 
        }
        // ----------------------------------------------

        alert('Erro de conexão ao usar seus tokens. Seu saldo foi restaurado. Por favor, tente novamente.');
        return false;
    }
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
                
            }

            // Dar token inicial apenas se o usuário realmente não tem tokens (não é 0, mas undefined/null)
            if (window.currentUserProfile.tokens === undefined || window.currentUserProfile.tokens === null) {
                await setDoc(userRef, { tokens: 1 }, { merge: true });
                window.currentUserProfile.tokens = 1;
                
            }

            // Atualizar localStorage também
            localStorage.setItem('assoc_profile', JSON.stringify(window.currentUserProfile));

            

            // Atualizar interface
            renderClientArea();
            updateHeaderTokenBadges();
        }
    } catch (error) {
        
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
        role: 'Usuario', // uma nova conta não recebe permissões de vendedor
        level: undefined,
        tokens: 0
    };
    try {
        const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        const isNetlify = /netlify\.app$/i.test(location.hostname);
        // Sempre tentar Firestore quando disponível e com usuário logado
        if (window.firebaseReady && user?.uid) {
            const { doc, getDoc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'users'), user.uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                await setDoc(ref, baseProfile);
                window.currentUserProfile = baseProfile;
                
            } else {
                const data = snap.data();
                window.currentUserProfile = { ...baseProfile, ...data };
                
            }
        } else {
            // Sem Firebase: usa somente base em memória (não persiste em localStorage)
            window.currentUserProfile = baseProfile;
            
        }

        // Sincronização automática removida para evitar reset do saldo
        // if (window.firebaseReady && !isLocal && !isNetlify && user?.uid) {
        //     await syncUserTokens();
        // }
    } catch (err) {
        // Tratamento de erro com código padronizado
        if (err.message && err.message.includes('permission')) {
            logError('AUTH_005', 'AUTH_005');
        } else if (err.message && err.message.includes('network') || err.message && err.message.includes('fetch')) {
            logError('SYS_003', 'SYS_003');
        } else {
            logError(err, 'AUTH_005');
        }
        
        window.currentUserProfile = baseProfile;
    }
}

async function persistUserProfile(profile) {
    try {
        

        // Garantir UID presente
        if (!profile.uid && window.firebaseAuth && window.firebaseAuth.currentUser) {
            profile.uid = window.firebaseAuth.currentUser.uid;
        }
        // Normalizar tokens
        if (profile.tokens === undefined || profile.tokens === null) {
            profile.tokens = 0;
        }

        if (window.firebaseReady && profile?.uid) {
            const { doc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'users'), profile.uid);
            await setDoc(ref, profile, { merge: true });
            
        } else {
            
        }
    } catch (error) {
        // Tratamento de erro com código padronizado
        if (error.message && error.message.includes('permission')) {
            logError('SYS_004', 'SYS_004');
        } else {
            logError(error, 'SYS_005');
        }
        
    }
}

// Client Area Functions
function openClientArea() {
    document.getElementById('clientAreaModal').classList.remove('hidden');
    try { renderClientArea(); } catch (_) { }
    if (window.innerWidth <= 767) document.body.classList.add('modal-open-mobile');
}

function closeClientArea() { /* removed - client area não existe mais */ }

// Renderiza informações dinâmicas do cliente (nome, tokens, etc.)
function renderClientArea() {
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
    if (assocBtn) {
        const hasTokens = p && p.tokens && p.tokens > 0;
        assocBtn.disabled = !hasTokens;
        assocBtn.classList.toggle('opacity-60', !hasTokens);
        assocBtn.textContent = hasTokens ? 'USAR 1 TOKEN' : 'COMPRAR TOKENS';

        // Adicionar evento de clique se não existir
        if (!assocBtn.hasAttribute('data-listener-added')) {
            assocBtn.addEventListener('click', function () {
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
        try { renderClientArea(); } catch (_) { }
    } else if (tabName === 'profile') {
        try { loadProfileData(); } catch (_) { }
    } else if (tabName === 'orders') {
        try { loadOrders(); } catch (_) { }
    } else if (tabName === 'products') {
        try { loadProducts(); } catch (_) { }
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
    if (!canSpendTokens(t.cost)) {
        showErrorToast(`Saldo insuficiente. Você precisa de ${t.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em tokens.`, 'Saldo Insuficiente');
        return;
    }
    if (confirm(`Confirmar uso de ${t.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em tokens para ${t.label}?`)) {
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
let scheduleOriginalTotal = 0;

async function waitForFirebase(maxMs = 8000) {
    const start = Date.now();
    while (!window.firebaseReady && Date.now() - start < maxMs) {
        await new Promise(r => setTimeout(r, 150));
    }
    return !!window.firebaseReady;
}

const products = {
    // 'passe-booyah': { name: 'Passe de Elite', price: 'R$ 11,00', description: 'Passe de Elite para desbloqueio de recompensas, trajes e itens no jogo' },
    // 'aim-training': { name: 'XTreino - Aim Training', price: 'R$ 49,90', description: 'Sessão de 2 horas de treinamento' },
    // 'estrategia': { name: 'XTreino - Estratégia', price: 'R$ 79,90', description: 'Sessão de 3 horas de treinamento' },
    // 'mentalidade': { name: 'XTreino - Mentalidade', price: 'R$ 39,90', description: 'Sessão de 1.5 horas de treinamento' },
    // 'camisa': { name: 'Camisa Oficial Org Freitas', price: 'R$ 89,90', description: 'Camisa de manga curta com design exclusivo da Org Freitas' },
    // 'planilhas': { name: 'Planilha de Análise de Times', price: 'R$ 19,00', description: 'Planilha para Coach e Analista com análise detalhada de jogadores' },
    // 'imagens': { name: 'Imagens Aéreas', price: 'R$ 2,00', description: 'Mapas do Free Fire com visão aérea para estudo de calls e estratégias' },
    // 'sensibilidades': { name: 'Sensibilidade no Free Fire', price: 'R$ 8,00', description: 'Passo a passo para configurar sensibilidade Android, PC e iOS' },
    // Eventos e Reservas (cupom ADMFALL = 5% off)
    'evt-xtreino-tokens': { name: 'XTreino Freitas', price: 'R$ 1,00', description: '1 token — 10 horários diários (14h-23h) — Misto | Squad | 2 quedas' },
    'evt-modo-liga': { name: 'XTreino Modo Liga', price: 'R$ 3,00', description: '4 horários (14h, 15h, 17h, 18h) — 15 slots — Transmissão ao vivo' },
    'evt-camp-freitas': { name: 'Campeonato Freitas Season¹', price: 'R$ 8,00', description: 'Horários: 19h - 20h - 21h - 22h - 23h — Modalidade: Misto | Squad | 2 quedas por fase — Premiação R$ 4.000,00 + Troféu. Funcionamento: Segunda a Sexta-feira. Promoção: R$ 8,00 (antes R$ 10,00).' },
    'evt-semanal-freitas': { name: 'Semanal Freitas', price: 'R$ 3,50', description: '3 fases (20h, 21h, 22h) — Premiação R$ 65,00 — Termina no mesmo dia' }
};

const imgMap = {
    // 'sensibilidades': { image: 'assets/images/products/SENSIBILIDADE ORG FREITAS FORMATO YOUTUBE.png' },
    // 'imagens': { image: 'assets/images/products/IMAGENS AÉREAS ORG FREITAS FORMATO YOUTUBE.png' },
    // 'planilhas': { image: 'assets/images/products/PLANILHAS ORG FREITAS FORMATO YOUTUBE.png' },
    // 'passe-booyah': { image: 'assets/images/products/PASSE ORG FREITAS FEED.png' },
    // 'camisa': { image: 'assets/images/products/MANTO ORG FREITAS FORMATO YOUTUBE.png' },

    // imagens dos eventos (JPGs no projeto)
    'evt-xtreino-gratuito': { image: 'assets/images/events/XTREINO TOKENS.jpeg' },
    'evt-modo-liga': { image: 'assets/images/events/Modo Liga.jpeg' },
    'evt-camp-freitas': { image: 'assets/images/events/CAMP.jpeg' },
    'evt-semanal-freitas': { image: 'assets/images/events/SEMANAL FREITAS.jpg' }
};

function openPurchaseModal(productId) {
    if (!window.isLoggedIn || !window.firebaseAuth?.currentUser) {
        showToast('Faça login para comprar produtos.', 3000);
        openLoginModal();
        return;
    }
    showProductModal(productId);
}

function showProductModal(productId) {
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
            options: ['Bermuda', 'Purgatório', 'Kalahari', 'Nova Terra', 'Alpine']
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
            options: ['P', 'M', 'G', 'GG']
        }
    };

    const details = detailsMap[productId] || { desc: product.description, options: null };
    document.getElementById('purchaseTitle').textContent = product.name;

    // Descrição — oculta até o usuário clicar em "Ver detalhes" (usa somente inline styles para evitar conflitos CSS/Tailwind)
    const descEl = document.getElementById('purchaseDescription');
    descEl.textContent = '';
    descEl.style.cssText = 'display:none!important';
    const _existDescBox = document.getElementById('productDescBox');
    if (_existDescBox) _existDescBox.remove();
    const fullDesc = (details.desc || '').trim();
    if (fullDesc) {
        const _descBox = document.createElement('div');
        _descBox.id = 'productDescBox';
        _descBox.style.cssText = 'margin-bottom:12px;margin-top:2px;';
        const _descText = document.createElement('div');
        _descText.style.cssText = 'display:none;white-space:pre-wrap;color:#374151;font-size:0.85rem;line-height:1.55;margin-top:8px;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;';
        _descText.textContent = fullDesc;
        _descBox.appendChild(_descText);
        const _btn = document.createElement('button');
        _btn.type = 'button';
        _btn.style.cssText = 'display:inline-flex;align-items:center;gap:5px;color:#16a34a;font-size:0.85rem;font-weight:600;cursor:pointer;background:none;border:none;padding:3px 0;outline:none;';
        _btn.innerHTML = '<i class="fas fa-chevron-down" style="font-size:10px;transition:transform 0.2s"></i> Ver detalhes do produto';
        let _open = false;
        _btn.addEventListener('click', function() {
            _open = !_open;
            _descText.style.display = _open ? 'block' : 'none';
            _btn.innerHTML = _open
                ? '<i class="fas fa-chevron-up" style="font-size:10px"></i> Ocultar detalhes'
                : '<i class="fas fa-chevron-down" style="font-size:10px"></i> Ver detalhes do produto';
        });
        _descBox.appendChild(_btn);
        const _purchaseForm = document.querySelector('#purchaseModal form');
        if (_purchaseForm) {
            _purchaseForm.parentNode.insertBefore(_descBox, _purchaseForm);
        } else {
            descEl.insertAdjacentElement('afterend', _descBox);
        }
    }

    document.getElementById('purchasePrice').textContent = product.price;
    const headerTitle = document.getElementById('purchaseHeaderTitle');
    if (headerTitle) headerTitle.textContent = product.name;
 

    const imgEl = document.getElementById('purchaseImage');
    if (imgEl) imgEl.src = imgMap[productId].image || '';   

    // opções dinâmicas
    const optContainer = document.getElementById('purchaseOptions');
    optContainer.innerHTML = '';
    // Opções para camisa (campos adicionais)
    if (productId === 'camisa' && details.options) {
        // Tamanho
        const sizeLabel = document.createElement('label');
        sizeLabel.className = 'block text-sm font-medium mb-2';
        sizeLabel.textContent = 'Tamanho';
        const sizeSelect = document.createElement('select');
        sizeSelect.id = 'shirtSize';
        sizeSelect.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black focus:border-blue-matte focus:outline-none';
        details.options.forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; sizeSelect.appendChild(op); });
        optContainer.appendChild(sizeLabel);
        optContainer.appendChild(sizeSelect);
        // Nome (opcional)
        const nameLabel = document.createElement('label'); nameLabel.className = 'block text-sm font-medium mb-2 mt-4'; nameLabel.textContent = 'Nome (camisa) — opcional';
        const nameInput = document.createElement('input'); nameInput.id = 'shirtName'; nameInput.type = 'text'; nameInput.placeholder = 'Ex.: FREITAS'; nameInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(nameLabel); optContainer.appendChild(nameInput);

        // Quantidade
        const qtyLabel = document.createElement('label'); qtyLabel.className = 'block text-sm font-medium mb-2 mt-4'; qtyLabel.textContent = 'Quantidade';
        const qtyInput = document.createElement('input'); qtyInput.id = 'shirtQty'; qtyInput.type = 'number'; qtyInput.min = '1'; qtyInput.value = '1'; qtyInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(qtyLabel); optContainer.appendChild(qtyInput);

        // Endereço de Entrega — campos separados + CPF
        const addrGrid = document.createElement('div'); addrGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3 mt-4';
        const ruaDiv = document.createElement('div'); const ruaLabel = document.createElement('label'); ruaLabel.className = 'block text-sm font-medium mb-2'; ruaLabel.textContent = 'Rua'; const ruaInput = document.createElement('input'); ruaInput.id = 'addrRua'; ruaInput.type = 'text'; ruaInput.placeholder = 'Rua Exemplo'; ruaInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none'; ruaDiv.appendChild(ruaLabel); ruaDiv.appendChild(ruaInput);
        const numDiv = document.createElement('div'); const numLabel = document.createElement('label'); numLabel.className = 'block text-sm font-medium mb-2'; numLabel.textContent = 'Número'; const numInput = document.createElement('input'); numInput.id = 'addrNumero'; numInput.type = 'text'; numInput.placeholder = '123'; numInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none'; numDiv.appendChild(numLabel); numDiv.appendChild(numInput);
        addrGrid.appendChild(ruaDiv); addrGrid.appendChild(numDiv);
        optContainer.appendChild(addrGrid);

        const refLabel = document.createElement('label'); refLabel.className = 'block text-sm font-medium mb-2 mt-3'; refLabel.textContent = 'Ponto de referência (opcional)';
        const refInput = document.createElement('input'); refInput.id = 'addrReferencia'; refInput.type = 'text'; refInput.placeholder = 'Próximo à praça...'; refInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(refLabel); optContainer.appendChild(refInput);

        const cpfLabel = document.createElement('label'); cpfLabel.className = 'block text-sm font-medium mb-2 mt-3'; cpfLabel.textContent = 'CPF';
        const cpfInput = document.createElement('input'); cpfInput.id = 'customerCPF'; cpfInput.type = 'text'; cpfInput.placeholder = '000.000.000-00'; cpfInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(cpfLabel); optContainer.appendChild(cpfInput);

        // Observações
        const obsLabel = document.createElement('label'); obsLabel.className = 'block text-sm font-medium mb-2 mt-4'; obsLabel.textContent = 'Observações (opcional)';
        const obsInput = document.createElement('textarea'); obsInput.id = 'shirtNotes'; obsInput.rows = 2; obsInput.placeholder = 'Ex.: Ajustar modelagem, presente, etc.'; obsInput.className = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none';
        optContainer.appendChild(obsLabel); optContainer.appendChild(obsInput);
    }

    // Opções para imagens: campo texto para mapas + quantidade
    if (productId === 'imagens') {
        // Seleção múltipla de mapas
        const hint = document.createElement('div'); hint.className = 'text-sm text-gray-600 mb-2'; hint.textContent = 'Selecione um ou mais mapas ou digite os nomes.';
        optContainer.appendChild(hint);
        const maps = ['Bermuda', 'Purgatório', 'Kalahari', 'Nova Terra', 'Alpine'];
        const grid = document.createElement('div'); grid.className = 'grid grid-cols-2 gap-2 mb-3';
        maps.forEach(m => {
            const label = document.createElement('label'); label.className = 'flex items-center gap-2';
            const cb = document.createElement('input'); cb.type = 'checkbox'; cb.name = 'mapOption'; cb.value = m;
            const span = document.createElement('span'); span.className = 'text-sm'; span.textContent = m;
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
    
    if (productId.startsWith('evt-') && productId !== 'evt-xtreino-gratuito') {
        
        const cupomWrap = document.createElement('div');
        cupomWrap.className = 'mt-3';
        cupomWrap.innerHTML = '<label class="block text-sm font-medium mb-2">Cupom de desconto</label><input id="couponCode" type="text" placeholder="ADMFALL" class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:border-blue-matte focus:outline-none">\n<p class="text-xs text-gray-500 mt-1">Use <strong>ADMFALL</strong> para 5% de desconto.</p>';
        optContainer.appendChild(cupomWrap);
    }

    // Preço inicial e atualização dinâmica
    updatePurchaseTotal(productId);
    const qtyEl = document.getElementById('mapsQty');
    if (qtyEl) qtyEl.addEventListener('input', () => updatePurchaseTotal(productId));
    const mapsNamesEl = document.getElementById('mapsNames');
    if (mapsNamesEl) mapsNamesEl.addEventListener('input', () => syncMapsQtyWithNames());
    const couponEl = document.getElementById('couponCode');
    if (couponEl) couponEl.addEventListener('input', () => updatePurchaseTotal(productId));

    document.getElementById('purchaseModal').classList.remove('hidden');
    if (window.innerWidth <= 767) document.body.classList.add('modal-open-mobile');
}

function updatePurchaseTotal(productId) {
    let total = 0;
    if (productId === 'imagens') {
        const qty = Math.max(1, Math.min(5, Number(document.getElementById('mapsQty')?.value || 1)));
        const pricing = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 };
        total = pricing[qty] || 2;
    } else {
        const product = products[productId];
        total = Number((product.price || '0').replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
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

function syncMapsQtyWithNames() {
    const names = (document.getElementById('mapsNames')?.value || '')
        .split(',')
        .map(s => s.trim())
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
    if (couponInput) {
        couponInput.value = '';
        couponInput.disabled = false;
    }
    if (couponMessage) {
        couponMessage.classList.add('hidden');
        couponMessage.textContent = '';
    }

    // Remover botão de remover cupom
    const removeBtn = document.getElementById('removeCouponBtn');
    if (removeBtn) {
        removeBtn.remove();
    }
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}

// Pagar produto atual com Tokens
async function authenticatedPaymentFetch(url, options = {}) {
    const { paymentFetch } = await import('./js/payment-client.js');
    return paymentFetch(window.firebaseAuth?.currentUser, url, options);
}

async function payOrderWithTokens(reference, couponCode, expectedTotal) {
    const payload = { external_reference: reference, couponCode, unit_price: expectedTotal };
    sessionStorage.setItem('_pendingTokenPurchase', JSON.stringify(payload));
    const response = await authenticatedPaymentFetch('/.netlify/functions/pay-with-tokens', {
        method: 'POST', body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !['paid', 'already_paid'].includes(data.status)) {
        throw new Error(data.error || 'Não foi possível concluir. Confira Meus Pedidos antes de tentar novamente.');
    }
    sessionStorage.removeItem('_pendingTokenPurchase');
    if (window.currentUserProfile && Number.isFinite(Number(data.balance))) {
        window.currentUserProfile.tokens = Number(data.balance);
        localStorage.setItem('assoc_profile', JSON.stringify(window.currentUserProfile));
        updateHeaderTokenBadges();
    }
    return data;
}

async function payCurrentProductWithTokens() {
    try {
        if (!window.isLoggedIn) {
            closePurchaseModal();
            if (typeof openLoginModal === 'function') openLoginModal();
            alert('Faça login para pagar com tokens.');
            return;
        }
        const productId = currentProduct;
        const product = products[productId];
        if (!product) { alert('Produto inválido'); return; }

        // Calcular preço final (recalcular para imagens ao invés de confiar na UI)
        let total = 0;
        if (productId === 'imagens') {
            const qty = Math.max(1, Math.min(5, Number(document.getElementById('mapsQty')?.value || 1)));
            const pricing = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 };
            total = pricing[qty] || 2;
            
        } else {
            // Para outros produtos, ler do display
            const totalText = document.getElementById('purchasePrice')?.textContent || '0';
            total = Number(totalText.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
        }
        // saldo suficiente?
        if (!canSpendTokens(total)) {
            alert(`Saldo insuficiente. Você precisa de ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em tokens.`);
            return;
        }
        // Coletar opções
        let productOptions = {};
        if (productId === 'imagens') {
            const selected = Array.from(document.querySelectorAll('input[name="mapOption"]:checked')).map(i => i.value);
            const names = (document.getElementById('mapsNames')?.value || '')
                .split(',').map(s => s.trim()).filter(Boolean);
            productOptions.maps = selected.length ? selected : names;
            productOptions.quantity = productOptions.maps.length || 1;
        }
        if (productId === 'passe-booyah') {
            productOptions.playerId = document.getElementById('playerId')?.value || '';
        }
        if (productId === 'camisa') {
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
            productOptions.delivery = { nome, cpf, cep, address: rua, number: numero, complement: complemento, district: bairro, city: cidade, state: estado };
        }
        // O servidor debita e confirma o pedido na mesma transação.
        // Capturar código de afiliado ativo
        const _tokenAffCode = getActiveAffiliateCode(appliedCoupon?.affiliateId || null);
        console.log('[Afiliado DEBUG tokens] affiliateId do cupom:', appliedCoupon?.affiliateId, '| localStorage ref:', localStorage.getItem('xf_affiliate_ref'), '| _tokenAffCode:', _tokenAffCode);
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
            status: 'pending',
            customer: window.firebaseAuth?.currentUser?.email || '',
            customerName: window.currentUserProfile?.name || '',
            buyerEmail: window.firebaseAuth?.currentUser?.email || '',
            phone: productOptions?.telefone || productOptions?.phone || window.currentUserProfile?.phone || '',
            userId: window.firebaseAuth?.currentUser?.uid,
            uid: window.firebaseAuth?.currentUser?.uid,
            productId: productId,
            productOptions: productOptions,
            affiliateCode: _tokenAffCode || null,
            shippingStatus: (productId === 'camisa') ? 'pending' : null,
            createdAt: new Date(),
            timestamp: Date.now(),
            type: 'digital_product'
        };
        const docRef = await addDoc(collection(window.firebaseDb, 'orders'), orderData);
        await payOrderWithTokens(`digital_${docRef.id}`, appliedCoupon?.code || null, total);
        closePurchaseModal();
        
        // Mostrar sucesso e redirecionar
        if (typeof openPaymentConfirmModal === 'function') {
            openPaymentConfirmModal('Pagamento confirmado', 'Seu pagamento em tokens foi aprovado. Confira em Minha Conta.');
        } else {
            showSuccessToast('Seu pagamento em tokens foi aprovado', 'Sucesso');
        }
        
        // Redirecionar para client.html na aba de pedidos após 4.5 segundos (tempo para sincronizar ambas as collections)
        setTimeout(() => {
            try {
                window.location.href = 'client.html?tab=orders';
            } catch (_) { }
        }, 4500);
        
    } catch (e) {
        
        showErrorToast('Erro ao pagar com tokens. Por favor, tente novamente.', 'Erro');
    }
}

// Ação do botão "Pagar com Tokens" do agendamento
function payScheduleWithTokens() {
    if (window._scheduleSubmitting) return;
    const tokenBtn = document.getElementById('schedPayTokens');
    if (tokenBtn && tokenBtn.disabled) return;
    submitSchedule({ preventDefault: () => { } }, true);
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

    // Verificar se já existe um cupom aplicado
    if (appliedCoupon) {
        // Se é o mesmo cupom, não fazer nada
        if (appliedCoupon.code === couponCode) {
            showCouponMessage('Este cupom já está aplicado.', 'error');
            return;
        }
        // Se é um cupom diferente, substituir o anterior
        
    }

    try {
        // Aguardar Firebase ficar pronto
        const fbReady = await waitForFirebase(8000);
        if (!fbReady || !window.firebaseDb) {
            showCouponMessage('Erro de conexão. Recarregue a página e tente novamente.', 'error');
            return;
        }

        // Importar Firebase
        const { collection, getDocs, query, where, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Buscar cupom no Firestore
        const couponsRef = collection(window.firebaseDb, 'coupons');
        const q = query(couponsRef, where('code', '==', couponCode), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
                showErrorToast('Cupom não encontrado', 'COUPON_001');
            return;
        }

        const couponDoc = snapshot.docs[0];
        const coupon = { id: couponDoc.id, ...couponDoc.data() };

        // Validar cupom
        const validation = validateCoupon(coupon);
        if (!validation.valid) {
            const errorCode = validation.code || 'COUPON_006';
            showErrorToast(validation.message, errorCode);
            showCouponMessage(validation.message, 'error');
            return;
        }

        // Garantir que originalPrice está atualizado antes de aplicar o cupom
        // Recalcular o preço original para evitar desconto sobre desconto
        if (currentProduct) {
            // Recalcular o preço base sem desconto
            updatePurchaseTotal(currentProduct);
        }

        // Aplicar cupom
        appliedCoupon = coupon;
        updatePriceWithCoupon();
        showCouponMessage(`Cupom "${coupon.code}" aplicado! Desconto: ${getDiscountText(coupon)}`, 'success');

        // Limpar e desabilitar o campo de input após aplicar com sucesso
        const couponInput = document.getElementById('couponCodeInput');
        if (couponInput) {
            couponInput.value = coupon.code;
            couponInput.disabled = true;
        }

        // Mostrar botão para remover cupom
        updateCouponUI();

        

    } catch (error) {
        
        showErrorToast('Erro ao validar cupom. Tente novamente.', 'COUPON_006');
        showCouponMessage('Erro ao validar cupom. Tente novamente.', 'error');
    }
}

// Validar cupom
function validateCoupon(coupon) {
    // Verificar se está ativo
    if (!coupon.isActive) {
        return { valid: false, message: 'Cupom inativo', code: 'COUPON_003' };
    }

    // Verificar data de expiração
    if (coupon.expirationDate) {
        const expirationDate = coupon.expirationDate.toDate ? coupon.expirationDate.toDate() : new Date(coupon.expirationDate);
        if (expirationDate < new Date()) {
            return { valid: false, message: 'Cupom expirado', code: 'COUPON_002' };
        }
    }

    // Verificar tipo de uso do cupom
    const currentContext = getCurrentPurchaseContext();
    if (!isCouponValidForContext(coupon, currentContext)) {
        return { valid: false, message: 'Cupom não válido para este tipo de compra', code: 'COUPON_004' };
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

    // Garantir que originalPrice está atualizado e representa o preço SEM desconto
    // Se originalPrice for 0 ou inválido, recalcular
    if (!originalPrice || originalPrice <= 0) {
        if (currentProduct) {
            updatePurchaseTotal(currentProduct);
        }
        // Se ainda assim não tiver preço, não pode aplicar desconto
        if (!originalPrice || originalPrice <= 0) {
            
            return;
        }
    }

    const subtotalEl = document.getElementById('purchaseSubtotal');
    const discountRowEl = document.getElementById('discountRow');
    const discountAmountEl = document.getElementById('discountAmount');
    const totalEl = document.getElementById('purchasePrice');

    if (!subtotalEl || !discountRowEl || !discountAmountEl || !totalEl) return;

    // Calcular desconto baseado SEMPRE no originalPrice (nunca no preço já descontado)
    let discountAmount = 0;
    if (appliedCoupon.discountType === 'percentage') {
        discountAmount = originalPrice * (appliedCoupon.discountValue / 100);
    } else {
        discountAmount = appliedCoupon.discountValue;
    }

    // Garantir que o desconto não seja maior que o preço
    discountAmount = Math.min(discountAmount, originalPrice);

    // Calcular preço final (sempre do originalPrice)
    const finalPrice = Math.max(0, originalPrice - discountAmount);

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

// Remover cupom aplicado
function removeCoupon() {
    if (!appliedCoupon) return;

    const couponCode = appliedCoupon.code;
    appliedCoupon = null;

    // Recalcular preço sem desconto
    if (currentProduct) {
        updatePurchaseTotal(currentProduct);
    }

    // Limpar campo de input e reabilitar
    const couponInput = document.getElementById('couponCodeInput');
    if (couponInput) {
        couponInput.value = '';
        couponInput.disabled = false;
        couponInput.focus();
    }

    // Atualizar UI
    updateCouponUI();

    // Mostrar mensagem
    showCouponMessage(`Cupom "${couponCode}" removido`, 'success');

    
}

// Atualizar UI do cupom (mostrar/ocultar botão de remover)
function updateCouponUI() {
    const couponInput = document.getElementById('couponCodeInput');
    const couponContainer = couponInput?.parentElement;

    if (!couponContainer) return;

    // Verificar se já existe botão de remover
    let removeBtn = document.getElementById('removeCouponBtn');

    if (appliedCoupon) {
        // Se não existe, criar o botão
        if (!removeBtn) {
            removeBtn = document.createElement('button');
            removeBtn.id = 'removeCouponBtn';
            removeBtn.type = 'button';
            removeBtn.onclick = removeCoupon;
            removeBtn.className = 'px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors';
            removeBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Remover';
            // Adicionar após o botão Aplicar ou campo de input
            const applyBtn = couponContainer.querySelector('button[onclick="applyCoupon()"]');
            if (applyBtn) {
                applyBtn.parentElement.appendChild(removeBtn);
            } else {
                couponContainer.appendChild(removeBtn);
            }
        }
        removeBtn.style.display = '';
    } else {
        // Ocultar botão se não há cupom
        if (removeBtn) {
            removeBtn.style.display = 'none';
        }
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

function isValidBrazilianCpf(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
    const digitAt = length => {
        let sum = 0;
        for (let index = 0; index < length; index++) sum += Number(digits[index]) * (length + 1 - index);
        const remainder = (sum * 10) % 11;
        return remainder === 10 ? 0 : remainder;
    };
    return digitAt(9) === Number(digits[9]) && digitAt(10) === Number(digits[10]);
}

async function handlePurchase(event) {
    event.preventDefault();
    const payByPix = event.submitter?.value === 'pix';
    const product = products[currentProduct];
    if (!product) {
        showError('PRODUCT_001', 'PRODUCT_001');
        return;
    }

    // Calcular preço final (recalcular para imagens ao invés de confiar no UI)
    let totalNum = 0;
    if (currentProduct === 'imagens') {
        const qty = Math.max(1, Math.min(5, Number(document.getElementById('mapsQty')?.value || 1)));
        const pricing = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 };
        totalNum = pricing[qty] || 2;
        
    } else {
        // Para outros produtos, ler do modal
        const totalText = document.getElementById('purchasePrice')?.textContent || '0';
        totalNum = Number(totalText.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
    }

    // Informações do cupom aplicado
    const activeAffiliateCode = getActiveAffiliateCode(appliedCoupon?.affiliateId || null);
    console.log('[Afiliado] activeAffiliateCode:', activeAffiliateCode ? '✓ ' + activeAffiliateCode.slice(-6) : 'null');
    const couponInfo = appliedCoupon ? {
        code: appliedCoupon.code,
        discountType: appliedCoupon.discountType,
        discountValue: appliedCoupon.discountValue,
        originalPrice: originalPrice,
        finalPrice: totalNum
    } : null;

    // validação específica para imagens (quantidade vs nomes)
    if (currentProduct === 'imagens') {
        const qty = Math.max(1, Math.min(5, Number(document.getElementById('mapsQty')?.value || 1)));
        const names = (document.getElementById('mapsNames')?.value || '')
            .split(',').map(s => s.trim()).filter(Boolean);
        if (names.length && names.length !== qty) {
            showError('PRODUCT_007', 'PRODUCT_007');
            return;
        }
    }

    // Coletar dados do formulário
    const formData = new FormData(event.target);
    const customerName = formData.get('name') || document.querySelector('#purchaseModal input[type="text"]')?.value || '';
    const customerEmail = formData.get('email') || document.querySelector('#purchaseModal input[type="email"]')?.value || '';
    const pixCpf = document.getElementById('purchasePixCpf')?.value
        || '';
    if (payByPix && !isValidBrazilianCpf(pixCpf)) {
        document.getElementById('purchasePixCpfWrap')?.classList.remove('hidden');
        document.getElementById('purchasePixCpf')?.focus();
        showToast('info', 'Informe um CPF válido para gerar o Pix.', 'CPF necessário');
        return;
    }
    if (payByPix) document.getElementById('purchasePixCpfWrap')?.classList.remove('hidden');

    // Coletar opções específicas do produto
    let productOptions = {};
    if (currentProduct === 'camisa') {
        const sizeSelect = document.querySelector('#purchaseModal select');
        productOptions.size = sizeSelect?.value || '';
    } else if (currentProduct === 'imagens') {
        const selected = Array.from(document.querySelectorAll('input[name="mapOption"]:checked')).map(i => i.value);
        productOptions.maps = selected;
        productOptions.quantity = selected.length || 1;
    } else if (currentProduct === 'camisa') {
        // Redundância para garantir campos camisa
        productOptions.size = document.getElementById('shirtSize')?.value || '';
        productOptions.color = document.getElementById('shirtColor')?.value || '';
        productOptions.name = document.getElementById('shirtName')?.value || '';
        productOptions.number = document.getElementById('shirtNumber')?.value || '';
        productOptions.quantity = Number(document.getElementById('shirtQty')?.value || 1);
        productOptions.deliveryAddress = document.getElementById('deliveryAddress')?.value || '';
        productOptions.notes = document.getElementById('shirtNotes')?.value || '';
    }

    // Pegar botão de submit para mostrar loading
    const submitBtn = event.submitter || event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn?.textContent || 'Finalizar (Mercado Pago)';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Processando...';
    }

    try {
        // Validar preço final
        if (!totalNum || totalNum <= 0 || isNaN(totalNum)) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            showError('PAYMENT_002', 'PAYMENT_002');
            
            return;
        }

        // Inicializar variáveis
        let docRef = null;
        let externalRef = `digital_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Salvar order no Firestore ANTES de redirecionar
        if (window.firebaseDb) {
            try {
                const { addDoc, collection, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

                // Validação de formato de CPF para camisa (obrigatório no padrão 000.000.000-00)
                if (currentProduct === 'camisa') {
                    const cpfVal = (document.getElementById('customerCPF')?.value || '').trim();
                    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
                    if (!cpfVal || !cpfRegex.test(cpfVal)) {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = originalBtnText;
                        }
                        showError('PRODUCT_006', 'PRODUCT_006');
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
                    phone: productOptions?.telefone || productOptions?.phone || window.currentUserProfile?.phone || '',
                    userId: window.firebaseAuth.currentUser?.uid,
                    uid: window.firebaseAuth.currentUser?.uid,
                    productId: currentProduct,
                    productOptions: productOptions,
                    createdAt: new Date(),
                    timestamp: Date.now(),
                    type: 'digital_product', // Marcar como produto digital
                    // Incluir affiliateId do cupom se houver
                    affiliateCode: activeAffiliateCode || null
                };

                
                docRef = await addDoc(collection(window.firebaseDb, 'orders'), orderData);
                // Salvar external_reference para o webhook
                externalRef = `digital_${docRef.id}`;
                await updateDoc(docRef, { external_reference: externalRef });
            } catch (firebaseError) {
                console.warn('Aviso: não foi possível salvar pedido no Firestore antes do pagamento. Continuando para o checkout.', firebaseError);
                // Continua com externalRef gerado acima — o webhook cria/atualiza o pedido após pagamento confirmado
            }
        }

        // Persistir affiliate code no sessionStorage antes do redirect ao MP (fallback para retorno)
        if (activeAffiliateCode) {
            try { sessionStorage.setItem('xf_pending_aff', activeAffiliateCode); } catch(_) {}
        }

        // Chamar function segura (Netlify) para criar Preference
        const _affBackParam = activeAffiliateCode ? `?ref=${encodeURIComponent(activeAffiliateCode)}` : '';
        const preferencePayload = {
            title: product.name || 'Produto',
            unit_price: Number(totalNum.toFixed(2)),
            currency_id: 'BRL',
            quantity: 1,
            back_url: `${window.location.origin}/${_affBackParam}`,
            coupon_info: couponInfo,
            external_reference: externalRef,
            ...(payByPix ? { payer_cpf: String(pixCpf).replace(/\D/g, '') } : {})
        };

        

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

        const response = await authenticatedPaymentFetch(
            payByPix ? '/.netlify/functions/create-pix-payment' : '/.netlify/functions/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferencePayload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 404) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
            alert('⚠️ Pagamento via Mercado Pago não está disponível neste ambiente de desenvolvimento.\n\nO checkout funciona apenas na versão publicada do site (orgfreitas.com.br).');
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            if (String(errorText || '').includes('Missing MP_ACCESS_TOKEN')) {
                throw new Error('Integração com Mercado Pago não configurada. Entre em contato com o suporte.');
            }
            throw new Error(errorText || `Erro ao criar preferência (${response.status})`);
        }

        const data = await response.json();
        

        const checkoutUrl = data.init_point || data.sandbox_init_point;
        if (payByPix && data.status !== 'paid' && (!data.qr_code || !data.qr_code_base64)) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            throw new Error(data.error || 'Não foi possível gerar o QR Code Pix.');
        }
        if (!payByPix && !checkoutUrl) {
            
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            throw new Error('Não foi possível obter o link de pagamento. Verifique se o Mercado Pago está configurado corretamente.');
        }

        // Registrar uso do cupom se aplicado
        if (appliedCoupon) {
            try {
                const discountAmount = originalPrice - totalNum;
                await recordCouponUsage(
                    appliedCoupon.id,
                    appliedCoupon.code,
                    originalPrice,
                    discountAmount,
                    'store',
                    data.external_reference || externalRef,
                    {
                        productId: currentProduct,
                        name: product.name,
                        title: product.name,
                        item: product.name
                    }
                );
            } catch (couponError) {
                
                // Não falhar a compra por causa de erro no cupom
            }
        }

        closePurchaseModal();

        if (payByPix) {
            if (data.status === 'paid') {
                showToast('success', 'Pagamento já confirmado. Confira sua conta.', 'Compra confirmada');
                return;
            }
            window.openPixModal(
                data,
                [],
                data.external_reference || externalRef,
                [],
                { label: product.name, kind: 'product' },
                totalNum
            );
            return;
        }

        // Redireciona para o checkout do Mercado Pago
        try {
            sessionStorage.setItem('lastCheckoutUrl', checkoutUrl);
        } catch (_) { }
        
        try {
            window.open(checkoutUrl, '_blank');
            showToast('success', 'Checkout aberto em nova aba. Finalize o pagamento no Mercado Pago.', 'Checkout');
        } catch (openErr) {
            
            window.location.href = checkoutUrl;
        }
    } catch (error) {
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
        // Tratar erros específicos
        if (error.message && error.message.includes('timeout')) {
            showToast('error', 'Conexão expirou. Verifique sua internet e tente novamente.', 'Timeout');
        } else if (error.message && (error.message.includes('preço') || error.message.includes('Preço'))) {
            showToast('error', 'Preço inválido. Tente novamente.', 'Erro no Pagamento');
        } else if (error.message && (error.message.includes('produto') || error.message.includes('Produto'))) {
            showToast('error', 'Produto inválido. Tente novamente.', 'Erro no Pagamento');
        } else if (error.message && (error.message.includes('link') || error.message.includes('Link'))) {
            showToast('error', 'Não foi possível obter o link de pagamento. Verifique sua conexão e tente novamente.', 'Erro no Pagamento');
        } else {
            showToast('error', error.message || 'Erro ao processar pagamento. Tente novamente.', 'Erro');
        }
    }
}

// Close modals when clicking outside
document.addEventListener('click', function (event) {
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
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();
        try {
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (_) {}
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
                slide.className = 'carousel-slide p-8 bg-white';

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
        
    }
}

// Carousel — abordagem por scrollLeft (não depende de offsetWidth no init)
function initCarousel() {
    const viewport = document.getElementById('carouselViewport');
    const track    = document.getElementById('carouselTrack');
    const prev     = document.getElementById('carouselPrev');
    const next     = document.getElementById('carouselNext');
    if (!track || !prev || !next) return;

    // Remover listener anterior para evitar duplicatas
    if (window._carouselCleanup) window._carouselCleanup();

    const container = viewport || track.parentElement;
    let index = 0;
    let slideCount = track.children.length;
    let autoAdvanceInterval;

    function slideWidth() {
        return container.getBoundingClientRect().width || container.offsetWidth || 0;
    }

    function applyWidths() {
        const w = slideWidth();
        if (!w) return;
        Array.from(track.children).forEach(s => {
            s.style.width    = w + 'px';
            s.style.minWidth = w + 'px';
            s.style.flexShrink = '0';
        });
        slideCount = track.children.length;
    }

    function update() {
        const w = slideWidth();
        track.style.transform = `translateX(-${index * w}px)`;
    }

    function go(dir) {
        index = ((index + dir) % slideCount + slideCount) % slideCount;
        update();
    }

    function startAuto() { autoAdvanceInterval = setInterval(() => go(1), 8000); }
    function stopAuto()  { clearInterval(autoAdvanceInterval); }

    // Aguardar dois frames para garantir que o layout foi calculado
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            applyWidths();
            update();
            if (slideCount > 1) startAuto();
        });
    });

    const onResize = () => { applyWidths(); update(); };
    window.addEventListener('resize', onResize);

    const onPrev = () => { stopAuto(); go(-1); startAuto(); };
    const onNext = () => { stopAuto(); go(1);  startAuto(); };
    prev.addEventListener('click', onPrev);
    next.addEventListener('click', onNext);

    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);

    // Swipe no mobile
    let tx = 0;
    const onTouchStart = e => { tx = e.changedTouches[0].screenX; };
    const onTouchEnd   = e => {
        const d = tx - e.changedTouches[0].screenX;
        if (Math.abs(d) > 50) { stopAuto(); go(d > 0 ? 1 : -1); startAuto(); }
    };
    track.addEventListener('touchstart', onTouchStart, { passive: true });
    track.addEventListener('touchend',   onTouchEnd,   { passive: true });

    // Limpeza para evitar listeners duplicados
    window._carouselCleanup = () => {
        stopAuto();
        window.removeEventListener('resize', onResize);
        prev.removeEventListener('click', onPrev);
        next.removeEventListener('click', onNext);
        track.removeEventListener('touchstart', onTouchStart);
        track.removeEventListener('touchend',   onTouchEnd);
    };
}

// Carregar destaques quando o Firebase estiver pronto
if (window.firebaseReady) {
    loadHighlightsFromFirestore();
    loadNewsFromFirestore();
    loadProductsFromFirestore();

    // Initialize smooth animations
    initSmoothAnimations();
    initChat();
} else {
    window.addEventListener('load', () => {
        setTimeout(() => {
            loadHighlightsFromFirestore();
            loadNewsFromFirestore();
            loadProductsFromFirestore();
            initChat();
        }, 1000);
    });
}

// ===== Modal Comprar Tokens (Home/Destaques) =====
let heroAppliedCoupon = null;
let heroSelectedQty = 0;
function openHeroTokensModal() {
    const modal = document.getElementById('heroTokensModal');
    if (!modal) return;
    const msg = document.getElementById('heroTokensCouponMsg'); if (msg) { msg.textContent = ''; msg.className = 'text-xs text-gray-500'; }
    const input = document.getElementById('heroTokensCoupon'); if (input) input.value = '';
    heroAppliedCoupon = null; heroSelectedQty = 0; updateHeroTokensSummary();
    modal.classList.remove('hidden'); modal.classList.add('flex');
}
function closeHeroTokensModal() { const m = document.getElementById('heroTokensModal'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
function heroSetTokensQty(qty) { heroSelectedQty = qty; updateHeroTokensSummary(); }
async function heroPurchaseTokens() {
    try {
        const user = window.firebaseAuth?.currentUser;
        if (!user) { openLoginModal(); return; }
        const qty = heroSelectedQty || 0; if (!qty) { alert('Selecione a quantidade'); return; }
        const idToken = await user.getIdToken();
        const response = await fetch('/.netlify/functions/create-token-preference', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify({
                quantity: qty,
                couponCode: heroAppliedCoupon?.code || null,
                affiliateCode: getActiveAffiliateCode() || null
            })
        });
        if (response.status === 404) { showToast('info', 'Checkout disponível apenas na versão publicada do site.', 'Dev'); return; }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Erro ao comunicar com Mercado Pago');
        if (data.init_point && data.external_reference) {
            try { sessionStorage.setItem('lastCheckoutUrl', data.init_point); } catch (_) { }
            try { sessionStorage.setItem('lastExternalRef', data.external_reference); } catch (_) { }
            closeHeroTokensModal();
            window.location.href = data.init_point;
        } else { showToast('error', 'Erro ao iniciar pagamento. Tente novamente.', 'Erro'); }
    } catch (e) {  showToast('error', `Erro ao comprar tokens: ${e && e.message ? e.message : String(e)}`, 'Erro'); }
}
function updateHeroTokensSummary() {
    const subtotalEl = document.getElementById('heroTokensSubtotal');
    const discountRow = document.getElementById('heroTokensDiscountRow');
    const discountEl = document.getElementById('heroTokensDiscount');
    const totalEl = document.getElementById('heroTokensTotal');
    const summary = document.getElementById('heroTokensSummary');
    const btn = document.getElementById('heroTokensBuyBtn');
    const base = heroSelectedQty || 0;
    const discount = heroAppliedCoupon ? (heroAppliedCoupon.discountType === 'percentage' ? base * (heroAppliedCoupon.discountValue / 100) : heroAppliedCoupon.discountValue) : 0;
    const total = Math.max(0, base - discount);
    if (subtotalEl) subtotalEl.textContent = base.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (discountRow) discountRow.style.display = heroAppliedCoupon ? '' : 'none';
    if (discountEl) discountEl.textContent = `- ${discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (summary) summary.classList.remove('hidden');
    if (btn) { btn.disabled = base <= 0; btn.textContent = base > 0 ? `Comprar ${base} token${base > 1 ? 's' : ''} por ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Selecionar quantidade'; }
}
// duplicate implementation removed (kept single correct implementation above)
async function heroApplyTokenCoupon() {
    const couponCode = document.getElementById('heroTokenCouponInput')?.value?.trim().toUpperCase();
    const couponMessage = document.getElementById('heroTokenCouponMessage');

    if (!couponCode) {
        showToast('error', 'Digite um código de cupom', 'Cupom');
        return;
    }

    if (heroAppliedCoupon && heroAppliedCoupon.code === couponCode) {
        showToast('error', 'Este cupom já está aplicado.', 'Cupom');
        return;
    }

    try {
        

        const { collection, getDocs, query, where, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        const couponsRef = collection(window.firebaseDb, 'coupons');
        const q = query(couponsRef, where('code', '==', couponCode), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showToast('error', 'Cupom não encontrado', 'Cupom');
            return;
        }

        const couponDoc = snapshot.docs[0];
        const coupon = { id: couponDoc.id, ...couponDoc.data() };

        // Validar cupom
        if (!coupon.isActive) {
            showToast('error', 'Cupom inativo', 'Cupom');
            return;
        }

        if (coupon.expirationDate) {
            const expirationDate = coupon.expirationDate.toDate ? coupon.expirationDate.toDate() : new Date(coupon.expirationDate);
            if (expirationDate < new Date()) {
                showToast('error', 'Cupom expirado', 'Cupom');
                return;
            }
        }

        const usageType = String(coupon.usageType || 'both').toLowerCase();
        if (
            !['both', 'store', 'tokens'].includes(usageType)
            || (coupon.context && coupon.context !== 'tokens' && coupon.context !== 'all')
        ) {
            showToast('error', 'Este cupom não é válido para compra de tokens', 'Cupom');
            return;
        }

        heroAppliedCoupon = coupon;
        updateHeroTokensSummary();
        showToast('success', `Cupom "${coupon.code}" aplicado! Desconto: ${coupon.discountType === 'percentage' ? coupon.discountValue + '%' : 'R$ ' + coupon.discountValue}`, 'Cupom');

        const couponInput = document.getElementById('heroTokenCouponInput');
        if (couponInput) {
            couponInput.value = coupon.code;
            couponInput.disabled = true;
        }

        

    } catch (error) {
        
        showToast('error', 'Erro ao validar cupom. Tente novamente.', 'Cupom');
    }
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
function stripDiacritics(s) { try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) { return s; } }
function normalizeText(s) {
    const t = stripDiacritics(String(s || '').toLowerCase());
    return t.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function levenshtein(a, b) {
    a = String(a); b = String(b);
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) { m[0][j] = j; }
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
        }
    }
    return m[a.length][b.length];
}
function similarity(a, b) {
    const na = normalizeText(a), nb = normalizeText(b);
    if (!na || !nb) return 0;
    const maxLen = Math.max(na.length, nb.length);
    const dist = levenshtein(na, nb);
    return 1 - (dist / Math.max(1, maxLen));
}
const EVENT_SYNONYMS = {
    'modo-liga': ['modo liga', 'liga', 'modoliga', 'xtreino liga', 'liga freitas'],
    'semanal-freitas': ['semanal', 'semanal freitas', 'final semanal', 'final do semanal'],
    'camp-freitas': ['camp', 'campeonato', 'camp freitas', 'campeonato freitas'],
    'xtreino-tokens': ['xtreino', 'treino', 'freitas', 'xtreino freitas', 'token', 'tokens']
};
function detectEventType(text) {
    const n = normalizeText(text);
    for (const [key, list] of Object.entries(EVENT_SYNONYMS)) {
        if (list.some(s => n.includes(normalizeText(s)))) return key;
    }
    return null;
}
// Normaliza qualquer string de eventType para o tipo canônico (retrocompat com IDs do Firestore)
function normalizeEventType(t) {
    const s = String(t || '').toLowerCase().replace(/[\s_]/g, '-');
    if (s === 'modo-liga' || s === 'liga' || s.includes('modo-liga') || s.includes('modo-liga')) return 'modo-liga';
    if (s === 'camp-freitas' || s === 'camp' || s.includes('camp-freitas') || s.includes('camp freitas')) return 'camp-freitas';
    if (s === 'semanal-freitas' || s === 'semanal' || s.includes('semanal')) return 'semanal-freitas';
    if (s.includes('xtreino') || s === 'xtreino-tokens') return 'xtreino-tokens';
    if (s === 'camp-final' || s === 'final' || s.includes('camp-final') || s.includes('camp final')) return 'camp-final';
    return s;
}
function matchesPermanentHourLock(lockData, eventType, eventConfig = {}) {
    if (!lockData || lockData.locked !== true) return false;
    if (!lockData.eventType) return true;
    const lockType = normalizeEventType(lockData.eventType);
    return [
        eventType,
        eventConfig.eventType,
        eventConfig.name,
        eventConfig.label,
        eventConfig.modo,
        eventConfig.adminEventId
    ].filter(Boolean).some(candidate => normalizeEventType(candidate) === lockType);
}
function parseHourFromText(text) {
    const t = String(text || '').toLowerCase();
    const m1 = t.match(/\b(\d{1,2})\s*h\b/); if (m1) { const h = parseInt(m1[1], 10); if (h >= 0 && h <= 23) return `${h}h`; }
    const m2 = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/); if (m2) { const h = parseInt(m2[1], 10); if (h >= 0 && h <= 23) return `${h}h`; }
    return null;
}
function parseDateFromText(text) {
    try {
        const n = normalizeText(text);
        const today = new Date();
        if (/\bhoje\b/.test(n)) return today.toISOString().slice(0, 10);
        if (/\bamanha\b/.test(n)) { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
        const m = n.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/);
        if (m) {
            const dd = parseInt(m[1], 10), MM = parseInt(m[2], 10), yyyy = m[3] ? parseInt(m[3], 10) : today.getFullYear();
            const y4 = yyyy < 100 ? 2000 + yyyy : yyyy;
            const ds = `${y4}-${String(MM).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
            const d = new Date(ds + 'T00:00:00'); if (!isNaN(d)) return ds;
        }
    } catch (_) { }
    return null;
}
let __faqKbCache = null;
async function loadFaqKb() {
    if (__faqKbCache !== null) return __faqKbCache;
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(collection(window.firebaseDb, 'faq_kb'));
        __faqKbCache = [];
        snap.forEach(d => { const data = d.data(); if (data?.q && data?.a) __faqKbCache.push({ q: String(data.q), a: String(data.a) }); });
        return __faqKbCache;
    } catch (_) { __faqKbCache = []; return __faqKbCache; }
}
async function smartChatAnswer(message) {
    const text = String(message || '');
    const ntext = normalizeText(text);
    // 1) FAQ KB por similaridade
    const kb = await loadFaqKb();
    let best = { score: 0, a: '' };
    for (const item of kb) {
        const s = similarity(ntext, item.q);
        if (s > best.score) best = { score: s, a: item.a };
    }
    if (best.score >= 0.72) return { answer: best.a, confidence: best.score };
    // 2) Intenções: preço / vagas / horários
    const ev = detectEventType(ntext);
    const hour = parseHourFromText(ntext);
    const date = parseDateFromText(ntext) || new Date().toISOString().slice(0, 10);
    const wantsPrice = /\b(preco|preço|valor|custa|quanto)\b/.test(ntext);
    const wantsVacancy = /\b(vaga|vagas|lotado|tem vaga|disponivel|disponível)\b/.test(ntext);
    const wantsHours = /\b(horario|horário|hora|horas|que horas)\b/.test(ntext);
    if (ev && (wantsPrice || wantsHours || wantsVacancy)) {
        // Horários: listar horários do evento
        if (wantsHours && !hour) {
            let slots = [];
            if (ev === 'modo-liga') slots = ['14h', '15h', '17h', '18h'];
            else if (ev === 'xtreino-tokens') slots = ['14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h'];
            else if (ev === 'semanal-freitas') slots = ['20h', '21h', '22h'];
            else if (ev === 'camp-freitas') slots = ['19h', '20h', '21h', '22h', '23h'];
            return { answer: `⏰ Horários de ${scheduleConfig[ev]?.label || 'evento'}: ${slots.join(', ')}`, confidence: 0.9 };
        }
        // Preço: considerar preço por horário (ex.: 22h semanal = 7)
        if (wantsPrice) {
            const p = getEventPrice(ev, hour || '');
            return { answer: `💰 Valor de ${scheduleConfig[ev]?.label || 'Evento'}${hour ? ` (${hour})` : ''}: ${p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, confidence: 0.9 };
        }
        // Vagas: usar checkSlotAvailability
        if (wantsVacancy && hour) {
            try {
                const scheduleStr = `${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })} - ${hour}`;
                const ok = await checkSlotAvailability(date, scheduleStr, ev);
                const cap = getEventCapacity(ev, hour, date);
                return { answer: ok ? `✅ Há vagas no ${hour} (${cap} no total) para ${scheduleConfig[ev]?.label || 'o evento'} em ${date.split('-').reverse().join('/')}.` : `❌ ${hour} está lotado para ${scheduleConfig[ev]?.label || 'o evento'} em ${date.split('-').reverse().join('/')}.`, confidence: 0.85 };
            } catch (_) { }
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
        try {
            const smart = await smartChatAnswer(message);
            if (smart && smart.answer) {
                showTypingIndicator();
                setTimeout(() => { hideTypingIndicator(); addMessage(smart.answer, 'support'); }, 1200);
                return;
            }
        } catch (_) { }

        // Respostas prontas (FAQ curto). Se não bater, encaminha para WhatsApp
        const textLower = message.toLowerCase();
        const whatsNumber = '5511949830454';
        const whatsLink = `https://wa.me/${whatsNumber}?text=${encodeURIComponent('Olá! Preciso de ajuda no site XTreino Freitas.')}`;

        const canned = [
            // Valores e preços (prioridade alta)
            {
                match: ['valor', 'valores', 'preço', 'preços', 'quanto', 'custa', 'custo', 'precificar', 'orçamento', 'tabela', 'tabela de preços', 'preço dos', 'valor dos', 'quanto custa', 'quanto é', 'quanto sai', 'quanto fica', 'preço do', 'valor do', 'custo do', 'preço da', 'valor da', 'custo da', 'preço das', 'valor das', 'custo das', 'preço dos', 'valor dos', 'custo dos'],
                reply: '💰 **VALORES DOS PRODUTOS:**\n\n📱 **Sensibilidade no Free Fire:** R$ 8,00\n🗺️ **Imagens Aéreas:** A partir de R$ 2,00\n📊 **Planilha de Análise:** R$ 19,00\n🎮 **Passe de Elite:** R$ 11,00\n👕 **Camisa Oficial:** R$ 89,90\n\n🎯 **EVENTOS:**\n• **XTREINO FREITAS:** R$ 1,00 (1 token) - 14h às 23h\n• **XTREINO MODO LIGA:** R$ 3,00 - 14h, 15h, 17h, 18h\n• **CAMPEONATO FREITAS:** R$ 8,00 (promo no site — antes R$ 10,00) - 19h às 23h\n• **SEMANAL FREITAS:** R$ 3,50 - 20h, 21h, 22h\n\n💡 Precisa de mais detalhes sobre algum evento específico?'
            },

            // Horários e funcionamento (prioridade alta)
            {
                match: ['horário', 'horários', 'hora', 'horas', 'que horas', 'funcionamento', 'atendimento', 'quando', 'disponível', 'disponibilidade', 'aberto', 'fechado', 'funciona', 'trabalha', 'atende', 'expediente', 'jornada', 'turno', 'período', 'tempo', 'schedule', 'time', 'hours', 'working', 'available', 'open', 'closed', 'business hours', 'operating hours'],
                reply: '⏰ **HORÁRIOS DE FUNCIONAMENTO:**\n\n🕐 **Chat:** Disponível 24 horas\n🎮 **Treinos:** Geralmente entre 14h-23h\n📞 **WhatsApp:** Para dúvidas específicas\n\n💡 **DICAS:**\n• Eventos têm horários específicos\n• Tokens podem ser usados a qualquer hora\n• Suporte via WhatsApp é mais rápido para questões complexas'
            },
            {
                match: ['online', 'disponível', 'atendendo', 'suporte'],
                reply: '✅ **SUPORTE DISPONÍVEL:**\n\n🤖 **Chat:** Online 24 horas (respostas automáticas)\n📱 **WhatsApp:** Para atendimento personalizado\n🎮 **Treinos:** Segunda a sexta, 14h-23h\n\n💡 Para dúvidas específicas sobre pedidos, use o WhatsApp!'
            },

            // Tokens (prioridade alta)
            {
                match: ['token', 'tokens', 'comprar tokens', 'meus tokens', 'saldo', 'saldo de tokens', 'quantos tokens', 'tenho tokens', 'token balance', 'balance', 'crédito', 'créditos', 'moeda', 'moedas', 'pontos', 'pontuação', 'coin', 'coins', 'currency', 'wallet', 'carteira', 'dinheiro virtual', 'moeda virtual', 'comprar', 'adicionar tokens', 'recarregar', 'recarga', 'depositar', 'depósito', 'investir', 'investimento em tokens', 'token system', 'sistema de tokens', 'pagamento com token', 'pagar com token', 'usar token', 'gastar token', 'consumir token', 'token usado', 'tokens usados', 'token gasto', 'tokens gastos'],
                reply: 'Tokens custam R$ 1,00 cada. Compre e veja seu saldo em Minha Conta > Meus Tokens. Use tokens para pagar eventos!'
            },

            // Preços e valores (prioridade baixa - só se não for horário ou token)
            {
                match: ['preço', 'preços', 'valor', 'valores', 'quanto', 'cust', 'custa', 'quanto custa', 'quanto é', 'quanto vale', 'cobrança', 'cobrar', 'pagar', 'pagamento', 'dinheiro', 'reais', 'r$', 'barato', 'caro', 'econômico', 'custo', 'gasto', 'investimento', 'vale a pena', 'compensa', 'financeiro', 'monetário', 'tarifa', 'taxa', 'valor total', 'preço final', 'desconto', 'promoção', 'oferta', 'liquidação', 'sale', 'price', 'cost', 'money', 'cheap', 'expensive', 'affordable'],
                reply: 'Tokens: R$ 1,00 cada. Planilhas: R$ 19,00. Sensibilidades: R$ 8,00. Imagens Aéreas: R$ 2,00 por mapa. Camisa: R$ 89,90. Passe Booyah: R$ 11,00. Eventos: R$ 3,00-5,00.'
            },

            // Produtos digitais
            {
                match: ['sensibilidade', 'sensibilidades', 'sensis', 'configuração', 'config', 'configs', 'ajuste', 'ajustes', 'calibração', 'calibrar', 'mouse', 'teclado', 'dpi', 'fps', 'fps boost', 'otimização', 'otimizar', 'performance', 'rendimento', 'melhorar', 'melhoria', 'setup', 'settings', 'configurar', 'configurações', 'sens', 'sensibilidade do mouse', 'mouse sens', 'sens do mouse', 'sensibilidade da mira', 'mira', 'aim', 'apontar', 'apontamento', 'precisão', 'preciso', 'estabilidade', 'estável', 'controle', 'controlar', 'movimento', 'movimentação', 'crosshair', 'mira personalizada', 'personalizar', 'customizar', 'custom', 'personalização', 'personalizações', 'sensitivity', 'mouse sensitivity', 'aim sensitivity', 'game settings', 'jogo', 'gaming', 'gamer', 'free fire', 'ff', 'mobile', 'pc', 'android', 'ios', 'celular', 'computador', 'notebook', 'desktop', 'laptop', 'device', 'dispositivo', 'aparelho', 'equipamento', 'hardware', 'periférico', 'periféricos', 'mouse pad', 'mousepad', 'teclado mecânico', 'mechanical keyboard', 'gaming mouse', 'mouse gamer', 'teclado gamer', 'gaming keyboard', 'headset', 'fone', 'microfone', 'microphone', 'headphone', 'fone de ouvido', 'audio', 'som', 'sound', 'volume', 'vol', 'microfone', 'mic', 'micro', 'microfone gamer', 'gaming headset', 'headset gamer', 'fone gamer', 'gaming audio', 'audio gamer', 'som gamer', 'sound gamer', 'volume gamer', 'audio settings', 'configurações de áudio', 'configurações de som', 'configurações de audio', 'configurações de volume', 'configurações de microfone', 'configurações de mic', 'configurações de fone', 'configurações de headset', 'configurações de headphone', 'configurações de audio', 'configurações de som', 'configurações de volume', 'configurações de microfone', 'configurações de mic', 'configurações de fone', 'configurações de headset', 'configurações de headphone'],
                reply: 'Sensibilidades: R$ 8,00. Inclui configuração para PC/Android/iOS. Após compra, baixe em Minha Conta > Meus Produtos.'
            },
            {
                match: ['imagens aéreas', 'mapa', 'mapas', 'calls', 'bermuda', 'purgatório', 'kalahari', 'nova terra', 'alpine'],
                reply: 'Imagens Aéreas: R$ 2,00 por mapa. Escolha: Bermuda, Purgatório, Kalahari, Nova Terra, Alpine. Baixe em Minha Conta > Meus Produtos.'
            },
            {
                match: ['planilha', 'planilhas', 'analise', 'análise', 'coach', 'analista'],
                reply: 'Planilhas de Análise: R$ 19,00. Para coaches e analistas. Inclui dados precisos e gráficos. Download em Minha Conta > Meus Produtos.'
            },
            {
                match: ['passe', 'booyah', 'player id', 'id do jogador'],
                reply: 'Passe Booyah: R$ 11,00. Informe seu Player ID na compra. Após confirmação, um admin valida e entrega.'
            },
            {
                match: ['camisa', 'camiseta', 'roupa', 'física', 'entrega'],
                reply: 'Camisa Oficial: R$ 89,90. Produto físico com entrega. Escolha tamanho, cor, nome e endereço na compra.'
            },

            // Eventos e treinos
            {
                match: ['evento', 'eventos', 'treino', 'treinos', 'xtreino'],
                reply: '🎯 **EVENTOS DISPONÍVEIS:**\n\n• **XTREINO FREITAS:** R$ 1,00 (1 token) - 14h às 23h\n• **XTREINO MODO LIGA:** R$ 3,00 - 14h, 15h, 17h, 18h\n• **CAMPEONATO FREITAS:** R$ 8,00 (promo no site — antes R$ 10,00) - 19h às 23h\n• **SEMANAL FREITAS:** R$ 3,50 - 20h, 21h, 22h\n\nVeja na seção Eventos para mais detalhes!'
            },
            {
                match: ['modo liga', 'liga', 'competitivo'],
                reply: '🏆 **XTREINO MODO LIGA:**\n\n💰 **Valor:** R$ 3,00\n⏰ **Horários:** 14h, 15h, 17h, 18h\n🎮 **Modalidade:** Misto | Squad | 2 quedas | 15 slots\n🏅 **Premiação:** Vaga em campeonato pro top¹ da tabela\n📅 **Funcionamento:** Segunda a Sexta\n\n🎯 **Diferencial:** Transmissão modo liga ao vivo, montagem de cronograma, 15 slots e Troféu.'
            },
            {
                match: ['camp freitas', 'camp', 'campeonato'],
                reply: '🏆 **CAMPEONATO FREITAS:**\n\n💰 **Valor:** R$ 8,00 (promo no site — antes R$ 10,00)\n⏰ **Horários:** 19h, 20h, 21h, 22h, 23h\n🎮 **Modalidade:** Misto | Squad | 2 quedas por fase\n🏅 **Premiação:** R$ 4.000,00 + Troféu\n📅 **Funcionamento:** Segunda a Sexta-feira\n\n🎯 **Diferencial:** Transmissão modo liga ao vivo a partir das Semifinais + Troféu.'
            },
            {
                match: ['semanal', 'semanal freitas'],
                reply: '🏆 **SEMANAL FREITAS:**\n\n💰 **Valor:** R$ 3,50\n⏰ **Horários:** 1ª Fase às 20h e 21h | Final às 22h\n🎁 **Bônus:** Vaga direto na Final por apenas R$ 7,00\n🎮 **Modalidade:** Misto | Squad | 2 quedas\n🏅 **Premiação:** R$ 65,00\n📅 **Funcionamento:** Segunda a Sexta\n\n🎯 **Diferencial:** Termina no mesmo dia + premiação em dinheiro pro top¹.'
            },
            {
                match: ['xtreino freitas', 'xtreino', 'token', 'tokens', 'treino normal'],
                reply: '🎯 **XTREINO FREITAS:**\n\n💰 **Valor:** R$ 1,00 (1 token)\n⏰ **Horários:** 14h, 15h, 16h, 17h, 18h, 19h, 20h, 21h, 22h, 23h\n🎮 **Modalidade:** Misto | Squad | 2 quedas\n🏅 **Premiação:** Vaga em Campeonato pro top¹ da tabela\n📅 **Funcionamento:** Segunda a Sexta\n\n🎯 **Sobre o Evento:** Xtreino que visa o treinamento e aperfeiçoamento de Equipes amadoras e profissionais, onde Coach pode telar seu Time para avaliá-los. Oferecemos Tabela de pontuação, Banner de top³, Transmissão ao Vivo, Verificados, Ranking de melhor equipe com Troféu e mais...\n\n🎯 **Diferencial:** 10 horários diários, montagem de cronograma e Troféu.'
            },

            // Conta e pedidos
            {
                match: ['minha conta', 'conta', 'login', 'entrar', 'cadastro', 'registro'],
                reply: 'Acesse Minha Conta no menu. Faça login ou cadastre-se. Lá você vê pedidos, tokens, downloads e mais!'
            },
            {
                match: ['pedido', 'pedidos', 'compra', 'compras', 'histórico'],
                reply: 'Veja seus pedidos em Minha Conta > Meus Pedidos. Lá aparecem links de WhatsApp e status dos pagamentos.'
            },
            {
                match: ['download', 'baixar', 'meus produtos', 'produtos'],
                reply: 'Downloads ficam em Minha Conta > Meus Produtos. Sensibilidades, mapas, planilhas - tudo lá!'
            },

            // WhatsApp e grupos
            {
                match: ['whatsapp', 'grupo', 'link do grupo', 'id e senha', 'sala', 'discord'],
                reply: 'Links de WhatsApp das salas aparecem em Minha Conta > Meus Pedidos quando seu pedido estiver confirmado.'
            },
            {
                match: ['contato', 'falar', 'ajuda', 'suporte', 'problema'],
                reply: 'Precisa de ajuda? Use este chat 24 horas ou WhatsApp: (11) 94911-3275. Chat sempre disponível!'
            },

            // Pagamento e cupons
            {
                match: ['pagamento', 'pagar', 'mercado pago', 'cartão', 'pix'],
                reply: 'Aceitamos Mercado Pago (cartão, PIX, boleto). Pagamento seguro e rápido. Cupons de desconto disponíveis!'
            },
            {
                match: ['cupom', 'desconto', 'promoção', 'promo', 'código'],
                reply: 'Cupons de desconto disponíveis! Digite o código na compra. Alguns são específicos para eventos ou loja.'
            },

            // Informações gerais
            {
                match: ['freitas', 'mario', 'quem é', 'sobre', 'empresa'],
                reply: 'XTreino Freitas - Treinamentos e produtos para Free Fire. Mario Freitas e equipe especializada em estratégia e performance.'
            },
            {
                match: ['free fire', 'ff', 'jogo', 'gaming'],
                reply: 'Especialistas em Free Fire! Treinos, estratégias, sensibilidades, mapas e muito mais para melhorar sua performance.'
            },
            {
                match: ['obrigado', 'valeu', 'thanks', 'obg'],
                reply: 'De nada! Fico feliz em ajudar. Qualquer dúvida, estou aqui! 😊'
            },
            {
                match: ['oi', 'olá', 'hello', 'hi', 'bom dia', 'boa tarde', 'boa noite'],
                reply: 'Olá! Bem-vindo ao XTreino Freitas! Como posso te ajudar hoje? 😊'
            }
        ];

        let matchedReply = '';

        // Sistema mais inteligente de matching
        for (const c of canned) {
            let matchFound = false;

            // Verificar matches exatos
            if (c.match.some(k => textLower.includes(k))) {
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

        if (!matchedReply) {
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
                matchedReply = `❌ Não temos essa resposta no chat.\n\nChame no WhatsApp para saber melhor:\n\n📱 (11) 94911-3275\n\n🔗 [Clique aqui para abrir o WhatsApp](${whatsLink})`;
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
            try {
                const s = String(txt || '');
                if (s.length <= max) return s;
                return s.slice(0, max).trimEnd() + '…';
            } catch (_) { return ''; }
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
function ensureNewsModal() {
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNewsModal(); });
}

window.openNewsModal = function (index) {
    const list = window._newsList || [];
    const item = list[index];
    if (!item) return;
    const date = item.date?.toDate ? item.date.toDate() : (item.date ? new Date(item.date) : new Date());
    const meta = `${item.author || ''} • ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    const img = item.imageUrl || item.image || '';
    // Abrir imagem completa no modal
    const header = img ? `<img src="${img}" alt="${item.title || ''}" class="w-full object-contain max-h-[70vh] bg-black" loading="lazy" referrerpolicy="no-referrer" />` : '';
    document.getElementById('newsModalHeader').innerHTML = header;
    document.getElementById('newsModalCategory').textContent = '';
    document.getElementById('newsModalTitle').textContent = item.title || '';
    document.getElementById('newsModalMeta').textContent = meta;
    document.getElementById('newsModalContent').textContent = item.content || '';
    document.getElementById('newsModal').classList.remove('hidden');
}

window.closeNewsModal = function () {
    const m = document.getElementById('newsModal');
    if (m) m.classList.add('hidden');
}

// Função para abrir modal do FAQ
window.openFAQModal = function (faqId) {
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
                <p class="text-blue-600 font-medium">💬 Fique atento — o ID e a Senha são enviados cerca de 5 minutos antes do início da partida.</p>
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
                <p>Os treinos podem ser reservados em qualquer dia com horário disponível no site, inclusive aos sábados e domingos. No Modo Liga, também há o horário de 00h00.</p>
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
window.closeFAQModal = function () {
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
    // Garantir que imagens não fiquem invisíveis por muito tempo (fallback geral)
    setTimeout(() => {
        images.forEach(img => {
            if (!img.classList.contains('loaded')) {
                img.classList.add('loaded');
            }
        });
    }, 2000);

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
    // Fallback: forçar mostrar imagens no container após curto timeout
    setTimeout(() => {
        images.forEach(img => {
            if (!img.classList.contains('loaded')) img.classList.add('loaded');
            img.style.opacity = '1';
        });
    }, 1500);
}

// Make functions globally available
window.reinitAnimations = reinitAnimations;
window.initSmoothAnimations = initSmoothAnimations;

// --- Agendamento nativo (Firestore + Netlify Function) ---
const scheduleConfig =
{
    'modo-liga': { label: 'XTreino Modo Liga', price: 3.00, vagas: 15 },
    'camp-freitas': { label: 'Camp Freitas', price: 8.00, startDate: '2026-01-12', slots: ['19h', '20h', '21h', '22h', '23h'] },
    'camp-final': { label: 'Vaga Direto na Final', price: 100.00 },
    'semanal-freitas': { label: 'Semanal Freitas', price: 3.50 },
    'xtreino-tokens': { label: 'XTreino Tokens', price: 1.00 },
    // Produtos da loja virtual
    // 'sensibilidades': { label: 'Sensibilidade no Free Fire – PC / Android / iOS', price: 8.00, isProduct: true },
    // 'imagens': { label: 'Imagens Aéreas dos Mapas', price: 2.00, isProduct: true },
    // 'planilhas': { label: 'Planilha de Análise de Times', price: 19.00, isProduct: true },
    // 'passe-booyah': { label: 'Passe de Elite', price: 11.00, isProduct: true },
    // 'camisa': { label: 'Camisa Oficial Org Freitas', price: 89.90, isProduct: true }
};
const CAMP_SEASON_7_START_DATE = '2026-11-15';

function isCampSeason7Name(value) {
    const name = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return name.includes('camp') && /\bseason\s*7\b/.test(name);
}

function getActiveScheduleConfig(eventType) {
    const modal = document.getElementById('scheduleModal');
    const requestedType = eventType || modal?.dataset?.eventType;
    const adminEventId = modal?.dataset?.adminEventId;
    const exactConfig = adminEventId ? scheduleConfig[adminEventId] : null;
    if (exactConfig && (!requestedType || requestedType === modal?.dataset?.eventType
        || requestedType === exactConfig.eventType || requestedType === adminEventId)) {
        return exactConfig;
    }
    return scheduleConfig[requestedType] || {};
}

function getActiveEventRegistrationMetadata() {
    const modal = document.getElementById('scheduleModal');
    const config = getActiveScheduleConfig(modal?.dataset?.eventType);
    if (!config.adminEventId) return {};
    return {
        adminEventId: config.adminEventId,
        ...(config.dateScopedEventLinks ? { eventLinkDateScoped: true } : {}),
    };
}

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
    const form = document.getElementById('schedForm');
    let container = document.getElementById('productOptions');
    if (!container) {
        container = document.createElement('div');
        container.id = 'productOptions';
    }

    // Chamado somente para cfg.isProduct: deixar os dados do produto como item 1 do modal.
    container.className = '';
    container.innerHTML = '';
    const selectedTimeInput = form?.querySelector('#schedSelectedTime');
    if (form) {
        if (selectedTimeInput?.parentElement === form) {
            selectedTimeInput.after(container);
        } else {
            form.prepend(container);
        }
    }

    switch (productId) {
        case 'sensibilidades':
            // Sensibilidades com seleção de plataforma
            container.innerHTML = `
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <div class="space-y-3 mb-5">
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

                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543-.826-2.37.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </div>
                        <h4 class="text-lg font-semibold text-gray-800">Configuração Completa</h4>
                    </div>
                    <p class="text-gray-600 text-sm mb-4">Inclui: Sensibilidade otimizada, Pack de Otimização, Configuração Completa, Aprimoramento de Mira e Reação.</p>
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
            (function () {
                const prices = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 }; // Ajustado: 4 mapas = R$ 6,00
                const update = () => {
                    const count = document.querySelectorAll('input[name="mapOption"]:checked').length;
                    const price = prices[count] || (count > 5 ? prices[5] : 0);
                    const c = document.getElementById('mapsCount'); if (c) c.textContent = String(count);
                    const p = document.getElementById('mapsPrice'); if (p) p.textContent = `R$ ${price.toFixed(2)}`;
                };
                document.querySelectorAll('input[name="mapOption"]').forEach(i => i.addEventListener('change', update));
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
        case 'passe':
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
                    <div class="mt-4 bg-green-100 rounded-lg p-3 flex items-center gap-2">
                        <svg class="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-sm text-green-800 font-medium">Entrega rápida! Não pedimos senha/email, apenas o ID.</span>
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

        default: {
            // Produtos criados pelo admin — detecta o tipo pelo dado salvo no Firestore
            const prodData = (window.scheduleConfig?.[productId]) || (typeof products !== 'undefined' && products[productId]) || {};
            const prodCat = (prodData.category || '').toLowerCase();
            const prodName = (prodData.name || prodData.label || '').toLowerCase();
            const isPasse = prodCat === 'passe' || prodName.includes('passe') || prodName.includes('pass booyah');
            const isFisico = prodCat === 'fisico' || prodCat === 'physical';
            const isAereas = prodCat === 'aereas';
            const isSensib = prodCat === 'sensibilidade';

            if (isSensib) {
                const dlLinks = prodData.downloadLinks || {};
                const hasPC  = !!(dlLinks.pc && dlLinks.pc.trim());
                const hasIOS = !!(dlLinks.ios && dlLinks.ios.trim());
                const hasLG  = !!(dlLinks.lg && dlLinks.lg.trim());
                const hasMoto= !!(dlLinks.motorola && dlLinks.motorola.trim());
                const hasSam = !!(dlLinks.samsung && dlLinks.samsung.trim());
                const hasXia = !!(dlLinks.xiaomi && dlLinks.xiaomi.trim());
                const hasAndroid = hasLG || hasMoto || hasSam || hasXia;
                const platforms = [];
                if (hasPC) platforms.push(`<option value="pc">🖥️ PC (Windows)</option>`);
                if (hasAndroid) platforms.push(`<option value="android">📱 Android</option>`);
                if (hasIOS) platforms.push(`<option value="ios">🍎 iOS (iPhone/iPad)</option>`);
                const androidBrands = [];
                if (hasLG)   androidBrands.push(`<option value="lg">LG</option>`);
                if (hasMoto) androidBrands.push(`<option value="motorola">Motorola</option>`);
                if (hasSam)  androidBrands.push(`<option value="samsung">Samsung</option>`);
                if (hasXia)  androidBrands.push(`<option value="xiaomi">Xiaomi / Realme</option>`);
                container.innerHTML = `
                    <div class="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-100">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center mr-3">
                                <i class="fas fa-sliders-h text-white"></i>
                            </div>
                            <h4 class="text-lg font-semibold text-gray-800">Configuração de Sensibilidade</h4>
                        </div>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Plataforma <span class="text-red-500">*</span></label>
                                <select id="platformSelect" onchange="handlePlatformChange()"
                                        class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 focus:outline-none bg-white">
                                    <option value="">Selecione a plataforma</option>
                                    ${platforms.join('')}
                                </select>
                            </div>
                            <div id="androidBrandContainer" class="hidden">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Marca do celular <span class="text-red-500">*</span></label>
                                <select id="androidBrandSelect"
                                        class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 focus:outline-none bg-white">
                                    <option value="">Selecione a marca</option>
                                    ${androidBrands.join('')}
                                </select>
                            </div>
                            <p class="text-xs text-gray-500">O link de download será liberado conforme sua plataforma e marca escolhidas.</p>
                        </div>
                    </div>`;
                break;
            }

            if (isAereas) {
                // Imagens Aéreas do admin — checkboxes com mapas disponíveis
                const mapDefs = [
                    { key: 'bermuda',   label: 'Bermuda' },
                    { key: 'purgatorio',label: 'Purgatório' },
                    { key: 'solara',    label: 'Solara' },
                    { key: 'kalahari',  label: 'Kalahari' },
                    { key: 'novaTerra', label: 'Nova Terra' }
                ];
                const ml = prodData.mapLinks || {};
                // Mostrar só mapas com link; se nenhum ainda, mostrar todos
                const displayMaps = mapDefs.filter(m => ml[m.key] && ml[m.key].trim() !== '');
                const mapsHtml = (displayMaps.length > 0 ? displayMaps : mapDefs)
                    .map(m => `<label class="flex items-center gap-3 p-3 border border-orange-200 rounded-xl bg-white hover:bg-orange-50 cursor-pointer">
                        <input type="checkbox" name="aereasMapOption" value="${m.key}" class="w-4 h-4 accent-orange-500">
                        <i class="fas fa-map-marker-alt text-orange-400 text-sm"></i>
                        <span class="text-sm font-medium text-gray-800">${m.label}</span>
                    </label>`).join('');
                const basePrice = (prodData.priceOptions?.[0]?.price) || prodData.price || 2;
                container.innerHTML = `
                    <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                                <i class="fas fa-map text-white"></i>
                            </div>
                            <h4 class="text-lg font-semibold text-gray-800">Selecionar Mapas</h4>
                        </div>
                        <div class="grid md:grid-cols-2 gap-3 mb-4">${mapsHtml}</div>
                        <div class="bg-orange-100 rounded-lg p-3">
                            <span class="text-sm text-orange-800 font-medium">
                                Selecionados: <b id="aereasCount">0</b> •
                                Total: <b id="aereasPrice">R$ 0,00</b>
                            </span>
                        </div>
                    </div>`;
                const updateAereasPrice = () => {
                    const n = document.querySelectorAll('input[name="aereasMapOption"]:checked').length;
                    const el = document.getElementById('aereasCount'); if (el) el.textContent = String(n);
                    const ep = document.getElementById('aereasPrice'); if (ep) ep.textContent = `R$ ${(n * basePrice).toFixed(2)}`;
                };
                document.querySelectorAll('input[name="aereasMapOption"]').forEach(i => i.addEventListener('change', updateAereasPrice));
                updateAereasPrice();
            } else if (isPasse) {
                container.innerHTML = `
                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                                <i class="fas fa-gamepad text-white"></i>
                            </div>
                            <h4 class="text-lg font-semibold text-gray-800">Informações do Jogo</h4>
                        </div>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Nick (Apelido no Free Fire) <span class="text-red-500">*</span></label>
                                <input type="text" id="gameNick" placeholder="Seu apelido no jogo"
                                       class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ID do Jogador (Free Fire) <span class="text-red-500">*</span></label>
                                <input type="text" id="gameId" placeholder="Ex.: 123456789"
                                       class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Contato WhatsApp <span class="text-red-500">*</span></label>
                                <input type="tel" id="gameContact" placeholder="(XX) 9XXXX-XXXX"
                                       class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none transition-colors">
                            </div>
                        </div>
                        <div class="mt-4 bg-green-100 rounded-lg p-3 flex items-center gap-2">
                            <i class="fas fa-info-circle text-green-600 flex-shrink-0"></i>
                            <span class="text-sm text-green-800 font-medium">Não pedimos senha/email. Apenas Nick, ID e WhatsApp para entrega.</span>
                        </div>
                    </div>
                `;
            } else if (isFisico) {
                container.innerHTML = `
                    <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                                <i class="fas fa-box text-white"></i>
                            </div>
                            <h4 class="text-lg font-semibold text-gray-800">Dados para Entrega</h4>
                        </div>
                        <div class="grid md:grid-cols-2 gap-3">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo <span class="text-red-500">*</span></label>
                                <input id="addrNome" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">CPF <span class="text-red-500">*</span></label>
                                <input id="customerCPF" type="text" placeholder="000.000.000-00" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Tamanho (se aplicável)</label>
                                <select id="prodTamanho" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                                    <option value="">Não se aplica</option>
                                    <option value="PP">PP</option>
                                    <option value="P">P</option>
                                    <option value="M">M</option>
                                    <option value="G">G</option>
                                    <option value="GG">GG</option>
                                    <option value="XGG">XGG</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">CEP <span class="text-red-500">*</span></label>
                                <input id="addrCEP" type="text" placeholder="00000-000" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Endereço (Rua) <span class="text-red-500">*</span></label>
                                <input id="addrRua" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Número</label>
                                <input id="addrNumero" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                                <input id="addrComplemento" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Bairro <span class="text-red-500">*</span></label>
                                <input id="addrBairro" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Cidade <span class="text-red-500">*</span></label>
                                <input id="addrCidade" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Estado <span class="text-red-500">*</span></label>
                                <input id="addrEstado" type="text" class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors">
                            </div>
                        </div>
                        <div class="mt-4 bg-purple-100 rounded-lg p-3 flex items-center gap-2">
                            <i class="fas fa-truck text-purple-600 flex-shrink-0"></i>
                            <span class="text-sm text-purple-800 font-medium">Produto físico — será enviado pelo correio após confirmação do pagamento.</span>
                        </div>
                    </div>
                `;
            } else {
                // Digital — coleta Nome, Email, Telefone
                container.innerHTML = `
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-download text-white"></i>
                            </div>
                            <h4 class="text-lg font-semibold text-gray-800">Dados para Recebimento</h4>
                        </div>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo <span class="text-red-500">*</span></label>
                                <input type="text" id="digitalNome" placeholder="Seu nome completo"
                                       class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">E-mail <span class="text-red-500">*</span></label>
                                <input type="email" id="digitalEmail" placeholder="seu@email.com"
                                       class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp <span class="text-red-500">*</span></label>
                                <input type="tel" id="digitalTelefone" placeholder="(XX) 9XXXX-XXXX"
                                       class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors">
                            </div>
                        </div>
                        <div class="mt-4 bg-blue-100 rounded-lg p-3 flex items-center gap-2">
                            <i class="fas fa-bolt text-blue-600 flex-shrink-0"></i>
                            <span class="text-sm text-blue-800 font-medium">O link de download será liberado automaticamente após a confirmação do pagamento.</span>
                        </div>
                    </div>
                `;
            }
            break;
        }
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

    document.getElementById('schedPrice').textContent = finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function stopScheduleAvailabilityListener() {
    const previousKey = window.__schedListenerKey;
    try { window.__schedUnsub?.(); } catch (_) { }
    window.__schedUnsub = null;
    window.__schedListenerKey = null;

    const resolveInitial = window.__schedResolveInitialOccupied;
    window.__schedResolveInitialOccupied = null;
    window.__schedInitialOccupiedPromise = null;
    window.__schedInitialOccupiedKey = null;
    if (resolveInitial) resolveInitial(null);

    if (previousKey && typeof scheduleCache !== 'undefined') {
        delete scheduleCache[previousKey];
    }
}

function openScheduleModal(eventType, options = {}) {
    if (!window.isLoggedIn || !window.firebaseAuth?.currentUser) {
        showToast('Faça login para se inscrever em eventos.', 3000);
        openLoginModal();
        return;
    }
    const requestedAdminEventId = options && typeof options === 'object' ? options.adminEventId : null;
    const inferredAdminEventId = requestedAdminEventId
        || (scheduleConfig[eventType]?.adminEventId === eventType ? eventType : null);
    const cfg = (inferredAdminEventId && scheduleConfig[inferredAdminEventId]) || scheduleConfig[eventType];
    const modal = document.getElementById('scheduleModal');
    if (!cfg || !modal) return;
    if (inferredAdminEventId && cfg.eventType) eventType = cfg.eventType;
    window.__schedRenderGeneration = (window.__schedRenderGeneration || 0) + 1;
    stopScheduleAvailabilityListener();

    // Pré-aquecer a Netlify Function para eliminar o cold start no pagamento
    // (dispara OPTIONS em background — o usuário ainda vai preencher o formulário)
    try {
        fetch('/.netlify/functions/create-preference', { method: 'OPTIONS' }).catch(() => {});
    } catch (_) {}

    // Reset global variables
    selectedTimes = [];
    teams = [];
    teamCounter = 0;

    modal.dataset.eventType = eventType;
    modal.dataset.adminEventId = inferredAdminEventId || '';
    window._currentScheduleEventType = eventType;
    document.getElementById('schedPrice').textContent = cfg.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('schedEventType').textContent = cfg.label;

    // Mostrar/ocultar seção de cupom conforme tipo de pagamento
    (function () {
        const couponSection = document.getElementById('scheduleCouponSection');
        if (couponSection) {
            // Esconde cupom: tokens, camisas/produtos físicos
            const isFisicoOrShirt = eventType === 'camisa'
                || (cfg.category === 'fisico' || cfg.category === 'physical');
            couponSection.style.display = (cfg.payWithToken || isFisicoOrShirt) ? 'none' : 'block';
        }
        if (cfg.payWithToken) {
            // Garante que nenhum cupom de agendamento fique aplicado
            try { window.appliedScheduleCoupon = null; } catch (_) { }
            const msg = document.getElementById('schedCouponMessage');
            if (msg) { msg.classList.add('hidden'); msg.textContent = ''; }
            const input = document.getElementById('schedCouponCodeInput');
            if (input) { input.value = ''; }
        }
    })();
    updateScheduleCouponUI();

    // Mostrar seção de times para todos os eventos pagos (inclui xtreino-tokens)
    const _teamsSectionEl = document.getElementById('teamsSection');
    if (_teamsSectionEl) _teamsSectionEl.style.display = '';
    addTeam();

    // Sincronizar tokens do usuário antes de qualquer checagem
    try { if (typeof syncUserTokens === 'function') { syncUserTokens(); } } catch (_) { }

    // Ocultar botão de tokens (não usamos compra de tokens)
    const hideBuyTokens = document.getElementById('buyTokensBtn');
    if (hideBuyTokens) hideBuyTokens.classList.add('hidden');

    // Se for produto da loja, esconder seleção de data/hora e adicionar opções específicas
    if (cfg.isProduct) {
        // Mudar título do modal para "Finalizar Compra" (não é agendamento)
        const modalTitle = document.querySelector('#scheduleModal .schedule-modal-title');
        const modalSub   = document.querySelector('#scheduleModal .schedule-modal-sub');
        if (modalTitle) modalTitle.textContent = 'Finalizar Compra';
        if (modalSub)   modalSub.textContent   = cfg.label || 'Complete as informações do seu pedido';

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

        // Ocultar seção "Detalhes do Evento" (Data/Horário) — desnecessária para produtos
        const schedEventDetailsSection = document.getElementById('schedEventDetailsSection');
        if (schedEventDetailsSection) schedEventDetailsSection.style.display = 'none';

        // Para produtos: reaproveitar o resumo como "Resumo do Pedido" (não esconder)
        const reservationsSummarySection = document.getElementById('reservationsSummarySection');
        if (reservationsSummarySection) {
            reservationsSummarySection.style.display = '';
            // Mudar título para "Resumo do Pedido"
            const rTitle = reservationsSummarySection.querySelector('h4');
            if (rTitle) rTitle.innerHTML = `<svg class="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> Resumo do Pedido`;
            // Preencher conteúdo e preço
            const rSummary = document.getElementById('reservationsSummary');
            if (rSummary) rSummary.innerHTML = `<p class="text-gray-700 font-medium">${cfg.label || 'Produto'}</p>`;
            const totalPriceEl = document.getElementById('totalPrice');
            if (totalPriceEl) totalPriceEl.textContent = `R$ ${Number(cfg.price || 0).toFixed(2).replace('.', ',')}`;
            // Inicializar o total global para que o cupom funcione corretamente
            scheduleOriginalTotal = Number(cfg.price || 0);
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

        

        // Esconder botão "Comprar tokens"
        const buyTokensBtn = document.getElementById('buyTokensBtn');
        if (buyTokensBtn) buyTokensBtn.classList.add('hidden');

        // Mostrar botão "Pagar com Tokens" para produtos (exceto camisas/físicos)
        const _prodTokenBtn = document.getElementById('schedPayTokens');
        if (_prodTokenBtn) {
            const isProdFisico = eventType === 'camisa'
                || cfg.category === 'fisico'
                || cfg.category === 'physical';
            _prodTokenBtn.style.display = isProdFisico ? 'none' : '';
        }

        // Adicionar opções específicas do produto
        addProductOptions(eventType);

        // Mostrar modal
        modal.classList.remove('hidden');
        const resetProductModalScroll = () => {
            modal.scrollTop = 0;
            modal.querySelectorAll('.overflow-y-auto').forEach(scrollArea => {
                scrollArea.scrollTop = 0;
            });
        };
        resetProductModalScroll();
        requestAnimationFrame(resetProductModalScroll);
        return;
    }

    // Restaurar título do modal para evento (reserva de horário)
    const _mTitle = document.querySelector('#scheduleModal .schedule-modal-title');
    const _mSub   = document.querySelector('#scheduleModal .schedule-modal-sub');
    if (_mTitle) _mTitle.textContent = 'Reservar Horário';
    if (_mSub)   _mSub.textContent   = 'Escolha a data e horário para seu evento';

    // Restaurar seção "Detalhes do Evento" (visível para eventos, oculta para produtos)
    const _schedDetails = document.getElementById('schedEventDetailsSection');
    if (_schedDetails) _schedDetails.style.display = '';

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
        // Ocultar apenas se for evento GRATUITO do tipo xtreino-tokens (usa modal próprio)
        // Eventos xtreino-tokens PAGOS usam este modal e precisam mostrar a seção de time
        const _isFreeTeamEvt = (eventType === 'xtreino-tokens' || getActiveScheduleConfig(eventType).eventType === 'xtreino-tokens')
            && (cfg.price === 0 || cfg.isFree === true);
        teamsSection.style.display = _isFreeTeamEvt ? 'none' : 'block';
    }

    // Restaurar texto original do botão para eventos
    const submitBtn = document.getElementById('schedSubmit');
    if (submitBtn) {
        submitBtn.textContent = '✅ Confirmar e Pagar';
    }

    // Detectar evento grátis e ajustar UI (sem pagamento, cupom ou tokens)
    {
        const _isFree = cfg.price === 0 || cfg.isFree === true;
        modal.dataset.isFree = _isFree ? '1' : '0';
        const _couponSec = document.getElementById('scheduleCouponSection');
        const _payTokenBtn = document.getElementById('schedPayTokens');
        const _priceEl = document.getElementById('schedPrice');
        if (_isFree) {
            if (_couponSec) _couponSec.style.display = 'none';
            if (_payTokenBtn) _payTokenBtn.style.display = 'none';
            if (submitBtn) submitBtn.textContent = '✅ Confirmar Inscrição Grátis';
            if (_priceEl) _priceEl.textContent = 'GRÁTIS';
        } else {
            if (_couponSec) _couponSec.style.display = '';
            if (_payTokenBtn) _payTokenBtn.style.display = '';
        }
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
    (function () {
        const dateInput = document.getElementById('schedDate');
        if (!dateInput) return;
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        const activeConfig = getActiveScheduleConfig(eventType);
        dateInput.removeAttribute('max');
        if (activeConfig.dateScopedEventLinks) {
            const startDate = activeConfig.startDate || CAMP_SEASON_7_START_DATE;
            dateInput.min = startDate;
            dateInput.value = todayStr > startDate ? todayStr : startDate;
            updateSelectedDate();
        // Para camp-freitas, usar configurações específicas (semifinais têm prioridade)
        } else if (eventType === 'camp-freitas') {
            const cfg = activeConfig;
            // Prioridade: se há datas de semifinal, manter essas datas como opções mínimas
            const availableDates = CAMP_SEMIFINAL_DATES.filter(d => d >= todayStr);
            if (availableDates.length > 0) {
                dateInput.min = availableDates[0];
                dateInput.max = availableDates[availableDates.length - 1];
                dateInput.value = availableDates[0];
            } else if (cfg.startDate) {
                // Usar startDate da configuração quando não for semifinal
                dateInput.min = cfg.startDate;
                dateInput.value = cfg.startDate;
                // remover max para permitir agendamento ad infinitum
                try { dateInput.removeAttribute('max'); } catch (_) { }
            } else {
                // fallback: manter comportamento antigo (bloqueado)
                dateInput.min = CAMP_SEMIFINAL_DATES[0];
                dateInput.max = CAMP_SEMIFINAL_DATES[CAMP_SEMIFINAL_DATES.length - 1];
                dateInput.value = CAMP_SEMIFINAL_DATES[0];
            }
            updateSelectedDate();
        } else if (eventType === 'camp-final') {
            const availableDates = CAMP_FINAL_DATES.filter(d => d >= todayStr);
            if (availableDates.length > 0) {
                dateInput.min = availableDates[0];
                dateInput.max = availableDates[availableDates.length - 1];
                dateInput.value = availableDates[0];
            } else {
                dateInput.min = CAMP_FINAL_DATES[0];
                dateInput.max = CAMP_FINAL_DATES[CAMP_FINAL_DATES.length - 1];
                dateInput.value = CAMP_FINAL_DATES[0];
            }
            updateSelectedDate();
        } else {
            // Para outros eventos, permitir de hoje em diante
            dateInput.min = todayStr;
            dateInput.removeAttribute('max');
        }
    })();
    // re-render quando a data mudar
    const dateInput = document.getElementById('schedDate');
    if (dateInput && !dateInput._schedBound) {
        dateInput.addEventListener('change', () => {
            updateSelectedDate();
            renderScheduleTimes();
        });
        dateInput._schedBound = true;
    }
    // Resetar datas múltiplas selecionadas ao abrir
    selectedDates = [];
    renderSelectedDatesList();
    // Inicializar calendário customizado com o mês atual (ou mês do evento para camp)
    (() => {
        const _inp = document.getElementById('schedDate');
        const _existingVal = _inp?.value;
        const _now = new Date();
        const _pad = n => String(n).padStart(2, '0');
        let _initYear, _initMonth;
        if (_existingVal && /^\d{4}-\d{2}-\d{2}$/.test(_existingVal)) {
            const [_ey, _em] = _existingVal.split('-').map(Number);
            _initYear = _ey; _initMonth = _em - 1;
        } else {
            _initYear = _now.getFullYear(); _initMonth = _now.getMonth();
            if (_inp) _inp.value = `${_initYear}-${_pad(_initMonth + 1)}-${_pad(_now.getDate())}`;
        }
        window._calState = { year: _initYear, month: _initMonth, lockedDates: new Set(), globalLocked: false };
        renderCustomCalendar(_initYear, _initMonth);
        loadLockedDatesForCalendar(eventType);
    })();
    renderScheduleTimes();
    // Preenche dados se logado
    try {
        if (window.isLoggedIn && window.currentUserProfile) {
            const p = window.currentUserProfile;
            const team = document.getElementById('schedTeam');
            const email = document.getElementById('schedEmail');
            const phone = document.getElementById('schedPhone');
            if (team) team.value = p.teamName || '';
            if (email) email.value = p.email || '';
            if (phone) phone.value = p.phone || '';
        }
    } catch (_) { }
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

}
function closeScheduleModal() {
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
        appliedScheduleCoupon = null;
        scheduleOriginalTotal = 0;
        updateScheduleCouponUI();

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
    window.__schedRenderGeneration = (window.__schedRenderGeneration || 0) + 1;
    stopScheduleAvailabilityListener();
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}
// Renderizar lista de datas selecionadas para agendamento múltiplo
function renderSelectedDatesList() {
    const list = document.getElementById('selectedDatesList');
    if (!list) return;
    if (!selectedDates || selectedDates.length === 0) {
        list.innerHTML = '';
        updateReservationsSummary();
        return;
    }
    const fmt = (d) => {
        try {
            const [y, m, dd] = d.split('-').map(n => parseInt(n, 10));
            const date = new Date(y, m - 1, dd);
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' });
        } catch (_) { return d; }
    };
    list.innerHTML = selectedDates.map(d => (
        `<div class="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span>${fmt(d)}</span>
            <button type="button" class="text-red-600 hover:text-red-800 text-xs" onclick="removeSelectedDate('${d}')">remover</button>
         </div>`
    )).join('');
    updateReservationsSummary();
}
function addSelectedDate() {
    const input = document.getElementById('schedDate');
    const modal = document.getElementById('scheduleModal');
    const eventType = modal?.dataset?.eventType || null;
    if (!input || !input.value) return;
    const date = input.value;
    if (!isValidScheduleDate(date, eventType)) {
        alert('Data inválida para este evento.');
        return;
    }
    if (!selectedDates.includes(date)) {
        selectedDates.push(date);
        renderSelectedDatesList();
        const s = window._calState;
        if (s) renderCustomCalendar(s.year, s.month);
    }
    // Scroll suave para "Escolha o Horário" após adicionar a data
    setTimeout(() => {
        const horarioEl = document.getElementById('schedTimes');
        if (horarioEl) horarioEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
}

function removeSelectedDate(dateStr) {
    selectedDates = selectedDates.filter(d => d !== dateStr);
    selectedTimes = selectedTimes.filter(item => item.date !== dateStr);
    renderSelectedDatesList();
    updateReservationsSummary();
    const currentDate = document.getElementById('schedDate')?.value;
    if (currentDate === dateStr) renderScheduleTimes();
    const s = window._calState;
    if (s) renderCustomCalendar(s.year, s.month);
}

function clearSelectedDates() {
    selectedDates = [];
    selectedTimes = [];
    renderSelectedDatesList();
    updateReservationsSummary();
    renderScheduleTimes();
    const s = window._calState;
    if (s) renderCustomCalendar(s.year, s.month);
}

function initScheduleDate() {
    const input = document.getElementById('schedDate');
    if (!input) return;
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    input.value = `${y}-${m}-${d}`;
    if (!window._calState) window._calState = { year: y, month: today.getMonth(), lockedDates: new Set(), globalLocked: false };
    renderCustomCalendar(window._calState.year, window._calState.month);
}
function setSchedToday() {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    selectCalendarDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
}
function setSchedTomorrow() {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const pad = n => String(n).padStart(2, '0');
    selectCalendarDate(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
}

// ===== CALENDÁRIO CUSTOMIZADO =====

// Horas padrão de cada evento — usadas para detectar "dia totalmente travado"
function _calEventHours(eventType) {
    const t = String(eventType || '').toLowerCase();
    if (t === 'xtreino-tokens')  return ['14','15','16','17','18','19','20','21','22','23'];
    if (t === 'modo-liga')       return ['14','15','17','18'];
    if (t === 'semanal-freitas') return ['20','21','22'];
    if (t === 'camp-freitas')    return ['19','20','21','22','23'];
    // Eventos dinâmicos: usar slots do scheduleConfig
    if (typeof scheduleConfig !== 'undefined' && scheduleConfig[eventType]?.slots?.length > 0) {
        return scheduleConfig[eventType].slots.map(s => String(s).replace(/\D/g, ''));
    }
    return [];
}

// Carrega travas do Firestore e re-renderiza o calendário (assíncrono, não bloqueia UI)
async function loadLockedDatesForCalendar(eventType) {
    const state = window._calState;
    if (!state || !window.firebaseDb || !eventType) return;
    try {
        const { collection, query, where, getDocs, doc, getDoc } =
            await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        // Checar trava geral
        const gSnap = await getDoc(doc(window.firebaseDb, 'event_global_locks', eventType));
        if (gSnap.exists() && gSnap.data().locked === true) {
            state.globalLocked = true;
            renderCustomCalendar(state.year, state.month);
            return;
        }
        state.globalLocked = false;
        // O calendário só oferece hoje e amanhã; não leia o histórico inteiro do evento.
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        const ovSnap = await getDocs(query(
            collection(window.firebaseDb, 'schedule_overrides'),
            where('date', 'in', [todayStr, tomorrowStr])
        ));
        const defaultHours = _calEventHours(eventType);
        const lockedByDate = {};
        ovSnap.forEach(d => {
            const data = d.data();
            if (data.eventType !== eventType || !data.locked || !data.date) return;
            const hh = String(data.hour || data.hh || '').replace(/\D/g, '');
            if (!hh) return;
            if (!lockedByDate[data.date]) lockedByDate[data.date] = new Set();
            lockedByDate[data.date].add(hh);
        });
        const lockedDates = new Set();
        if (defaultHours.length > 0) {
            for (const [date, hours] of Object.entries(lockedByDate)) {
                if (defaultHours.every(h => hours.has(h))) lockedDates.add(date);
            }
        }
        state.lockedDates = lockedDates;
        renderCustomCalendar(state.year, state.month);
    } catch (e) {
        console.warn('[Cal] Erro ao carregar travas:', e);
    }
}

function renderCustomCalendar(year, month) {
    const container = document.getElementById('customCalendarContainer');
    if (!container) return;
    if (!window._calState) window._calState = {};
    window._calState.year  = year;
    window._calState.month = month;

    const modal      = document.getElementById('scheduleModal');
    const eventType  = modal?.dataset?.eventType || window._currentScheduleEventType || null;
    const today      = new Date();
    today.setHours(0, 0, 0, 0);
    const pad        = n => String(n).padStart(2, '0');
    const todayStr   = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const currentVal = document.getElementById('schedDate')?.value || '';
    const selDates   = (typeof selectedDates !== 'undefined') ? selectedDates : [];
    const lockedSet  = window._calState?.lockedDates || new Set();
    const globalLocked = !!window._calState?.globalLocked;

    // Apenas botões Hoje / Amanhã
    const tom        = new Date(today);
    tom.setDate(today.getDate() + 1);
    const tomStr     = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
    const todayOk    = !globalLocked && !lockedSet.has(todayStr) && isValidScheduleDate(todayStr, eventType);
    const tomorrowOk = !globalLocked && !lockedSet.has(tomStr) && isValidScheduleDate(tomStr, eventType);

    container.innerHTML = `
        <div class="flex gap-3">
            <button ${todayOk ? `onclick="selectCalendarDate('${todayStr}')"` : 'disabled'}
                    class="flex-1 py-3 text-sm font-bold rounded-xl border-2 transition-colors ${todayOk ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600 cursor-pointer' : 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'}">
                📅 Hoje
            </button>
            <button ${tomorrowOk ? `onclick="selectCalendarDate('${tomStr}')"` : 'disabled'}
                    class="flex-1 py-3 text-sm font-bold rounded-xl border-2 transition-colors ${tomorrowOk ? 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 cursor-pointer' : 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'}">
                📅 Amanhã
            </button>
        </div>`;
}

function selectCalendarDate(dateStr) {
    if (!dateStr) return;
    const input = document.getElementById('schedDate');
    if (input) input.value = dateStr;
    const [_y, _m] = dateStr.split('-').map(Number);
    if (window._calState) { window._calState.year = _y; window._calState.month = _m - 1; }
    updateSelectedDate();
    renderScheduleTimes();
    renderCustomCalendar(_y, _m - 1);
    // Scroll suave para "Escolha o Horário" ao clicar em um dia
    setTimeout(() => {
        const horarioEl = document.getElementById('horarioSection');
        if (horarioEl) horarioEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
}

function prevCalendarMonth() {
    const s = window._calState;
    if (!s) return;
    if (s.month === 0) { s.month = 11; s.year--; } else { s.month--; }
    renderCustomCalendar(s.year, s.month);
}

function nextCalendarMonth() {
    const s = window._calState;
    if (!s) return;
    if (s.month === 11) { s.month = 0; s.year++; } else { s.month++; }
    renderCustomCalendar(s.year, s.month);
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

function countOccupiedRegistrations(snapshot, day, date, eventType, validStatuses = new Set(['paid', 'confirmed', 'approved', 'lisagem_gratis'])) {
    const occupied = {};
    const parseHour = (record) => {
        const candidates = [
            record?.schedule, record?.hour, record?.time, record?.selectedTime,
            record?.slot, record?.scheduledTime, record?.hourString
        ];
        for (const value of candidates) {
            if (value == null || value === '') continue;
            const raw = String(value);
            const match = raw.match(/(\d{1,2})\s*h/)
                || raw.match(/(\d{1,2})\s*:\s*\d{2}/)
                || raw.match(/\b(\d{1,2})\b/);
            if (match) return parseInt(match[1], 10);
        }
        return null;
    };

    snapshot.forEach((doc) => {
        const record = doc.data();
        if (!validStatuses.has(record.status) || record.date !== date) return;
        if (eventType && record.eventType !== eventType) return;
        const hour = parseHour(record);
        if (hour == null || Number.isNaN(hour)) return;
        const key = `${day} - ${hour}h`;
        occupied[key] = (occupied[key] || 0) + 1;
    });
    return occupied;
}

// Capacidade de vagas por tipo de evento e horário (casos especiais)
function getEventCapacity(eventType, hourStr, dateStr) {
    const type = String(eventType || '').toLowerCase();
    const hour = String(hourStr || '').toLowerCase().replace(/\s/g, '');
    const dateIso = dateStr || (document.getElementById('schedDate')?.value || null);
    const activeConfig = getActiveScheduleConfig(eventType);

    // Modo liga / Acesso (mesmo formato de sala): 15
    if (type === 'modo-liga' || type === 'acesso') return 15;

    // Camp Final: apenas 2 vagas fixas
    if (type === 'camp-final') return 2;

    // Semanal Freitas 22h: capacidade 4
    if (type === 'semanal-freitas' && (hour === '22h' || hour.includes('22'))) return 4;

    // Camp Freitas SEMIFINAL: 22/11 e 23/11 às 17h - apenas 3 vagas
    if (type === 'camp-freitas' && !activeConfig.dateScopedEventLinks) {
        if (dateIso && CAMP_SEMIFINAL_DATES.includes(dateIso) && (hour === '17h' || hour.includes('17'))) {
            return 3; // Semifinal: apenas 3 vagas
        }
    }

    // Demais: 12
    return 12;
}

// Preço por tipo de evento e horário (casos especiais)
function getEventPrice(eventType, hourStr, dateStr) {
    const type = String(eventType || '').toLowerCase();
    const hour = String(hourStr || '').toLowerCase().replace(/\s/g, '');
    const dateIso = dateStr || (document.getElementById('schedDate')?.value || null);
    // Horário liberado gratuitamente pelo admin → preço zero
    if (dateIso) {
        const _freeMap = (window._freeHoursMap || {})[dateIso] || {};
        const _hourNum = parseInt(hour.replace(/\D/g, ''), 10);
        if (!isNaN(_hourNum) && _freeMap[_hourNum]) return 0;
    }
    // Semanal Freitas 22h: R$ 7,00 (vaga direto na final)
    if (type === 'semanal-freitas' && (hour === '22h' || hour.includes('22'))) return 7.00;
    if (type === 'camp-final') return 100.00;
    // Camp Freitas SEMIFINAL: 22/11 e 23/11 às 17h - R$ 60,00
    try {
        if (type === 'camp-freitas' && dateIso) {
            // Verificar se é semifinal primeiro (prioridade)
            if (CAMP_SEMIFINAL_DATES.includes(dateIso) && (hour === '17h' || hour.includes('17'))) {
                return 60.00; // Semifinal: R$ 60,00
            }
            // Camp Freitas PROMO: dias específicos (oitavas)
            const promos = {
                '2024-11-17': { price: 25.00, hours: ['21h', '22h'] }, // Dia 17/11: R$25,00 apenas 21h e 22h
                '2025-11-17': { price: 25.00, hours: ['21h', '22h'] }, // Dia 17/11/2025: R$25,00 apenas 21h e 22h
                '2025-11-13': { price: 20.00, hours: ['21h', '22h', '23h'] },
                '2025-11-14': { price: 20.00, hours: ['20h'] }
            };
            const promo = promos[dateIso];
            if (promo && promo.hours && promo.hours.includes(hour)) return promo.price;
        }
    } catch (_) { }
    // Padrão: usar preço do config
    const cfg = getActiveScheduleConfig(eventType);
    return Number(cfg.price || 0);
}

// Valida datas futuras; dias sem atendimento são controlados pelos bloqueios manuais de horários.
function isValidScheduleDate(dateStr, eventType) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date < today) return false;

    // Xtreino Tokens (gratuito): permite todos os dias da semana
    if (eventType === 'xtreino-tokens') {
        return true;
    }

    // Regras específicas por evento
    const activeConfig = getActiveScheduleConfig(eventType);
    if (activeConfig.dateScopedEventLinks) {
        return dateStr >= (activeConfig.startDate || CAMP_SEASON_7_START_DATE);
    }
    if (eventType === 'camp-freitas') {
        // Prioridade: manter suporte a semifinais já definidas
        const dateIso = dateStr || '';
        if (CAMP_SEMIFINAL_DATES.includes(dateIso)) {
            return true;
        }

        // Usar configuração em scheduleConfig quando disponível (promoção regular a partir de uma data)
        const cfg = activeConfig;
        if (cfg.startDate) {
            // aceitar datas a partir do startDate e somente em weekdays permitidos
            const normalizedStart = new Date(cfg.startDate + 'T00:00:00');
            if (isNaN(normalizedStart.getTime())) {
                // fallback: não permitir
                return false;
            }
            if (date < normalizedStart) return false;
            return true;
        }

        // Se não há configuração, não permitir por padrão
        return false;
    } else if (eventType === 'camp-final') {
        const dateIso = dateStr || '';
        if (CAMP_FINAL_DATES.includes(dateIso)) {
            return true;
        }
        return false;
    }

    // Eventos recorrentes e dinâmicos aceitam qualquer dia futuro.
    return true;
}

async function renderScheduleTimes() {
    const timesWrap = document.getElementById('schedTimes');
    if (!timesWrap) return;

    const dateInput = document.getElementById('schedDate');
    if (!dateInput) return;
    const date = dateInput.value;
    const modal = document.getElementById('scheduleModal');
    const eventType = modal?.dataset?.eventType || window._currentScheduleEventType || null;
    const cacheKey = `${date}__${eventType || 'all'}`;
    const renderGeneration = (window.__schedRenderGeneration || 0) + 1;
    window.__schedRenderGeneration = renderGeneration;

    // Mostrar loader imediatamente — evita flash de todos os horários antes dos dados carregarem
    const hasLiveSchedule = window.__schedListenerKey === cacheKey
        && Object.prototype.hasOwnProperty.call(scheduleCache, cacheKey);
    if (!hasLiveSchedule) {
        timesWrap.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-1"></i> Carregando horários...</div>';
    }

    if (!isValidScheduleDate(date, eventType)) {
        stopScheduleAvailabilityListener();
        let msg = 'Esta data não está disponível para este evento.';
        if (eventType === 'xtreino-tokens') msg = 'Agendamentos não disponíveis em datas passadas.';
        else if (getActiveScheduleConfig(eventType).dateScopedEventLinks) msg = 'O Camp Season 7 aceita inscrições a partir de 15/11/2026.';
        else if (eventType === 'camp-freitas') msg = 'Camp Freitas (Semifinal) disponível somente em 22/11 e 23/11 às 17h.';
        else if (eventType === 'camp-final') msg = 'Vaga Direto na Final disponível apenas em 28/11 às 18h.';
        timesWrap.innerHTML = `<p class="text-red-500 text-center py-4">${msg}</p>`;
        return;
    }

    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const d = new Date(date + 'T00:00:00');
    const day = dayNames[d.getDay()];

    // Verificar trava geral do evento (event_global_locks)
    try {
        if (window.firebaseDb && eventType) {
            const { doc: _doc, getDoc: _getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const glSnap = await _getDoc(_doc(window.firebaseDb, 'event_global_locks', eventType));
            if (renderGeneration !== window.__schedRenderGeneration) return;
            if (glSnap.exists() && glSnap.data().locked === true) {
                stopScheduleAvailabilityListener();
                timesWrap.innerHTML = `<div class="text-center py-6">
                    <div class="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 font-bold text-base">
                        🔴 Este evento está temporariamente suspenso pelo administrador.<br>
                        <span class="font-normal text-sm">Novos horários serão liberados em breve.</span>
                    </div>
                </div>`;
                return;
            }
        }
    } catch(_) {}

    const cfg = getActiveScheduleConfig(eventType);
    const now = new Date();
    const selectedDate = new Date(date + 'T00:00:00');
    const isToday = selectedDate.toDateString() === now.toDateString();

    // Buscar horários travados E vagas ocupadas em PARALELO antes de renderizar qualquer botão
    let lockedHours = new Set();
    let occupied = {};
    try {
        const { collection, query, where, getDocs, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        if (renderGeneration !== window.__schedRenderGeneration) return;

        // ── Disparar travas e ocupação em paralelo; inscrições vêm de um único listener por data ──
        window._freeHoursMap = window._freeHoursMap || {};
        window._freeHoursMap[date] = {};

        const _initHlCacheKey = `__hlCache_${eventType || 'all'}`;
        const _initHlCache = window[_initHlCacheKey];
        const _initHlPromise = (_initHlCache && Date.now() - _initHlCache.ts < 120000)
            ? Promise.resolve(_initHlCache.hours)
            : getDocs(collection(window.firebaseDb, 'event_hour_locks')).then(snap => {
                const hours = new Set();
                snap.forEach(d => {
                    const data = d.data();
                    if (!matchesPermanentHourLock(data, eventType, cfg)) return;
                    const h = parseInt(String(data.hour || ''), 10);
                    if (!isNaN(h) && h >= 0 && h <= 23) hours.add(h);
                });
                window[_initHlCacheKey] = { hours, ts: Date.now() };
                return hours;
            }).catch(() => new Set());

        let initialOccupiedPromise;
        if (window.__schedListenerKey === cacheKey
            && Object.prototype.hasOwnProperty.call(scheduleCache, cacheKey)) {
            initialOccupiedPromise = Promise.resolve(scheduleCache[cacheKey]);
        } else {
            if (window.__schedListenerKey !== cacheKey) stopScheduleAvailabilityListener();
            window.__schedListenerKey = cacheKey;

            if (window.__schedInitialOccupiedKey === cacheKey && window.__schedInitialOccupiedPromise) {
                initialOccupiedPromise = window.__schedInitialOccupiedPromise;
            } else {
                window.__schedInitialOccupiedKey = cacheKey;
                window.__schedInitialOccupiedPromise = new Promise((resolve) => {
                    window.__schedResolveInitialOccupied = resolve;
                    const registrationFilters = [where('date', '==', date)];
                    if (eventType) registrationFilters.push(where('eventType', '==', eventType));
                    const registrationQuery = query(collection(window.firebaseDb, 'registrations'), ...registrationFilters);

                    window.__schedUnsub = onSnapshot(
                        registrationQuery,
                        (snapshot) => {
                            if (window.__schedListenerKey !== cacheKey) return;
                            const occupiedFromSnapshot = countOccupiedRegistrations(snapshot, day, date, eventType);
                            scheduleCache[cacheKey] = occupiedFromSnapshot;
                            const resolveInitial = window.__schedResolveInitialOccupied;
                            if (resolveInitial && window.__schedInitialOccupiedKey === cacheKey) {
                                window.__schedResolveInitialOccupied = null;
                                window.__schedInitialOccupiedPromise = null;
                                window.__schedInitialOccupiedKey = null;
                                resolveInitial(occupiedFromSnapshot);
                            } else {
                                updateOccupiedAndRefreshButtons(day, date, eventType, timesWrap)
                                    .catch(error => console.warn('[Horários] Falha ao atualizar vagas:', error?.code || 'erro'));
                            }
                        },
                        (error) => {
                            if (window.__schedListenerKey !== cacheKey) return;
                            console.warn('[Horários] Não foi possível carregar as inscrições:', error?.code || 'erro');
                            const resolveInitial = window.__schedResolveInitialOccupied;
                            window.__schedResolveInitialOccupied = null;
                            window.__schedInitialOccupiedPromise = null;
                            window.__schedInitialOccupiedKey = null;
                            window.__schedUnsub = null;
                            window.__schedListenerKey = null;
                            delete scheduleCache[cacheKey];
                            if (resolveInitial) resolveInitial(null);
                            if (document.getElementById('schedDate')?.value === date) {
                                timesWrap.innerHTML = '<div class="text-center py-4 text-red-600 text-sm">Não foi possível verificar as vagas agora. Tente novamente.<br><button type="button" class="mt-2 underline font-semibold" onclick="renderScheduleTimes()">Tentar novamente</button></div>';
                            }
                        }
                    );
                });
                initialOccupiedPromise = window.__schedInitialOccupiedPromise;
            }
        }

        const [_initOvSnap, _initHlHours, _initOccupied] = await Promise.all([
            getDocs(query(collection(window.firebaseDb, 'schedule_overrides'), where('date', '==', date))).catch(() => null),
            _initHlPromise,
            initialOccupiedPromise
        ]);
        if (renderGeneration !== window.__schedRenderGeneration) return;
        if (_initOccupied === null) {
            timesWrap.innerHTML = '<div class="text-center py-4 text-red-600 text-sm">Não foi possível verificar as vagas agora. Tente novamente.<br><button type="button" class="mt-2 underline font-semibold" onclick="renderScheduleTimes()">Tentar novamente</button></div>';
            return;
        }

        occupied = { ...(scheduleCache[cacheKey] || _initOccupied) };
        lockedHours = new Set(_initHlHours);
        if (_initOvSnap) {
            _initOvSnap.forEach(doc => {
                const ov = doc.data();
                if (ov.date !== date) return;
                const _ovHourM = String(ov.hour || ov.hh || '').match(/^(\d{1,2})/);
                const ovHour = _ovHourM ? parseInt(_ovHourM[1], 10) : NaN;
                if (isNaN(ovHour)) return;
                const ovEv = ov.eventType || null;
                const match = !ovEv || !eventType || ovEv === eventType || normalizeEventType(ovEv) === normalizeEventType(eventType);
                if (!match) return;
                if (ov.locked === true) lockedHours.add(ovHour);
                const extraOccupied = Number(ov.extraOccupied || 0);
                if (extraOccupied > 0) {
                    const key = `${day} - ${ovHour}h`;
                    occupied[key] = (occupied[key] || 0) + extraOccupied;
                }
                if (ov.freeUntil) {
                    const ft = new Date(ov.freeUntil).getTime();
                    if (ft > Date.now()) window._freeHoursMap[date][ovHour] = ov.freeUntil;
                }
            });
        }

    } catch(error) {
        console.warn('[Horários] Não foi possível carregar os horários:', error?.code || 'erro');
        if (renderGeneration === window.__schedRenderGeneration
            && document.getElementById('schedDate')?.value === date) {
            stopScheduleAvailabilityListener();
            timesWrap.innerHTML = '<div class="text-center py-4 text-red-600 text-sm">Não foi possível verificar as vagas agora. Tente novamente.<br><button type="button" class="mt-2 underline font-semibold" onclick="renderScheduleTimes()">Tentar novamente</button></div>';
        }
        return;
    }

    // ── Renderizar horários em uma única passagem (sem flash) ───────────────
    const eventConfig = getActiveScheduleConfig(eventType);
    const isModoLiga = [eventType, eventConfig.eventType, eventConfig.label, eventConfig.modo]
        .some(value => normalizeEventType(value) === 'modo-liga');
    const slots = [
        ...(isModoLiga ? [{ value: '0h', label: '00h00' }] : []),
        ...['14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h']
            .map(value => ({ value, label: value }))
    ];
    timesWrap.innerHTML = '';
    let hasVisibleSlot = false;

    for (const slot of slots) {
        const time = slot.value;
        const displayTime = slot.label;
        const schedule = `${day} - ${time}`;
        const hour = parseInt(time.replace('h', ''));
        const capacity = (cfg.vagas > 0 ? cfg.vagas : null) || getEventCapacity(eventType, time, date);

        // Horário já passou (hoje) — ocultar
        if (isToday) {
            const eventTime = new Date(selectedDate);
            eventTime.setHours(hour, 0, 0, 0);
            if ((eventTime - now) / (1000 * 60) < 0) continue;
        }

        // Horário travado pelo admin — ocultar
        if (lockedHours.has(hour)) continue;

        const taken = Math.min(occupied[schedule] || 0, capacity);
        const available = Math.max(0, capacity - taken);

        // Lotado — ocultar
        if (available === 0) continue;

        const btn = document.createElement('button');
        btn.className = 'slot-btn';
        btn.dataset.schedule = schedule;

        // Menos de 6 min para o horário (hoje) — mostrar desabilitado
        if (isToday) {
            const eventTime = new Date(selectedDate);
            eventTime.setHours(hour, 0, 0, 0);
            const mins = (eventTime - now) / (1000 * 60);
            if (mins < 6) {
                btn.className = 'slot-btn bg-gray-300 text-gray-500 cursor-not-allowed';
                btn.disabled = true;
                btn.innerHTML = `<span class="font-semibold">${displayTime}</span><span class="block text-xs opacity-75 mt-0.5">Disponível em ${Math.ceil(mins)} min • ${taken}/${capacity}</span>`;
                btn.onclick = null;
                timesWrap.appendChild(btn);
                hasVisibleSlot = true;
                continue;
            }
        }

        // Verificar se este horário está liberado gratuitamente
        const _freeMap = (window._freeHoursMap || {})[date] || {};
        const _isFreeHour = !!_freeMap[hour];

        // Horário disponível — mostrar com vagas e barra de progresso
        const _pct = capacity > 0 ? Math.round((taken / capacity) * 100) : 0;
        if (_isFreeHour) {
            btn.innerHTML = `<span class="font-semibold">${displayTime}</span><span class="block text-xs font-bold mt-0.5" style="color:#16a34a">🆓 GRATUITO</span>`;
            btn.dataset.freeSlot = 'true';
        } else {
            btn.innerHTML = `<span class="font-semibold">${displayTime}</span><span class="block text-xs opacity-75 mt-0.5">✅ VAGA DISPONÍVEL</span>`;
        }
        btn.onclick = () => { selectTime(schedule, btn); };
        if (isTimeSelected(date, schedule)) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
        }
        timesWrap.appendChild(btn);
        hasVisibleSlot = true;
    }

    if (!hasVisibleSlot) {
        timesWrap.innerHTML = '<p class="text-center py-4 text-gray-500 text-sm">Nenhum horário disponível para esta data.</p>';
    }
}
function highlightSelectedSlot(selectedBtn, container) {
    Array.from(container.children).forEach(el => el.classList.remove('selected'));
    selectedBtn.classList.add('selected');
}
async function fetchOccupiedForDate(day, date, eventType) {
    const map = {};
    try {
        if (!window.firebaseReady) return map;
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const regsRef = collection(window.firebaseDb, 'registrations');
        // Restringir a leitura à data escolhida. Sem o filtro de data, cada abertura
        // relia todo o histórico do evento.
        const validStatuses = new Set(['paid', 'confirmed', 'approved', 'lisagem_gratis']);
        const registrationFilters = [where('date', '==', date)];
        if (eventType) registrationFilters.push(where('eventType', '==', eventType));
        const q = query(regsRef, ...registrationFilters);
        const snap = await getDocs(q);
        const parseHourFromRecord = (r) => {
            // Try multiple fields that may contain hour info
            const candidates = [];
            if (r == null) return null;
            const pushIf = (v) => { if (v !== undefined && v !== null) candidates.push(String(v)); };
            pushIf(r.schedule);
            pushIf(r.hour);
            pushIf(r.time);
            pushIf(r.selectedTime);
            pushIf(r.slot);
            pushIf(r.scheduledTime);
            pushIf(r.hourString);

            for (const raw of candidates) {
                if (!raw) continue;
                // Examples: 'Segunda - 19h', '19:00', '19h', '19', 'Seg - 19h (algum texto)'
                // Try patterns in order
                const m1 = raw.match(/(\d{1,2})\s*h/); // 19h
                if (m1) return parseInt(m1[1], 10);
                const m2 = raw.match(/(\d{1,2})\s*:\s*\d{2}/); // 19:00
                if (m2) return parseInt(m2[1], 10);
                const m3 = raw.match(/\b(\d{1,2})\b/); // any standalone number
                if (m3) return parseInt(m3[1], 10);
            }
            return null;
        };

        const normalizeToScheduleKey = (r) => {
            const hh = parseHourFromRecord(r);
            if (hh == null || Number.isNaN(hh)) return null;
            const hourStr = `${hh}h`;
            return `${day} - ${hourStr}`;
        };
        snap.forEach(doc => {
            const r = doc.data();
            if (!validStatuses.has(r.status)) return; // filtrar status em JS
            if (r.date !== date || (eventType && r.eventType !== eventType)) return;
            const key = normalizeToScheduleKey(r);
            if (!key) return;
            map[key] = (map[key] || 0) + 1;
        });
        // Aplicar travas manuais (schedule_overrides): se locked, marcar como lotado; se extraOccupied, somar
        try {
            const { collection: col2, query: q2, where: w2, getDocs: get2 } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const overridesRef = col2(window.firebaseDb, 'schedule_overrides');

            // CRÍTICO: Garantir que a data está normalizada (YYYY-MM-DD)
            const normalizedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
            if (!normalizedDate) {
                
                return map;
            }

            // Buscar APENAS overrides da data específica (normalizada)
            const allOverrides = await get2(q2(overridesRef, w2('date', '==', normalizedDate)));

            allOverrides.forEach(doc => {
                const ov = doc.data();

                // VALIDAÇÃO CRÍTICA: Garantir que o override é realmente para esta data
                const ovDate = ov.date || '';
                if (ovDate !== normalizedDate) {
                    
                    return; // Ignorar override de data diferente
                }

                const _hnM = String(ov.hour || ov.hh || '').match(/^(\d{1,2})/);
                const hourNum = _hnM ? parseInt(_hnM[1], 10) : NaN;
                if (Number.isNaN(hourNum)) return;

                const key = `${day} - ${hourNum}h`;
                const ovEventType = ov.eventType || null;
                const shouldApply = !ovEventType || !eventType ||
                    ovEventType === eventType ||
                    normalizeEventType(ovEventType) === normalizeEventType(eventType);

                if (shouldApply) {
                    if (ov.extraOccupied) {
                        map[key] = (map[key] || 0) + Number(ov.extraOccupied || 0);
                    }
                    if (ov.locked) {
                        // Horário travado pelo admin: usar capacidade do tipo para forçar lotado
                        const cap = getEventCapacity(eventType, `${hourNum}h`, normalizedDate);
                        map[key] = cap;
                        
                    }
                }
            });
        } catch (err) {
            
        }
    } catch (_) { }
    return map;
}

// Verifica disponibilidade por horário (capacidade por tipo de evento)
async function checkSlotAvailability(date, schedule, eventType) {
    try {
        if (!window.firebaseReady) return false;
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const regsRef = collection(window.firebaseDb, 'registrations');
        // Limitar a busca ao dia e evento consultados, não ao histórico inteiro do evento.
        const validStatuses2 = new Set(['paid', 'confirmed', 'approved']);
        const registrationFilters = [where('date', '==', date)];
        if (eventType) registrationFilters.push(where('eventType', '==', eventType));
        const q = query(regsRef, ...registrationFilters);
        const snap = await getDocs(q);
        // Normalizar para comparar por hora
        const wantedHour = parseInt(String(schedule).match(/(\d{1,2})\s*h/)?.[1] || 'NaN', 10);
        let occupied = 0;
        snap.forEach(d => {
            const r = d.data();
            if (!validStatuses2.has(r.status)) return; // filtrar status em JS
            if (r.date !== date || (eventType && r.eventType !== eventType)) return;
            const rawSchedule = String(r.schedule || '');
            const rawHour = String(r.hour || '');
            let hh = rawSchedule.match(/(\d{1,2})\s*h/)?.[1]
                || rawSchedule.match(/(\d{1,2})\s*:/)?.[1]
                || rawHour.match(/(\d{1,2})/)?.[1];
            hh = parseInt(hh || 'NaN', 10);
            if (!Number.isNaN(hh) && hh === wantedHour) occupied++;
        });
        // Considerar overrides (horários travados pelo admin)
        try {
            const { collection: c2, query: q2, where: w2, getDocs: g2 } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ovRef = c2(window.firebaseDb, 'schedule_overrides');

            // CRÍTICO: Garantir que a data está normalizada (YYYY-MM-DD)
            const normalizedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
            if (!normalizedDate) {
                
                return occupied < getEventCapacity(eventType, `${wantedHour}h`, date);
            }

            // Buscar APENAS overrides da data específica (normalizada)
            const ovSnap = await g2(q2(ovRef, w2('date', '==', normalizedDate)));

            ovSnap.forEach(doc => {
                const ov = doc.data();

                // VALIDAÇÃO CRÍTICA: Garantir que o override é realmente para esta data
                const ovDate = ov.date || '';
                if (ovDate !== normalizedDate) {
                    
                    return; // Ignorar override de data diferente
                }

                const _ohM = String(ov.hour || ov.hh || '').match(/^(\d{1,2})/);
                const ovHour = _ohM ? parseInt(_ohM[1], 10) : NaN;

                // Verificar se é o horário que queremos
                if (ovHour === wantedHour) {
                    const ovEventType = ov.eventType || null;

                    // Aplicar override se:
                    // 1. Não tem eventType (genérico) OU
                    // 2. O eventType do override corresponde ao eventType do evento OU
                    // 3. Não temos eventType na verificação
                    // 4. Tipos canônicos batem (normalização para retrocompat)
                    const shouldApply = !ovEventType || !eventType ||
                        ovEventType === eventType ||
                        normalizeEventType(ovEventType) === normalizeEventType(eventType);

                    if (shouldApply) {
                        if (ov.locked) {
                            // Horário travado pelo admin: marcar como lotado (capacidade total)
                            occupied = getEventCapacity(eventType, `${wantedHour}h`, normalizedDate);
                            
                        }
                        if (ov.extraOccupied) {
                            occupied += Number(ov.extraOccupied || 0);
                        }
                    }
                }
            });
        } catch (err) {
            throw err;
        }
        const capacity = getEventCapacity(eventType, `${wantedHour}h`, date);
        // Não permitir compra se ocupado >= capacidade (não pode ultrapassar)
        return occupied < capacity;
    } catch (_) { return false; }
}

// Verifica disponibilidade para múltiplos horários e times
async function checkMultipleSlotAvailability(date, selectedTimes, eventType, numberOfTeams) {
  const unavailable = () => ({
    available: false,
    reason: 'verification_failed',
    message: 'Não foi possível confirmar as vagas agora. Nenhuma cobrança foi iniciada. Tente novamente.'
  });
  try {
    if (!date || !eventType || !Array.isArray(selectedTimes) || selectedTimes.length === 0) {
      return unavailable();
    }

    // Normalização defensiva da data
    const normalizedDate =
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;

    if (!normalizedDate) {
      
      return unavailable();
    }

    // Verificação no servidor, antes de criar reservas ou iniciar qualquer cobrança.
    const _ctrl = new AbortController();
    const _tid = setTimeout(() => _ctrl.abort(), 15000);
    let response;
    try {
      response = await authenticatedPaymentFetch('/.netlify/functions/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: normalizedDate,
          selectedTimes,
          eventType: eventType || null,
          numberOfTeams: Number(numberOfTeams || 1)
        }),
        signal: _ctrl.signal
      });
    } finally {
      clearTimeout(_tid);
    }

    if (!response.ok) {
      if (response.status === 400) {
        const failure = await response.json().catch(() => null);
        if (typeof failure?.message === 'string' && failure.message.trim()) {
          return { available: false, message: failure.message };
        }
      }
      return unavailable();
    }

    const result = await response.json();

    // Garantia mínima de contrato
    if (typeof result !== 'object' || result === null || typeof result.available !== 'boolean') {
      
      return unavailable();
    }

    return result;

  } catch (error) {
    // Sem confirmação válida, não liberar a compra.
    

    try {
      logError(
        typeof error?.message === 'string' ? error.message : 'CHECK_AVAILABILITY_ERROR',
        'EVENT_004'
      );
    } catch (_) {
      // logging não pode quebrar fluxo
    }

    return unavailable();
  }
}


async function updateOccupiedAndRefreshButtons(day, date, eventType, container) {
    const normalizedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    if (!normalizedDate) return;

    const cacheKey = `${normalizedDate}__${eventType || 'all'}`;
    const lastDate = window.__lastScheduleDate || null;
    if (lastDate !== normalizedDate) {
        Object.keys(scheduleCache).forEach(key => {
            if (!key.startsWith(`${normalizedDate}__`)) delete scheduleCache[key];
        });
        window.__lastScheduleDate = normalizedDate;
    }

    // ── Disparar as 3 queries em PARALELO ────────────────────────────────────
    const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

    const _occupiedPromise = scheduleCache[cacheKey]
        ? Promise.resolve(scheduleCache[cacheKey])
        : fetchOccupiedForDate(day, normalizedDate, eventType).catch(() => ({}));

    const _ovPromise = getDocs(query(
        collection(window.firebaseDb, 'schedule_overrides'),
        where('date', '==', normalizedDate)
    )).catch(() => null);

    // event_hour_locks: cache global de 2 min (não muda com frequência)
    const _hlCacheKey = `__hlCache_${eventType || 'all'}`;
    const _hlCache = window[_hlCacheKey];
    const _hlPromise = (_hlCache && Date.now() - _hlCache.ts < 120000)
        ? Promise.resolve(_hlCache.hours)
        : getDocs(collection(window.firebaseDb, 'event_hour_locks')).then(snap => {
            const hours = new Set();
            snap.forEach(doc => {
                const data = doc.data();
                if (data.locked !== true) return;
                const docEv = (data.eventType || '').toLowerCase().replace(/[\s_]/g, '-');
                const curEv = (eventType || '').toLowerCase().replace(/[\s_]/g, '-');
                const match = !data.eventType || docEv === curEv || doc.id.startsWith(curEv) || doc.id.startsWith(eventType || '');
                if (!match) return;
                const h = parseInt(String(data.hour || ''), 10);
                if (!isNaN(h) && h >= 0 && h <= 23) hours.add(h);
            });
            window[_hlCacheKey] = { hours, ts: Date.now() };
            return hours;
        }).catch(() => new Set());

    const [registrationCounts, ovSnap, hlHours] = await Promise.all([_occupiedPromise, _ovPromise, _hlPromise]);
    if (window.__schedListenerKey !== cacheKey || document.getElementById('schedDate')?.value !== date) return;
    if (!scheduleCache[cacheKey]) scheduleCache[cacheKey] = registrationCounts;
    const occupied = { ...scheduleCache[cacheKey] };

    // Processar schedule_overrides
    const lockedHours = new Set(hlHours);
    window._freeHoursMap = window._freeHoursMap || {};
    window._freeHoursMap[normalizedDate] = window._freeHoursMap[normalizedDate] || {};
    if (ovSnap) {
        ovSnap.forEach(doc => {
            const ov = doc.data();
            if ((ov.date || '') !== normalizedDate) return;
            const _m = String(ov.hour || ov.hh || '').match(/^(\d{1,2})/);
            const ovHour = _m ? parseInt(_m[1], 10) : NaN;
            if (isNaN(ovHour)) return;
            const ovEv = ov.eventType || null;
            const match = !ovEv || !eventType || ovEv === eventType || normalizeEventType(ovEv) === normalizeEventType(eventType);
            if (!match) return;
            if (ov.locked === true) lockedHours.add(ovHour);
            const extraOccupied = Number(ov.extraOccupied || 0);
            if (extraOccupied > 0) {
                const key = `${day} - ${ovHour}h`;
                occupied[key] = (occupied[key] || 0) + extraOccupied;
            }
            if (ov.freeUntil) {
                const _ft = new Date(ov.freeUntil).getTime();
                if (_ft > Date.now()) {
                    window._freeHoursMap[normalizedDate][ovHour] = ov.freeUntil;
                } else {
                    delete window._freeHoursMap[normalizedDate][ovHour];
                }
            }
        });
    }

    const now = new Date();
    const selectedDate = new Date(date + 'T00:00:00');
    const isToday = selectedDate.toDateString() === now.toDateString();

    Array.from(container.children).forEach(btn => {
        const schedule = btn.dataset.schedule;
        if (!schedule) return; // Ignorar elementos que não são slots (ex: mensagem "Nenhum horário")
        const time = (schedule || '').split(' - ')[1] || '';
        const hour = parseInt(time.replace('h', ''));
        const displayTime = hour === 0 ? '00h00' : time;
        const capacity = (scheduleConfig[eventType]?.vagas > 0 ? scheduleConfig[eventType].vagas : null) || getEventCapacity(eventType, time);

        // Verificar se o horário está travado (prioridade máxima)
        const isLocked = lockedHours.has(hour);

        // Se estiver travado, forçar como lotado (taken = capacity)
        // Isso faz aparecer como (15/15) ou (capacidade/capacidade)
        const taken = isLocked ? capacity : (occupied[schedule] || 0);
        // Garantir que taken não ultrapasse a capacidade
        const takenClamped = Math.min(taken, capacity);
        const available = Math.max(0, capacity - takenClamped);

        // Verificar se o horário já está disponível (12 minutos antes do horário)
        let isTimeAvailable = true;
        let timeMessage = '';
        if (isToday) {
            const eventTime = new Date(selectedDate);
            eventTime.setHours(hour, 0, 0, 0);

            const minutesUntilEvent = (eventTime - now) / (1000 * 60); // minutos até o evento

            if (minutesUntilEvent < 0) {
                // Horário já passou
                isTimeAvailable = false;
                timeMessage = 'Horário passou';
            } else if (minutesUntilEvent < 6) {
                // Ainda não passaram 6 minutos antes do horário
                isTimeAvailable = false;
                const minutesLeft = Math.ceil(minutesUntilEvent);
                timeMessage = `Disponível em ${minutesLeft} min`;
            }
        }

        // Verificar travamento primeiro (prioridade máxima)
        if (isLocked) {
            // Horário travado pelo admin - OCULTAR
            btn.style.display = 'none';
        } else if (available === 0) {
            // Horário lotado - OCULTAR
            btn.style.display = 'none';
        } else if (!isTimeAvailable && timeMessage === 'Horário passou') {
            // Horário já passou - OCULTAR
            btn.style.display = 'none';
        } else if (!isTimeAvailable) {
            // Menos de 12 min para o horário — mostrar desabilitado
            btn.className = 'slot-btn bg-gray-300 text-gray-500 cursor-not-allowed';
            btn.disabled = true;
            btn.innerHTML = `<span class="font-semibold">${displayTime}</span><span class="block text-xs opacity-75 mt-0.5">${timeMessage} • ${taken}/${capacity}</span>`;
            btn.onclick = null;
            btn.style.display = 'block'; // Garantir que está visível
        } else {
            // Horário disponível - mostrar vagas e % preenchido
            btn.className = 'slot-btn';
            btn.disabled = false;
            const _freeMapR = (window._freeHoursMap || {})[normalizedDate] || {};
            const _isFreeHourR = !!_freeMapR[hour];
            if (_isFreeHourR) {
                btn.innerHTML = `<span class="font-semibold">${displayTime}</span><span class="block text-xs font-bold mt-0.5" style="color:#16a34a">🆓 GRATUITO</span>`;
                btn.dataset.freeSlot = 'true';
            } else {
                btn.innerHTML = `<span class="font-semibold">${displayTime}</span><span class="block text-xs opacity-75 mt-0.5">✅ VAGA DISPONÍVEL</span>`;
                btn.dataset.freeSlot = '';
            }
            btn.onclick = () => {
                selectTime(schedule, btn);
            };
            btn.style.display = 'block'; // Garantir que está visível
            // Destaque se já estiver selecionado para esta data
            if (isTimeSelected(date, schedule)) {
                btn.classList.add('bg-blue-600', 'text-white');
                btn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
            }
        }       
    });
}

// Function to add a new team
function addTeam() {
    teamCounter++;
    const teamId = `team_${teamCounter}`;
    const teamData = { id: teamId, name: '', email: '', phone: '', logoBase64: null };
    teams.push(teamData);

    const container = document.getElementById('teamsContainer');
    const teamDiv = document.createElement('div');
    teamDiv.id = teamId;
    teamDiv.className = 'bg-gray-50 rounded-xl border border-gray-200 overflow-hidden';
    teamDiv.innerHTML = `
        ${teamCounter > 1 ? `
        <div class="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
            <span class="text-xs font-bold text-gray-600">Time ${teamCounter}</span>
            <button type="button" onclick="removeTeam('${teamId}')" class="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 transition-colors">
                <i class="fas fa-times"></i> Remover
            </button>
        </div>` : ''}
        <div class="p-4">
            <!-- Logo + Nome lado a lado -->
            <div class="flex items-start gap-3 mb-3">
                <label for="teamLogoInput_${teamId}" class="cursor-pointer flex-shrink-0 group" title="Clique para enviar a logo do time">
                    <div id="teamLogoPreview_${teamId}" class="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-purple-300 flex flex-col items-center justify-center overflow-hidden hover:border-purple-500 transition-colors group-hover:bg-purple-50">
                        <i class="fas fa-camera text-purple-300 text-lg group-hover:text-purple-500 transition-colors"></i>
                        <span class="text-xs text-purple-300 group-hover:text-purple-500 mt-0.5 font-medium transition-colors">Logo</span>
                    </div>
                    <input type="file" id="teamLogoInput_${teamId}" accept="image/*" class="hidden" onchange="previewTeamLogo('${teamId}', this)">
                    <p class="text-center text-xs text-gray-400 mt-1">Opcional</p>
                </label>
                <div class="flex-1 space-y-2">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block uppercase tracking-wide">NOME DO TIME <span class="text-red-500">*</span></label>
                        <input type="text" data-field="name" placeholder="Ex: Team Freitas, xGamer123…"
                               class="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:border-purple-400 focus:outline-none transition-colors"
                               oninput="updateTeam('${teamId}', 'name', this.value)">
                    </div>
                </div>
            </div>
            <!-- Email + WhatsApp -->
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block uppercase tracking-wide">E-mail <span class="text-red-500">*</span></label>
                    <input type="email" data-field="email" placeholder="seu@email.com"
                           class="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-purple-400 focus:outline-none transition-colors"
                           oninput="updateTeam('${teamId}', 'email', this.value)">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block uppercase tracking-wide">WhatsApp <span class="text-red-500">*</span></label>
                    <input type="tel" data-field="phone" placeholder="(11) 99999-9999"
                           class="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-purple-400 focus:outline-none transition-colors"
                           oninput="updateTeam('${teamId}', 'phone', this.value)">
                </div>
            </div>
        </div>
    `;
    container.appendChild(teamDiv);
    updateReservationsSummary();
}

function previewTeamLogo(teamId, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        alert('A logo deve ter no máximo 2 MB.');
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById(`teamLogoPreview_${teamId}`);
        if (preview) preview.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
        updateTeam(teamId, 'logoBase64', e.target.result);
    };
    reader.readAsDataURL(file);
}

// Redimensiona base64 data URL para thumbnail 128px JPEG — salvo no Firestore como fallback
async function _resizeLogoBase64(dataUrl, size = 128) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
            ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

async function uploadTeamLogo(base64DataUrl, teamName, eventType) {
    if (!base64DataUrl || !window.firebaseStorage) return null;
    try {
        const { ref, uploadString, getDownloadURL } = await import(
            'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js'
        );
        const sanitizedName = (teamName || 'time').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
        const path = `teams/${eventType}/logos/${sanitizedName}_${Date.now()}`;
        const storageRef = ref(window.firebaseStorage, path);
        await uploadString(storageRef, base64DataUrl, 'data_url');
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (err) {
        console.warn('[uploadTeamLogo] falha no upload, logo não salva:', err?.message);
        return null;
    }
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

async function updateReservationsSummary() {
    const summaryContainer = document.getElementById('reservationsSummary');
    const totalPriceElement = document.getElementById('totalPrice');

    if (selectedTimes.length === 0 || teams.length === 0) {
        summaryContainer.innerHTML = '<p class="text-gray-600">Nenhuma reserva selecionada</p>';
        totalPriceElement.textContent = 'R$ 0,00';
        scheduleOriginalTotal = 0;
        appliedScheduleCoupon = null;
        updateScheduleCouponUI();
        return;
    }

    const modal = document.getElementById('scheduleModal');
    const eventType = modal?.dataset?.eventType || 'modo-liga';
    const cfg = getActiveScheduleConfig(eventType);

    // Agrupa horários por data
    const timesByDate = {};
    selectedTimes.forEach(item => {
        if (!timesByDate[item.date]) timesByDate[item.date] = [];
        timesByDate[item.date].push(item.schedule);
    });

    // Determina quais datas usar (selecionadas ou a data atual)
    const datesToUse = (selectedDates && selectedDates.length > 0)
        ? [...selectedDates]
        : [document.getElementById('schedDate')?.value].filter(Boolean);

    let summaryHTML = '';
    let computedTotal = 0;
    let availabilityWarning = '';

    // O resumo usa o snapshot já aberto, sem consultar o servidor a cada alteração
    // dos dados do time. A confirmação definitiva é feita ao enviar a reserva.
    if (eventType) {
            for (const d of datesToUse) {
                const times = timesByDate[d] || [];
                if (times.length === 0) continue;
                const occupied = scheduleCache[`${d}__${eventType}`];
                const insufficient = occupied && times.some(schedule => {
                    const hour = (schedule.split(' - ')[1] || '').trim();
                    const capacity = Number(cfg?.vagas) > 0 ? Number(cfg.vagas) : getEventCapacity(eventType, hour, d);
                    return (occupied[schedule] || 0) + teams.length > capacity;
                });
                if (insufficient) {
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
    }

    // Monta resumo e calcula total
    for (const d of datesToUse) {
        const times = timesByDate[d] || [];
        if (times.length === 0) continue;

        for (const schedule of times) {
            const hour = (schedule.split(' - ')[1] || '').trim();
            const pricePerReservation = getEventPrice(eventType, hour, d);
            const lineTotal = pricePerReservation * teams.length;
            computedTotal += lineTotal;

            const formattedDate = new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
            const displaySchedule = schedule.replace(/ - 0h$/, ' - 00h00');
            summaryHTML += `<div class="flex justify-between items-center py-1">
                <span class="text-gray-700">${displaySchedule} (${formattedDate}) × ${teams.length} time(s)</span>
                <span class="font-semibold">R$ ${(pricePerReservation * teams.length).toFixed(2)}</span>
            </div>`;
        }
    }

    summaryContainer.innerHTML = availabilityWarning + summaryHTML;

    scheduleOriginalTotal = Number(computedTotal || 0);
    totalPriceElement.textContent = `R$ ${scheduleOriginalTotal.toFixed(2)}`;

    if (appliedScheduleCoupon) {
        updateSchedulePriceWithCoupon();
    }
}

function isTimeSelected(date, schedule) {
    return selectedTimes.some(item => item.date === date && item.schedule === schedule);
}
function selectTime(schedule, element) {
    const date = document.getElementById('schedDate').value;
    const index = selectedTimes.findIndex(item => item.date === date && item.schedule === schedule);

    if (index !== -1) {
        // Remove
        selectedTimes.splice(index, 1);
        element.classList.remove('bg-blue-600', 'text-white');
        element.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
    } else {
        // Adiciona
        selectedTimes.push({ date, schedule });
        element.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
        element.classList.add('bg-blue-600', 'text-white');
    }

    // Atualiza campos ocultos (opcional)
    const hiddenField = document.getElementById('schedSelectedTime');
    const displayField = document.getElementById('schedSelectedTimeDisplay');
    if (hiddenField) hiddenField.value = schedule;
    if (displayField) {
        // Mostrar TODOS os horários selecionados, não apenas o último
        if (selectedTimes.length === 0) {
            displayField.textContent = '—';
        } else {
            const horasExibidas = selectedTimes
                .map(item => {
                    const hour = item.schedule.split(' - ')[1] || item.schedule;
                    return parseInt(hour, 10) === 0 ? '00h00' : hour;
                })
                .join(', ');
            displayField.textContent = horasExibidas;
        }
    }

    updateReservationsSummary();

    // Atualiza o preço exibido nos detalhes do evento
    try {
        const modal = document.getElementById('scheduleModal');
        const eventType = modal?.dataset?.eventType || '';
        const dateStr = document.getElementById('schedDate')?.value || null;
        const priceEl = document.getElementById('schedPrice');
        if (priceEl) {
            const timesForCurrentDate = selectedTimes.filter(item => item.date === dateStr).map(item => item.schedule);
            if (timesForCurrentDate.length === 1) {
                const hour = (timesForCurrentDate[0].split(' - ')[1] || '').trim();
                const p = getEventPrice(eventType, hour, dateStr);
                priceEl.textContent = p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else if (timesForCurrentDate.length === 0) {
                const cfg = scheduleConfig[eventType] || {};
                priceEl.textContent = Number(cfg.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                let min = Infinity;
                for (const t of timesForCurrentDate) {
                    const h = (t.split(' - ')[1] || '').trim();
                    const p = getEventPrice(eventType, h, dateStr);
                    if (p < min) min = p;
                }
                if (Number.isFinite(min)) {
                    priceEl.textContent = min.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }
            }
        }
    } catch (_) { }

    // Atualizar botões de pagamento se houver slot free selecionado
    _updateFreeSlotPaymentUI();
}

// Atualiza os botões do passo 4 ao selecionar/deselecionar slot free liberado pelo admin
function _updateFreeSlotPaymentUI() {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;
    const eventType = modal.dataset?.eventType || '';
    const cfg = scheduleConfig[eventType] || {};
    const isFreeEvent = (cfg.price === 0 || cfg.isFree === true) && !cfg.isProduct;
    const payTokensBtn = document.getElementById('schedPayTokens');
    const submitBtn    = document.getElementById('schedSubmit');
    const pixSubmitBtn = document.getElementById('schedPixSubmit');
    if (isFreeEvent) {
        if (pixSubmitBtn) pixSubmitBtn.style.display = 'none';
        return;
    }
    if (pixSubmitBtn) pixSubmitBtn.style.display = '';
    if (!payTokensBtn || !submitBtn) return;

    // Verificar se algum horário selecionado é slot liberado manualmente pelo admin
    const anyFreeSelected = selectedTimes.some(item => {
        const freeMap = (window._freeHoursMap || {})[item.date] || {};
        const m = (item.schedule || '').match(/(\d{1,2})h/);
        const hh = m ? String(parseInt(m[1], 10)).padStart(2, '0') : null;
        return hh ? (freeMap[hh] != null) : false;
    });

    if (anyFreeSelected) {
        const basePrice = cfg.price || 0;
        // Total real: todos os slots selecionados ao preço integral (slots grátis também contam se pagar)
        const teamCount = Math.max(1, document.querySelectorAll('#teamsContainer > div').length || 1);
        const totalPagar = basePrice * selectedTimes.length * teamCount;
        const priceLabel = totalPagar > 0 ? `R$${totalPagar.toFixed(2).replace('.', ',')}` : '';

        // Botão "Jogar Grátis" (ocupa lugar do botão de tokens)
        payTokensBtn.className = 'w-full bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 py-3 px-4 rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2';
        payTokensBtn.style.background = '';
        payTokensBtn.innerHTML = '🆓 Jogar Grátis';
        payTokensBtn.style.display = '';
        payTokensBtn.onclick = (e) => {
            e.preventDefault();
            window._freeSlotChoice = 'gratis';
            document.getElementById('schedSubmit')?.click();
        };

        // Botão "Pagar e Concorrer"
        submitBtn.style.background = 'linear-gradient(135deg,#07b7b4,#059669)';
        submitBtn.className = 'w-full text-white py-3.5 px-4 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg';
        submitBtn.innerHTML = `🏆 ${priceLabel ? `Pagar ${priceLabel} e ` : ''}Concorrer à Premiação`;
        submitBtn.onclick = () => { if (!window._freeSlotChoice) window._freeSlotChoice = 'pagar'; };
        if (pixSubmitBtn) {
            pixSubmitBtn.innerHTML = `🏆 ${priceLabel ? `Pagar ${priceLabel} e ` : ''}Concorrer com Pix`;
            pixSubmitBtn.onclick = () => { window._freeSlotChoice = 'pagar'; };
        }
    } else {
        // Restaurar botões originais
        payTokensBtn.className = 'w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-yellow-900 py-3 px-4 rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2';
        payTokensBtn.style.background = '';
        payTokensBtn.innerHTML = '💎 Pagar com Tokens da Plataforma';
        payTokensBtn.onclick = () => payScheduleWithTokens();

        submitBtn.className = 'w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3.5 px-4 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg';
        submitBtn.style.background = '';
        submitBtn.innerHTML = '<i class="fas fa-lock text-xs"></i> Cartão e outros (Mercado Pago)';
        submitBtn.onclick = null;
        if (pixSubmitBtn) {
            pixSubmitBtn.innerHTML = '<i class="fas fa-qrcode text-xs"></i> Gerar Pix e pagar neste site';
            pixSubmitBtn.onclick = null;
        }
        window._freeSlotChoice = null;
    }
}

// Função para lidar com compra de produtos da loja
// Armazena falhas de checkout para diagnóstico (pode ser copiado pelo usuário)
function storeCheckoutFailure(info) {
    try {
        const existing = JSON.parse(sessionStorage.getItem('lastCheckoutFailure') || 'null');
        const out = { timestamp: Date.now(), ...info };
        // manter apenas o último registro
        sessionStorage.setItem('lastCheckoutFailure', JSON.stringify(out));
        
    } catch (e) {  }
}

// Helper to wrap fetch with timeout
async function fetchWithTimeout(url, opts = {}, ms = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    opts.signal = controller.signal;
    try {
        const r = await fetch(url, opts);
        clearTimeout(id);
        return r;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

// End helpers
async function handleProductPurchase(productId, cfg, paymentMethod = 'mercadopago') {
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
            if (platform === 'android') {
                const brand = document.getElementById('androidBrandSelect').value;
                if (!brand) {
                    alert('Por favor, selecione a marca do seu dispositivo Android.');
                    return;
                }
                productOptions.brand = brand;
            }
        } else if ((window.scheduleConfig?.[productId]?.category || '').toLowerCase() === 'sensibilidade') {
            // Produto de sensibilidade criado pelo admin via Firestore
            const platform = document.getElementById('platformSelect')?.value || '';
            if (!platform) { alert('Por favor, selecione uma plataforma.'); return; }
            productOptions.platform = platform;
            if (platform === 'android') {
                const brand = document.getElementById('androidBrandSelect')?.value || '';
                if (!brand) { alert('Por favor, selecione a marca do celular.'); return; }
                productOptions.brand = brand;
            }
            // Selecionar o link correspondente para entregar automaticamente
            const dlLinks = window.scheduleConfig[productId].downloadLinks || {};
            const linkKey = platform === 'android' ? (productOptions.brand || '') : platform;
            finalPrice = cfg.price;
            productOptions.downloadLink = dlLinks[linkKey] || dlLinks[platform] || '';
        } else if (productId === 'imagens') {
            const selected = Array.from(document.querySelectorAll('input[name="mapOption"]:checked')).map(i => i.value);
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
        } else {
            // Produto genérico criado pelo admin — coleta dados conforme categoria
            const prodInfo = window.scheduleConfig?.[productId] || {};
            const prodCat = (prodInfo.category || '').toLowerCase();
            const prodName = (prodInfo.name || prodInfo.label || '').toLowerCase();
            const isPasse = prodCat === 'passe' || prodName.includes('passe');
            const isFisico = prodCat === 'fisico' || prodCat === 'physical';
            const isAereas = prodCat === 'aereas';

            if (isAereas) {
                const selectedMaps = Array.from(
                    document.querySelectorAll('input[name="aereasMapOption"]:checked')
                ).map(i => i.value);
                if (selectedMaps.length === 0) {
                    alert('Por favor, selecione pelo menos um mapa.');
                    return;
                }
                productOptions.maps = selectedMaps;
                productOptions.quantity = selectedMaps.length;
                // Calcula preço com base na quantidade × preço base
                const basePrice = (prodInfo.priceOptions?.[0]?.price) || prodInfo.price || 2;
                finalPrice = selectedMaps.length * basePrice;
            } else if (isPasse) {
                productOptions.gameNick = document.getElementById('gameNick')?.value?.trim() || '';
                productOptions.gameId = document.getElementById('gameId')?.value?.trim() || '';
                productOptions.gameContact = document.getElementById('gameContact')?.value?.trim() || '';
            } else if (isFisico) {
                productOptions.delivery = {
                    nome: document.getElementById('addrNome')?.value?.trim() || '',
                    cpf: document.getElementById('customerCPF')?.value?.trim() || '',
                    cep: document.getElementById('addrCEP')?.value?.trim() || '',
                    rua: document.getElementById('addrRua')?.value?.trim() || '',
                    numero: document.getElementById('addrNumero')?.value?.trim() || '',
                    complemento: document.getElementById('addrComplemento')?.value?.trim() || '',
                    bairro: document.getElementById('addrBairro')?.value?.trim() || '',
                    cidade: document.getElementById('addrCidade')?.value?.trim() || '',
                    estado: document.getElementById('addrEstado')?.value?.trim() || '',
                    tamanho: document.getElementById('prodTamanho')?.value || ''
                };
            } else {
                // Digital
                productOptions.nome = document.getElementById('digitalNome')?.value?.trim() || '';
                productOptions.email = document.getElementById('digitalEmail')?.value?.trim() || '';
                productOptions.telefone = document.getElementById('digitalTelefone')?.value?.trim() || '';
            }
            // Salva o link de download direto no pedido para liberação automática
            if (prodInfo.downloadLink) {
                productOptions.downloadLink = prodInfo.downloadLink;
            }
        }

        // Aplicar cupom do modal de agendamento se houver
        let _prodCouponDiscount = 0;
        let _prodOriginalPrice = finalPrice;
        const _prodCoupon = (typeof appliedScheduleCoupon !== 'undefined' && appliedScheduleCoupon) ? appliedScheduleCoupon : null;
        if (_prodCoupon) {
            if (_prodCoupon.discountType === 'percentage') {
                _prodCouponDiscount = finalPrice * (_prodCoupon.discountValue / 100);
            } else {
                _prodCouponDiscount = _prodCoupon.discountValue || 0;
            }
            _prodCouponDiscount = Math.min(_prodCouponDiscount, finalPrice);
            finalPrice = Math.max(0, finalPrice - _prodCouponDiscount);
        }

        // Validar preço final
        if (!finalPrice || finalPrice <= 0 || isNaN(finalPrice)) {
            alert('Preço inválido. Por favor, verifique os dados do produto.');
            
            return;
        }
        const pixCpf = document.getElementById('purchasePixCpf')?.value
            || document.getElementById('schedPixCpf')?.value
            || '';
        if (paymentMethod === 'pix' && !isValidBrazilianCpf(pixCpf)) {
            document.getElementById('schedPixCpfWrap')?.classList.remove('hidden');
            document.getElementById('schedPixCpf')?.focus();
            alert('Informe um CPF válido para gerar o Pix.');
            return;
        }
        if (paymentMethod === 'pix') document.getElementById('schedPixCpfWrap')?.classList.remove('hidden');

        // Inicializar variáveis
        let docRef = null;
        let externalRef = `digital_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Salvar order no Firestore ANTES de redirecionar
        if (window.firebaseDb) {
            try {
                const { addDoc, collection, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

                const orderData = {
                    title: cfg.label,
                    description: cfg.label,
                    item: cfg.label,
                    amount: finalPrice,
                    total: finalPrice,
                    originalPrice: _prodOriginalPrice,
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
                    downloadLink: cfg.downloadLink || productOptions.downloadLink || '',
                    productCategory: cfg.category || '',
                    couponId: _prodCoupon?.id || null,
                    couponCode: _prodCoupon?.code || null,
                    couponDiscount: _prodCouponDiscount || 0,
                    affiliateCode: _prodCoupon?.affiliateId || (typeof activeAffiliateCode !== 'undefined' ? activeAffiliateCode : null) || null,
                    createdAt: new Date(),
                    timestamp: Date.now(),
                    type: 'digital_product'
                };

                
                docRef = await addDoc(collection(window.firebaseDb, 'orders'), orderData);
                

                // Salvar external_reference para o webhook
                externalRef = `digital_${docRef.id}`;
                await updateDoc(docRef, { external_reference: externalRef });
                try { sessionStorage.setItem('lastExternalRef', externalRef); } catch (_) { }

            } catch (firebaseError) {
                
                // Continua com externalRef gerado acima
            }
        }

        if (!docRef) throw new Error('Pedido não salvo. Nenhuma cobrança foi iniciada. Tente novamente.');
        if (paymentMethod === 'tokens') {
            await payOrderWithTokens(externalRef, _prodCoupon?.code || null, finalPrice);
            closeScheduleModal();
            showToast('success', 'Pagamento com tokens confirmado. Confira Meus Produtos.', 'Compra confirmada');
            return;
        }
        // Chamar function segura (Netlify) para criar Preference
        const preferencePayload = {
            title: cfg.label || 'Produto',
            unit_price: Number(finalPrice.toFixed(2)),
            currency_id: 'BRL',
            quantity: 1,
            back_url: window.location.origin,
            external_reference: externalRef,
            couponCode: _prodCoupon?.code || null,
            ...(paymentMethod === 'pix' ? { payer_cpf: String(pixCpf).replace(/\D/g, '') } : {})
        };

        
        let response;
        try {
            response = await authenticatedPaymentFetch(
                paymentMethod === 'pix' ? '/.netlify/functions/create-pix-payment' : '/.netlify/functions/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferencePayload)
            });
        } catch (fetchErr) {
            
            storeCheckoutFailure({ location: 'product', payload: preferencePayload, errorMessage: String(fetchErr) });
            throw fetchErr;
        }

        if (response.status === 404) {
            storeCheckoutFailure({ location: 'product', payload: preferencePayload, responseStatus: 404 });
            alert('⚠️ Pagamento via Mercado Pago não está disponível neste ambiente de desenvolvimento.\n\nO checkout funciona apenas na versão publicada do site (orgfreitas.com.br).');
            return;
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => null);
            
            storeCheckoutFailure({ location: 'product', payload: preferencePayload, responseStatus: response.status, responseText: errorText });
            // Detect common server-side misconfiguration and show actionable message
            if (String(errorText || '').includes('Missing MP_ACCESS_TOKEN') || String(errorText || '').toLowerCase().includes('mercado pago')) {
                alert('Pagamento temporariamente indisponível: problema com a integração do Mercado Pago. Por favor, contate o suporte ou tente pagar via WhatsApp.');
            }
            throw new Error(errorText || 'Erro ao criar preferência de pagamento');
        }

        const data = await response.json().catch((e) => { return null; });
        

        const checkoutUrl = data.init_point || data.sandbox_init_point;
        if (paymentMethod === 'pix' && data.status !== 'paid' && (!data.qr_code || !data.qr_code_base64)) {
            storeCheckoutFailure({ location: 'product', payload: preferencePayload, responseStatus: response.status, responseJson: data, errorMessage: 'Pix QR data missing' });
            throw new Error(data.error || 'Não foi possível gerar o QR Code Pix.');
        }
        if (paymentMethod !== 'pix' && !checkoutUrl) {
            
            storeCheckoutFailure({ location: 'product', payload: preferencePayload, responseStatus: response.status, responseJson: data, errorMessage: 'No checkout URL in response' });
            throw new Error('Não foi possível obter o link de pagamento. Verifique se o Mercado Pago está configurado corretamente.');
        }

        closeScheduleModal();

        if (paymentMethod === 'pix') {
            if (data.status === 'paid') {
                showToast('success', 'Pagamento já confirmado. Confira Meus Produtos.', 'Compra confirmada');
                return;
            }
            window.openPixModal(
                data,
                [],
                data.external_reference || externalRef,
                [],
                { ...cfg, label: cfg.label || 'Produto', kind: 'product' },
                finalPrice
            );
            return;
        }

        // Redireciona para o checkout do Mercado Pago
        try {
            sessionStorage.setItem('lastCheckoutUrl', checkoutUrl);
        } catch (_) { }
        try {
            window.open(checkoutUrl, '_blank');
            showToast('success', 'Checkout aberto em nova aba. Finalize o pagamento no Mercado Pago.', 'Checkout');
        } catch (openErr) {
            
            window.location.href = checkoutUrl;
        }
    } catch (error) {
        
        const errorMessage = error.message || 'Falha ao processar compra.';
        alert(`Falha ao processar compra.\n\n${errorMessage}\n\nPor favor, tente novamente ou entre em contato com o suporte.`);
    }
}

// Compra de produtos da loja usando Tokens (no modal de agendamento)
async function handleProductPurchaseWithTokens(productId, cfg) {
    return handleProductPurchase(productId, cfg, 'tokens');
}
async function submitSchedule(e, useTokens = false) {
    e.preventDefault();
    if (window._scheduleSubmitting) return;
    window._scheduleSubmitting = true;
    const submitBtn = document.getElementById('schedSubmit');
    const pixSubmitBtn = document.getElementById('schedPixSubmit');
    const tokenBtn = document.getElementById('schedPayTokens');
    const paymentMethod = useTokens ? 'tokens' : (e.submitter?.value === 'pix' ? 'pix' : 'mercadopago');
    const paymentButton = paymentMethod === 'pix' ? pixSubmitBtn : submitBtn;
    const oldText = paymentButton ? paymentButton.textContent : '';
    if (submitBtn) submitBtn.disabled = true;
    if (pixSubmitBtn) pixSubmitBtn.disabled = true;
    if (paymentButton) paymentButton.textContent = 'Processando...';
    if (tokenBtn) tokenBtn.disabled = true;

    try {
        const modal = document.getElementById('scheduleModal');
        const rawEventType = modal?.dataset?.eventType || 'modo-liga';
        const normalizeType = (t) => {
            const normalized = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase().trim().replace(/[\s_]+/g, '-');
            return normalized === 'camp' ? 'camp-freitas' : normalized;
        };
        const normalizeHour = (h) => { if (!h) return null; const s = String(h).toLowerCase().trim(); const m = s.match(/(\d{1,2})/); return m ? `${parseInt(m[1], 10)}h` : s; };
        const eventType = normalizeType(rawEventType);
        const cfg = getActiveScheduleConfig(rawEventType);
        const isFreeEvent = (cfg.price === 0 || cfg.isFree === true) && !cfg.isProduct;

        // Se for produto da loja, usar lógica de compra
        // Fallback: verificar também no objeto products para cobrir casos de race condition no carregamento do Firestore
        const isProductFlow = cfg.isProduct === true ||
            window.products?.[rawEventType]?.isProduct === true ||
            window.products?.[eventType]?.isProduct === true;
        if (isProductFlow) {
            const productCfg = cfg.isProduct ? cfg : (window.scheduleConfig?.[rawEventType] || window.scheduleConfig?.[eventType] || window.products?.[rawEventType] || window.products?.[eventType] || {});
            if (useTokens) {
                await handleProductPurchaseWithTokens(eventType, productCfg);
            } else {
                await handleProductPurchase(eventType, productCfg, paymentMethod);
            }
            return;
        }

        // --- FLUXO DE EVENTOS ---
        if (!window.isLoggedIn) {
            closeScheduleModal();
            if (typeof openLoginModal === 'function') openLoginModal();
            alert('Faça login para continuar a compra.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }

        // Validações básicas
        const date = document.getElementById('schedDate').value;
        const datesToUse = (selectedDates && selectedDates.length > 0) ? [...selectedDates] : [date];
        if (datesToUse.some(bookingDate => !isValidScheduleDate(bookingDate, rawEventType))) {
            alert('A data selecionada não está disponível para este evento. O Camp Season 7 começa em 15/11/2026.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }

        // Horário obrigatório para TODOS os tipos de evento (incluindo gratuitos)
        if (selectedTimes.length === 0) {
            alert('Selecione pelo menos um horário.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }
        if (paymentMethod === 'pix') {
            const payerCpf = document.getElementById('schedPixCpf')?.value || '';
            if (!isValidBrazilianCpf(payerCpf)) {
                document.getElementById('schedPixCpfWrap')?.classList.remove('hidden');
                document.getElementById('schedPixCpf')?.focus();
                alert('Informe um CPF válido para gerar o Pix.');
                return;
            }
            document.getElementById('schedPixCpfWrap')?.classList.remove('hidden');
        }

        // --- CAPTURAR DADOS DOS TIMES DIRETAMENTE DO DOM ---
        const teamElements = document.querySelectorAll('#teamsContainer > div');
        const teamsData = [];
        teamElements.forEach((teamDiv) => {
            const nameInput = teamDiv.querySelector('input[data-field="name"], input[placeholder="Nome do time"]');
            const emailInput = teamDiv.querySelector('input[data-field="email"], input[placeholder="Email"]');
            const phoneInput = teamDiv.querySelector('input[data-field="phone"], input[placeholder="WhatsApp (11) 99999-9999"]');
            const teamRecord = teams.find(t => t.id === teamDiv.id);

            if (nameInput && emailInput && phoneInput) {
                teamsData.push({
                    name: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    phone: phoneInput.value.trim(),
                    logoBase64: teamRecord?.logoBase64 || null
                });
            }
        });

        // Eventos de time (xtreino-tokens) vêm sem formulário DOM — usar dados do time confirmado
        const _isTeamEvt = rawEventType === 'xtreino-tokens' || scheduleConfig[rawEventType]?.eventType === 'xtreino-tokens';
        if (_isTeamEvt && teamsData.length === 0) {
            // Fallback em cascata: _equipeAtual → perfil do usuário → string vazia
            teamsData.push({
                name: _equipeAtual?.nome || window.currentUserProfile?.teamName || window.currentUserProfile?.name || '',
                email: _equipeAtual?.email || window.currentUserProfile?.email || '',
                phone: _equipeAtual?.phone || window.currentUserProfile?.phone || ''
            });
        }

        if (teamsData.length === 0) {
            alert('Adicione pelo menos um time.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }

        for (let team of teamsData) {
            if (!team.name || !team.email || !team.phone) {
                alert('Preencha todos os dados dos times.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                return;
            }
        }

        // Fluxo de evento grátis: confirmar diretamente sem pagamento
        if (isFreeEvent) {
            await handleFreeEventRegistration(rawEventType, cfg, teamsData, datesToUse, selectedTimes);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }

        // Agrupar horários por data
        const timesByDate = {};
        selectedTimes.forEach(item => {
            if (!timesByDate[item.date]) timesByDate[item.date] = [];
            timesByDate[item.date].push(item.schedule);
        });
        const availabilitySelection = {
            eventType: rawEventType, numberOfTeams: teamsData.length,
            timesByDate: Object.fromEntries(Object.entries(timesByDate).map(([d, times]) => [d, [...times]]))
        };

        // ── DISPARAR TUDO EM PARALELO ─────────────────────────────────────────
        // 1) waitForFirebase começa AGORA (não espera os checks terminarem)
        const _fbReadyPromise = waitForFirebase(5000);

        // 2) Checks de disponibilidade para TODAS as datas em paralelo
        const _availPromises = datesToUse
            .filter(d => (timesByDate[d] || []).length > 0)
            .map(d => checkMultipleSlotAvailability(d, timesByDate[d], rawEventType, teamsData.length)
                .catch(() => ({
                    available: false,
                    message: 'Não foi possível confirmar as vagas agora. Nenhuma cobrança foi iniciada. Tente novamente.'
                })));

        // O servidor acima já verifica travas globais, por horário e por data.
        // Não repetir essas leituras no navegador antes de cada pagamento.

        // 3) Anti-duplicação para campeonatos (em paralelo com o resto)
        const _isCampEvent = (cfg?.category === 'camp') ||
            rawEventType === 'camp-freitas' || rawEventType === 'camp-final' ||
            rawEventType.toLowerCase().startsWith('camp');
        const _campDupPromise = (_isCampEvent && teamsData.length > 0) ? (async () => {
            try {
                const { collection: _dc, query: _dq, where: _dw, getDocs: _ddg } =
                    await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                const _existSnap = await _ddg(_dq(_dc(window.firebaseDb, 'registrations'), _dw('eventType', '==', rawEventType)));
                const _existNames = new Set();
                _existSnap.docs.forEach(_d => { const _tn = _d.data().teamName; if (_tn) _existNames.add(_tn.trim().toLowerCase().replace(/\s+/g, ' ')); });
                return _existNames;
            } catch (_) { return null; }
        })() : Promise.resolve(null);

        // ── AGUARDAR TUDO DE UMA VEZ ──────────────────────────────────────────
        const [availResults, campExistNames] = await Promise.all([
            Promise.all(_availPromises),
            _campDupPromise,
            _fbReadyPromise
        ]);

        // Processar disponibilidade
        for (const check of availResults) {
            if (!check.available) {
                alert(check.message || 'Não há vagas suficientes.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                return;
            }
        }

        // Processar anti-duplicação camp
        if (campExistNames) {
            for (const _team of teamsData) {
                const _norm = (_team.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
                if (_norm && campExistNames.has(_norm)) {
                    alert(`Já existe uma equipe inscrita com esse nome nas fases iniciais: "${_team.name}"\n\nVerifique se sua equipe já está inscrita neste campeonato.`);
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                    return;
                }
            }
        }

        // Calcular total original
        // Usa rawEventType (ID original do Firestore, case-sensitive) para lookup correto no scheduleConfig
        let originalTotal = 0;
        for (const d of datesToUse) {
            const times = timesByDate[d] || [];
            for (const schedule of times) {
                const hour = (schedule.split(' - ')[1] || '').trim();
                const price = getEventPrice(rawEventType, hour, d);
                originalTotal += price * teamsData.length;
            }
        }

        // Aplicar cupom
        let finalPrice = originalTotal;
        let couponInfo = null;
        if (appliedScheduleCoupon) {
            let discount = 0;
            if (appliedScheduleCoupon.discountType === 'percentage') {
                discount = originalTotal * (appliedScheduleCoupon.discountValue / 100);
            } else {
                discount = appliedScheduleCoupon.discountValue;
            }
            finalPrice = Math.max(0, originalTotal - discount);
            couponInfo = {
                code: appliedScheduleCoupon.code,
                discountType: appliedScheduleCoupon.discountType,
                discountValue: appliedScheduleCoupon.discountValue,
                context: 'events'
            };
        }

        // Horário liberado pelo admin → verificar escolha feita nos botões do passo 4
        // Detectar se QUALQUER horário selecionado foi liberado gratuitamente (funciona com slots mistos também)
        const _anyFreeSlot = selectedTimes.some(item => {
            const freeMap = (window._freeHoursMap || {})[item.date] || {};
            const _m = (item.schedule || '').match(/(\d{1,2})h/);
            const _hh = _m ? parseInt(_m[1], 10) : null;
            return _hh !== null && freeMap[_hh] != null;
        });
        if (_anyFreeSlot && !isFreeEvent) {
            const choice = window._freeSlotChoice;
            window._freeSlotChoice = null;
            if (choice === 'gratis') {
                // Jogar Grátis: separar slots gratuitos dos pagos
                const _isSlotFree = (item) => {
                    const _fm = (window._freeHoursMap || {})[item.date] || {};
                    const _mm = (item.schedule || '').match(/(\d{1,2})h/);
                    const _hnum = _mm ? parseInt(_mm[1], 10) : null;
                    return _hnum !== null && _fm[_hnum] != null;
                };
                const _freeTimes = selectedTimes.filter(_isSlotFree);
                const _paidTimes = selectedTimes.filter(t => !_isSlotFree(t));

                // Registrar apenas os slots gratuitos como lisagem_gratis
                if (_freeTimes.length > 0) {
                    await handleFreeEventRegistration(rawEventType, cfg, teamsData, datesToUse, _freeTimes, 'lisagem_gratis');
                }

                if (_paidTimes.length === 0) {
                    // Todos os slots eram gratuitos → concluído sem pagamento
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                    return;
                }

                // Ainda há slots pagos → continuar para MP apenas com eles
                selectedTimes.length = 0;
                _paidTimes.forEach(t => selectedTimes.push(t));
                finalPrice = 0;
                for (const _pt of _paidTimes) {
                    const _ph = (_pt.schedule.split(' - ')[1] || '').trim();
                    finalPrice += getEventPrice(rawEventType, _ph, _pt.date) * teamsData.length;
                }
                // continua fluxo de pagamento abaixo apenas para os slots pagos
            }
            if (choice === 'pagar') {
                // Pagar e Concorrer: adiciona ao finalPrice o valor dos slots liberados grátis
                for (const _item of selectedTimes) {
                    const _freeMap = (window._freeHoursMap || {})[_item.date] || {};
                    const _m2 = (_item.schedule || '').match(/(\d{1,2})h/);
                    const _hh2 = _m2 ? parseInt(_m2[1], 10) : null;
                    if (_hh2 !== null && _freeMap[_hh2] != null) {
                        finalPrice += (cfg.price || 0) * teamsData.length;
                    }
                }
                // continua o fluxo normal de pagamento abaixo com finalPrice corrigido
            } else if (finalPrice === 0) {
                // Nenhuma escolha capturada e sem pagamento pendente → overlay de segurança
                _showFreeSlotChoiceModal(rawEventType, cfg, teamsData, datesToUse, selectedTimes, paymentButton, oldText);
                return;
            }
            // Se choice === null mas finalPrice > 0 (slots mistos sem escolha), prossegue normalmente
        }

        const totalReservations = teamsData.length * selectedTimes.length; // selectedTimes já inclui a multiplicação por datas

        // Se for pagamento com tokens
        // if (useTokens || (cfg && cfg.payWithToken)) {
        //     // Passa os dados dos times para a função de tokens
        //     await useTokensForEvent(eventType, totalReservations, finalPrice, teamsData);
        //     if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
        //     return;
        // }


        // Se for pagamento com tokens
        if (useTokens || (cfg && cfg.payWithToken)) {
            // Reuse the successful checks from this submission, not a previous modal/cache.
            await useTokensForEvent(rawEventType, totalReservations, finalPrice, teamsData, selectedTimes, datesToUse, availabilitySelection);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }

        // --- SALVAR NO FIRESTORE ---
        let externalRef = `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        let regIds = [];
        let _prefFetchPromise = null; // requisição preparada; enviada após persistir as reservas

        try {
            // Firebase já foi aguardado em paralelo acima — verificação rápida
            if (!window.firebaseReady || !window.firebaseDb) throw new Error('Não foi possível conectar ao banco de dados. Verifique sua internet e tente novamente.');
            if (!window.firebaseAuth?.currentUser) {
                alert('Faça login para se inscrever no evento.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                if (typeof openLoginModal === 'function') openLoginModal();
                return;
            }

            const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

            // ── Preparar _schedPairs e _sc (sem await, só leitura de memória) ──
            const mpIsLiga = (cfg.modo || '').toUpperCase().includes('LIGA');
            const mpVagas = cfg.vagas || 0;
            const mpGrupos = Math.max(1, cfg.grupos || 1);
            const assignedSlotsData = [];

            const _schedPairs = [];
            for (const d of datesToUse) {
                for (const schedule of (timesByDate[d] || [])) {
                    const hour = (schedule.split(' - ')[1] || '').trim();
                    _schedPairs.push({ d, schedule, hour, normalizedHour: normalizeHour(hour), price: getEventPrice(rawEventType, hour, d) });
                }
            }
            const _sc = {};
            for (const _d of datesToUse) {
                for (const _t of (timesByDate[_d] || [])) {
                    _sc[_t] = (_sc[_t] || 0) + teamsData.length;
                }
            }

            // ── Alocar slots (transação) + upload logos em PARALELO ───────────
            // São totalmente independentes: rodar juntos economiza 3-5s
            const [_slotAlloc, [_wlArr, _teamLogoDataMap]] = await Promise.all([
                Object.keys(_sc).length > 0
                    ? allocateSlotsFromDB(rawEventType, _sc, datesToUse)
                    : Promise.resolve({}),
                Promise.all([
                    Promise.all(_schedPairs.map(p => getWhatsAppLink(rawEventType, p.normalizedHour, p.d).catch(() => null))),
                    (async () => {
                        const _map = {};
                        await Promise.all(teamsData.map(async team => {
                            if (team.logoBase64) {
                                const [url, thumb] = await Promise.all([
                                    uploadTeamLogo(team.logoBase64, team.name, rawEventType),
                                    _resizeLogoBase64(team.logoBase64)
                                ]);
                                _map[team.name] = { url, thumb };
                            }
                        }));
                        return _map;
                    })()
                ])
            ]);
            const mpSlotCount = {};
            for (const [_k, _v] of Object.entries(_slotAlloc)) mpSlotCount[_k] = _v - 1;
            _schedPairs.forEach((p, i) => { p.whatsappLink = _wlArr[i]; });

            // ── Calcular slots (síncrono — preserva ordem) e montar payloads ──
            const _regPayloads = [];
            for (const p of _schedPairs) {
                for (const team of teamsData) {
                    mpSlotCount[p.schedule] = (mpSlotCount[p.schedule] || 0) + 1;
                    const slotNum = mpSlotCount[p.schedule];
                    const slotDisplay = computeSlotDisplay(slotNum, mpVagas, mpGrupos, mpIsLiga, rawEventType);
                    _regPayloads.push({
                        _meta: { team: team.name, slotNum, slotDisplay, schedule: p.schedule, date: p.d, whatsappLink: p.whatsappLink },
                        userId: window.firebaseAuth.currentUser.uid,
                        teamName: team.name,
                        teamLogoUrl: _teamLogoDataMap[team.name]?.url || null,
                        teamLogoThumb: _teamLogoDataMap[team.name]?.thumb || _equipeAtual?.logoUrl || null,
                        teamId: _equipeAtual?.id || null,
                        membrosUids: _equipeAtual?.membrosUids || null,
                        email: team.email,
                        phone: team.phone,
                        schedule: p.schedule,
                        date: p.d,
                        eventType: rawEventType,
                        ...getActiveEventRegistrationMetadata(),
                        title: mpIsLiga ? `${cfg.label} - ${p.schedule}` : `${cfg.label} - ${slotDisplay || p.schedule}`,
                        price: p.price,
                        slot: mpIsLiga ? null : slotNum,
                        slotDisplay: slotDisplay,
                        status: 'pending',
                        createdAt: serverTimestamp(),
                        external_reference: externalRef,
                        groupLink: p.whatsappLink || null,
                        whatsappLink: p.whatsappLink || null,
                        hour: p.normalizedHour || null,
                        affiliateCode: getActiveAffiliateCode(appliedScheduleCoupon?.affiliateId || null)
                    });
                }
            }

            // Preparar create-preference; o servidor precisa das reservas já gravadas.
            {
                const _earlyAff = getActiveAffiliateCode(appliedScheduleCoupon?.affiliateId || null);
                if (_earlyAff) { try { sessionStorage.setItem('xf_pending_aff', _earlyAff); } catch (_) {} }
                const _earlyAffParam = _earlyAff ? `?ref=${encodeURIComponent(_earlyAff)}` : '';
                const _earlyHost = ['orgfreitas.com.br', 'www.orgfreitas.com.br'].includes(window.location.hostname)
                    ? window.location.origin : 'https://orgfreitas.com.br';
                const _earlyPrefPayload = {
                    title: `${cfg.label} - ${totalReservations} reserva(s)`,
                    unit_price: Number(finalPrice.toFixed(2)),
                    currency_id: 'BRL',
                    quantity: 1,
                    back_url: `${_earlyHost}/${_earlyAffParam}`,
                    coupon_info: couponInfo,
                    external_reference: externalRef,
                    ...(paymentMethod === 'pix' ? {
                        payer_cpf: String(document.getElementById('schedPixCpf')?.value || '').replace(/\D/g, '')
                    } : {}),
                    forcePay: window._freeSlotForcePay === true,
                    multiple_reservations: {
                        teams: teamsData.map(t => t.name),
                        schedules: selectedTimes.map(item => item.schedule),
                        dates: datesToUse,
                        eventType: rawEventType
                    }
                };
                // Só enviar após as reservas serem persistidas; o servidor precisa lê-las.
                _prefFetchPromise = () => authenticatedPaymentFetch(
                    paymentMethod === 'pix' ? '/.netlify/functions/create-pix-payment' : '/.netlify/functions/create-preference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(_earlyPrefPayload)
                });
            }

            // ── Gravar todas as registrations em paralelo (era sequencial) ──
            const _docRefs = await Promise.all(
                _regPayloads.map(payload => {
                    const { _meta, ...docData } = payload;
                    return addDoc(collection(window.firebaseDb, 'registrations'), docData);
                })
            );
            _docRefs.forEach((docRef, i) => {
                const m = _regPayloads[i]._meta;
                regIds.push(docRef.id);
                assignedSlotsData.push({ regId: docRef.id, team: m.team, slotNum: m.slotNum, slotDisplay: m.slotDisplay, schedule: m.schedule, date: m.date, whatsappLink: m.whatsappLink });
            });

            if (regIds.length > 0) {
                try { sessionStorage.setItem('lastRegIds', JSON.stringify(regIds)); } catch (_) { }
                try { sessionStorage.setItem('lastRegId', regIds[0]); } catch (_) { }
                try { sessionStorage.setItem('lastExternalRef', externalRef); } catch (_) { }
                // localStorage como backup persistente (expira em 2h) para caso sessionStorage seja perdido
                try { localStorage.setItem('_pendingPagamento', JSON.stringify({ ref: externalRef, ts: Date.now() })); } catch (_) { }
            }

        } catch (dbError) {
            console.error('[submitSchedule] Erro ao salvar no Firestore:', dbError);
            const dbMsg = dbError?.message || String(dbError);
            if (dbMsg.includes('permission-denied') || dbMsg.includes('Missing or insufficient permissions')) {
                alert('Erro de permissão: faça login novamente e tente de novo.');
            } else if (dbMsg.includes('Faça login')) {
                alert(dbMsg);
            } else {
                alert(`Erro ao salvar reserva: ${dbMsg}\n\nTente recarregar a página e fazer login novamente.`);
            }
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
            return;
        }

        // --- CHAMAR MERCADO PAGO ---
        const _cleanupPendingRegs = async () => {
            if (!regIds.length) return;
            try {
                const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
                await Promise.all(regIds.map(id => deleteDoc(doc(window.firebaseDb, 'registrations', id))));
            } catch (_) {}
        };

        try {
            if (paymentButton) paymentButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Gerando pagamento...';
            if (typeof showToast === 'function') {
                showToast('info', paymentMethod === 'pix' ? 'Gerando QR Code Pix...' : 'Conectando ao Mercado Pago, aguarde...', 'Pagamento', 20000);
            }

            // As reservas já foram gravadas; agora solicitar o checkout seguro.
            let resp;
            try {
                resp = await _prefFetchPromise();
            } catch (fetchErr) {
                await _cleanupPendingRegs();
                alert('Não foi possível conectar ao servidor de pagamento. Verifique sua internet e tente novamente.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                return;
            }

            if (resp.status === 404) {
                await _cleanupPendingRegs();
                alert('⚠️ Pagamento via Mercado Pago não está disponível neste ambiente de desenvolvimento.\n\nO checkout funciona apenas na versão publicada do site.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                return;
            }

            if (!resp.ok) {
                const errText = await resp.text().catch(() => '');
                await _cleanupPendingRegs();
                if (errText.includes('Missing MP_ACCESS_TOKEN')) {
                    alert('Integração com Mercado Pago não configurada. Entre em contato com o suporte.');
                } else if (errText.includes('unit_price')) {
                    alert('Erro no valor do pagamento. Por favor, recarregue a página e tente novamente.');
                } else {
                    alert(`Erro ao iniciar pagamento (${resp.status}). ${errText ? errText.slice(0, 120) : 'Tente novamente.'}`);
                }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                return;
            }

            const data = await resp.json().catch(() => null);
            if (!data) {
                await _cleanupPendingRegs();
                alert('Resposta inválida do servidor de pagamento. Tente novamente.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
                return;
            }

            localStorage.setItem('pendingPaymentRefs', JSON.stringify([externalRef]));
            const checkoutUrl = data.init_point || data.sandbox_init_point;
            if (paymentMethod === 'pix' && data.status !== 'paid' && (!data.qr_code || !data.qr_code_base64)) {
                await _cleanupPendingRegs();
                alert(data.error || 'Não foi possível gerar o QR Code Pix. Tente novamente.');
                if (paymentButton) { paymentButton.disabled = false; paymentButton.textContent = oldText; }
                return;
            }
            if (paymentMethod !== 'pix' && !checkoutUrl) {
                await _cleanupPendingRegs();
                alert('Não foi possível obter o link de pagamento. Tente novamente.');
                if (paymentButton) { paymentButton.disabled = false; paymentButton.textContent = oldText; }
                return;
            }

            // Capturar cupom ANTES de fechar o modal (closeScheduleModal zera appliedScheduleCoupon)
            const _evtCouponMP = appliedScheduleCoupon ? { ...appliedScheduleCoupon } : null;
            // Registrar uso de cupom de evento (MP) se aplicado
            if (_evtCouponMP) {
                try {
                    const discountAmtEvt = Math.max(0, originalTotal - finalPrice);
                    await recordCouponUsage(
                        _evtCouponMP.id,
                        _evtCouponMP.code,
                        originalTotal,
                        discountAmtEvt,
                        'events',
                        externalRef,
                        { productId: rawEventType, name: cfg.label || rawEventType }
                    );
                } catch (_) {}
            }

            closeScheduleModal();
            if (paymentButton) { paymentButton.disabled = false; paymentButton.textContent = oldText; }
            if (paymentMethod === 'pix') {
                if (data.status === 'paid') {
                    showToast('success', 'Pagamento já confirmado. Confira sua conta.', 'Compra confirmada');
                    return;
                }
                window.openPixModal(data, regIds, data.external_reference || externalRef, assignedSlotsData, {
                    ...cfg,
                    label: cfg.label || rawEventType,
                    kind: 'event',
                    eventType: rawEventType,
                }, finalPrice);
                return;
            }
            try { sessionStorage.setItem('lastCheckoutUrl', checkoutUrl); } catch (_) {}
            // Redireciona direto na mesma aba — evita bloqueio de popup
            window.location.href = checkoutUrl;

        } catch (paymentError) {
            console.error('Erro pagamento evento:', paymentError);
            await _cleanupPendingRegs();
            alert('Erro inesperado ao iniciar pagamento. Recarregue a página e tente novamente.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
        }

    } catch (error) {
        
        alert('Ocorreu um erro inesperado. Atualize a página e tente novamente.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
    } finally {
        window._scheduleSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        if (pixSubmitBtn) pixSubmitBtn.disabled = false;
        if (paymentButton) paymentButton.textContent = oldText;
        const _tb = document.getElementById('schedPayTokens');
        if (_tb) _tb.disabled = false;
    }
}

// ===== Helper: busca registrações por eventType (raw + normalizado) — uso admin only =====
// Regras do Firestore bloqueiam leitura de registrations de outros usuários para usuários normais
async function fetchRegsForSlotCount(rawEventType) {
    try {
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const regsRef = collection(window.firebaseDb, 'registrations');
        const normalizedType = String(rawEventType || '').toLowerCase().trim().replace(/\s+/g, '-');
        const promises = [getDocs(query(regsRef, where('eventType', '==', rawEventType)))];
        if (normalizedType !== rawEventType) {
            promises.push(getDocs(query(regsRef, where('eventType', '==', normalizedType))));
        }
        const snaps = await Promise.all(promises);
        const seen = new Set();
        const docs = [];
        snaps.forEach(snap => {
            snap.docs.forEach(d => {
                if (!seen.has(d.id)) { seen.add(d.id); docs.push(d); }
            });
        });
        return docs;
    } catch(_) { return []; }
}

async function fetchRegistrationDocsForDates(eventType, dates, firestoreApi) {
    const uniqueDates = [...new Set((Array.isArray(dates) ? dates : [])
        .filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)))];
    if (uniqueDates.length === 0) return [];

    const { collection, query, where, getDocs } = firestoreApi;
    const dateChunks = [];
    for (let i = 0; i < uniqueDates.length; i += 30) {
        dateChunks.push(uniqueDates.slice(i, i + 30));
    }

    const snapshots = await Promise.all(dateChunks.map((datesChunk) => {
        const dateFilter = datesChunk.length === 1
            ? where('date', '==', datesChunk[0])
            : where('date', 'in', datesChunk);
        return getDocs(query(collection(window.firebaseDb, 'registrations'), dateFilter));
    }));

    return snapshots.flatMap(snapshot => snapshot.docs)
        .filter(doc => !eventType || doc.data().eventType === eventType);
}

// ===== Helper: aloca slots a partir do maior slot já no banco =====
// scheduleCounts: { "schedule_key": numSlotsNeeded }
// Retorna: { "schedule_key": firstSlotNumber } ou null se ambos os métodos falharem
// Nível 1: transação atômica via slotCounters
// Nível 2: fallback com seeding atômico — elimina race condition entre compradores simultâneos
async function allocateSlotsFromDB(rawEventType, scheduleCounts, targetDates = null, existingDocsPromise = null) {
    const { doc, runTransaction, collection, query, where, getDocs } =
        await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const counterRef = doc(window.firebaseDb, 'slotCounters', rawEventType);

    // Normaliza horário para chave canônica: "Domingo - 21h" → "21h", "21:00" → "21h"
    const _normH = s => {
        const str = String(s || '').trim();
        const mColon = str.match(/(\d{1,2}):(\d{2})/);
        if (mColon) return parseInt(mColon[1], 10) + 'h';
        const mH = str.match(/(\d{1,2})\s*h/i);
        if (mH) return parseInt(mH[1], 10) + 'h';
        return str;
    };

    // Conta registrations reais por horário (COUNT, não MAX) — imune a dados corrompidos.
    // Para reservas com datas definidas, consulta somente essas datas em vez do histórico inteiro.
    const regSlotCount = {};
    try {
        const registrationDocs = existingDocsPromise ? await existingDocsPromise : Array.isArray(targetDates)
            ? await fetchRegistrationDocsForDates(rawEventType, targetDates, { collection, query, where, getDocs })
            : (await getDocs(query(
                collection(window.firebaseDb, 'registrations'),
                where('eventType', '==', rawEventType)
            ))).docs;
        registrationDocs.forEach(d => {
            const data = d.data();
            if (!data.schedule) return;
            // Pendentes não contam — só confirmaados/pagos ocupam slot
            if (data.status === 'pending') return;
            // Filtrar por data quando disponível
            if (targetDates && Array.isArray(targetDates) && !targetDates.includes(data.date)) return;
            // Contar a registration (COUNT) — ignora o valor do slot para evitar inflação
            const normKey = _normH(data.schedule);
            regSlotCount[normKey] = (regSlotCount[normKey] || 0) + 1;
        });
    } catch (_) {
        throw new Error('Não foi possível confirmar as vagas agora. Nenhuma cobrança foi iniciada. Tente novamente.');
    }

    // Transação atômica: usa COUNT(regs) como base quando targetDates fornecido
    // Quando não há datas (modo legado), mantém max(counter, count) por segurança
    try {
        const startSlots = {};
        await runTransaction(window.firebaseDb, async (tx) => {
            const counterDoc = await tx.get(counterRef);
            const counts = counterDoc.exists() ? { ...counterDoc.data() } : {};
            for (const [sched, n] of Object.entries(scheduleCounts)) {
                const normKey     = _normH(sched);
                const fromCounter = Number(counts[normKey]) || Number(counts[sched]) || 0;
                const fromRegs    = Number(regSlotCount[normKey]) || 0;
                // targetDates: COUNT das regs filtradas por data é fonte de verdade
                // sem targetDates: max(counter, count) para compatibilidade
                const current     = targetDates ? fromRegs : Math.max(fromCounter, fromRegs);
                startSlots[sched] = current + 1;
                counts[normKey]   = current + n;
            }
            tx.set(counterRef, counts, { merge: true });
        });
        console.log('[SlotDB] startSlots:', JSON.stringify(startSlots));
        return startSlots;
    } catch (txErr) {
        console.warn('[SlotDB] Não foi possível alocar a vaga:', txErr.code || 'erro');
        throw new Error('Não foi possível reservar a vaga agora. Nenhuma cobrança foi iniciada. Tente novamente.');
    }
}

// ===== Helper: calcula o texto do slot (Slot N ou Grupo X • Slot Y) =====
function computeSlotDisplay(slotNumber, vagas, grupos, isLiga, eventType = '') {
    // Modo Liga: exibir letra (A, B, C...) em vez de número
    if (isLiga || String(eventType).toLowerCase() === 'modo-liga') {
        return `Letra ${String.fromCharCode(64 + slotNumber)}`;
    }
    const slotsPerGroup = grupos > 1 ? Math.ceil(vagas / grupos) : vagas;
    if (vagas > 0 && grupos > 1 && slotsPerGroup > 0) {
        const groupNum = Math.ceil(slotNumber / slotsPerGroup);
        const posInGroup = slotNumber - (groupNum - 1) * slotsPerGroup;
        return `Grupo ${groupNum} • Slot ${posInGroup}`;
    }
    return `Slot ${slotNumber}`;
}

// ===== EVENTO GRÁTIS: Inscrição direta com atribuição de slot =====
function _showFreeSlotChoiceModal(rawEventType, cfg, teamsData, datesToUse, selectedTimes, submitBtn, oldText) {
    const overlay = document.createElement('div');
    overlay.id = '_freeSlotChoiceOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';

    const basePrice = cfg.price || 0;
    const priceLabel = basePrice > 0 ? `R$${basePrice.toFixed(2).replace('.', ',')}` : '';

    overlay.innerHTML = `
        <div style="background:#1e293b;border-radius:20px;padding:24px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.6)">
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:28px;margin-bottom:8px">🎉</div>
                <div style="color:#ecd414;font-weight:900;font-size:15px;letter-spacing:0.5px;margin-bottom:6px">VAGA LIBERADA PELO ADMIN</div>
                <div style="color:rgba(255,255,255,0.55);font-size:12px">Como você quer participar deste horário?</div>
            </div>
            <button id="_freeChoiceGratis" style="width:100%;background:rgba(255,255,255,0.06);border:2px solid rgba(255,255,255,0.18);border-radius:14px;padding:16px 14px;text-align:left;cursor:pointer;margin-bottom:10px;display:block">
                <div style="color:#fff;font-size:14px;font-weight:800;margin-bottom:5px">🆓 Jogar Grátis</div>
                <div style="color:rgba(255,255,255,0.5);font-size:11px;line-height:1.5">Entra na sala sem custo.<br>Não concorre a prêmios do evento.</div>
            </button>
            ${basePrice > 0 ? `<button id="_freeChoicePagar" style="width:100%;background:linear-gradient(135deg,#07b7b4,#059669);border:2px solid transparent;border-radius:14px;padding:16px 14px;text-align:left;cursor:pointer;display:block">
                <div style="color:#fff;font-size:14px;font-weight:800;margin-bottom:5px">🏆 Pagar ${priceLabel} e Concorrer</div>
                <div style="color:rgba(255,255,255,0.8);font-size:11px;line-height:1.5">Paga a taxa normal do evento.<br>Concorre às premiações normalmente.</div>
            </button>` : ''}
            <button id="_freeChoiceCancel" style="width:100%;background:transparent;border:none;color:rgba(255,255,255,0.3);font-size:12px;padding:14px 0 0;cursor:pointer">Cancelar</button>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#_freeChoiceGratis')?.addEventListener('click', async () => {
        overlay.remove();
        await handleFreeEventRegistration(rawEventType, cfg, teamsData, datesToUse, selectedTimes, 'lisagem_gratis');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
    });

    overlay.querySelector('#_freeChoicePagar')?.addEventListener('click', () => {
        overlay.remove();
        window._freeSlotForcePay = true;
        const btn = submitBtn || document.getElementById('schedSubmitBtn');
        if (btn) btn.click();
    });

    overlay.querySelector('#_freeChoiceCancel')?.addEventListener('click', () => {
        overlay.remove();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
    });
}

async function handleFreeEventRegistration(rawEventType, cfg, teamsData, datesToUse, selectedTimesArg, overrideStatus) {
    try {
        if (!window.isLoggedIn || !window.firebaseAuth?.currentUser) {
            closeScheduleModal();
            if (typeof openLoginModal === 'function') openLoginModal();
            alert('Faça login para se inscrever.');
            return;
        }

        // Segurança: nunca criar inscrição sem horário selecionado
        if (!selectedTimesArg || selectedTimesArg.length === 0) {
            alert('Selecione pelo menos um horário antes de confirmar.');
            return;
        }

        // Aguardar Firebase ficar pronto (até 3s — já deve estar pronto na hora do clique)
        await waitForFirebase(3000);
        if (!window.firebaseReady || !window.firebaseDb) throw new Error('Não foi possível conectar ao banco de dados. Verifique sua internet e tente novamente.');

        const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        const isLiga = (cfg.modo || '').toUpperCase().includes('LIGA');
        const vagas = cfg.vagas || 0;
        const grupos = Math.max(1, cfg.grupos || 1);
        const slotsPerGroup = grupos > 1 ? Math.ceil(vagas / grupos) : vagas;

        // scheduleSlotCount será pré-populado via transação atômica logo após construir timesByDate/dates
        const scheduleSlotCount = {};

        // Construir timesByDate a partir de selectedTimes
        const timesByDate = {};
        if (selectedTimesArg && selectedTimesArg.length > 0) {
            selectedTimesArg.forEach(item => {
                if (!timesByDate[item.date]) timesByDate[item.date] = [];
                timesByDate[item.date].push(item.schedule);
            });
        }

        const externalRef = `free_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const assignedSlots = []; // { team, slot, schedule }

        const dates = datesToUse && datesToUse.length > 0 ? datesToUse : [Object.keys(timesByDate)[0] || new Date().toISOString().slice(0, 10)];

        // Eventos gratuitos também precisam confirmar vagas antes de criar inscrições.
        for (const date of dates) {
            const selectedSchedules = timesByDate[date] || [];
            const availability = await checkMultipleSlotAvailability(date, selectedSchedules, rawEventType, teamsData.length);
            if (!availability.available) throw new Error(availability.message || 'Não foi possível confirmar as vagas.');
        }

        // Para eventos grátis: leitura direta (sem transações — slotCounters pode não ter permissão)
        {
            const scheduleKeys = new Set();
            for (const _d of dates) {
                for (const _t of (timesByDate[_d] || ['—'])) {
                    scheduleKeys.add(_t !== '—' ? _t : cfg.label);
                }
            }
            if (vagas > 0 && scheduleKeys.size > 0) {
                // Ler somente inscrições das datas desta compra, não o histórico do evento.
                try {
                    const registrationDocs = await fetchRegistrationDocsForDates(
                        rawEventType,
                        dates,
                        { collection, query, where, getDocs }
                    );
                    registrationDocs.forEach(d => {
                        const r = d.data();
                        if (!r.schedule) return;
                        // Filtrar por data (evita slots históricos de datas anteriores)
                        if (!dates.includes(r.date)) return;
                        const sn = Number(r.slotNumber || r.slot || 0);
                        // Ignorar timestamps gravados como slot (> 9999)
                        if (!isNaN(sn) && sn > 0 && sn <= 9999 && sn > (scheduleSlotCount[r.schedule] || 0)) {
                            scheduleSlotCount[r.schedule] = sn;
                        }
                    });
                } catch (_) {
                    throw new Error('Não foi possível confirmar as vagas agora. Nenhuma inscrição foi criada. Tente novamente.');
                }
            }
            // Inicializar chaves ausentes em 0 (slots começam em 1 no loop abaixo)
            for (const k of scheduleKeys) {
                if (scheduleSlotCount[k] == null) scheduleSlotCount[k] = 0;
            }
        }

        for (const d of dates) {
            const dayTimes = timesByDate[d] || ['—'];
            for (const schedule of dayTimes) {
                const schedKey = schedule !== '—' ? schedule : cfg.label;

                // Slot counter por horário
                if (!scheduleSlotCount[schedKey]) scheduleSlotCount[schedKey] = 0;

                // Verificar lotação por horário (se não é LIGA)
                if (!isLiga && vagas > 0 && scheduleSlotCount[schedKey] >= vagas) {
                    alert(`Horário ${schedKey} está lotado! Não há mais vagas disponíveis neste horário.`);
                    continue;
                }

                for (const team of teamsData) {
                    scheduleSlotCount[schedKey]++;
                    const slotNumber = scheduleSlotCount[schedKey];

                    if (!isLiga && vagas > 0 && slotNumber > vagas) {
                        throw new Error('Não há vagas suficientes para confirmar todas as reservas. Nenhuma vaga foi confirmada. Reabra a reserva e escolha outro horário.');
                    }

                    let slotDisplay = null;
                    if (!isLiga) {
                        if (rawEventType === 'modo-liga') {
                            slotDisplay = `Letra ${String.fromCharCode(64 + slotNumber)}`;
                        } else if (vagas > 0 && grupos > 1 && slotsPerGroup > 0) {
                            const groupNum = Math.ceil(slotNumber / slotsPerGroup);
                            const posInGroup = slotNumber - (groupNum - 1) * slotsPerGroup;
                            slotDisplay = `Grupo ${groupNum} • Slot ${posInGroup}`;
                        } else {
                            slotDisplay = `Slot ${slotNumber}`;
                        }
                    }

                    try {
                        await addDoc(collection(window.firebaseDb, 'registrations'), {
                            userId: window.firebaseAuth.currentUser.uid,
                            teamName: team.name,
                            leaderName: window.currentUserProfile?.name || team.name,
                            // email sempre = email do usuário logado para fetchUserDocs encontrar em "Meus Pedidos"
                            email: window.firebaseAuth.currentUser.email,
                            teamEmail: team.email,   // email de contato do time (formulário)
                            phone: team.phone,
                            schedule: schedKey,
                            date: d,
                            eventType: rawEventType,
                            ...getActiveEventRegistrationMetadata(),
                            title: isLiga ? `${cfg.label} - ${schedKey}` : `${cfg.label} - ${slotDisplay}`,
                            price: 0,
                            slot: slotNumber,
                            slotNumber: slotNumber,
                            slotDisplay: slotDisplay,
                            status: 'pending',
                            createdAt: serverTimestamp(),
                            external_reference: externalRef,
                            isFreeEvent: true,
                            freeParticipationStatus: overrideStatus || 'confirmed',
                            ...(overrideStatus === 'lisagem_gratis' ? { lisagemGratis: true } : {}),
                            isLiga,
                        });
                    } catch (addErr) {
                        const msg = addErr?.code === 'permission-denied'
                            ? `Permissão negada pelo banco de dados ao salvar inscrição grátis.\nCódigo: ${addErr.code}\nHorário: ${schedKey} | Data: ${d} | Tipo: ${rawEventType}`
                            : `Erro ao salvar inscrição: ${addErr?.message || addErr}`;
                        alert(msg);
                        throw addErr;
                    }

                    assignedSlots.push({ team: team.name, slot: slotDisplay, schedule: schedKey, isLiga });
                }
            }
        }

        // Até as inscrições gratuitas são conferidas no servidor antes da liberação.
        await payOrderWithTokens(externalRef, null, 0);
        // Invalidar cache de ocupação para que a barra atualize na próxima abertura
        Object.keys(scheduleCache).forEach(k => delete scheduleCache[k]);

        // Buscar link do WhatsApp do grupo para exibir no modal
        let freeGroupLink = null;
        try {
            if (typeof getWhatsAppLink === 'function') {
                const firstSchedule = assignedSlots[0]?.schedule || null;
                const firstDate = datesToUse?.[0] || null;
                freeGroupLink = await getWhatsAppLink(rawEventType, firstSchedule, firstDate);
            }
        } catch (_) {}

        closeScheduleModal();
        showSlotConfirmationModal(assignedSlots, cfg.label, isLiga, rawEventType, null, externalRef);

    } catch (err) {
        console.error('Erro ao registrar inscrição gratuita:', err);
        alert('Erro ao confirmar inscrição. Tente novamente.');
    }
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        [880, 1100, 1320].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.connect(gain);
            osc.frequency.value = freq;
            osc.start(ctx.currentTime + i * 0.13);
            osc.stop(ctx.currentTime + i * 0.13 + 0.2);
        });
    } catch (_) {}
}

function showSlotConfirmationModal(slots, eventName, isLiga, eventId, groupLink, accessReference = null) {
    const existing = document.getElementById('slotConfirmModal');
    if (existing) existing.remove();
    playNotificationSound();
    const teamLabel = slot => String(slot.team || slot.teamName || slot.name || 'Seu time')
        .replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const escapeLabel = value => String(value).replace(/[&<>"']/g, character =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

    // Agrupar por horário
    const bySchedule = Object.create(null);
    slots.forEach(s => {
        const key = s.schedule || eventName;
        if (!bySchedule[key]) bySchedule[key] = [];
        bySchedule[key].push(s);
    });

    const schedules = Object.keys(bySchedule);

    const slotsHtml = schedules.map(sched => {
        const rows = bySchedule[sched].map(s =>
            `<div class="flex items-center gap-3 p-2 bg-green-50 border border-green-200 rounded-lg mb-1"><span class="text-xl">✅</span><div class="flex-1 font-semibold text-gray-800 text-sm">${teamLabel(s)}</div></div>`
        ).join('');
        return `<div class="p-3 bg-gray-50 border border-gray-200 rounded-xl"><div class="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center justify-center gap-1 text-center">⏰ Horário: <span class="text-blue-800">${escapeLabel(sched)}</span></div>${rows}</div>`;
    }).join('');

    const div = document.createElement('div');
    div.id = 'slotConfirmModal';
    div.className = 'fixed inset-0 bg-black bg-opacity-60 z-[200] flex items-center justify-center p-4';
    div.innerHTML = `
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="text-center mb-5">
                <div class="text-5xl mb-2">🎉</div>
                <h3 class="text-xl font-bold text-gray-900">Vaga confirmada</h3>
                <p class="text-gray-500 text-sm mt-1">${escapeLabel(eventName)}</p>
            </div>
            <div class="space-y-3 mb-6">${slotsHtml}</div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 mb-4 text-center">
                💡 Você receberá a lista de Slots junto com o ID E SENHA no GRUPO!
            </div>
            <div class="flex flex-col gap-2">
                ${accessReference ? '<div id="confirmedEventAccessLinks" class="flex flex-col gap-2 p-3 rounded-xl bg-teal-50 border border-teal-200" role="status" aria-live="polite">Consultando os links dos horários confirmados...</div>' : ''}
                <button onclick="document.getElementById('slotConfirmModal').remove()"
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-base transition-colors">
                    OK, entendido! 👍
                </button>
            </div>
        </div>`;
    document.body.appendChild(div);
    if (accessReference) {
        const target = div.querySelector('#confirmedEventAccessLinks');
        import('./js/event-access-client.mjs')
            .then(({ mountReferenceAccess }) => mountReferenceAccess(target, accessReference))
            .catch(() => {
                if (target?.isConnected) target.textContent = 'Sua vaga está confirmada. Consulte o link em Minha conta > Pedidos.';
            });
    }
}


function normalizeHour(h) {
    if (!h) return null;
    const s = String(h).toLowerCase().trim();
    const m = s.match(/(\d{1,2})/);
    return m ? `${parseInt(m[1], 10)}h` : s;
}

// XTreino Gratuito: abrir WhatsApp com mensagem
function openFreeWhatsModal() {
    const modal = document.getElementById('freeWhatsModal');
    const link = document.getElementById('freeWhatsLink');
    const number = '5581986103152'; // ajuste se necessário
    const message = 'Vim do site e quero uma vaga gratuita. Quais horários têm disponível?';
    if (link) link.href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    if (modal) modal.classList.remove('hidden');
    if (window.innerWidth <= 767) document.body.classList.add('modal-open-mobile');
}
function closeFreeWhatsModal() {
    const modal = document.getElementById('freeWhatsModal');
    if (modal) modal.classList.add('hidden');
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}

// Modal confirmação
function openPaymentConfirmModal(title, msg, groupLink) {
    
    const m = document.getElementById('paymentConfirmModal');
    const t = document.getElementById('paymentConfirmTitle');
    const p = document.getElementById('paymentConfirmMsg');
    const g = document.getElementById('paymentGroupBtn');
    const payBtn = document.getElementById('paymentPayNowBtn');
    const acctBtn = document.getElementById('paymentGoAccountBtn');

    if (!m) {
        
        return;
    }

    if (t) t.textContent = title || 'Pagamento';
    if (p) p.textContent = msg || '';
    if (g) {
        if (groupLink) { g.href = groupLink; g.classList.remove('hidden'); }
        else { g.classList.add('hidden'); }
    }

    // Lógica dos botões conforme o estado
    const isProcessing = String(title || '').toLowerCase().includes('processamento') || String(title || '').toLowerCase().includes('pendente');
    const lastUrl = (() => { try { return sessionStorage.getItem('lastCheckoutUrl') || ''; } catch (_) { return ''; } })();

    if (payBtn) {
        if (isProcessing && lastUrl) {
            payBtn.classList.remove('hidden');
            payBtn.onclick = function () {
                const u = (() => { try { return sessionStorage.getItem('lastCheckoutUrl'); } catch (_) { return null; } })();
                if (u) { window.location.href = u; }
                else { alert('Link de pagamento indisponível. Volte ao produto para gerar um novo.'); }
            };
        } else {
            payBtn.classList.add('hidden');
            payBtn.onclick = null;
        }
    }
    if (acctBtn) {
        if (isProcessing) { acctBtn.classList.add('hidden'); } else { acctBtn.classList.remove('hidden'); }
    }
    // Garantir centralização: container precisa estar em display:flex
    m.classList.remove('hidden');
    m.classList.add('flex');
    
}
function closePaymentConfirmModal() {
    const m = document.getElementById('paymentConfirmModal');
    if (m) m.classList.add('hidden');
}

// Verificar status do pagamento via API do Mercado Pago
async function checkPaymentStatus(preferenceId) {
    const extRef = sessionStorage.getItem('lastExternalRef') || preferenceId;
    if (!extRef) return;

    sessionStorage.setItem('checkingPayment', 'true');

    // ── 1. FIRESTORE DIRETO (fonte principal) ──────────────────────────────
    // Webhook do MP já pode ter atualizado o status antes de chegarmos aqui.
    // Não depende do Netlify — funciona mesmo com créditos esgotados.
    if (window.firebaseDb) {
        try {
            const { collection, query: _q, where: _w, getDocs: _gd } =
                await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const _snap = await _gd(_q(
                collection(window.firebaseDb, 'registrations'),
                _w('external_reference', '==', extRef)
            ));
            if (!_snap.empty) {
                const statuses = _snap.docs.map(d => d.data().status);
                if (statuses.some(s => s === 'paid')) {
                    try { localStorage.removeItem('_pendingPagamento'); } catch(_) {}
                    processSuccessfulPayment(extRef);
                    return;
                }
                if (statuses.some(s => s === 'rejected')) {
                    try { localStorage.removeItem('_pendingPagamento'); } catch(_) {}
                    openPaymentConfirmModal('Pagamento Rejeitado', 'Seu pagamento foi rejeitado. Tente novamente ou use outro método de pagamento.');
                    return;
                }
            }
        } catch (_fErr) {
            console.warn('[checkPaymentStatus] Firestore check falhou:', _fErr?.message);
        }
    }

    // ── 2. NETLIFY (otimização — confirma antes do webhook chegar) ─────────
    // Se o Netlify estiver indisponível (créditos esgotados, timeout, etc.),
    // apenas agenda novo polling via Firestore — nunca interrompe o fluxo.
    try {
        const response = await authenticatedPaymentFetch('/.netlify/functions/confirm-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ external_reference: extRef }),
            signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
        });

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'paid' || data.status === 'already_paid') {
                try { localStorage.removeItem('_pendingPagamento'); } catch(_) {}
                processSuccessfulPayment(extRef);
                return;
            } else if (data.status === 'rejected') {
                try { localStorage.removeItem('_pendingPagamento'); } catch(_) {}
                openPaymentConfirmModal('Pagamento Rejeitado', 'Seu pagamento foi rejeitado. Tente novamente ou use outro método de pagamento.');
                return;
            }
            // pending ou outro status → polling abaixo
        } else {
            // HTTP 4xx/5xx (ex: créditos Netlify esgotados) → silencioso, retry via Firestore
            console.warn('[checkPaymentStatus] Netlify retornou', response.status, '— continuando com polling Firestore');
        }
    } catch (_nErr) {
        // Erro de rede / timeout → silencioso, retry via Firestore
        console.warn('[checkPaymentStatus] Netlify indisponível:', _nErr?.message || _nErr);
    }

    // ── 3. POLLING — tentar novamente em 12s ──────────────────────────────
    // Continua enquanto o pagamento estiver pendente, independente do Netlify.
    setTimeout(() => checkPaymentStatus(preferenceId), 12000);
}

async function confirmTokenPurchaseWithBackend(externalReference) {
    const user = window.firebaseAuth?.currentUser;
    if (!user || typeof user.getIdToken !== 'function') {
        return { status: 'auth_required' };
    }

    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/.netlify/functions/confirm-token-purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify({ external_reference: externalReference })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) return { status: 'not_found' };
        if (!response.ok && data.status !== 'needs_review') {
            return { status: 'unavailable', message: data.error };
        }
        return data;
    } catch (_) {
        return { status: 'unavailable' };
    }
}

async function processSuccessfulPayment(externalRef = null) {
    const extRef = externalRef || sessionStorage.getItem('lastExternalRef');
    if (!extRef) return;
    // A URL de retorno é apenas um aviso. O servidor consulta o Mercado Pago.
    try {
        const { confirmPayment, paymentCompleted } = await import('./js/payment-client.js');
        const result = await confirmPayment(window.firebaseAuth?.currentUser, extRef);
        if (!paymentCompleted(result)) {
            sessionStorage.setItem('lastExternalRef', extRef);
            showToast(result.status === 'needs_review' ? 'warning' : 'info',
                result.message || 'Pagamento ainda em confirmação. O pedido só será liberado após a conferência do servidor.',
                'Confirmando pagamento', 8000);
            return;
        }
        if (result.status === 'credited' || result.status === 'already_credited') {
            if (window.currentUserProfile && Number.isFinite(Number(result.balance))) {
                window.currentUserProfile.tokens = Number(result.balance);
                updateHeaderTokenBadges();
            }
            sessionStorage.removeItem('lastExternalRef');
            showToast('success', 'Tokens creditados no saldo da sua conta.', 'Compra confirmada', 8000);
            return;
        }
        if (extRef.startsWith('digital_')) {
            sessionStorage.removeItem('lastExternalRef');
            localStorage.removeItem('_pendingPagamento');
            showToast('success', 'Pagamento confirmado. Confira seu pedido e os arquivos em Minha Conta.', 'Compra confirmada', 8000);
            return;
        }
    } catch (error) {
        sessionStorage.setItem('lastExternalRef', extRef);
        showToast('info', error.message || 'Não foi possível confirmar agora. Tente novamente.', 'Confirmando pagamento', 8000);
        return;
    }

    // Limpar sessão imediatamente para não reprocessar em futuras visitas
    try {
        sessionStorage.removeItem('lastExternalRef');
        sessionStorage.removeItem('lastRegId');
        sessionStorage.removeItem('lastRegIds');
    } catch (_) {}

    const { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch } =
        await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

    // ── PASSO 1: Ler registrations pelo external_reference (list é público) ──
    let snap;
    try {
        const regsRef = collection(window.firebaseDb, 'registrations');
        snap = await getDocs(query(regsRef, where('external_reference', '==', extRef)));
    } catch (readErr) {
        console.error('[processSuccessfulPayment] Erro ao ler registrations:', readErr);
        return;
    }

    // ── PASSO 1b: Se não há registrations, tentar atualizar pedido de produto ──
    if (!snap || snap.empty) {
        try {
            // Extrair o ID do pedido diretamente do external_reference (formato: "digital_<orderId>")
            // Isso evita uma query por external_reference que seria bloqueada pelas regras do Firestore
            let orderDoc = null;
            let orderData2 = null;
            const { getDoc: _getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

            if (extRef && extRef.startsWith('digital_')) {
                const orderId = extRef.replace('digital_', '');
                const snap2 = await _getDoc(doc(window.firebaseDb, 'orders', orderId));
                if (snap2.exists()) {
                    orderDoc = snap2;
                    orderData2 = snap2.data();
                }
            }

            // Fallback: buscar por external_reference + userId (query segura pelas regras)
            if (!orderDoc) {
                const currentUid2 = window.firebaseAuth?.currentUser?.uid;
                if (currentUid2) {
                    const ordersRef2 = collection(window.firebaseDb, 'orders');
                    const qSnap = await getDocs(query(ordersRef2,
                        where('external_reference', '==', extRef),
                        where('userId', '==', currentUid2)
                    ));
                    if (!qSnap.empty) {
                        orderDoc = qSnap.docs[0];
                        orderData2 = qSnap.docs[0].data();
                    }
                }
            }

            if (orderDoc && orderData2) {
                const isTokenOrder = orderData2.type === 'tokens_purchase'
                    || String(orderData2.title || '').toLowerCase().includes('token')
                    || String(orderData2.item || '').toLowerCase().includes('token');
                if (isTokenOrder) {
                    const result = await confirmTokenPurchaseWithBackend(extRef);
                    if (result.status === 'credited' || result.status === 'already_credited') {
                        const balance = Number(result.balance);
                        if (Number.isFinite(balance) && window.currentUserProfile) {
                            window.currentUserProfile.tokens = balance;
                            try {
                                localStorage.setItem('assoc_profile', JSON.stringify(window.currentUserProfile));
                            } catch (_) {}
                        }
                        if (typeof updateHeaderTokenBadges === 'function') updateHeaderTokenBadges();
                        if (typeof showToast === 'function') {
                            showToast(
                                'success',
                                `${result.quantity || orderData2.quantity || 0} tokens confirmados. Saldo: ${result.balance}`,
                                'Tokens creditados',
                                8000
                            );
                        }
                    } else if (result.status === 'pending' || result.status === 'unavailable' || result.status === 'auth_required') {
                        try { sessionStorage.setItem('lastExternalRef', extRef); } catch (_) {}
                        if (typeof showToast === 'function') {
                            showToast('info', 'O pagamento ainda está sendo confirmado. O saldo será atualizado automaticamente.', 'Pagamento em processamento', 8000);
                        }
                    } else if (result.status === 'needs_review') {
                        try { sessionStorage.setItem('lastExternalRef', extRef); } catch (_) {}
                        if (typeof showToast === 'function') {
                            showToast('warning', result.message || 'O pagamento precisa de conferência antes de liberar os tokens.', 'Verificação necessária', 9000);
                        }
                    } else if (result.status === 'not_found') {
                        if (typeof showToast === 'function') {
                            showToast('warning', 'Este pedido antigo não está vinculado ao checkout seguro. O saldo não foi alterado; entre em contato com o suporte.', 'Compra em verificação', 10000);
                        }
                    } else if (typeof showToast === 'function') {
                        try { sessionStorage.setItem('lastExternalRef', extRef); } catch (_) {}
                        showToast('info', 'Não foi possível confirmar o pagamento agora. Tente novamente em instantes.', 'Pagamento em processamento', 8000);
                    }
                    return;
                }

                // Registrar comissão e cupom ANTES de tentar atualizar status
                // Fallback: se a order não tem affiliateCode, tenta sessionStorage → localStorage
                const _orderAff = orderData2.affiliateCode
                    || sessionStorage.getItem('xf_pending_aff')
                    || getActiveAffiliateCode(null);
                if (_orderAff) { try { sessionStorage.removeItem('xf_pending_aff'); } catch(_) {} }
                if (orderData2.couponId && orderData2.couponCode) {
                    try {
                        await recordCouponUsage(
                            orderData2.couponId,
                            orderData2.couponCode,
                            orderData2.originalPrice || orderData2.amount || 0,
                            orderData2.couponDiscount || 0,
                            'store',
                            orderDoc.id,
                            { productId: orderData2.productId, name: orderData2.title }
                        );
                    } catch (_) {}
                }
                // Atualizar status do pedido
                if (orderData2.status !== 'paid') {
                    try {
                        await updateDoc(doc(window.firebaseDb, 'orders', orderDoc.id), {
                            status: 'paid',
                            paidAt: serverTimestamp()
                        });
                    } catch (updateErr) {
                        console.warn('[processSuccessfulPayment] Sem permissão para atualizar status (admin precisa aprovar manualmente):', updateErr?.code || updateErr?.message);
                        if (typeof showToast === 'function') {
                            showToast('success', 'Pagamento aprovado pelo Mercado Pago! Em breve seu produto estará disponível em Minha Conta → Meus Produtos.', 'Pagamento Aprovado ✅', 10000);
                        }
                        return;
                    }
                }
                // Notificar cliente
                if (typeof showToast === 'function') {
                    showToast('success', 'Pagamento confirmado! Acesse Minha Conta → Meus Produtos.', 'Pagamento Aprovado ✅');
                }
            }
        } catch (prodErr) {
            console.warn('[processSuccessfulPayment] Erro ao atualizar pedido de produto:', prodErr?.code || prodErr?.message);
            if (typeof showToast === 'function') {
                showToast('success', 'Pagamento aprovado! Em breve seu produto estará disponível em Meus Produtos.', 'Pagamento Aprovado ✅', 10000);
            }
        }
        return;
    }

    // ── PASSO 2: Coletar dados para o modal ──
    const assignedSlots = [];
    let regEventName = '', regIsLiga = false, regEventType = '', groupLink = null;
    const currentUid = window.firebaseAuth?.currentUser?.uid || null;

    snap.forEach(d => {
        const data = d.data();
        // Filtrar por userId se disponível (segurança extra no cliente)
        if (currentUid && data.userId && data.userId !== currentUid) return;
        if (!regEventType) {
            regEventType = data.eventType || '';
            regIsLiga    = data.isLiga || false;
            const _tParts = (data.title || '').split(' - ');
            regEventName = _tParts.length > 1
                ? _tParts.slice(0, -1).join(' - ')
                : (data.title || data.eventType || 'Evento');
        }
        assignedSlots.push({
            team:     data.teamName || data.email || 'Time',
            slot:     data.slotDisplay || null,
            schedule: data.schedule || '',
            isLiga:   data.isLiga || false
        });
        if (!groupLink && data.groupLink) groupLink = data.groupLink;
    });

    // ── PASSO 3: Exibir modal de confirmação imediatamente ──
    if (assignedSlots.length > 0 && typeof showSlotConfirmationModal === 'function') {
        try { Object.keys(scheduleCache).forEach(k => delete scheduleCache[k]); } catch (_) {}
        let paidGroupLink = groupLink;
        if (!paidGroupLink && typeof getWhatsAppLink === 'function') {
            try { paidGroupLink = await getWhatsAppLink(regEventType, assignedSlots[0]?.schedule || null, null); } catch (_) {}
        }
        setTimeout(() => {
            showSlotConfirmationModal(assignedSlots, regEventName, regIsLiga, regEventType, null, extRef);
        }, 400);
    }

    showToast('success', 'Pagamento confirmado no servidor. Confira Meus Pedidos.', 'Compra confirmada');
}

function closeTokensModal() {
    const modal = document.getElementById('tokensModal');
    if (modal) modal.classList.add('hidden');
    if (window.innerWidth <= 767) maybeClearMobileModalState();
}

async function useTokensForEvent(eventType, totalReservations, finalPrice, teamsData, selectedTimes, datesToUse, availabilitySelection = null) {
    // Capturar cupom IMEDIATAMENTE (appliedScheduleCoupon pode ser zerado por closeScheduleModal)
    const _capturedTokenCoupon = appliedScheduleCoupon ? { ...appliedScheduleCoupon, _origPrice: scheduleOriginalTotal || finalPrice } : null;

    // Verificar saldo (redundante, mas seguro)
    if (!canSpendTokens(finalPrice)) {
        showErrorToast('Saldo insuficiente', 'TOKEN_001');
        return;
    }

    // Construir timesByDate a partir de selectedTimes
    const timesByDate = {};
    selectedTimes.forEach(item => {
        if (!timesByDate[item.date]) timesByDate[item.date] = [];
        timesByDate[item.date].push(item.schedule);
    });

    // Direct calls still check availability. The normal submit has just checked it.
    const availabilityVerified = availabilitySelection?.eventType === eventType
        && availabilitySelection.numberOfTeams === teamsData.length
        && datesToUse.every(d => (timesByDate[d] || []).every(schedule =>
            availabilitySelection.timesByDate?.[d]?.includes(schedule)));
    if (!availabilityVerified) {
        const checks = await Promise.all(datesToUse.filter(d => (timesByDate[d] || []).length)
            .map(d => checkMultipleSlotAvailability(d, timesByDate[d], eventType, teamsData.length)));
        for (const check of checks) {
            if (!check.available) {
                showErrorToast(check.message || 'Horário indisponível', 'EVENT_001');
                return;
            }
        }
    }

    // Criar reservas pendentes; débito e confirmação são uma única transação.
    const externalRef = `tokens_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    try {
        const { regIds, assignedSlots: assignedSlotsTokens } = await createRegistrationsForEvent(eventType, datesToUse, teamsData, timesByDate, externalRef, 'pending', appliedScheduleCoupon);
        await payOrderWithTokens(externalRef, _capturedTokenCoupon?.code || null, finalPrice);

        // Coupon reporting must not delay an already committed payment.
        if (_capturedTokenCoupon) {
            void (async () => { try {
                const origPriceTokens = scheduleOriginalTotal || (_capturedTokenCoupon._origPrice || finalPrice);
                const discountAmtTokens = Math.max(0, origPriceTokens - finalPrice);
                const cfgTokensLabel = (scheduleConfig[eventType] || {}).label || eventType;
                await recordCouponUsage(
                    _capturedTokenCoupon.id,
                    _capturedTokenCoupon.code,
                    origPriceTokens,
                    discountAmtTokens,
                    'events',
                    externalRef,
                    { productId: eventType, name: cfgTokensLabel }
                );
            } catch (error) { console.warn('[Cupom tokens] Falha no relatório:', error?.code || error?.message); } })();
        }

        closeScheduleModal();

        // Invalidar cache de ocupação para que a barra atualize na próxima abertura
        Object.keys(scheduleCache).forEach(k => delete scheduleCache[k]);

        const cfgTokens = scheduleConfig[eventType] || {};
        const isLigaTokens = cfgTokens.isLiga || false;

        if (typeof showSlotConfirmationModal === 'function' && assignedSlotsTokens.length > 0) {
            // Access links load independently inside the confirmation modal.
            showSlotConfirmationModal(assignedSlotsTokens, cfgTokens.label || eventType, isLigaTokens, eventType, null, externalRef);
        } else {
            showSuccessToast('Pagamento com tokens confirmado! Verifique seus pedidos.', 'Sucesso');
        }
    } catch (error) {
        showErrorToast(error.message || 'Não foi possível concluir. Confira Meus Pedidos antes de tentar novamente.', 'ERRO');
    }
}

async function loadCampSemifinalLinksFromFirestore() {
    if (!window.firebaseDb) return {};
    if (campSemifinalLinksCache.data && (Date.now() - campSemifinalLinksCache.timestamp) < CAMP_SEMIFINAL_LINK_CACHE_TTL) {
        return campSemifinalLinksCache.data;
    }
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDocs(collection(window.firebaseDb, 'camp_semifinal_links'));
        const data = {};
        snap.forEach(doc => { data[doc.id] = doc.data(); });
        campSemifinalLinksCache = { data, timestamp: Date.now() };
        return data;
    } catch (error) {
        
        return campSemifinalLinksCache.data || {};
    }
}

async function getCampSemifinalLinkByDate(date) {
    if (!date) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    if (!normalized || !CAMP_SEMIFINAL_DATES.includes(normalized)) return null;
    const map = await loadCampSemifinalLinksFromFirestore();
    const entry = map[normalized];
    return entry?.link || entry?.url || null;
}

// Função para obter link do WhatsApp dinamicamente
async function getWhatsAppLink(eventType, schedule = null, date = null) {
    // ID/senha agora são enviados direto no site — WhatsApp links não são mais usados
    return null;
    try { // eslint-disable-line no-unreachable
        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        

        const whatsappLinksRef = collection(window.firebaseDb, 'whatsapp_links');
        // Aceitar `eventType` como string ou objeto (compatibilidade com chamadas que passam cfg)
        const rawTypeInput = (typeof eventType === 'object' && eventType !== null) ? (eventType.eventType || eventType.type || eventType.key || eventType.label || '') : eventType;
        // Normalizar parâmetros
        const normalizeType = (t) => String(t || '').toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace('xtreino-tokens', 'xtreino-tokens')
            .replace('xtreino-gratuito', 'xtreino-gratuito')
            .replace('modo-liga', 'modo-liga')
            .replace('camp', 'camp-freitas');
        const normalizeHour = (h) => {
            if (!h) return null;
            const s = String(h).toLowerCase().trim();
            const m = s.match(/(\d{1,2})/);
            return m ? `${parseInt(m[1], 10)}h` : s;
        };
        const type = normalizeType(rawTypeInput);
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

        const normalizedDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : null;
        if (type === 'camp-freitas' && normalizedDate && CAMP_SEMIFINAL_DATES.includes(normalizedDate)) {
            
            const semifinalLink = await getCampSemifinalLinkByDate(normalizedDate);
            if (semifinalLink) {
                
                return semifinalLink;
            }
        }

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
                    const link = specificSnapshot.docs[0].data().link;
                    
                    return link;
                }
            }
            
        }

        // Se não encontrou específico, buscar link geral para o evento
        
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
                    const link = generalSnapshot.docs[0].data().link;
                    
                    return link;
                }
            }
        }

        

        // Fallback: apenas retornar string vazia com log
        return '';

    } catch (error) {
        
        
        return '';
    }
}

// Expor função globalmente
window.getWhatsAppLink = getWhatsAppLink;


async function createRegistrationsForEvent(eventType, datesToUse, teamsData, timesByDate, externalRef, status = 'pending', couponInfo = null) {
    const cfg = getActiveScheduleConfig(eventType);
    const isLiga = (cfg.modo || '').toUpperCase().includes('LIGA');
    const vagas = cfg.vagas || 0;
    const grupos = Math.max(1, cfg.grupos || 1);
    const regIds = [];
    const assignedSlots = [];
    const pendingWrites = [];
    const { collection, addDoc, serverTimestamp, query: _fsQuery, where: _fsWhere, getDocs: _fsGetDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

    // Read only booked dates, sharing this read with slot allocation.
    const existingDocsPromise = fetchRegistrationDocsForDates(eventType, datesToUse, {
        collection, query: _fsQuery, where: _fsWhere, getDocs: _fsGetDocs
    });
    const _dupExistMap = {};
    const collectDuplicates = docs => {
        docs.forEach(d => {
            const rd = d.data();
            const rdEmail = (rd.email || '').trim().toLowerCase();
            // Remove sufixo " B", " C"... para encontrar o nome base
            const rdBase = (rd.teamName || '').trim()
                .replace(/\s+[B-Z]$/i, '')
                .toLowerCase().replace(/\s+/g, ' ');
            // Extrai a hora do horário (ex: "Quarta - 22h" → "22", "22:00" → "22")
            const rdSchedStr = String(rd.schedule || rd.hour || '');
            const rdHourMatch = rdSchedStr.match(/(\d{1,2})/);
            const rdHour = rdHourMatch ? String(parseInt(rdHourMatch[1], 10)).padStart(2, '0') : '';
            if (rdEmail && rdBase) {
                // Chave inclui hora: sufixo só se o mesmo time reservar o MESMO horário
                const k = `${rdBase}|${rdEmail}|${rdHour}`;
                _dupExistMap[k] = (_dupExistMap[k] || 0) + 1;
            }
        });
    };
    // Contador em memória para esta compra (evita conflito quando múltiplas datas compradas de uma vez)
    const _dupBatchCount = {};

    // Preparar contagem de slots por horário
    const _sc = {};
    for (const _d of datesToUse) {
        for (const _t of (timesByDate[_d] || [])) {
            _sc[_t] = (_sc[_t] || 0) + teamsData.length;
        }
    }

    // ── Alocar slots (transação) + upload logos em PARALELO ──────────────
    const [_slotAlloc, _logoMap, existingDocs] = await Promise.all([
        Object.keys(_sc).length > 0
            ? allocateSlotsFromDB(eventType, _sc, datesToUse, existingDocsPromise)
            : Promise.resolve({}),
        (async () => {
            const _map = {};
            await Promise.all(teamsData.map(async team => {
                if (team.logoBase64) {
                    const [url, thumb] = await Promise.all([
                        uploadTeamLogo(team.logoBase64, team.name, eventType),
                        _resizeLogoBase64(team.logoBase64)
                    ]);
                    _map[team.name] = { url, thumb };
                }
            }));
            return _map;
        })(),
        existingDocsPromise
    ]);
    collectDuplicates(existingDocs);

    const slotCount = {};
    for (const [_k, _v] of Object.entries(_slotAlloc)) slotCount[_k] = _v - 1;

    for (const d of datesToUse) {
        const times = timesByDate[d] || [];
        for (let schedule of times) {
            const hour = (schedule.split(' - ')[1] || '').trim();
            const normalizedHour = normalizeHour(hour);
            const price = getEventPrice(eventType, hour, d);
            const whatsappLink = null; // Private access is resolved only after server confirmation.

            for (let team of teamsData) {
                slotCount[schedule] = (slotCount[schedule] || 0) + 1;
                const slotNum = slotCount[schedule];
                const slotDisplay = computeSlotDisplay(slotNum, vagas, grupos, isLiga, eventType);

                // Sufixo automático: mesmo nome + mesmo e-mail + mesmo horário → B, C, D...
                // (times em horários DIFERENTES podem usar o mesmo nome sem sufixo)
                const _teamEmail = (team.email || '').trim().toLowerCase();
                const _teamBase = (team.name || '').trim()
                    .replace(/\s+[B-Z]$/i, '').toLowerCase().replace(/\s+/g, ' ');
                const _dupKey = `${_teamBase}|${_teamEmail}|${normalizedHour || ''}`;
                const _dupTotal = (_dupExistMap[_dupKey] || 0) + (_dupBatchCount[_dupKey] || 0);
                const finalTeamName = _dupTotal > 0
                    ? `${team.name.trim()} ${String.fromCharCode(65 + _dupTotal)}`
                    : team.name;
                _dupBatchCount[_dupKey] = (_dupBatchCount[_dupKey] || 0) + 1;

                const _logoData = _logoMap[team.name];
                const teamLogoUrl = _logoData?.url || null;
                const teamLogoThumb = _logoData?.thumb || _equipeAtual?.logoUrl || null;

                const payload = {
                    userId: window.firebaseAuth.currentUser.uid,
                    teamName: finalTeamName,
                    teamLogoUrl: teamLogoUrl,
                    teamLogoThumb: teamLogoThumb,
                    teamId: _equipeAtual?.id || null,
                    membrosUids: _equipeAtual?.membrosUids || null,
                    leaderName: window.currentUserProfile?.name || team.name,
                    email: team.email,
                    phone: team.phone,
                    schedule: schedule,
                    date: d,
                    eventType: eventType,
                    ...getActiveEventRegistrationMetadata(),
                    title: isLiga ? `${cfg.label} - ${schedule}` : `${cfg.label} - ${slotDisplay || schedule}`,
                    price: price,
                    slot: slotNum,
                    slotNumber: slotNum,
                    slotDisplay: slotDisplay,
                    status: status,
                    createdAt: serverTimestamp(),
                    external_reference: externalRef,
                    groupLink: whatsappLink || null,
                    whatsappLink: whatsappLink || null,
                    hour: normalizedHour || null,
                    affiliateCode: getActiveAffiliateCode(couponInfo?.affiliateId || null),
                    // Dados de pagamento são gravados somente pelo servidor.
                };
                assignedSlots.push({ team: finalTeamName, slot: slotDisplay, schedule, isLiga });
                pendingWrites.push({ payload, affiliate: {
                    amount: price,
                    title: `${cfg.label} - ${schedule}`,
                    customer: team.email,
                    customerName: team.name
                } });
            }
        }
    }
    // Persist every pending reservation before requesting any debit.
    const refs = await Promise.all(pendingWrites.map(({ payload }) =>
        addDoc(collection(window.firebaseDb, 'registrations'), payload)));
    refs.forEach((ref, index) => {
        regIds.push(ref.id);
        assignedSlots[index].regId = ref.id;
    });
    return { regIds, assignedSlots };
}

// --- Edição de Perfil ---
function loadProfileData() {
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

function updateProfile(event) {
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
                    
                })
                .catch((e) => {
                    
                });
        }
    } catch (e) {
        
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
        try {
            if (!window.firebaseReady) { alertBar.classList.add('hidden'); return; }
            const { doc, getDoc, collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const ref = doc(collection(window.firebaseDb, 'config'), 'topAlert');
            const apply = (data) => {
                const enabled = !!data?.enabled;
                const text = data?.text || '';
                if (enabled && text) {
                    alertBar.innerHTML = text;
                    alertBar.classList.remove('hidden');
                } else {
                    alertBar.classList.add('hidden');
                }
            };
            try {
                const snap = await getDoc(ref);
                if (snap.exists()) apply(snap.data()); else alertBar.classList.add('hidden');
            } catch (_) { alertBar.classList.add('hidden'); }
            try {
                onSnapshot(ref, (snap) => { if (snap.exists()) apply(snap.data()); });
            } catch (_) { }
        } catch (_) { /* fallback: manter oculto */ }
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

function maybeClearMobileModalState() {
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

    if (appliedScheduleCoupon) {
        showScheduleCouponMessage('Já existe um cupom aplicado. Remova-o antes de aplicar outro.', 'error');
        return;
    }

    if (!scheduleOriginalTotal || scheduleOriginalTotal <= 0) {
        // Para produtos da loja (sem horário), usar o preço do produto como total
        const modal = document.getElementById('scheduleModal');
        const rawType = modal?.dataset?.eventType || '';
        const cfgCheck = scheduleConfig[rawType] || {};
        if (cfgCheck.isProduct === true && cfgCheck.price > 0) {
            scheduleOriginalTotal = cfgCheck.price;
        } else {
            showScheduleCouponMessage('Selecione ao menos um horário antes de aplicar o cupom.', 'error');
            return;
        }
    }

    try {
        // Aguardar Firebase ficar pronto
        const fbReady = await waitForFirebase(8000);
        if (!fbReady || !window.firebaseDb) {
            showScheduleCouponMessage('Erro de conexão. Recarregue a página e tente novamente.', 'error');
            return;
        }

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
        updateScheduleCouponUI();

        

    } catch (error) {
        
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

    const baseTotal = Number(scheduleOriginalTotal || 0);
    if (!baseTotal || baseTotal <= 0) return;

    let discountAmount = 0;
    if (appliedScheduleCoupon.discountType === 'percentage') {
        discountAmount = baseTotal * (appliedScheduleCoupon.discountValue / 100);
    } else {
        discountAmount = appliedScheduleCoupon.discountValue;
    }

    discountAmount = Math.min(discountAmount, baseTotal);
    const finalTotal = Math.max(0, baseTotal - discountAmount);

    // Mostrar preço original riscado + desconto + preço final
    const parent = totalElement.parentElement;
    if (parent) {
        // Remover linha de desconto anterior se existir
        const prev = parent.querySelector('#schedDiscountLine');
        if (prev) prev.remove();
        const origLine = document.createElement('div');
        origLine.id = 'schedDiscountLine';
        origLine.className = 'flex justify-between items-center text-sm text-gray-500 mb-1';
        origLine.innerHTML = `
            <span>Subtotal:</span>
            <span class="line-through">R$ ${baseTotal.toFixed(2).replace('.', ',')}</span>
        `;
        parent.insertBefore(origLine, totalElement.parentElement.querySelector('.flex.justify-between.items-center:last-child') || totalElement);
        // Adicionar linha de desconto
        const discLine = document.createElement('div');
        discLine.id = 'schedDiscountValue';
        discLine.className = 'flex justify-between items-center text-sm text-green-600 mb-2';
        const discLabel = appliedScheduleCoupon.discountType === 'percentage'
            ? `Desconto (${appliedScheduleCoupon.discountValue}%)`
            : `Desconto (${appliedScheduleCoupon.code})`;
        discLine.innerHTML = `<span>${discLabel}:</span><span>- R$ ${discountAmount.toFixed(2).replace('.', ',')}</span>`;
        // Verificar se já existe e remover antes de inserir
        const prevDisc = parent.querySelector('#schedDiscountValue');
        if (prevDisc) prevDisc.remove();
        parent.insertBefore(discLine, parent.querySelector('.flex.justify-between.items-center:last-child') || totalElement);
    }

    totalElement.textContent = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
    totalElement.classList.add('text-green-700');
}

function removeScheduleCoupon() {
    if (!appliedScheduleCoupon) return;
    const removedCode = appliedScheduleCoupon.code;
    appliedScheduleCoupon = null;
    const totalElement = document.getElementById('totalPrice');
    if (totalElement) {
        const base = Number(scheduleOriginalTotal || 0);
        totalElement.textContent = `R$ ${base.toFixed(2).replace('.', ',')}`;
        totalElement.classList.remove('text-green-700');
        // Remover linhas de desconto inseridas ao aplicar o cupom
        const parent = totalElement.parentElement;
        if (parent) {
            const dl = parent.querySelector('#schedDiscountLine');
            const dv = parent.querySelector('#schedDiscountValue');
            if (dl) dl.remove();
            if (dv) dv.remove();
        }
    }
    updateScheduleCouponUI();
    showScheduleCouponMessage(`Cupom "${removedCode}" removido`, 'success');
}

function updateScheduleCouponUI() {
    const input = document.getElementById('schedCouponCodeInput');
    const applyBtn = document.getElementById('applyScheduleCouponBtn');
    const removeBtn = document.getElementById('removeScheduleCouponBtn');
    if (!input || !applyBtn || !removeBtn) return;

    if (appliedScheduleCoupon) {
        input.value = appliedScheduleCoupon.code;
        input.disabled = true;
        applyBtn.disabled = true;
        applyBtn.textContent = 'Aplicado';
        applyBtn.classList.add('opacity-60', 'cursor-not-allowed');
        removeBtn.classList.remove('hidden');
    } else {
        input.disabled = false;
        applyBtn.disabled = false;
        applyBtn.textContent = 'Aplicar';
        applyBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        removeBtn.classList.add('hidden');
        input.value = '';
    }
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
async function recordCouponUsage(couponId, couponCode, orderValue, discountAmount, context, orderId, productInfo = null) {
    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Sanitizar: undefined → null (Firestore ignora undefined silenciosamente)
        const _s = v => (v === undefined ? null : v);

        const usageData = {
            couponId: _s(couponId),
            couponCode: _s(couponCode),
            customerEmail: window.currentUser?.email || window.firebaseAuth?.currentUser?.email || 'guest',
            customerName: window.currentUser?.displayName || window.firebaseAuth?.currentUser?.displayName || 'Cliente',
            orderValue: Number(orderValue) || 0,
            discountAmount: Number(discountAmount) || 0,
            finalValue: (Number(orderValue) || 0) - (Number(discountAmount) || 0),
            context: _s(context),
            orderId: _s(orderId),
            usedAt: new Date(),
            userId: _s(window.currentUser?.uid || window.firebaseAuth?.currentUser?.uid),
            // Informações do produto
            productId: _s(productInfo?.productId || productInfo?.id),
            productName: _s(productInfo?.name || productInfo?.title || productInfo?.item),
            discountPercentage: (Number(orderValue) > 0 ? ((Number(discountAmount) / Number(orderValue)) * 100).toFixed(2) : '0.00')
        };

        await addDoc(collection(window.firebaseDb, 'couponUsage'), usageData);

        // Atualizar contador de uso do cupom
        await updateCouponUsageCount(couponId);

        
    } catch (error) {
        
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

        
    } catch (error) {
        
    }
}

function setImageProducts(productId, product){
    if (imgMap[productId]) {               
            imgMap[productId].image = product.image;             
            
    } else {        
        imgMap[productId] = {                   
            image: product.image
        };
    }
    
}


function setScheduleConfig(productId, product) {
    const base = {
        label: product.name,
        price: Number(product.price) || 0,
        isProduct: true,
        description: product.description,
        details: product.details,
        benefits: product.benefits,
        image: product.image,
        category: product.category,
        downloadLink: product.downloadLink,
        downloadLinks: product.downloadLinks || {}
    };
    if (scheduleConfig[productId]) {
        scheduleConfig[productId] = { ...scheduleConfig[productId], ...base,
            label: product.name || scheduleConfig[productId].label,
            price: Number(product.price) || scheduleConfig[productId].price
        };
    } else {
        scheduleConfig[productId] = base;
    }
}

function setProducts(productId, product) {
    const base = {
        name: product.name,
        price: Number(product.price) || 0,
        isProduct: true,
        description: product.description,
        details: product.details,
        benefits: product.benefits,
        image: product.image,
        category: product.category,
        downloadLink: product.downloadLink
    };
    if (products[productId]) {
        products[productId] = { ...products[productId], ...base,
            name: product.name || products[productId].name,
            price: Number(product.price) || products[productId].price
        };
    } else {
        products[productId] = base;
    }
}

async function loadProductsFromFirestore() {
    try {
        if (!window.firebaseDb) {
            
            return;
        }

        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const productsRef = collection(window.firebaseDb, 'products');
        // Busca apenas produtos ativos (campo active = true)
        const q = query(productsRef, where('active', '==', true));
        const snapshot = await getDocs(q);

        const container = document.getElementById('productsContainer');
        if (!container) return;

        if (snapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhum produto disponível no momento.</p>';
            return;
        }

        const normalizeProductOrderText = value => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const getProductDisplayRank = (productId, product) => {
            const id = normalizeProductOrderText(productId);
            const name = normalizeProductOrderText(product.name || product.label);
            const category = normalizeProductOrderText(product.category);
            const searchable = `${id} ${name} ${category}`;
            if (searchable.includes('sensibilidade')) return 0;
            if (searchable.includes('passe') || searchable.includes('booyah')) return 1;
            if (searchable.includes('imagem') || searchable.includes('aerea')) return 2;
            if (searchable.includes('planilha')) return 3;
            if (searchable.includes('camisa') || searchable.includes('manto org')) return 4;
            return 5;
        };
        const orderedProducts = snapshot.docs
            .map((doc, originalIndex) => {
                const product = doc.data();
                return {
                    doc,
                    product,
                    originalIndex,
                    rank: getProductDisplayRank(doc.id, product)
                };
            })
            .sort((a, b) => a.rank - b.rank || a.originalIndex - b.originalIndex);

        let html = '';
        orderedProducts.forEach(({ doc, product }) => {
            const productId = doc.id;
 
            setScheduleConfig(productId, product);
            setProducts(productId, product);

            // Define badge (destaque) se existir
            let badgeHtml = '';
            if (product.badge) {
                const badgeColor = product.badgeColor || 'bg-yellow-400 text-black';
                badgeHtml = `<div class="absolute top-4 right-4 ${badgeColor} text-xs font-bold px-2 py-1 rounded">${product.badge}</div>`;
            }

            // Define ícone/indicador de categoria
            const catVal = (product.category || '').toLowerCase();
            const catLabel = catVal === 'fisico' || catVal === 'physical' ? 'Físico'
                : catVal === 'servico' || catVal === 'service' ? 'Serviço'
                : 'Digital';
            const categoryIcon = `<span class="text-sm text-gray-500">${catLabel}</span>`;

            // Imagem (usa imagem padrão se não houver)
            const imageUrl = product.image || 'assets/images/Logo - Xtreino Freitas.png';

            // Preço seguro
            const priceNum = Number(product.price) || 0;

            // Descrição completa — só exibida quando o cliente clicar em "Ver detalhes"
            const fullDesc = (product.description || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const detailsBtn = fullDesc ? `
                <button onclick="toggleProductDesc('${productId}',this)"
                    style="display:inline-flex;align-items:center;gap:5px;color:#16a34a;font-size:0.82rem;font-weight:600;cursor:pointer;background:none;border:1px solid #16a34a;border-radius:6px;padding:4px 10px;margin-bottom:10px;outline:none;">
                    <i class="fas fa-chevron-down" style="font-size:10px"></i> Ver detalhes
                </button>
                <div id="pdesc_${productId}" style="display:none;margin-bottom:10px;">
                    <div style="font-size:0.82rem;color:#374151;white-space:pre-wrap;line-height:1.55;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">${fullDesc}</div>
                </div>` : '';

            html += `
                <div class="product-card relative">
                    ${badgeHtml}
                    <div class="product-media">
                        <img src="${imageUrl}" alt="${product.name}" loading="eager">
                    </div>
                    <div class="product-title">${product.name}</div>
                    <div class="product-meta flex justify-between items-center mb-2">
                        <span class="text-2xl font-bold text-blue-matte">R$ ${priceNum.toFixed(2)}</span>
                        ${categoryIcon}
                    </div>
                    ${detailsBtn}
                    <button onclick="openScheduleModal('${productId}')" class="w-full btn-primary py-2 rounded-lg font-semibold transition-colors">
                        COMPRAR
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;

        // Reaplica animações se necessário
        if (typeof reinitAnimations === 'function') {
            reinitAnimations(container);
        }

    } catch (error) {
        const container = document.getElementById('productsContainer');
        if (!container) return;
        const isPermission = error && (error.code === 'permission-denied' ||
            (error.message || '').toLowerCase().includes('permission'));
        if (isPermission) {
            // Regra do Firestore ainda não publicada ou token expirado — tentar de novo em 3s
            setTimeout(() => {
                const pc = document.getElementById('productsContainer');
                if (pc && (pc.children.length === 0 || pc.querySelector('.text-red-500'))) {
                    loadProductsFromFirestore();
                }
            }, 3000);
            container.innerHTML = '<p class="col-span-full text-center text-gray-400">Carregando produtos...</p>';
        } else {
            container.innerHTML = '<p class="col-span-full text-center text-red-500">Erro ao carregar produtos. Tente novamente mais tarde.</p>';
        }
    }
}

// Alternar exibição da descrição nos cards da loja
function toggleProductDesc(productId, btn) {
    const desc = document.getElementById('pdesc_' + productId);
    if (!desc) return;
    const isOpen = desc.style.display !== 'none';
    desc.style.display = isOpen ? 'none' : 'block';
    btn.innerHTML = isOpen
        ? '<i class="fas fa-chevron-down" style="font-size:10px"></i> Ver detalhes'
        : '<i class="fas fa-chevron-up" style="font-size:10px"></i> Ocultar detalhes';
}
window.toggleProductDesc = toggleProductDesc;

window.applyCoupon = applyCoupon;
window.applyScheduleCoupon = applyScheduleCoupon;
window.removeScheduleCoupon = removeScheduleCoupon;
window.recordCouponUsage = recordCouponUsage;
window.openScheduleModal = openScheduleModal;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
//window.openTokensModal = openTokensModal;
window.closeTokensModal = closeTokensModal;
window.openFreeWhatsModal = openFreeWhatsModal;
window.closeFreeWhatsModal = closeFreeWhatsModal;
window.processSuccessfulPayment = processSuccessfulPayment;
window.getActiveAffiliateCode = getActiveAffiliateCode;

// Mapa de eventType → URL limpa do evento
const EVENT_URL_MAP = {
    'xtreino-tokens':  '/treinofreitas',
    'modo-liga':       '/modoliga',
    'semanal-freitas': '/semanal',
    'camp-freitas':    '/campeonato',
    'acesso':          '/acesso',
};
function _eventoUrl(eventType, docId, eventData) {
    if (eventData?.urlSlug === 'camp-season-7') return 'camp-season-7';
    // Eventos dinâmicos sempre usam seu documento exato, evitando abrir outro evento do mesmo tipo.
    if (docId) return 'evento.html?id=' + encodeURIComponent(docId);
    // Eventos estáticos: usar URL limpa do mapa
    if (EVENT_URL_MAP[eventType]) return EVENT_URL_MAP[eventType];
    // Fallback legacy
    return 'evento.html?event=' + encodeURIComponent(eventType || '');
}

// ==================== EVENTOS DINÂMICOS (adminEvents) ====================

async function loadDynamicEvents() {
    const grid = document.getElementById('dynamicEventsGrid');
    const fallback = document.getElementById('staticEventsGrid');
    if (!grid) return;

    const waitForFirebase = () => new Promise(resolve => {
        if (window.firebaseDb) { resolve(); return; }
        const t = setInterval(() => { if (window.firebaseDb) { clearInterval(t); resolve(); } }, 200);
        setTimeout(() => { clearInterval(t); resolve(); }, 8000);
    });
    await waitForFirebase();

    if (!window.firebaseDb) {
        grid.classList.add('hidden');
        if (fallback) { fallback.classList.remove('hidden'); fallback.classList.add('grid'); }
        return;
    }

    try {
        const { collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const colRef = collection(window.firebaseDb, 'adminEvents');
        let snap;
        snap = await getDocs(query(colRef, where('status', 'in', ['Aberto', 'Em breve'])));

        if (snap.empty) {
            grid.classList.add('hidden');
            if (fallback) { fallback.classList.remove('hidden'); fallback.classList.add('grid'); }
            return;
        }

        const placeholderImg = 'assets/images/events/CAMP.jpeg';
        const categoryLabels = { camp: 'CAMP', xtreino: 'XTREINO', diario: 'DIÁRIO' };

        // Ordenar: ordem asc (null/undefined vai pro final), depois createdAt desc
        const docsSorted = [...snap.docs].sort((a, b) => {
            const oa = a.data().ordem != null ? a.data().ordem : 9999;
            const ob = b.data().ordem != null ? b.data().ordem : 9999;
            if (oa !== ob) return oa - ob;
            const ca = a.data().createdAt || '';
            const cb = b.data().createdAt || '';
            return cb > ca ? 1 : cb < ca ? -1 : 0;
        });

        const cards = docsSorted.map(d => {
            const ev = d.data();
            const _isFreeEv = !ev.preco || ev.entrada === 'GRÁTIS' || Number(ev.preco) === 0;
            // Apenas eventos GRATUITOS do tipo xtreino-tokens usam o modal de time gratuito
            const _isEquipeEvent = ev.eventType === 'xtreino-tokens' && _isFreeEv;
            scheduleConfig[d.id] = {
                label: ev.name || 'Evento',
                price: Number(ev.preco) || 0,
                payWithToken: ev.entrada === 'TOKENS',
                vagas: Number(ev.vagas) || 0,
                grupos: Number(ev.grupos) || 0,
                isFree: _isFreeEv,
                modo: (ev.modo || '').toUpperCase(),
                category: ev.category || '',
                regras: ev.regras || '',
                eventType: ev.eventType || '',
                adminEventId: d.id,
                dateScopedEventLinks: isCampSeason7Name(ev.name),
                ...(isCampSeason7Name(ev.name) ? { startDate: CAMP_SEASON_7_START_DATE } : {}),
                slots: ['14h','15h','16h','17h','18h','19h','20h','21h','22h','23h'],
            };
            // Alias pelo tipo canônico para que overrides de schedule_overrides batem corretamente
            if (ev.eventType && ev.eventType !== d.id) {
                scheduleConfig[ev.eventType] = scheduleConfig[d.id];
            }
            const imgSrc = ev.imageUrl || placeholderImg;
            const preco = ev.preco ? `R$ ${Number(ev.preco).toFixed(2)}` : 'GRÁTIS';
            const catLabel = categoryLabels[ev.category] || ev.category || '';
            const descLines = ev.descricao ? ev.descricao.split('\n').slice(0, 3).map(l => `<div>${l}</div>`).join('') : '';
            const formatoStr = (ev.formato || '').toUpperCase();
            const modoStr = (ev.modo || '').toUpperCase();
            const tipoStr = (ev.tipo || '').toUpperCase();
            const _isEmBreve = ev.status === 'Em breve';
            const btnLabel = _isEquipeEvent ? 'INSCREVER TIME' : (ev.entrada === 'PAGO' && ev.preco ? `INSCREVER — ${preco}` : 'RESERVAR VAGA');
            const evTypeParaModal = ev.eventType || d.id;
            const btnOnclick = _isEquipeEvent
                ? `abrirModalEquipe('${evTypeParaModal}')`
                : `openScheduleModal('${evTypeParaModal}', { adminEventId: '${d.id}' })`;
            const hasRegras = !!(ev.regras && ev.regras.trim());
            const btnHtml = _isEmBreve
                ? `<div class="flex flex-col gap-2">
                    <button disabled class="w-full py-2 rounded-lg font-semibold bg-gray-300 text-gray-500 cursor-not-allowed">EM BREVE</button>
                    <div class="flex gap-2">
                        <a href="${_eventoUrl(ev.eventType, d.id, ev)}" class="flex-1 text-center border border-gray-300 text-gray-400 py-2 rounded-lg font-semibold text-sm block pointer-events-none opacity-50">
                            <i class="fas fa-info-circle mr-1"></i>Ver Detalhes
                        </a>
                    </div>
                </div>`
                : `<div class="flex flex-col gap-2">
                <button onclick="${btnOnclick}" class="w-full btn-primary py-2 rounded-lg font-semibold">${btnLabel}</button>
                <div class="flex gap-2">
                    <a href="${_eventoUrl(ev.eventType, d.id, ev)}" class="flex-1 text-center border border-gray-300 hover:border-orange-400 text-gray-600 hover:text-orange-600 py-2 rounded-lg font-semibold text-sm transition-colors block">
                        <i class="fas fa-info-circle mr-1"></i>Ver Detalhes
                    </a>
                    ${hasRegras ? `<button onclick="openEventRulesModal('${d.id}')" class="flex-1 border border-cyan-300 hover:border-cyan-500 text-cyan-700 hover:text-cyan-900 py-2 rounded-lg font-semibold text-sm transition-colors">
                        <i class="fas fa-scroll mr-1"></i>Ver Regras
                    </button>` : ''}
                </div>
            </div>`;

            const quedasStr = ev.quedas ? `${ev.quedas}x` : null;
            const mapasList = Array.isArray(ev.mapas) && ev.mapas.length ? ev.mapas.join(' • ') : null;
            const emBreveOverlay = _isEmBreve ? `
                <div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2;">
                    <div style="background:#f59e0b;color:#000;font-weight:900;font-size:1rem;letter-spacing:0.1em;padding:0.4rem 1.2rem;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
                        ⏳ EM BREVE
                    </div>
                </div>` : '';
            return `<article class="product-card" data-category="${ev.category || ''}" data-event-id="${d.id}"${_isEmBreve ? ' style="opacity:0.75;filter:grayscale(35%);"' : ''}>
                <div class="px-1 pb-1 flex flex-wrap gap-1">
                    ${catLabel ? `<span class="inline-block bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded">${catLabel}</span>` : ''}
                    ${formatoStr ? `<span class="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded">${formatoStr}</span>` : ''}
                    ${quedasStr ? `<span class="inline-block bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded">${quedasStr} QUEDAS</span>` : ''}
                </div>
                <div class="product-media" style="position:relative;">
                    <img src="${imgSrc}" alt="${ev.name || 'Evento'}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${placeholderImg}'">
                    ${emBreveOverlay}
                </div>
                <div class="product-title">${ev.name || 'Evento'}</div>
                <div class="product-desc">
                    <div class="space-y-1">
                        <div><strong>Entrada:</strong> ${preco}</div>
                        <div><strong>Vagas por horário:</strong> ${ev.vagas || '—'}</div>
                        <div><strong>Modalidade:</strong> ${tipoStr} | ${modoStr}${formatoStr ? ' | ' + formatoStr : ''}</div>
                        ${mapasList ? `<div><strong>Mapas:</strong> ${mapasList}</div>` : ''}
                        ${descLines ? `<div class="text-xs text-gray-500 mt-1">${descLines}</div>` : ''}
                    </div>
                </div>
                ${btnHtml}
            </article>`;
        });

        grid.innerHTML = cards.join('');
        grid.classList.add('grid');

    } catch (err) {
        console.error('Erro ao carregar eventos dinâmicos:', err);
        grid.classList.add('hidden');
        if (fallback) { fallback.classList.remove('hidden'); fallback.classList.add('grid'); }
    }
}

function openEventRulesModal(eventId) {
    const cfg = scheduleConfig[eventId];
    const regras = (cfg && cfg.regras) ? cfg.regras.trim() : '';
    if (!regras) return;
    const modal = document.getElementById('eventRulesModal');
    const titleEl = document.getElementById('eventRulesTitle');
    const bodyEl  = document.getElementById('eventRulesBody');
    if (!modal || !bodyEl) return;
    if (titleEl) titleEl.textContent = (cfg.label || 'Evento') + ' — Regras';
    bodyEl.innerHTML = regras.replace(/\n/g, '<br>');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function closeEventRulesModal() {
    const modal = document.getElementById('eventRulesModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}
window.openEventRulesModal = openEventRulesModal;
window.closeEventRulesModal = closeEventRulesModal;

function filterEventsByCategory(cat) {
    const grid = document.getElementById('dynamicEventsGrid');
    if (!grid) return;
    const tabs = document.querySelectorAll('#eventSubTabs .event-sub-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    const cards = grid.querySelectorAll('article[data-category]');
    let visible = 0;
    cards.forEach(card => {
        const show = cat === 'all' || card.dataset.category === cat;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
    });
    const empty = document.getElementById('eventsEmptyMsg');
    if (empty) empty.remove();
    if (visible === 0) {
        const msg = document.createElement('p');
        msg.id = 'eventsEmptyMsg';
        msg.className = 'col-span-full text-center text-gray-400 py-8';
        msg.textContent = 'Nenhum evento nesta categoria no momento.';
        grid.appendChild(msg);
    }
}

async function openEventPayment(eventId, eventName, preco) {
    const user = window.firebaseAuth?.currentUser;
    if (!user) {
        showToast('info', 'Faça login para se inscrever no evento.', 'Login necessário');
        if (typeof openLoginModal === 'function') openLoginModal();
        return;
    }

    const btn = event?.target;
    const originalText = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Aguarde...'; }

    try {
        const externalRef = `event_${eventId}_${user.uid}_${Date.now()}`;
        const payload = {
            title: eventName,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number(preco),
            userId: user.uid,
            customerEmail: user.email,
            external_reference: externalRef,
            type: 'event_registration',
            back_url: `${window.location.origin}/evento.html?id=${encodeURIComponent(eventId)}`
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await authenticatedPaymentFetch('/.netlify/functions/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.status === 404) {
            showToast('info', 'Checkout disponível apenas na versão publicada do site (orgfreitas.com.br).', 'Dev');
            return;
        }

        if (!response.ok) {
            const errText = await response.text();
            if (String(errText || '').includes('Missing MP_ACCESS_TOKEN')) {
                showToast('error', 'Integração com Mercado Pago não configurada. Contate o suporte.', 'Erro');
                return;
            }
            throw new Error(errText || `Erro ${response.status}`);
        }

        const data = await response.json();
        const checkoutUrl = data.init_point || data.sandbox_init_point;
        if (!checkoutUrl) throw new Error('Não foi possível obter o link de pagamento.');

        try { sessionStorage.setItem('lastCheckoutUrl', checkoutUrl); } catch (_) {}
        try {
            window.open(checkoutUrl, '_blank');
            showToast('success', 'Checkout aberto em nova aba. Finalize o pagamento no Mercado Pago.', 'Pagamento');
        } catch (_) {
            window.location.href = checkoutUrl;
        }
    } catch (err) {
        console.error('Erro ao criar preferência de pagamento:', err);
        if (err.name === 'AbortError') {
            showToast('error', 'Conexão expirou. Verifique sua internet e tente novamente.', 'Timeout');
        } else {
            showToast('error', err.message || 'Erro ao processar pagamento.', 'Erro');
        }
    } finally {
        if (btn) { btn.disabled = false; if (originalText) btn.textContent = originalText; }
    }
}

window.openEventPayment = openEventPayment;

// Auto-abrir modal de evento via ?openEvent=ID na URL
(function checkOpenEventParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const openEventId = urlParams.get('openEvent');
    if (!openEventId) return;
    // fromTeam=1 → vem após confirmação de time, pula modal de equipe
    const fromTeam = urlParams.get('fromTeam') === '1';
    // Restaurar dados do time vindos do redirect de evento.html
    if (fromTeam) {
        try {
            const saved = sessionStorage.getItem('_equipeAtualPendente');
            if (saved) {
                _equipeAtual = JSON.parse(saved);
                sessionStorage.removeItem('_equipeAtualPendente');
            }
        } catch(_) {}
    }
    // Remove params da URL sem recarregar
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('openEvent');
        url.searchParams.delete('fromTeam');
        window.history.replaceState({}, '', url.toString());
    } catch (_) {}
    // Aguarda Firebase + auth + scheduleConfig estar disponível antes de abrir o modal.
    // Isso evita pedir login quando o usuário já está logado (auth demora ~1-2s para restaurar).
    const tryOpen = (attempts = 0) => {
        const ready = typeof openScheduleModal === 'function'
            && window.firebaseDb
            && typeof scheduleConfig !== 'undefined'
            && scheduleConfig[openEventId];
        // Aguardar auth resolver: isLoggedIn true OU mais de 10s (40 tentativas × 250ms)
        // Depois de 10s, abre mesmo assim — openScheduleModal trata o caso de não-logado
        const authReady = window.isLoggedIn || attempts > 40;
        if (ready && authReady) {
            if (typeof switchMainTab === 'function') switchMainTab('eventos');
            setTimeout(() => openScheduleModal(openEventId, fromTeam ? { skipTeam: true } : undefined), 200);
        } else if (attempts < 60) {
            setTimeout(() => tryOpen(attempts + 1), 250);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => tryOpen());
    } else {
        tryOpen();
    }
})();

// Inicializa eventos dinâmicos quando a página carrega
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDynamicEvents);
} else {
    loadDynamicEvents();
}

// ===== PIX Payment Modal =====
let _pixPollingInterval = null;
let _pixCountdownInterval = null;
let _pixCancelFn = null;
let _pixConfirmFn = null;
let _pixCurrentReference = null;
let _pixKind = 'event';
let _pixEventType = '';
let _pixPaymentConfirmed = false;

window.openPixModal = function(pixData, regIds, externalRef, assignedSlotsData, cfg, finalPrice) {
    const modal = document.getElementById('pixPaymentModal');
    if (!modal) return;
    clearInterval(_pixPollingInterval);
    clearInterval(_pixCountdownInterval);
    _pixCurrentReference = externalRef;
    _pixKind = cfg?.kind || (assignedSlotsData?.length ? 'event' : 'product');
    _pixEventType = cfg?.eventType || '';
    _pixPaymentConfirmed = false;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('pixLoading').classList.add('hidden');
    document.getElementById('pixContent').classList.remove('hidden');
    document.getElementById('pixConfirmed').classList.add('hidden');
    const cancelButton = document.getElementById('pixCancelButton');
    const confirmCloseButton = document.getElementById('pixConfirmedCloseButton');
    if (cancelButton) {
        cancelButton.disabled = false;
        cancelButton.textContent = _pixKind === 'event' ? 'Cancelar e liberar vaga' : 'Cancelar pagamento';
        cancelButton.classList.remove('hidden');
    }
    if (confirmCloseButton) {
        confirmCloseButton.textContent = _pixKind === 'event' ? 'Ver Minha Conta' : 'Fechar';
    }

    const label = (cfg && cfg.label) ? cfg.label : 'Evento';
    document.getElementById('pixEventLabel').textContent = label;
    const amountStr = finalPrice != null ? `R$ ${Number(finalPrice).toFixed(2).replace('.', ',')}` : '';
    document.getElementById('pixAmount').textContent = amountStr;

    if (pixData.qr_code_base64) {
        document.getElementById('pixQrImg').src = 'data:image/png;base64,' + pixData.qr_code_base64;
    }
    if (pixData.qr_code) {
        document.getElementById('pixCopiaCola').value = pixData.qr_code;
    }

    const expirationMs = Date.parse(pixData.date_of_expiration || '');
    let secondsLeft = Number.isFinite(expirationMs)
        ? Math.max(0, Math.floor((expirationMs - Date.now()) / 1000))
        : 30 * 60;
    _pixCountdownInterval = setInterval(() => {
        if (secondsLeft <= 0) {
            clearInterval(_pixCountdownInterval);
            const cd = document.getElementById('pixCountdown');
            if (cd) cd.textContent = 'Expirado';
            const status = document.getElementById('pixStatusText');
            if (status) status.textContent = 'Pix expirado. Cancele para liberar a vaga e tente novamente.';
            return;
        }
        const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
        const s = String(secondsLeft % 60).padStart(2, '0');
        const cd = document.getElementById('pixCountdown');
        if (cd) cd.textContent = m + ':' + s;
        secondsLeft--;
    }, 1000);

    _pixCancelFn = async () => {
        const button = document.getElementById('pixCancelButton');
        if (button) { button.disabled = true; button.textContent = 'Cancelando...'; }
        try {
            const response = await authenticatedPaymentFetch('/.netlify/functions/cancel-pix-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ external_reference: _pixCurrentReference }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Não foi possível cancelar o Pix.');
            if (data.status === 'paid' || data.status === 'already_paid') {
                if (typeof _pixConfirmFn === 'function') await _pixConfirmFn();
                return;
            }
            if (data.status !== 'cancelled') throw new Error('O cancelamento ainda não foi confirmado.');
            clearInterval(_pixPollingInterval);
            clearInterval(_pixCountdownInterval);
            const currentModal = document.getElementById('pixPaymentModal');
            if (currentModal) { currentModal.classList.add('hidden'); currentModal.classList.remove('flex'); }
            showToast('success', _pixKind === 'event' ? 'Pix cancelado e vaga liberada.' : 'Pix cancelado.', 'Pagamento');
        } catch (error) {
            if (button) {
                button.disabled = false;
                button.textContent = _pixKind === 'event' ? 'Cancelar e liberar vaga' : 'Cancelar pagamento';
            }
            showToast('error', error.message || 'Não foi possível cancelar agora. A reserva continua ativa.', 'Cancelamento');
        }
    };

    _pixConfirmFn = async () => {
        clearInterval(_pixPollingInterval);
        clearInterval(_pixCountdownInterval);
        // A consulta autenticada já confirmou as reservas no servidor.
        const pixContentEl = document.getElementById('pixContent');
        const pixConfirmedEl = document.getElementById('pixConfirmed');
        if (pixContentEl) pixContentEl.classList.add('hidden');
        if (pixConfirmedEl) pixConfirmedEl.classList.remove('hidden');
        const slotInfoEl = document.getElementById('pixSlotInfo');
        const titleEl = document.getElementById('pixConfirmedTitle');
        const descriptionEl = document.getElementById('pixConfirmedDescription');
        _pixPaymentConfirmed = true;
        if (titleEl) titleEl.textContent = _pixKind === 'event' ? 'Pagamento confirmado!' : 'Compra confirmada!';
        if (descriptionEl) descriptionEl.textContent = _pixKind === 'event'
            ? 'Sua inscrição está garantida.'
            : 'Pagamento aprovado. Confira o pedido na sua conta.';
        if (slotInfoEl) slotInfoEl.classList.toggle('hidden', _pixKind !== 'event');
        const cancelButton = document.getElementById('pixCancelButton');
        if (cancelButton) cancelButton.classList.add('hidden');
        if (slotInfoEl && assignedSlotsData && assignedSlotsData.length) {
            slotInfoEl.innerHTML = assignedSlotsData.map(function(s) {
                // Para modo-liga: exibir letra no círculo em vez do número
                var _isModoLiga = _pixEventType === 'modo-liga';
                var _slotRaw = s.slotDisplay ? s.slotDisplay.replace(/^(Letra\s*|Slot\s*#?|Vaga\s*#?)/i, '').trim() : '';
                var _slotBadge;
                if (_isModoLiga) {
                    if (/^[A-Za-z]$/.test(_slotRaw)) {
                        _slotBadge = _slotRaw.toUpperCase();
                    } else {
                        var _n = parseInt(_slotRaw, 10);
                        _slotBadge = (!isNaN(_n) && _n > 0) ? String.fromCharCode(64 + _n) : '✓';
                    }
                } else {
                    _slotBadge = s.slotNum || '✓';
                }
                var _slotLabel = _isModoLiga
                    ? (s.slotDisplay || '')
                    : (s.slotNum ? 'Seu Slot é Slot ' + s.slotNum : (s.slotDisplay || ''));
                return '<div class="flex items-start gap-3 py-1 border-b border-green-100 last:border-0">' +
                    '<div class="w-8 h-8 rounded-full bg-green-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">' + _slotBadge + '</div>' +
                    '<div class="min-w-0">' +
                    '<p class="font-bold text-gray-800 text-sm truncate">' + (s.team || '—') + '</p>' +
                    '<p class="text-xs text-gray-500">' + (s.schedule || '') + (_slotLabel ? ' · ' + _slotLabel : '') + '</p>' +
                    (s.whatsappLink ? '<a href="' + s.whatsappLink + '" target="_blank" class="text-xs text-green-600 hover:underline flex items-center gap-1 mt-0.5"><i class="fab fa-whatsapp"></i> Entrar no grupo</a>' : '') +
                    '</div></div>';
            }).join('');
        } else if (slotInfoEl) {
            slotInfoEl.innerHTML = '<p class="text-green-700 text-sm text-center font-medium">Inscrição confirmada com sucesso!</p>';
        }
    };

    clearInterval(_pixPollingInterval);
    _pixPollingInterval = setInterval(async function() {
        try {
            const r = await authenticatedPaymentFetch('/.netlify/functions/confirm-purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ external_reference: externalRef }),
            });
            if (!r.ok) return;
            const d = await r.json();
            if (d.status === 'paid' || d.status === 'already_paid') {
                if (typeof _pixConfirmFn === 'function') await _pixConfirmFn();
            } else if (d.status === 'rejected' || d.status === 'cancelled') {
                clearInterval(_pixPollingInterval);
                const st = document.getElementById('pixStatusText');
                if (st) st.textContent = 'Pagamento recusado ou cancelado. Tente novamente.';
            }
        } catch (_) {}
    }, 5000);
};

window.copyPixCode = function() {
    const input = document.getElementById('pixCopiaCola');
    if (!input) return;
    const val = input.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).catch(function() { _pixFallbackCopy(input); });
    } else {
        _pixFallbackCopy(input);
    }
    const btn = input.nextElementSibling;
    if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copiado!';
        btn.classList.add('bg-green-700');
        setTimeout(function() { btn.innerHTML = orig; btn.classList.remove('bg-green-700'); }, 2000);
    }
};

function _pixFallbackCopy(input) {
    input.select();
    input.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); } catch (_) {}
}

window.cancelPixPayment = function() {
    const confirmation = _pixKind === 'event'
        ? 'O Mercado Pago será consultado. A vaga só será liberada depois da confirmação do cancelamento.'
        : 'O Mercado Pago será consultado antes de cancelar a compra.';
    if (confirm(confirmation)) {
        if (typeof _pixCancelFn === 'function') _pixCancelFn();
    }
};

window.closePixModal = function() {
    clearInterval(_pixPollingInterval);
    clearInterval(_pixCountdownInterval);
    const modal = document.getElementById('pixPaymentModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    if (_pixPaymentConfirmed && _pixKind === 'event') {
        try { window.location.href = 'client.html?tab=myRegistrations'; } catch (_) {}
    }
};

// ==================== SISTEMA DE TIMES ====================
let _equipeAtual = null;
let _equipeListenerUnsubscribe = null;
let _equipeModo = 'criar';
let _equipeSlotInfo = null;

// Verificar URL para convite automático na carga da página
(function verificarConviteUrl() {
    const params = new URLSearchParams(window.location.search);
    const convite = params.get('convite') || params.get('invite');
    if (!convite) return;
    // Remover o param da URL sem recarregar
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('convite');
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
    } catch (_) {}
    const abrir = () => setTimeout(() => abrirModalEquipe(null, convite), 1400);
    // DOMContentLoaded pode já ter disparado se script está no final do body
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', abrir);
    } else {
        abrir();
    }
})();

window.abrirModalEquipe = function(slotInfo, codigoPreenchido) {
    if (!window.isLoggedIn || !window.firebaseAuth?.currentUser) {
        showToast('Faça login para se inscrever em eventos.', 3000);
        openLoginModal();
        return;
    }
    _equipeSlotInfo = slotInfo || null;
    const modal = document.getElementById('modalEquipe');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('modal-open-mobile');

    if (codigoPreenchido) {
        irParaStep(1, 'entrar');
        const inp = document.getElementById('equipeCodigoInput');
        if (inp) { inp.value = codigoPreenchido.toUpperCase(); buscarPreviewTime(inp.value); }
    } else {
        irParaStep(0);
        _carregarTimeExistente();
    }
};

window.fecharModalEquipe = function() {
    const modal = document.getElementById('modalEquipe');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('modal-open-mobile');
    if (_equipeListenerUnsubscribe) { _equipeListenerUnsubscribe(); _equipeListenerUnsubscribe = null; }
};

window.irParaStep = function(step, modo) {
    if (modo) _equipeModo = modo;
    document.querySelectorAll('.equipe-step').forEach(el => el.classList.add('hidden'));
    // Atualizar dots
    document.querySelectorAll('.equipe-dot').forEach((dot, i) => {
        if (i === step) {
            dot.style.opacity = '1';
            dot.style.width = '1.25rem';
        } else {
            dot.style.opacity = '0.4';
            dot.style.width = '0.5rem';
        }
    });

    if (step === 0) {
        document.getElementById('equipeStep0').classList.remove('hidden');
        document.getElementById('equipeModalTitulo').textContent = 'Registro de Equipe';
    } else if (step === 1) {
        if (_equipeModo === 'criar') {
            document.getElementById('equipeStep1Criar').classList.remove('hidden');
            document.getElementById('equipeModalTitulo').textContent = 'Criar Novo Time';
        } else {
            document.getElementById('equipeStep1Entrar').classList.remove('hidden');
            document.getElementById('equipeModalTitulo').textContent = 'Entrar no Time';
        }
    } else if (step === 2) {
        document.getElementById('equipeStep2').classList.remove('hidden');
        document.getElementById('equipeModalTitulo').textContent = _equipeAtual?.nome || 'Seu Time';
    }
};

async function _carregarTimeExistente() {
    if (!window.currentUser) return;
    try {
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) return;
        const snap = await getDocs(query(collection(db, 'teams'), where('membrosUids', 'array-contains', window.currentUser.uid)));
        if (!snap.empty) {
            // Time encontrado → ir direto para o step 2 (sem passar pelo card de "time existente")
            const time = { id: snap.docs[0].id, ...snap.docs[0].data() };
            _equipeAtual = time;
            const ehCapitao = time.capitaoId === window.currentUser.uid;
            const codSection = document.getElementById('equipeCodigoSection');
            if (codSection) {
                codSection.classList.toggle('hidden', !ehCapitao);
                if (ehCapitao) {
                    const codDisplay = document.getElementById('equipeCodigoDisplay');
                    if (codDisplay) codDisplay.textContent = time.codigoConvite || '';
                }
            }
            _renderizarInfoTime(time);
            await _iniciarEscutaTime(time.id);
            irParaStep(2);
        }
    } catch (_) {}
}

function _mostrarTimeExistente(time) {
    const div = document.getElementById('equipeTimeExistente');
    if (!div) return;
    div.classList.remove('hidden');
    document.getElementById('equipeNomeExistente').textContent = time.nome;
    const titulares = (time.membros || []).filter(m => m.role !== 'reserva').length;
    document.getElementById('equipeMembrosExistente').textContent = `${titulares} de 4 titular${titulares !== 1 ? 'es' : ''} confirmado${titulares !== 1 ? 's' : ''}`;
    const badge = document.getElementById('equipeStatusBadge');
    if (time.status === 'completo') {
        badge.textContent = '✓ Completo';
        badge.className = 'text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 bg-green-100 text-green-700';
    } else {
        badge.textContent = '⏳ Aguardando';
        badge.className = 'text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 bg-yellow-100 text-yellow-700';
    }
    if (time.logoUrl) {
        const _elExist = document.getElementById('equipeLogoExistente');
        if (_elExist) { _elExist.style.background = 'transparent'; _elExist.innerHTML = `<img src="${time.logoUrl}" class="w-full h-full object-contain p-0.5">`; }
    }
    _equipeAtual = time;
}

window.usarTimeExistente = async function() {
    if (!_equipeAtual) return;
    const ehCapitao = _equipeAtual.capitaoId === window.currentUser?.uid;
    const codSection = document.getElementById('equipeCodigoSection');
    if (codSection) {
        codSection.classList.toggle('hidden', !ehCapitao);
        if (ehCapitao) document.getElementById('equipeCodigoDisplay').textContent = _equipeAtual.codigoConvite || '';
    }
    _renderizarInfoTime(_equipeAtual);
    await _iniciarEscutaTime(_equipeAtual.id);
    irParaStep(2);
};

window.previewLogoEquipe = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const el = document.getElementById('equipeLogoPreview');
        if (el) el.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
    };
    reader.readAsDataURL(file);
    // Atualizar contador de nome
    const nomeInput = document.getElementById('equipeNomeInput');
    if (nomeInput) nomeInput.dispatchEvent(new Event('input'));
};

// Contador de caracteres no nome do time
document.addEventListener('DOMContentLoaded', function() {
    const inp = document.getElementById('equipeNomeInput');
    if (inp) {
        inp.addEventListener('input', function() {
            const ct = document.getElementById('equipeNomeCount');
            if (ct) ct.textContent = this.value.length;
        });
    }
});

function _gerarCodigoUnico() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
}

window.confirmarCriarTime = async function() {
    const nome = document.getElementById('equipeNomeInput')?.value?.trim();
    const email = document.getElementById('equipeEmailInput')?.value?.trim();
    const phone = document.getElementById('equipePhoneInput')?.value?.trim();
    if (!nome) { showToast('warning', 'Digite o nome do time'); return; }
    if (!email) { showToast('warning', 'Digite o e-mail de contato do time'); return; }
    if (!phone) { showToast('warning', 'Digite o WhatsApp do time'); return; }
    if (!window.currentUser) { showToast('error', 'Você precisa estar logado para criar um time'); return; }

    const btn = document.getElementById('btnCriarTime');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Criando…';

    try {
        const { collection, doc, setDoc, query, where, getDocs, serverTimestamp, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) throw new Error('Firebase não conectado');

        // Gerar código único (evitar colisão)
        let codigo = _gerarCodigoUnico();
        const existSnap = await getDocs(query(collection(db, 'teams'), where('codigoConvite', '==', codigo)));
        if (!existSnap.empty) codigo = _gerarCodigoUnico();

        const nomeUsuario = window.currentUserProfile?.name || window.currentUserProfile?.nickname || window.currentUser.displayName || 'Capitão';
        const teamRef = doc(collection(db, 'teams'));
        const membro = { uid: window.currentUser.uid, nome: nomeUsuario, role: 'capitao', fotoUrl: window.currentUser.photoURL || null, entradaEm: Date.now() };

        // Redimensionar e converter logo para base64 (salvo direto no Firestore, visível a todos)
        let logoBase64 = null;
        const logoFile = document.getElementById('equipeLogo')?.files[0];
        if (logoFile) {
            try { logoBase64 = await _resizeLogoParaBase64(logoFile); } catch (_) {}
        }

        const teamData = {
            nome,
            email,
            phone,
            logoUrl: logoBase64,
            capitaoId: window.currentUser.uid,
            capitaoNome: nomeUsuario,
            codigoConvite: codigo,
            membros: [membro],
            membrosUids: [window.currentUser.uid],
            status: 'aguardando',
            criadoEm: serverTimestamp()
        };

        await setDoc(teamRef, teamData);
        _equipeAtual = { id: teamRef.id, ...teamData, membros: [membro] };

        // Mostrar sala de espera
        document.getElementById('equipeCodigoDisplay').textContent = codigo;
        document.getElementById('equipeCodigoSection').classList.remove('hidden');
        _renderizarInfoTime(_equipeAtual);
        await _iniciarEscutaTime(teamRef.id);
        irParaStep(2);
    } catch (e) {
        showToast('error', 'Erro ao criar time: ' + (e.message || e));
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Criar Time <i class="fas fa-arrow-right ml-1"></i>';
    }
};

window.equipeOnCodigoInput = function(valor) {
    if (valor.length === 6) {
        clearTimeout(window._equipeCodigoDebounce);
        window._equipeCodigoDebounce = setTimeout(() => buscarPreviewTime(valor), 400);
    } else {
        const el = document.getElementById('equipePreviewConvite');
        if (el) el.classList.add('hidden');
    }
};

window.buscarPreviewTime = async function(codigo) {
    if (!codigo || codigo.length < 6) return;
    try {
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) return;
        const snap = await getDocs(query(collection(db, 'teams'), where('codigoConvite', '==', codigo)));
        const preview = document.getElementById('equipePreviewConvite');
        if (snap.empty) { if (preview) preview.classList.add('hidden'); return; }
        const time = { id: snap.docs[0].id, ...snap.docs[0].data() };
        document.getElementById('equipeConviteNome').textContent = time.nome;
        const count = (time.membros || []).filter(m => m.role !== 'reserva').length;
        document.getElementById('equipeConviteMembros').textContent = `${count}/4 titulares · ${time.status === 'completo' ? 'Time completo' : 'Aguardando jogadores'}`;
        if (time.logoUrl) {
            const _elConv = document.getElementById('equipeConviteLogoPreview');
            if (_elConv) { _elConv.style.background = 'transparent'; _elConv.innerHTML = `<img src="${time.logoUrl}" class="w-full h-full object-contain rounded-lg p-0.5">`; }
        }
        if (preview) preview.classList.remove('hidden');
    } catch (_) {}
};

window.confirmarEntrarTime = async function() {
    const codigo = document.getElementById('equipeCodigoInput')?.value?.trim().toUpperCase();
    if (!codigo || codigo.length !== 6) { showToast('warning', 'Digite o código de 6 dígitos'); return; }
    if (!window.currentUser) { showToast('error', 'Você precisa estar logado'); return; }

    try {
        const { collection, query, where, getDocs, doc, updateDoc, arrayUnion } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) throw new Error('Firebase não conectado');

        const snap = await getDocs(query(collection(db, 'teams'), where('codigoConvite', '==', codigo)));
        if (snap.empty) { showToast('error', 'Código inválido. Verifique e tente novamente.'); return; }

        const timeDoc = snap.docs[0];
        const time = { id: timeDoc.id, ...timeDoc.data() };

        // Já é membro → ir direto para a sala
        if ((time.membrosUids || []).includes(window.currentUser.uid)) {
            _equipeAtual = time;
            document.getElementById('equipeCodigoSection').classList.add('hidden');
            _renderizarInfoTime(time);
            await _iniciarEscutaTime(time.id);
            irParaStep(2);
            return;
        }

        // Verificar limite (4 titulares + 2 reservas = 6 máx)
        if ((time.membrosUids || []).length >= 6) { showToast('error', 'Time já está cheio'); return; }

        const nomeUsuario = window.currentUserProfile?.name || window.currentUserProfile?.nickname || window.currentUser.displayName || 'Jogador';
        const titulares = (time.membros || []).filter(m => m.role !== 'reserva').length;
        const novoRole = titulares >= 4 ? 'reserva' : 'titular';

        const novoMembro = { uid: window.currentUser.uid, nome: nomeUsuario, role: novoRole, fotoUrl: window.currentUser.photoURL || null, entradaEm: Date.now() };
        const novosTitulares = titulares + (novoRole !== 'reserva' ? 1 : 0);

        await updateDoc(doc(db, 'teams', time.id), {
            membros: arrayUnion(novoMembro),
            membrosUids: arrayUnion(window.currentUser.uid),
            status: novosTitulares >= 4 ? 'completo' : 'aguardando'
        });

        _equipeAtual = { ...time };
        document.getElementById('equipeCodigoSection').classList.add('hidden');
        await _iniciarEscutaTime(time.id);
        irParaStep(2);
        showToast('success', `Você entrou no time "${time.nome}"!`);
    } catch (e) {
        showToast('error', 'Erro ao entrar no time: ' + (e.message || e));
    }
};

function _renderizarInfoTime(time) {
    const nomeEl = document.getElementById('equipeTimeNomeDisplay');
    if (nomeEl) nomeEl.textContent = time.nome || '';
    if (time.logoUrl) {
        const logoEl = document.getElementById('equipeTimeLogo');
        if (logoEl) { logoEl.style.background = 'transparent'; logoEl.innerHTML = `<img src="${time.logoUrl}" class="w-full h-full object-contain p-0.5">`; }
    }
}

async function _iniciarEscutaTime(teamId) {
    if (_equipeListenerUnsubscribe) _equipeListenerUnsubscribe();
    try {
        const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) return;
        _equipeListenerUnsubscribe = onSnapshot(doc(db, 'teams', teamId), (snap) => {
            if (!snap.exists()) return;
            const time = { id: snap.id, ...snap.data() };
            _equipeAtual = time;
            _renderizarMembrosTime(time);
            _renderizarInfoTime(time);
        });
    } catch (_) {}
}

function _renderizarMembrosTime(time) {
    const membros = time.membros || [];
    const titulares = membros.filter(m => m.role !== 'reserva');
    const reservas = membros.filter(m => m.role === 'reserva');
    const ehCapitao = time.capitaoId === window.currentUser?.uid;

    // Grid de titulares (4 slots)
    const grid = document.getElementById('equipeMembrosGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const m = titulares[i];
        if (m) {
            const isCapitao = m.role === 'capitao';
            // Capitão pode remover qualquer membro (exceto ele mesmo)
            const podeRemover = ehCapitao && !isCapitao;
            const btnRemover = podeRemover
                ? `<button onclick="removerMembroTime('${m.uid}')" class="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center transition-colors" title="Remover jogador"><i class="fas fa-times text-xs"></i></button>`
                : '';
            grid.innerHTML += `
            <div class="equipe-membro-card preenchido">
                <div class="equipe-avatar">
                    ${m.fotoUrl ? `<img src="${m.fotoUrl}" class="w-full h-full object-cover">` : `<span class="text-white font-black text-sm">${(m.nome || '?').charAt(0).toUpperCase()}</span>`}
                </div>
                <div class="equipe-membro-info flex-1 min-w-0">
                    <p class="font-semibold text-gray-800 text-xs leading-tight truncate">${m.nome}</p>
                    <p class="text-xs mt-0.5 font-semibold ${isCapitao ? 'text-indigo-500' : 'text-sky-500'}">${isCapitao ? '★ Capitão' : 'Titular'}</p>
                </div>
                ${btnRemover}
            </div>`;
        } else {
            grid.innerHTML += `
            <div class="equipe-membro-card vazio">
                <div class="equipe-avatar vazio">
                    <i class="fas fa-user-plus text-gray-300 text-sm"></i>
                </div>
                <div class="equipe-membro-info">
                    <p class="text-xs text-gray-400 font-medium">Aguardando…</p>
                    <p class="text-xs text-gray-300">Slot ${i + 1}</p>
                </div>
            </div>`;
        }
    }

    // Reservas (aparece quando os 4 titulares estiverem completos)
    const reservasSection = document.getElementById('equipeReservasSection');
    const reservasGrid = document.getElementById('equipeReservasGrid');
    if (titulares.length >= 4 && reservasSection) {
        reservasSection.classList.remove('hidden');
        if (reservasGrid) {
            reservasGrid.innerHTML = '';
            for (let i = 0; i < 2; i++) {
                const r = reservas[i];
                if (r) {
                    const btnRemoverR = ehCapitao
                        ? `<button onclick="removerMembroTime('${r.uid}')" class="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center transition-colors" title="Remover reserva"><i class="fas fa-times text-xs"></i></button>`
                        : '';
                    reservasGrid.innerHTML += `
                    <div class="equipe-membro-card preenchido reserva">
                        <div class="equipe-avatar reserva">
                            ${r.fotoUrl ? `<img src="${r.fotoUrl}" class="w-full h-full object-cover">` : `<span class="text-white font-black text-xs">${(r.nome || '?').charAt(0).toUpperCase()}</span>`}
                        </div>
                        <div class="equipe-membro-info flex-1 min-w-0">
                            <p class="font-semibold text-gray-800 text-xs leading-tight truncate">${r.nome}</p>
                            <p class="text-xs text-orange-500 font-semibold mt-0.5">Reserva</p>
                        </div>
                        ${btnRemoverR}
                    </div>`;
                } else {
                    reservasGrid.innerHTML += `
                    <div class="equipe-membro-card vazio">
                        <div class="equipe-avatar vazio">
                            <i class="fas fa-user-plus text-gray-300 text-xs"></i>
                        </div>
                        <div class="equipe-membro-info">
                            <p class="text-xs text-gray-400">Reserva ${i + 1}</p>
                            <p class="text-xs text-gray-300">Opcional</p>
                        </div>
                    </div>`;
                }
            }
        }
    }

    // Contador e status
    const count = titulares.length;
    const contEl = document.getElementById('equipeContadorMembros');
    if (contEl) contEl.textContent = `${count}/4`;
    const statusEl = document.getElementById('equipeStatusTexto');
    if (statusEl) statusEl.textContent = count >= 4 ? 'Time completo ✓' : `Faltam ${4 - count} jogador${4 - count !== 1 ? 'es' : ''}`;

    // Botão de confirmar (só capitão)
    const aguardando = document.getElementById('equipeAguardandoInfo');
    const completo = document.getElementById('equipeCompletoInfo');
    if (count >= 4) {
        if (aguardando) aguardando.classList.add('hidden');
        if (completo) completo.classList.remove('hidden');
        const btnConfirmar = document.getElementById('btnConfirmarInscricao');
        if (btnConfirmar) btnConfirmar.style.display = ehCapitao ? '' : 'none';
    } else {
        if (aguardando) aguardando.classList.remove('hidden');
        if (completo) completo.classList.add('hidden');
    }

    // Botões Sair/Apagar
    const btnApagar = document.getElementById('btnApagarTime');
    const btnSair = document.getElementById('btnSairTime');
    if (btnApagar) btnApagar.classList.toggle('hidden', !ehCapitao);
    if (btnSair) btnSair.classList.toggle('hidden', ehCapitao);
}

// ── Remover membro do time (capitão) ──
window.removerMembroTime = async function(uid) {
    if (!_equipeAtual || !window.currentUser) return;
    if (_equipeAtual.capitaoId !== window.currentUser.uid) return;
    if (!confirm('Remover este jogador do time?')) return;
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) return;
        const novosMembros = (_equipeAtual.membros || []).filter(m => m.uid !== uid);
        const novosUids = (_equipeAtual.membrosUids || []).filter(u => u !== uid);
        const titulares = novosMembros.filter(m => m.role !== 'reserva').length;
        await updateDoc(doc(db, 'teams', _equipeAtual.id), {
            membros: novosMembros,
            membrosUids: novosUids,
            status: titulares >= 4 ? 'completo' : 'aguardando'
        });
        showToast('success', 'Jogador removido do time');
    } catch (e) {
        showToast('error', 'Erro ao remover jogador: ' + (e.message || e));
    }
};

// ── Sair do time (membro convidado) ──
window.sairDoTime = async function() {
    if (!_equipeAtual || !window.currentUser) return;
    if (_equipeAtual.capitaoId === window.currentUser.uid) return; // capitão não sai, apaga
    if (!confirm(`Sair do time "${_equipeAtual.nome}"?`)) return;
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) return;
        const uid = window.currentUser.uid;
        const novosMembros = (_equipeAtual.membros || []).filter(m => m.uid !== uid);
        const novosUids = (_equipeAtual.membrosUids || []).filter(u => u !== uid);
        const titulares = novosMembros.filter(m => m.role !== 'reserva').length;
        await updateDoc(doc(db, 'teams', _equipeAtual.id), {
            membros: novosMembros,
            membrosUids: novosUids,
            status: titulares >= 4 ? 'completo' : 'aguardando'
        });
        _equipeAtual = null;
        if (_equipeListenerUnsubscribe) { _equipeListenerUnsubscribe(); _equipeListenerUnsubscribe = null; }
        fecharModalEquipe();
        showToast('success', 'Você saiu do time');
    } catch (e) {
        showToast('error', 'Erro ao sair do time: ' + (e.message || e));
    }
};

// ── Apagar time (capitão) ──
window.apagarTime = async function() {
    if (!_equipeAtual || !window.currentUser) return;
    if (_equipeAtual.capitaoId !== window.currentUser.uid) return;
    if (!confirm(`Apagar o time "${_equipeAtual.nome}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = window.firebaseDb;
        if (!db) return;
        await deleteDoc(doc(db, 'teams', _equipeAtual.id));
        _equipeAtual = null;
        if (_equipeListenerUnsubscribe) { _equipeListenerUnsubscribe(); _equipeListenerUnsubscribe = null; }
        fecharModalEquipe();
        showToast('success', 'Time apagado com sucesso');
    } catch (e) {
        showToast('error', 'Erro ao apagar time: ' + (e.message || e));
    }
};

// Redimensiona logo para 128×128px e retorna data URL base64 (JPEG 0.7)
// Salvo direto no Firestore → todos os membros veem via listener em tempo real
async function _resizeLogoParaBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const SIZE = 128;
                const canvas = document.createElement('canvas');
                canvas.width = SIZE; canvas.height = SIZE;
                const ctx = canvas.getContext('2d');
                // Corte quadrado centralizado
                const min = Math.min(img.width, img.height);
                const sx = (img.width - min) / 2;
                const sy = (img.height - min) / 2;
                ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

window.copiarCodigo = function() {
    const codigo = document.getElementById('equipeCodigoDisplay')?.textContent?.trim();
    if (!codigo) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(codigo).then(() => showToast('success', `Código ${codigo} copiado!`)).catch(() => _copiarFallback(codigo));
    } else { _copiarFallback(codigo); }
};

function _copiarFallback(texto) {
    const el = document.createElement('textarea');
    el.value = texto;
    Object.assign(el.style, { position: 'fixed', opacity: '0' });
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); showToast('success', `Código ${texto} copiado!`); } catch (_) {}
    document.body.removeChild(el);
}

window.compartilharConvite = function() {
    const codigo = document.getElementById('equipeCodigoDisplay')?.textContent?.trim();
    const nome = _equipeAtual?.nome || 'Meu Time';
    const base = window.location.origin + window.location.pathname;
    const link = `${base}?convite=${codigo}`;
    const msg = `🎮 *${nome}* — XTreino Freitas\n\nEntrei no treino e preciso de você no time!\n\n🔑 Código: *${codigo}*\n🔗 Entre aqui: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};

window.confirmarInscricaoEquipe = function() {
    if (!_equipeAtual) { showToast('error', 'Nenhum time carregado'); return; }
    const titulares = (_equipeAtual.membros || []).filter(m => m.role !== 'reserva').length;
    if (titulares < 4) { showToast('warning', 'O time precisa de 4 titulares confirmados'); return; }
    fecharModalEquipe();
    showToast('success', `Time "${_equipeAtual.nome}" confirmado! Escolha o horário do treino.`);
    // Usar o evento dinâmico correto (_equipeSlotInfo) se disponível, senão fallback para xtreino-tokens
    const eventoId = _equipeSlotInfo || 'xtreino-tokens';
    if (typeof openScheduleModal === 'function') openScheduleModal(eventoId, { skipTeam: true });
};
