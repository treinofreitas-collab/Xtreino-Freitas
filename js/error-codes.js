/**
 * Sistema de Códigos de Erro - X-TREINO FREITAS
 * 
 * Estrutura de códigos:
 * - AUTH_xxx: Autenticação e autorização
 * - TOKEN_xxx: Operações com tokens
 * - PAYMENT_xxx: Pagamentos (Mercado Pago)
 * - EVENT_xxx: Eventos e reservas
 * - PRODUCT_xxx: Produtos e compras
 * - COUPON_xxx: Cupons de desconto
 * - SYS_xxx: Erros do sistema/Firebase
 */

const ERROR_CODES = {
    // ==================== AUTENTICAÇÃO (1xxx) ====================
    AUTH_001: {
        code: 'AUTH_001',
        message: 'Usuário não autenticado',
        userMessage: 'Você precisa estar logado para realizar esta ação.',
        severity: 'error'
    },
    AUTH_002: {
        code: 'AUTH_002',
        message: 'Token de autenticação expirado',
        userMessage: 'Sua sessão expirou. Por favor, faça login novamente.',
        severity: 'error'
    },
    AUTH_003: {
        code: 'AUTH_003',
        message: 'Usuário não autorizado',
        userMessage: 'Você não tem permissão para realizar esta ação.',
        severity: 'error'
    },
    AUTH_004: {
        code: 'AUTH_004',
        message: 'Erro ao criar perfil do usuário',
        userMessage: 'Não foi possível criar seu perfil. Tente novamente.',
        severity: 'error'
    },
    AUTH_005: {
        code: 'AUTH_005',
        message: 'Erro ao carregar perfil do usuário',
        userMessage: 'Não foi possível carregar seus dados. Tente recarregar a página.',
        severity: 'warning'
    },
    AUTH_006: {
        code: 'AUTH_006',
        message: 'Email ou senha inválidos',
        userMessage: 'Email ou senha incorretos. Verifique suas credenciais.',
        severity: 'error'
    },
    AUTH_007: {
        code: 'AUTH_007',
        message: 'Erro ao fazer login',
        userMessage: 'Não foi possível fazer login. Tente novamente.',
        severity: 'error'
    },

    // ==================== TOKENS (2xxx) ====================
    TOKEN_001: {
        code: 'TOKEN_001',
        message: 'Saldo de tokens insuficiente',
        userMessage: 'Você não tem tokens suficientes para esta compra.',
        severity: 'error'
    },
    TOKEN_002: {
        code: 'TOKEN_002',
        message: 'Erro ao debitar tokens',
        userMessage: 'Não foi possível processar o pagamento com tokens. Tente novamente.',
        severity: 'error'
    },
    TOKEN_003: {
        code: 'TOKEN_003',
        message: 'Erro ao carregar saldo de tokens',
        userMessage: 'Não foi possível verificar seu saldo. Tente recarregar a página.',
        severity: 'warning'
    },
    TOKEN_004: {
        code: 'TOKEN_004',
        message: 'Erro ao atualizar saldo de tokens',
        userMessage: 'Não foi possível atualizar seu saldo. Os tokens podem não ter sido debitados.',
        severity: 'error'
    },
    TOKEN_005: {
        code: 'TOKEN_005',
        message: 'Valor de tokens inválido',
        userMessage: 'O valor informado é inválido. Verifique e tente novamente.',
        severity: 'error'
    },
    TOKEN_006: {
        code: 'TOKEN_006',
        message: 'Transação com tokens já processada',
        userMessage: 'Esta transação já foi processada anteriormente.',
        severity: 'warning'
    },

    // ==================== PAGAMENTO MERCADO PAGO (3xxx) ====================
    PAYMENT_001: {
        code: 'PAYMENT_001',
        message: 'Erro ao criar preferência de pagamento',
        userMessage: 'Não foi possível iniciar o pagamento. Tente novamente.',
        severity: 'error'
    },
    PAYMENT_002: {
        code: 'PAYMENT_002',
        message: 'Preço inválido para pagamento',
        userMessage: 'O preço do produto é inválido. Entre em contato com o suporte.',
        severity: 'error'
    },
    PAYMENT_003: {
        code: 'PAYMENT_003',
        message: 'Erro ao salvar pedido no sistema',
        userMessage: 'Não foi possível registrar seu pedido. Tente novamente.',
        severity: 'error'
    },
    PAYMENT_004: {
        code: 'PAYMENT_004',
        message: 'Link de pagamento não disponível',
        userMessage: 'Não foi possível obter o link de pagamento. Verifique sua conexão.',
        severity: 'error'
    },
    PAYMENT_005: {
        code: 'PAYMENT_005',
        message: 'Produto não encontrado',
        userMessage: 'O produto selecionado não foi encontrado.',
        severity: 'error'
    },
    PAYMENT_006: {
        code: 'PAYMENT_006',
        message: 'Erro ao processar webhook de pagamento',
        userMessage: 'Houve um problema ao confirmar seu pagamento. Entre em contato com o suporte.',
        severity: 'error'
    },
    PAYMENT_007: {
        code: 'PAYMENT_007',
        message: 'Pagamento não autorizado',
        userMessage: 'Seu pagamento não foi autorizado. Verifique os dados do cartão.',
        severity: 'error'
    },

    // ==================== EVENTOS E RESERVAS (4xxx) ====================
    EVENT_001: {
        code: 'EVENT_001',
        message: 'Evento não encontrado',
        userMessage: 'O evento selecionado não foi encontrado.',
        severity: 'error'
    },
    EVENT_002: {
        code: 'EVENT_002',
        message: 'Vagas esgotadas para este horário',
        userMessage: 'Não há mais vagas disponíveis para o horário selecionado.',
        severity: 'error'
    },
    EVENT_003: {
        code: 'EVENT_003',
        message: 'Vagas insuficientes para a quantidade solicitada',
        userMessage: 'Não há vagas suficientes para a quantidade de times solicitada.',
        severity: 'error'
    },
    EVENT_004: {
        code: 'EVENT_004',
        message: 'Erro ao verificar disponibilidade',
        userMessage: 'Não foi possível verificar a disponibilidade. Tente novamente.',
        severity: 'error'
    },
    EVENT_005: {
        code: 'EVENT_005',
        message: 'Erro ao criar reserva',
        userMessage: 'Não foi possível criar sua reserva. Tente novamente.',
        severity: 'error'
    },
    EVENT_006: {
        code: 'EVENT_006',
        message: 'Data inválida ou no passado',
        userMessage: 'A data selecionada é inválida ou já passou.',
        severity: 'error'
    },
    EVENT_007: {
        code: 'EVENT_007',
        message: 'Horário inválido',
        userMessage: 'O horário selecionado é inválido.',
        severity: 'error'
    },
    EVENT_008: {
        code: 'EVENT_008',
        message: 'Nenhum horário selecionado',
        userMessage: 'Selecione pelo menos um horário para continuar.',
        severity: 'error'
    },
    EVENT_009: {
        code: 'EVENT_009',
        message: 'Nenhum time adicionado',
        userMessage: 'Adicione pelo menos um time para continuar.',
        severity: 'error'
    },
    EVENT_010: {
        code: 'EVENT_010',
        message: 'Erro ao atualizar disponibilidade',
        userMessage: 'Não foi possível atualizar a disponibilidade. Tente novamente.',
        severity: 'warning'
    },

    // ==================== PRODUTOS E COMPRAS (5xxx) ====================
    PRODUCT_001: {
        code: 'PRODUCT_001',
        message: 'Produto não encontrado',
        userMessage: 'O produto selecionado não foi encontrado.',
        severity: 'error'
    },
    PRODUCT_002: {
        code: 'PRODUCT_002',
        message: 'Produto indisponível',
        userMessage: 'Este produto está temporariamente indisponível.',
        severity: 'error'
    },
    PRODUCT_003: {
        code: 'PRODUCT_003',
        message: 'Opções do produto inválidas',
        userMessage: 'As opções selecionadas são inválidas. Verifique e tente novamente.',
        severity: 'error'
    },
    PRODUCT_004: {
        code: 'PRODUCT_004',
        message: 'Erro ao processar compra',
        userMessage: 'Não foi possível processar sua compra. Tente novamente.',
        severity: 'error'
    },
    PRODUCT_005: {
        code: 'PRODUCT_005',
        message: 'Erro ao gerar link de download',
        userMessage: 'Não foi possível gerar o link de download. Entre em contato com o suporte.',
        severity: 'error'
    },
    PRODUCT_006: {
        code: 'PRODUCT_006',
        message: 'CPF inválido',
        userMessage: 'O CPF informado é inválido. Use o formato 000.000.000-00.',
        severity: 'error'
    },
    PRODUCT_007: {
        code: 'PRODUCT_007',
        message: 'Quantidade de mapas não corresponde',
        userMessage: 'A quantidade de mapas deve corresponder ao número de mapas escritos.',
        severity: 'error'
    },
    PRODUCT_008: {
        code: 'PRODUCT_008',
        message: 'Plataforma não selecionada',
        userMessage: 'Selecione uma plataforma para continuar.',
        severity: 'error'
    },
    PRODUCT_009: {
        code: 'PRODUCT_009',
        message: 'Marca do dispositivo não selecionada',
        userMessage: 'Selecione a marca do seu dispositivo para continuar.',
        severity: 'error'
    },

    // ==================== CUPONS (6xxx) ====================
    COUPON_001: {
        code: 'COUPON_001',
        message: 'Cupom não encontrado',
        userMessage: 'O cupom informado não foi encontrado.',
        severity: 'error'
    },
    COUPON_002: {
        code: 'COUPON_002',
        message: 'Cupom expirado',
        userMessage: 'Este cupom já expirou.',
        severity: 'error'
    },
    COUPON_003: {
        code: 'COUPON_003',
        message: 'Cupom inativo',
        userMessage: 'Este cupom está inativo.',
        severity: 'error'
    },
    COUPON_004: {
        code: 'COUPON_004',
        message: 'Cupom não válido para este tipo de compra',
        userMessage: 'Este cupom não é válido para este tipo de produto ou evento.',
        severity: 'error'
    },
    COUPON_005: {
        code: 'COUPON_005',
        message: 'Cupom já utilizado no limite',
        userMessage: 'Este cupom já atingiu o limite de uso.',
        severity: 'error'
    },
    COUPON_006: {
        code: 'COUPON_006',
        message: 'Erro ao validar cupom',
        userMessage: 'Não foi possível validar o cupom. Tente novamente.',
        severity: 'error'
    },
    COUPON_007: {
        code: 'COUPON_007',
        message: 'Erro ao aplicar cupom',
        userMessage: 'Não foi possível aplicar o cupom. Tente novamente.',
        severity: 'error'
    },
    COUPON_008: {
        code: 'COUPON_008',
        message: 'Erro ao registrar uso do cupom',
        userMessage: 'O cupom foi aplicado, mas houve um erro ao registrar o uso.',
        severity: 'warning'
    },

    // ==================== SISTEMA/FIREBASE (9xxx) ====================
    SYS_001: {
        code: 'SYS_001',
        message: 'Erro interno do servidor',
        userMessage: 'Ocorreu um erro interno. Tente novamente em alguns instantes.',
        severity: 'error'
    },
    SYS_002: {
        code: 'SYS_002',
        message: 'Serviço temporariamente indisponível',
        userMessage: 'O serviço está temporariamente indisponível. Tente novamente em alguns minutos.',
        severity: 'error'
    },
    SYS_003: {
        code: 'SYS_003',
        message: 'Erro de conexão com Firebase',
        userMessage: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
        severity: 'error'
    },
    SYS_004: {
        code: 'SYS_004',
        message: 'Permissões insuficientes no Firebase',
        userMessage: 'Você não tem permissão para realizar esta ação.',
        severity: 'error'
    },
    SYS_005: {
        code: 'SYS_005',
        message: 'Erro ao salvar dados no Firebase',
        userMessage: 'Não foi possível salvar os dados. Tente novamente.',
        severity: 'error'
    },
    SYS_006: {
        code: 'SYS_006',
        message: 'Erro ao carregar dados do Firebase',
        userMessage: 'Não foi possível carregar os dados. Tente recarregar a página.',
        severity: 'warning'
    },
    SYS_007: {
        code: 'SYS_007',
        message: 'Timeout na requisição',
        userMessage: 'A requisição demorou muito para responder. Tente novamente.',
        severity: 'error'
    },
    SYS_008: {
        code: 'SYS_008',
        message: 'Dados inválidos',
        userMessage: 'Os dados informados são inválidos. Verifique e tente novamente.',
        severity: 'error'
    }
};

// Função para obter erro por código
function getErrorByCode(code) {
    return ERROR_CODES[code] || {
        code: code || 'UNKNOWN',
        message: 'Erro desconhecido',
        userMessage: 'Ocorreu um erro inesperado. Tente novamente.',
        severity: 'error'
    };
}

// Função para criar erro customizado
function createError(code, customMessage = null) {
    const error = getErrorByCode(code);
    if (customMessage) {
        error.userMessage = customMessage;
    }
    return error;
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ERROR_CODES = ERROR_CODES;
    window.getErrorByCode = getErrorByCode;
    window.createError = createError;
}

