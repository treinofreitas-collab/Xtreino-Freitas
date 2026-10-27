import {
  applyLogoBrush,
  hasTransparentEdgeBackground,
  hasUniformEdgeBackground,
  padImageDataToSquare,
  removeConnectedEdgeBackground,
} from './spec-logo-image-tools.mjs';

const HOURS = ['19', '20', '21', '22', '23', '00'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const FIRST_CODE = 902000034;
const STORAGE_ROOT = 'teams/modo-liga/logos/spec';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm';
const BACKGROUND_MODEL = 'onnx-community/ormbg-ONNX';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2048;

let root;
let initialized = false;
let backgroundRemoverPromise;
let pendingLogo = null;
let selectedLogoFile = null;
let selectedSourcePreviewUrl = '';
let editHistory = [];
let activeStroke = null;
let brushMode = 'restore';

function codeForLetter(letter) {
  const index = LETTERS.indexOf(String(letter || '').toUpperCase());
  return index < 0 ? '' : String(FIRST_CODE + index);
}

function letterForCode(code) {
  const index = Number(code) - FIRST_CODE;
  return Number.isInteger(index) && index >= 0 && index < LETTERS.length
    ? LETTERS[index]
    : '';
}

function selectedHour() {
  return root?.querySelector('#specLogoHour')?.value || HOURS[0];
}

function selectedLetter() {
  return root?.querySelector('#specLogoLetter')?.value || LETTERS[0];
}

function storagePath(hour, code) {
  return `${STORAGE_ROOT}/${hour}H/${code}.png`;
}

function setStatus(message, kind = 'info') {
  const status = root?.querySelector('#specLogoStatus');
  if (!status) return;
  const colors = {
    info: 'text-slate-600 bg-slate-50 border-slate-200',
    success: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    error: 'text-red-800 bg-red-50 border-red-200',
    warning: 'text-amber-800 bg-amber-50 border-amber-200',
  };
  status.className = `mt-4 rounded-lg border px-3 py-2 text-sm ${colors[kind] || colors.info}`;
  status.textContent = message;
  status.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function getSpecLogoViewMode(role) {
  const normalizedRole = String(role || '').toLowerCase().trim();
  if (['admin', 'ceo', 'gerente'].includes(normalizedRole)) return 'manage';
  if (normalizedRole === 'streamer') return 'download-only';
  if (['socio', 'sócio', 'operador'].includes(normalizedRole)) return 'view';
  return 'denied';
}

function currentViewMode() {
  return getSpecLogoViewMode(window.adminRoleLower);
}

function canUpload() {
  return currentViewMode() === 'manage';
}

function isStreamer() {
  return currentViewMode() === 'download-only';
}

function canView() {
  const allowed = window._adminAllowedSections;
  return currentViewMode() !== 'denied'
    && (!Array.isArray(allowed) || allowed.includes('sectionSpecLogos'));
}

function ensureFirebaseAccess() {
  if (!canView()) throw new Error('Seu perfil não tem acesso às logos do SPEC.');
  if (!window.firebaseStorage || !window.firebaseAuth?.currentUser) {
    throw new Error('Entre novamente no painel para acessar as logos do SPEC.');
  }
}

function renderShell() {
  const hourOptions = HOURS.map(hour => `<option value="${hour}">${hour}H</option>`).join('');
  const letterOptions = LETTERS.map(letter => `<option value="${letter}">${letter}</option>`).join('');
  const streamerMode = isStreamer();
  const uploadControls = canUpload()
    ? `
      <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 class="font-semibold text-slate-800">Cadastrar logo</h3>
        <p class="mt-1 text-xs text-slate-500">A imagem é preparada no navegador e só é enviada ao Firebase quando você salvar. Escolha remover o fundo ou manter a imagem original; o arquivo será PNG com o código numérico.</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <label class="text-xs font-semibold text-slate-600">Horário
            <select id="specLogoHour" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">${hourOptions}</select>
          </label>
          <label class="text-xs font-semibold text-slate-600">Letra
            <select id="specLogoLetter" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">${letterOptions}</select>
          </label>
          <div class="text-xs font-semibold text-slate-600">Código SPEC
            <output id="specLogoCode" class="mt-1 flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-800"></output>
          </div>
        </div>
        <div id="specLogoDropzone" class="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center transition-colors hover:border-teal-500">
          <div id="specLogoDropInstructions" class="flex flex-col items-center">
            <i class="fas fa-image text-xl text-teal-700" aria-hidden="true"></i>
            <span class="mt-2 text-sm font-semibold text-slate-800">Arraste a logo para esta área</span>
            <span class="mt-1 text-xs text-slate-500">ou selecione um arquivo PNG, JPG ou WebP • até 10 MB</span>
          </div>
          <div id="specLogoSourcePreview" class="mt-2 hidden items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <img id="specLogoSourcePreviewImage" class="h-40 w-40 rounded-md border border-slate-200 bg-white object-contain" alt="Prévia da logo selecionada">
            <span class="text-xs font-medium text-slate-600">Prévia da imagem selecionada</span>
          </div>
          <button id="specLogoChoose" type="button" class="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <i class="fas fa-folder-open mr-2" aria-hidden="true"></i>Escolher arquivo
          </button>
          <input id="specLogoFile" type="file" accept="image/png,image/jpeg,image/webp" class="hidden">
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-xs font-semibold text-slate-600">Método
            <select id="specLogoMethod" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">
              <option value="auto">Automático (recomendado)</option>
              <option value="edge">Fundo liso pelas bordas</option>
              <option value="ai">Fundo complexo com IA</option>
              <option value="original">Manter imagem original (sem remover fundo)</option>
            </select>
          </label>
          <label class="text-xs font-semibold text-slate-600">Tolerância do fundo liso
            <span class="mt-1 flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5">
              <input id="specLogoTolerance" type="range" min="8" max="120" value="42" class="min-w-0 flex-1">
              <output id="specLogoToleranceValue" class="w-8 text-right font-mono text-sm">42</output>
            </span>
          </label>
        </div>
        <p class="mt-2 text-xs text-slate-500">O automático remove a cor uniforme que toca as bordas; se o fundo for variado, usa a IA. Você também pode manter a logo original, sem remover o fundo. A prévia e o PNG final ficam quadrados (1:1), com a arte centralizada e sem cortes.</p>
        <div id="specLogoPreview" class="mt-4 hidden">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-semibold text-slate-700">Prévia da logo</p>
            <span id="specLogoPreviewName" class="text-xs text-slate-500"></span>
          </div>
          <div class="mt-2 flex min-h-36 items-center justify-center rounded-lg border border-slate-200 p-4" style="background-color:#fff;background-image:linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0">
              <canvas id="specLogoPreviewCanvas" aria-label="Prévia editável da logo" class="max-h-64 max-w-full touch-none object-contain" style="cursor:crosshair"></canvas>
          </div>
          <div id="specLogoEditControls" class="mt-3 flex flex-wrap items-center gap-2">
            <span class="mr-1 text-xs font-semibold text-slate-600">Retoque:</span>
            <button type="button" data-spec-brush-mode="restore" class="rounded-md border border-teal-700 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">Restaurar</button>
            <button type="button" data-spec-brush-mode="erase" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Apagar</button>
            <label class="flex items-center gap-2 text-xs text-slate-600">Pincel
              <input id="specLogoBrushSize" type="range" min="8" max="96" value="32" class="w-24">
            </label>
            <button id="specLogoUndo" type="button" disabled class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Desfazer</button>
            <button id="specLogoResetEdits" type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Recomeçar retoque</button>
            <span class="text-xs text-slate-500">Pinte sobre a prévia para corrigir detalhes.</span>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button id="specLogoProcess" type="button" class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
            <i class="fas fa-magic mr-2" aria-hidden="true"></i><span data-spec-process-label>Remover fundo e preparar PNG</span>
          </button>
          <button id="specLogoSave" type="button" disabled class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            <i class="fas fa-save mr-2" aria-hidden="true"></i>Salvar com código <span data-spec-code></span>
          </button>
        </div>
      </div>
    `
    : streamerMode ? '' : `
      <div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        Seu perfil pode consultar e baixar as logos salvas. O cadastro, a substituição e a remoção ficam disponíveis para administradores.
      </div>
    `;
  const streamerDownloadControls = streamerMode
    ? `
      <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 class="font-semibold text-slate-800">Baixar logos para SPEC</h3>
        <p class="mt-1 text-xs text-slate-500">Escolha o horário e baixe as logos cadastradas em um arquivo ZIP.</p>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <label class="min-w-40 text-xs font-semibold text-slate-600">Horário
            <select id="specLogoHourView" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">${hourOptions}</select>
          </label>
          <button id="specLogoDownload" type="button" class="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
            <i class="fas fa-download mr-2" aria-hidden="true"></i>Baixar logos <span data-spec-hour-label>${HOURS[0]}H</span> (ZIP)
          </button>
        </div>
      </div>
    `
    : '';
  const logoListSection = streamerMode ? '' : `
    <div class="mt-6 border-t border-slate-200 pt-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 class="font-semibold text-slate-800">Logos cadastradas</h3>
          <p class="mt-1 text-xs text-slate-500">Os nomes exibidos e exportados são somente os códigos numéricos.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          ${canUpload() ? '' : `<label class="text-xs font-semibold text-slate-600">Horário`}
          ${canUpload() ? '' : `<select id="specLogoHourView" class="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">${hourOptions}</select></label>`}
          <button id="specLogoRefresh" type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <i class="fas fa-sync-alt mr-1" aria-hidden="true"></i>Atualizar
          </button>
          ${canUpload() ? `
            <button id="specLogoClear" type="button" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50" title="Apagar todas as logos do horário selecionado">
              <i class="fas fa-trash-alt mr-1" aria-hidden="true"></i>Limpar tudo
            </button>
          ` : ''}
          <button id="specLogoDownload" type="button" class="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
            <i class="fas fa-download mr-2" aria-hidden="true"></i>Baixar logos <span data-spec-hour-label>${HOURS[0]}H</span> (ZIP)
          </button>
        </div>
      </div>
      <p id="specLogoCount" class="mt-3 text-xs text-slate-500" aria-live="polite"></p>
      <div id="specLogoList" class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Carregando logos…</div>
      </div>
    </div>
  `;

  root.innerHTML = `
    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><i class="fas fa-images" aria-hidden="true"></i></span>
            <h2 class="text-lg font-bold text-slate-900">LOGOS PARA SPEC</h2>
          </div>
          <p class="mt-2 max-w-3xl text-sm text-slate-600">${streamerMode
            ? 'Escolha o horário desejado e baixe as logos SPEC em ZIP.'
            : 'Cadastre uma logo por horário e letra. O PNG mantém o código exato usado pelo SPEC; o fundo pode ser removido ou mantido como na imagem original.'}</p>
        </div>
      </div>
      ${uploadControls}
      ${streamerDownloadControls}
      <div id="specLogoStatus" class="mt-4 hidden" role="status" aria-live="polite"></div>
      ${logoListSection}
    </div>
  `;
}

function getHourForList() {
  return root?.querySelector('#specLogoHour')?.value
    || root?.querySelector('#specLogoHourView')?.value
    || HOURS[0];
}

function updateCodeLabel() {
  const code = codeForLetter(selectedLetter());
  const output = root?.querySelector('#specLogoCode');
  const saveLabel = root?.querySelector('#specLogoSave [data-spec-code]');
  if (output) output.textContent = code;
  if (saveLabel) saveLabel.textContent = code;
  updateHourLabel();
  if (pendingLogo && (pendingLogo.hour !== selectedHour() || pendingLogo.letter !== selectedLetter())) {
    clearPendingPreview();
  }
}

function updateHourLabel() {
  const hourLabel = root?.querySelector('[data-spec-hour-label]');
  if (hourLabel) hourLabel.textContent = `${getHourForList()}H`;
}

function clearSourceFilePreview() {
  if (selectedSourcePreviewUrl) URL.revokeObjectURL(selectedSourcePreviewUrl);
  selectedSourcePreviewUrl = '';
  const preview = root?.querySelector('#specLogoSourcePreview');
  const image = root?.querySelector('#specLogoSourcePreviewImage');
  const instructions = root?.querySelector('#specLogoDropInstructions');
  if (image) image.removeAttribute('src');
  if (preview) {
    preview.classList.add('hidden');
    preview.classList.remove('flex');
  }
  if (instructions) instructions.classList.remove('hidden');
}

function showSourceFilePreview(file) {
  clearSourceFilePreview();
  selectedSourcePreviewUrl = URL.createObjectURL(file);
  const preview = root?.querySelector('#specLogoSourcePreview');
  const image = root?.querySelector('#specLogoSourcePreviewImage');
  const instructions = root?.querySelector('#specLogoDropInstructions');
  if (image) image.src = selectedSourcePreviewUrl;
  if (preview) {
    preview.classList.remove('hidden');
    preview.classList.add('flex');
  }
  if (instructions) instructions.classList.add('hidden');
}

function clearPendingPreview() {
  pendingLogo = null;
  editHistory = [];
  activeStroke = null;
  const preview = root?.querySelector('#specLogoPreview');
  const saveButton = root?.querySelector('#specLogoSave');
  const canvas = root?.querySelector('#specLogoPreviewCanvas');
  const undoButton = root?.querySelector('#specLogoUndo');
  if (preview) preview.classList.add('hidden');
  if (saveButton) saveButton.disabled = true;
  if (canvas) {
    canvas.width = 1;
    canvas.height = 1;
  }
  if (undoButton) undoButton.disabled = true;
}

function loadBackgroundRemover() {
  if (!backgroundRemoverPromise) {
    backgroundRemoverPromise = import(/* @vite-ignore */ TRANSFORMERS_URL)
      .then(({ pipeline }) => pipeline('background-removal', BACKGROUND_MODEL, {
        progress_callback: event => {
          if (event?.status === 'progress' && Number.isFinite(event.progress)) {
            const progress = event.progress <= 1 ? event.progress * 100 : event.progress;
            setStatus(`Preparando o removedor de fundo: ${Math.round(progress)}%. Na primeira utilização, o modelo pode demorar para baixar.`);
          } else if (event?.status === 'downloading') {
            setStatus('Baixando os arquivos do removedor de fundo. Isso acontece principalmente na primeira utilização.');
          }
        },
      }))
      .catch(error => {
        backgroundRemoverPromise = null;
        throw new Error(`Não foi possível carregar o removedor automático de fundo. Verifique a conexão e tente novamente. (${error?.message || 'erro ao carregar o modelo'})`);
      });
  }
  return backgroundRemoverPromise;
}

function cloneImageData(imageData) {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );
}

function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar o PNG.'))),
      type,
    );
  });
}

