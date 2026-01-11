const admin = require('firebase-admin');

exports.handler = async (event, context) => {
    try {
        // Inicializar Firebase Admin se não estiver inicializado
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
        }

        const db = admin.firestore();

        // Testar escrita simples
        const testData = {
            test: true,
            timestamp: new Date(),
            message: 'Teste de escrita no Firestore'
        };

        const docRef = await db.collection('test').add(testData);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Firestore write test successful',
                docId: docRef.id,
                data: testData
            })
        };

    } catch (error) {
        console.error('Firestore write test error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                code: error.code,
                details: error.toString()
            })
        };
    }
};
