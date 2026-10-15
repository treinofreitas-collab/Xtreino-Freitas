import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../artifacts/xtreino/public/admin.js', import.meta.url), 'utf8');

function mockElement(initiallyHidden = false) {
    const classes = new Set(initiallyHidden ? ['hidden'] : []);
    return {
        style: {},
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name),
        },
        closest: () => null,
    };
}

function visibilityHarness() {
    const elements = new Map();
    const document = {
        documentElement: mockElement(),
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, mockElement(id === 'sectionAffiliatePanel'));
            return elements.get(id);
        },
        querySelectorAll: () => [],
    };
    const context = vm.createContext({ document, window: {}, console: { error() {}, log() {} } });
    const start = source.indexOf('// ===== MATRIZ DE PERMISSÕES POR CARGO =====');
    const end = source.indexOf('// ===== SEÇÕES EDITÁVEIS POR CARGO =====', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    vm.runInContext(source.slice(start, end), context);
    return { context, document };
}

test('a seção do afiliado não está liberada para cargos administrativos', () => {
    const { context } = visibilityHarness();
    for (const role of ['ceo', 'socio', 'gerente', 'vendedor', 'operador', 'admin']) {
        assert.ok(!context.window.ROLE_SECTIONS[role]?.includes('sectionAffiliatePanel'), `${role} não deve listar o painel`);
    }
});

test('somente o cargo afiliado vê o painel e continua sem as demais seções', () => {
    const { context, document } = visibilityHarness();
    context.controlSectionVisibility('ceo');
    assert.equal(document.getElementById('sectionAffiliatePanel').style.display, 'none');

    context.controlSectionVisibility('afiliado');
    assert.equal(document.getElementById('sectionAffiliatePanel').style.display, 'block');
    assert.equal(document.getElementById('sectionAffiliatePanel').classList.contains('hidden'), false);
    assert.equal(document.getElementById('sectionOrders').style.display, 'none');
});
