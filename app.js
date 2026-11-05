// State Management
let API_KEY = localStorage.getItem('gemini_api_key') || '';
let CURRENT_MODEL = localStorage.getItem('gemini_model') || 'gemini-3.5-flash';
let selectedFileBase64 = '';
let selectedFileMime = '';
let history = [];
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
let CURRENT_THEME = localStorage.getItem('theme') || 'light';

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
  copyEngBtn: document.getElementById('copyEngBtn'),

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

  // Apply default or stored theme
  applyTheme(CURRENT_THEME);

  checkConsent();
  checkApiKey();
  loadHistory();
  historyReady = initHistoryStore().then(loadHistory);
  setupEventListeners();

  // Set initial settings inputs
  elements.apiKeyInput.value = API_KEY;
  elements.modelSelect.value = CURRENT_MODEL;
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
  elements.copyEngBtn.addEventListener('click', () => copyToClipboard(elements.engTextarea.value, 'English translation copied!'));

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
  if (e.key !== 'Tab') return;
  const focusable = [...elements.settingsModal.querySelectorAll(
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
    ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`;
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

// Process selected file (compress and display preview)
function processFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file.', { type: 'error' });
    return;
  }

  selectedFileMime = file.type;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Compress image slightly if it is massive to optimize network request
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // JPEG has no alpha channel: paint white first so transparent PNGs don't turn black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get base64 string
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      selectedFileBase64 = compressedBase64.split(',')[1];
      selectedFileMime = 'image/jpeg';
      
      // Update UI
      elements.previewImg.src = compressedBase64;
      elements.dropzone.style.display = 'none';
      elements.previewContainer.style.display = 'block';
      elements.translateBtn.disabled = false;
    };
    img.onerror = function() {
      showToast('Could not read this image. Try a different file.', { type: 'error' });
    };
    img.src = e.target.result;
  };
  reader.onerror = function() {
    showToast('Failed to read the selected file.', { type: 'error' });
  };
  reader.readAsDataURL(file);
}

// Clear Image Preview
function clearPreview() {
  selectedFileBase64 = '';
  selectedFileMime = '';
  elements.previewImg.src = '';
  elements.previewContainer.style.display = 'none';
  elements.dropzone.style.display = 'flex';
  elements.translateBtn.disabled = true;
  elements.fileInput.value = '';
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
    processFile(new File([blob], 'camera.jpg', { type: blob.type || 'image/jpeg' }));
    showToast('Image captured successfully!');
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

  // Endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(CURRENT_MODEL)}:generateContent`;
  
  // System Instruction / Prompt for OCR & Translation
  const promptText = `
    Analyze this image and perform two tasks:
    1. Extract all Malayalam text present in the image (OCR). Maintain the formatting, layout and spelling.
    2. Translate the extracted Malayalam text into clear, contextually accurate English.
    
    You MUST output your response ONLY as a JSON object, conforming to the following structure:
    {
      "ocr": "Extracted Malayalam text here",
      "translation": "English translation here"
    }
    Do not wrap the output in markdown block code syntax or add conversational filler. Output only raw JSON.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: selectedFileMime,
              data: selectedFileBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
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
    
    // Parse response
    const candidate = result.candidates?.[0];
    let textResponse = (candidate?.content?.parts || [])
      .filter(part => typeof part.text === 'string' && !part.thought)
      .map(part => part.text)
      .join('')
      .trim();
    if (!textResponse) {
      const reason = candidate?.finishReason || result.promptFeedback?.blockReason;
      throw new Error(reason ? `No content returned from Gemini (${reason}).` : 'No content returned from Gemini.');
    }

    // Extract the JSON object even if Gemini wrapped it in markdown fences or extra text
    const firstBrace = textResponse.indexOf('{');
    const lastBrace = textResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      textResponse = textResponse.substring(firstBrace, lastBrace + 1);
    }

    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (_) {
      throw new Error('Gemini returned a response that could not be parsed.');
    }

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
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
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

  elements.malTextarea.value = item.ocr || '';
  elements.engTextarea.value = item.translation || '';

  // Set preview state (older/oversized records may have no stored image)
  if (item.image) {
    elements.previewImg.src = item.image;
    selectedFileBase64 = item.image.split(',')[1] || '';
    selectedFileMime = 'image/jpeg';
    elements.dropzone.style.display = 'none';
    elements.previewContainer.style.display = 'block';
    elements.translateBtn.disabled = !selectedFileBase64;
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
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  CURRENT_THEME = theme;
  localStorage.setItem('theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const newTheme = CURRENT_THEME === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
}

function updateThemeIcon(theme) {
  if (!elements.themeToggleBtn) return;
  if (theme === 'dark') {
    elements.themeToggleBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="22" height="22">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    `;
    elements.themeToggleBtn.title = 'Switch to Light Mode';
  } else {
    elements.themeToggleBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="22" height="22">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    `;
    elements.themeToggleBtn.title = 'Switch to Dark Mode';
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);
