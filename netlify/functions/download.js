// Netlify Function: Proxy seguro para downloads de produtos
const admin = require('firebase-admin');

// Inicialização do Firebase Admin com diferentes fontes de credencial
try {
  if (!admin.apps.length) {
    const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
    } else if (svc) {
      const parsed = JSON.parse(svc);
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Se estiver usando ADC (Application Default Credentials)
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID, credential: admin.credential.applicationDefault() });
    } else {
      // Último recurso: tentar inicializar sem credencial (pode falhar localmente)
      admin.initializeApp();
    }
  }
} catch (_) {}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const db = admin.firestore();
    const params = event.queryStringParameters || {};
    const orderId = params.orderId || '';
    const indexStr = params.i;
    const listOnly = params.list === '1';

    if (!orderId) {
      return { statusCode: 400, headers, body: 'Missing orderId' };
    }

    // Buscar entrega digital pelo orderId
    const snapshot = await db
      .collection('digital_deliveries')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    let links = [];
    if (snapshot.empty) {
      // Fallback: gerar links a partir do pedido direto (orders/{orderId})
      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        return { statusCode: 404, headers, body: 'Digital delivery not found' };
      }
      const order = orderDoc.data();
      // Bloquear download antes da aprovação do pagamento
      const status = (order.status || order.paymentStatus || '').toString().toLowerCase();
      const paid = status.includes('paid') || status.includes('approved') || status.includes('confirmed');
      if (!paid) {
        return { statusCode: 402, headers, body: 'Payment required' };
      }
      const productId = order.productId || order.item || order.title || '';
      const productOptions = order.productOptions || {};
      const siteBase = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
      const mapToFilename = (m) => {
        const slug = (m || '').toString().toLowerCase().replace(/\s+/g,'-');
        if (slug.includes('bermuda')) return 'assets/downloads/BERMUDA.zip';
        if (slug.includes('kalahari')) return 'assets/downloads/KALAHARI.zip';
        if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'assets/downloads/ALPINE.zip';
        if (slug.includes('purg')) return 'assets/downloads/PURGATORIO.zip';
        if (slug.includes('nova')) return 'assets/downloads/NOVATERRA.zip';
        return `imagens-${slug}.zip`;
      };
      if ((productId || '').toString().includes('imagem') || productId === 'imagens') {
        const maps = productOptions.maps || ['Bermuda'];
        links = maps.map(map => ({ name: `Imagens Aéreas - ${map}`, url: `${siteBase}/${mapToFilename(map)}` }));
      } else if ((productId || '').toString().includes('planilha') || productId === 'planilhas') {
        const file = 'CONTROLE DE LINES PARA COACH E ANALISTA .xlsx';
        links = [{ name: 'Planilhas de Análise', url: `${siteBase}/${encodeURIComponent(file)}` }];
      } else {
        return { statusCode: 404, headers, body: 'Digital delivery not found' };
      }
    } else {
      const delivery = snapshot.docs[0].data();
      links = Array.isArray(delivery.downloadLinks) ? delivery.downloadLinks : [];
      
      // Incluir plataforma nos dados retornados para sensibilidades
      if (delivery.productId === 'sensibilidades' && delivery.productOptions?.platform) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: links.map((link, index) => ({
              ...link,
              index: index,
              platform: delivery.productOptions.platform
            })),
            platform: delivery.productOptions.platform
          })
        };
      }
      // Verificar se há mapas faltando comparando com o pedido original
      try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        const order = orderDoc.exists ? orderDoc.data() : {};
        const productId = order.productId || order.item || order.title || '';
        if ((productId || '').toString().includes('imagem') || productId === 'imagens') {
          const maps = (order.productOptions?.maps || []).map(m => (m||'').toString().toLowerCase());
          const have = new Set((links || []).map(l => (l.name||'').toString().toLowerCase()));
          const siteBase = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
          const mapToFilename = (m) => {
            const slug = (m || '').toString().toLowerCase().replace(/\s+/g,'-');
            if (slug.includes('bermuda')) return 'assets/downloads/BERMUDA.zip';
            if (slug.includes('kalahari')) return 'assets/downloads/KALAHARI.zip';
            if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'assets/downloads/ALPINE.zip';
            if (slug.includes('purg')) return 'assets/downloads/PURGATORIO.zip';
            if (slug.includes('nova')) return 'assets/downloads/NOVATERRA.zip';
            return `imagens-${slug}.zip`;
          };
          maps.forEach(m => {
            const display = `imagens aéreas - ${m}`.toLowerCase();
            if (!have.has(display)) {
              links.push({ name: `Imagens Aéreas - ${m}`, url: `${siteBase}/${mapToFilename(m)}` });
            }
          });
        }
      } catch(_) {}
    }

    if (listOnly) {
      // Retornar lista de arquivos disponíveis (sem expor URLs reais)
      const list = links.map((l, idx) => ({ index: idx, name: l.name || `file-${idx+1}` }));
      return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ files: list }) };
    }

    const idx = indexStr ? parseInt(indexStr, 10) : 0;
    if (Number.isNaN(idx) || idx < 0 || idx >= links.length) {
      return { statusCode: 400, headers, body: 'Invalid index' };
    }

    const file = links[idx];
    let url = file.url;
    // Tornar relativo ao site, se necessário
    if (url && url.startsWith('/')) {
      const siteBase = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
      url = `${siteBase}${url}`;
    }
    if (!url) {
      return { statusCode: 500, headers, body: 'Missing file URL' };
    }

    // Buscar o arquivo na origem e repassar o conteúdo
    // Em vez de fazer proxy do conteúdo (limite 6MB em lambdas), fazemos redirect
    // para a URL final. Como os arquivos são .zip/.xlsx, o navegador baixa direto.
    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Cache-Control': 'no-store',
        Location: url
      },
      body: ''
    };
  } catch (err) {
    return { statusCode: 500, headers, body: `Error: ${err.message}` };
  }
};


