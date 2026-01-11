// Simple test runner for Netlify functions (local, mocked)
const path = require('path');

async function run() {
  const cp = process.cwd();
  process.chdir(path.resolve(__dirname, '..'));

  console.log('\n=== Test A: create-preference without MP_ACCESS_TOKEN (expect 500 Missing MP_ACCESS_TOKEN) ===');
  delete process.env.MP_ACCESS_TOKEN;
  const createPref = require('../netlify/functions/create-preference.js').handler;
  const eventA = { httpMethod: 'POST', body: JSON.stringify({ title: 'Teste', unit_price: 1.00 }) };
  const resA = await createPref(eventA);
  console.log('Status:', resA.statusCode);
  console.log('Body:', resA.body);

  console.log('\n=== Test B: create-preference with MP_ACCESS_TOKEN and mocked fetch (expect 200 with init_point) ===');
  process.env.MP_ACCESS_TOKEN = 'fake-token-for-tests';
  // mock global fetch
  global.fetch = async (url, opts) => {
    return {
      ok: true,
      json: async () => ({ id: 'pref_test_123', init_point: 'https://mp.test/checkout', sandbox_init_point: null }),
      text: async () => JSON.stringify({ id: 'pref_test_123', init_point: 'https://mp.test/checkout', sandbox_init_point: null })
    };
  };
  const eventB = { httpMethod: 'POST', body: JSON.stringify({ title: 'Teste', unit_price: 2.5 }) };
  const resB = await createPref(eventB);
  console.log('Status:', resB.statusCode);
  try { console.log('Body:', JSON.parse(resB.body)); } catch(e){ console.log('Body:', resB.body); }

  console.log('\n=== Test C: payment-notification with non-payment type (expect 200 received true) ===');
  const paymentNotif = require('../netlify/functions/payment-notification.js').handler;
  const eventC = { httpMethod: 'POST', body: JSON.stringify({ type: 'test_event', data: { id: 1 } }) };
  const resC = await paymentNotif(eventC);
  console.log('Status:', resC.statusCode);
  try { console.log('Body:', JSON.parse(resC.body)); } catch(e){ console.log('Body:', resC.body); }

  process.chdir(cp);
}

run().catch(err => { console.error('Test runner error:', err); process.exitCode = 1; });
