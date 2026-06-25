// State Management
let API_KEY = localStorage.getItem('gemini_api_key') || '';
let CURRENT_MODEL = localStorage.getItem('gemini_model') || 'gemini-3.5-flash';
let selectedFileBase64 = '';
let selectedFileMime = '';
let history = JSON.parse(localStorage.getItem('translation_history')) || [];
let activeStream = null;

// DOM Elements
const elements = {
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
  closeCameraBtn: document.getElementById('closeCameraBtn'),

  // Results
  resultsSection: document.getElementById('resultsSection'),
  malTextarea: document.getElementById('malTextarea'),
  engTextarea: document.getElementById('engTextarea'),
  copyMalBtn: document.getElementById('copyMalBtn'),
  copyEngBtn: document.getElementById('copyEngBtn'),
  speakBtn: document.getElementById('speakBtn'),

  // History
  historyHeader: document.getElementById('historyHeader'),
  historyList: document.getElementById('historyList'),
  historyChevron: document.getElementById('historyChevron'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  // Toast
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toastText')
};

// Initialize Application
function init() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('[Service Worker] Registered successfully:', reg.scope))
        .catch(err => console.error('[Service Worker] Registration failed:', err));
    });
  }

  checkApiKey();
  loadHistory();
  setupEventListeners();

  // Set initial settings inputs
  elements.apiKeyInput.value = API_KEY;
  elements.modelSelect.value = CURRENT_MODEL;
}

// Event Listeners
function setupEventListeners() {
  // Settings Modals
  elements.setupApiKeyBtn.addEventListener('click', openSettings);
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.closeModalBtn.addEventListener('click', closeSettings);
  elements.saveSettingsBtn.addEventListener('click', saveSettings);
  elements.toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);

  // File Upload
  elements.dropzone.addEventListener('click', () => elements.fileInput.click());
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
  elements.cameraBtn.addEventListener('click', openCamera);
  elements.closeCameraBtn.addEventListener('click', closeCamera);
  elements.shutterBtn.addEventListener('click', captureFrame);

  // Translate Action
  elements.translateBtn.addEventListener('click', runTranslation);

  // Results Actions
  elements.copyMalBtn.addEventListener('click', () => copyToClipboard(elements.malTextarea.value, 'Malayalam text copied!'));
  elements.copyEngBtn.addEventListener('click', () => copyToClipboard(elements.engTextarea.value, 'English translation copied!'));
  elements.speakBtn.addEventListener('click', speakTranslation);

  // History Actions
  elements.historyHeader.addEventListener('click', toggleHistoryList);
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
function openSettings() {
  elements.settingsModal.style.display = 'flex';
}

function closeSettings() {
  elements.settingsModal.style.display = 'none';
}

