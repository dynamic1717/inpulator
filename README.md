<div align="center">
  <img src="./images/banner.jpg" alt="Inpulator Banner">
</div>

# Inpulator

Translate your thoughts **right in the input field** — in chat, email, or forms. No translator tab, no copy-paste.

Select text → press the button or shortcut → the selection is replaced with a translation into your chosen language.

## Why

Writing in one language while thinking in another? The usual path: type → open a translator → copy → paste. Inpulator shortens that to two actions: **select and translate**.

## Features

- **In-place translation** — the selection is replaced in the same field
- **Multiple languages** — English, Russian, Spanish, French, German, Chinese; target language is chosen in settings
- **Auto-detect source** — the selection language is detected automatically
- **Circular floating button** — next to the selection; icon shows pair codes (`ES → EN`); quota usage as a progress ring
- **Tooltip** — `ES → EN` or `ES → EN · 12% used` (exact counts live in settings)
- **Shortcut** — `Alt+Shift+T` (on macOS: `Option+Shift+T`)
- **Three providers** — MyMemory by default, Chrome Translator (on-device), Google Translate
- **Settings** — segmented provider control, target language, Advanced (skip-languages combobox + change shortcut), Chrome packs, Google API key, on/off, per-site toggle
- **Wide field support** — `<input>`, `<textarea>`, `contenteditable` (Gmail, ChatGPT, Slack, etc.), including Shadow DOM
- **Clear states** — spinner while loading; alert icon on the button when something fails (no toast)

## How to use

1. In settings, choose **Translate to** (default: English)
2. Type into any supported field
3. Select the fragment to translate
4. Press the translate button **or** the shortcut
5. The selection is replaced with the translation

The button appears when the selection language differs from the target and is not excluded. It disappears when the selection is cleared.

Open settings from the extension icon: target language, site toggle, provider (MyMemory / On-device / Google), Chrome packs or Google API key, and Advanced for skip languages / shortcut.

## Shortcut

| Platform        | Combination      |
| --------------- | ---------------- |
| Windows / Linux | `Alt+Shift+T`    |
| macOS           | `Option+Shift+T` |

Remap at: `chrome://extensions/shortcuts` (also linked from Advanced in the popup).

## Languages

| Code | Language | Button label |
| ---- | -------- | ------------ |
| en   | English  | `EN`         |
| ru   | Русский  | `RU`         |
| es   | Español  | `ES`         |
| fr   | Français | `FR`         |
| de   | Deutsch  | `DE`         |
| zh   | 中文     | `ZH`         |

- **Target language** — listbox in settings
- **Skip languages** — excluded sources in Advanced; chip for language detected on the page, or typeahead in the combobox
- **Site** — the “This site” toggle adds/removes the domain from the block list

## Providers and limits

| Provider          | Limit (local)       | Notes                                                          |
| ----------------- | ------------------- | -------------------------------------------------------------- |
| MyMemory          | **50,000 / day**    | Default; cloud service, text is sent to MyMemory               |
| Chrome Translator | **No limit**        | On-device, Chrome 138+ desktop; no progress ring on the button |
| Google Translate  | **500,000 / month** | Requires your own API key in settings; text is sent to Google  |

Google/MyMemory counters are stored locally and are an **estimate**, not exact API billing.

For Chrome Translator, packs are downloaded **for the needed language pair** (from selection and target) — in settings or automatically on the first translation. Browser pack management: `chrome://on-device-translation-internals`.

## Limitations

- Chrome Translator: **Chrome 138+ desktop** (not mobile)
- The button does not appear when source equals target, or the source is excluded
- Does not work in **cross-origin iframes**
- Rich text inserts plain text — formatting is lost
- After updating the extension, **reload the tab** (F5)

## Install

### From source

1. Download or clone the repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select the project folder
5. (Optional) For Google Translate, create a personal [Cloud Translation API](https://cloud.google.com/translate/docs/basic/translating-text) key, restrict it to Translation API and a quota, then add it in settings

### Update

1. Download the latest repository version
2. Replace the current project folder with the new one
3. `chrome://extensions` → reload the extension
4. Reload open tabs

## Checks

```bash
npm install
npm test
npm run lint
npm run format:check
```

## Privacy

- **Chrome Translator** — on-device translation; text does not leave the device
- **Google / MyMemory** — text is sent only if you chose that provider
- Stored locally: settings, usage counters, MyMemory email, and your Google API key (`chrome.storage.local`)
- Do not share your API key; restrict it to Cloud Translation API and quotas

## Developer docs

Technical documentation, architecture, file layout: [DOCUMENTATION.md](DOCUMENTATION.md)

## Stack

JavaScript (vanilla) · Manifest V3 · Chrome Translator API · Google Cloud Translation · MyMemory
