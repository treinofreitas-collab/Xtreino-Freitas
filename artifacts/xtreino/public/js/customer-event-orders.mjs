const CONFIRMED_EVENT_STATUSES = new Set([
    'paid',
    'confirmed',
    'approved',
    'lisagem_gratis',
]);

export function isDisplayableEventRegistration(registration = {}) {
    if (registration.paidWithTokens === true) return true;
    return CONFIRMED_EVENT_STATUSES.has(String(registration.status || '').trim().toLowerCase());
}
