#!/bin/bash
# Run this script from the project root after authenticating with: gh auth login
# All issues will be created under your GitHub account (asukul)

REPO="asukul/thatbrowser"

echo "Creating GitHub issues for That Browser..."
echo "============================================"

# Issue 1: HIGH — Overlay stuck on error
gh issue create --repo "$REPO" \
  --title "Bug: Automation overlay can get stuck on screen after stream error/abort" \
  --label "bug,high priority" \
  --body "$(cat <<'EOF'
## Description

When the AI automation stream encounters an error or is aborted mid-execution, the native WebContentsView overlay (blue glowing border) can remain stuck on screen, blocking the user's view of the browser content.

## Root Cause

In `AIPanel.jsx`, the `executeAutomationCommands()` function calls `showOverlay()` directly at line 610 with a 150ms delay before starting commands. If the stream errors at lines 268 or 282, `isAutomating` is set to `false`, which triggers the `useEffect` cleanup (lines 179-186). However, a race condition exists: if the error occurs during the 150ms overlay initialization window, the hide call may fire before the show completes — leaving the overlay visible.

Multiple code paths set `isAutomating = false` without explicit `hideOverlay()` calls (lines 243, 832, 1018, 1022, 1048, 1052).

## Expected Behavior

The overlay should always be hidden when automation ends, regardless of whether it completed successfully, errored, or was aborted by the user.

## Suggested Fix

Add explicit `hideOverlay()` calls in all error/abort handlers as a safety net, in addition to the existing `useEffect` cleanup:

```javascript
// In stream error handler and onStopped listener:
window.browserAPI.automation.hideOverlay()
setIsAutomating(false)
```

Also consider adding a `finally`-style cleanup in `executeAutomationCommands`:

```javascript
try {
    // ... execute commands
} finally {
    window.browserAPI.automation.hideOverlay()
}
```

## Files

- `src/renderer/components/AIPanel.jsx` (lines 179-186, 268, 282, 608-671)
- `src/main/main.js` (lines 664-687)
EOF
)"

echo "✓ Issue 1 created"

# Issue 2: MEDIUM — Redundant dual overlay system
gh issue create --repo "$REPO" \
  --title "Refactor: Remove redundant React CSS overlay (red) — only native overlay needed" \
  --label "enhancement,refactor" \
  --body "$(cat <<'EOF'
## Description

The project has **two separate overlay systems** that both activate during browser automation:

| Overlay | Location | Color | Mechanism |
|---------|----------|-------|-----------|
| Native | `main.js` OVERLAY_HTML | Blue (#3b82f6) | WebContentsView on top of tab |
| React | `App.jsx` + `index.css` | Red (#C8102E) | DOM element in React tree |

The native overlay (blue) sits above the React DOM because it's a separate Electron `WebContentsView`. This makes the React overlay (red) completely invisible during automation — it renders behind the native one.

## Recommendation

Remove the React CSS overlay to eliminate redundant rendering:

1. Remove `aiAutomating` state and the `<div className="browser-ai-overlay">` block from `App.jsx` (lines 199-206)
2. Remove `.browser-ai-overlay*` CSS classes from `index.css` (lines 436-495)
3. Remove `@keyframes ai-border-pulse` and `@keyframes ai-dot-blink` from `index.css`
4. Keep the `onAutomationChange` prop for any parent-level state tracking if needed

## Files

- `src/renderer/App.jsx` (lines 199-206)
- `src/renderer/index.css` (lines 436-495)
EOF
)"

echo "✓ Issue 2 created"

# Issue 3: MEDIUM — Overlay bounds stale on tab switch
gh issue create --repo "$REPO" \
  --title "Bug: Overlay bounds may be stale when switching tabs during active automation" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Description

When a user switches tabs while browser automation is running, the native overlay's bounds are calculated for the previous tab's dimensions. The `resizeActiveTab()` function is called during tab switch (line 275 in main.js), which does update the overlay bounds. However, there's a timing gap between tab switch and resize completion where the overlay may not align with the new tab content.

## Steps to Reproduce

1. Start an automation task in one tab
2. While the blue overlay is showing, switch to another tab
3. Observe if overlay border misaligns briefly

## Expected Behavior

Overlay should seamlessly resize to match the new active tab dimensions.

## Suggested Fix

Call `resizeActiveTab()` synchronously during tab switch, or add an explicit overlay bounds update in `switchTab()`.

## Files

- `src/main/main.js` — `switchTab()` (~line 261) and `resizeActiveTab()` (~line 313)
EOF
)"

