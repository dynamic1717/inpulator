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
Content script (content/, bundled to dist/content.js)   Background service worker
─────────────────────────────────────────────────────   ─────────────────────────
mouseup / keyup / selectionchange (debounced 100 ms)
        ↓
selection-context.detect()
  ├── field-native.js     (<input>, <textarea>)
  └── field-editable.js   (contenteditable, via editable-dom.js)
        ↓
language.js → translation/language-detect.js (CLD + fallback, cached per text)
        ↓
gate: enabled, site, source≠target, not skipped
        ↓
floating-ui.js (closed shadow root: pair icon + quota ring)
        ↓
TRANSLATE { text, sourceLanguage }  ───────────────→   translation-service.js
GET_QUOTA / GET_TRANSLATE_SHORTCUT                      → providers (mapped codes)
                                    ←───────────────   translation + quota
        ↓
replace text (native / editable)
```

### Build

Source files are ES modules. `scripts/build.mjs` (esbuild) writes the loadable extension to `dist/`:

| Entry                    | Output                        | Format                                  |
| ------------------------ | ----------------------------- | --------------------------------------- |
| `content/index.js`       | `dist/content.js`             | IIFE (content scripts can't be ESM)     |
| `background.js`          | `dist/background.js`          | ESM (`"type": "module"` service worker) |
| `popup/popup.js`         | `dist/popup/popup.js`         | ESM                                     |
| `offscreen/offscreen.js` | `dist/offscreen/offscreen.js` | ESM                                     |

`content/button.css` is inlined into the content bundle as text and injected into the button's shadow root. The manifest, HTML, popup CSS, fonts, flags and icons are copied as-is.

| Command           | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `npm run build`   | One-off build into `dist/`                        |
| `npm run dev`     | Rebuild on change                                 |
| `npm run package` | Build and zip `dist/` → `inpulator-<version>.zip` |

Every context imports the same modules (`settings.js`, `translation/languages.js`, `translation/language-detect.js`), so there are no per-context copies to keep in sync.

### Components

| File                            | Purpose                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `manifest.json`                 | Manifest V3 (English strings), permissions, content scripts, commands |
| `settings.js`                   | Settings schema, normalization, `chrome.storage` helpers              |
| `background.js`                 | Message handlers, hotkey, action title                                |
| `offscreen-manager.js`          | Offscreen document creation and messaging                             |
| `offscreen/`                    | Host for the Chrome Translator API (status per language pair)         |
| `content/index.js`              | Button orchestration, events, settings gate                           |
| `content/selection-context.js`  | Selection context, anchor position, text replacement                  |
| `content/field-native.js`       | `<input>` / `<textarea>`                                              |
| `content/field-editable.js`     | `contenteditable` and its replacement chain                           |
| `content/editable-dom.js`       | Find the editable root from a selection, across shadow boundaries     |
| `content/selection-observer.js` | Debounced selection and viewport events                               |
| `content/language.js`           | Cached source-language detection and the translate gate               |
| `content/runtime-client.js`     | Quota cache and messaging with the background                         |
| `content/floating-ui.js`        | Circular button in a closed shadow root, pair SVG, quota ring         |
| `content/button.css`            | Button styles (ring, loading, error)                                  |
| `content/extension-context.js`  | Detects an invalidated extension context after a reload               |
| `translation/`                  | Language registry, detection, providers, translation service          |
| `popup/`                        | Settings UI (see structure below)                                     |
| `scripts/build.mjs`             | esbuild build / watch / package                                       |
| `icons/icon{16,48,128}.png`     | Action / store icons                                                  |

### Permissions

| Permission / match                                          | Why                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `content_scripts.matches: <all_urls>`                       | Inject content script (not a top-level `permissions` key) |
| `host_permissions`: `https://api.mymemory.translated.net/*` | MyMemory API                                              |
| `host_permissions`: `https://translation.googleapis.com/*`  | Google Cloud Translation                                  |
| `storage`                                                   | Settings, usage counters, Google key, MyMemory email      |
| `offscreen`                                                 | Chrome Translator API host                                |
| `activeTab`                                                 | Popup: current tab URL (This site) + selection language   |

