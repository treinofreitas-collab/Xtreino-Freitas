// Netlify Function: Instruções para configurar webhook do Mercado Pago
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const base = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://orgfreitas.com.br';
    const webhookUrl = `${base}/.netlify/functions/payment-notification`;
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            message: 'Configuração manual do webhook necessária',
            instructions: {
                step1: 'Acesse: https://www.mercadopago.com.br/developers',
                step2: 'Faça login com sua conta do Mercado Pago',
                step3: 'Vá em "Suas integrações" → "Configurações"',
                step4: 'Procure por "Notificações" ou "Webhooks"',
                step5: 'Adicione a URL de notificação:',
                webhookUrl: webhookUrl,
                step6: 'Selecione o evento: "payment"',
                step7: 'Salve as configurações'
            },
            alternative: {
                message: 'Se não encontrar a opção, use o painel de desenvolvedores:',
                url: 'https://www.mercadopago.com.br/developers/panel/app',
                note: 'Procure por "Notificações" ou "Webhooks" nas configurações'
            },
            test: {
                message: 'Para testar se está funcionando:',
                testUrl: `${base}/.netlify/functions/payment-notification`,
                note: 'Faça um pagamento de teste e verifique os logs'
            }
        })
    };
};
