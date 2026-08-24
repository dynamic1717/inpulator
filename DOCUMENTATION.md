# Inpulator — project documentation

Technical documentation for the Inpulator Chrome extension.

User-facing overview: [README.md](README.md)

## Problem

When writing messages in one language, people often need another language: open a translator, copy the result, paste it back. Extra steps and wasted time.

## Solution

The user selects text in an `input` / `textarea` / `contenteditable` — a circular floating translate button appears nearby. One click or `Alt+Shift+T` replaces the selection with a translation into the **chosen target language**. The source language is detected automatically.

## User flow

1. Target language is set in the popup (default `en`)
2. The user types text and selects a fragment
3. The content script detects the source language; if it ≠ target and is not excluded, the button shows with pair codes and (when applicable) a quota ring
4. Button click or hotkey → `TRANSLATE` with `sourceLanguage`
5. Background/service translates via the selected provider
6. Translated text replaces the selection
7. The button disappears when the selection is cleared

## Requirements

- Direction: **any pair** of registry languages (target in settings, source auto-detected)
- Button is hidden when `source === target` or source is in `disabledSourceLanguages`
- Focus on speed and convenience
- Free translation API (MyMemory) / Google Cloud Translation / Chrome on-device

## Architecture

```
Content Script                    Background (Service Worker)
──────────────────────────────    ─────────────────────────────
mouseup / keyup / selectionchange
        ↓
detectSelectionContext()
  ├── field-native.js
  └── field-editable.js (+ shadow-dom.js)
        ↓
language-detect.js (CLD + fallback)
        ↓
gate: enabled, site, source≠target, not disabled
        ↓
floating button UI (pair on icon + quota ring)
        ↓
TRANSLATE { text, sourceLanguage }  →  Translation service
  GET_QUOTA / GET_SELECTION_LANGUAGE     → providers (mapped codes)
                             ←    translation + quota
        ↓
replace text (native / editable / clipboard)
```

### Components

| File                             | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `manifest.json`                  | Manifest V3 (English strings), permissions, content scripts, commands |
| `languages.js`                   | IIFE: language registry, shortLabel, mapLanguageCodes                 |
| `settings.js`                    | IIFE: read/write `extensionSettings`                                  |
| `settings-defaults.js`           | ES module settings constants for background                           |
| `language-detect.js`             | IIFE: `chrome.i18n.detectLanguage` + script fallback                  |
| `popup/`                         | Modular English settings UI (see structure below)                     |
| `offscreen/`                     | Host for Chrome Translator API                                        |
| `offscreen-manager.js`           | Offscreen document creation and messaging                             |
| `shadow-dom.js`                  | Shadow boundary walk, find editable from selection                    |
| `field-clipboard.js`             | Clipboard fallback for text replacement                               |
| `field-native.js`                | Logic for `<input>` / `<textarea>`                                    |
| `field-editable.js`              | Logic for `contenteditable`                                           |
| `content.js`                     | Button orchestration, events, settings gate                           |
| `selection-context.js`           | Selection context, position, text replacement                         |
| `selection-observer.js`          | Selection and viewport event batching                                 |
| `runtime-client.js`              | Quota cache and messaging with background                             |
| `floating-ui.js`                 | Circular button, pair SVG, quota ring, `setError`                     |
| `background.js`                  | Message relay, hotkey, action title, Chrome model status              |
| `translation/languages.js`       | ES module language registry                                           |
| `translation/language-detect.js` | ES module detection (tests / shared logic)                            |
| `translation/`                   | Contract, text-utils, Google/MyMemory/Chrome, service                 |
| `styles.css`                     | Floating button styles (ring, loading, error)                         |
| `icons/icon{16,48,128}.png`      | Action / store icons                                                  |

### Permissions

