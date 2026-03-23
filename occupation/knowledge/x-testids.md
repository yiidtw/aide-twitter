# X (Twitter) data-testid Reference

Key testids for Chrome DevTools Protocol automation:

## Compose
- `tweetTextarea_0` — compose text input box
- `tweetButtonInline` — Post button (NOT `tweetButton`)
- `SideNav_NewTweet_Button` — New Tweet button in sidebar

## Timeline
- `tweet` — tweet container
- `tweetText` — tweet text content
- `tweetPhoto` — tweet image
- `Tweet-User-Avatar` — user avatar

## Actions
- `caret` — ••• menu button on a tweet
- `confirmationSheetConfirm` — confirm dialog button (delete, etc.)
- `retweet` — retweet button

## Menu items (role="menuitem")
- text includes "Delete" — delete tweet option
- text includes "Pin" — pin tweet option

## Notes
- Use `PUT` method for `http://localhost:9222/json/new?<url>` (not GET)
- Close stale compose tabs before opening new ones
- Wait for SPA to load (poll for element existence, don't sleep fixed time)
- Debug Chrome profile: /tmp/chrome-debug-profile (port 9222)

## CRITICAL: How to post tweets programmatically
- **Use Playwright MCP**, NOT puppeteer, NOT raw CDP
- Playwright `pressSequentially` triggers React/Draft.js state update → button becomes enabled
- Puppeteer `keyboard.type()` does NOT trigger React state — button stays disabled
- After typing, Post button may show `disabled=true` in DOM but IS clickable via `evaluate(el => el.click())`
- Regular `page.click()` fails because an overlay div intercepts pointer events
- Working flow:
  1. `browser_navigate` to `https://x.com/compose/post`
  2. `browser_type` with `slowly: true` on the textbox (ref for `Post text`)
  3. `browser_evaluate` with `(el) => { el.click(); return 'clicked'; }` on the Post button ref
- NEVER use puppeteer for X.com — it consistently fails on React contentEditable
