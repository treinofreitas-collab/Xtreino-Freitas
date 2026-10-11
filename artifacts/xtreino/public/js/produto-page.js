// Módulo compartilhado para páginas de produto
// Detecta o productId pelo pathname da URL e carrega dados do Firestore

(async function() {
    const _slug = window.location.pathname.split('/').pop().replace(/\.html$/, '');
    const PRODUTO_ID = _slug || document.querySelector('meta[name="product-id"]')?.content || '';

    function showEl(id) { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
    function hideEl(id) { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }

    function showLoading() { showEl('pageLoading'); hideEl('pageContent'); hideEl('pageError'); }
    function showError(msg) {
        hideEl('pageLoading'); hideEl('pageContent'); showEl('pageError');
        const el = document.getElementById('errMsg');
        if (el && msg) el.textContent = msg;
    }
    function showContent() { hideEl('pageLoading'); hideEl('pageError'); showEl('pageContent'); }

    function formatPrice(p) {
        return 'R$ ' + Number(p || 0).toFixed(2).replace('.', ',');
    }

    function renderPriceOptions(opts, basePrice) {
        if (!opts || opts.length === 0) return '';
        return `<div class="mt-3 space-y-2">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Opções de preço</p>
            ${opts.map(o => `<div class="flex justify-between items-center bg-slate-700 rounded-xl px-4 py-2.5 border border-slate-600">
                <span class="text-sm text-slate-200">${o.label || ''}</span>
                <span class="font-bold text-orange-400">${formatPrice(o.price)}</span>
            </div>`).join('')}
        </div>`;
    }

    function renderProduct(prod, productId) {
        const name = prod.name || prod.label || productId;
        const desc = (prod.description || '').trim();
        const price = Number(prod.price) || 0;
        const imageUrl = prod.image || prod.imageUrl || 'assets/images/Logo - Xtreino Freitas.png';
        const badge = prod.badge || '';
        const badgeColor = prod.badgeColor || 'bg-yellow-400 text-black';
        const catVal = (prod.category || '').toLowerCase();
        const catLabel = catVal === 'fisico' || catVal === 'physical' ? 'Físico'
            : catVal === 'servico' || catVal === 'service' ? 'Serviço'
            : 'Digital';
        const catColor = catVal === 'fisico' || catVal === 'physical' ? 'bg-blue-900 text-blue-300'
            : catVal === 'servico' || catVal === 'service' ? 'bg-purple-900 text-purple-300'
            : 'bg-emerald-900 text-emerald-300';
        const priceOpts = renderPriceOptions(prod.priceOptions, price);
        const descHtml = desc
            ? `<div class="mt-5">
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Descrição</p>
                <div class="bg-slate-800 rounded-xl p-4 border border-slate-700 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">${desc.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
              </div>` : '';

        document.title = `${name} — X-TREINO FREITAS`;
        document.getElementById('prodBannerImg').src = imageUrl;
        document.getElementById('prodBannerImg').alt = name;
        document.getElementById('prodName').textContent = name;
        document.getElementById('prodPrice').textContent = formatPrice(price);
        document.getElementById('prodCatBadge').textContent = catLabel;
        document.getElementById('prodCatBadge').className = `text-xs font-bold px-3 py-1 rounded-full ${catColor}`;

        const badgeEl = document.getElementById('prodBadge');
        if (badge) {
            badgeEl.textContent = badge;
            badgeEl.className = `absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full ${badgeColor}`;
            badgeEl.classList.remove('hidden');
        }

        document.getElementById('prodExtras').innerHTML = priceOpts + descHtml;
        document.getElementById('prodBuyBtn').onclick = () => {
            window.location.href = `index.html?openEvent=${encodeURIComponent(productId)}`;
        };

        showContent();
    }

    showLoading();

    if (!PRODUTO_ID) {
        showError('ID do produto não encontrado na URL.');
        return;
    }

    // Aguarda Firebase ficar pronto (máx 10s)
    const waitFirebase = () => new Promise((resolve, reject) => {
        if (window.firebaseDb) { resolve(window.firebaseDb); return; }
        let attempts = 0;
        const iv = setInterval(() => {
            attempts++;
            if (window.firebaseDb) { clearInterval(iv); resolve(window.firebaseDb); }
            else if (window.firebaseReady === false || attempts > 100) {
                clearInterval(iv);
                reject(new Error('Firebase não disponível'));
            }
        }, 100);
    });

    try {
        const db = await waitFirebase();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        // Tenta coleção 'products' primeiro
        let snap = await getDoc(doc(db, 'products', PRODUTO_ID));
        if (!snap.exists()) {
            // Fallback: coleção 'adminEvents'
            snap = await getDoc(doc(db, 'adminEvents', PRODUTO_ID));
        }

        if (!snap.exists()) {
            showError(`Produto "${PRODUTO_ID}" não encontrado. Verifique se ele está ativo no painel admin.`);
            return;
        }

        renderProduct(snap.data(), PRODUTO_ID);

    } catch (err) {
        if (!window.firebaseDb) {
            showError('Banco de dados não configurado. Contate o administrador.');
        } else {
            showError('Erro ao carregar produto: ' + (err.message || err));
        }
    }
})();
