# Changelog

All notable changes to That Browser will be documented in this file.

## [2.0.0] — 2026-02-22

### Rebranded as "That Browser"
- Renamed project from "AI Browser ISU" to **That Browser** for open-source release
- Updated all references, branding, CSS variables, and metadata
- New GitHub repository: [github.com/asukul/thatbrowser](https://github.com/asukul/thatbrowser)

### Added
- **Auto-Update Checker** — Checks GitHub Releases for new versions on startup and every 4 hours; shows a notification banner in Settings with one-click download
- **MIT License** for open-source distribution
- Full GitHub repository content (README, CONTRIBUTING guide, CHANGELOG, tutorials)

### Changed
- CSS variables renamed from `--isu-*` to `--brand-*` (same colors, generic names)
- Default bookmarks updated to generic sites (Google, Google Scholar, Wikipedia)
- Version bumped to 2.0.0 to mark the open-source release

---

## [1.4.0] — 2026-02-20

### Added
- **Test Cases** — Predefined test scenarios accessible from both Chat and Automations panels
  - 8 test cases across 4 categories: Basic Navigation, Search Engines, Content Interaction, Multi-Step Research
  - Serves as both automated tests and interactive tutorials
- Test Cases button with dropdown menu in Chat and Automations tabs

### Fixed
- Wikipedia test case updated to use `Special:Search` page (fixes hidden search input on Vector 2022 skin)
- Search engine selectors improved with fallback selectors for Google, Bing, DuckDuckGo

---

## [1.3.0] — 2026-02-18

### Added
- **Automation Report Panel** — Detachable panel showing real-time automation progress
  - Step-by-step execution status with timing
  - AI thinking/reasoning display
  - Progress bar and statistics footer
- **Step Highlighting** — Running automation step is highlighted in the Automations tab
- **AI-Generated Automations** — Ask the AI to create automation scripts from natural language
- **Multi-Select Chat-to-Automation** — Select multiple chat messages and convert them into automation steps

---

## [1.2.1] — 2026-02-15

### Added
- **Settings Page** — Centralized configuration for AI providers, ad blocker, homepage, speech-to-text
- **Speech-to-Text** — Voice input via Google Gemini, OpenAI Whisper, or local LM Studio
- **Image Input** — Attach images to AI chat for vision analysis
- **Connection Test + Model Picker** — Test provider connections and browse available models with scrollable dropdown

---

## [1.0.7] — 2026-02-01

### Initial Release
- Chromium-based browser with tabbed browsing
- Built-in AI assistant panel with streaming chat
- Multi-provider support: OpenAI, Anthropic Claude, Google Gemini, OpenRouter, Ollama, LM Studio
- Page summarization and data extraction
- Browser automation via natural language (CLICK, TYPE, NAVIGATE, SCROLL, WAIT, FIND)
- Gemini-powered verified search with source citations
- Built-in ad blocker
- Library for saving conversations and automations
- Bookmarks bar
- Custom title bar with window controls
- Dark theme UI
- Cross-platform: Windows (NSIS installer) and macOS (DMG)
