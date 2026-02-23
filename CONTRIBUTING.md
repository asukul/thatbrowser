# Contributing to That Browser

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/asukul/thatbrowser.git
   cd thatbrowser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode** (hot-reload enabled)
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
  main/          # Electron main process
    main.js        - Window management, tab lifecycle, IPC handlers
    ai-service.js  - Multi-provider AI abstraction (chat, vision, streaming)
    gemini-search.js - Gemini-powered verified search
    updater.js     - Auto-update via GitHub Releases API
  preload/       # Context bridge (IPC between main ↔ renderer)
    preload.js
  renderer/      # React UI
    App.jsx        - Root component, tab/state management
    components/    - All UI panels (AIPanel, AutomationsTab, SettingsPage, etc.)
    index.css      - Global styles, CSS variables, component styles
```

## How to Contribute

### Reporting Bugs

Open a [GitHub Issue](https://github.com/asukul/thatbrowser/issues) with:
- Steps to reproduce
- Expected vs. actual behavior
- OS and version info
- Screenshots if applicable

### Suggesting Features

Open an issue with the **Feature Request** label. Describe the use case and any UI/UX ideas you have.

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test locally with `npm run dev` and verify the build with `npm run build`
5. Commit with a clear message
6. Push and open a Pull Request

### Code Style

- **JavaScript/JSX** — Use ES modules (`import`/`export`), functional React components with hooks
- **CSS** — Use the existing CSS variable system (`--brand-*`, `--bg-*`, `--text-*`)
- **Naming** — Component files use PascalCase (`AIPanel.jsx`), utilities use camelCase (`ai-service.js`)
- **IPC channels** — Follow the `namespace:action` pattern (e.g., `tab:create`, `ai:chat-stream`)

### Adding a New AI Provider

1. Add the provider config to `PROVIDERS` in `src/renderer/components/SettingsPage.jsx`
2. Implement the API call in `src/main/ai-service.js` (see existing providers for patterns)
3. Add connection test and model listing support
4. Update the docs

## Building for Distribution

```bash
npm run dist:win    # Windows NSIS installer
npm run dist:mac    # macOS DMG
npm run dist:dir    # Unpacked executable
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