async function prepareSourceImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Não foi possível preparar a imagem original.');
    context.drawImage(bitmap, 0, 0, width, height);
    const sourceImageData = context.getImageData(0, 0, width, height);
    const modelBlob = await canvasToBlob(canvas);
    return {
      sourceImageData,
      modelInputUrl: URL.createObjectURL(modelBlob),
    };
  } finally {
    bitmap.close?.();
  }
}

function rawImageToImageData(rawImage) {
  const width = Number(rawImage?.width);
  const height = Number(rawImage?.height);
  const channels = Number(rawImage?.channels);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('A IA retornou dimensões inválidas.');
  }
  if (![3, 4].includes(channels) || rawImage.data.length !== width * height * channels) {
    throw new Error('A IA retornou um formato de imagem não compatível.');
  }
  const imageData = new ImageData(width, height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const sourceOffset = pixel * channels;
    const targetOffset = pixel * 4;
    imageData.data[targetOffset] = rawImage.data[sourceOffset];
    imageData.data[targetOffset + 1] = rawImage.data[sourceOffset + 1];
    imageData.data[targetOffset + 2] = rawImage.data[sourceOffset + 2];
    imageData.data[targetOffset + 3] = channels === 4 ? rawImage.data[sourceOffset + 3] : 255;
  }
  return imageData;
}

