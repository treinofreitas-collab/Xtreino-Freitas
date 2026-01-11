/**
 * Sistema de Tratamento de Erros - X-TREINO FREITAS
 * 
 * Funções utilitárias para tratamento padronizado de erros
 */

/**
 * Trata um erro e retorna objeto padronizado
 * @param {Error|string|object} error - Erro a ser tratado
 * @param {string} defaultCode - Código de erro padrão se não for encontrado
 * @returns {object} Objeto de erro padronizado
 */
function handleError(error, defaultCode = 'SYS_001') {
    // Se já for um objeto de erro do sistema
    if (error && typeof error === 'object' && error.code && error.userMessage) {
        return error;
    }

    // Se for um código de erro
    if (typeof error === 'string' && error.startsWith('AUTH_') || 
        error.startsWith('TOKEN_') || error.startsWith('PAYMENT_') ||
        error.startsWith('EVENT_') || error.startsWith('PRODUCT_') ||
        error.startsWith('COUPON_') || error.startsWith('SYS_')) {
        return getErrorByCode(error);
    }

    // Se for um objeto Error
    if (error instanceof Error) {
        const errorMessage = error.message || '';
        
        // Tentar identificar o tipo de erro pelo message
        if (errorMessage.includes('permission') || errorMessage.includes('permissão')) {
            return getErrorByCode('SYS_004');
        }
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return getErrorByCode('SYS_003');
        }
        if (errorMessage.includes('timeout')) {
            return getErrorByCode('SYS_007');
        }
        if (errorMessage.includes('insufficient') || errorMessage.includes('insuficiente')) {
            return getErrorByCode('TOKEN_001');
        }
        
        // Erro genérico com mensagem original
        const defaultError = getErrorByCode(defaultCode);
        return {
            ...defaultError,
            originalMessage: errorMessage,
            userMessage: defaultError.userMessage + (errorMessage ? ` (${errorMessage})` : '')
        };
    }

    // Se for string simples
    if (typeof error === 'string') {
        const defaultError = getErrorByCode(defaultCode);
        return {
            ...defaultError,
            originalMessage: error,
            userMessage: error || defaultError.userMessage
        };
    }

    // Fallback
    return getErrorByCode(defaultCode);
}

/**
 * Exibe erro para o usuário usando toast
 * @param {Error|string|object} error - Erro a ser exibido
 * @param {string} defaultCode - Código de erro padrão
 */
function showError(error, defaultCode = 'SYS_001') {
    const errorObj = handleError(error, defaultCode);
    
    // Usar toast se disponível, senão usar alert
    if (typeof showToast === 'function') {
        showToast(
            errorObj.severity === 'warning' ? 'warning' : 'error',
            errorObj.userMessage,
            'Erro',
            6000
        );
    } else if (typeof alert === 'function') {
        alert(errorObj.userMessage);
    } else {
        console.error('Erro:', errorObj);
    }
    
    // Log detalhado no console para debug
    console.error(`[${errorObj.code}] ${errorObj.message}`, {
        userMessage: errorObj.userMessage,
        originalError: error
    });
    
    return errorObj;
}

/**
 * Exibe erro e lança exceção
 * @param {Error|string|object} error - Erro a ser tratado
 * @param {string} defaultCode - Código de erro padrão
 * @throws {Error}
 */
function throwError(error, defaultCode = 'SYS_001') {
    const errorObj = handleError(error, defaultCode);
    showError(errorObj);
    throw new Error(`[${errorObj.code}] ${errorObj.message}`);
}

/**
 * Trata erro silenciosamente (apenas log, sem exibir para usuário)
 * @param {Error|string|object} error - Erro a ser tratado
 * @param {string} defaultCode - Código de erro padrão
 * @returns {object} Objeto de erro padronizado
 */
function logError(error, defaultCode = 'SYS_001') {
    const errorObj = handleError(error, defaultCode);
    console.error(`[${errorObj.code}] ${errorObj.message}`, {
        userMessage: errorObj.userMessage,
        originalError: error
    });
    return errorObj;
}

/**
 * Wrapper para funções assíncronas com tratamento de erro automático
 * @param {Function} asyncFn - Função assíncrona
 * @param {string} defaultCode - Código de erro padrão
 * @param {boolean} showToUser - Se deve exibir erro para o usuário
 * @returns {Promise} Promise que resolve com resultado ou rejeita com erro tratado
 */
async function safeAsync(asyncFn, defaultCode = 'SYS_001', showToUser = true) {
    try {
        return await asyncFn();
    } catch (error) {
        const errorObj = handleError(error, defaultCode);
        if (showToUser) {
            showError(errorObj);
        } else {
            logError(errorObj);
        }
        throw errorObj;
    }
}

/**
 * Valida se um erro é de um tipo específico
 * @param {Error|string|object} error - Erro a verificar
 * @param {string} codePrefix - Prefixo do código (ex: 'AUTH_', 'TOKEN_')
 * @returns {boolean}
 */
function isErrorType(error, codePrefix) {
    const errorObj = handleError(error);
    return errorObj.code.startsWith(codePrefix);
}

/**
 * Cria um erro customizado com código e mensagem
 * @param {string} code - Código do erro
 * @param {string} customMessage - Mensagem customizada (opcional)
 * @returns {object} Objeto de erro
 */
function createCustomError(code, customMessage = null) {
    return createError(code, customMessage);
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.handleError = handleError;
    window.showError = showError;
    window.throwError = throwError;
    window.logError = logError;
    window.safeAsync = safeAsync;
    window.isErrorType = isErrorType;
    window.createCustomError = createCustomError;
}

