import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/create-preference", async (req, res) => {
  const token = process.env["MP_ACCESS_TOKEN"];
  if (!token) {
    res.status(503).send("Missing MP_ACCESS_TOKEN");
    return;
  }

  const { title, unit_price, currency_id = "BRL", quantity = 1, back_url, external_reference } = req.body || {};

  if (!title || unit_price == null || !back_url) {
    res.status(400).json({ error: "Campos obrigatórios: title, unit_price, back_url" });
    return;
  }

  const priceNum = Number(unit_price);
  if (isNaN(priceNum) || priceNum <= 0) {
    res.status(400).json({ error: `unit_price inválido: ${unit_price}` });
    return;
  }

  try {
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": external_reference || `req_${Date.now()}`,
      },
      body: JSON.stringify({
        items: [{ title: String(title).slice(0, 256), unit_price: priceNum, currency_id, quantity: Number(quantity) || 1 }],
        back_urls: { success: back_url, failure: back_url, pending: back_url },
        auto_return: "approved",
        ...(external_reference ? { external_reference: String(external_reference) } : {}),
      }),
    });

    const mpData = (await mpRes.json()) as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };

    if (!mpRes.ok) {
      req.log.error({ status: mpRes.status, mpData }, "MP API error create-preference");
      res.status(mpRes.status).json({ error: mpData?.message || "Erro no Mercado Pago" });
      return;
    }

    res.json({ id: mpData.id, init_point: mpData.init_point, sandbox_init_point: mpData.sandbox_init_point });
  } catch (err) {
    req.log.error({ err }, "Erro ao criar preferência MP");
    res.status(500).json({ error: "Erro interno ao criar preferência" });
  }
});

router.post("/check-payment-status", async (req, res) => {
  const token = process.env["MP_ACCESS_TOKEN"];
  if (!token) {
    res.status(503).json({ error: "MP_ACCESS_TOKEN não configurado" });
    return;
  }

  const { external_reference, preference_id } = req.body || {};
  const ref = external_reference || preference_id;
  if (!ref) {
    res.status(400).json({ error: "external_reference obrigatório" });
    return;
  }

  try {
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!mpRes.ok) {
      res.status(mpRes.status).json({ error: "Erro ao consultar Mercado Pago" });
      return;
    }

    const data = (await mpRes.json()) as { results?: Array<{ status?: string; status_detail?: string; id?: number }> };
    const payment = data?.results?.[0];

    if (!payment) {
      res.json({ status: "not_found" });
      return;
    }

    res.json({
      status: payment.status,
      status_detail: payment.status_detail,
      payment_id: payment.id,
    });
  } catch (err) {
    req.log.error({ err }, "Erro ao verificar pagamento MP");
    res.status(500).json({ error: "Erro interno ao verificar pagamento" });
  }
});

router.post("/mp-webhook", async (req, res) => {
  const token = process.env["MP_ACCESS_TOKEN"];
  if (!token) {
    res.status(503).json({ error: "MP_ACCESS_TOKEN não configurado" });
    return;
  }

  const { type, data } = req.body || {};
  if (type !== "payment" || !data?.id) {
    res.sendStatus(200);
    return;
  }

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mpRes.ok) {
      res.sendStatus(200);
      return;
    }
    const payment = (await mpRes.json()) as { status?: string; external_reference?: string };

    req.log.info({ paymentId: data.id, status: payment.status, ref: payment.external_reference }, "Webhook MP recebido");

    res.sendStatus(200);
  } catch (err) {
    req.log.error({ err }, "Erro no webhook MP");
    res.sendStatus(200);
  }
});

export default router;
