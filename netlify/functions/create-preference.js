// Netlify Function: Create Mercado Pago Preference
// Env var required: MP_ACCESS_TOKEN

// CORS helpers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: 'OK' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return { statusCode: 500, headers: corsHeaders, body: 'Missing MP_ACCESS_TOKEN' };
    }

    const body = JSON.parse(event.body || '{}');
    const { title, quantity = 1, currency_id = 'BRL', unit_price, back_url } = body;

    if (!title || typeof unit_price === 'undefined') {
      return { statusCode: 400, headers: corsHeaders, body: 'Invalid payload' };
    }

    // Usar back_url do cliente se fornecido, senão usar URLs padrão
    const baseUrl = back_url || process.env.MP_BACK_BASE_URL || process.env.SITE_URL || process.env.URL || (event && event.headers && event.headers.host ? (`https://${event.headers.host}`) : null);
    // Garantir que o webhook aponte para a raiz do site (sem pathname)
    let siteBase = baseUrl;
    try { siteBase = new URL(baseUrl).origin; } catch(_) {}
    const successUrl = (back_url ? `${back_url}?mp_status=success` : process.env.MP_BACK_URL_SUCCESS || (baseUrl ? `${baseUrl}/?mp_status=success` : 'https://example.com/sucesso'));
    const failureUrl = (back_url ? `${back_url}?mp_status=failure` : process.env.MP_BACK_URL_FAILURE || (baseUrl ? `${baseUrl}/?mp_status=failure` : 'https://example.com/falha'));
    const pendingUrl = (back_url ? `${back_url}?mp_status=pending` : process.env.MP_BACK_URL_PENDING || (baseUrl ? `${baseUrl}/?mp_status=pending` : 'https://example.com/pendente'));

    // Usar external_reference do body se fornecido, senão gerar um único
    const externalRef = body.external_reference || `xtreino_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const preferencePayload = {
      items: [
        {
          title,
          quantity,
          currency_id,
          unit_price: Number(unit_price)
        }
      ],
      back_urls: { success: successUrl, failure: failureUrl, pending: pendingUrl },
      auto_return: 'approved',
      notification_url: `${siteBase}/.netlify/functions/payment-notification`,
      external_reference: externalRef
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferencePayload)
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 502, headers: corsHeaders, body: `Mercado Pago error: ${text}` };
    }

    const data = await res.json();
    // Em produção, use init_point; sandbox_init_point é retornado apenas para contas sandbox
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: data.id, 
        init_point: data.init_point, 
        sandbox_init_point: data.sandbox_init_point,
        external_reference: externalRef
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: err && err.message ? err.message : 'Internal error' };
  }
}