| Permission / match                                          | Why                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `content_scripts.matches: <all_urls>`                       | Inject content script (not a top-level `permissions` key) |
| `host_permissions`: `https://api.mymemory.translated.net/*` | MyMemory API                                              |
| `host_permissions`: `https://translation.googleapis.com/*`  | Google Cloud Translation                                  |
| `clipboardRead`, `clipboardWrite`                           | Clipboard fallback                                        |
| `storage`                                                   | Settings, usage counters, Google key, MyMemory email      |
| `offscreen`                                                 | Chrome Translator API host                                |
| `activeTab`                                                 | Popup: current tab URL (This site) + selection language   |

## Languages

Canonical registry: `translation/languages.js` / `languages.js`.

**Languages:** `en`, `ru`, `es`, `fr`, `de`, `pt`, `zh`, `ja`, `ko`, `ar`, `hi`

Each language: `id`, `name`, `flag` (SVG path), `shortLabel` (for the button), `providerCodes` (API code mapping; Chinese Google/MyMemory → `zh-CN`, Chrome → `zh`).

`shortLabel` values are Latin ISO-style codes: `EN`, `RU`, `ES`, `FR`, `DE`, `PT`, `ZH`, `JA`, `KO`, `AR`, `HI`.

### Source language detection

1. `chrome.i18n.detectLanguage` (CLD3) — language with the highest `percentage`, rejected if the text does not match the language script (and `zh` is rejected when kana or Hangul is present)
2. If unreliable / outside the registry — Unicode script and diacritic fallback (`ãõ`→pt, `ñ`→es, `äöüß`→de, `àâçé`→fr, Hangul→ko, kana→ja, otherwise Latin→en)

Button gate (`isTranslatable`):

- text is present;
- source is in the registry;
- `source ∉ disabledSourceLanguages`;
- `source !== targetLanguage`.

## Settings (`extensionSettings`)

Key in `chrome.storage.local`:

```js
{
  enabled: true,
  provider: 'mymemory',
  blockedDomains: [],
  targetLanguage: 'en',
  disabledSourceLanguages: [],
}
```

Separate storage keys (not inside `extensionSettings`):

- `googleTranslateApiKey` — personal Google Cloud Translation key
- `myMemoryEmail` — auto-generated on install for MyMemory

Fields:

- **enabled** — global on/off; gates floating UI and translate. `chrome.action.setTitle` becomes `Inpulator — disabled` when off
- **provider** — `mymemory` (default), `chrome`, or `google`
- **blockedDomains** — domains where translate UI is hidden (“This site” toggle)
- **targetLanguage** — canonical target language id
- **disabledSourceLanguages** — canonical source ids for which the button is hidden
- Popup: `action.default_popup` → `popup/popup.html`
- Changes apply via `chrome.storage.onChanged` without reloading the page

### Popup UI

- English copy (`lang="en"`); fonts: **Manrope** (UI) + **JetBrains Mono** (quota / mono)
- Header: brand + quota label/value (`used / limit` or “No limit”) and a thin meter
- Toggles: Translate button, This site
- Target language: custom listbox (same dropdown styling as Advanced)
- Provider: segmented radiogroup — MyMemory / On-device / Google
- Conditional panels: Chrome language packs, or Google API key (clear control inside the input)
- **Advanced** `<details>`: skip-languages combobox + “Change shortcut”

### Popup: skip languages

- Combobox with selected languages as pills inside the field
- Detected-on-page chip (`+ Language`) when the tab selection language is known and not already skipped
- Typeahead filters remaining registry languages
- Content script message: `GET_SELECTION_LANGUAGE`

## Google API key

The user adds a Google API key in the popup. The key is stored locally in
`chrome.storage.local` under `googleTranslateApiKey` and is not included in
source code or the distributed extension folder.

## Translation APIs

Language pair: `{ source, target }` after `mapLanguageCodes(providerId, pair)`.  
`TRANSLATE` sends `sourceLanguage`; `target` comes from `settings.targetLanguage`.

### Chrome Translator API

