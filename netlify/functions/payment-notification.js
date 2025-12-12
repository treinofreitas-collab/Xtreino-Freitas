// Netlify Function: Receber notificações de pagamento do Mercado Pago
const admin = require('firebase-admin');

// Inicialização Admin com múltiplas formas de credencial (evita variável gigante)
try {
  if (!admin.apps.length) {
    const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    } else if (svc) {
      const parsed = JSON.parse(svc);
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID, credential: admin.credential.applicationDefault() });
    } else {
      admin.initializeApp();
    }
  }
} catch (_) {}

const CAMP_SEMIFINAL_DATES = ['2024-11-22','2024-11-23','2025-11-22','2025-11-23'];

async function getCampSemifinalLinkByDate(date) {
    if (!date || !CAMP_SEMIFINAL_DATES.includes(date)) return null;
    try {
        const db = admin.firestore();
        const snap = await db.collection('camp_semifinal_links').doc(date).get();
        if (snap.exists) {
            const data = snap.data() || {};
            return data.link || data.url || null;
        }
    } catch (error) {
        console.error('Erro ao buscar link da semifinal do Camp:', error);
    }
    return null;
}

// Creditar tokens de forma atômica (increment + marca de controle)
async function creditTokensToUser(db, orderData, tokensToAdd, externalRef) {
    if (!orderData) {
        console.log('❌ creditTokensToUser: orderData is null/undefined');
        return;
    }
    const usersRef = db.collection('users');
    const userId = orderData.userId || orderData.uid || null;
    const customerEmail = orderData.customer || orderData.buyerEmail || orderData.email || null;
    console.log('📝 creditTokensToUser called:', { userId, customerEmail, tokensToAdd, externalRef });

    try {
        if (userId) {
            const userDocRef = usersRef.doc(userId);
            await db.runTransaction(async (tx) => {
                const userSnap = await tx.get(userDocRef);
                if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

                const udata = userSnap.data() || {};
                // Evitar crédito duplicado: checar marca em orders (orderData.id) ou em user
                // Usar campo de controle no order: tokensCredited
                const orderRef = db.collection('orders').doc(orderData.id || externalRef);
                const orderSnap = await tx.get(orderRef);
                if (orderSnap.exists) {
                    const od = orderSnap.data() || {};
                    if (od.tokensCredited) {
                        console.log('Tokens já creditados para order', orderRef.id);
                        return;
                    }
                }

                const newTokens = (udata.tokens || 0) + Number(tokensToAdd || 0);
                tx.update(userDocRef, { tokens: newTokens });
                if (orderSnap.exists) tx.update(orderRef, { tokensCredited: true });
            });
            console.log('✅ Tokens credited via userId:', userId, 'amount:', tokensToAdd);
            return;
        }

        if (customerEmail) {
            // Buscar usuário por email e creditar atomically
            const q = await usersRef.where('email', '==', customerEmail).limit(1).get();
            if (q.empty) {
                console.log('No user found by email to credit tokens:', customerEmail);
                return;
            }
            const userDoc = q.docs[0];
            const userDocRef = userDoc.ref;
            await db.runTransaction(async (tx) => {
                const userSnap = await tx.get(userDocRef);
                const udata = userSnap.data() || {};
                const orderRef = db.collection('orders').doc(orderData.id || externalRef);
                const orderSnap = await tx.get(orderRef);
                if (orderSnap.exists) {
                    const od = orderSnap.data() || {};
                    if (od.tokensCredited) {
                        console.log('Tokens já creditados para order', orderRef.id);
                        return;
                    }
                }

                const newTokens = (udata.tokens || 0) + Number(tokensToAdd || 0);
                tx.update(userDocRef, { tokens: newTokens });
                if (orderSnap.exists) tx.update(orderRef, { tokensCredited: true });
            });
            console.log('✅ Tokens credited via email:', customerEmail, 'amount:', tokensToAdd);
            return;
        }

        console.log('No identifier to credit tokens (userId/email)');
    } catch (err) {
        console.error('Error crediting tokens:', err);
    }
}

