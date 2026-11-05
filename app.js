// State Management
let API_KEY = localStorage.getItem('gemini_api_key') || '';
let CURRENT_MODEL = localStorage.getItem('gemini_model') || 'gemini-3.5-flash';
let selectedFileBase64 = '';
let selectedFileMime = '';
let history = [];
let currentHistoryId = null; // history record shown in the results, kept in sync on re-translate
// History lives in IndexedDB (much larger quota than localStorage). localStorage is
// read here for older installs (migrated on startup) and used as a fallback store.
const HISTORY_KEY = 'translation_history';
const HISTORY_LIMIT = 15;
let historyDB = null;     // null → fall back to localStorage
let historyReady = null;  // resolves once history has been loaded from IndexedDB
try {
  const stored = JSON.parse(localStorage.getItem(HISTORY_KEY));
  if (Array.isArray(stored)) history = stored;
} catch (e) {
  console.warn('Discarding corrupt translation history:', e);
}
let activeStream = null;
// Full-resolution decoded copy of the current picture, plus the user's crop/rotation.
// Edits are always re-applied to this original so cropping keeps as much detail as possible.
let sourceImage = null;
let imageEdit = { rotation: 0, crop: null }; // crop: {x, y, w, h} as 0-1 fractions of the rotated image
const MAX_UPLOAD_DIM = 1200;

// Theme: an explicit choice is saved; otherwise follow the system setting
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_COLORS = { light: '#ffffff', dark: '#0a0a0a' }; // match --bg-primary
let SAVED_THEME = readSavedTheme(); // 'light' | 'dark' | null

// Bump this when the Privacy Policy or Terms change to ask users to accept again
const POLICY_VERSION = '2026-11-05';

// DOM Elements
const elements = {
  // Theme Toggle
  themeToggleBtn: document.getElementById('themeToggleBtn'),

  // Settings
  apiKeyBanner: document.getElementById('apiKeyBanner'),
  setupApiKeyBtn: document.getElementById('setupApiKeyBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleApiKeyBtn: document.getElementById('toggleApiKey'),
  modelSelect: document.getElementById('modelSelect'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),

  // Upload/Capture Card
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  previewContainer: document.getElementById('previewContainer'),
  previewImg: document.getElementById('previewImg'),
  clearPreviewBtn: document.getElementById('clearPreviewBtn'),
  editPreviewBtn: document.getElementById('editPreviewBtn'),
  cameraBtn: document.getElementById('cameraBtn'),
  translateBtn: document.getElementById('translateBtn'),
  translateBtnText: document.getElementById('translateBtnText'),
  translateSpinner: document.getElementById('translateSpinner'),

  // Camera Overlay
  cameraOverlay: document.getElementById('cameraOverlay'),
  cameraVideo: document.getElementById('cameraVideo'),
  shutterBtn: document.getElementById('shutterBtn'),
  cameraInput: document.getElementById('cameraInput'),
  closeCameraBtn: document.getElementById('closeCameraBtn'),

  // Results
  resultsSection: document.getElementById('resultsSection'),
  malTextarea: document.getElementById('malTextarea'),
  engTextarea: document.getElementById('engTextarea'),
  copyMalBtn: document.getElementById('copyMalBtn'),
  retranslateBtn: document.getElementById('retranslateBtn'),
  retranslateBtnText: document.getElementById('retranslateBtnText'),
  copyEngBtn: document.getElementById('copyEngBtn'),
  shareMalBtn: document.getElementById('shareMalBtn'),
  shareEngBtn: document.getElementById('shareEngBtn'),

  // Crop editor
  cropOverlay: document.getElementById('cropOverlay'),
  cropStage: document.getElementById('cropStage'),
  cropCanvas: document.getElementById('cropCanvas'),
  cropBox: document.getElementById('cropBox'),
  cropCancelBtn: document.getElementById('cropCancelBtn'),
  cropDoneBtn: document.getElementById('cropDoneBtn'),
  cropResetBtn: document.getElementById('cropResetBtn'),
  cropRotateLeftBtn: document.getElementById('cropRotateLeftBtn'),
  cropRotateRightBtn: document.getElementById('cropRotateRightBtn'),

  // History
  historyHeader: document.getElementById('historyHeader'),
  historyList: document.getElementById('historyList'),
  historyChevron: document.getElementById('historyChevron'),

  // Toast
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toastText'),

  // Consent
  consentModal: document.getElementById('consentModal'),
  consentCheckbox: document.getElementById('consentCheckbox'),
  consentAcceptBtn: document.getElementById('consentAcceptBtn')
};

// Initialize Application
function init() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    // A new worker took over this page: the page may still be running older code
    const hadController = !!navigator.serviceWorker.controller;
    let updatePrompted = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || updatePrompted) return;
      updatePrompted = true;
      showToast('A new version is available.', {
        type: 'info',
        actionLabel: 'Reload',
        onAction: () => window.location.reload(),
        persistent: true
      });
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('[Service Worker] Registered successfully:', reg.scope))
        .catch(err => console.error('[Service Worker] Registration failed:', err));
    });
  }

  // Apply the saved theme, or follow the system one until the user picks
  applyTheme(currentTheme());
  const onSystemThemeChange = () => { if (!SAVED_THEME) applyTheme(currentTheme()); };
  if (systemDarkQuery.addEventListener) systemDarkQuery.addEventListener('change', onSystemThemeChange);
  else if (systemDarkQuery.addListener) systemDarkQuery.addListener(onSystemThemeChange); // Safari < 14

  checkConsent();
  checkApiKey();
  loadHistory();
  historyReady = initHistoryStore().then(loadHistory);
  setupEventListeners();

  // Set initial settings inputs
  elements.apiKeyInput.value = API_KEY;
  elements.modelSelect.value = CURRENT_MODEL;

  // Opened from the Android share sheet (manifest share_target -> service worker)
  receiveSharedImage();
}

