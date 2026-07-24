# Inpulator — документация проекта

Техническая документация Chrome-расширения Inpulator.

Пользовательское описание: [README.md](README.md)

## Проблема

При написании сообщений на одном языке часто приходится писать на другом, открывать переводчик, копировать результат и вставлять обратно. Это лишние шаги и потеря времени.

## Решение

Пользователь выделяет текст в `input` / `textarea` / `contenteditable` — рядом появляется плавающая кнопка перевода. Один клик или `Alt+Shift+T` заменяет выделение переводом на **выбранный целевой язык**. Язык источника определяется автоматически.

## User Flow

1. В popup выбран целевой язык (по умолчанию `en`)
2. Пользователь вводит текст и выделяет фрагмент
3. Content script определяет язык источника; если он ≠ target и не в исключениях — показывается кнопка с кодами пары и счётчиком
4. Нажатие на кнопку или hotkey → `TRANSLATE` с `sourceLanguage`
5. Background/service переводит через выбранный provider
6. Переведённый текст подставляется на место выделения
7. Кнопка исчезает при снятии выделения

## Требования

- Направление: **любая пара** из shipped-языков (target в настройках, source — автоопределение)
- Кнопка не показывается при `source === target` и для языков из `disabledSourceLanguages`
- Фокус на скорость и удобство
- Бесплатный API перевода (MyMemory) / Google Cloud Translation / Chrome on-device

## Архитектура

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
floating button UI (пара на иконке)
        ↓
TRANSLATE { text, sourceLanguage }  →  Translation service
  GET_QUOTA / GET_SELECTION_LANGUAGE     → providers (mapped codes)
                             ←    перевод + quota
        ↓
