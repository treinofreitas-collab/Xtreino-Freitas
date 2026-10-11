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
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing MP_ACCESS_TOKEN' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (_) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const external_reference = body.external_reference || body.preferenceId;
    if (!external_reference) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'external_reference obrigatório' }) };
    }

    try {
        const mpRes = await fetch(
            `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(external_reference)}&limit=5&sort=date_created&criteria=desc`,
            {
                headers: {
                    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!mpRes.ok) {
            const err = await mpRes.text();
            console.error('[check-pix-status] MP error:', mpRes.status, err);
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'pending' }) };
        }

        const mpData = await mpRes.json();
        const results = mpData.results || [];

        if (results.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'pending' }) };
        }

        const approved = results.find(p => p.status === 'approved');
        if (approved) {
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'approved', paymentId: approved.id }) };
        }

        const rejected = results.find(p => ['rejected', 'cancelled', 'charged_back', 'refunded'].includes(p.status));
        if (rejected) {
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'rejected', paymentId: rejected.id }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ status: 'pending' }) };

    } catch (err) {
        console.error('[check-pix-status] Erro:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'pending' }) };
    }
};