// Event Listeners
function setupEventListeners() {
  // Theme Toggle
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Settings Modals
  elements.setupApiKeyBtn.addEventListener('click', openSettings);
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.closeModalBtn.addEventListener('click', closeSettings);
  // Tap/click on the dimmed backdrop (outside the dialog box) closes it
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettings();
  });
  elements.settingsModal.addEventListener('keydown', handleSettingsKeydown);
  elements.saveSettingsBtn.addEventListener('click', saveSettings);
  elements.toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);

  // File Upload
  elements.dropzone.addEventListener('click', (e) => {
    if (e.target === elements.fileInput) return; // click bubbling up from the hidden input itself
    elements.fileInput.click();
  });
  elements.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elements.fileInput.click();
    }
  });
  elements.fileInput.addEventListener('change', handleFileSelect);

  // Drag & Drop
  elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropzone.classList.add('dragover');
  });
  elements.dropzone.addEventListener('dragleave', () => {
    elements.dropzone.classList.remove('dragover');
  });
  elements.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  // Preview Actions
  elements.clearPreviewBtn.addEventListener('click', clearPreview);
  elements.editPreviewBtn.addEventListener('click', openCropEditor);

  // Crop editor
  elements.cropCancelBtn.addEventListener('click', () => closeCropEditor(false));
  elements.cropDoneBtn.addEventListener('click', () => closeCropEditor(true));
  elements.cropResetBtn.addEventListener('click', resetCrop);
  elements.cropRotateLeftBtn.addEventListener('click', () => rotateCrop(-90));
  elements.cropRotateRightBtn.addEventListener('click', () => rotateCrop(90));
  elements.cropBox.addEventListener('pointerdown', startCropDrag);
  elements.cropBox.addEventListener('pointermove', moveCropDrag);
  elements.cropBox.addEventListener('pointerup', endCropDrag);
  elements.cropBox.addEventListener('pointercancel', endCropDrag);
  elements.cropBox.addEventListener('keydown', handleCropBoxKeydown);
  elements.cropOverlay.addEventListener('keydown', handleCropOverlayKeydown);
  window.addEventListener('resize', () => {
    if (elements.cropOverlay.classList.contains('open')) drawCropEditor();
  });

  // Paste an image (Ctrl+V / Cmd+V)
  document.addEventListener('paste', handlePaste);

  // Camera Actions
  elements.cameraBtn.addEventListener('click', () => {
    // Phones: the native camera app gives full resolution, autofocus and HDR.
    // Desktop browsers ignore `capture`, so they keep the in-app camera.
    if (window.matchMedia('(pointer: coarse)').matches) {
      elements.cameraInput.click();
    } else {
      openCamera();
    }
  });
  elements.cameraInput.addEventListener('change', (e) => {
    handleFileSelect(e);
    e.target.value = ''; // allow taking another photo right away
  });
  elements.closeCameraBtn.addEventListener('click', closeCamera);
  elements.shutterBtn.addEventListener('click', captureFrame);

  // Translate Action
  elements.translateBtn.addEventListener('click', runTranslation);

  // Results Actions
  elements.copyMalBtn.addEventListener('click', () => copyToClipboard(elements.malTextarea.value, 'Malayalam text copied!'));
  elements.retranslateBtn.addEventListener('click', runRetranslation);
  elements.copyEngBtn.addEventListener('click', () => copyToClipboard(elements.engTextarea.value, 'English translation copied!'));

  // Web Share (phones and some desktop browsers): send text to WhatsApp, Messages, etc.
  if (navigator.share) {
    elements.shareMalBtn.hidden = false;
    elements.shareEngBtn.hidden = false;
    elements.shareMalBtn.addEventListener('click', () => shareText(elements.malTextarea.value));
    elements.shareEngBtn.addEventListener('click', () => shareText(elements.engTextarea.value));
  }

  // Auto-resize results on user input
  elements.malTextarea.addEventListener('input', () => adjustTextareaHeight(elements.malTextarea));
  elements.engTextarea.addEventListener('input', () => adjustTextareaHeight(elements.engTextarea));

  // History Actions
  elements.historyHeader.addEventListener('click', toggleHistoryList);
  elements.historyHeader.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleHistoryList();
    }
  });
  // One delegated listener instead of inline onclick handlers per item
  elements.historyList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.btn-delete-history');
    if (deleteBtn) {
      deleteHistoryItem(deleteBtn.dataset.id);
      return;
    }
    const openBtn = e.target.closest('.history-text-wrapper');
    if (openBtn) loadHistoryItem(openBtn.dataset.id);
  });
}