// Função para obter link do WhatsApp do Firestore
async function getWhatsAppLinkForRegistration(eventType, schedule, date = null) {
    try {
        const db = admin.firestore();
        const whatsappLinksRef = db.collection('whatsapp_links');

        // Normalizar tipo de evento
        const normalizeType = (t) => String(t || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace('xtreino-gratuito', 'xtreino-gratuito')
            .replace('xtreino-tokens', 'xtreino-tokens')
            .replace('modo liga', 'modo-liga')
            .replace('camp', 'camp-freitas');

        // Normalizar horário
        const normalizeHour = (h) => {
            if (!h) return null;
            const s = String(h).toLowerCase().trim();
            const m = s.match(/(\d{1,2})/);
            return m ? `${parseInt(m[1], 10)}h` : null;
        };

        const type = normalizeType(eventType);
        const hour = normalizeHour(schedule);
        const normalizedDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : null;

        console.log('🔎 getWhatsAppLinkForRegistration:', { type, hour, normalizedDate });

        // Prioridade: link específico para semifinal do camp
        if (type === 'camp-freitas' && normalizedDate && CAMP_SEMIFINAL_DATES.includes(normalizedDate)) {
            const semifinalLink = await getCampSemifinalLinkByDate(normalizedDate);
            if (semifinalLink) {
                console.log('🔗 Found semifinal link for camp:', normalizedDate);
                return semifinalLink;
            }
            console.log('⚠️ No semifinal link found for date:', normalizedDate);
        }

        // 1) Buscar link específico para o horário (eventType + schedule)
        if (hour) {
            const specificQuery = whatsappLinksRef
                .where('eventType', '==', type)
                .where('schedule', '==', hour)
                .where('status', '==', 'active')
                .limit(1);
            const specificSnapshot = await specificQuery.get();
            console.log('specificSnapshot size for', type, hour, specificSnapshot.size || 0);
            if (!specificSnapshot.empty) {
                const link = specificSnapshot.docs[0].data().link;
                console.log('🔗 Specific schedule link found:', link);
                return link;
            }
        }

        // 2) Buscar link geral (schedule === null)
        const generalQuery = whatsappLinksRef
            .where('eventType', '==', type)
            .where('schedule', '==', null)
            .where('status', '==', 'active')
            .limit(1);
        const generalSnapshot = await generalQuery.get();
        console.log('generalSnapshot size for', type, generalSnapshot.size || 0);
        if (!generalSnapshot.empty) {
            const link = generalSnapshot.docs[0].data().link;
            console.log('🔗 General (null) schedule link found:', link);
            return link;
        }

        // 3) Buscar schedule vazio string ('') por compatibilidade
        const emptyQuery = whatsappLinksRef
            .where('eventType', '==', type)
            .where('schedule', '==', '')
            .where('status', '==', 'active')
            .limit(1);
        const emptySnapshot = await emptyQuery.get();
        console.log('emptySnapshot size for', type, emptySnapshot.size || 0);
        if (!emptySnapshot.empty) {
            const link = emptySnapshot.docs[0].data().link;
            console.log('🔗 Empty-string schedule link found:', link);
            return link;
        }

        // 4) Fallback final: qualquer link ativo para o eventType
        const anyQuery = whatsappLinksRef
            .where('eventType', '==', type)
            .where('status', '==', 'active')
            .limit(1);
        const anySnapshot = await anyQuery.get();
        console.log('anySnapshot size for', type, anySnapshot.size || 0);
        if (!anySnapshot.empty) {
            const link = anySnapshot.docs[0].data().link;
            console.log('🔗 Fallback any active link found for', type, link);
            return link;
        }

        console.log('⚠️ No whatsapp link found for', { type, hour, normalizedDate });
        return null;
    } catch (error) {
        console.error('Erro ao buscar link do WhatsApp:', error);
        return null;
    }
}

// Função para calcular e criar venda de afiliado
async function createAffiliateSale(db, orderData, saleType) {
    try {
        // Verificar se há código de afiliado no pedido
        const affiliateCode = orderData.affiliateCode || orderData.affiliate_id || null;
        if (!affiliateCode) {
            console.log('No affiliate code found in order');
            return;
        }
        
        // Buscar afiliado pelo código (assumindo que o código é o email ou ID do afiliado)
        const usersRef = db.collection('users');
        let affiliateDoc = null;
        
        // Tentar buscar por email primeiro
        const emailQuery = await usersRef.where('email', '==', affiliateCode).where('role', '==', 'Afiliado').get();
        if (!emailQuery.empty) {
            affiliateDoc = emailQuery.docs[0];
        } else {
            // Tentar buscar por ID
            const idRef = usersRef.doc(affiliateCode);
            const idDoc = await idRef.get();
            if (idDoc.exists && idDoc.data().role === 'Afiliado') {
                affiliateDoc = idDoc;
            }
        }
        
        if (!affiliateDoc || !affiliateDoc.exists) {
            console.log('Affiliate not found for code:', affiliateCode);
            return;
        }
        
        const affiliateData = affiliateDoc.data();
        const affiliateId = affiliateDoc.id;
        
        // Verificar se afiliado está ativo
        if (affiliateData.affiliateStatus !== 'active') {
            console.log('Affiliate is not active:', affiliateId);
            return;
        }
        
        // Determinar tipo de venda e comissão
        // saleType: 'event' para registrations, 'product' para orders com type='digital_product'
        const isEvent = saleType === 'event';
        const isProduct = saleType === 'product' || orderData.type === 'digital_product';
        
        // Obter taxa de comissão correta
        let commissionRate = 0;
        if (isEvent) {
            commissionRate = affiliateData.commissionRateEvents || affiliateData.commissionRate || 10;
        } else if (isProduct) {
            commissionRate = affiliateData.commissionRateProducts || affiliateData.commissionRate || 10;
        } else {
            // Fallback: usar taxa de eventos
            commissionRate = affiliateData.commissionRateEvents || affiliateData.commissionRate || 10;
        }
        
        // Calcular valor da venda e comissão
        const saleValue = Number(orderData.amount || orderData.total || orderData.price || 0);
        const commissionAmount = (saleValue * commissionRate) / 100;
        
        if (commissionAmount <= 0) {
            console.log('Commission amount is zero or negative');
            return;
        }
        
        // Criar registro de venda de afiliado
        const affiliateSaleData = {
            affiliateId: affiliateId,
            affiliateEmail: affiliateData.email,
            orderId: orderData.id || null,
            customerEmail: orderData.customer || orderData.buyerEmail || orderData.email,
            customerName: orderData.customerName || orderData.name || 'N/A',
            productId: orderData.productId || orderData.eventType || null,
            productName: orderData.title || orderData.item || orderData.productName || 'N/A',
            saleValue: saleValue,
            commissionRate: commissionRate,
            commissionAmount: commissionAmount,
            saleType: isEvent ? 'event' : 'product',
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('affiliate_sales').add(affiliateSaleData);
        console.log(`✅ Affiliate sale created: ${affiliateId}, Commission: R$ ${commissionAmount.toFixed(2)} (${commissionRate}%)`);
        
    } catch (error) {
        console.error('❌ Error creating affiliate sale:', error);
        // Não falhar o processamento do pagamento por causa de erro na comissão
    }
}

// Função para gerar links de download baseado no produto
async function generateDownloadLinks(productId, productOptions = {}) {
    try {
        // Tentar buscar informações do produto no Firestore
        const productDoc = await admin.firestore().collection('products').doc(productId).get();
        
        if (productDoc.exists) {
            const product = productDoc.data();
            
            switch (product.type) {
                case 'download':
                    if (product.downloadType === 'file' && product.downloadUrl) {
                        return [{
                            name: product.name,
                            url: product.downloadUrl,
                            description: product.description
                        }];
                    } else if (product.downloadType === 'maps') {
                        const maps = productOptions.maps || product.maps || [];
                        const mapToDriveLink = (m) => {
                            const slug = (m || '').toString().toLowerCase();
                            if (slug.includes('bermuda')) return 'https://drive.google.com/drive/folders/19N5hSofqFVCGDiHEU_wKmtVmHW1a1UfJ?usp=drive_link';
                            if (slug.includes('kalahari')) return 'https://drive.google.com/drive/folders/16UUsxWUhWxmHfL-2X46wc4yfmo_A_f-u?usp=drive_link';
                            if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'https://drive.google.com/drive/folders/15btlRqv-5LvdMHTyG6HQERbUdWRwWtOS?usp=drive_link';
                            if (slug.includes('purg')) return 'https://drive.google.com/drive/folders/1yDGP-7iCCBa4S63mik-MFVOGOebCogdB?usp=drive_link';
                            if (slug.includes('nova')) return 'https://drive.google.com/drive/folders/1sug4ryRTA5TpnKyS2hh8MgZqrNiOL1rE?usp=drive_link';
                            return null;
                        };
                        return maps.map(map => ({
                            name: `${product.name} - ${map}`,
                            url: mapToDriveLink(map),
                            description: `Imagens do mapa ${map}`
                        })).filter(it => !!it.url);
                    }
                    break;
                    
                case 'delivery':
                    return [{
                        name: product.name,
                        url: `https://wa.me/5511949830454?text=Olá! Comprei ${product.name}. Tamanho: ${productOptions.size || 'M'}`,
                        description: 'Entre em contato para confirmar o tamanho e endereço de entrega'
                    }];
                    
                case 'gift':
                    return [{
                        name: product.name,
                        url: 'https://wa.me/5511949830454?text=Olá! Comprei ' + product.name,
                        description: 'Entre em contato para receber seu produto'
                    }];
            }
        }
    } catch (error) {
        console.error('Erro ao buscar produto no Firestore:', error);
    }
    
    // Fallback para comportamento padrão
    const siteBase = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br';
    
    switch (productId) {
        case 'sensibilidades':
            const platform = productOptions.platform || 'pc';
            const brand = productOptions.brand || '';
            
            const platformFiles = {
                'pc': {
                    name: 'Sensibilidade PC',
                    url: `${siteBase}/assets/downloads/sensibilidade-pc.zip`,
                    description: 'Arquivo de configuração para PC (Windows)',
                    platform: 'pc'
                },
                'android': {
                    name: `Sensibilidade Android - ${brand.charAt(0).toUpperCase() + brand.slice(1)}`,
                    url: `${siteBase}/assets/downloads/sensibilidade-android-${brand}.zip`,
                    description: `Arquivo de configuração para Android (${brand.charAt(0).toUpperCase() + brand.slice(1)})`,
                    platform: 'android',
                    brand: brand
                },
                'ios': [
                    {
                        name: 'iOS • Vídeo: Ajustes na configuração do celular',
                        url: 'https://drive.google.com/file/d/1J1mqs20SRfT6xm4spXliaozQ4EFDJNy0/view?usp=drivesdk',
                        description: 'Passo a passo com os ajustes do sistema',
                        platform: 'ios'
                    },
                    {
                        name: 'iOS • Pasta: Regulagem da sensibilidade no jogo',
                        url: 'https://drive.google.com/drive/folders/1mR6fOTsh9CCpOe0tfo-a3JfgEObDN-5m',
                        description: 'Materiais de configuração dentro do jogo',
                        platform: 'ios'
                    },
                    {
                        name: 'iOS • Vídeo: Saiba sobre o cursor secreto',
                        url: 'https://drive.google.com/file/d/1WcoZ41kvmCUmhWrADK_5msh2pQodRP92/view?usp=drivesdk',
                        description: 'Explicação sobre o cursor secreto',
                        platform: 'ios'
                    }
                ]
            };
            
            if (platform === 'ios') {
                return platformFiles['ios'];
            }
            return [ platformFiles[platform] || platformFiles['pc'] ];
            
        case 'imagens':
            {
                const maps = productOptions.maps || [];
                const mapToDriveLink = (m) => {
                    const slug = (m || '').toString().toLowerCase();
                    if (slug.includes('bermuda')) return 'https://drive.google.com/drive/folders/19N5hSofqFVCGDiHEU_wKmtVmHW1a1UfJ?usp=drive_link';
                    if (slug.includes('kalahari')) return 'https://drive.google.com/drive/folders/16UUsxWUhWxmHfL-2X46wc4yfmo_A_f-u?usp=drive_link';
                    if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'https://drive.google.com/drive/folders/15btlRqv-5LvdMHTyG6HQERbUdWRwWtOS?usp=drive_link';
                    if (slug.includes('purg')) return 'https://drive.google.com/drive/folders/1yDGP-7iCCBa4S63mik-MFVOGOebCogdB?usp=drive_link';
                    if (slug.includes('nova')) return 'https://drive.google.com/drive/folders/1sug4ryRTA5TpnKyS2hh8MgZqrNiOL1rE?usp=drive_link';
                    return null;
                };
                return maps.map(map => ({
                    name: `Imagens Aéreas - ${map}`,
                    url: mapToDriveLink(map),
                    description: `Imagens do mapa ${map}`
                })).filter(it => !!it.url);
            }
            
        case 'planilhas':
            {
                const file = 'assets/downloads/CONTROLE DE LINES PARA COACH E ANALISTA .xlsx';
                const enc = encodeURIComponent(file);
                return [
                    {
                        name: 'Planilhas de Análise',
                        url: `${siteBase}/${enc}`,
                        description: 'Planilhas para coachs e analistas'
                    },
                    {
                        name: 'Aula explicativa (vídeo)',
                        url: 'https://drive.google.com/file/d/19TC8j7NSlpvpV3KtkEH9Q5Gr-ZH9RU_a/view',
                        description: 'Passo a passo completo para usar a planilha'
                    }
                ];
            }
            
        case 'passe-booyah':
            return [
                {
                    name: 'Instruções de Ativação',
                    url: `${baseUrl}instrucoes-passe.pdf`,
                    description: 'Como ativar o passe Booyah'
                }
            ];
            
        case 'camisa':
            return [
                {
                    name: 'Comprovante de Compra',
                    url: `${baseUrl}comprovante-camisa.pdf`,
                    description: 'Comprovante para retirada da camisa'
                }
            ];
            
        default:
            return [
                {
                    name: 'Produto Digital',
                    url: `${baseUrl}produto-${productId}.zip`,
                    description: 'Arquivo do produto comprado'
                }
            ];
    }
}

// Inicializar Firebase Admin se ainda não foi inicializado
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { type, data } = JSON.parse(event.body);
        
        console.log('=== PAYMENT NOTIFICATION RECEIVED ===');
        console.log('Type:', type);
        console.log('Data:', JSON.stringify(data, null, 2));
        console.log('Full body:', event.body);

        if (type === 'payment') {
            const paymentId = data.id;
            console.log('Processing payment ID:', paymentId);
            
            // Buscar detalhes do pagamento
            const accessToken = process.env.MP_ACCESS_TOKEN;
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch payment details');
            }

            const payment = await response.json();
            console.log('Payment details:', {
                id: payment.id,
                status: payment.status,
                external_reference: payment.external_reference,
                description: payment.description
            });

            // Se o pagamento foi aprovado, atualizar o Firestore
            if (payment.status === 'approved') {
                console.log('Payment approved, updating database...');

                try {
                    const db = admin.firestore();
                    // Prefer external_reference, fallback para preference_id or metadata.external_reference
                    const externalRef = payment.external_reference || payment.preference_id || (payment.metadata && payment.metadata.external_reference) || null;

                    // Primeiro, tentar buscar na coleção 'orders' (para compras de tokens e produtos)
                    console.log('Searching for order with external_reference/preference_id:', externalRef);
                    const ordersRef = db.collection('orders');
                    let ordersSnapshot = { empty: true };
                    if (externalRef) {
                      try {
                        ordersSnapshot = await ordersRef.where('external_reference', '==', externalRef).get();
                      } catch(e) {
                        console.warn('Error querying orders by external_reference:', e);
                        ordersSnapshot = { empty: true };
                      }
                    }

                    console.log('Orders found:', (ordersSnapshot && ordersSnapshot.size) || 0);

                    // Se não encontrou, tentar buscar por ID do documento (caso o external_reference seja digital_<docId>)
                    if (ordersSnapshot.empty && externalRef && externalRef.startsWith('digital_')) {
                        const docId = externalRef.replace('digital_', '');
                        console.log('Trying to find order by document ID:', docId);
                        const orderDoc = await ordersRef.doc(docId).get();
                        if (orderDoc.exists) {
                            console.log('Found order by document ID:', docId);
                            // Atualizar o external_reference no documento
                            await orderDoc.ref.update({ external_reference: externalRef });
                            // Usar o documento encontrado
                            const orderData = orderDoc.data();
                            const orderDocRef = orderDoc.ref;

                            // Atualizar status para 'paid'
                            await orderDocRef.update({
                                status: 'paid',
                                paymentId: payment.id,
                                paymentStatus: 'approved',
                                paidAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            console.log('Order updated to paid:', orderDoc.id);

                            // Processar o tipo de compra
                            if (orderData.type === 'tokens_purchase' || (payment.description && /token/i.test(payment.description))) {
                                console.log('This is a token purchase! Processing...');
                                const tokensToAdd = Number(orderData.quantity || orderData.amount || orderData.total) || parseInt((payment.description && payment.description.match(/(\d+)/)?.[0]) || '1');
                                await creditTokensToUser(db, { ...orderData, id: orderDoc.id }, tokensToAdd, externalRef);
                            } else if (orderData.type === 'digital_product') {
                                console.log('This is a digital product purchase! Processing delivery...');

                                const deliveryData = {
                                    orderId: orderDoc.id,
                                    customerEmail: orderData.customer || orderData.buyerEmail,
                                    customerName: orderData.customerName,
                                    productId: orderData.productId,
                                    productName: orderData.title,
                                    productOptions: orderData.productOptions || {},
                                    status: 'delivered',
                                    deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
                                    downloadLinks: await generateDownloadLinks(orderData.productId, orderData.productOptions),
                                    paymentId: payment.id
                                };

                                await db.collection('digital_deliveries').add(deliveryData);
                                console.log('✅ Digital delivery created for product:', orderData.productId);
                            }

                            return {
                                statusCode: 200,
                                headers,
                                body: JSON.stringify({ received: true, status: payment.status })
                            };
                        }
                    }
                    
                    // Se external_reference foi gerado no formato tokens_<docId>, tentar buscar pelo ID do documento
                    if (ordersSnapshot.empty && externalRef && externalRef.startsWith('tokens_')) {
                        const docId = externalRef.replace('tokens_', '');
                        console.log('Trying to find order by tokens document ID:', docId);
                        const orderDoc = await ordersRef.doc(docId).get();
                        if (orderDoc.exists) {
                            console.log('Found tokens order by document ID:', docId);
                            await orderDoc.ref.update({ external_reference: externalRef });
                            // Construir um snapshot-like object para prosseguir abaixo
                            ordersSnapshot = { empty: false, docs: [orderDoc], size: 1 };
                        }
                    }

                    if (!ordersSnapshot.empty) {
                        const orderDoc = ordersSnapshot.docs[0];
                        const orderData = orderDoc.data();
                        console.log('✅ Order found by external_reference:', { orderDocId: orderDoc.id, orderDataKeys: Object.keys(orderData) });

                        const updateData = {
                            status: 'paid',
                            paymentId: payment.id,
                            paymentStatus: 'approved',
                            paidAt: admin.firestore.FieldValue.serverTimestamp()
                        };

                        // 🔥 IMPORTANTE: Buscar e adicionar link do WhatsApp se não existir
                        if (!orderData.whatsappLink || orderData.whatsappLink === '' || orderData.whatsappLink === null) {
                            console.log('🔍 Link do WhatsApp não encontrado no pedido, buscando...');
                            try {
                                const whatsappLink = await getWhatsAppLinkForRegistration(
                                    orderData.eventType || orderData.event_type,
                                    orderData.schedule || orderData.hour || null,
                                    orderData.date || null
                                );
                                if (whatsappLink) {
                                    updateData.whatsappLink = whatsappLink;
                                    updateData.groupLink = whatsappLink;
                                    console.log(`✅ Link do WhatsApp adicionado ao pedido ${orderDoc.id}:`, whatsappLink);
                                } else {
                                    console.log(`⚠️ Nenhum link do WhatsApp encontrado para o pedido ${orderDoc.id}. Deixando vazio.`);
                                }
                            } catch (linkError) {
                                console.error('❌ Erro ao buscar link do WhatsApp para o pedido:', linkError);
                            }
                        } else {
                            console.log('✅ Link do WhatsApp já existe no pedido:', orderData.whatsappLink);
                        }

                        // Atualizar status para 'paid' (com link se encontrado)
                        await orderDoc.ref.update(updateData);

                        console.log('✅ Order updated to paid:', orderDoc.id);

                        // Verificar tipo de compra
                        console.log('🔍 Checking purchase type...');
                        console.log('📦 Order type:', orderData.type, '| userId:', orderData.userId, '| customer:', orderData.customer, '| quantity:', orderData.quantity);

                        // Se for compra de tokens, atualizar saldo do usuário via transação
                        if (orderData.type === 'tokens_purchase' || (payment.description && /token/i.test(payment.description))) {
                            console.log('🎯 This is a token purchase! Processing...');
                            const tokensToAdd = Number(orderData.quantity || orderData.amount || orderData.total) || parseInt((payment.description && payment.description.match(/(\d+)/)?.[0]) || '1');
                            console.log('💰 Tokens to add:', tokensToAdd);
                            await creditTokensToUser(db, { ...orderData, id: orderDoc.id }, tokensToAdd, externalRef);
                        }
                        // Se for produto digital, criar entrega digital
                        else if (orderData.type === 'digital_product') {
                            console.log('This is a digital product purchase! Processing delivery...');

                            const deliveryData = {
                                orderId: orderDoc.id,
                                customerEmail: orderData.customer || orderData.buyerEmail,
                                customerName: orderData.customerName,
                                productId: orderData.productId,
                                productName: orderData.title,
                                productOptions: orderData.productOptions || {},
                                status: 'delivered',
                                deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
                                downloadLinks: await generateDownloadLinks(orderData.productId, orderData.productOptions),
                                paymentId: payment.id
                            };

                            await db.collection('digital_deliveries').add(deliveryData);
                            console.log('✅ Digital delivery created for product:', orderData.productId);
                        }

                    } else {
                        console.log('❌ Order NOT found by external_reference:', externalRef);
                        // Se não encontrou em orders, tentar em registrations (para agendamentos)
                        const registrationsRef = db.collection('registrations');
                        const registrationsSnapshot = await registrationsRef.where('external_reference', '==', externalRef).get();
                        
                        if (!registrationsSnapshot.empty) {
                            console.log('✅ Registrations found:', registrationsSnapshot.size);
                            // Atualizar TODOS os registros associados a este pagamento
                            const batch = db.batch();
                            
                            for (const doc of registrationsSnapshot.docs) {
                                const regData = doc.data();
                                const updateData = {
                                    status: 'paid',
                                    paymentId: payment.id,
                                    paymentStatus: 'approved',
                                    paidAt: admin.firestore.FieldValue.serverTimestamp()
                                };
                                
                                // Buscar e adicionar link do WhatsApp se não existir
                                if (!regData.groupLink && !regData.whatsappLink) {
                                    try {
                                        const whatsappLink = await getWhatsAppLinkForRegistration(
                                            regData.eventType || regData.event_type,
                                            regData.schedule || regData.hour,
                                            regData.date || null
                                        );
                                        if (whatsappLink) {
                                            updateData.groupLink = whatsappLink;
                                            updateData.whatsappLink = whatsappLink;
                                            console.log(`✅ Link do WhatsApp adicionado ao registro ${doc.id}:`, whatsappLink);
                                        }
                                    } catch (linkError) {
                                        console.error('Erro ao buscar link do WhatsApp:', linkError);
                                    }
                                }
                                
                                batch.update(doc.ref, updateData);
                            }
                            
                            await batch.commit();
                            console.log('✅ Registrations updated to paid:', registrationsSnapshot.size);
                            
                            // Criar vendas de afiliados para cada registro
                            for (const doc of registrationsSnapshot.docs) {
                                const regData = { ...doc.data(), id: doc.id };
                                await createAffiliateSale(db, regData, 'event');
                            }
                        } else {
                            console.log('❌ No order or registration found for external_reference:', externalRef);
                            console.log('🔍 DEBUG: Payment details:', { paymentId: payment.id, paymentStatus: payment.status, externalRef: payment.external_reference, preferenceId: payment.preference_id });
                        }
                    }
                } catch (firebaseError) {
                    console.error('❌ Firebase update error:', firebaseError);
                    // Não falhar a notificação por causa de erro no Firebase
                }
                
                console.log('=== PAYMENT PROCESSING COMPLETED ===');
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ received: true, status: payment.status })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true, type })
        };

    } catch (error) {
        console.error('Error processing payment notification:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
