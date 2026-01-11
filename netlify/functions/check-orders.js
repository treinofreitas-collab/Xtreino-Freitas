// Netlify Function: Verificar orders no Firestore
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
        
        // Buscar todos os orders (sem orderBy para evitar erro de índice)
        const ordersSnapshot = await db.collection('orders').limit(10).get();
        
        const orders = [];
        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            orders.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? data.createdAt.toDate() : null
            });
        });
        
        // Buscar todos os users
        const usersSnapshot = await db.collection('users').get();
        
        const users = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                id: doc.id,
                email: data.email,
                tokens: data.tokens || 0
            });
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Orders e Users encontrados',
                ordersCount: orders.length,
                usersCount: users.length,
                orders: orders,
                users: users
            })
        };
        
    } catch (error) {
        console.error('Error checking orders:', error);
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
