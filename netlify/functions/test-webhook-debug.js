// Netlify Function: Test webhook debug
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
        console.log('=== WEBHOOK DEBUG TEST ===');
        console.log('Method:', event.httpMethod);
        console.log('Headers:', JSON.stringify(event.headers, null, 2));
        console.log('Body:', event.body);
        console.log('Query:', event.queryStringParameters);
        
        // Simular um webhook do Mercado Pago
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            console.log('Parsed body:', JSON.stringify(body, null, 2));
            
            if (body.type === 'payment' && body.data && body.data.id) {
                console.log('Payment notification detected:', body.data.id);
                
                // Aqui você pode testar a lógica do webhook
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        message: 'Webhook test successful',
                        paymentId: body.data.id,
                        type: body.type
                    })
                };
            }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Webhook debug endpoint',
                method: event.httpMethod,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Webhook debug error:', error);
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
