# Privacy Policy — Inpulator

**Effective date:** 26 August 2026

This policy describes how the Inpulator Chrome extension (“Inpulator”, “the extension”, “we”) handles information. Inpulator is developed by [dynamic1717](https://github.com/dynamic1717). Contact: [disre1717@gmail.com](mailto:disre1717@gmail.com).

Inpulator translates text you select in an input field, textarea, or editable area. It does not create accounts, does not include analytics, and does not sell data.

---

## 1. Summary

- Translation happens only after you select text and click the translate button or use the shortcut.
- **On-device (Chrome Translator):** selected text stays on your computer.
- **MyMemory or Google:** selected text is sent to that provider’s API because you chose it in settings.
- Settings, usage counters, and any Google API key you paste are stored locally in Chrome (`chrome.storage.local`). We do not operate a backend that receives your text or settings.
- Uninstalling the extension deletes local data stored by Inpulator.

---

## 2. Data we process

### 2.1 Selected text

When you translate, the extension reads only the highlighted fragment in a supported field (`input`, `textarea`, `contenteditable`). That fragment is sent to the translation engine you selected:

| Provider                 | Where the text goes                                        | When                                      |
| ------------------------ | ---------------------------------------------------------- | ----------------------------------------- |
| Chrome Translator        | On-device, via Chrome’s Translator API                     | Provider set to On-device                 |
| MyMemory                 | `https://api.mymemory.translated.net/`                     | Provider set to MyMemory                  |
| Google Cloud Translation | `https://translation.googleapis.com/language/translate/v2` | Provider set to Google, with your API key |

Password fields are not used. The extension does not send the rest of the page, browsing history, cookies, or form data you did not select.

Source language is detected locally (`chrome.i18n.detectLanguage` and script heuristics). The detected language may be included in the API request as the `source` / `langpair` parameter when a cloud provider is used.

### 2.2 Data stored on your device

Kept in `chrome.storage.local` on your profile, not uploaded to us:

- Settings: extension on/off, target language, provider, blocked sites (“This site”), skip-languages
- Approximate usage counters for MyMemory (per day) and Google (per calendar month)
- A Google Cloud Translation API key, if you paste one
- A generated MyMemory address (`inpulator-…@example.com`) used only as MyMemory’s `de` parameter for quota. It is not a real mailbox and is not your personal email.

### 2.3 Current site hostname

When you open the popup, the extension reads the hostname of the active tab so the “This site” toggle can enable or disable Inpulator on that domain. The hostname is stored only if you add the site to the block list. Other tabs are not queried.

### 2.4 Clipboard (fallback only)

On some editors, replacing or reading the selection needs the clipboard:

- **Read:** if the page selection cannot be read normally, the extension may copy the selection and read that text for translation.
- **Write:** if the translation cannot be inserted with `insertText`, the extension may write the translated string and paste it over the selection.

Clipboard access is not continuous. It is not used to collect data in the background. The write fallback can overwrite whatever was on the clipboard.

---

## 3. How we use information

| Purpose                           | Data                                                  |
| --------------------------------- | ----------------------------------------------------- |
| Translate the selection           | Selected text, language pair                          |
| Show the button and language pair | Selection language (local), your target language      |
| Remember preferences              | Settings in local storage                             |
| Show quota on the button/popup    | Local character counters                              |
| Per-site on/off                   | Hostname of the active tab                            |
| Google Translate requests         | Your API key (sent only to Google, as you configured) |
| MyMemory quota                    | Generated `de` email                                  |

We do not use this information for advertising, profiling, or resale.

---

## 4. Third parties

We do not receive your translations. Depending on the provider you choose, text leaves the browser as follows.

**MyMemory (Translated.net)** — default provider. Selected text, language pair, and the generated `de` address are sent to `api.mymemory.translated.net`. Their practices: [Translated.net](https://translated.com/privacy-policy) / [MyMemory](https://mymemory.translated.net/).

**Google Cloud Translation** — only if you select Google and save your own API key. Selected text and the key are sent to `translation.googleapis.com`. Google’s practices: [Google Privacy Policy](https://policies.google.com/privacy) and [Cloud Data Processing](https://cloud.google.com/terms/data-processing-addendum). Restrict the key to Cloud Translation API and set quotas. Do not share the key.

**Chrome Translator (On-device)** — translation runs in an offscreen document shipped with the extension. Chrome may download official language packs for the pair. Text is not sent to MyMemory or Google through Inpulator in this mode.

Those providers may have their own logs and retention. We do not control them.

---

## 5. Permissions

Chrome shows these permissions because the extension needs them to work. They are not used to collect extra data.

**clipboardRead** — fallback when the highlighted text cannot be read from the field; used only during a translate action.

**clipboardWrite** — fallback to insert the translation over the selection; used only during a translate action.

**storage** — local settings, usage counters, optional Google API key, generated MyMemory address.

**offscreen** — host for Chrome’s on-device Translator API (service workers cannot run it). No extra window is shown.

**activeTab** — when you open the popup or press the shortcut: current tab hostname (“This site”) and a message to translate or read the selection language. The extension does not request the `tabs` permission and does not inspect other tabs.

---

## 6. Host access

`host_permissions` are limited to translation APIs:

- `https://api.mymemory.translated.net/*` — MyMemory, only when that provider is selected
- `https://translation.googleapis.com/*` — Google Cloud Translation, only when that provider is selected and a key is saved

The content script is injected on sites you visit (`<all_urls>`) so the button can appear next to a selection in an editable field on email, chat, and forms. The script does not scrape pages. You can turn the button off globally or for the current site.

---

## 7. Remote code

Inpulator does **not** use remote code.

All JavaScript, CSS, and HTML ship in the extension package. The extension does not load scripts from the network, does not use `eval` / `new Function` on remote strings, and does not execute API responses. MyMemory and Google return JSON; the translated string is inserted into the field as text. Language packs for On-device translation are downloaded by Chrome’s Translator API, not as extension JavaScript.

---

## 8. What we do not do

- No analytics, crash telemetry, or advertising SDKs
- No user accounts
- No sale or sharing of data for advertising
- No logging of translations on our servers (we do not run a translation server)
- No reading of password fields
- No access to the clipboard except the fallback described above

---

## 9. Retention and deletion

Local data stays in your Chrome profile until you change it, clear site/extension data, or uninstall Inpulator. Uninstalling removes `chrome.storage.local` data written by this extension.

Cloud providers may retain request data under their own policies. To stop sending text to them, switch the provider to On-device or turn the extension off.

To request help with this policy, email [disre1717@gmail.com](mailto:disre1717@gmail.com). We cannot delete copies held by MyMemory or Google; contact those services directly.

---

## 10. Children

Inpulator is not directed at children under 13 (or the equivalent age in your country). We do not knowingly collect personal information from children.

---

## 11. International transfers

If you use MyMemory or Google, selected text is processed on those providers’ infrastructure, which may be outside your country. On-device translation does not send the text through those APIs.

---

## 12. Changes

We may update this policy when the extension or its providers change. The effective date at the top will be revised. Continued use after an update means you accept the revised policy.

---

## 13. Contact

- Email: [disre1717@gmail.com](mailto:disre1717@gmail.com)
- Source and issues: [github.com/dynamic1717/inpulator](https://github.com/dynamic1717/inpulator)
