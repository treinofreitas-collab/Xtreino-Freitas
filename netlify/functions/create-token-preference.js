const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const {
  calculateTokenPrice,
  isCouponValidForTokens,
  jsonResponse,
  parseJsonBody,
} = require("../shared/token-purchase");

function siteBaseUrl() {
  const configured = process.env.PUBLIC_SITE_URL;
  if (configured) return String(configured).replace(/\/+$/, "");

  if (process.env.CONTEXT && process.env.CONTEXT !== "production") {
    return String(
      process.env.DEPLOY_PRIME_URL
      || process.env.URL
      || "https://orgfreitas.com.br",
    ).replace(/\/+$/, "");
  }

  return "https://orgfreitas.com.br";
}

async function readCoupon(db, couponCode) {
  if (!couponCode) return null;
  if (typeof couponCode !== "string" || couponCode.trim().length > 80) {
    throw new Error("Código de cupom inválido.");
  }

  const code = couponCode.trim().toUpperCase();
  const snapshot = await db.collection("coupons")
    .where("code", "==", code)
    .limit(1)
    .get();
  if (snapshot.empty) throw new Error("Cupom não encontrado.");

  const doc = snapshot.docs[0];
  const coupon = doc.data();
  if (!isCouponValidForTokens(coupon)) {
    throw new Error("Cupom inativo, expirado ou não válido para compra de tokens.");
  }
  return { id: doc.id, ...coupon, code };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  try {
    const decoded = await verifyFirebaseUser(event);
    const body = parseJsonBody(event);
    if (!process.env.MP_ACCESS_TOKEN) {
      const error = new Error("Missing MP_ACCESS_TOKEN");
      error.code = "missing_mp_access_token";
      error.statusCode = 503;
      throw error;
    }
    const quantity = Number(body.quantity);
    const admin = getAdmin();
    const db = admin.firestore();
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return jsonResponse(409, { error: "Perfil da conta não encontrado." });
    }

    const userData = userSnap.data();
    const coupon = await readCoupon(db, body.couponCode || "");
    const price = calculateTokenPrice(quantity, coupon);
    const orderRef = db.collection("orders").doc();
    const checkoutRef = db.collection("token_checkouts").doc(orderRef.id);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const amount = Number((price.totalCents / 100).toFixed(2));
    const title = `${quantity} Token${quantity === 1 ? "" : "s"} XTreino`;
    const customerName = userData.name || decoded.name || null;
    const customerEmail = decoded.email || userData.email || null;
    const customerPhone = userData.phone || userData.phoneNumber || null;
    const affiliateCode = typeof body.affiliateCode === "string"
      ? body.affiliateCode.trim().slice(0, 200)
      : null;

    const orderData = {
      title,
      description: title,
      item: title,
      type: "tokens_purchase",
      amount,
      amountCents: price.totalCents,
      total: amount,
      quantity,
      currency: "BRL",
      status: "pending",
      customer: customerEmail,
      customerName,
      buyerEmail: customerEmail,
      customerPhone,
      userId: decoded.uid,
      uid: decoded.uid,
      external_reference: orderRef.id,
      createdAt: timestamp,
      timestamp: Date.now(),
      ...(affiliateCode ? { affiliateCode } : {}),
      ...(coupon ? {
        couponId: coupon.id,
        couponCode: coupon.code,
        originalPrice: price.originalCents / 100,
        couponDiscount: price.discountCents / 100,
      } : {}),
    };

    const checkoutData = {
      orderId: orderRef.id,
      userId: decoded.uid,
      quantity,
      amountCents: price.totalCents,
      originalCents: price.originalCents,
      discountCents: price.discountCents,
      currency: "BRL",
      status: "pending",
      customerEmail,
      customerName,
      affiliateCode,
      ...(coupon ? {
        couponId: coupon.id,
        couponCode: coupon.code,
      } : {}),
      createdAt: timestamp,
    };

    await db.runTransaction(async (transaction) => {
      transaction.create(orderRef, orderData);
      transaction.create(checkoutRef, checkoutData);
    });

    const baseUrl = siteBaseUrl();
    const preference = {
      items: [{
        title,
        quantity: 1,
        unit_price: amount,
        currency_id: "BRL",
      }],
      back_urls: {
        success: `${baseUrl}/client.html`,
        failure: `${baseUrl}/client.html`,
        pending: `${baseUrl}/client.html`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/.netlify/functions/mp-webhook`,
      external_reference: orderRef.id,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN || ""}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": orderRef.id,
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok || !mpData.init_point) {
      await Promise.all([
        orderRef.update({ status: "error" }).catch(() => {}),
        checkoutRef.update({ status: "error" }).catch(() => {}),
      ]);
      console.error("Token preference rejected by Mercado Pago", {
        statusCode: mpResponse.status,
      });
      return jsonResponse(502, { error: "Não foi possível iniciar o pagamento. Tente novamente." });
    }

    await Promise.all([
      orderRef.update({
        preference_id: mpData.id || null,
        paymentUrl: mpData.init_point,
      }),
      checkoutRef.update({
        preferenceId: mpData.id || null,
      }),
    ]);

    return jsonResponse(200, {
      id: mpData.id,
      init_point: mpData.init_point,
      external_reference: orderRef.id,
      quantity,
      amount,
      discount: price.discountCents / 100,
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 400;
    if (statusCode >= 500) {
      console.error("Unable to create secure token checkout", error.code || "server_error");
      return jsonResponse(500, { error: "Não foi possível iniciar a compra com segurança." });
    }
    return jsonResponse(statusCode, { error: error.message || "Não foi possível iniciar a compra." });
  }
};
