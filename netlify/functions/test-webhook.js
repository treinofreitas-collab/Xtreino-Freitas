// Netlify Function: Testar se o webhook está funcionando
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Log da requisição
    console.log('=== WEBHOOK TEST ===');
    console.log('Method:', event.httpMethod);
    console.log('Headers:', event.headers);
    console.log('Body:', event.body);
    console.log('Query:', event.queryStringParameters);
    console.log('==================');

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            message: 'Webhook funcionando!',
            method: event.httpMethod,
            timestamp: new Date().toISOString(),
            received: true,
            body: event.body ? JSON.parse(event.body) : null
        })
    };
};
