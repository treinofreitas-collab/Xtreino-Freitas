// Netlify Function: Create Mercado Pago Preference
// Env var required: MP_ACCESS_TOKEN

// CORS helpers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Firebase Admin will be used to validate and reserve coupons atomically
const admin = require('firebase-admin');
try {
  if (!admin.apps.length) {
    const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    } else if (svc) {
      const parsed = JSON.parse(svc);
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID, credential: admin.credential.applicationDefault() });
    } else {
      admin.initializeApp();
    }
  }
} catch (e) {
  // ignore, will fail later if DB is required and not available
}

const MIN_FINAL_PAYMENT = 0.01; // minimal allowed final amount after discount

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

    // Normalize coupon payloads: accept either `couponCode` (string) or `coupon_info` (object or string)
    let couponCode = body.couponCode || null;
    if (!couponCode && body.coupon_info) {
      if (typeof body.coupon_info === 'string') {
        couponCode = body.coupon_info;
      } else if (typeof body.coupon_info === 'object') {
        couponCode = body.coupon_info.code || body.coupon_info.id || body.coupon_info.couponCode || null;
      }
    }

    // Se for camisa, ignorar cupom
    const isShirt = (title && title.toLowerCase().includes('camisa')) || (body.item && String(body.item).toLowerCase().includes('camisa'));
    if (isShirt) {
      couponCode = null;
    }

    // Normalize user identification - accept from root or from coupon_info
    const userId = body.userId || (body.coupon_info && body.coupon_info.userId) || null;
    const customerEmail = body.customerEmail || (body.coupon_info && (body.coupon_info.email || body.coupon_info.customerEmail)) || null;

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
    
    let finalUnitPrice = Number(unit_price);

    // If couponCode is present, validate and reserve it atomically
    if (couponCode && admin && admin.firestore) {
      const db = admin.firestore();
      const couponQuery = await db.collection('coupons').where('code', '==', String(couponCode)).limit(1).get();
      if (couponQuery.empty) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'COUPON_001', message: 'Cupom não encontrado' }) };
      }

      const couponDoc = couponQuery.docs[0];
      const couponRef = couponDoc.ref;
      // Run transaction to check limits and reserve one usage
      try {
        await db.runTransaction(async (tx) => {
          const c = await tx.get(couponRef);
          if (!c.exists) throw new Error('COUPON_001');
          const cd = c.data() || {};

          // Accept either `active` or `isActive` boolean flags for backward compatibility
          if ((typeof cd.active !== 'undefined' && cd.active === false) || (typeof cd.isActive !== 'undefined' && cd.isActive === false)) {
            throw new Error('COUPON_003');
          }
          if (cd.expiresAt) {
            const exp = cd.expiresAt.toDate ? cd.expiresAt.toDate() : new Date(cd.expiresAt);
            if (new Date() > exp) throw new Error('COUPON_002');
          }

          const maxUses = cd.maxUses || cd.usesLimit || null;
          const used = cd.used || 0;
          if (maxUses !== null && used >= maxUses) throw new Error('COUPON_005');

          // Per-user limit check (if userId or email provided)
          const perUserLimit = typeof cd.perUserLimit === 'number' ? cd.perUserLimit : 0;
          if (perUserLimit > 0 && (userId || customerEmail)) {
            let usedByUser = false;
            try {
              if (userId) {
                const uq = await tx.get(
                  db.collection('couponUsage')
                    .where('couponId', '==', couponRef.id)
                    .where('userId', '==', userId)
                    .limit(1)
                );
                if (!uq.empty) usedByUser = true;
              }
              if (!usedByUser && customerEmail) {
                const uq2 = await tx.get(
                  db.collection('couponUsage')
                    .where('couponId', '==', couponRef.id)
                    .where('email', '==', customerEmail)
                    .limit(1)
                );
                if (!uq2.empty) usedByUser = true;
              }
            } catch (perUserErr) {
              console.warn('⚠️ Falha ao verificar limite por usuário do cupom. Prosseguindo sem bloquear.', perUserErr?.message || perUserErr);
            }
            if (usedByUser && perUserLimit <= 1) {
              throw new Error('COUPON_005');
            }
            if (usedByUser && perUserLimit > 1) {
              // Ainda não controlamos múltiplos usos por usuário; bloquear para evitar abuso
              throw new Error('COUPON_005');
            }
          }

          // Compute discount safely
          const subtotal = Number(unit_price) * Number(quantity || 1);
          let discount = 0;
          if (cd.discountType === 'percentage') {
            discount = subtotal * (Number(cd.value || 0) / 100);
          } else {
            discount = Number(cd.value || 0);
          }

          // Clamp discount so final amount is at least MIN_FINAL_PAYMENT
          const maxAllowedDiscount = Math.max(0, subtotal - MIN_FINAL_PAYMENT);
          if (discount > maxAllowedDiscount) discount = maxAllowedDiscount;

          const finalAmount = Math.max(MIN_FINAL_PAYMENT, subtotal - discount);
          finalUnitPrice = finalAmount / Number(quantity || 1);

          // Reserve usage: increment coupon.used and create couponUsage doc
          tx.update(couponRef, { used: (cd.used || 0) + 1 });
          const usageRef = db.collection('couponUsage').doc();
          const usageDoc = {
            couponId: couponRef.id,
            code: cd.code || couponCode,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: userId || null,
            email: customerEmail || null,
            externalReference: externalRef || null
          };
          tx.set(usageRef, usageDoc);
        });
      } catch (txErr) {
        console.error('Coupon transaction error:', txErr && txErr.message ? txErr.message : txErr);
        const code = (txErr && txErr.message) ? txErr.message : 'COUPON_ERR';
        let status = 400;
        let bodyErr = { error: code, message: 'Coupon validation failed' };
        if (code === 'COUPON_001') bodyErr = { error: 'COUPON_001', message: 'Cupom não encontrado' };
        else if (code === 'COUPON_002') bodyErr = { error: 'COUPON_002', message: 'Cupom expirado' };
        else if (code === 'COUPON_003') bodyErr = { error: 'COUPON_003', message: 'Cupom inativo' };
        else if (code === 'COUPON_005') bodyErr = { error: 'COUPON_005', message: 'Cupom já utilizado no limite' };

        return { statusCode: status, headers: corsHeaders, body: JSON.stringify(bodyErr) };
      }
    }

    const preferencePayload = {
      items: [
        {
          title,
          quantity,
          currency_id,
          unit_price: Number(finalUnitPrice)
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