function resizeImageData(imageData, width, height) {
  if (imageData.width === width && imageData.height === height) return imageData;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;
  sourceCanvas.getContext('2d').putImageData(imageData, 0, 0);
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = width;
  targetCanvas.height = height;
  const targetContext = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetContext) throw new Error('Não foi possível ajustar a prévia da IA.');
  targetContext.drawImage(sourceCanvas, 0, 0, width, height);
  return targetContext.getImageData(0, 0, width, height);
}

function drawPreview(imageData) {
  const canvas = root?.querySelector('#specLogoPreviewCanvas');
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  if (!canvas || !context) throw new Error('Não foi possível exibir a prévia editável.');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  context.putImageData(imageData, 0, 0);
}

async function processSelectedLogo() {
  const file = selectedLogoFile || root?.querySelector('#specLogoFile')?.files?.[0];
  if (!file) {
    setStatus('Escolha ou arraste uma imagem antes de remover o fundo.', 'warning');
    return;
  }
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    setStatus('Envie uma imagem PNG, JPG ou WebP.', 'error');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    setStatus('A imagem ultrapassa o limite de 10 MB.', 'error');
    return;
  }

  const processButton = root.querySelector('#specLogoProcess');
  const saveButton = root.querySelector('#specLogoSave');
  const selected = {
    hour: selectedHour(),
    letter: selectedLetter(),
    code: codeForLetter(selectedLetter()),
  };
  clearPendingPreview();
  if (processButton) processButton.disabled = true;
  if (saveButton) saveButton.disabled = true;

  let modelInputUrl = '';
  try {
    setStatus('Preparando a imagem para preservar a qualidade do emblema…');
    const prepared = await prepareSourceImage(file);
    modelInputUrl = prepared.modelInputUrl;
    const requestedMethod = root.querySelector('#specLogoMethod')?.value || 'auto';
    const keepOriginal = requestedMethod === 'original';
    const useEdgeColor = !keepOriginal && (requestedMethod === 'edge'
      || (requestedMethod === 'auto' && hasUniformEdgeBackground(prepared.sourceImageData)));
    let processedImageData = keepOriginal ? cloneImageData(prepared.sourceImageData) : null;
    let methodDescription = keepOriginal ? 'imagem original, sem remoção do fundo' : '';
    let completionMessage = keepOriginal
      ? 'Prévia da imagem original pronta. O fundo será mantido no PNG.'
      : '';
    let completionKind = keepOriginal ? 'info' : 'success';

    if (keepOriginal) {
      // Keep the uploaded artwork and background unchanged; saving still converts it to a numeric-code PNG.
    } else if (useEdgeColor) {
      const tolerance = Number(root.querySelector('#specLogoTolerance')?.value || 42);
      const result = removeConnectedEdgeBackground(prepared.sourceImageData, tolerance);
      processedImageData = new ImageData(result.data, result.width, result.height);
      methodDescription = 'remoção pela cor conectada às bordas';
      if (!result.removedCount) {
        if (hasTransparentEdgeBackground(prepared.sourceImageData)) {
          completionMessage = 'A imagem já tinha transparência nas bordas; mantive o emblema sem passar pela IA.';
        } else {
          completionMessage = 'Não encontrei uma cor uniforme nas bordas. Tente “Fundo complexo com IA” ou aumente a tolerância.';
          completionKind = 'warning';
        }
      }
      if (!completionMessage) completionMessage = 'Fundo conectado às bordas removido. Confira a prévia e retoque qualquer detalhe.';
    } else {
      if (requestedMethod === 'auto') {
        setStatus('Fundo variado detectado. Usando a IA para remover o fundo…');
      } else {
        setStatus('Carregando o removedor de fundo no navegador…');
      }
      const remover = await loadBackgroundRemover();
      const results = await remover([modelInputUrl]);
      const output = results?.[0];
      if (!output?.data) throw new Error('O removedor não retornou uma imagem válida.');
      processedImageData = resizeImageData(
        rawImageToImageData(output),
        prepared.sourceImageData.width,
        prepared.sourceImageData.height,
      );
      methodDescription = 'remoção por IA';
    }

    const squareSourceImageData = padImageDataToSquare(prepared.sourceImageData);
    const squareProcessedImageData = padImageDataToSquare(processedImageData);
    pendingLogo = {
      ...selected,
      sourceImageData: cloneImageData(squareSourceImageData),
      initialImageData: cloneImageData(squareProcessedImageData),
      imageData: cloneImageData(squareProcessedImageData),
      methodDescription,
      originalName: file.name,
    };
    editHistory = [];
    drawPreview(pendingLogo.imageData);
    const preview = root.querySelector('#specLogoPreview');
    const previewName = root.querySelector('#specLogoPreviewName');
    const undoButton = root.querySelector('#specLogoUndo');
    if (undoButton) undoButton.disabled = true;
    if (previewName) previewName.textContent = `${selected.hour}H • ${selected.letter} • ${selected.code}.png • ${methodDescription}`;
    if (preview) preview.classList.remove('hidden');
    if (saveButton) saveButton.disabled = false;
    setStatus(completionMessage || `Prévia pronta por ${methodDescription}. Use Restaurar/Apagar para corrigir detalhes antes de salvar.`, completionKind);
  } catch (error) {
    setStatus(error?.message || 'Não foi possível preparar esta imagem.', 'error');
  } finally {
    if (modelInputUrl) URL.revokeObjectURL(modelInputUrl);
    if (processButton) processButton.disabled = false;
  }
}

