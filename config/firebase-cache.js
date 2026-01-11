// Firebase Cache System - Reduz consultas para economizar quota
class FirebaseCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  // Gerar chave única para cache
  generateKey(collection, filters = {}) {
    return `${collection}_${JSON.stringify(filters)}`;
  }

  // Verificar se dados estão em cache
  isCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    // Verificar se não expirou
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Obter dados do cache
  getFromCache(key) {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  // Salvar dados no cache
  setCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  // Limpar cache
  clearCache() {
    this.cache.clear();
  }

  // Obter dados com cache
  async getWithCache(collection, filters = {}) {
    const key = this.generateKey(collection, filters);
    
    // Verificar cache primeiro
    if (this.isCached(key)) {
      console.log(`📦 Cache hit: ${collection}`);
      return this.getFromCache(key);
    }

    // Se não estiver em cache, buscar do Firebase
    try {
      console.log(`🔥 Firebase query: ${collection}`);
      const { collection: firestoreCollection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const snapshot = await getDocs(firestoreCollection(window.firebaseDb, collection));
      
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      // Salvar no cache
      this.setCache(key, data);
      return data;
    } catch (error) {
      console.error(`Erro ao buscar ${collection}:`, error);
      return [];
    }
  }
}

// Instância global do cache
window.firebaseCache = new FirebaseCache();

// Função para limpar cache (útil para desenvolvimento)
window.clearFirebaseCache = () => {
  window.firebaseCache.clearCache();
  console.log('🗑️ Cache do Firebase limpo');
};

console.log('✅ Sistema de cache do Firebase carregado');

