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
const scriptSource = readFileSync(
    new URL('../../artifacts/xtreino/public/script.js', import.meta.url),
    'utf8',
);
const eventPageSource = readFileSync(
    new URL('../../artifacts/xtreino/public/evento.html', import.meta.url),
    'utf8',
);
const indexSource = readFileSync(
    new URL('../../artifacts/xtreino/public/index.html', import.meta.url),
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

test('original logo lookup accepts only unique name-and-time matches and scoped storage paths', () => {
    const helperStart = adminSource.indexOf('function getSpecOriginalLogoUrl(');
    const helperEnd = adminSource.indexOf('async function getSpecLogoStorageItems', helperStart);
    assert.notEqual(helperStart, -1);
    assert.notEqual(helperEnd, -1);
    const helperSource = adminSource.slice(helperStart, helperEnd);
    const helpers = vm.runInContext(
        `${helperSource}; ({ getSpecOriginalLogoUrl, findSpecStorageOriginalLogoItem, getSpecUserLogoStoragePath })`,
        vm.createContext({}),
    );

    const createdAt = 1792638000000;
    const matchingOriginal = { name: `NEXUS_${createdAt + 5000}` };
    assert.equal(
        helpers.findSpecStorageOriginalLogoItem([matchingOriginal], { teamName: 'NEXUS B', createdAt }),
        matchingOriginal,
    );
    assert.equal(
        helpers.findSpecStorageOriginalLogoItem(
            [matchingOriginal, { name: `NEXUS_B_${createdAt + 6000}` }],
            { teamName: 'NEXUS B', createdAt },
        ),
        null,
        'ambiguous original files are not guessed',
    );
    assert.equal(
        helpers.getSpecUserLogoStoragePath('captain-123', 'modo liga'),
        'profile-photos/captain-123/team-logos/modo_liga',
    );
    assert.equal(helpers.getSpecUserLogoStoragePath('uid/../other', 'modo-liga'), '');
    assert.equal(helpers.getSpecOriginalLogoUrl({ teamLogoThumb: 'thumbnail-url' }), null);
    assert.match(adminSource, /registration\?\.userId/);
    assert.match(adminSource, /teamProfile\?\.capitaoId/);
});

test('logo failures stop reservations, and the captain can restore the original on the team profile', () => {
    const uploaderStart = scriptSource.indexOf('function getTeamLogoStoragePaths(');
    const uploaderEnd = scriptSource.indexOf('\nfunction isTeamLogoPermissionDenied', uploaderStart);
    assert.notEqual(uploaderStart, -1);
    assert.notEqual(uploaderEnd, -1);
    const getPaths = vm.runInContext(
        `${scriptSource.slice(uploaderStart, uploaderEnd)}; getTeamLogoStoragePaths`,
        vm.createContext({}),
    );
    const paths = getPaths('Nexus Team', 'modo-liga', 'captain-123', 1792638000000);
    assert.equal(paths.primary, 'teams/modo-liga/logos/Nexus_Team_1792638000000');
    assert.equal(paths.userScoped, 'profile-photos/captain-123/team-logos/modo-liga/Nexus_Team_1792638000000');
    assert.match(scriptSource, /storage\/unauthorized/);
    assert.match(scriptSource, /paths\.userScoped/);
    assert.match(scriptSource, /throw uploadError/);

    const scheduleStart = scriptSource.indexOf('async function submitSchedule(');
    const scheduleEnd = scriptSource.indexOf('async function createRegistrationsForEvent', scheduleStart);
    const scheduleFlow = scriptSource.slice(scheduleStart, scheduleEnd);
    assert.ok(scheduleFlow.indexOf('uploadTeamLogo(team.logoBase64') < scheduleFlow.indexOf('allocateSlotsFromDB('));
    assert.match(scheduleFlow, /throw new Error\('Não foi possível salvar a logo original/);

    const eventStart = scriptSource.indexOf('async function createRegistrationsForEvent(');
    const eventEnd = scriptSource.indexOf('\nfunction ', eventStart + 1);
    const eventFlow = scriptSource.slice(eventStart, eventEnd);
    assert.ok(eventFlow.indexOf('uploadTeamLogo(team.logoBase64') < eventFlow.indexOf('allocateSlotsFromDB('));

    assert.match(scriptSource, /Somente o capitão pode atualizar a logo do time/);
    assert.match(scriptSource, /logoOriginalUrl: preparedLogo\.originalUrl/);
    assert.match(eventPageSource, /equipeLogoOriginalInput/);
    assert.match(eventPageSource, /Somente o capitão pode atualizar a logo do time/);
    assert.match(eventPageSource, /logoOriginalUrl: preparedLogo\.originalUrl/);
    assert.match(eventPageSource, /profile-photos\/\$\{userId\}\/team-logos\/profiles/);
    assert.match(indexSource, /equipeLogoOriginalInput/);
});
