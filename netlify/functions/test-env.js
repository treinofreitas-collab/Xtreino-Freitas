// Netlify Function: Testar variáveis de ambiente
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
        const envVars = {
            MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN ? 'Configurado' : 'Não configurado',
            MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY ? 'Configurado' : 'Não configurado',
            WEBHOOK_URL: process.env.WEBHOOK_URL ? 'Configurado' : 'Não configurado',
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'Configurado' : 'Não configurado',
            FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'Configurado' : 'Não configurado',
            FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'Configurado' : 'Não configurado'
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Status das variáveis de ambiente:',
                environment: envVars,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
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
