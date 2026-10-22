import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../artifacts/xtreino/public/evento.html', import.meta.url), 'utf8');

test('event details no longer contain the attendee tab, its startup checks or historical scans', () => {
    for (const removed of ['panelInscritos', 'inscritosContent', 'tabBtn_inscritos',
        'checkAndUnlockInscritosTab', 'loadInscritos', '_insScheduleData', '_insSelectSlot']) {
        assert.ok(!source.includes(removed), removed);
    }
    assert.ok(!/getDocs\(collection\(_db,\s*'teams'\)\)/.test(source));
    // An event-wide prior registration must not replace the CTA or block another slot purchase.
    assert.ok(!source.includes('checkUserRegistration'));
    assert.ok(!source.includes('hideCtaRegistered'));
    assert.ok(!source.includes("collection(_db, 'registrations')"));
    assert.ok(source.includes("onSnapshot(doc(db,'teams',teamId)")); // Team-management subscription is unrelated.
});

test('existing participants keep both event registration buttons available', () => {
    const buttonArea = source.slice(source.indexOf('<!-- Header -->'), source.indexOf('<!-- Loading -->'));
    const floatingArea = source.slice(source.indexOf('<!-- Floating CTA -->'), source.indexOf('<script type="module">'));
    assert.match(buttonArea, /<button onclick="goRegister\(\)" id="headerRegBtn"/);
    assert.match(buttonArea, /INSCREVER/);
    assert.match(floatingArea, /onclick="goRegister\(\)"/);
    assert.match(floatingArea, /FAZER INSCRIÇÃO/);

    const nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) {
            const classes = new Set(['hidden']);
            nodes.set(id, { classes, classList: {
                add: value => classes.add(value), remove: value => classes.delete(value),
            } });
        }
        return nodes.get(id);
    };
    const context = vm.createContext({ document: { getElementById: node } });
    const showContent = source.slice(source.indexOf('function showContent()'), source.indexOf('function setTab('));
    vm.runInContext(showContent, context);
    context.showContent();
    assert.ok(!node('floatingCta').classes.has('hidden'));
    assert.ok(!node('headerRegBtn').classes.has('hidden'));
});

test('remaining tabs still render and switch locally without Firestore calls', () => {
    const nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) {
            const classes = new Set();
            nodes.set(id, { innerHTML: '', classes, classList: {
                add: value => classes.add(value), remove: value => classes.delete(value),
            } });
        }
        return nodes.get(id);
    };
    const context = vm.createContext({
        window: {},
        document: { getElementById: node, querySelectorAll: () => [...nodes.values()] },
        getDocs() { throw new Error('Switching event tabs must not query Firestore'); },
    });
    vm.runInContext(source.slice(source.indexOf('function setTab('), source.indexOf('function buildInfoGrid(')), context);
    context.buildTabs({ regras: 'Regras', rodadas: 'Rodadas', pontuacao: 'Pontos', youtubeUrl: 'https://example.invalid', category: 'camp' });
    const navigation = node('tabNav').innerHTML;
    for (const tab of ['info', 'regras', 'rodadas', 'pontuacao', 'live', 'grupos']) {
        assert.ok(navigation.includes(`id="tabBtn_${tab}"`));
    }
    assert.ok(node('panelInfo').classes.has('active'));
    context.setTab('regras');
    assert.ok(node('panelRegras').classes.has('active'));
    assert.ok(!node('panelInfo').classes.has('active'));
});

test('registration button still opens the correct event booking flow', () => {
    const start = source.indexOf('window.goRegister = function()');
    const end = source.indexOf('\nloadEvent();', start);
    const window = { location: {}, _currentEventId: 'legacy-id' };
    const context = vm.createContext({ window, _resolvedEventType: 'modo-liga', encodeURIComponent });
    vm.runInContext(source.slice(start, end), context);
    window.goRegister();
    assert.equal(window.location.href, 'index.html?openEvent=legacy-id#eventos');
    window._currentEventId = null;
    context._resolvedEventType = 'modo-liga';
    window.goRegister();
    assert.equal(window.location.href, 'index.html?openEvent=modo-liga#eventos');
});