replace text (native / editable / clipboard)
```

### Компоненты

| Файл                             | Назначение                                                  |
| -------------------------------- | ----------------------------------------------------------- |
| `manifest.json`                  | Manifest V3, permissions, content scripts, commands         |
| `languages.js`                   | IIFE: реестр языков, shortLabel, mapLanguageCodes           |
| `settings.js`                    | IIFE: чтение/запись `extensionSettings`                     |
| `settings-defaults.js`           | ES-модуль констант настроек для background                  |
| `language-detect.js`             | IIFE: `chrome.i18n.detectLanguage` + скриптовый fallback    |
| `popup/`                         | Настройки: языки, сайт, провайдер, ключ, пакеты Chrome      |
| `offscreen/`                     | Host для Chrome Translator API                              |
| `offscreen-manager.js`           | Создание offscreen document и messaging                     |
| `shadow-dom.js`                  | Обход shadow boundary, поиск editable от selection          |
| `field-clipboard.js`             | Clipboard fallback для замены текста                        |
| `field-native.js`                | Логика для `<input>` / `<textarea>`                         |
| `field-editable.js`              | Логика для `contenteditable`                                |
| `content.js`                     | UI кнопки, события, orchestration, гейт настроек            |
| `selection-context.js`           | Контекст выделения, позиция и замена текста                 |
| `selection-observer.js`          | Батчинг событий выделения и viewport                        |
| `runtime-client.js`              | Кэширование quota и обмен сообщениями с background          |
| `floating-ui.js`                 | DOM кнопки (динамическая пара на SVG) и toast               |
| `background.js`                  | Relay сообщений, hotkey, иконка action, Chrome model status |
| `translation/languages.js`       | ES-модуль реестра языков                                    |
| `translation/language-detect.js` | ES-модуль детекции (для тестов / shared logic)              |
| `translation/`                   | Контракт, text-utils, Google/MyMemory/Chrome, сервис        |
| `styles.css`                     | Стили кнопки и toast                                        |
| `icons/*-disabled.png`           | Grayscale-иконки при выключенном расширении                 |

### Permissions

| Permission                        | Зачем                                 |
| --------------------------------- | ------------------------------------- |
| `<all_urls>`                      | Инъекция content script               |
| `host_permissions` (MyMemory)     | API MyMemory                          |
| `host_permissions` (Google)       | Cloud Translation API                 |
| `clipboardRead`, `clipboardWrite` | Fallback через буфер обмена           |
| `storage`                         | Счётчики usage и настройки popup      |
| `offscreen`                       | On-device Chrome Translator API       |
| `activeTab`                       | URL вкладки и язык выделения из popup |

## Языки

Канонический реестр: `translation/languages.js` / `languages.js`.

**Shipped (v1):** `en`, `ru`, `es`, `fr`, `de`, `zh`

**Заготовки (`shipped: false`):** `ar`, `hi` — в UI не показываются, готовы к включению.

Каждый язык: `id`, `name`, `flag`, `shortLabel` (для кнопки), `providerCodes` (маппинг в коды API; для китайского Google/MyMemory → `zh-CN`, Chrome → `zh`).

### Определение языка источника

1. `chrome.i18n.detectLanguage` (CLD3) — язык с наибольшим `percentage`
2. Если ненадёжно / вне реестра — fallback по Unicode-скриптам и диакритике (`ñ`→es, `äöüß`→de, `àâçé`→fr, иначе латиница→en)

Гейт кнопки (`isTranslatable`):

- есть текст;
- source из shipped;
- `source ∉ disabledSourceLanguages`;
- `source !== targetLanguage`.

## Настройки (`extensionSettings`)

Ключ в `chrome.storage.local`:

```js
{
  enabled: true,
  showCharCounter: true,
  provider: 'mymemory',
  blockedDomains: [],
  targetLanguage: 'en',
  disabledSourceLanguages: [],
}
```

- **enabled** — глобальный вкл/выкл; `chrome.action.setIcon` переключает цветные / grayscale иконки
- **showCharCounter** — показывать ли `выделено/остаток` на плавающей кнопке
- **provider** — `mymemory` (default), `chrome` или `google`
- **blockedDomains** — домены, где UI перевода не показывается (toggle «На этом сайте» в popup)
- **targetLanguage** — канонический id целевого языка
- **disabledSourceLanguages** — канонические id источников, для которых кнопка не показывается
- Popup: `action.default_popup` → `popup/popup.html`
- Изменения применяются через `chrome.storage.onChanged` без reload страницы

### Popup: исключения языков

- Pills с × для уже исключённых языков
- Если на вкладке есть выделение — строка «Сейчас: …» + «Исключить»
- Иначе — компактный select + «Исключить»
- Сообщение content script: `GET_SELECTION_LANGUAGE`

## Google API key

Google API key пользователь добавляет в popup. Ключ хранится локально в
`chrome.storage.local` под отдельным ключом `googleTranslateApiKey` и не включается
в исходный код или распространяемую папку расширения. Ключ нужно ограничить Cloud
Translation API и квотами проекта Google Cloud.

## API перевода

Пара языков: `{ source, target }` после `mapLanguageCodes(providerId, pair)`.  
`TRANSLATE` передаёт `sourceLanguage`; `target` берётся из `settings.targetLanguage`.

### Chrome Translator API

On-device через offscreen document (`offscreen/offscreen.js`). Service worker вызывает `Translator` только через messaging.

| Параметр   | Значение                                        |
| ---------- | ----------------------------------------------- |
| API        | `Translator.availability` / `Translator.create` |
| Languages  | Любая поддерживаемая Chrome пара (BCP 47)       |
| Quota      | Нет локального лимита (`period: 'none'`)        |
| Требования | Chrome 138+ desktop; permission `offscreen`     |

- Статус/скачивание в popup: пара = язык выделения (если есть) → `targetLanguage`; fallback `ru→en` или `en→target`
- `isAvailable` истинен для `available` / `downloadable` / `downloading` — при переводе пакеты качаются on-demand через `Translator.create`
- Кэш translator instances в offscreen по ключу `source|target`

### Google Cloud Translation

| Параметр  | Значение                                                        |
| --------- | --------------------------------------------------------------- |
| Endpoint  | `POST https://translation.googleapis.com/language/translate/v2` |
| Auth      | `key` query param                                               |
| Languages | `source` / `target` из пары (китайский: `zh-CN`)                |
| Max chunk | ~4000 символов                                                  |
| Quota     | Локально 500 000 / календарный месяц (`googleMonthlyUsage`)     |

### MyMemory

| Параметр     | Значение                                                    |
| ------------ | ----------------------------------------------------------- |
| Endpoint     | `GET https://api.mymemory.translated.net/get`               |
| `langpair`   | `{source}\|{target}` (китайский: `zh-CN`)                   |
| Max chunk    | 450 символов                                                |
| Quota        | Локально 50 000 / день (`dailyUsage`)                       |
| Email (`de`) | Автогенерируется при установке и хранится в `myMemoryEmail` |

### Выбор провайдера

`translation/translation-service.js` читает `settings.provider`.

- `getQuota` — всегда quota выбранного провайдера
- `translate(text, { sourceLanguage })` вызывает только выбранный провайдер
- отсутствие Google API key, недоступный Chrome Translator и исчерпанный локальный лимит возвращают ошибку без автоматического переключения
- Ответ: `{ translatedText, provider, quota }` — `provider` всегда соответствует выбранному движку

### Альтернативы (не реализованы)

| API            | Лимит     | Качество |
| -------------- | --------- | -------- |
| LibreTranslate | ~100k/мес | Среднее  |
| DeepL Free     | ~500k/мес | Высокое  |

## Поддержка типов полей

| Тип поля                    | Статус | Примечание                                                 |
| --------------------------- | ------ | ---------------------------------------------------------- |
| `<input>`, `<textarea>`     | ✅     | `selectionStart/End`, mirror-div для позиции               |
| `contenteditable`           | ✅     | `Range`, `insertText`, `InputEvent`                        |
| React/Vue controlled        | ✅     | `dispatchEvent('input')`                                   |
| Shadow DOM (Gmail, ChatGPT) | ✅     | Обход от `selection.anchorNode` через `getRootNode().host` |
| Cross-origin iframe         | ❌     | Content script недоступен                                  |

## Shadow DOM

`chrome.dom.openOrClosedShadowRoot` **не используется** — вызывает `Extension context invalidated` после перезагрузки расширения без refresh вкладки.

Вместо этого:

- Подъём от узла selection через `parentNode` / `DocumentFragment.host`
- `selectionchange` для синхронизации видимости кнопки
- Clipboard fallback (`insertText` → `paste`) для сложных редакторов

## Content scripts: изоляция scope

Все module-файлы обёрнуты в IIFE с guard-флагами (`__inputTranslate*`) — повторная инъекция при обновлении расширения не вызывает `Identifier already declared`.

Общее API: `window.InputTranslate.{languages, settings, languageDetect, shadow, clipboard, native, editable, selectionContext, runtimeClient, floatingUi, extension}`.

Порядок скриптов в manifest: `languages.js` → `settings.js` → `language-detect.js` → …

## UX-детали

- Позиция кнопки: `getBoundingClientRect()` выделения
- Иконка кнопки: SVG с `shortLabel` source (верх) и target (низ)
- Hotkey: **Alt+Shift+T** (`chrome.commands` → background → content script)
- Loading: спиннер на кнопке
- Ошибки: toast внизу экрана
- Ctrl+Z работает после замены (через `insertText` / native value)
- Extension context invalidated → toast «Reload page to use Inpulator»

## Безопасность

- Не активируется на полях паролей
- Не логирует переводы
- Текст уходит на Google Cloud Translation и/или MyMemory при выборе этих провайдеров
- Google API key хранится локально в `chrome.storage.local`; распространение общего ключа запрещено

## Структура проекта

```
input-translate-ext/
├── manifest.json
├── background.js
├── languages.js
├── settings.js
├── settings-defaults.js
├── language-detect.js
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
├── test/
├── content.js
├── floating-ui.js
├── styles.css
├── README.md
└── DOCUMENTATION.md
```

## История разработки

### Фаза 1 ✅

- `input` и `textarea`
- Плавающая кнопка при кириллице
- MyMemory API
- Loading и error states

### Фаза 2 ✅

- `contenteditable`
- Hotkey `Alt+Shift+T`

### Фаза 2.5 ✅

- Shadow boundary traversal от selection
- Clipboard fallback
- IIFE guards для content scripts

### Фаза 3 ✅

- Локальный quota counter на кнопке
- Обработка `quotaFinished`

### Фаза 4 ✅

- Popup настроек: лимит, вкл/выкл, счётчик на кнопке
- Grayscale-иконка action при выключении

### Фаза 5 ✅

- Google Cloud Translation API
- Выбор провайдера в popup
- Личный Google API key в `chrome.storage.local`

### Фаза 6 ✅

- Chrome Translator API (on-device)
- Offscreen document + permission `offscreen`
- Выбранный провайдер без автоматического fallback

### Фаза 7 ✅

- Исключённые домены (toggle «На этом сайте»)
- Мультиязычный перевод: target в popup, автоопределение source
- Исключения языков-источников
- Динамическая пара на иконке кнопки
- Chrome-пакеты по фактической паре (+ auto-download при переводе)

## Установка (dev)

1. Клонировать репозиторий
2. `npm install`
3. `chrome://extensions` → Режим разработчика
4. «Загрузить распакованное расширение» → папка проекта
5. После каждого обновления кода — refresh расширения + **F5 на вкладках**

## Стек

- **JavaScript** (vanilla, без TypeScript и полной сборки)
- **Manifest V3**
- **Google Cloud Translation API** + **MyMemory API** + **Chrome Translator API**
- **Node test runner**, ESLint и Prettier для локальных проверок