function updateBrushModeButtons() {
  root?.querySelectorAll('[data-spec-brush-mode]').forEach(button => {
    const active = button.dataset.specBrushMode === brushMode;
    button.classList.toggle('border-teal-700', active);
    button.classList.toggle('bg-teal-50', active);
    button.classList.toggle('text-teal-800', active);
    button.classList.toggle('border-slate-300', !active);
    button.classList.toggle('bg-white', !active);
    button.classList.toggle('text-slate-700', !active);
  });
}

function brushPointFromEvent(event) {
  const canvas = root?.querySelector('#specLogoPreviewCanvas');
  const rect = canvas?.getBoundingClientRect();
  if (!canvas || !rect?.width || !rect?.height || !pendingLogo) return null;
  const x = Math.max(0, Math.min(
    pendingLogo.imageData.width - 1,
    ((event.clientX - rect.left) / rect.width) * pendingLogo.imageData.width,
  ));
  const y = Math.max(0, Math.min(
    pendingLogo.imageData.height - 1,
    ((event.clientY - rect.top) / rect.height) * pendingLogo.imageData.height,
  ));
  const diameter = Number(root.querySelector('#specLogoBrushSize')?.value || 32);
  const radius = (diameter / 2) * (pendingLogo.imageData.width / rect.width);
  return { x, y, radius };
}

