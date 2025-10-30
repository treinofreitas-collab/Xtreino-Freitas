// Netlify Function: Configurar webhook do Mercado Pago via API
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod === 'GET') {
        const base = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br';
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Para configurar o webhook, use POST',
                instructions: `Execute: curl -X POST ${base}/.netlify/functions/setup-webhook`
            })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'MP_ACCESS_TOKEN not configured' })
            };
        }

        // URL do webhook (env ou domínio do site)
        const base = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br';
        const webhookUrl = process.env.WEBHOOK_URL || `${base}/.netlify/functions/payment-notification`;
        
        // Configurar webhook via API
        const webhookPayload = {
            url: webhookUrl,
            events: ['payment'],
            version: 'v1'
        };

        const response = await fetch('https://api.mercadopago.com/v1/webhooks', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ 
                    error: 'Failed to create webhook',
                    details: errorText 
                })
            };
        }

        const webhookData = await response.json();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                webhook: webhookData,
                message: 'Webhook configurado com sucesso!'
            })
        };

    } catch (error) {
        console.error('Error setting up webhook:', error);
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
