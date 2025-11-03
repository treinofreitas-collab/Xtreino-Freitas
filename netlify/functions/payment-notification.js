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
                        const siteBase = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br';
                        const mapToFilename = (m) => {
                            const slug = (m || '').toString().toLowerCase().replace(/\s+/g,'-');
                            if (slug.includes('bermuda')) return 'assets/downloads/BERMUDA.zip';
                            if (slug.includes('kalahari')) return 'assets/downloads/KALAHARI.zip';
                            if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'assets/downloads/ALPINE.zip';
                            if (slug.includes('purg')) return 'assets/downloads/PURGATORIO.zip';
                            return `imagens-${slug}.zip`;
                        };
                        return maps.map(map => ({
                            name: `${product.name} - ${map}`,
                            url: `${siteBase}/${mapToFilename(map)}`,
                            description: `~20 imagens com principais calls do mapa ${map}`
                        }));
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
                const mapToFilename = (m) => {
                    const slug = (m || '').toString().toLowerCase().replace(/\s+/g,'-');
                    if (slug.includes('bermuda')) return 'assets/downloads/BERMUDA.zip';
                    if (slug.includes('kalahari')) return 'assets/downloads/KALAHARI.zip';
                    if (slug.includes('alp') || slug.includes('alpina') || slug.includes('alpine')) return 'assets/downloads/ALPINE.zip';
                    if (slug.includes('purg')) return 'assets/downloads/PURGATORIO.zip';
                    return `imagens-${slug}.zip`;
                };
                return maps.map(map => ({
                    name: `Imagens Aéreas - ${map}`,
                    url: `${siteBase}/${mapToFilename(map)}`,
                    description: `~20 imagens com principais calls do mapa ${map}`
                }));
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
                    const externalRef = payment.external_reference;
                    
                    // Primeiro, tentar buscar na coleção 'orders' (para compras de tokens e produtos)
                    console.log('Searching for order with external_reference:', externalRef);
                    const ordersRef = db.collection('orders');
                    const ordersSnapshot = await ordersRef.where('external_reference', '==', externalRef).get();
                    
                    console.log('Orders found:', ordersSnapshot.size);
                    ordersSnapshot.forEach(doc => {
                        console.log('Order document:', doc.id, doc.data());
                    });
                    
                    // Se não encontrou, tentar buscar por ID do documento (caso o external_reference seja digital_<docId>)
                    if (ordersSnapshot.empty && externalRef.startsWith('digital_')) {
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
                            if (payment.description && payment.description.includes('Token')) {
                                console.log('This is a token purchase! Processing...');
                                const userId = orderData.userId || orderData.uid;
                                const customerEmail = orderData.customer || orderData.buyerEmail;
                                
                                if (customerEmail) {
                                    console.log('Looking up user by email:', customerEmail);
                                    const usersSnapshot = await db.collection('users').where('email', '==', customerEmail).get();
                                    
                                    if (!usersSnapshot.empty) {
                                        const userDoc = usersSnapshot.docs[0];
                                        const currentTokens = userDoc.data().tokens || 0;
                                        const tokensToAdd = parseInt(payment.description.match(/\d+/)?.[0] || '1');
                                        
                                        await userDoc.ref.update({
                                            tokens: currentTokens + tokensToAdd
                                        });
                                        
                                        console.log(`✅ Added ${tokensToAdd} tokens to user ${customerEmail}. New balance: ${currentTokens + tokensToAdd}`);
                                    }
                                }
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
                    
                    if (!ordersSnapshot.empty) {
                        const orderDoc = ordersSnapshot.docs[0];
                        const orderData = orderDoc.data();
                        
                        // Atualizar status para 'paid'
                        await orderDoc.ref.update({
                            status: 'paid',
                            paymentId: payment.id,
                            paymentStatus: 'approved',
                            paidAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        
                        console.log('Order updated to paid:', orderDoc.id);
                        
                        // Verificar tipo de compra
                        console.log('Checking purchase type...');
                        console.log('Payment description:', payment.description);
                        console.log('Order data:', orderData);
                        
                        // Se for compra de tokens, atualizar saldo do usuário
                        if (payment.description && payment.description.includes('Token')) {
                            console.log('This is a token purchase! Processing...');
                            const userId = orderData.userId || orderData.uid;
                            const customerEmail = orderData.customer || orderData.buyerEmail;
                            
                            console.log('User ID:', userId);
                            console.log('Customer Email:', customerEmail);
                            
                            // Primeiro tentar por email (mais confiável)
                            if (customerEmail) {
                                console.log('Looking up user by email:', customerEmail);
                                const usersSnapshot = await db.collection('users').where('email', '==', customerEmail).get();
                                
                                if (!usersSnapshot.empty) {
                                    const userDoc = usersSnapshot.docs[0];
                                    const currentTokens = userDoc.data().tokens || 0;
                                    const tokensToAdd = parseInt(payment.description.match(/\d+/)?.[0] || '1');
                                    
                                    console.log(`Current tokens: ${currentTokens}, Adding: ${tokensToAdd}`);
                                    
                                    await userDoc.ref.update({
                                        tokens: currentTokens + tokensToAdd
                                    });
                                    
                                    console.log(`✅ Added ${tokensToAdd} tokens to user ${customerEmail}. New balance: ${currentTokens + tokensToAdd}`);
                                } else {
                                    console.log('❌ No user found with email:', customerEmail);
                                }
                            } else if (userId) {
                                // Fallback: buscar usuário por ID
                                console.log('Looking up user by ID:', userId);
                                const userRef = db.collection('users').doc(userId);
                                const userDoc = await userRef.get();
                                
                                if (userDoc.exists) {
                                    const currentTokens = userDoc.data().tokens || 0;
                                    const tokensToAdd = parseInt(payment.description.match(/\d+/)?.[0] || '1');
                                    
                                    console.log(`Current tokens: ${currentTokens}, Adding: ${tokensToAdd}`);
                                    
                                    await userRef.update({
                                        tokens: currentTokens + tokensToAdd
                                    });
                                    
                                    console.log(`✅ Added ${tokensToAdd} tokens to user ${userId}. New balance: ${currentTokens + tokensToAdd}`);
                                } else {
                                    console.log('❌ User document not found for ID:', userId);
                                }
                            } else {
                                console.log('❌ No user ID or email found in order data');
                            }
                        }
                        
                        // Se for produto digital, criar entrega digital
                        else if (orderData.type === 'digital_product') {
                            console.log('This is a digital product purchase! Processing delivery...');
                            
                            // Criar entrega digital
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
                            
                            console.log('Creating digital delivery:', deliveryData);
                            
                            // Salvar entrega digital
                            await db.collection('digital_deliveries').add(deliveryData);
                            
                            console.log('✅ Digital delivery created for product:', orderData.productId);
                        }
                    } else {
                        // Se não encontrou em orders, tentar em registrations (para agendamentos)
                        const registrationsRef = db.collection('registrations');
                        const registrationsSnapshot = await registrationsRef.where('external_reference', '==', externalRef).get();
                        
                        if (!registrationsSnapshot.empty) {
                            const registrationDoc = registrationsSnapshot.docs[0];
                            
                            // Atualizar status para 'paid'
                            await registrationDoc.ref.update({
                                status: 'paid',
                                paymentId: payment.id,
                                paymentStatus: 'approved',
                                paidAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            
                            console.log('Registration updated to paid:', registrationDoc.id);
                        } else {
                            console.log('❌ No order or registration found for external_reference:', externalRef);
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