function toggleApiKeyVisibility() {
  const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
  elements.apiKeyInput.type = type;
  
  // Toggle icon
  elements.toggleApiKeyBtn.innerHTML = type === 'password' 
    ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.025 10.025 0 012.42-3.717m2.771-1.558A9.957 9.957 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`;
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
    showToast('Please upload an image file.');
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
    img.src = e.target.result;
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
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    elements.cameraVideo.srcObject = activeStream;
  } catch (err) {
    console.error('Camera access error:', err);
    showToast('Failed to access camera. Check permissions.');
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

// Capture frame from camera video
function captureFrame() {
  if (!activeStream) return;

  const canvas = document.createElement('canvas');
  canvas.width = elements.cameraVideo.videoWidth;
  canvas.height = elements.cameraVideo.videoHeight;
  
  const ctx = canvas.getContext('2d');
  // Mirror frame only if using front camera (we assume environment camera is not mirrored)
  ctx.drawImage(elements.cameraVideo, 0, 0, canvas.width, canvas.height);
  
  const dataURL = canvas.toDataURL('image/jpeg', 0.85);
  selectedFileBase64 = dataURL.split(',')[1];
  selectedFileMime = 'image/jpeg';
  
  // Show in Preview
  elements.previewImg.src = dataURL;
  elements.dropzone.style.display = 'none';
  elements.previewContainer.style.display = 'block';
  elements.translateBtn.disabled = false;
  
  closeCamera();
  showToast('Image captured successfully!');
}

// Run OCR and Translation via Gemini API
async function runTranslation() {
  if (!API_KEY) {
    showToast('Please configure your Gemini API Key first.');
    openSettings();
    return;
  }

  if (!selectedFileBase64) {
    showToast('Please capture or upload an image.');
    return;
  }

  // Set Loading UI
  setLoadingState(true);

  // Endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CURRENT_MODEL}:generateContent?key=${API_KEY}`;
  
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const result = await response.json();
    
    // Parse response
    let textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('No content returned from Gemini.');
    }

    // Clean markdown blocks if Gemini didn't obey raw JSON constraint
    textResponse = textResponse.trim();
    if (textResponse.startsWith('```json')) {
      textResponse = textResponse.substring(7, textResponse.length - 3).trim();
    } else if (textResponse.startsWith('```')) {
      textResponse = textResponse.substring(3, textResponse.length - 3).trim();
    }

    const data = JSON.parse(textResponse);
    
    if (!data.ocr && !data.translation) {
      throw new Error('Failed to parse text or translation.');
    }

    // Update UI Results
    elements.malTextarea.value = data.ocr || '';
    elements.engTextarea.value = data.translation || '';
    elements.resultsSection.style.display = 'flex';
    
    // Auto Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Save to History
    saveToHistory(data.ocr, data.translation, elements.previewImg.src);
    showToast('Translation completed!');
  } catch (err) {
    console.error('Translation error:', err);
    showToast(`Error: ${err.message || 'Something went wrong'}`);
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
function saveToHistory(ocrText, translationText, imageSrc) {
  const record = {
    id: Date.now().toString(),
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    ocr: ocrText,
    translation: translationText,
    image: imageSrc
  };

  history.unshift(record); // Add to beginning
  // Cap history at 15 items to avoid blowing localstorage limit
  if (history.length > 15) {
    history.pop();
  }

  localStorage.setItem('translation_history', JSON.stringify(history));
  loadHistory();
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
      <div class="history-text-wrapper" onclick="loadHistoryItem('${item.id}')">
        <div class="history-item-eng">${escapeHTML(item.translation)}</div>
        <div class="history-item-mal">${escapeHTML(item.ocr)}</div>
        <div class="history-item-date">${item.date}</div>
      </div>
      <div class="history-actions">
        <button class="btn-delete-history" onclick="deleteHistoryItem(event, '${item.id}')" title="Delete record">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
    elements.historyList.appendChild(itemEl);
  });
}

// Load clicked history item into main view
window.loadHistoryItem = function(id) {
  const item = history.find(h => h.id === id);
  if (!item) return;

  elements.malTextarea.value = item.ocr;
  elements.engTextarea.value = item.translation;
  elements.previewImg.src = item.image;
  
  // Set preview state
  selectedFileBase64 = item.image.split(',')[1] || '';
  selectedFileMime = 'image/jpeg';
  
  elements.dropzone.style.display = 'none';
  elements.previewContainer.style.display = 'block';
  elements.translateBtn.disabled = false;
  elements.resultsSection.style.display = 'flex';
  
  elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('Loaded translation from history!');
};

// Delete specific history record
window.deleteHistoryItem = function(event, id) {
  event.stopPropagation(); // Avoid triggering loadHistoryItem
  history = history.filter(h => h.id !== id);
  localStorage.setItem('translation_history', JSON.stringify(history));
  loadHistory();
  showToast('Record deleted.');
};

// Toggle History panel view
let isHistoryCollapsed = false;
function toggleHistoryList() {
  isHistoryCollapsed = !isHistoryCollapsed;
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
  navigator.clipboard.writeText(text)
    .then(() => showToast(successMsg))
    .catch(err => {
      console.error('Copy failed:', err);
      showToast('Failed to copy text.');
    });
}

// Speak English Translation (TTS)
function speakTranslation() {
  const text = elements.engTextarea.value;
  if (!text) return;

  // Stop any current speaking
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  
  // Highlight speaking state
  elements.speakBtn.style.color = 'var(--accent-secondary)';
  elements.speakBtn.style.borderColor = 'var(--accent-secondary)';
  
  utterance.onend = () => {
    elements.speakBtn.style.color = '';
    elements.speakBtn.style.borderColor = '';
  };

  utterance.onerror = () => {
    elements.speakBtn.style.color = '';
    elements.speakBtn.style.borderColor = '';
    showToast('Failed to speak translation.');
  };

  window.speechSynthesis.speak(utterance);
}

// Toast System
let toastTimeout;
function showToast(message) {
  elements.toastText.textContent = message;
  elements.toast.classList.add('show');
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// HTML Escaping Utility
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);