## Languages

Canonical registry: `translation/languages.js` / `languages.js`.

**Languages:** `en`, `ru`, `es`, `fr`, `de`, `pt`, `it`, `nl`, `pl`, `tr`, `uk`, `zh`, `ja`, `ko`, `ar`, `hi`

Each language: `id`, `name`, `flag` (SVG path), `shortLabel` (for the button), `providerCodes` (API code mapping; Chinese Google/MyMemory → `zh-CN`, Chrome → `zh`).

`shortLabel` values are Latin ISO-style codes: `EN`, `RU`, `ES`, `FR`, `DE`, `PT`, `ZH`, `JA`, `KO`, `AR`, `HI`.

### Source language detection

`translation/language-detect.js`, best signal first; results are cached per text in `content/language.js`.

1. **Chrome LanguageDetector API** (on-device model, used when its availability is `available`; it is not created while downloadable because selections carry no user gesture). Candidates are taken in confidence order:
   - a registry language (confidence ≥ 0.1 and matching script) is returned;
   - a language outside the registry is returned as its bare code (e.g. `sv`) only at confidence ≥ 0.7, so such text is translated as itself rather than mistaken for English;
   - low-confidence non-registry guesses are skipped (`Да` → `sr 0.38, bg, ru 0.14` → `ru`);
   - `und` and romanized tags (`hi-Latn`) are ignored; `zh-Hans` maps to `zh`.
2. **`chrome.i18n.detectLanguage`** (CLD3) — first registry language with a matching script, if reliable or ≥ 40%.
3. **Heuristic** — Unicode scripts (Cyrillic → `uk` with `іїєґ`, else `ru`; Han, kana, Hangul, Arabic, Devanagari) and Latin diacritics (`ãõ` pt, `ñ¿¡` es, `ąćęłńśźż` pl, `ğış` tr, `äöüß` de, `àâçè…` fr), otherwise `en`.

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

Runs on-device. Two hosts:

1. **Content script** (`content/on-device.js`), used first. The button click is a user gesture, which `Translator.create()` requires whenever a pair is `downloadable` / `downloading`, so missing packs download right there with progress on the button.
2. **Offscreen document** (`offscreen/offscreen.js`), the fallback when there is no gesture (the `chrome.commands` hotkey) or the page's permissions policy blocks the API (e.g. cross-origin iframes). It can't start downloads.

Availability is reported **per origin**: a pack already on disk still reads as `downloadable` for a site that hasn't used it, so each site needs one click (or one popup "Download packs" for the extension origin).

| Parameter | Value                                           |
| --------- | ----------------------------------------------- |
| API       | `Translator.availability` / `Translator.create` |
| Languages | Any Chrome-supported pair (BCP 47)              |
| Quota     | No local limit (`period: 'none'`)               |
| Requires  | Chrome 138+ desktop; `offscreen` permission     |

- Text is translated line by line (the API joins lines otherwise)
- Translator instances are cached by `source|target`; a failing cached instance is recreated and the call retried once
- Popup status/download pair: selection language (if any) → `targetLanguage`; fallback `ru→en` or `en→target`. "Download packs" calls `Translator.create()` in the popup, which has the click's gesture

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
- Replacement chain for rich editors: `insertText` → synthetic `paste` event (`DataTransfer`, the system clipboard is never touched) → direct DOM range edit

## Content script isolation

- The content script is a single IIFE bundle with no globals besides a start-once flag.
- The floating button lives in a closed shadow root under an `<inpulator-root>` host, so page CSS cannot restyle it and its CSS never leaks into the page.

## UX details