On-device via an offscreen document (`offscreen/offscreen.js`). The service worker calls `Translator` only through messaging.

| Parameter | Value                                           |
| --------- | ----------------------------------------------- |
| API       | `Translator.availability` / `Translator.create` |
| Languages | Any Chrome-supported pair (BCP 47)              |
| Quota     | No local limit (`period: 'none'`)               |
| Requires  | Chrome 138+ desktop; `offscreen` permission     |

- Status/download in popup: pair = selection language (if any) → `targetLanguage`; fallback `ru→en` or `en→target`
- `isAvailable` is true for `available` / `downloadable` / `downloading` — packs download on demand via `Translator.create`
- Translator instances cached in offscreen by `source|target`

### Google Cloud Translation

| Parameter | Value                                                           |
| --------- | --------------------------------------------------------------- |
| Endpoint  | `POST https://translation.googleapis.com/language/translate/v2` |
| Auth      | `key` query param                                               |
| Languages | `source` / `target` from the pair (Chinese: `zh-CN`)            |
| Max chunk | ~4000 characters                                                |
| Quota     | Local 500,000 / calendar month (`googleMonthlyUsage`)           |

### MyMemory

| Parameter    | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Endpoint     | `GET https://api.mymemory.translated.net/get`           |
| `langpair`   | `{source}\|{target}` (Chinese: `zh-CN`)                 |
| Max chunk    | 450 characters                                          |
| Quota        | Local 50,000 / day (`dailyUsage`)                       |
| Email (`de`) | Auto-generated on install and stored in `myMemoryEmail` |

### Provider selection

`translation/translation-service.js` reads `settings.provider`.

- `getQuota` — always the selected provider’s quota
- `translate(text, { sourceLanguage })` calls only the selected provider
- Missing Google API key, unavailable Chrome Translator, and exhausted local quota return errors without automatic fallback
- Response: `{ translatedText, provider, quota }` — `provider` always matches the selected engine

### Alternatives (not implemented)

| API            | Limit       | Quality |
| -------------- | ----------- | ------- |
| LibreTranslate | ~100k/month | Medium  |
| DeepL Free     | ~500k/month | High    |

## Field type support

| Field type                  | Status | Notes                                                     |
| --------------------------- | ------ | --------------------------------------------------------- |
| `<input>`, `<textarea>`     | ✅     | `selectionStart/End`, mirror-div for position             |
| `contenteditable`           | ✅     | `Range`, `insertText`, `InputEvent`                       |
| React/Vue controlled        | ✅     | `dispatchEvent('input')`                                  |
| Shadow DOM (Gmail, ChatGPT) | ✅     | Walk from `selection.anchorNode` via `getRootNode().host` |
| Cross-origin iframe         | ❌     | Content script unavailable                                |

## Shadow DOM

`chrome.dom.openOrClosedShadowRoot` is **not used** — it causes `Extension context invalidated` after reloading the extension without refreshing the tab.

Instead:

- Walk up from the selection node via `parentNode` / `DocumentFragment.host`
- `selectionchange` to sync button visibility
- Clipboard fallback (`insertText` → `paste`) for complex editors

## Content scripts: scope isolation

Module files are wrapped in IIFEs with guard flags (`__inputTranslate*`) — reinjection on extension update does not cause `Identifier already declared`.

Shared API: `window.InputTranslate.{languages, settings, languageDetect, shadow, clipboard, native, editable, selectionContext, selectionObserver, runtimeClient, floatingUi, extension}`.

Script order in the manifest: `languages.js` → `settings.js` → `language-detect.js` → …

## UX details

- Circular 44px button (`border-radius: 50%`), teal surface
- Icon: SVG with source `shortLabel` (top) and target (bottom) — Latin codes, e.g. `RU` / `EN`
- Quota: SVG progress ring when the provider has a numeric limit; no character-count text on the button
- Tooltip (`title`): `RU → EN` or `RU → EN · 12% used` (percent used, not absolute counts)
- Loading: spinner; button disabled
- Errors: `setError()` — alert icon + `input-translate-btn--error`; full message in `title` / `aria-label`
- No toast / snackbar UI — user-visible errors go through the floating button
- Hotkey: **Alt+Shift+T** (`chrome.commands` → background → content script)
- Ctrl+Z works after replace (via `insertText` / native value)

