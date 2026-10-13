const crypto = require("node:crypto");

const ALLOWED_TOKEN_PACKAGES = new Set([1, 5, 25, 50, 100]);

function toCents(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric * 100 + Number.EPSILON);
}

function calculateTokenPrice(quantity, coupon = null) {
  if (!Number.isInteger(quantity) || !ALLOWED_TOKEN_PACKAGES.has(quantity)) {
    throw new Error("Escolha um pacote válido de tokens.");
  }

  const originalCents = quantity * 100;
  let discountCents = 0;

  if (coupon) {
    const value = Number(coupon.discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Cupom com desconto inválido.");
    }

    if (coupon.discountType === "percentage") {
      if (value > 100) throw new Error("Percentual do cupom inválido.");
      discountCents = Math.round((originalCents * value) / 100);
    } else if (coupon.discountType === "fixed") {
      discountCents = toCents(value);
    } else {
      throw new Error("Tipo de desconto do cupom inválido.");
    }
  }

  discountCents = Math.min(originalCents, Math.max(0, discountCents));
  const totalCents = originalCents - discountCents;
  if (totalCents <= 0) {
    throw new Error("O cupom precisa deixar pelo menos R$ 0,01 para pagamento.");
  }

  return { quantity, originalCents, discountCents, totalCents };
}

function isCouponValidForTokens(coupon, now = Date.now()) {
  if (!coupon || coupon.isActive !== true) return false;

  const usageType = String(coupon.usageType || "both").toLowerCase();
  if (!["both", "store", "tokens"].includes(usageType)) return false;

  if (coupon.expirationDate) {
    const expiration = typeof coupon.expirationDate.toDate === "function"
      ? coupon.expirationDate.toDate()
      : new Date(coupon.expirationDate);
    if (Number.isNaN(expiration.getTime()) || expiration.getTime() < now) return false;
  }

  return true;
}

function verifyMercadoPagoSignature({ signature, requestId, dataId, secret }) {
  if (!signature || !dataId || !secret) return false;

  const parts = Object.fromEntries(
    String(signature)
      .split(",")
      .map((part) => part.trim().split("=", 2))
      .filter(([key, value]) => key && value),
  );
  const timestamp = parts.ts;
  const suppliedHash = parts.v1;
  if (!timestamp || !suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) {
    return false;
  }

  let manifest = `id:${String(dataId).toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${timestamp};`;

  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest();
  const actualHash = Buffer.from(suppliedHash, "hex");
  return actualHash.length === expectedHash.length
    && crypto.timingSafeEqual(actualHash, expectedHash);
}

function validateApprovedPayment(payment, checkout) {
  if (!payment || payment.status !== "approved") {
    return { valid: false, status: payment?.status || "not_found" };
  }

  if (String(payment.external_reference || "") !== String(checkout.orderId || "")) {
    return { valid: false, status: "external_reference_mismatch" };
  }

  if (String(payment.currency_id || "").toUpperCase() !== "BRL") {
    return { valid: false, status: "currency_mismatch" };
  }

  const paidCents = toCents(payment.transaction_amount);
  if (paidCents == null || paidCents !== Number(checkout.amountCents)) {
    return { valid: false, status: "amount_mismatch" };
  }

  return { valid: true, status: "approved" };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function parseJsonBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    const error = new Error("JSON inválido.");
    error.statusCode = 400;
    throw error;
  }
}

function getHeader(event, name) {
  const wanted = name.toLowerCase();
  const headers = event.headers || {};
  const key = Object.keys(headers).find((headerName) => headerName.toLowerCase() === wanted);
  return key ? headers[key] : undefined;
}

module.exports = {
  ALLOWED_TOKEN_PACKAGES,
  calculateTokenPrice,
  getHeader,
  isCouponValidForTokens,
  jsonResponse,
  parseJsonBody,
  toCents,
  validateApprovedPayment,
  verifyMercadoPagoSignature,
};