function paintBrushPoint(point) {
  const canvas = root?.querySelector('#specLogoPreviewCanvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context || !pendingLogo) return null;
  const dirty = applyLogoBrush(
    pendingLogo.imageData,
    pendingLogo.sourceImageData,
    point.x,
    point.y,
    point.radius,
    brushMode,
  );
  context.putImageData(
    pendingLogo.imageData,
    0,
    0,
    dirty.dirtyX,
    dirty.dirtyY,
    dirty.dirtyWidth,
    dirty.dirtyHeight,
  );
  return dirty;
}

function mergeDirtyBounds(current, next) {
  if (!current) return next;
  const x = Math.min(current.dirtyX, next.dirtyX);
  const y = Math.min(current.dirtyY, next.dirtyY);
  const right = Math.max(
    current.dirtyX + current.dirtyWidth,
    next.dirtyX + next.dirtyWidth,
  );
  const bottom = Math.max(
    current.dirtyY + current.dirtyHeight,
    next.dirtyY + next.dirtyHeight,
  );
  return { dirtyX: x, dirtyY: y, dirtyWidth: right - x, dirtyHeight: bottom - y };
}

function startBrushStroke(event) {
  if (!pendingLogo?.imageData || event.button !== 0) return;
  event.preventDefault();
  const canvas = root.querySelector('#specLogoPreviewCanvas');
  const point = brushPointFromEvent(event);
  if (!point) return;
  activeStroke = {
    pointerId: event.pointerId,
    snapshot: cloneImageData(pendingLogo.imageData),
    lastPoint: point,
    changed: false,
  };
  canvas.setPointerCapture?.(event.pointerId);
  paintBrushPoint(point);
  activeStroke.changed = true;
}

function continueBrushStroke(event) {
  if (!activeStroke || activeStroke.pointerId !== event.pointerId || !pendingLogo) return;
  event.preventDefault();
  const next = brushPointFromEvent(event);
  if (!next) return;
  const previous = activeStroke.lastPoint;
  const distance = Math.hypot(next.x - previous.x, next.y - previous.y);
  const spacing = Math.max(1, next.radius * 0.4);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  let dirtyBounds = null;
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    const point = {
      x: previous.x + (next.x - previous.x) * ratio,
      y: previous.y + (next.y - previous.y) * ratio,
      radius: next.radius,
    };
    dirtyBounds = mergeDirtyBounds(dirtyBounds, applyLogoBrush(
      pendingLogo.imageData,
      pendingLogo.sourceImageData,
      point.x,
      point.y,
      point.radius,
      brushMode,
    ));
  }
  if (dirtyBounds) {
    const canvas = root.querySelector('#specLogoPreviewCanvas');
    canvas?.getContext('2d')?.putImageData(
      pendingLogo.imageData,
      0,
      0,
      dirtyBounds.dirtyX,
      dirtyBounds.dirtyY,
      dirtyBounds.dirtyWidth,
      dirtyBounds.dirtyHeight,
    );
    activeStroke.changed = true;
  }
  activeStroke.lastPoint = next;
}

function finishBrushStroke(event) {
  if (!activeStroke || (event && activeStroke.pointerId !== event.pointerId)) return;
  if (activeStroke.changed) {
    editHistory.push(activeStroke.snapshot);
    if (editHistory.length > 5) editHistory.shift();
    const undoButton = root.querySelector('#specLogoUndo');
    if (undoButton) undoButton.disabled = false;
  }
  activeStroke = null;
}

function undoBrushStroke() {
  if (!pendingLogo || !editHistory.length) return;
  pendingLogo.imageData = editHistory.pop();
  drawPreview(pendingLogo.imageData);
  const undoButton = root.querySelector('#specLogoUndo');
  if (undoButton) undoButton.disabled = !editHistory.length;
  setStatus('Último retoque desfeito.', 'info');
}

function resetBrushEdits() {
  if (!pendingLogo?.initialImageData) return;
  pendingLogo.imageData = cloneImageData(pendingLogo.initialImageData);
  editHistory = [];
  drawPreview(pendingLogo.imageData);
  const undoButton = root.querySelector('#specLogoUndo');
  if (undoButton) undoButton.disabled = true;
  setStatus('Retoques manuais removidos; prévia voltou ao resultado original do método escolhido.', 'info');
}

