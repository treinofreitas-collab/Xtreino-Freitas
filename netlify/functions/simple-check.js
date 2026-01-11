// Netlify Function: Verificação simples sem Firebase Admin
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Verificar apenas as variáveis de ambiente
        const envCheck = {
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'Configurado' : 'Não configurado',
            FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'Configurado' : 'Não configurado',
            FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'Configurado' : 'Não configurado',
            MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN ? 'Configurado' : 'Não configurado',
            MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY ? 'Configurado' : 'Não configurado'
        };
        
        // Verificar se a chave privada tem o formato correto
        let privateKeyStatus = 'Não configurado';
        if (process.env.FIREBASE_PRIVATE_KEY) {
            if (process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
                privateKeyStatus = 'Configurado (formato correto)';
            } else {
                privateKeyStatus = 'Configurado (formato pode estar incorreto)';
            }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Verificação de configuração',
                envVars: envCheck,
                privateKeyStatus: privateKeyStatus,
                privateKeyLength: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Error in simple check:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
