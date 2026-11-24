# MalTranslate
### Malayalam OCR & English Translator for the web and Android

MalTranslate reads Malayalam text from images with OCR and translates it into clear, natural English. It uses the **Google Gemini API** with your own API key, and there is no backend server.

It comes in two forms:
- **Web app (PWA)**: a mobile-first Progressive Web App that runs entirely in the browser.
- **Android app**: a native Kotlin + Jetpack Compose app with the same features. It runs fully on the phone and needs no hosting. Download the APK from [Releases](https://github.com/laffyxy/MAL/releases/latest).

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

**Web app**
- **HTML5**: Semantic, accessible markup.
- **Vanilla CSS3**: Custom properties, light/dark themes and a responsive layout without frameworks.
- **Vanilla JavaScript (ES6+)**: UI, camera, cropping, IndexedDB history and API requests.
- **Google Gemini API**: Multimodal OCR and translation with structured JSON output.
- **Service Worker & Web App Manifest**: Offline caching, installation and the share target.

**Android app**
- **Kotlin & Jetpack Compose** (Material 3), with no third-party libraries beyond AndroidX.
- **Gemini REST API** called directly with `HttpURLConnection` and `org.json`.
- **Android Gradle Plugin 9.5 / Gradle 9.6**, minSdk 26 (Android 8.0), targetSdk 36.
- **GitHub Actions** builds signed release APKs and AABs.

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
├── android/            # Native Android app (Kotlin + Jetpack Compose)
│   └── app/src/main/java/com/maltranslate/app/
│       ├── MainActivity.kt   # Photo picker, camera and share-sheet intake
│       ├── data/             # Gemini client, settings, history, image processing
│       └── ui/               # Compose screens, crop editor, dialogs, theme
├── .github/workflows/
│   └── android-release.yml   # Builds and publishes signed Android releases
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

## 🤖 Android App

### Install
1. Download `MalTranslate-x.y.z.apk` from the [latest release](https://github.com/laffyxy/MAL/releases/latest).
2. Open it on your phone and allow installs from that source when Android asks.
3. Enter your Gemini API key under **Settings** in the app.

Requires Android 8.0 or newer. Each new release installs over the previous one and keeps your settings and history.

### How it differs from the web app
- **Camera**: Opens the phone's own camera app, so the app needs no camera permission.
- **Photos**: Uses the system photo picker, which gives the app access only to the picture you choose.
- **Share into the app**: MalTranslate appears in the share sheet for images.
- **Storage**: Your API key, settings and the 15 most recent translations are kept in the app's private storage. Uninstalling the app removes them.
- **Fonts**: Inter and Inter Tight are bundled (SIL Open Font License, see `android/FONTS-LICENSE-OFL.txt`). Malayalam text uses the system's Noto Sans Malayalam.

### Build it yourself
Open the `android/` folder in Android Studio and choose **Run**, or build from the command line:

```bash
cd android
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
```

On Windows, use `gradlew.bat`. Use Android Studio's bundled JDK, or any JDK that Gradle supports.

To build a signed release locally, create `android/keystore.properties`. It is git-ignored, so never commit it or the keystore:

```properties
storeFile=C:/path/to/maltranslate.jks
storePassword=...
keyAlias=maltranslate
keyPassword=...
```

Then run `./gradlew assembleRelease`. Without this file, release builds are unsigned.

### Publishing a release
Releases are built by [`android-release.yml`](.github/workflows/android-release.yml). Push a version tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The workflow builds a signed APK and AAB and publishes them as a GitHub Release. The tag sets the app version: `v1.2.3` becomes versionName `1.2.3` and versionCode `10203`, so minor and patch numbers must stay below 100. Running the workflow by hand from the **Actions** tab builds the same files as a downloadable artifact without creating a release.

It needs these repository secrets, under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | The `.jks` keystore, base64-encoded |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias |
| `KEY_PASSWORD` | Key password |

> Keep a backup of the keystore and its password. Every update must be signed with the same key, and a lost key cannot be recovered.

---

## 🐞 Bug Reports

Bug reports are accepted only through [GitHub Issues](https://github.com/laffyxy/MAL/issues). Please never include your API key in an issue.

## 🔒 Security

Found a security vulnerability? Please report it privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## 📄 License

MalTranslate is released under the [MIT License](LICENSE).