async function savePendingLogo() {
  if (!canUpload()) {
    setStatus('Seu perfil pode baixar as logos, mas não cadastrá-las.', 'error');
    return;
  }
  if (!pendingLogo?.imageData) {
    setStatus('Prepare e confira a prévia antes de salvar.', 'warning');
    return;
  }

  const { hour, letter, code } = pendingLogo;
  const path = storagePath(hour, code);
  const button = root.querySelector('#specLogoSave');
  try {
    ensureFirebaseAccess();
    const canvas = root.querySelector('#specLogoPreviewCanvas');
    if (!canvas) throw new Error('A prévia não está disponível para salvar.');
    const blob = await canvasToBlob(canvas);
    const { ref, uploadBytes, getMetadata } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
    const target = ref(window.firebaseStorage, path);
    let exists = false;
    try {
      await getMetadata(target);
      exists = true;
    } catch (metadataError) {
      if (!['storage/object-not-found', 'storage/unauthorized'].includes(metadataError?.code)) {
        throw metadataError;
      }
    }
    if (exists && !window.confirm(`Já existe uma logo para ${letter} às ${hour}H. Deseja substituí-la?`)) return;
    if (button) button.disabled = true;
    setStatus(`Salvando ${code}.png para ${hour}H…`);
    const uploaded = await uploadBytes(target, blob, {
      contentType: 'image/png',
      cacheControl: 'public,max-age=60',
    });
    if (!uploaded.ref?.fullPath) throw new Error('O Firebase não confirmou o caminho da logo enviada.');
    clearPendingPreview();
    const fileInput = root.querySelector('#specLogoFile');
    if (fileInput) fileInput.value = '';
    selectedLogoFile = null;
    clearSourceFilePreview();
    setStatus(`Logo salva para ${hour}H: ${code}.png (${letter}).`, 'success');
    await refreshLogoList(hour);
  } catch (error) {
    setStatus(error?.code === 'storage/unauthorized'
      ? 'O Firebase Storage recusou o envio. Confira se as regras permitem gravação autenticada em teams/modo-liga/logos/.'
      : error?.message || 'Não foi possível salvar esta logo.', 'error');
  } finally {
    if (button) button.disabled = !pendingLogo?.imageData;
  }
}

async function listLogos(hour) {
  ensureFirebaseAccess();
  const { ref, listAll, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
  const result = await listAll(ref(window.firebaseStorage, `${STORAGE_ROOT}/${hour}H`));
  const entries = result.items
    .map(item => {
      const match = item.name.match(/^(\d+)\.png$/i);
      const code = match?.[1] || '';
      const letter = letterForCode(code);
      return letter ? { item, code, letter } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.letter.localeCompare(b.letter));
  return Promise.all(entries.map(async entry => ({
    ...entry,
    url: await getDownloadURL(entry.item),
  })));
}

export function getModoLigaSpecLogoItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const match = String(item?.name || '').match(/^(\d+)\.png$/i);
      const code = match?.[1] || '';
      const letter = letterForCode(code);
      if (!letter || letter > 'O') return null;
      return { item, code, letter };
    })
    .filter(Boolean)
    .sort((first, second) => first.letter.localeCompare(second.letter));
}

