exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
        console.error('Missing MP_ACCESS_TOKEN environment variable');
        return { statusCode: 500, headers, body: 'Missing MP_ACCESS_TOKEN' };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const {
        title,
        unit_price,
        currency_id = 'BRL',
        quantity = 1,
        back_url,
        external_reference,
    } = body;

    if (!title || unit_price == null || !back_url) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Campos obrigatórios: title, unit_price, back_url' })
        };
    }

    const priceNum = Number(unit_price);
    if (isNaN(priceNum) || priceNum <= 0) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `unit_price inválido: ${unit_price}` })
        };
    }

    const siteUrl = process.env.URL || 'https://orgfreitas.com.br';
    const notificationUrl = `${siteUrl}/.netlify/functions/mp-webhook`;

    const preference = {
        items: [{
            title: String(title).slice(0, 256),
            unit_price: priceNum,
            currency_id: currency_id,
            quantity: Number(quantity) || 1
        }],
        back_urls: {
            success: back_url,
            failure: back_url,
            pending: back_url
        },
        auto_return: 'approved',
        notification_url: notificationUrl,
        ...(external_reference ? { external_reference: String(external_reference) } : {})
    };

    try {
        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': external_reference || `req_${Date.now()}`
            },
            body: JSON.stringify(preference)
        });

        const mpData = await mpRes.json();

        if (!mpRes.ok) {
            console.error('Mercado Pago API error:', JSON.stringify(mpData));
            return {
                statusCode: mpRes.status,
                headers,
                body: JSON.stringify({ error: mpData?.message || mpData?.cause?.[0]?.description || 'Erro no Mercado Pago', details: mpData })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                id: mpData.id,
                init_point: mpData.init_point,
                sandbox_init_point: mpData.sandbox_init_point
            })
        };
    } catch (err) {
        console.error('create-preference handler error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message || 'Erro interno ao criar preferência' })
        };
    }
};
