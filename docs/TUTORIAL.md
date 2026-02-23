# That Browser — Getting Started Tutorial

This guide walks you through the main features of That Browser.

## 1. First Launch

When you first open That Browser, you'll see the main window with:

- **Title bar** — Window controls and the "TB" logo
- **Tab bar** — Browser tabs (click **+** to create a new tab)
- **Toolbar** — Back, Forward, Reload, Home, URL bar, AI toggle, Dev Mode toggle, Settings
- **Bookmarks bar** — Quick links (editable in Settings) and version indicator

Click the **+** button or navigate to a URL to start browsing.

## 2. Setting Up an AI Provider

Before using AI features, configure at least one provider:

1. Click the **gear icon** (⚙️) in the toolbar
2. Scroll to **AI Providers**
3. For a cloud provider (OpenAI, Gemini, Claude, OpenRouter):
   - Enter your API key
   - Click **Test** to verify the connection
   - On success, you'll see available models in a dropdown
4. For a local provider (Ollama, LM Studio):
   - Make sure the local server is running
   - Click **Test** to verify
5. Click **Set Active** on the provider you want to use
6. Close Settings

### Provider Tips

- **Google Gemini** — Free tier available, good all-around performance
- **OpenAI** — Best for code and structured tasks
- **OpenRouter** — Access 100+ models with a single API key
- **Ollama** — Completely free, runs locally, no API key needed

## 3. Using the AI Chat

1. Click the **AI button** (sparkle icon) in the toolbar to open the side panel
2. The **Chat** tab is selected by default
3. Type a message and press Enter or click Send
4. The AI responds with streaming text

### What You Can Ask

- **General questions** — "Explain quantum computing in simple terms"
- **Page analysis** — Click "Summarize Page" to summarize the current page
- **Code help** — "Write a Python function to sort a list"
- **Research** — The AI can see the current page content for context

### Voice Input

1. Click the **microphone icon** in the chat input area
2. Speak your message
3. The audio is transcribed and sent as a text message
4. Requires a voice provider configured in Settings (Speech-to-Text section)

### Image Input

1. Click the **image icon** in the chat input area
2. Select an image file
3. The image is sent to the AI for visual analysis (requires a vision-capable model like GPT-4o or Gemini)

## 4. Browser Automation

Switch to the **Automations** tab in the AI panel to create and run browser automations.

### Writing an Automation

Enter commands one per line:

```
NAVIGATE https://www.google.com
WAIT 1000
TYPE textarea[name="q"], input[name="q"] artificial intelligence news
PRESS Enter
WAIT 2000
```

### Running an Automation

1. Type or paste your automation commands
2. Click **Run** to execute
3. Watch the steps highlight as they execute
4. View the **Automation Report** for timing and status of each step

### AI-Generated Automations

1. Type a description of what you want in the prompt box, for example:
   > Go to Wikipedia, search for "machine learning", and find the definition
2. Click **Generate** — the AI creates the automation commands
3. Review and click **Run**

### Saving Automations

Click **Save** to store your automation in the Library for reuse later.

## 5. Test Cases

Test Cases are pre-built automation scenarios that serve as both tests and tutorials.

### Running a Test Case

1. In either the **Chat** or **Automations** tab, click the **Test Cases** button (flask icon)
2. Browse the categories:
   - **Basic Navigation** — Simple page loads and navigation
   - **Search Engines** — Google, DuckDuckGo, Bing searches
   - **Content Interaction** — Wikipedia lookups, form interactions
   - **Multi-Step Research** — Complex research workflows
3. Click a test case to load and run it
4. Watch the browser execute each step automatically

## 6. Gemini Search

The search bar in the toolbar can trigger a Gemini-powered verified search:

1. Type your query in the URL bar
2. If it's not a URL, the browser searches using your configured search engine
3. For AI-enhanced search, use the chat panel and ask research questions — the AI uses Gemini Search for real-time, cited answers

## 7. Library

Access your saved conversations and automations:

1. Click the **Library** tab in the AI panel
2. Browse saved items organized by folders
3. Click an item to load it
4. Use the context menu to rename, duplicate, or delete

## 8. Settings Overview

Open Settings (gear icon) to configure:

| Section | What It Controls |
|---------|-----------------|
| **General** | Homepage URL, ad blocker toggle |
| **AI Providers** | API keys, models, base URLs for each provider |
| **Speech-to-Text** | Voice provider, API key, model, language |
| **Updates** | Check for new versions, download updates |
| **About** | Version info and credits |

## 9. Checking for Updates

That Browser checks GitHub Releases for updates automatically:

1. Open **Settings**
2. Scroll to the **Updates** section
3. Click **Check for Updates**
4. If an update is available, you'll see a banner with download link
5. Click **Download** to open the release in your system browser

The browser also checks automatically on startup and every 4 hours.

## 10. Developer Mode

Press **Ctrl+Shift+D** to toggle the Developer Mode panel, which shows:

- Real-time logs from the main process
- Memory usage statistics
- Quick access to DevTools for both the UI and the active browser tab

## Tips

- **Switch providers on the fly** — Change your active AI provider in Settings without restarting
- **Save useful automations** — Build a library of reusable automation scripts
- **Use test cases as templates** — Load a test case, modify it, and save as your own automation
- **Keyboard shortcut** — Ctrl+Shift+D opens the dev panel for debugging
