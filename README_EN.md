<p align="center">
  <img src="icon_15.png" width="128" alt="Cantonese Popup Dictionary Logo" />
</p>
<p align="center">
  <a href="README.md">繁體中文</a> | <strong>English</strong>
</p>

# Cantonese Popup Dictionary (粵語懸浮詞典)

A powerful and elegant Chrome / Edge browser extension that instantly displays Cantonese pronunciation (Jyutping / Yale) and comprehensive definitions on hover. Supports multi-engine text-to-speech, Wordbook management, Paragraph Translation, Full-page Ruby annotation, Cantonese definition translation, Spelling practice, and AI contextual Q&A.

![Demo - Hover Lookup](assets/screenshot_demo_hover.png)
![Demo - Double-click Translate](assets/screenshot_demo_translate.png)
![Demo - Dictionary Lookup](assets/screenshot_demo.png)
![Demo - AI Contextual Translation](assets/screenshot_ai_demo.png)
![Demo - Web Page Test](assets/promo_wenweipo.jpg)


## Key Features

- **Instant Hover Lookup**: Move your mouse over any Chinese character or term to instantly see Cantonese romanization and multilingual definitions.
- **Dual Romanization Systems**: Seamlessly toggle between **Jyutping** and **Yale** phonetic notations.
- **Deep Words.hk Integration**: Deeply enriched with Words.hk (粵典) high-quality colloquial definitions and example sentences, merged with CC-Canto for 230,000+ entries.
- **Cantonese Definition Translation**: Native colloquial definitions marked with `[粵]` support instant translation on badge click or full auto-translation (powered by Google / Bing / custom AI, supporting "Expand Below" or "In-place Replace").
- **Comprehensive Wordbook & Flashcards**:
  - Save looked-up words to your personal Wordbook with one click;
  - Custom folder categories, color labels, and markdown note editing;
  - Export to multiple formats (Anki deck package, CSV, TXT);
  - Integrated AI assistant for in-depth etymology, colloquial examples, and synonyms/antonyms.
- **Paragraph Translation**: Hold shortcut (default `Shift`) and hover over any paragraph for contextual, authentic Cantonese translation.
- **Full-page Ruby Annotation**: Annotate entire web pages with Jyutping/Yale phonetic guides, featuring smart polyphone switching and custom domain exclusion.
- **Cantonese Spelling Practice**: Built-in flashcard quiz module featuring randomized questions, initial/rhyme/tone scoring, and TTS audio repetition.
- **Click-to-Speak (TTS)**: Click any phonetics or highlighted term to hear authentic Cantonese pronunciation.
- **AI Contextual Translation**: Long-press any highlighted word or custom text selection for ~0.5s to get instant AI context-aware explanations.
- **5 UI Languages**: Full localized experience in Traditional Chinese (HK), Simplified Chinese, English, Japanese, and Korean.
- **8 Curated Themes**: Classic, Hong Kong Red, Deep Night, Ink Wash, Ocean, Warm Sun, Mint, and Frosted Glass.
- **Strict Style Isolation**: Robust CSS isolation and Shadow DOM compatibility to prevent host website CSS bleeding.


## Text-to-Speech (TTS) Engines

Supports 4 versatile TTS engines to suit different audio quality, offline, and custom key requirements:

| Engine | Setup Required | Network Dependency | Features & Quality | Cost |
|--------|----------------|--------------------|--------------------|------|
| **Chrome TTS** | No setup needed | Offline / Local | Browser native, zero latency | Free |
| **Edge TTS** | No setup (built-in server) / Customizable | Online | Microsoft Neural high-quality voice | Free |
| **Google TTS** | No setup needed | Online | Official Google endpoint, fast and stable | Free |
| **Azure Speech** | API Key & Region required | Online | Official Microsoft Azure direct, premium quality | Pay-per-use |


## AI Contextual Translation & Q&A Setup

Uses a standardized **OpenAI-compatible API format** — simply fill in 3 fields to connect with your favorite AI provider:

| Field | Description | Example |
|-------|-------------|---------|
| **API Base URL** | Service endpoint | `https://api.deepseek.com` |
| **API Key** | Your API secret key | `sk-xxxxxxxx` |
| **Model Name** | AI model identifier | `deepseek-chat` / `gpt-4o-mini` |

> Fully compatible with OpenAI, DeepSeek, Volcengine, Ollama (Local), Groq, Claude, or any custom proxy supporting the OpenAI `/chat/completions` schema.


## Quick Reference Guide

| Action | Trigger | Description |
|--------|---------|-------------|
| **Instant Lookup** | Hover over Chinese text | Popup displays Jyutping/Yale, definition, and colloquial tags |
| **Pronounce** | Click highlighted word or phonetics | TTS engine plays authentic Cantonese audio |
| **Add to Wordbook** | Click the star button in popup | Saves word with folder category and custom notes |
| **Double-click Translate** | Select text → Double click selection | Opens Bing translation popup (Mandarin & English) |
| **AI Translation** | Long-press highlighted term for ~0.5s | AI explains exact word meaning in sentence context |
| **Paragraph Translation** | Hold `Shift` and hover over paragraph | AI provides full Cantonese paragraph translation |
| **Translate Cantonese Defs** | Click the `[粵]` badge | Translates colloquial Cantonese definitions to UI language |


## Installation

<a href="https://chromewebstore.google.com/detail/%E7%B2%B5%E8%AA%9E%E6%87%B8%E6%B5%AE%E8%A9%9E%E5%85%B8/nkghannminfkihhnkebcjhodfcoamkkm" target="_blank">
  <img src="assets/chrome-web-store-badge.png" height="40" alt="Available in the Chrome Web Store" />
</a>
&nbsp;&nbsp;
<a href="https://microsoftedge.microsoft.com/addons/detail/%E7%B2%B5%E8%AA%9E%E6%87%B8%E6%B5%AE%E8%A9%9E%E5%85%B8/akejhmlcbfmnoodfibchikfjkgjjbfpc" target="_blank">
  <img src="assets/microsoft-edge-badge.png" height="40" alt="Get it from Microsoft Edge" />
</a>

### Manual Installation (Developer Mode)
1. Download or clone this repository: `git clone https://github.com/Ousinki/jyutping-extension.git`
2. Open Chrome / Edge and navigate to `chrome://extensions/`
3. Enable **"Developer mode"** in the top right corner
4. Click **"Load unpacked"** and select this project directory.


## Data Sources

This extension integrates and attributes vocabulary from the following open-source dictionary projects:

- [Words.hk (粵典)](https://words.hk/) — Open Cantonese Dictionary by Hong Kong Lexicography Limited
- [CC-Canto](https://cantonese.org/) — Open Cantonese-English Dictionary
- [CC-CEDICT](https://cc-cedict.org/) — Open Chinese-English Dictionary
- [PyCantonese](https://pycantonese.org/) — Cantonese Linguistics and Jyutping Corpus


## License & Attribution

- **Source Code**: Licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
- **Dictionary Data**:
  - **Words.hk (粵典)** data is licensed under the [Words.hk Non-Commercial Open Data License 1.0](https://words.hk/base/hoifong/);
  - **CC-Canto & CC-CEDICT** data is licensed under [Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/).


## Privacy Policy

This extension respects user privacy and does not collect or transmit personal data. AI translation requests communicate directly between your browser and your configured API endpoint without intermediate servers. See [Privacy Policy](privacy-policy.html).


## Contributing & Feedback

Contributions, bug reports, and feature suggestions are warmly welcomed! Please feel free to open an Issue or submit a Pull Request on GitHub.
