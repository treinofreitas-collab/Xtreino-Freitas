/* X-Treino Freitas — hardening leve do navegador */
(() => {
  'use strict';
  // Bloqueia o menu de contexto dentro do site; não impede extração por ferramentas externas.
  document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
  // Links placeholder não devem saltar para o topo por acidente.
  document.addEventListener('click', (event) => {
    const link = event.target && event.target.closest ? event.target.closest('a[href="#"]') : null;
    if (link && !link.hasAttribute('data-allow-empty-href')) event.preventDefault();
  }, { capture: true });
})();
