const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  calculateTokenPrice,
  isCouponValidForTokens,
  toCents,
  validateApprovedPayment,
  verifyMercadoPagoSignature,
} = require("./token-purchase");

test("calculates package prices and discounts in cents", () => {
  assert.deepEqual(calculateTokenPrice(5), {
    quantity: 5,
    originalCents: 500,
    discountCents: 0,
    totalCents: 500,
  });
  assert.deepEqual(calculateTokenPrice(25, {
    discountType: "percentage",
    discountValue: 10,
  }), {
    quantity: 25,
    originalCents: 2500,
    discountCents: 250,
    totalCents: 2250,
  });
  assert.deepEqual(calculateTokenPrice(5, {
    discountType: "fixed",
    discountValue: 1.25,
  }), {
    quantity: 5,
    originalCents: 500,
    discountCents: 125,
    totalCents: 375,
  });
});

test("rejects unsupported token quantities and free checkouts", () => {
  assert.throws(() => calculateTokenPrice(2), /pacote válido/);
  assert.throws(() => calculateTokenPrice(100, {
    discountType: "percentage",
    discountValue: 100,
  }), /R\$ 0,01/);
});

test("only active, unexpired store or general coupons apply to tokens", () => {
  assert.equal(isCouponValidForTokens({ isActive: true, usageType: "both" }), true);
  assert.equal(isCouponValidForTokens({ isActive: true, usageType: "store" }), true);
  assert.equal(isCouponValidForTokens({ isActive: true, usageType: "events" }), false);
  assert.equal(isCouponValidForTokens({ isActive: false, usageType: "both" }), false);
  assert.equal(toCents("2.50"), 250);
});

test("validates approved payment reference, currency and exact total", () => {
  const checkout = { orderId: "order-1", amountCents: 2250 };
  assert.equal(validateApprovedPayment({
    id: 123,
    status: "approved",
    external_reference: "order-1",
    currency_id: "BRL",
    transaction_amount: 22.5,
  }, checkout).valid, true);
  assert.equal(validateApprovedPayment({
    id: 123,
    status: "approved",
    external_reference: "order-1",
    currency_id: "BRL",
    transaction_amount: 22.49,
  }, checkout).status, "amount_mismatch");
  assert.equal(validateApprovedPayment({
    id: 123,
    status: "pending",
    external_reference: "order-1",
    currency_id: "BRL",
    transaction_amount: 22.5,
  }, checkout).status, "pending");
});

test("validates Mercado Pago HMAC signatures and rejects altered inputs", () => {
  const secret = "test-webhook-secret";
  const dataId = "123456789";
  const requestId = "request-1";
  const timestamp = "1710000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const signature = `ts=${timestamp},v1=${hash}`;

  assert.equal(verifyMercadoPagoSignature({
    signature,
    requestId,
    dataId,
    secret,
  }), true);
  assert.equal(verifyMercadoPagoSignature({
    signature,
    requestId,
    dataId: "123456788",
    secret,
  }), false);
  assert.equal(verifyMercadoPagoSignature({
    signature,
    requestId,
    dataId,
    secret: "wrong-secret",
  }), false);
});