export async function loadModoLigaSpecLogoCatalog(hour) {
  const selected = String(hour || '');
  if (!HOURS.includes(selected)) throw new Error('Selecione um horário válido para buscar as logos SPEC.');
  if (!window.firebaseStorage || !window.firebaseAuth?.currentUser) {
    throw new Error('Entre novamente no painel para carregar as logos SPEC.');
  }

  const { ref, listAll, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
  const result = await listAll(ref(window.firebaseStorage, `${STORAGE_ROOT}/${selected}H`));
  const entries = getModoLigaSpecLogoItems(result.items);
  const logos = await Promise.all(entries.map(async entry => ({
    code: entry.code,
    letter: entry.letter,
    logoUrl: await getDownloadURL(entry.item),
    source: 'spec',
  })));
  return new Map(logos.map(logo => [logo.code, logo]));
}

async function removeLogo(hour, code, button) {
  if (!canUpload()) {
    setStatus('A remoção de logos está disponível apenas para administradores.', 'error');
    return;
  }
  if (!window.confirm(`Remover a logo ${code}.png do horário ${hour}H? Esta ação não pode ser desfeita.`)) {
    return;
  }

  try {
    button.disabled = true;
    const user = window.firebaseAuth?.currentUser;
    if (!user) throw new Error('Entre novamente no painel para remover a logo.');
    const token = await user.getIdToken();
    const response = await fetch(
      `/api/spec-logos/${encodeURIComponent(hour)}/${encodeURIComponent(code)}?hour=${encodeURIComponent(hour)}&code=${encodeURIComponent(code)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.error || `Não foi possível remover a logo (HTTP ${response.status}).`);
    }

    setStatus(`Logo ${code}.png removida do horário ${hour}H.`, 'success');
    await refreshLogoList(hour);
  } catch (error) {
    setStatus(error?.message || 'Não foi possível remover esta logo.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function clearHourLogos() {
  const hour = getHourForList();
  if (!canUpload()) {
    setStatus('A limpeza de logos está disponível apenas para administradores.', 'error');
    return;
  }
  if (!window.confirm(`Apagar todas as logos de ${hour}H? Os outros horários não serão alterados. Esta ação não pode ser desfeita.`)) {
    return;
  }

  const button = root?.querySelector('#specLogoClear');
  const hourSelect = root?.querySelector('#specLogoHour, #specLogoHourView');
  const hourWasDisabled = hourSelect?.disabled ?? false;
  if (button) button.disabled = true;
  if (hourSelect) hourSelect.disabled = true;
  try {
    const user = window.firebaseAuth?.currentUser;
    if (!user) throw new Error('Entre novamente no painel para limpar as logos.');
    const token = await user.getIdToken();
    const response = await fetch(`/api/spec-logos/${encodeURIComponent(hour)}?hour=${encodeURIComponent(hour)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.error || `Não foi possível limpar as logos (HTTP ${response.status}).`);
    }

    const deletedCount = Number(payload?.deletedCount) || 0;
    setStatus(
      deletedCount
        ? `${deletedCount} logo(s) removida(s) do horário ${hour}H.`
        : `Não havia logos cadastradas para remover em ${hour}H.`,
      'success',
    );
    await refreshLogoList(hour);
  } catch (error) {
    setStatus(error?.message || 'Não foi possível limpar as logos deste horário.', 'error');
    await refreshLogoList(hour);
  } finally {
    if (button && root?.contains(button)) button.disabled = false;
    if (hourSelect && root?.contains(hourSelect)) hourSelect.disabled = hourWasDisabled;
  }
}

async function refreshLogoList(hour = getHourForList()) {
  const list = root?.querySelector('#specLogoList');
  const count = root?.querySelector('#specLogoCount');
  const downloadButton = root?.querySelector('#specLogoDownload');
  if (!list) return [];
  if (downloadButton) downloadButton.disabled = true;
  list.innerHTML = '<div class="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Carregando logos…</div>';
  try {
    const entries = await listLogos(hour);
    if (count) count.textContent = `${entries.length} logo(s) cadastrada(s) para ${hour}H.`;
    if (!entries.length) {
      list.innerHTML = '<div class="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">Ainda não há logos cadastradas para este horário.</div>';
      return entries;
    }
    list.innerHTML = entries.map(entry => `
      <div class="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200" style="background-color:#fff;background-image:linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%);background-size:12px 12px;background-position:0 0,0 6px,6px -6px,-6px 0">
          <img src="${escapeHtml(entry.url)}" alt="Logo ${entry.letter}" class="h-full w-full object-contain">
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-slate-800">Letra ${entry.letter}</p>
          <p class="font-mono text-xs text-slate-500">${entry.code}.png</p>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <a href="${escapeHtml(entry.url)}" download="${entry.code}.png" class="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-label="Baixar ${entry.code}.png" title="Baixar logo">
            <i class="fas fa-download" aria-hidden="true"></i>
          </a>
          ${canUpload() ? `
            <button type="button" data-spec-logo-delete data-hour="${escapeHtml(hour)}" data-code="${escapeHtml(entry.code)}" class="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100" aria-label="Remover ${entry.code}.png" title="Remover logo">
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
    if (downloadButton) downloadButton.disabled = false;
    return entries;
  } catch (error) {
    if (count) count.textContent = '';
    list.innerHTML = `<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">${escapeHtml(error?.message || 'Não foi possível carregar as logos.')}</div>`;
    return [];
  } finally {
    if (downloadButton && !list.querySelector('.border-red-200')) {
      downloadButton.disabled = !list.querySelector('a[download]');
    }
  }
}

async function ensureJsZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar o gerador de ZIP.'));
    document.head.appendChild(script);
  });
  if (!window.JSZip) throw new Error('O gerador de ZIP não ficou disponível.');
  return window.JSZip;
}

