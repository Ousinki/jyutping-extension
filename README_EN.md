<p align="center">
  <img src="icon_15.png" width="128" alt="Cantonese Popup Dictionary Logo" />
</p>
<p align="center">
  <a href="README.md">繁體中文</a> | <strong>English</strong>
</p>

# Cantonese Popup Dictionary (粵語懸浮詞典)

A Chrome extension that instantly displays Cantonese pronunciation (Jyutping/Yale) and English definitions on hover. Supports multiple TTS engines, Bing Translate, and AI contextual translation.

![Demo - Hover Lookup](assets/screenshot_demo_hover.png)
![Demo - Double-click Translate](assets/screenshot_demo_translate.png)
![Demo - Dictionary Lookup](assets/screenshot_demo.png)
![Demo - AI Contextual Translation](assets/screenshot_ai_demo.png)
![Demo - Web Page Test](assets/promo_wenweipo.jpg)


## Features

- **Instant Hover Lookup**: Move your mouse over any Chinese character to instantly see Cantonese pronunciation
- **Dual Romanization**: Supports both Jyutping and Yale systems
- **English Definitions**: Detailed English translations and explanations
- **230,000+ Entries**: Covers common vocabulary, idioms, and slang
- **Click to Speak**: Click any highlighted text to hear Cantonese pronunciation
- **Bing Translate**: Double-click selected text for instant Mandarin & English translation
- **AI Contextual Translation**: Long-press highlighted text for ~0.5s — AI explains meaning based on surrounding context
- **Multiple Themes**: 8 curated themes (Classic, Hong Kong Red, Deep Night, Ink Wash, Ocean, Warm Sun, Mint, Frosted Glass)
- **Multilingual Interface**: Switch between Traditional Chinese and English UI
- **Interactive Settings Page**: High-fidelity CSS animations demonstrate how to use double-click translation, AI long-press, and click-to-speak
- **Style Isolation**: Strict CSS isolation prevents host page styles from interfering with popup layout and font sizes
- **Shadow DOM Support**: Compatible with modern websites using Web Components (e.g. Bilibili)

## Text-to-Speech (TTS)

Supports 4 TTS engines for different use cases:

| Engine | Setup Required? | Quality | Cost |
|--------|----------------|---------|------|
| **Chrome TTS** | No setup needed | ★★★ | Free |
| **Edge TTS** | No setup (built-in server) / Customizable | ★★★★ | Free |
| **Azure Speech** | No setup (built-in API) / Custom key available | ★★★★★ | Built-in free / Custom pay-per-use |
| **Bert-VITS2** | Server address required | ★★★★ | Depends on provider |

### Azure Speech Voices

Azure Speech offers 3 premium Cantonese voices:

- **HiuMaan** (Female)
- **HiuGaai** (Female)
- **WanLung** (Male)

### Speed Control

All engines support 0.5x – 1.5x speed adjustment.

### Audio Cache

Built-in smart audio cache (up to 20 entries) — clicking the same word again plays instantly without re-fetching from the API.

## Translation

### Bing Translate (Free, No Setup)

Select Cantonese text and **double-click the selection** for instant Mandarin and English translation. Powered by Bing Translate with native Cantonese support — no API key required.

- Parallel requests: Translates to Mandarin and English simultaneously
- Token optimization: Concurrent requests share a single token to avoid redundant fetches

### AI Contextual Translation (API Required)

**Long-press** a highlighted word or manual selection for ~0.5 seconds — AI analyzes the surrounding context and explains the word's specific meaning in Traditional Chinese.

#### How to Use

1. Enable "AI Contextual Translation" in Settings
2. Configure your API (see below)
3. Hover to highlight a word → **long-press 0.5s** → AI analysis appears in the popup
4. Or manually select text → **long-press the selection for 0.5s** → AI analysis appears in a floating panel

#### API Configuration

Uses a unified **OpenAI-compatible API format** — just fill in 3 fields to connect with any major AI provider:

