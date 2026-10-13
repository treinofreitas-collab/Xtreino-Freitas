export async function paymentFetch(user, url, options = {}) {
    if (!user && window.firebaseAuth) {
        await window.firebaseAuth.authStateReady?.();
        user = window.firebaseAuth.currentUser;
    }
    if (!user || typeof user.getIdToken !== 'function') throw new Error('Faça login para concluir o pagamento.');
    const idToken = await user.getIdToken();
    return fetch(url, {
        ...options,
        headers: { ...options.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }
    });
}

export async function confirmPayment(user, reference) {
    if (!reference || typeof reference !== 'string') throw new Error('Referência de compra inválida.');
    const tokenPurchase = !/^(digital_|schedule_|event_|tokens_|free_)/.test(reference);
    const url = tokenPurchase ? 'confirm-token-purchase' : 'confirm-purchase';
    const response = await paymentFetch(user, `/.netlify/functions/${url}`, {
        method: 'POST', body: JSON.stringify({ external_reference: reference })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !data.status) throw new Error(data.error || 'Não foi possível confirmar o pagamento agora.');
    return data;
}

export function paymentCompleted(result) {
    return ['paid', 'already_paid', 'credited', 'already_credited'].includes(result?.status);
}
