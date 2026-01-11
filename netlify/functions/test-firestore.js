// Netlify Function: Teste simples do Firestore
const admin = require('firebase-admin');

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
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const db = admin.firestore();
        
        // Teste simples: contar orders
        const ordersSnapshot = await db.collection('orders').get();
        const ordersCount = ordersSnapshot.size;
        
        // Teste simples: contar users
        const usersSnapshot = await db.collection('users').get();
        const usersCount = usersSnapshot.size;
        
        // Pegar alguns orders para debug
        const orders = [];
        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            orders.push({
                id: doc.id,
                title: data.title,
                status: data.status,
                external_reference: data.external_reference,
                customer: data.customer
            });
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Firestore test successful',
                ordersCount: ordersCount,
                usersCount: usersCount,
                orders: orders.slice(0, 5) // Apenas os primeiros 5
            })
        };
        
    } catch (error) {
        console.error('Firestore test error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Firestore test failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};