| Field | Description | Example |
|-------|-------------|---------|
| **API Base URL** | Service endpoint | `https://api.deepseek.com` |
| **API Key** | Your API key | `sk-xxxxxxxx` |
| **Model Name** | Model to use | `deepseek-chat` |

#### Supported AI Providers

| Provider | API Base URL | Model Example |
|----------|-------------|---------------|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-chat` |
| **Volcengine** | `https://ark.cn-beijing.volces.com/api/v3` | `ep-xxxx` (Endpoint ID) |
| **Ollama (Local)** | `http://localhost:11434/v1` | `gemma3:4b` |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |

> Any service compatible with the OpenAI `/chat/completions` endpoint can be used, including self-hosted proxies and relay services.

#### AI Prompt Design

The system automatically extracts the paragraph surrounding the selected word as context and sends the following prompt to the AI:

```
You are a Cantonese language expert. The user is reading a Cantonese article
and has highlighted a word. Based on the surrounding context, briefly explain
the specific meaning of this word in the sentence (1-2 sentences) in Traditional Chinese.
Only reply with the explanation itself, without any formatting marks.

【Word】{selected word}
【Sentence】{surrounding paragraph}
```

## Quick Reference

| Action | Trigger | Effect |
|--------|---------|--------|
| Lookup | Hover over Chinese text | Popup shows Jyutping, Yale, English definitions |
| Speak | Click highlighted word / Click phonetics in popup | TTS reads Cantonese pronunciation |
| Bing Translate | Select text → Double-click selection | Shows Mandarin + English translation |
| AI Translation | Long-press highlighted word or selection ~0.5s | AI explains meaning in context |
| Expand Examples | Click English definition in popup | View more example sentences and details |

## Installation

<a href="https://chromewebstore.google.com/detail/%E7%B2%B5%E8%AA%9E%E6%87%B8%E6%B5%AE%E8%A9%9E%E5%85%B8/nkghannminfkihhnkebcjhodfcoamkkm" target="_blank">
  <img src="assets/chrome-web-store-badge.png" height="40" alt="Available in the Chrome Web Store" />
</a>
&nbsp;&nbsp;
<a href="https://microsoftedge.microsoft.com/addons/detail/%E7%B2%B5%E8%AA%9E%E6%87%B8%E6%B5%AE%E8%A9%9E%E5%85%B8/akejhmlcbfmnoodfibchikfjkgjjbfpc" target="_blank">
  <img src="assets/microsoft-edge-badge.png" height="40" alt="Get it from Microsoft Edge" />
</a>

### Manual Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the project folder

## Settings

Click the extension icon → More Settings:

### General
- **Enable / Disable Dictionary**
- **Pronunciation Format**: Jyutping / Yale
- **Popup Theme**: Classic / Hong Kong Red / Deep Night / Ink Wash / Ocean / Warm Sun / Mint / Frosted Glass

### Translation
- **Bing Translate**: Free, no setup needed — triggered by double-clicking a selection

### AI Contextual Translation
- **Enable Toggle**: Turn AI translation on/off
- **API Base URL**: OpenAI-compatible endpoint
- **API Key**: Provider secret key
- **Model Name**: AI model to use
- **Test Connection**: One-click API verification

### TTS Voice Settings
- **Voice Engine**: Choose your TTS provider
- **Voice**: Azure Speech lets you choose different voices
- **Speed**: 0.5x – 1.5x
- **Edge TTS / Azure Speech**: Supports built-in servers (no setup) or custom addresses/keys

## Data Sources

- [words.hk](https://words.hk/) — Cantonese Open Dictionary
- [CC-Canto](https://cantonese.org/) — Cantonese Dictionary
- [CC-CEDICT](https://cc-cedict.org/) — Chinese-English Dictionary
- [PyCantonese](https://pycantonese.org/) — Jyutping Supplement

## Privacy Policy

This extension does not collect any user data. AI translation uses the user's own API configuration — data is sent directly to the AI provider of their choice, without passing through any intermediary server. See [Privacy Policy](privacy-policy.html).

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

## Contributing

Issues and Pull Requests are welcome!

## Contact

For questions or suggestions, please reach out via GitHub Issues.
