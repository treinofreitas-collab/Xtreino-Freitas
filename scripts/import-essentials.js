/**
 * Script para importar dados essenciais (destaques e links WhatsApp)
 * baseado nos dados fornecidos pelo usuário
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount-dst.json');

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importHighlights() {
  console.log('📦 Importando destaques...');
  
  const highlights = [
    {
      title: "Soluções que elevam o seu negócio",
      subtitle: "Agência Elevare",
      description: "A Agência Elevare é especialista em marketing digital, criação de sites e gestão de marcas. Com uma equipe criativa e estratégica, ajudamos empresas a crescer e se destacar no ambiente online com resultados reais e duradouros",
      imageUrl: "https://i.postimg.cc/C1RFWQPy/Chat-GPT-Image-14-de-out-de-2025-16-51-19.png",
      redirectUrl: "https://wa.me/558191143275?text=OL%C3%81%2C+GOSTARIA+DE+UM+SITE!+VIM+PELO+FREITAS",
      status: "active",
      createdAt: Date.now(),
      order: 1
    },
    {
      title: "Monitore seus pontos e dispute prêmios com os melhores!",
      subtitle: "Classificação Geral",
      description: "Nosso ranking atualiza sua pontuação de forma ágil e humanizada, permitindo que você acompanhe sua evolução em tempo real. Jogue, pontue e conquiste seu espaço entre os melhores!",
      imageUrl: "https://i.postimg.cc/N0qSZtF7/CAPA-SITE-RANKING-ORG-FREITAS.jpg58.jpg",
      redirectUrl: "https://challenge.place/c/651b81befc4906cf69ca3fde/stage/6861aa129d13c2c2a7ad730c7fbclid=PAT01DUANJYVJIeHRuA2FIbQlXMAABp1JPKxqAopThr5T7UsDlzqWnVsg73P-PniflpVwkmqh5Y_tc4nVD44UTyed_aem_7YfRJX5a2BFkKPh-C671rQ",
      status: "active",
      createdAt: Date.now(),
      order: 2
    },
    {
      title: "Aqui, o esforço é recompensado.",
      subtitle: "Desafio Freitas — Rumo ao PC Gamer!",
      description: "A corrida começou! O primeiro time a alcançar 10.000 Pontos no nosso sistema oficial garante um PC GAMER COMPLETO!! Some pontos, suba no ranking e leve o PC pra casa.",
      imageUrl: "https://i.postimg.cc/3JFQx0yH/CAPA-TREINO-SITE-ORG-FREITAS.jpg",
      redirectUrl: null,
      status: "active",
      createdAt: Date.now(),
      order: 3
    },
    {
      title: "Ser associado é estar um passo à frente.",
      subtitle: "Associe-se e Eleve seu Jogo!",
      description: "Adquira seus tokens, garanta presença nos treinos e conquiste vantagens únicas. A Organização Freitas valoriza quem tá na ativa — jogue, evolua e apareça nas transmissões oficiais.",
      imageUrl: "https://i.postimg.cc/t4GJLxK6/CAPA-ASSOCIADO-SITE-ORG-FREITAS.jpg",
      redirectUrl: null,
      status: "active",
      createdAt: Date.now(),
      order: 4
    },
    {
      title: "Inscrições abertas — Camp Freitas",
      subtitle: "CAMPEONATO FREITAS - R$4.000 + TROFÉU",
      description: "Novo Campeonato Freitas: Horários 19h-23h (19h,20h,21h,22h,23h). Modalidade Misto | Squad — 2 quedas por fase. Premiação total R$ 4.000,00 + Troféu. Funcionamento: Segunda a Sexta-feira. Diferencial: Transmissão modo liga ao vivo a partir das Semifinais. Promoção no site: R$8,00 (valor normal R$10,00).",
      imageUrl: "https://i.postimg.cc/hGMvNDFC/CAPA-DESTAQUE-SITE-CAMP-DE-FASES-ORG-FREITAS.png",
      redirectUrl: null,
      status: "active",
      createdAt: Date.now(),
      order: 1
    },
    {
      title: "Apareça nas transmissões, Banners e Eventos Oficiais da Org Freitas.",
      subtitle: "Torne-se um Patrocinador",
      description: "Conecte sua marca ao universo que mais cresce no Cenário Gamer. Na Org Freitas, sua empresa ganha Visibilidade em transmissões, Banners, Eventos e Redes Oficiais, alcançando milhares de jogadores e fãs todos os dias.",
      imageUrl: "https://i.postimg.cc/sXsj9RPJ/CAPA-ABA-PATROCINADORES-SITE-ORG-FREITAS-CENTRAL.png",
      redirectUrl: "https://w.app/ov5rjg",
      status: "active",
      createdAt: Date.now(),
      order: 6
    }
  ];

  const batch = db.batch();
  highlights.forEach((highlight, index) => {
    const ref = db.collection('highlights').doc();
    batch.set(ref, highlight);
  });

  await batch.commit();
  console.log(`✅ ${highlights.length} destaques importados`);
}

async function importWhatsAppLinks() {
  console.log('\n📦 Importando links do WhatsApp...');
  
  // Baseado no print que você me passou, vou criar os links principais
  // Você pode me passar a lista completa depois se quiser
  
  const links = [
    // Camp Freitas
    { eventType: 'camp-freitas', schedule: '20h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'camp-freitas', schedule: '21h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'camp-freitas', schedule: '22h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'camp-freitas', schedule: '23h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    
    // Modo Liga
    { eventType: 'modo-liga', schedule: '14h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '15h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '16h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '17h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '18h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '19h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '20h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '21h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '22h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'modo-liga', schedule: '23h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    
    // Semanal Freitas
    { eventType: 'semanal-freitas', schedule: '20h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'semanal-freitas', schedule: '21h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'semanal-freitas', schedule: '22h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    
    // XTreino Tokens
    { eventType: 'xtreino-tokens', schedule: '14h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '15h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '16h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '17h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '18h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '19h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '20h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '21h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '22h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' },
    { eventType: 'xtreino-tokens', schedule: '23h', link: 'https://api.whatsapp.com/send?phone=...', status: 'active' }
  ];

  console.log('⚠️  Links do WhatsApp precisam ser preenchidos com os valores reais do print');
  console.log('   Por enquanto, deixei placeholders. Você pode me passar os links completos?');
  
  // Se você me passar os links reais, atualizo aqui
}

async function main() {
  try {
    console.log('🚀 Iniciando importação de dados essenciais...\n');
    
    await importHighlights();
    await importWhatsAppLinks();
    
    console.log('\n✅ Importação concluída!');
    console.log('\n📝 PRÓXIMOS PASSOS:');
    console.log('   1. Me passe os links reais do WhatsApp (do print)');
    console.log('   2. Quando a cota liberar, rodamos migrate-firestore.js para o resto');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();

