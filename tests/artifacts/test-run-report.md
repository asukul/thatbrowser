# Test Run Report — Wikipedia Random Article

**Test case ID:** `wikipedia-random-article`
**File:** `src/renderer/components/TestCases.js`
**Date:** 2026-04-09
**Runner:** Playwright MCP (same CDP protocol the app uses in `src/main/browser-automation.js`)
**Viewport:** 1280 x 800
**Result:** PASS

## Why this test was added

The 8 pre-existing test cases in `TestCases.js` cover `navigate`, `fill`, `press`,
`scroll`, and `wait` — but none of them exercise `click_element`, despite it being
the most-used automation command in practice (every "click this link/button"
instruction from the AI panel produces a `click_element` step). This new case
closes that coverage gap with the most stable possible selector:
`a[href="/wiki/Special:Random"]` — a link that has existed unchanged in Wikipedia's
chrome for over a decade.

## Commands executed

| # | Command | Parameters | Outcome |
|---|---|---|---|
| 1 | `navigate` | `https://en.wikipedia.org/wiki/Main_Page` | Loaded — title "Wikipedia, the free encyclopedia" |
| 2 | `wait` | `2000 ms` | OK |
| 3 | `click_element` | `a[href="/wiki/Special:Random"]` | Element found at (146, 65), click dispatched, page navigated to `/wiki/Joab_(name)` |
| 4 | `wait` | `2500 ms` | OK — "Joab (name) - Wikipedia" rendered |
| 5 | `scroll` | `deltaY: 500` | scrollY advanced to 274 (page total height 1074, already at bottom) |
| 6 | `wait` | `800 ms` | OK |
| 7 | `scroll` | `deltaY: 500` | No change — already at max scroll (274) |
| 8 | `wait` | `500 ms` | OK |

## Screenshots

- `step1-wikipedia-main-page.png` — Wikipedia Main Page after step 1-2 (navigate + wait)
- `step2-random-article-loaded.png` — Random article "Joab (name)" after step 3-4 (click_element + wait)
- `step3-after-scroll-500.png` — Article scrolled 500px (step 5-6)
- `step4-final-scroll.png` — Full-page capture after second scroll (step 7-8)

## Findings

1. **`click_element` works end-to-end.** The selector resolved, the element's
   bounding box was computed, the click sequence fired, and the browser navigated
   to the target URL — matching the behavior implemented in
   `browser-automation.js:300` (`clickElement` method).

2. **Random-article landed on a stub.** "Joab (name)" is a short disambiguation
   page (document height = 1074px vs viewport 800px), so the two 500px scrolls
   both clamped at scrollY=274. This is a property of the test content, not a
   bug in the `scroll` command — the commands executed correctly. Future runs
   will land on different articles and may scroll further.

3. **No regressions.** All 8 commands in the new case executed without errors.
