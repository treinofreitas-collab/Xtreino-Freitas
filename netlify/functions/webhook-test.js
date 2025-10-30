// Netlify Function: Testar webhook manualmente
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('=== WEBHOOK TEST FUNCTION ===');
        console.log('Method:', event.httpMethod);
        console.log('Body:', event.body);
        
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            console.log('Parsed body:', JSON.stringify(body, null, 2));
            
            if (body.type === 'payment' && body.data && body.data.id) {
                console.log('Payment notification received:', body.data.id);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        message: 'Webhook test successful',
                        paymentId: body.data.id,
                        type: body.type,
                        timestamp: new Date().toISOString()
                    })
                };
            }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Webhook test endpoint',
                method: event.httpMethod,
                timestamp: new Date().toISOString(),
                instructions: {
                    webhookUrl: `${process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br'}/.netlify/functions/payment-notification`,
                    testUrl: `${process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br'}/.netlify/functions/webhook-test`
                }
            })
        };
        
    } catch (error) {
        console.error('Webhook test error:', error);
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
