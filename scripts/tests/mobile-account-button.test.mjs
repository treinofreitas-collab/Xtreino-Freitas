import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../../artifacts/xtreino/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../../artifacts/xtreino/public/script.js', import.meta.url), 'utf8');

test('mobile header includes a labeled shortcut to Minha Conta', () => {
    assert.match(
        indexHtml,
        /<button id="accountBtnMobile" onclick="window\.location\.href='client\.html'"[^>]*>[\s\S]*?MINHA CONTA/
    );
});

test('mobile Minha Conta button follows the signed-in state', () => {
    const nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) {
            const classes = new Set();
            nodes.set(id, {
                classes,
                classList: {
                    add: value => classes.add(value),
                    remove: value => classes.delete(value),
                    toggle: (value, force) => {
                        if (force === undefined ? !classes.has(value) : force) classes.add(value);
                        else classes.delete(value);
                    },
                },
            });
        }
        return nodes.get(id);
    };

    const start = script.indexOf('function toggleAccountButtons(isLogged)');
    const end = script.indexOf('// Garantir estado inicial correto dos botões ao carregar a página', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const context = vm.createContext({
        document: { getElementById: node },
        updateHeaderTokenBadges() {},
    });
    vm.runInContext(script.slice(start, end), context);

    context.toggleAccountButtons(true);
    assert.ok(!node('accountBtnMobile').classes.has('hidden'));
    assert.ok(node('loginBtnMobile').classes.has('hidden'));
    assert.ok(!node('profileAvatarMobile').classes.has('hidden'));

    context.toggleAccountButtons(false);
    assert.ok(node('accountBtnMobile').classes.has('hidden'));
    assert.ok(!node('loginBtnMobile').classes.has('hidden'));
    assert.ok(node('profileAvatarMobile').classes.has('hidden'));
});
