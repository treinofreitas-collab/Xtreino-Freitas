import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the real classic-script renderer without bootstrapping Firebase or charging anything.
const source = readFileSync(new URL('../../artifacts/xtreino/public/script.js', import.meta.url), 'utf8');
const start = source.indexOf('function showSlotConfirmationModal(');
const end = source.indexOf('function normalizeHour(', start);
const renderer = source.slice(start, end);

function render(slots, liga = false, event = 'xtreino-tokens') {
    let modal;
    const context = {
        playNotificationSound: () => {},
        _eventoUrl: id => `/evento.html?id=${id}`,
        document: {
            getElementById: () => null,
            createElement: () => ({ innerHTML: '' }),
            body: { appendChild: element => { modal = element; } },
        },
    };
    vm.createContext(context);
    new vm.Script(renderer).runInContext(context);
    context.showSlotConfirmationModal(slots, 'Evento teste', liga, event, null);
    return modal.innerHTML;
}

test('league confirmation handles the current team field and teamName variant without undefined', () => {
    const html = render([{ team: 'Equipe atual', schedule: '19h' }, { teamName: 'Equipe teste', schedule: '20h' }], true, 'modo-liga');
    assert.ok(html.includes('Equipe atual'));
    assert.ok(html.includes('Equipe teste'));
    assert.ok(!html.includes('undefined'));
    assert.ok(html.includes('19h') && html.includes('20h'));
    assert.ok(html.includes('Vaga confirmada'));
});

test('regular and letter-based confirmation keep original slot numbers and support slotNumber', () => {
    const slots = [{ team: 'Equipe atual', slot: 'Slot 3', schedule: '19h' }, { teamName: 'Equipe teste', slotNumber: 4, schedule: '20h' }];
    assert.ok(render(slots).includes('>4</span>'));
    assert.ok(render(slots, false, 'modo-liga').includes('SUA LETRA É D'));
});

test('team names are escaped; missing names have a readable fallback', () => {
    const html = render([{ teamName: '<img src=x onerror=alert(1)>', schedule: '19h' }, { schedule: '20h' }], true);
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('Seu time'));
});