echo "✓ Issue 3 created"

# Issue 4: LOW — CRLF line ending inconsistency
gh issue create --repo "$REPO" \
  --title "Chore: Add .gitattributes to normalize line endings (CRLF vs LF)" \
  --label "chore" \
  --body "$(cat <<'EOF'
## Description

All 29 source files show as fully changed in `git diff` due to line ending differences (LF in the repository vs CRLF in the working directory on Windows). This makes `git diff` and `git status` unusable for tracking real code changes.

## Fix

A `.gitattributes` file has been added to the project root that forces LF normalization for all text files. After committing this file, run:

```bash
git add --renormalize .
git commit -m "Normalize line endings to LF"
```

This will re-normalize all tracked files to use LF line endings consistently.

## Files

- `.gitattributes` (new)
EOF
)"

echo "✓ Issue 4 created"

# Issue 5: Enhancement — Add test framework
gh issue create --repo "$REPO" \
  --title "Enhancement: Add unit/integration test framework" \
  --label "enhancement" \
  --body "$(cat <<'EOF'
## Description

The project currently has no automated test framework. The 8 built-in test cases (in `TestCases.js`) are interactive browser automation scenarios — they serve as tutorials and manual tests but don't provide automated coverage.

## Recommendation

Add a testing framework to cover:

- **Unit tests** for core logic: `ai-service.js` (provider routing, message formatting), `browser-automation.js` (command parsing), `gemini-search.js` (query building)
- **Component tests** for React components: `AIPanel.jsx`, `AutomationsTab.jsx`, `SettingsPage.jsx`
- **Integration tests** for IPC flow: overlay show/hide, tab management, automation execution

Suggested stack: Vitest (already using Vite) + React Testing Library + Playwright for E2E.

## Priority

This enables CI/CD and prevents regressions as new features are added.
EOF
)"

echo "✓ Issue 5 created"

# Issue 6: Enhancement — CI/CD
gh issue create --repo "$REPO" \
  --title "Enhancement: Add GitHub Actions CI/CD pipeline" \
  --label "enhancement" \
  --body "$(cat <<'EOF'
## Description

The project has no CI/CD pipeline. Adding GitHub Actions would automate:

1. **Lint & type check** on every PR
2. **Unit tests** (once test framework is added)
3. **Build verification** for Windows and macOS
4. **Release automation** — build installers and attach to GitHub Releases on tag push

## Suggested Workflow

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## Files

- `.github/workflows/ci.yml` (new)
- `.github/workflows/release.yml` (new)
EOF
)"

echo "✓ Issue 6 created"

# Issue 7: Enhancement — macOS build verification
gh issue create --repo "$REPO" \
  --title "Enhancement: Verify and test macOS DMG build" \
  --label "enhancement,testing" \
  --body "$(cat <<'EOF'
## Description

The README lists macOS support and provides `npm run dist:mac` to build a DMG. However, only a Windows build (`dist/win-unpacked`) exists in the repository. The macOS build has not been verified.

## Action Items

- [ ] Run \`npm run dist:mac\` on a macOS machine
- [ ] Verify the DMG installs and launches correctly
- [ ] Test all features: AI chat, automation overlay, settings, library
- [ ] Verify code signing (if applicable)
- [ ] Add macOS build artifacts to GitHub Releases
EOF
)"

echo "✓ Issue 7 created"

echo ""
echo "============================================"
echo "All 7 issues created successfully!"
echo "View at: https://github.com/asukul/thatbrowser/issues"
