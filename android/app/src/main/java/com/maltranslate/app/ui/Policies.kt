package com.maltranslate.app.ui

/** In-app copies of the Privacy Policy and Terms, adapted from the web pages for the Android app. */
data class PolicySection(val heading: String?, val paragraphs: List<String>)

data class PolicyDoc(val title: String, val updated: String, val sections: List<PolicySection>)

val PRIVACY_POLICY = PolicyDoc(
    title = "Privacy Policy",
    updated = "Last updated: November 5, 2026",
    sections = listOf(
        PolicySection(null, listOf(
            "MalTranslate is an on-device app. It has no backend server, no user accounts, no analytics and no advertising. This policy explains what happens to your data when you use it.",
            "In short: your images go to Google's Gemini API to be read and translated. Everything else (your API key, settings and history) stays on your device."
        )),
        PolicySection("1. Data stored on your device", listOf(
            "The following is saved in the app's private storage and is never sent to us:",
            "• Your Gemini API key and your chosen model.",
            "• Translation history: up to 15 recent results, including a compressed copy of each image, the extracted Malayalam text and the English translation.",
            "• Theme preference (light or dark).",
            "• Policy acceptance: a note that you agreed to this Privacy Policy and the Terms of Use, and which version, so you aren't asked again every time."
        )),
        PolicySection("2. Data sent to Google", listOf(
            "When you tap Extract & Translate, the image you selected and your API key are sent directly from your device to the Google Gemini API over HTTPS. Google processes the request and returns the text.",
            "That processing is governed by Google's terms, not ours. Depending on your account and region, Google may keep or use API inputs to improve its services, especially on the free tier. Please review the Gemini API Additional Terms and Google Privacy Policy, and avoid uploading images with sensitive personal information."
        )),
        PolicySection("3. Camera and photos", listOf(
            "The camera button opens your phone's own camera app to take a single photo. The photo picker gives the app access only to the picture you choose. Video is never recorded or uploaded."
        )),
        PolicySection("4. What we don't do", listOf(
            "• We don't collect, store or see your images, text or API key.",
            "• We don't use trackers or analytics.",
            "• We don't sell or share any data."
        )),
        PolicySection("5. Your control", listOf(
            "You can delete individual history items in the app. Clearing the app's storage in Android Settings, or uninstalling the app, removes everything MalTranslate has saved."
        )),
        PolicySection("6. Children", listOf(
            "MalTranslate isn't directed at children under 13. Google's own age requirements apply to obtaining a Gemini API key."
        )),
        PolicySection("7. Changes", listOf(
            "If this policy changes, the updated version will be included in an app update with a new date."
        )),
        PolicySection("8. Contact", listOf(
            "Questions about privacy? Open an issue on GitHub. Bug reports are accepted only through GitHub Issues."
        )),
    )
)

val TERMS_OF_USE = PolicyDoc(
    title = "Terms of Use",
    updated = "Last updated: November 5, 2026",
    sections = listOf(
        PolicySection(null, listOf(
            "By using MalTranslate (the \"App\") you agree to these terms. If you don't agree, please don't use the App."
        )),
        PolicySection("1. The service", listOf(
            "MalTranslate is a free tool that uses the Google Gemini API to read Malayalam text from images and translate it into English. It runs on your device and needs your own Gemini API key."
        )),
        PolicySection("2. Your API key and Google's terms", listOf(
            "You're responsible for your Gemini API key, how it's used, and any charges or quota limits on your Google account. Your use of Gemini through the App is also subject to the Gemini API Additional Terms and Google's Generative AI Prohibited Use Policy."
        )),
        PolicySection("3. Acceptable use", listOf(
            "Please don't use the App to:",
            "• upload content you don't have the right to use, or that infringes someone else's rights;",
            "• process other people's personal or sensitive information without their consent;",
            "• break any law or Google's usage policies."
        )),
        PolicySection("4. Accuracy disclaimer", listOf(
            "OCR and translations are produced by an AI model and can be wrong, incomplete or misleading. Handwriting, low-quality photos and unusual fonts make errors more likely. Don't rely on the App for legal, medical, financial, safety-critical or official purposes. Have important text checked by a qualified human translator."
        )),
        PolicySection("5. Your content", listOf(
            "You keep all rights to the images you upload and the text you get back. We don't receive or store any of it. See the Privacy Policy."
        )),
        PolicySection("6. No warranty", listOf(
            "The App is provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including fitness for a particular purpose. It may change, break or become unavailable at any time, for example if Google changes or retires a model."
        )),
        PolicySection("7. Limitation of liability", listOf(
            "To the fullest extent allowed by law, the authors of MalTranslate are not liable for any damages arising from your use of the App, including losses caused by inaccurate translations, lost history, or charges on your API account."
        )),
        PolicySection("8. Third-party trademarks", listOf(
            "Google and Gemini are trademarks of Google LLC. MalTranslate is an independent project and is not affiliated with or endorsed by Google."
        )),
        PolicySection("9. Changes", listOf(
            "These terms may be updated from time to time. The latest version will be included in the app, and continued use of the App means you accept it."
        )),
        PolicySection("10. Contact", listOf(
            "Questions? Open an issue on GitHub. Bug reports are accepted only through GitHub Issues."
        )),
    )
)
