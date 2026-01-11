// Netlify Function: chat-reply
// Responde mensagens do chat usando um provedor de IA (OpenAI via REST)

const PROVIDER = 'openai';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { message, context = {} } = JSON.parse(event.body || '{}');
    if (!message || typeof message !== 'string') {
      return { statusCode: 400, headers, body: 'Missing message' };
    }

    // Prompt base com contexto do negócio
    const systemPrompt = [
      'Você é o assistente oficial da Org Freitas (XTreino Freitas).',
      'Responda de forma direta e educada, em português do Brasil.',
      'Informações úteis:',
      '- Horários: Segunda a Sexta, 08h às 23h.',
      '- Produtos: Treinos/Camps, Tokens, Sensibilidades, Imagens Aéreas, Planilhas, Passe Booyah.',
      '- Pagamento: principal via Mercado Pago.',
      '- Tokens: 1 token = R$ 1,00 (usados para vagas em eventos).',
      '- Links de WhatsApp de salas não devem ser enviados por aqui; instruir o usuário a ver em Minha Conta > Meus Pedidos quando a compra for confirmada.',
      'Se a pergunta envolver dados pessoais, não peça documentos sensíveis. Para dúvidas de pedido, peça o email usado na compra e ao menos o ID aproximado do pedido (últimos 4 caracteres se possível).'
    ].join('\n');

    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_B;

    let aiText = '';

    if (PROVIDER === 'openai' && openaiKey) {
      // Chamada simples ao OpenAI Responses API (compatível com gpt-4o-mini, gpt-4o-mini-translate, etc.)
      const payload = {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ]
      };

      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('OpenAI error:', errText);
        throw new Error('AI provider error');
      }

      const data = await res.json();
      aiText = data?.output_text?.trim?.() || data?.choices?.[0]?.message?.content || 'Obrigado! Como posso ajudar?';
    } else {
      // Fallback local (sem chave) – respostas padrão
      const lower = message.toLowerCase();
      if (lower.includes('preço') || lower.includes('valor')) {
        aiText = 'Nossos valores estão descritos nas seções do site. Tokens custam R$ 1,00 por unidade. Precisa de algo específico?';
      } else if (lower.includes('horário') || lower.includes('hora')) {
        aiText = 'Atendemos de segunda a sexta, das 08h às 23h. Os treinos geralmente ocorrem entre 14h e 23h.';
      } else if (lower.includes('token')) {
        aiText = 'Você pode comprar tokens em Minha Conta > Meus Tokens. 1 token = R$ 1,00.';
      } else if (lower.includes('whatsapp')) {
        aiText = 'Os links dos grupos aparecem em Minha Conta > Meus Pedidos quando seu pedido de evento é confirmado. 😉';
      } else {
        aiText = 'Obrigado pela mensagem! Nossa equipe responderá em breve. Como posso ajudar?';
      }
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: aiText })
    };
  } catch (err) {
    console.error('chat-reply error:', err);
    return { statusCode: 500, headers, body: 'Internal Server Error' };
  }
};


