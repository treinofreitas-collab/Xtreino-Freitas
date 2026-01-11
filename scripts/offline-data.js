// Sistema de Dados Offline - Funciona quando Firebase está indisponível
class OfflineDataManager {
  constructor() {
    this.offlineData = {
      users: [
        {
          id: 'user1',
          name: 'Admin Sistema',
          email: 'admin@exemplo.com',
          role: 'ceo',
          createdAt: new Date()
        },
        {
          id: 'user2',
          name: 'Usuário Teste',
          email: 'usuario@exemplo.com',
          role: 'vendedor',
          createdAt: new Date()
        }
      ],
      orders: [
        {
          id: 'order1',
          item: 'Produto Teste',
          amount: 50.00,
          status: 'paid',
          customerEmail: 'cliente@exemplo.com',
          timestamp: new Date()
        },
        {
          id: 'order2',
          item: 'Serviço Premium',
          amount: 100.00,
          status: 'pending',
          customerEmail: 'cliente2@exemplo.com',
          timestamp: new Date()
        }
      ],
      tokens: [
        {
          id: 'token1',
          user: 'admin@exemplo.com',
          amount: 50.00,
          status: 'active',
          type: 'purchase',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'token2',
          user: 'usuario@exemplo.com',
          amount: 25.00,
          status: 'used',
          type: 'bonus',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      ],
      adminHistory: [
        {
          id: 'history1',
          action: 'add_tokens',
          user: 'Sistema',
          details: 'Tokens iniciais adicionados',
          timestamp: new Date()
        },
        {
          id: 'history2',
          action: 'create_coupon',
          user: 'Admin',
          details: 'Cupom de boas-vindas criado',
          timestamp: new Date()
        },
        {
          id: 'history3',
          action: 'user_login',
          user: 'Admin',
          details: 'Login realizado com sucesso',
          timestamp: new Date()
        }
      ]
    };
  }

  // Obter dados offline
  getOfflineData(collection) {
    return this.offlineData[collection] || [];
  }

  // Simular KPIs offline
  getOfflineKPIs() {
    const orders = this.getOfflineData('orders');
    const today = new Date().toDateString();
    
    const todaySales = orders
      .filter(order => new Date(order.timestamp).toDateString() === today && order.status === 'paid')
      .reduce((sum, order) => sum + (order.amount || 0), 0);

    const monthSales = orders
      .filter(order => {
        const orderDate = new Date(order.timestamp);
        const now = new Date();
        return orderDate.getMonth() === now.getMonth() && 
               orderDate.getFullYear() === now.getFullYear() && 
               order.status === 'paid';
      })
      .reduce((sum, order) => sum + (order.amount || 0), 0);

    const pendingAmount = orders
      .filter(order => order.status === 'pending')
      .reduce((sum, order) => sum + (order.amount || 0), 0);

    return {
      todaySales,
      monthSales,
      pendingAmount,
      activeUsers: this.getOfflineData('users').length
    };
  }

  // Simular estatísticas de tokens
  getOfflineTokenStats() {
    const tokens = this.getOfflineData('tokens');
    
    const totalPurchased = tokens.filter(token => 
      token.status === 'active' || token.status === 'used'
    ).length;
    
    const totalUsed = tokens.filter(token => 
      token.status === 'used'
    ).length;
    
    const totalValue = tokens.reduce((sum, token) => 
      sum + (token.amount || 0), 0
    );

    return {
      totalPurchased,
      totalUsed,
      totalValue
    };
  }
}

// Instância global
window.offlineDataManager = new OfflineDataManager();

// Função para detectar se Firebase está disponível
window.isFirebaseAvailable = async () => {
  try {
    if (!window.firebaseDb) return false;
    
    // Tentar uma consulta simples
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    await getDocs(collection(window.firebaseDb, 'users'));
    return true;
  } catch (error) {
    console.warn('Firebase não disponível:', error.message);
    return false;
  }
};

console.log('✅ Sistema de dados offline carregado');

