import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const adminScript = readFileSync(new URL('../../artifacts/xtreino/public/admin.js', import.meta.url), 'utf8');
const helperStart = adminScript.indexOf('function formatStandardSlotExport');
const helperEnd = adminScript.indexOf('// ===== Exportação de lista por horário =====', helperStart);

assert.notEqual(helperStart, -1, 'formatter exists');
assert.notEqual(helperEnd, -1, 'formatter boundary exists');

const context = vm.createContext({});
vm.runInContext(adminScript.slice(helperStart, helperEnd), context);

test('standard slot export uses compact spacing and the requested template', () => {
  const slots = Array.from({ length: 12 }, (_, index) => ({
    idx: index + 1,
    team: index === 0 ? 'VRX Haze' : index === 1 ? 'CRIAS DO DB' : '',
  }));

  const output = context.formatStandardSlotExport('14', slots);
  const lines = output.split('\n');

  assert.equal(lines[0], 'ㅤ:::  𝑿𝑻𝑹𝑬𝑰𝑵𝑶 𝑭𝑹𝑬𝑰𝑻𝑨𝑺 » 14H :::');
  assert.equal(lines[2], '➺🆔 𝑬 𝑺𝑬𝑵𝑯𝑨 𝟏𝟎 𝑴𝑰𝑵𝑼𝑻𝑶𝑺 𝑨𝑵𝑻𝑬𝑺');
  assert.equal(lines[3], '➺🏷️𝑹𝑬𝑮𝑹𝑨𝑺 𝑵𝑨 𝑫𝑬𝑺𝑪𝑹𝑰𝑪̧𝑨̃𝑶!');
  assert.equal(lines[5], '   ⃟🩵 𝑺𝑳𝑶𝑻 𝟎𝟏: VRX Haze');
  assert.equal(lines[6], '   ⃟🩵 𝑺𝑳𝑶𝑻 𝟎𝟐: CRIAS DO DB');
  assert.equal(lines[7], '   ⃟🩵 𝑺𝑳𝑶𝑻 𝟎𝟑: ');
  assert.equal(lines[16], '   ⃟🩵 𝑺𝑳𝑶𝑻 𝟏𝟐: ');
  assert.equal(lines[18], '「🧑🏻‍🏫」𝑪𝑶𝑨𝑪𝑯: ');
  assert.equal(lines[20], '⎾‣⏌FREITAS TV | @Xtreino_freitas');

  assert.ok(lines.slice(5, 17).every(Boolean), 'slot rows have no blank lines between them');
});
