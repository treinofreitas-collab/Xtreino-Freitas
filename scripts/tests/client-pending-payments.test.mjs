import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const clientSource = readFileSync(
    new URL('../../artifacts/xtreino/public/client.js', import.meta.url),
    'utf8',
);
const clientHtml = readFileSync(
    new URL('../../artifacts/xtreino/public/client.html', import.meta.url),
    'utf8',
);
const adminSource = readFileSync(
    new URL('../../artifacts/xtreino/public/admin.js', import.meta.url),
    'utf8',
);

const helperStart = clientSource.indexOf('function buildPendingPaymentGroups(');
const helperEnd = clientSource.indexOf('async function loadPendingPayments', helperStart);
assert.notEqual(helperStart, -1, 'pending-payment grouping helper exists');
assert.notEqual(helperEnd, -1, 'pending-payment grouping helper has an end marker');
const groupingSource = clientSource.slice(helperStart, helperEnd);

function buildGroups(registrations, orders) {
    const context = vm.createContext({
        isTokenPurchaseOrder: row => String(row?.data?.type || '').includes('token'),
    });
    return vm.runInContext(
        `${groupingSource}; buildPendingPaymentGroups(registrations, orders)`,
        Object.assign(context, { registrations, orders }),
    );
}

test('groups multi-slot event registrations under one pending payment reference', () => {
    const groups = buildGroups([
        { id: 'slot-1', data: { status: 'pending', external_reference: 'event-ref', title: 'TREINO FREITAS', date: '2026-10-21', schedule: '19h' } },
        { id: 'slot-2', data: { status: 'pending', external_reference: 'event-ref', title: 'TREINO FREITAS', date: '2026-10-21', schedule: '20h' } },
        { id: 'paid', data: { status: 'paid', external_reference: 'paid-ref', title: 'Já pago' } },
        { id: 'missing-ref', data: { status: 'pending', title: 'Sem referência' } },
    ], []);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].externalReference, 'event-ref');
    assert.equal(groups[0].items.length, 2);
    assert.deepEqual(Array.from(groups[0].labels), [
        'TREINO FREITAS · 21/10/2026 · 19h',
        'TREINO FREITAS · 21/10/2026 · 20h',
    ]);
});

test('includes a pending store item but excludes token purchases and paid orders', () => {
    const groups = buildGroups([], [
        { id: 'store-1', data: { status: 'pending', external_reference: 'store-ref', productName: 'Passe Booyah' } },
        { id: 'tokens', data: { status: 'pending', external_reference: 'token-ref', type: 'token_purchase' } },
        { id: 'paid', data: { status: 'paid', external_reference: 'paid-ref', productName: 'Pago' } },
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].kind, 'product');
    assert.equal(groups[0].labels[0], 'Passe Booyah');
});

test('the account can resume a payment and render QR/copy-paste controls without creating a new Pix', () => {
    assert.match(clientHtml, /id="pendingPaymentsSection"/);
    assert.match(clientHtml, /id="pendingPaymentsList"/);
    assert.match(clientSource, /\/\.netlify\/functions\/resume-pix-payment/);
    assert.match(clientSource, /data-copy-pix-code/);
    assert.doesNotMatch(clientSource, /\/\.netlify\/functions\/create-pix-payment/);
});

test('the admin schedule modal has an individual high-quality logo download action', () => {
    assert.ok(adminSource.includes('data-download-team-logo'));
    assert.ok(adminSource.includes('downloadOriginalTeamLogo(r, logoDownloadBtn)'));
    assert.ok(adminSource.includes('async function downloadOriginalTeamLogo'));
    const downloaderStart = adminSource.indexOf('async function downloadOriginalTeamLogo');
    const downloaderEnd = adminSource.indexOf('\nasync function baixarPacoteSPEC', downloaderStart);
    const downloader = adminSource.slice(downloaderStart, downloaderEnd);
    assert.match(downloader, /resolveSpecOriginalLogoUrl\(registration\)/);
    assert.doesNotMatch(downloader, /teamLogoThumb/);

    const zipStart = adminSource.indexOf('async function baixarPacoteSPEC');
    const zipEnd = adminSource.indexOf('\nwindow.baixarPacoteSPEC', zipStart);
    const zipDownloader = adminSource.slice(zipStart, zipEnd);
    assert.match(zipDownloader, /compression: 'STORE'/);
    assert.doesNotMatch(zipDownloader, /teamLogoThumb|PLACEHOLDER/);
});
