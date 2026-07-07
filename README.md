# MalTranslate 🌟
### Malayalam OCR & English Translator PWA

MalTranslate is a premium, mobile-optimized Progressive Web App (PWA) that performs instant Optical Character Recognition (OCR) on Malayalam text from images and translates it into contextually accurate English. It is powered by the **Google Gemini API** directly in the browser.

---

## ✨ Features

- **High-Accuracy Malayalam OCR**: Extract Malayalam text from images, maintaining layout, formatting, and spelling.
- **Contextual English Translation**: Translate the extracted Malayalam text into clear and context-appropriate English using state-of-the-art Gemini models.
- **Dual Capture Methods**:
  - **File Upload & Drag-and-Drop**: Easily upload image files (supports PNG, JPG, JPEG).
  - **Camera Integration**: Capture photos directly from your device's camera (with automatic back-camera preference on mobile devices).
- **Modern & Responsive UI**: Mobile-first design featuring custom HSL colors, dark/light mode themes, and glowing ambient background effects.
- **Translation History**: Automatically caches up to 15 recent translation records locally in the browser so you can reload or delete them later.
- **Offline-Ready (PWA)**: Can be installed on mobile (iOS/Android) and desktop platforms. Static assets are served offline using service worker caching (stale-while-revalidate strategy).
- **Customizable Gemini Settings**: Fully configurable settings panel to update your Gemini API key and select preferred models.

---

## 🛠️ Built With

- **HTML5 & Semantic Elements** - Structured for access and SEO.
- **Vanilla CSS3** - Custom properties, theme styles, ambient animation effects, and responsive layout without heavy frameworks.
- **Vanilla JavaScript (ES6+)** - Reactive UI handling, DOM manipulation, camera media interface, and API requests.
- **Google Gemini API** - Performs multimodal OCR & translation tasks.
- **PWA Service Worker** - Native offline asset caching and app installation support.

---

## 🚀 Getting Started

Since MalTranslate is a fully client-side static application, running it locally is extremely simple.

### Prerequisites

- You need a **Gemini API Key**. Get one for free at [Google AI Studio](https://aistudio.google.com/).

### Running Locally

You can serve the static files using any simple web server. Open your terminal, navigate to the project directory, and use one of the following commands:

#### Method 1: Using Python (Recommended)
```bash
python -m http.server 8000
```
*(If on Windows and `python` doesn't work, try `py -m http.server 8000`)*

#### Method 2: Using Node.js (npx)
```bash
npx http-server -p 8000
```

#### Method 3: Using PHP
```bash
php -S localhost:8000
```

Once running, navigate to `http://localhost:8000` in your web browser.

---

## ⚙️ Configuration

1. Click the **Settings (Gear) Icon** in the top right corner of the app header.
2. Enter your **Gemini API Key**.
3. Select your preferred **Gemini Model**:
   - **Gemini 3.5 Flash** (Fast & Recommended)
   - **Gemini 3.5 Pro** (Premium reasoning and accuracy)
   - **Gemini 3.1 Pro** (High Quality)
   - **Gemini 3.1 Flash-Lite** (Lightweight & responsive)
4. Click **Save Configuration**. Your settings are securely saved to your browser's local storage.

---

## 📱 Installation (PWA)

MalTranslate can be installed on your device as a native-like app:

- **On Mobile (Chrome/Android)**: Tap the prompt to add the application to your home screen or click the three dots menu and select "Install app".
- **On Mobile (Safari/iOS)**: Tap the Share button in Safari, scroll down, and select "Add to Home Screen".
- **On Desktop (Chrome/Edge/Safari)**: Click the install icon in the address bar to add it to your applications.