// Check if API Key exists, toggle warning banner
function checkApiKey() {
  if (!API_KEY) {
    elements.apiKeyBanner.style.display = 'flex';
    elements.settingsBtn.style.borderColor = '#ef4444';
  } else {
    elements.apiKeyBanner.style.display = 'none';
    elements.settingsBtn.style.borderColor = 'var(--border-color)';
  }
}

// Open/Close Settings Modal
let settingsReturnFocus = null;
function openSettings() {
  settingsReturnFocus = document.activeElement;
  elements.settingsModal.style.display = 'flex';
  elements.apiKeyInput.focus();
}

function closeSettings() {
  elements.settingsModal.style.display = 'none';
  if (settingsReturnFocus && document.contains(settingsReturnFocus)) {
    settingsReturnFocus.focus();
  }
  settingsReturnFocus = null;
}

// Esc closes the dialog; Tab / Shift+Tab stay inside it
function handleSettingsKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeSettings();
    return;
  }
  trapFocus(elements.settingsModal, e);
}

// Keep Tab / Shift+Tab inside a dialog
function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const focusable = [...container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function toggleApiKeyVisibility() {
  const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
  elements.apiKeyInput.type = type;
  
  // Toggle icon
  elements.toggleApiKeyBtn.setAttribute('aria-label', type === 'password' ? 'Show API key' : 'Hide API key');
  elements.toggleApiKeyBtn.innerHTML = type === 'password' 
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`;
}

// Save Settings
function saveSettings() {
  const newKey = elements.apiKeyInput.value.trim();
  const newModel = elements.modelSelect.value;
  
  API_KEY = newKey;
  CURRENT_MODEL = newModel;
  
  localStorage.setItem('gemini_api_key', newKey);
  localStorage.setItem('gemini_model', newModel);
  
  checkApiKey();
  closeSettings();
  showToast('Settings saved successfully!');
}

// Handle File selection from input
function handleFileSelect(event) {
  if (event.target.files.length > 0) {
    processFile(event.target.files[0]);
  }
}

// Process selected file: decode it, keep the original for cropping, then show a compressed preview.
// Resolves to true once the image is ready to translate.
function processFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please upload an image file.', { type: 'error' });
    return Promise.resolve(false);
  }

  const url = URL.createObjectURL(file);
  return loadImage(url)
    .then(img => {
      sourceImage = img;
      imageEdit = { rotation: 0, crop: null };
      renderSelection();
      return true;
    })
    .catch(() => {
      showToast('Could not read this image. Try a different file.', { type: 'error' });
      return false;
    })
    .finally(() => URL.revokeObjectURL(url)); // the decoded image stays usable
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

// Size of the image after rotation
function rotatedSize(img, rotation) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  return rotation % 180 === 0 ? { width: w, height: h } : { width: h, height: w };
}

// Draw `img` rotated (0/90/180/270 degrees clockwise), cropped and scaled onto a new canvas.
// The rotation is a canvas transform, so there is no full-size intermediate canvas
// (iOS limits canvas area, and phone photos can be 48 MP).
function renderImage(img, { rotation = 0, crop = null } = {}, scale = 1) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const rs = rotatedSize(img, rotation);
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const cx = c.x * rs.width, cy = c.y * rs.height;
  const cw = c.w * rs.width, ch = c.h * rs.height;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cw * scale));
  canvas.height = Math.max(1, Math.round(ch * scale));
  const ctx = canvas.getContext('2d');
  // JPEG has no alpha channel: paint white first so transparent PNGs don't turn black
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  if (rotation === 90) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
  else if (rotation === 180) { ctx.translate(w, h); ctx.rotate(Math.PI); }
  else if (rotation === 270) { ctx.translate(0, w); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

// Apply the current crop/rotation to the original and update the preview and upload data
function renderSelection() {
  const rs = rotatedSize(sourceImage, imageEdit.rotation);
  const c = imageEdit.crop || { w: 1, h: 1 };
  const longest = Math.max(c.w * rs.width, c.h * rs.height);
  // Downscale large photos to keep the request small
  const scale = Math.min(1, MAX_UPLOAD_DIM / longest);
  const dataUrl = renderImage(sourceImage, imageEdit, scale).toDataURL('image/jpeg', 0.85);

  selectedFileBase64 = dataUrl.split(',')[1];
  selectedFileMime = 'image/jpeg';
  showPreview(dataUrl);
}

function showPreview(src) {
  elements.previewImg.src = src;
  elements.dropzone.style.display = 'none';
  elements.previewContainer.style.display = 'block';
  elements.translateBtn.disabled = !selectedFileBase64;
}

// Clear Image Preview
function clearPreview() {
  selectedFileBase64 = '';
  selectedFileMime = '';
  sourceImage = null;
  imageEdit = { rotation: 0, crop: null };
  elements.previewImg.removeAttribute('src');
  elements.previewContainer.style.display = 'none';
  elements.dropzone.style.display = 'flex';
  elements.translateBtn.disabled = true;
  elements.fileInput.value = '';
}

// ---- Crop / rotate editor ----
const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 };
const MIN_CROP_PX = 48; // smallest crop box on screen, in CSS pixels
let cropState = null;   // { rotation, crop } while the editor is open
let cropDrag = null;
let cropReturnFocus = null;

async function openCropEditor() {
  if (!sourceImage) {
    // e.g. a picture reopened from history: edit the stored copy
    if (!elements.previewImg.getAttribute('src')) return;
    try {
      sourceImage = await loadImage(elements.previewImg.src);
      imageEdit = { rotation: 0, crop: null };
    } catch (_) {
      showToast('This image cannot be edited.', { type: 'error' });
      return;
    }
  }
  cropState = { rotation: imageEdit.rotation, crop: { ...(imageEdit.crop || FULL_CROP) } };
  cropReturnFocus = document.activeElement;
  elements.cropOverlay.classList.add('open');
  drawCropEditor();
  elements.cropBox.focus();
}

function closeCropEditor(apply) {
  if (apply && cropState) {
    const c = cropState.crop;
    const isFull = c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.999 && c.h >= 0.999;
    imageEdit = { rotation: cropState.rotation, crop: isFull ? null : c };
    renderSelection();
  }
  cropState = null;
  cropDrag = null;
  elements.cropOverlay.classList.remove('open');
  if (cropReturnFocus && document.contains(cropReturnFocus)) cropReturnFocus.focus();
  cropReturnFocus = null;
}

// Render the rotated image to fit the stage, then place the crop box over it
function drawCropEditor() {
  if (!cropState) return;
  const stage = elements.cropStage;
  const styles = getComputedStyle(stage);
  const availW = stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const availH = stage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
  const rs = rotatedSize(sourceImage, cropState.rotation);
  const fit = Math.min(availW / rs.width, availH / rs.height);
  const cssW = Math.max(1, Math.floor(rs.width * fit));
  const cssH = Math.max(1, Math.floor(rs.height * fit));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const rendered = renderImage(sourceImage, { rotation: cropState.rotation }, Math.min(1, fit * dpr));
  const canvas = elements.cropCanvas;
  canvas.width = rendered.width;
  canvas.height = rendered.height;
  canvas.getContext('2d').drawImage(rendered, 0, 0);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  positionCropBox();
}

function positionCropBox() {
  const { crop } = cropState;
  const box = elements.cropBox.style;
  box.left = (crop.x * 100) + '%';
  box.top = (crop.y * 100) + '%';
  box.width = (crop.w * 100) + '%';
  box.height = (crop.h * 100) + '%';
}

function resetCrop() {
  cropState = { rotation: 0, crop: { ...FULL_CROP } };
  drawCropEditor();
}

// Rotate by +/-90 degrees and carry the crop box along with the picture
function rotateCrop(delta) {
  const { x, y, w, h } = cropState.crop;
  cropState.crop = delta > 0
    ? { x: 1 - (y + h), y: x, w: h, h: w }
    : { x: y, y: 1 - (x + w), w: h, h: w };
  cropState.rotation = (cropState.rotation + delta + 360) % 360;
  drawCropEditor();
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Move edges of the crop box, keeping it inside the image and above a minimum size
function setCropEdges(start, handle, dx, dy) {
  const rect = elements.cropCanvas.getBoundingClientRect();
  const minW = Math.min(1, MIN_CROP_PX / rect.width);
  const minH = Math.min(1, MIN_CROP_PX / rect.height);
  let left = start.x, top = start.y, right = start.x + start.w, bottom = start.y + start.h;

  if (handle === 'move') {
    left = clamp(start.x + dx, 0, 1 - start.w);
    top = clamp(start.y + dy, 0, 1 - start.h);
    right = left + start.w;
    bottom = top + start.h;
  } else {
    if (handle.includes('w')) left = clamp(left + dx, 0, right - minW);
    if (handle.includes('e')) right = clamp(right + dx, left + minW, 1);
    if (handle.includes('n')) top = clamp(top + dy, 0, bottom - minH);
    if (handle.includes('s')) bottom = clamp(bottom + dy, top + minH, 1);
  }
  cropState.crop = { x: left, y: top, w: right - left, h: bottom - top };
  positionCropBox();
}

function startCropDrag(e) {
  if (!cropState || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  const handleEl = e.target.closest('.crop-handle');
  cropDrag = {
    id: e.pointerId,
    handle: handleEl ? handleEl.dataset.handle : 'move',
    startX: e.clientX,
    startY: e.clientY,
    start: { ...cropState.crop }
  };
  elements.cropBox.setPointerCapture(e.pointerId);
  elements.cropBox.focus();
}

function moveCropDrag(e) {
  if (!cropDrag || e.pointerId !== cropDrag.id) return;
  const rect = elements.cropCanvas.getBoundingClientRect();
  setCropEdges(cropDrag.start, cropDrag.handle,
    (e.clientX - cropDrag.startX) / rect.width,
    (e.clientY - cropDrag.startY) / rect.height);
}

function endCropDrag(e) {
  if (cropDrag && e.pointerId === cropDrag.id) cropDrag = null;
}

// Arrow keys move the crop box; Shift + arrows resize it from the bottom-right corner
function handleCropBoxKeydown(e) {
  const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!step || !cropState) return;
  e.preventDefault();
  const amount = 0.02;
  setCropEdges({ ...cropState.crop }, e.shiftKey ? 'se' : 'move', step[0] * amount, step[1] * amount);
}

function handleCropOverlayKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeCropEditor(false);
    return;
  }
  trapFocus(elements.cropOverlay, e);
}

// Paste an image from the clipboard (desktop)
function handlePaste(e) {
  // Not while a dialog is covering the page
  if (elements.cropOverlay.classList.contains('open') ||
      elements.consentModal.style.display === 'flex' ||
      elements.settingsModal.style.display === 'flex' ||
      elements.cameraOverlay.style.display === 'flex') return;

  const items = [...(e.clipboardData?.items || [])];
  const item = items.find(i => i.kind === 'file' && i.type.startsWith('image/'));
  const file = item?.getAsFile();
  if (!file) return; // plain text paste: leave it alone
  e.preventDefault();
  processFile(file).then(ok => { if (ok) showToast('Image pasted!'); });
}

// Pick up an image shared from another app (see handleShareTarget in service-worker.js)
async function receiveSharedImage() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('shared')) return;
  params.delete('shared');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);

  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('mal-translate-share');
    const key = new URL('shared-image', window.location.href).href;
    const response = await cache.match(key);
    if (!response) {
      showToast("Couldn't open the shared image. Try sharing it again.", { type: 'error' });
      return;
    }
    const blob = await response.blob();
    await cache.delete(key);
    const file = new File([blob], 'shared-image', { type: blob.type || 'image/jpeg' });
    if (await processFile(file)) showToast('Shared image ready to translate.');
  } catch (err) {
    console.error('Could not load shared image:', err);
    showToast("Couldn't open the shared image. Try sharing it again.", { type: 'error' });
  }
}

// Open Camera Stream
async function openCamera() {
  try {
    elements.cameraOverlay.style.display = 'flex';
    
    // Request back camera specifically (facingMode: environment)
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        // Ask for as much resolution as the camera has; small text needs it
        width: { ideal: 3840 },
        height: { ideal: 2160 }
      },
      audio: false
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API unavailable (requires HTTPS or localhost)');
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // The user may have closed the overlay while the permission prompt was open
    if (elements.cameraOverlay.style.display === 'none') {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    activeStream = stream;
    elements.cameraVideo.srcObject = activeStream;
  } catch (err) {
    console.error('Camera access error:', err);
    showToast('Failed to access camera. Check permissions.', { type: 'error' });
    closeCamera();
  }
}

// Close Camera Stream
function closeCamera() {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
  elements.cameraVideo.srcObject = null;
  elements.cameraOverlay.style.display = 'none';
}

// Take a photo with the in-app camera
let isCapturing = false;
async function captureFrame() {
  if (!activeStream || isCapturing) return;
  if (!elements.cameraVideo.videoWidth || !elements.cameraVideo.videoHeight) {
    showToast('Camera is still starting, please try again.', { type: 'info' });
    return;
  }

  isCapturing = true;
  try {
    // Prefer a real still photo (full sensor resolution); fall back to grabbing a video frame
    let blob = null;
    const track = activeStream.getVideoTracks()[0];
    if ('ImageCapture' in window && track) {
      try {
        blob = await new ImageCapture(track).takePhoto();
      } catch (e) {
        console.warn('takePhoto failed, using a video frame instead:', e);
      }
    }
    if (!blob) blob = await grabVideoFrame();
    if (!blob) throw new Error('Could not capture an image');

    closeCamera();
    // Same path as uploads: downscale, compress, preview
    if (await processFile(new File([blob], 'camera.jpg', { type: blob.type || 'image/jpeg' }))) {
      showToast('Image captured successfully!');
    }
  } catch (err) {
    console.error('Capture error:', err);
    showToast('Failed to capture the photo. Please try again.', { type: 'error' });
  } finally {
    isCapturing = false;
  }
}

function grabVideoFrame() {
  const canvas = document.createElement('canvas');
  canvas.width = elements.cameraVideo.videoWidth;
  canvas.height = elements.cameraVideo.videoHeight;
  canvas.getContext('2d').drawImage(elements.cameraVideo, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

// Run OCR and Translation via Gemini API
async function runTranslation() {
  if (!API_KEY) {
    showToast('Please configure your Gemini API Key first.', { type: 'error' });
    openSettings();
    return;
  }

  if (!selectedFileBase64) {
    showToast('Please capture or upload an image.', { type: 'error' });
    return;
  }

  if (!navigator.onLine) {
    showToast("You're offline. Connect to the internet and try again.", { type: 'error' });
    return;
  }

  // Set Loading UI
  setLoadingState(true);

  // System Instruction / Prompt for OCR & Translation
  const promptText = `
    Analyze this image and perform two tasks:
    1. Extract all Malayalam text present in the image (OCR). Maintain the formatting, layout and spelling.
    2. Translate the extracted Malayalam text into clear, contextually accurate English.

    Put the extracted Malayalam text in "ocr" and the English translation in "translation".
  `;

  const parts = [
    { text: promptText },
    {
      inlineData: {
        mimeType: selectedFileMime,
        data: selectedFileBase64
      }
    }
  ];
  const schema = {
    type: "OBJECT",
    properties: {
      ocr: { type: "STRING", description: "Malayalam text extracted from the image, preserving layout and spelling" },
      translation: { type: "STRING", description: "Clear, contextually accurate English translation of the extracted text" }
    },
    required: ["ocr", "translation"],
    propertyOrdering: ["ocr", "translation"]
  };

  try {
    const data = await callGemini(parts, schema);

    if (!data || (!data.ocr && !data.translation)) {
      throw new Error('Failed to parse text or translation.');
    }
    data.ocr = String(data.ocr ?? '');
    data.translation = String(data.translation ?? '');

    // Update UI Results
    elements.malTextarea.value = data.ocr;
    elements.engTextarea.value = data.translation;
    elements.resultsSection.style.display = 'flex';
    
    // Auto-resize textareas to fit content
    adjustTextareaHeight(elements.malTextarea);
    adjustTextareaHeight(elements.engTextarea);
    
    // Auto Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showToast('Translation completed!');

    // Save to History (a storage problem must never turn a successful translation into an error)
    saveToHistory(data.ocr, data.translation, elements.previewImg.src)
      .catch(e => console.error('Unable to save history:', e));
  } catch (err) {
    console.error('Translation error:', err);
    showToast(`Error: ${err.message || 'Something went wrong'}`, { type: 'error' });
  } finally {
    setLoadingState(false);
  }
}

// Send a generateContent request and return the structured JSON that matches `schema`
async function callGemini(parts, schema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(CURRENT_MODEL)}:generateContent`;
  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      // Structured output: Gemini returns raw JSON matching this schema, no fences or filler
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY
      },
      body: JSON.stringify(requestBody)
    });
  } catch (_) {
    // fetch only rejects when the request never got a response (offline, DNS, blocked)
    throw new Error(navigator.onLine
      ? "Couldn't reach Gemini. Check your connection or any ad/content blocker and try again."
      : "You're offline. Connect to the internet and try again.");
  }

  if (!response.ok) {
    let message = `API request failed (HTTP ${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData.error?.message) message = errorData.error.message;
    } catch (_) { /* non-JSON error body */ }
    throw new Error(message);
  }

  const result = await response.json();

  const candidate = result.candidates?.[0];
  const textResponse = (candidate?.content?.parts || [])
    .filter(part => typeof part.text === 'string' && !part.thought)
    .map(part => part.text)
    .join('')
    .trim();
  if (!textResponse) {
    const reason = candidate?.finishReason || result.promptFeedback?.blockReason;
    throw new Error(reason ? `No content returned from Gemini (${reason}).` : 'No content returned from Gemini.');
  }

  try {
    return JSON.parse(textResponse);
  } catch (_) {
    throw new Error('Gemini returned a response that could not be parsed.');
  }
}

// Translate the (possibly hand-corrected) Malayalam text again, without re-sending the image
async function runRetranslation() {
  const malayalam = elements.malTextarea.value.trim();
  if (!malayalam) {
    showToast('There is no Malayalam text to translate.', { type: 'error' });
    return;
  }
  if (!API_KEY) {
    showToast('Please configure your Gemini API Key first.', { type: 'error' });
    openSettings();
    return;
  }
  if (!navigator.onLine) {
    showToast("You're offline. Connect to the internet and try again.", { type: 'error' });
    return;
  }

  const promptText = `
    Translate the following Malayalam text into clear, contextually accurate English.
    The text may have been corrected by hand after OCR; translate it exactly as given.
    Put the English translation in "translation".

    Malayalam text:
    ${malayalam}
  `;
  const schema = {
    type: "OBJECT",
    properties: {
      translation: { type: "STRING", description: "Clear, contextually accurate English translation of the given Malayalam text" }
    },
    required: ["translation"]
  };

  setRetranslateLoading(true);
  try {
    const data = await callGemini([{ text: promptText }], schema);
    const translation = String(data?.translation ?? '');
    if (!translation) throw new Error('Failed to parse translation.');

    elements.engTextarea.value = translation;
    adjustTextareaHeight(elements.engTextarea);
    showToast('Re-translated edited text!');

    // Keep the history record this text came from in sync with the correction
    updateCurrentHistoryRecord(elements.malTextarea.value, translation)
      .catch(e => console.error('Unable to update history:', e));
  } catch (err) {
    console.error('Re-translation error:', err);
    showToast(`Error: ${err.message || 'Something went wrong'}`, { type: 'error' });
  } finally {
    setRetranslateLoading(false);
  }
}

function setRetranslateLoading(isLoading) {
  elements.retranslateBtn.disabled = isLoading;
  elements.retranslateBtn.setAttribute('aria-busy', String(isLoading));
  elements.retranslateBtnText.textContent = isLoading ? 'Translating…' : 'Re-translate';
}

async function updateCurrentHistoryRecord(ocrText, translationText) {
  await historyReady;
  const record = currentHistoryId && history.find(h => h.id === currentHistoryId);
  if (!record) return;
  record.ocr = ocrText;
  record.translation = translationText;
  const saved = await persistHistory();
  loadHistory();
  if (!saved) showToast("Re-translated, but history couldn't be updated.", { type: 'error' });
}

// Toggle Loading Spinner
function setLoadingState(isLoading) {
  if (isLoading) {
    elements.translateBtn.disabled = true;
    elements.translateSpinner.style.display = 'block';
    elements.translateBtnText.textContent = 'Processing OCR & Translating...';
  } else {
    elements.translateBtn.disabled = false;
    elements.translateSpinner.style.display = 'none';
    elements.translateBtnText.textContent = 'Extract & Translate';
  }
}

// Save Translation Record to Local History
async function saveToHistory(ocrText, translationText, imageSrc) {
  await historyReady; // don't let the startup load overwrite this record
  const record = {
    id: Date.now().toString(),
    date: new Date().toISOString(), // formatted at render time
    ocr: ocrText,
    translation: translationText,
    image: imageSrc
  };

  history.unshift(record); // Add to beginning
  currentHistoryId = record.id;
  if (history.length > HISTORY_LIMIT) {
    history.length = HISTORY_LIMIT;
  }

  const saved = await persistHistory();
  loadHistory();
  if (!saved) {
    showToast("Translated, but this record couldn't be saved to history.", { type: 'error' });
    return;
  }
  requestPersistentStorage();
}

// Open the IndexedDB history store and move any localStorage history into it
async function initHistoryStore() {
  try {
    historyDB = await openHistoryDB();
    const stored = await idbRequest('readonly', store => store.get(HISTORY_KEY));
    if (Array.isArray(stored)) {
      history = stored;
    } else if (history.length) {
      await idbRequest('readwrite', store => store.put(history, HISTORY_KEY));
    }
    localStorage.removeItem(HISTORY_KEY); // frees ~MBs of localStorage once migrated
  } catch (e) {
    console.warn('IndexedDB unavailable, keeping history in localStorage:', e);
    historyDB = null;
  }
}

function openHistoryDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB not supported'));
    const req = indexedDB.open('maltranslate', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function idbRequest(mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = historyDB.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Save history. Resolves to true on success, false if it couldn't be stored.
async function persistHistory() {
  await historyReady;

  if (historyDB) {
    try {
      await idbRequest('readwrite', store => store.put(history, HISTORY_KEY));
      return true;
    } catch (e) {
      console.error('Unable to save history to IndexedDB:', e);
      return false;
    }
  }

  // localStorage fallback: drop the oldest records if storage is full
  while (true) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      return true;
    } catch (e) {
      if (history.length > 1) {
        history.pop();
      } else if (history.length === 1 && history[0].image) {
        history[0].image = ''; // keep the text even if the image doesn't fit
      } else {
        console.error('Unable to save history:', e);
        return false;
      }
    }
  }
}

// Ask the browser not to clear saved data, and on iOS suggest the Home Screen,
// since Safari clears data of sites that aren't installed after weeks without use.
let persistenceRequested = false;
async function requestPersistentStorage() {
  if (persistenceRequested) return;
  persistenceRequested = true;

  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch (_) { /* not supported */ }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (!isIOS || installed) return;

  try {
    if (localStorage.getItem('home_screen_tip_shown')) return;
    localStorage.setItem('home_screen_tip_shown', '1');
  } catch (_) { return; }

  // Wait for the "Translation completed!" toast to finish first
  setTimeout(() => {
    showToast('Tip: tap Share → Add to Home Screen so Safari keeps your history and API key.', {
      type: 'info',
      actionLabel: 'Got it',
      persistent: true
    });
  }, 3200);
}

// Load and Display History List
function loadHistory() {
  elements.historyList.innerHTML = '';
  
  if (history.length === 0) {
    elements.historyList.innerHTML = '<div class="empty-history">No translation history yet.</div>';
    return;
  }

  history.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    itemEl.innerHTML = `
      <button type="button" class="history-text-wrapper" data-id="${escapeHTML(item.id)}">
        <span class="history-item-eng">${escapeHTML(item.translation)}</span>
        <span class="history-item-mal" lang="ml">${escapeHTML(item.ocr)}</span>
        <span class="history-item-date">${escapeHTML(formatHistoryDate(item.date))}</span>
      </button>
      <div class="history-actions">
        <button type="button" class="btn-delete-history" data-id="${escapeHTML(item.id)}" title="Delete record" aria-label="Delete record">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
        </button>
      </div>
    `;
    elements.historyList.appendChild(itemEl);
  });
}

// Older records stored a pre-formatted string; newer ones store an ISO timestamp
function formatHistoryDate(date) {
  const d = new Date(date);
  if (!date || isNaN(d)) return date || '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Load clicked history item into main view
function loadHistoryItem(id) {
  const item = history.find(h => h.id === id);
  if (!item) return;

  currentHistoryId = item.id;
  elements.malTextarea.value = item.ocr || '';
  elements.engTextarea.value = item.translation || '';

  // Set preview state (older/oversized records may have no stored image)
  if (item.image) {
    sourceImage = null; // decoded from the stored copy only if the user opens the crop editor
    imageEdit = { rotation: 0, crop: null };
    selectedFileBase64 = item.image.split(',')[1] || '';
    selectedFileMime = 'image/jpeg';
    showPreview(item.image);
  } else {
    clearPreview();
  }
  elements.resultsSection.style.display = 'flex';
  
  // Auto-resize textareas to fit content
  adjustTextareaHeight(elements.malTextarea);
  adjustTextareaHeight(elements.engTextarea);
  
  elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('Loaded translation from history!');
}

// Delete specific history record
function deleteHistoryItem(id) {
  if (id === currentHistoryId) currentHistoryId = null;
  history = history.filter(h => h.id !== id);
  persistHistory();
  loadHistory();
  showToast('Record deleted.');
}

// Toggle History panel view
let isHistoryCollapsed = false;
function toggleHistoryList() {
  isHistoryCollapsed = !isHistoryCollapsed;
  elements.historyHeader.setAttribute('aria-expanded', String(!isHistoryCollapsed));
  if (isHistoryCollapsed) {
    elements.historyList.style.display = 'none';
    elements.historyChevron.style.transform = 'rotate(-90deg)';
  } else {
    elements.historyList.style.display = 'flex';
    elements.historyChevron.style.transform = 'rotate(0deg)';
  }
}

// Copy Text to Clipboard
function copyToClipboard(text, successMsg) {
  if (!text) return;
  if (!navigator.clipboard) {
    showToast('Clipboard not available in this browser.', { type: 'error' });
    return;
  }
  navigator.clipboard.writeText(text)
    .then(() => showToast(successMsg))
    .catch(err => {
      console.error('Copy failed:', err);
      showToast('Failed to copy text.', { type: 'error' });
    });
}

// Share text through the system share sheet
async function shareText(text) {
  if (!text) {
    showToast('Nothing to share yet.', { type: 'info' });
    return;
  }
  try {
    await navigator.share({ title: 'MalTranslate', text });
  } catch (err) {
    if (err.name === 'AbortError') return; // user closed the share sheet
    console.error('Share failed:', err);
    showToast('Could not open the share menu. Use Copy instead.', { type: 'error' });
  }
}

// Toast System
let toastTimeout;
// type: 'success' (default), 'error' or 'info' sets the icon and border colour
function showToast(message, { type = 'success', actionLabel, onAction, persistent = false } = {}) {
  elements.toastText.textContent = message;
  elements.toast.classList.remove('toast-success', 'toast-error', 'toast-info');
  elements.toast.classList.add(`toast-${type}`);

  const oldAction = elements.toast.querySelector('.toast-action');
  if (oldAction) oldAction.remove();
  elements.toast.classList.toggle('has-action', !!actionLabel);

  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      elements.toast.classList.remove('show', 'has-action');
      onAction?.();
    });
    elements.toast.appendChild(btn);
  }

  elements.toast.classList.add('show');

  clearTimeout(toastTimeout);
  if (!persistent) {
    toastTimeout = setTimeout(() => {
      elements.toast.classList.remove('show', 'has-action');
    }, type === 'error' ? 5000 : 3000); // errors stay up longer so they can be read
  }
}

// HTML Escaping Utility
function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Auto-resize textareas to fit content
function adjustTextareaHeight(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// First-visit Privacy Policy / Terms consent
function hasAcceptedPolicies() {
  try {
    return localStorage.getItem('policies_accepted') === POLICY_VERSION;
  } catch (e) {
    return false;
  }
}

function checkConsent() {
  if (hasAcceptedPolicies()) return;

  elements.consentModal.style.display = 'flex';
  elements.consentCheckbox.checked = false;
  elements.consentAcceptBtn.disabled = true;

  elements.consentCheckbox.addEventListener('change', () => {
    elements.consentAcceptBtn.disabled = !elements.consentCheckbox.checked;
  });

  elements.consentAcceptBtn.addEventListener('click', () => {
    if (!elements.consentCheckbox.checked) return;
    try {
      localStorage.setItem('policies_accepted', POLICY_VERSION);
    } catch (e) {
      console.warn('Could not save consent:', e);
    }
    elements.consentModal.style.display = 'none';
  });
}

// Theme Management Functions
function readSavedTheme() {
  try {
    const t = localStorage.getItem('theme');
    return t === 'dark' || t === 'light' ? t : null;
  } catch (_) {
    return null;
  }
}

function currentTheme() {
  return SAVED_THEME || (systemDarkQuery.matches ? 'dark' : 'light');
}

function applyTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  updateThemeIcon(theme);
}

// An explicit choice is remembered and overrides the system setting from then on
function toggleTheme() {
  SAVED_THEME = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', SAVED_THEME); } catch (_) { /* storage unavailable */ }
  applyTheme(SAVED_THEME);
}

function updateThemeIcon(theme) {
  if (!elements.themeToggleBtn) return;
  if (theme === 'dark') {
    elements.themeToggleBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
    `;
    elements.themeToggleBtn.title = 'Switch to Light Mode';
  } else {
    elements.themeToggleBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>
    `;
    elements.themeToggleBtn.title = 'Switch to Dark Mode';
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);
