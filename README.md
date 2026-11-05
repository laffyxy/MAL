# MalTranslate
### Malayalam OCR & English Translator PWA

MalTranslate is a mobile-first Progressive Web App (PWA). It reads Malayalam text from images with OCR and translates it into clear, natural English. It runs entirely in the browser and uses the **Google Gemini API** with your own API key. There is no backend server.

---

## ✨ Features

### Capture
- **Upload & drag-and-drop**: Use any image file (PNG, JPG, WebP and more).
- **Camera**: On phones, the native camera app opens. On desktop, an in-app camera captures at full resolution.
- **Share into the app (Android)**: Once installed, MalTranslate appears in the system share sheet, so you can send a photo straight from the gallery or another app. (iOS does not support Web Share Target.)
- **Paste (desktop)**: Press Ctrl+V / Cmd+V to use an image from the clipboard.
- **Crop & rotate**: Trim a photo down to the text block and fix its orientation before sending. This also improves OCR. The crop box can be moved and resized from the keyboard.

### OCR & Translation
- **Accurate Malayalam OCR**: Extracts the text while keeping its layout, formatting and spelling.
- **Contextual English translation**: Produces natural English rather than a word-for-word rendering.
- **Structured output**: Gemini returns results through a JSON response schema, so responses are parsed reliably.
- **Edit & re-translate**: Fix any OCR mistakes in the Malayalam text, then press **Re-translate** to translate only the corrected text. The history entry is updated too.
- **Copy & share**: Copy either text, or send it to WhatsApp, Messages and other apps through the system share menu.
- **Clear error messages**: Tells you whether you're offline or Gemini can't be reached (for example, because of an ad blocker), and shows Gemini's own error message when a request fails.

### App
- **Minimal monochrome design**: A clean black-and-white interface with line icons, using Inter and Noto Sans Malayalam.
- **Light & dark themes**: Follows your system setting until you pick a theme. There is no white flash between pages in dark mode.
- **Translation history**: Keeps your 15 most recent translations in IndexedDB, where they can be reopened or deleted. The app requests persistent storage so the browser is less likely to clear it. Older history saved in localStorage is moved over automatically.
- **Installable & offline-ready**: Works on Android, iOS and desktop. App code is served network-first, so new versions reach users right away, with a cached copy used offline. Fonts are cached so Malayalam text still displays without a connection.
- **Info pages**: About, Privacy Policy and Terms of Use pages. You are asked to accept the Privacy Policy and Terms on your first visit.

---

## 🛠️ Built With

- **HTML5**: Semantic, accessible markup.
- **Vanilla CSS3**: Custom properties, light/dark themes and a responsive layout without frameworks.
- **Vanilla JavaScript (ES6+)**: UI, camera, cropping, IndexedDB history and API requests.
- **Google Gemini API**: Multimodal OCR and translation with structured JSON output.
- **Service Worker & Web App Manifest**: Offline caching, installation and the share target.

---

## 📁 Project Structure

```
├── index.html          # Main app
├── app.js              # App logic (capture, crop, Gemini calls, history)
├── style.css           # App styles
├── about.html          # About page
├── privacy.html        # Privacy Policy
├── terms.html          # Terms of Use
├── pages.css / pages.js# Shared styles & theme script for the info pages
├── service-worker.js   # Offline caching & share-target handling
├── manifest.json       # PWA manifest
├── icon.svg, icons/    # App icons (SVG + PNG, including maskable)
├── LICENSE
└── SECURITY.md
```

---

## 🚀 Getting Started

MalTranslate is a fully client-side static app, so it is simple to run locally.

### Prerequisites

- A **Gemini API key**. You can get one for free at [Google AI Studio](https://aistudio.google.com/).

### Running Locally

Serve the project folder with any static web server:

#### Python (Recommended)
```bash
python -m http.server 8000
```
*(On Windows, if `python` doesn't work, try `py -m http.server 8000`.)*

#### Node.js
```bash
npx http-server -p 8000
```

#### PHP
```bash
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

> The camera, service worker and installation only work on `localhost` or over HTTPS.

---

## ⚙️ Configuration

1. Click the **Settings** (gear) icon in the app header.
2. Enter your **Gemini API key**.
3. Select a **Gemini model**:
   - **Gemini 3.5 Flash** (Fast, recommended)
   - **Gemini 3.5 Pro** (Premium reasoning)
   - **Gemini 3.1 Pro** (High quality)
   - **Gemini 3.1 Flash-Lite** (Lightweight)
4. Click **Save Configuration**.

Your key and settings are stored only in your browser's local storage. Images and text go straight from your browser to Google's Gemini API, and the key is sent in a request header, never in the URL.

---

## 📱 Installation (PWA)

- **Android (Chrome)**: Accept the install prompt, or open the ⋮ menu and choose **Install app**.
- **iOS (Safari)**: Tap **Share**, then **Add to Home Screen**.
- **Desktop (Chrome/Edge)**: Click the install icon in the address bar.

---

## 🐞 Bug Reports

Bug reports are accepted only through [GitHub Issues](https://github.com/laffyxy/MAL/issues). Please never include your API key in an issue.

## 🔒 Security

Found a security vulnerability? Please report it privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## 📄 License

MalTranslate is released under the [MIT License](LICENSE).