- Circular 44px button (`border-radius: 50%`), teal surface
- Icon: SVG with source `shortLabel` (top) and target (bottom) — Latin codes, e.g. `RU` / `EN`
- Quota: SVG progress ring when the provider has a numeric limit; no character-count text on the button
- Tooltip (`title`): `RU → EN` or `RU → EN · 12% used` (percent used, not absolute counts)
- Loading: spinner; button disabled
- Errors: `setError()` — alert icon + `input-translate-btn--error`; full message in `title` / `aria-label`
- No toast / snackbar UI — user-visible errors go through the floating button
- Hotkey: **Alt+Shift+T** (`chrome.commands` → background → content script)
- The hotkey acts only on selections inside editable fields; page text outside fields is ignored
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
├── offscreen-manager.js
├── settings.js
├── content/
│   ├── index.js
│   ├── selection-context.js
│   ├── field-native.js
│   ├── field-editable.js
│   ├── editable-dom.js
│   ├── selection-observer.js
│   ├── language.js
│   ├── runtime-client.js
│   ├── floating-ui.js
│   ├── button.css
│   └── extension-context.js
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
│   ├── flags/
│   ├── provider.js
│   ├── skip-languages.js
│   ├── target-language.js
│   ├── quota.js
│   └── lib/
│       ├── format.js
│       └── listbox.js
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.js
├── icons/
├── images/
│   └── banner.jpg
├── scripts/
│   └── build.mjs
├── test/
├── dist/                      # build output (git-ignored)
├── README.md
└── DOCUMENTATION.md
```

## Localization

- `_locales/en` and `_locales/ru`; the browser UI language picks one (`default_locale: "en"`)
- `i18n.js`: `t(key, …substitutions)` wraps `chrome.i18n.getMessage` and falls back to the English catalog where `chrome.i18n` is missing (unit tests)
- The popup marks static text with `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`; `localizeDocument()` fills them
- `test/i18n.test.js` checks that both catalogs have the same keys and `$1…` placeholders

## Testing

- `npm test` — unit tests (`node --test test/*.test.js`)
- `npm run test:e2e` — builds `dist-e2e/` (`--e2e`: the button's shadow root is open so locators reach it) and runs `e2e/*.spec.js` in Playwright's Chromium with the extension loaded. Test pages are served with `page.route`; MyMemory is faked with `context.route`, which also intercepts the service worker's requests. Chromium has no Translator / LanguageDetector APIs, so on-device paths are covered manually.

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

### Phase 11 ✅

- Chrome LanguageDetector first in source detection; confident non-registry languages are kept
- Registry: Italian, Dutch, Polish, Turkish, Ukrainian
- Unspaced (CJK) text is chunked at punctuation
- English and Russian UI via `_locales`
- Playwright e2e suite in CI

### Phase 10 ✅

- esbuild build into `dist/`; one ES-module source for every context (removed the IIFE copies of languages, settings and detection)
- Floating button moved into a closed shadow root
- Language detection cached per text; selection events debounced
- Offscreen Translator status tracked per language pair; popup polling removed
- Google API key sent in the `X-Goog-Api-Key` header
- `npm run package` for Chrome Web Store archives; `minimum_chrome_version: 116`

### Phase 9 ✅

- Popup split into modules (`provider.js`, `skip-languages.js`, `target-language.js`, `quota.js`, `lib/*`, `fonts.css`)
- Toast notifications removed; errors via floating-button `setError` / alert icon
- Chrome pack download errors clarified (English pack-unavailable messaging)
- English manifest / command / UI strings

## Install (dev)

1. Clone the repository
2. `npm install`
3. `npm run dev` (or `npm run build` once)
4. `chrome://extensions` → Developer mode
5. “Load unpacked” → the **`dist/`** folder
6. After each rebuild — reload the extension + **F5 on tabs**

## Stack

- **JavaScript**
- **Manifest V3**
- **Google Cloud Translation API** + **MyMemory API** + **Chrome Translator API**
- **Node test runner** (unit), **Playwright** (e2e), ESLint, and Prettier
