const { getAdmin } = require("./firebase-admin");
const { validateApprovedPayment } = require("./token-purchase");

async function findAffiliateRef(db, affiliateCode) {
  if (!affiliateCode || typeof affiliateCode !== "string") return null;

  const directRef = db.collection("users").doc(affiliateCode);
  const directSnap = await directRef.get();
  if (directSnap.exists) return directRef;

  const byEmail = await db.collection("users")
    .where("email", "==", affiliateCode)
    .limit(1)
    .get();
  return byEmail.empty ? null : byEmail.docs[0].ref;
}

async function creditApprovedTokenOrder(payment, expectedUid = null) {
  const admin = getAdmin();
  const db = admin.firestore();
  const externalReference = String(payment?.external_reference || "");
  if (!externalReference || externalReference.includes("/") || payment?.id == null) {
    return { status: "not_found" };
  }

  const checkoutRef = db.collection("token_checkouts").doc(externalReference);
  const initialCheckoutSnap = await checkoutRef.get();
  if (!initialCheckoutSnap.exists) return { status: "not_found" };
  const initialCheckout = initialCheckoutSnap.data();

  if (expectedUid && initialCheckout.userId !== expectedUid) {
    return { status: "forbidden" };
  }

  const paymentCheck = validateApprovedPayment(payment, {
    ...initialCheckout,
    orderId: externalReference,
  });
  if (!paymentCheck.valid) {
    return { status: paymentCheck.status };
  }

  const orderRef = db.collection("orders").doc(externalReference);
  const userRef = db.collection("users").doc(initialCheckout.userId);
  const creditRef = db.collection("token_credits").doc(externalReference);
  const couponRef = initialCheckout.couponId
    ? db.collection("coupons").doc(initialCheckout.couponId)
    : null;
  const couponUsageRef = initialCheckout.couponId
    ? db.collection("couponUsage").doc(`token_${externalReference}`)
    : null;

  let affiliateRef = null;
  if (initialCheckout.affiliateCode) {
    affiliateRef = await findAffiliateRef(db, initialCheckout.affiliateCode);
  }
  const affiliateSaleRef = db.collection("affiliate_sales").doc(`token_${externalReference}`);
  const managerSaleRef = db.collection("affiliate_sales").doc(`manager_token_${externalReference}`);

  return db.runTransaction(async (transaction) => {
    const refs = [
      checkoutRef,
      orderRef,
      userRef,
      creditRef,
      affiliateSaleRef,
      managerSaleRef,
    ];
    if (couponRef) refs.push(couponRef);
    if (couponUsageRef) refs.push(couponUsageRef);
    if (affiliateRef) refs.push(affiliateRef);
    const uniqueRefs = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
    const snapshots = await Promise.all(uniqueRefs.map((ref) => transaction.get(ref)));
    const snapshotByPath = new Map(uniqueRefs.map((ref, index) => [ref.path, snapshots[index]]));

    const checkoutSnap = snapshotByPath.get(checkoutRef.path);
    const orderSnap = snapshotByPath.get(orderRef.path);
    const userSnap = snapshotByPath.get(userRef.path);
    const creditSnap = snapshotByPath.get(creditRef.path);
    const affiliateSaleSnap = snapshotByPath.get(affiliateSaleRef.path);
    const managerSaleSnap = snapshotByPath.get(managerSaleRef.path);
    const couponSnap = couponRef ? snapshotByPath.get(couponRef.path) : null;
    const couponUsageSnap = couponUsageRef ? snapshotByPath.get(couponUsageRef.path) : null;
    const affiliateSnap = affiliateRef ? snapshotByPath.get(affiliateRef.path) : null;

    if (!checkoutSnap?.exists || !orderSnap?.exists) {
      return { status: "not_found" };
    }

    const checkout = checkoutSnap.data();
    const order = orderSnap.data();
    if (expectedUid && checkout.userId !== expectedUid) {
      return { status: "forbidden" };
    }
    if (
      checkout.userId !== initialCheckout.userId
      || order.userId !== checkout.userId
      || order.type !== "tokens_purchase"
      || Number(order.quantity) !== Number(checkout.quantity)
      || Number(order.amountCents) !== Number(checkout.amountCents)
    ) {
      return { status: "order_mismatch" };
    }
    const freshPaymentCheck = validateApprovedPayment(payment, {
      ...checkout,
      orderId: externalReference,
    });
    if (!freshPaymentCheck.valid) return { status: freshPaymentCheck.status };

    if (creditSnap?.exists) {
      const savedCredit = creditSnap.data();
      return {
        status: String(savedCredit.paymentId) === String(payment.id)
          ? "already_credited"
          : "duplicate_payment_review",
        balance: Number(userSnap?.data()?.tokens || 0),
        quantity: Number(checkout.quantity),
      };
    }
    if (checkout.status === "credited") {
      return { status: "data_integrity_review" };
    }
    if (!userSnap?.exists) return { status: "user_not_found" };

    const userData = userSnap.data();
    const oldBalance = Number(userData.tokens || 0);
    const quantity = Number(checkout.quantity);
    if (!Number.isFinite(oldBalance) || !Number.isInteger(quantity) || quantity <= 0) {
      return { status: "invalid_balance_or_quantity" };
    }

    let affiliateCommission = null;
    let managerCommission = null;
    if (
      affiliateRef
      && affiliateSnap?.exists
      && !affiliateSaleSnap?.exists
      && affiliateRef.id !== checkout.userId
    ) {
      const affiliate = affiliateSnap.data();
      const buyerEmail = String(checkout.customerEmail || "").toLowerCase();
      const isAffiliate = affiliate.role === "Afiliado"
        && affiliate.affiliateStatus !== "inactive"
        && String(affiliate.email || "").toLowerCase() !== buyerEmail;
      const commissionRate = Number(
        affiliate.commissionRateProducts ?? affiliate.commissionRate ?? 10,
      );
      const saleValue = Number(checkout.amountCents) / 100;
      const commissionAmount = saleValue * commissionRate / 100;

      if (
        isAffiliate
        && Number.isFinite(commissionRate)
        && commissionRate >= 0
        && commissionRate <= 100
        && commissionAmount > 0
      ) {
        const productName = order.title || `${quantity} Tokens XTreino`;
        affiliateCommission = {
          affiliateId: affiliateRef.id,
          productName,
          saleValue,
          commissionRate,
          commissionAmount,
        };

        const managerId = affiliate.managerId;
        const managerCommissionRate = Number(affiliate.managerCommissionRate);
        if (
          managerId
          && managerId !== checkout.userId
          && managerId !== affiliateRef.id
          && !managerSaleSnap?.exists
          && Number.isFinite(managerCommissionRate)
          && managerCommissionRate > 0
          && managerCommissionRate <= 100
        ) {
          const managerRef = db.collection("users").doc(managerId);
          const managerSnap = await transaction.get(managerRef);
          const managerCommissionAmount = commissionAmount * managerCommissionRate / 100;
          if (managerSnap.exists && managerCommissionAmount > 0) {
            managerCommission = {
              affiliateId: managerId,
              managerEmail: affiliate.managerEmail || null,
              sourceAffiliateId: affiliateRef.id,
              productName,
              saleValue,
              affiliateCommissionAmount: commissionAmount,
              commissionRate: managerCommissionRate,
              commissionAmount: managerCommissionAmount,
            };
          }
        }
      }
    }

    const balance = Number((oldBalance + quantity).toFixed(2));
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const paymentId = String(payment.id);

    transaction.create(creditRef, {
      orderId: externalReference,
      paymentId,
      userId: checkout.userId,
      quantity,
      amountCents: checkout.amountCents,
      currency: "BRL",
      externalReference,
      creditedAt: serverTimestamp,
      balanceAfter: balance,
    });

    transaction.update(userRef, {
      tokens: balance,
      updatedAt: serverTimestamp,
    });
    transaction.update(orderRef, {
      status: "paid",
      paidAt: serverTimestamp,
      tokensCredited: true,
      tokensCreditedAt: serverTimestamp,
      tokensCreditedPaymentId: paymentId,
    });
    transaction.update(checkoutRef, {
      status: "credited",
      paymentId,
      creditedAt: serverTimestamp,
    });

    if (couponUsageRef && !couponUsageSnap?.exists) {
      const originalValue = Number(checkout.originalCents || 0) / 100;
      const discountAmount = Number(checkout.discountCents || 0) / 100;
      transaction.create(couponUsageRef, {
        couponId: checkout.couponId,
        couponCode: checkout.couponCode,
        customerEmail: checkout.customerEmail || null,
        customerName: checkout.customerName || null,
        orderValue: originalValue,
        discountAmount,
        finalValue: Number(checkout.amountCents) / 100,
        context: "tokens",
        orderId: externalReference,
        usedAt: serverTimestamp,
        userId: checkout.userId,
        productName: `${quantity} Token${quantity === 1 ? "" : "s"} XTreino`,
        discountPercentage: originalValue > 0
          ? ((discountAmount / originalValue) * 100).toFixed(2)
          : "0.00",
      });
      if (couponSnap?.exists) {
        transaction.update(couponRef, {
          usageCount: admin.firestore.FieldValue.increment(1),
        });
      }
    }

    if (affiliateCommission) {
      transaction.create(affiliateSaleRef, {
        affiliateId: affiliateCommission.affiliateId,
        orderId: externalReference,
        customerEmail: checkout.customerEmail || null,
        customerName: checkout.customerName || null,
        productName: affiliateCommission.productName,
        saleValue: affiliateCommission.saleValue,
        commissionRate: affiliateCommission.commissionRate,
        commissionAmount: affiliateCommission.commissionAmount,
        saleType: "product",
        type: "affiliate",
        status: "pending",
        createdAt: serverTimestamp,
      });
    }

    if (managerCommission) {
      transaction.create(managerSaleRef, {
        affiliateId: managerCommission.affiliateId,
        managerEmail: managerCommission.managerEmail,
        sourceAffiliateId: managerCommission.sourceAffiliateId,
        sourceAffiliateEmail: checkout.customerEmail || null,
        orderId: externalReference,
        customerEmail: checkout.customerEmail || null,
        customerName: checkout.customerName || null,
        productName: managerCommission.productName,
        saleValue: managerCommission.saleValue,
        affiliateCommissionAmount: managerCommission.affiliateCommissionAmount,
        commissionRate: managerCommission.commissionRate,
        commissionAmount: managerCommission.commissionAmount,
        saleType: "product",
        type: "manager_commission",
        status: "pending",
        createdAt: serverTimestamp,
      });
    }

    return { status: "credited", balance, quantity };
  });
}

async function fetchPaymentById(paymentId) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    const error = new Error("Missing MP_ACCESS_TOKEN");
    error.code = "missing_mp_access_token";
    throw error;
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    const error = new Error("Mercado Pago payment lookup failed");
    error.code = "mercadopago_lookup_failed";
    error.statusCode = response.status;
    throw error;
  }
  return response.json();
}

async function findPaymentsByExternalReference(externalReference) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    const error = new Error("Missing MP_ACCESS_TOKEN");
    error.code = "missing_mp_access_token";
    throw error;
  }

  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("external_reference", externalReference);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("limit", "20");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const error = new Error("Mercado Pago payment search failed");
    error.code = "mercadopago_search_failed";
    error.statusCode = response.status;
    throw error;
  }
  const data = await response.json();
  return Array.isArray(data.results) ? data.results : [];
}

module.exports = {
  creditApprovedTokenOrder,
  fetchPaymentById,
  findPaymentsByExternalReference,
};
