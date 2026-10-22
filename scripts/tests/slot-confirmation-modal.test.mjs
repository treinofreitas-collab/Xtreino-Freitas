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

test('all event modes keep team/hour but omit slot numbers, letters and the event-page button', () => {
    const slots = [{ team: 'Equipe atual', slot: 'Slot 3', schedule: '19h' }, { teamName: 'Equipe teste', slotNumber: 4, schedule: '20h' }];
    for (const html of [render(slots), render(slots, false, 'modo-liga'), render(slots, true, 'modo-liga')]) {
        assert.ok(html.includes('Equipe atual') && html.includes('Equipe teste'));
        assert.ok(html.includes('19h') && html.includes('20h'));
        assert.ok(!html.includes('SLOT') && !html.includes('SUA LETRA'));
        assert.ok(!html.includes('VER PÁGINA DO EVENTO'));
        assert.ok(!html.includes('sininho') && !html.includes('5 minutos'));
        assert.ok(html.includes('💡 Você receberá a lista de Slots junto com o ID E SENHA no GRUPO!'));
        assert.ok(html.includes('justify-center gap-1 text-center'));
    }
});

test('confirmed reservation access uses the group ID and password button label', () => {
    assert.match(
        source,
        /mountReferenceAccess\(target, accessReference, \{\s*linkLabel: 'ACESSAR GRUPO DE ID E SENHA',\s*\}\)/
    );
});

test('team names are escaped; missing names have a readable fallback', () => {
    const html = render([{ teamName: '<img src=x onerror=alert(1)>', schedule: '19h' }, { schedule: '20h' }], true);
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('Seu time'));
});
