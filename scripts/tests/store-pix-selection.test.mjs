import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import vm from 'node:vm';

const script = readFileSync(new URL('../../artifacts/xtreino/public/script.js', import.meta.url), 'utf8');
const helpersStart = script.indexOf('const STORE_PIX_PENDING_KEY');
const helpersEnd = script.indexOf('function showStorePixPanel', helpersStart);
const helpers = script.slice(helpersStart, helpersEnd);

function makeStorageContext(storage = new Map(), document = { getElementById: () => null }, cleared = []) {
    const context = vm.createContext({
        window: {
            firebaseAuth: { currentUser: { uid: 'buyer-1' } },
            crypto: webcrypto,
        },
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
        document,
        clearInterval: id => cleared.push(id),
        TextEncoder,
        Uint8Array,
    });
    vm.runInContext(`${helpers}
        globalThis.getPending = getStorePixPending;
        globalThis.getByReference = getStorePixPendingByReference;
        globalThis.savePending = saveStorePixPending;
        globalThis.clearPending = clearStorePixPending;
        globalThis.buildKey = buildStorePixSelectionKey;
        globalThis.getSnapshot = getStorePixFormSnapshot;
        globalThis.resetForSelectionChange = resetStorePixUiForSelectionChange;`, context);
    return context;
}

test('Pix selection fingerprint changes with maps, amount, options, coupon, and buyer details', async () => {
    const context = makeStorageContext();
    const keyFor = (maps, amount, customer = {}) => context.buildKey(
        'imagens-aereas',
        { maps, quantity: maps.length },
        amount,
        { code: 'MAPAS10', discountType: 'percentage', discountValue: 10 },
        { name: 'Comprador', email: 'buyer@example.com', phone: '11999990000', ...customer },
    );

    const oneMap = await keyFor(['Bermuda'], 2);
    const sameOneMap = await context.buildKey(
        'imagens-aereas',
        { quantity: 1, maps: ['Bermuda'] },
        2,
        { discountValue: 10, discountType: 'percentage', code: 'mapas10' },
        { name: 'Comprador', email: 'BUYER@example.com', phone: '+55 (11) 99999-0000' },
    );
    assert.equal(oneMap, sameOneMap);
    assert.notEqual(oneMap, await keyFor(['Bermuda', 'Purgatório', 'Kalahari'], 5));
    assert.notEqual(oneMap, await keyFor(['Purgatório'], 2));
    assert.notEqual(oneMap, await keyFor(['Bermuda'], 3));
    assert.notEqual(oneMap, await keyFor(['Bermuda'], 2, { email: 'other@example.com' }));
});

test('same product can retain separate pending Pix references for different selections', () => {
    const context = makeStorageContext();
    context.savePending({
        productId: 'imagens-aereas',
        externalReference: 'digital_one_map',
        selectionKey: 'fingerprint-one-map',
        amount: 2,
    });
    context.savePending({
        productId: 'imagens-aereas',
        externalReference: 'digital_three_maps',
        selectionKey: 'fingerprint-three-maps',
        amount: 5,
    });

    assert.equal(context.getPending('imagens-aereas', 'fingerprint-one-map').externalReference, 'digital_one_map');
    assert.equal(context.getPending('imagens-aereas', 'fingerprint-three-maps').externalReference, 'digital_three_maps');
    assert.equal(context.getPending('imagens-aereas', 'fingerprint-two-maps'), null);

    context.clearPending('digital_one_map');
    assert.equal(context.getPending('imagens-aereas', 'fingerprint-one-map'), null);
    assert.equal(context.getPending('imagens-aereas', 'fingerprint-three-maps').externalReference, 'digital_three_maps');
});

test('changing product options hides the old QR and unlocks the new selection', () => {
    const controls = [
        { id: 'map-bermuda', name: 'aereasMapOption', type: 'checkbox', value: 'Bermuda', checked: true },
        { id: 'map-purgatorio', name: 'aereasMapOption', type: 'checkbox', value: 'Purgatório', checked: false },
        { id: 'map-kalahari', name: 'aereasMapOption', type: 'checkbox', value: 'Kalahari', checked: false },
    ];
    const elements = new Map();
    const makeElement = id => {
        const classes = new Set(id === 'productPixPanel' ? [''] : []);
        const element = {
            id,
            textContent: '',
            value: '',
            disabled: true,
            innerHTML: '',
            classList: {
                add: name => classes.add(name),
                remove: name => classes.delete(name),
                contains: name => classes.has(name),
            },
        };
        elements.set(id, element);
        return element;
    };
    const optionsContainer = { querySelectorAll: () => controls };
    elements.set('productOptions', optionsContainer);
    const document = {
        getElementById: id => elements.get(id) || null,
    };
    for (const id of [
        'productPixPanel', 'productPixNotice', 'productPixLoading', 'productPixContent',
        'productPixConfirmed', 'productPixBtn', 'schedPayTokens', 'schedSubmit',
        'schedPrice', 'totalPrice', 'mapsPrice',
    ]) makeElement(id);

    const cleared = [];
    const context = makeStorageContext(new Map(), document, cleared);
    context.window._activeStoreProduct = { productId: 'imagens-aereas' };
    context.window._storePixPayment = { externalReference: 'digital_one_map' };
    context.window._storePixFormSnapshot = context.getSnapshot('imagens-aereas');
    vm.runInContext('_storePixPollInterval = 10; _storePixCountdownInterval = 11;', context);

    controls[1].checked = true;
    controls[2].checked = true;
    assert.equal(context.resetForSelectionChange('imagens-aereas'), true);
    assert.deepEqual(cleared, [10, 11]);
    assert.equal(context.window._storePixPayment, null);
    assert.equal(context.window._storePixFormSnapshot, null);
    assert.equal(elements.get('productPixPanel').classList.contains('hidden'), true);
    assert.equal(elements.get('productPixBtn').disabled, false);
    assert.equal(elements.get('schedPayTokens').disabled, false);
});