## Security

- Does not activate on password fields
- Does not log translations
- Text is sent to Google Cloud Translation and/or MyMemory only when those providers are selected
- Google API key is stored locally in `chrome.storage.local`; sharing a common key is not allowed

## Project structure

```
input-translate-ext/
├── manifest.json
├── background.js
├── languages.js
├── settings.js
├── settings-defaults.js
├── language-detect.js
├── shadow-dom.js
├── field-clipboard.js
├── field-native.js
├── field-editable.js
├── floating-ui.js
├── selection-context.js
├── selection-observer.js
├── runtime-client.js
├── content.js
├── styles.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── images/
│   └── banner.jpg
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.js
├── offscreen-manager.js
├── translation/
│   ├── languages.js
│   ├── language-detect.js
│   ├── provider.js
│   ├── text-utils.js
│   ├── translation-service.js
│   └── providers/
│       ├── chrome-provider.js
│       ├── google-provider.js
│       └── mymemory-provider.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   ├── fonts.css
│   ├── fonts/                 # Manrope + JetBrains Mono woff2
│   ├── provider.js
│   ├── skip-languages.js
│   ├── target-language.js
│   ├── quota.js
│   └── lib/
│       ├── format.js
│       └── listbox.js
├── test/
├── README.md
└── DOCUMENTATION.md
```

## Development history

### Phase 1 ✅

- `input` and `textarea`
- Floating button for Cyrillic
- MyMemory API
- Loading and error states

### Phase 2 ✅

- `contenteditable`
- Hotkey `Alt+Shift+T`

### Phase 2.5 ✅

- Shadow boundary traversal from selection
- Clipboard fallback
- IIFE guards for content scripts

### Phase 3 ✅

- Local quota counter on the button (later replaced by a progress ring)
- `quotaFinished` handling

### Phase 4 ✅

- Settings popup: limit, on/off, optional on-button counter (later removed)
- Grayscale action icons when disabled (later removed; title-only disabled state)

### Phase 5 ✅

- Google Cloud Translation API
- Provider selection in popup
- Personal Google API key in `chrome.storage.local`

### Phase 6 ✅

- Chrome Translator API (on-device)
- Offscreen document + `offscreen` permission
- Selected provider without automatic fallback

### Phase 7 ✅

- Blocked domains (“This site” toggle)
- Multilingual translation: target in popup, auto-detect source
- Source language exclusions
- Dynamic pair on the button icon
- Chrome packs for the actual pair (+ auto-download on translate)

### Phase 8 ✅

- Popup redesign: English UI, Manrope / JetBrains Mono, segmented provider, Advanced accordion, skip-languages combobox
- Circular floating button + quota progress ring (replaces on-button char counter)
- Removed `showCharCounter` setting
- Removed grayscale `*-disabled` action icons (color icons + title when disabled)

### Phase 9 ✅

- Popup split into modules (`provider.js`, `skip-languages.js`, `target-language.js`, `quota.js`, `lib/*`, `fonts.css`)
- Toast notifications removed; errors via floating-button `setError` / alert icon
- Chrome pack download errors clarified (English pack-unavailable messaging)
- English manifest / command / UI strings

## Install (dev)

1. Clone the repository
2. `npm install`
3. `chrome://extensions` → Developer mode
4. “Load unpacked” → project folder
5. After each code change — reload the extension + **F5 on tabs**

## Stack

- **JavaScript**
- **Manifest V3**
- **Google Cloud Translation API** + **MyMemory API** + **Chrome Translator API**
- **Node test runner**, ESLint, and Prettier for local checks
