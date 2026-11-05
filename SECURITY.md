# Security Policy

## Supported versions

Only the latest version of MalTranslate on the `main` branch (and the live site built from it) receives security fixes.

## Reporting a vulnerability

**Please do not report security vulnerabilities in public GitHub Issues.** Issues are public, so a report there would expose the problem to everyone before it is fixed.

Instead, report it privately through GitHub:

1. Go to the [Security tab](https://github.com/laffyxy/MAL/security) of this repository.
2. Click **Report a vulnerability** ([direct link](https://github.com/laffyxy/MAL/security/advisories/new)).
3. Describe the issue, how to reproduce it, and what an attacker could do with it.

You can expect an acknowledgement within 7 days. Once the issue is confirmed, a fix will be released as soon as practical and you'll be credited in the advisory if you'd like.

Ordinary bugs that aren't security issues should still go to [GitHub Issues](https://github.com/laffyxy/MAL/issues).

## Scope

MalTranslate runs entirely in the browser and has no backend. Examples of issues we want to hear about:

- Ways another site, script or file could read a user's stored Gemini API key, history or settings
- Cross-site scripting (XSS), for example through OCR or translation output, history entries or crafted images
- The API key being sent anywhere other than Google's Gemini API, or leaking into URLs or logs
- Service worker or caching behaviour that could serve tampered or another origin's content

Out of scope:

- Vulnerabilities in Google's Gemini API, Google Fonts, GitHub or the user's browser (please report those to the vendor)
- Attacks that require physical access to an unlocked device, or a malicious browser extension
- Inaccurate OCR or translation results (these are ordinary bugs)

## Protecting your API key

Never include your Gemini API key in a report, issue or screenshot. If you think your key has been exposed, delete it and create a new one in [Google AI Studio](https://aistudio.google.com/).
