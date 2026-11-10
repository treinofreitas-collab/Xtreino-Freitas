import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../../artifacts/xtreino/public/script.js', import.meta.url),
    'utf8',
);
const start = source.indexOf('function normalizeEventType(t)');
const end = source.indexOf('\nfunction bookingLockHourValue(record)', start);
assert.ok(start >= 0 && end > start, 'schedule lock helpers should be present');
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);

test('Solo legacy lock names match only the Solo event and its document ID', () => {
    const config = {
        urlSlug: 'solo',
        eventType: '',
        name: 'DIÁRIO SOLO FREITAS',
        label: 'DIÁRIO SOLO FREITAS',
    };
    const lockTypes = context.bookingLockEventTypes('solo-event-id', config);
    const matches = context.bookingLockAppliesToEvent;

    assert.equal(lockTypes.includes('DIÁRIO SOLO FREITAS'), true);
    assert.equal(matches({ eventType: 'DIÁRIO SOLO FREITAS' }, 'solo-event-id', config), true);
    assert.equal(matches({ event_type: 'DIÁRIO SOLO FREITAS' }, 'solo-event-id', config), true);
    assert.equal(matches({ eventType: 'solo-event-id' }, 'solo-event-id', config), true);
    assert.equal(matches({ eventType: 'another-event' }, 'solo-event-id', config), false);
    assert.equal(matches(
        { eventType: 'DIÁRIO SOLO FREITAS' },
        'another-event',
        { urlSlug: '', eventType: '', name: 'DIÁRIO SOLO FREITAS', label: 'DIÁRIO SOLO FREITAS' },
    ), false);
});

test('Solo permanent locks support legacy snake_case lock types', () => {
    const config = {
        urlSlug: 'solo',
        eventType: '',
        name: 'DIÁRIO SOLO FREITAS',
        label: 'DIÁRIO SOLO FREITAS',
    };
    assert.equal(context.matchesPermanentHourLock({
        event_type: 'DIÁRIO SOLO FREITAS',
        hour: '21h',
        locked: true,
    }, 'solo-event-id', config), true);
});
