# That Browser

An open-source, AI-native browser built with Electron and React. Chat with any LLM, automate web tasks with natural language, and run verified searches — all from a single app.

## Features

- **Multi-Provider AI Chat** — Connect to OpenAI, Anthropic Claude, Google Gemini, OpenRouter, or run local models via Ollama and LM Studio. Switch providers instantly from Settings.
- **Browser Automation** — Write automation scripts in plain English. The AI translates your instructions into browser actions (click, type, scroll, navigate, wait) and executes them step by step.
- **Page Summarization** — Summarize any web page with one click. Supports vision-capable models for analyzing page screenshots.
- **Gemini Verified Search** — Real-time information retrieval powered by Google Gemini with source citations and fact-checking.
- **Voice Input** — Speech-to-text via Google Gemini, OpenAI Whisper, or local Whisper models through LM Studio.
- **Image Input** — Attach images to your AI conversations for visual analysis.
- **Test Cases** — Built-in test scenarios that double as interactive tutorials for learning the browser's capabilities.
- **Automation Reports** — Real-time progress tracking with step-by-step status, timing, and AI reasoning display.
- **Library** — Save and organize your chat conversations and automation scripts for reuse.
- **Ad Blocker** — Built-in ad and tracker blocking enabled by default.
- **Auto-Update** — Checks GitHub Releases for new versions and notifies you when an update is available.
- **Cross-Platform** — Windows (NSIS installer) and macOS (DMG) builds.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later

### Install and Run

```bash
git clone https://github.com/asukul/thatbrowser.git
cd thatbrowser
npm install
npm run dev
```

The browser opens in development mode with hot-reload enabled.

### Configure an AI Provider

1. Click the **gear icon** in the toolbar to open Settings
2. Under **AI Providers**, enter your API key for at least one provider
3. Click **Test** to verify the connection
4. Click **Set Active** to make it your default provider
5. Close Settings and click the **AI button** in the toolbar to open the chat panel

## Building for Distribution

### Windows

```bash
npm run dist:win
```

Creates an NSIS installer: `dist/That-Browser-2.0.0.exe`

### macOS

```bash
npm run dist:mac
```

Creates a DMG: `dist/That-Browser-2.0.0.dmg`

### Unpacked (portable)

```bash
npm run dist:dir
```

Builds the executable without an installer.

## Supported AI Providers

| Provider | Type | Default Model | How to Get Access |
|----------|------|---------------|-------------------|
| OpenAI | Cloud | chatgpt-5.2-thinking | [platform.openai.com](https://platform.openai.com) |
| Anthropic Claude | Cloud | claude-opus-4-6 | [console.anthropic.com](https://console.anthropic.com) |
| Google Gemini | Cloud | gemini-3.1-pro | [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | Cloud | anthropic/claude-opus-4-6 | [openrouter.ai](https://openrouter.ai) — access 100+ models |
| Ollama | Local | llama3.2 | [ollama.com](https://ollama.com) — run `ollama serve` |
| LM Studio | Local | (your loaded model) | [lmstudio.ai](https://lmstudio.ai) — start the local server |

## Automation Commands

The browser automation engine supports these commands. You can write them manually or let the AI generate them from natural language descriptions.

| Command | Description | Example |
|---------|-------------|---------|
| `NAVIGATE` | Go to a URL | `NAVIGATE https://google.com` |
| `CLICK` | Click an element by CSS selector | `CLICK #search-btn` |
| `TYPE` | Type text into an input | `TYPE input[name="q"] Hello world` |
| `FILL` | Fill an input field value | `FILL #email user@example.com` |
| `PRESS` | Press a keyboard key | `PRESS Enter` |
| `SCROLL` | Scroll the page | `SCROLL down 500` |
| `WAIT` | Wait for milliseconds | `WAIT 2000` |
| `FIND` | Find elements matching a selector | `FIND .article-title` |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Toggle Developer Mode panel |

## Project Structure

```
src/
  main/              # Electron main process
    main.js            - Window, tabs, IPC, ad blocker
    ai-service.js      - Multi-provider AI (chat, stream, vision, transcribe)
    gemini-search.js   - Verified search with citations
    updater.js         - Auto-update via GitHub Releases
  preload/           # Secure IPC bridge
    preload.js
  renderer/          # React frontend
    App.jsx            - Root component
    components/        - UI panels and widgets
    index.css          - All styles
```

## Documentation

- [Tutorial](docs/TUTORIAL.md) — Getting started guide with walkthroughs
- [Contributing](CONTRIBUTING.md) — How to contribute to the project
- [Changelog](CHANGELOG.md) — Version history and release notes

## License

[MIT](LICENSE) — Adisak Sukul