async function downloadHourZip() {
  const hour = getHourForList();
  const button = root?.querySelector('#specLogoDownload');
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>Preparando ZIP…';
  }
  try {
    const user = window.firebaseAuth?.currentUser;
    if (!user) throw new Error('Sua sessão expirou. Entre novamente no painel.');
    const [token, JSZip] = await Promise.all([user.getIdToken(), ensureJsZip()]);
    const response = await fetch(`/api/spec-logos/${encodeURIComponent(hour)}/export?hour=${encodeURIComponent(hour)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.error || `Falha ao carregar as logos (HTTP ${response.status}).`);
    }
    if (!Array.isArray(payload?.logos) || !payload.logos.length) {
      setStatus(`Não há logos cadastradas para ${hour}H.`, 'warning');
      return;
    }
    const zip = new JSZip();
    const folder = zip.folder(`LOGOS ${hour}H`);
    for (const logo of payload.logos) {
      if (!/^9020000(?:3[4-9]|[45][0-9])$/.test(logo?.code || '')
        || typeof logo.base64 !== 'string'
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(logo.base64)) {
        throw new Error('O servidor retornou uma logo em formato inválido.');
      }
      const binary = atob(logo.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      folder.file(`${logo.code}.png`, bytes);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LOGOS ${hour}H.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setStatus(`Download iniciado: LOGOS ${hour}H.zip, com ${payload.logos.length} logo(s) nomeada(s) somente pelo código.`, 'success');
  } catch (error) {
    setStatus(error?.message || 'Não foi possível gerar o ZIP deste horário.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = `<i class="fas fa-download mr-2" aria-hidden="true"></i>Baixar logos <span data-spec-hour-label>${hour}H</span> (ZIP)`;
    }
  }
}

function attachEvents() {
  const hourSelect = root.querySelector('#specLogoHour');
  const letterSelect = root.querySelector('#specLogoLetter');
  const viewHourSelect = root.querySelector('#specLogoHourView');
  const fileInput = root.querySelector('#specLogoFile');
  const chooseButton = root.querySelector('#specLogoChoose');
  const dropzone = root.querySelector('#specLogoDropzone');
  const methodSelect = root.querySelector('#specLogoMethod');
  const toleranceInput = root.querySelector('#specLogoTolerance');
  const toleranceValue = root.querySelector('#specLogoToleranceValue');
  const previewCanvas = root.querySelector('#specLogoPreviewCanvas');

  const selectFile = file => {
    if (!file) return;
    selectedLogoFile = null;
    clearPendingPreview();
    clearSourceFilePreview();
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      setStatus('Envie uma imagem PNG, JPG ou WebP.', 'error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus('A imagem ultrapassa o limite de 10 MB.', 'error');
      return;
    }
    selectedLogoFile = file;
    showSourceFilePreview(file);
    setStatus('Imagem selecionada. Confira a prévia, escolha o método e clique em “Preparar PNG” para continuar.', 'info');
  };
  const updateMethodControls = () => {
    if (toleranceValue && toleranceInput) toleranceValue.textContent = toleranceInput.value;
    const selectedMethod = methodSelect?.value;
    if (toleranceInput) toleranceInput.disabled = selectedMethod === 'ai' || selectedMethod === 'original';
    const processLabel = root.querySelector('[data-spec-process-label]');
    if (processLabel) {
      processLabel.textContent = selectedMethod === 'original'
        ? 'Usar logo original e preparar PNG'
        : 'Remover fundo e preparar PNG';
    }
  };

  hourSelect?.addEventListener('change', () => {
    updateCodeLabel();
    clearPendingPreview();
    refreshLogoList(hourSelect.value);
  });
  letterSelect?.addEventListener('change', updateCodeLabel);
  methodSelect?.addEventListener('change', updateMethodControls);
  toleranceInput?.addEventListener('input', updateMethodControls);
  viewHourSelect?.addEventListener('change', () => {
    updateHourLabel();
    if (!isStreamer()) refreshLogoList(viewHourSelect.value);
  });
  fileInput?.addEventListener('change', () => selectFile(fileInput.files?.[0]));
  chooseButton?.addEventListener('click', () => {
    if (fileInput) fileInput.value = '';
    fileInput?.click();
  });
  dropzone?.addEventListener('dragover', event => {
    event.preventDefault();
    dropzone.classList.add('border-teal-600', 'bg-teal-50');
  });
  dropzone?.addEventListener('dragleave', event => {
    if (!dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove('border-teal-600', 'bg-teal-50');
    }
  });
  dropzone?.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('border-teal-600', 'bg-teal-50');
    const file = Array.from(event.dataTransfer?.files || [])
      .find(item => /^image\/(png|jpeg|webp)$/i.test(item.type));
    if (!file) {
      setStatus('Arraste um arquivo PNG, JPG ou WebP.', 'error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus('A imagem ultrapassa o limite de 10 MB.', 'error');
      return;
    }
    if (fileInput) fileInput.value = '';
    selectFile(file);
  });
  dropzone?.addEventListener('dragend', () => {
    dropzone.classList.remove('border-teal-600', 'bg-teal-50');
  });
  previewCanvas?.addEventListener('pointerdown', startBrushStroke);
  previewCanvas?.addEventListener('pointermove', continueBrushStroke);
  previewCanvas?.addEventListener('pointerup', finishBrushStroke);
  previewCanvas?.addEventListener('pointercancel', finishBrushStroke);
  root.querySelectorAll('[data-spec-brush-mode]').forEach(button => {
    button.addEventListener('click', () => {
      brushMode = button.dataset.specBrushMode;
      updateBrushModeButtons();
    });
  });
  root.querySelector('#specLogoUndo')?.addEventListener('click', undoBrushStroke);
  root.querySelector('#specLogoResetEdits')?.addEventListener('click', resetBrushEdits);
  root.querySelector('#specLogoProcess')?.addEventListener('click', processSelectedLogo);
  root.querySelector('#specLogoSave')?.addEventListener('click', savePendingLogo);
  root.querySelector('#specLogoRefresh')?.addEventListener('click', () => refreshLogoList());
  root.querySelector('#specLogoClear')?.addEventListener('click', clearHourLogos);
  root.querySelector('#specLogoDownload')?.addEventListener('click', downloadHourZip);
  root.querySelector('#specLogoList')?.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-spec-logo-delete]');
    if (!button) return;
    removeLogo(button.dataset.hour, button.dataset.code, button);
  });
  updateMethodControls();
  updateBrushModeButtons();
}

export async function openSpecLogosAdmin() {
  root = document.getElementById('specLogosRoot');
  if (!root) return;
  if (!canView()) {
    root.innerHTML = '<div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Seu perfil não tem acesso a esta área.</div>';
    return;
  }
  const viewMode = currentViewMode();
  if (!initialized || root.dataset.specLogoViewMode !== viewMode) {
    clearPendingPreview();
    selectedLogoFile = null;
    clearSourceFilePreview();
    root.dataset.specLogoViewMode = viewMode;
    renderShell();
    attachEvents();
    updateCodeLabel();
    initialized = true;
  }
  await refreshLogoList();
}

export const specLogoCodeForLetter = codeForLetter;
export const specLogoLetterForCode = letterForCode;
export const specLogoStoragePath = storagePath;
export const SPEC_LOGO_HOURS = HOURS;
