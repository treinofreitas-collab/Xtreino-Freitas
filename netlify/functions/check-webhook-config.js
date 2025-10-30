// Netlify Function: Verificar configuração do webhook
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
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'MP_ACCESS_TOKEN não configurado'
                })
            };
        }

        // URL do webhook
        const base = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br';
        const webhookUrl = `${base}/.netlify/functions/payment-notification`;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Configuração do webhook',
                webhookUrl: webhookUrl,
                accessTokenConfigured: !!accessToken,
                instructions: {
                    step1: 'Acesse o painel do Mercado Pago',
                    step2: 'Vá em Desenvolvedores > Webhooks',
                    step3: 'Configure o webhook com a URL:',
                    webhookUrl: webhookUrl,
                    step4: 'Eventos: payment',
                    step5: 'Salve a configuração'
                }
            })
        };
        
    } catch (error) {
        console.error('Error checking webhook config:', error);
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
