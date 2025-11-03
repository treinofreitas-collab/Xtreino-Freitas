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
    // Variáveis auxiliares para enriquecer resposta listOnly
    let platformUsed = null;
    let brandUsed = null;

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
      const mapToDriveLink = (m) => {
        const slug = (m || '').toString().toLowerCase();
        if (slug.includes('bermuda')) return 'https://drive.google.com/drive/folders/19N5hSofqFVCGDiHEU_wKmtVmHW1a1UfJ?usp=drive_link';
        if (slug.includes('kalahari')) return 'https://drive.google.com/drive/folders/16UUsxWUhWxmHfL-2X46wc4yfmo_A_f-u?usp=drive_link';
        if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'https://drive.google.com/drive/folders/15btlRqv-5LvdMHTyG6HQERbUdWRwWtOS?usp=drive_link';
        if (slug.includes('purg')) return 'https://drive.google.com/drive/folders/1yDGP-7iCCBa4S63mik-MFVOGOebCogdB?usp=drive_link';
        if (slug.includes('nova')) return 'https://drive.google.com/drive/folders/1sug4ryRTA5TpnKyS2hh8MgZqrNiOL1rE?usp=drive_link';
        return null;
      };
      if ((productId || '').toString().toLowerCase().includes('imagem') || productId === 'imagens') {
        const maps = productOptions.maps || ['Bermuda'];
        links = maps.map(map => ({ name: `Imagens Aéreas - ${map}`, url: mapToDriveLink(map) })).filter(l => !!l.url);
      } else if ((productId || '').toString().toLowerCase().includes('planilha') || productId === 'planilhas') {
        const file = 'assets/downloads/CONTROLE DE LINES PARA COACH E ANALISTA .xlsx';
        links = [{ name: 'Planilhas de Análise', url: `${siteBase}/${encodeURIComponent(file)}` }];
      } else if ((productId || '').toString().toLowerCase().includes('sensibil') || productId === 'sensibilidades') {
        // Fallback para Sensibilidades baseado nas opções do pedido
        const platform = (productOptions.platform || 'pc').toString().toLowerCase();
        const brand = (productOptions.brand || '').toString().toLowerCase();
        platformUsed = platform;
        brandUsed = brand || null;
        const pickAndroid = (b) => {
          const allowed = ['samsung','motorola','lg','xiaomi'];
          const chosen = allowed.includes(b) ? b : 'samsung';
          return `${siteBase}/assets/downloads/sensibilidade-android-${chosen}.zip`;
        };
        if (platform === 'ios') {
          // Três links do iOS (Drive)
          links = [
            { name: 'iOS • Vídeo: Ajustes na configuração do celular', url: 'https://drive.google.com/file/d/1J1mqs20SRfT6xm4spXliaozQ4EFDJNy0/view?usp=drivesdk' },
            { name: 'iOS • Pasta: Regulagem da sensibilidade no jogo', url: 'https://drive.google.com/drive/folders/1mR6fOTsh9CCpOe0tfo-a3JfgEObDN-5m' },
            { name: 'iOS • Vídeo: Saiba sobre o cursor secreto', url: 'https://drive.google.com/file/d/1WcoZ41kvmCUmhWrADK_5msh2pQodRP92/view?usp=drivesdk' }
          ];
        } else {
          let url = `${siteBase}/assets/downloads/sensibilidade-pc.zip`;
          if (platform === 'android') url = pickAndroid(brand);
          links = [{ name: 'Sensibilidade', url }];
        }
      } else {
        return { statusCode: 404, headers, body: 'Digital delivery not found' };
      }
    } else {
      const delivery = snapshot.docs[0].data();
      links = Array.isArray(delivery.downloadLinks) ? delivery.downloadLinks : [];
      
      // Incluir plataforma e marca nos dados retornados para sensibilidades
      if (delivery.productId === 'sensibilidades' && delivery.productOptions?.platform) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: links.map((link, index) => ({
              ...link,
              index: index,
              platform: delivery.productOptions.platform,
              brand: delivery.productOptions.brand || null
            })),
            platform: delivery.productOptions.platform,
            brand: delivery.productOptions.brand || null
          })
        };
      }
      // Verificar se há mapas faltando comparando com o pedido original
      try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        const order = orderDoc.exists ? orderDoc.data() : {};
        const productId = order.productId || order.item || order.title || '';
        if ((productId || '').toString().toLowerCase().includes('imagem') || productId === 'imagens') {
          const maps = (order.productOptions?.maps || []).map(m => (m||'').toString().toLowerCase());
          const have = new Set((links || []).map(l => (l.name||'').toString().toLowerCase()));
          const mapToDriveLink = (m) => {
            const slug = (m || '').toString().toLowerCase();
            if (slug.includes('bermuda')) return 'https://drive.google.com/drive/folders/19N5hSofqFVCGDiHEU_wKmtVmHW1a1UfJ?usp=drive_link';
            if (slug.includes('kalahari')) return 'https://drive.google.com/drive/folders/16UUsxWUhWxmHfL-2X46wc4yfmo_A_f-u?usp=drive_link';
            if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'https://drive.google.com/drive/folders/15btlRqv-5LvdMHTyG6HQERbUdWRwWtOS?usp=drive_link';
            if (slug.includes('purg')) return 'https://drive.google.com/drive/folders/1yDGP-7iCCBa4S63mik-MFVOGOebCogdB?usp=drive_link';
            if (slug.includes('nova')) return 'https://drive.google.com/drive/folders/1sug4ryRTA5TpnKyS2hh8MgZqrNiOL1rE?usp=drive_link';
            return null;
          };
          maps.forEach(m => {
            const display = `imagens aéreas - ${m}`.toLowerCase();
            if (!have.has(display)) {
              const url = mapToDriveLink(m);
              if (url) links.push({ name: `Imagens Aéreas - ${m}`, url });
            }
          });
        }
      } catch(_) {}
    }

    if (listOnly) {
      // Retornar lista de arquivos disponíveis (sem expor URLs reais)
      const list = links.map((l, idx) => ({ index: idx, name: l.name || `file-${idx+1}` }));
      const body = { files: list };
      if (platformUsed) {
        body.platform = platformUsed;
        if (brandUsed) body.brand = brandUsed;
      }
      return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
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


