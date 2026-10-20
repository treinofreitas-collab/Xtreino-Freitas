import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../artifacts/xtreino/public/admin.js', import.meta.url), 'utf8');
const start = source.indexOf('function bindBoardTableActions(');
const end = source.indexOf('\n  async function handleToggleFree', start);
const bindingFunction = source.slice(start, end);

test('fixed unlock forwards the selected event type to the permanent-lock handler', async () => {
    assert.match(
        source,
        /bindBoardTableActions\(tbody, date, eventType, ovEventType, rawEventId, evFieldType, rawEvType\)/
    );

    const calls = [];
    const context = {
        console,
        handleTogglePermanentLock: async (...args) => { calls.push(args); },
    };
    vm.createContext(context);
    new vm.Script(bindingFunction).runInContext(context);

    let clickHandler;
    const replacementTbody = {
        addEventListener: (eventName, handler) => {
            assert.equal(eventName, 'click');
            clickHandler = handler;
        },
    };
    const tbody = {
        parentNode: { replaceChild: (replacement, original) => {
            assert.equal(replacement, replacementTbody);
            assert.equal(original, tbody);
        } },
        cloneNode: () => replacementTbody,
    };

    context.bindBoardTableActions(
        tbody,
        '2026-10-21',
        'selected-event',
        'canonical-event',
        'raw-event-id',
        'event-field-type',
        'raw-event-type'
    );

    const button = {
        getAttribute: name => name === 'data-toggle-perm-lock' ? '00:00' : null,
        closest: selector => selector === '[data-toggle-perm-lock]' ? button : null,
    };
    await clickHandler({ target: button });

    assert.deepEqual(calls, [['00:00', 'canonical-event', 'raw-event-type', 'raw-event-id']]);
});
