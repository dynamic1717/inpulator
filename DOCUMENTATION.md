# Input Translate — документация проекта

Техническая документация Chrome-расширения Input Translate.

Пользовательское описание: [README.md](README.md)

## Проблема

При написании сообщений на английском часто приходится писать на русском, открывать переводчик, копировать результат и вставлять обратно. Это лишние шаги и потеря времени.

## Решение

Пользователь выделяет русский текст в `input` / `textarea` / `contenteditable` — рядом появляется плавающая кнопка перевода. Один клик или `Alt+Shift+T` заменяет выделение на английский перевод.

## User Flow

1. Пользователь вводит текст на русском
2. Выделяет нужный фрагмент
3. Появляется плавающая кнопка с счётчиком `выделено/остаток`
4. Нажатие на кнопку или hotkey → запрос к API
5. Переведённый текст подставляется на место выделения
6. Кнопка исчезает при снятии выделения

## Требования

- Личное использование
- Направление перевода: **RU → EN** (только)
- Кнопка показывается только если в выделении есть кириллица
- Фокус на скорость и удобство
- Бесплатный API перевода (MyMemory) / Google Cloud Translation

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
floating button UI
        ↓
TRANSLATE / GET_QUOTA msg  →      Translation service → Google / MyMemory
                             ←    перевод + quota
        ↓
replace text (native / editable / clipboard)
```

### Компоненты

| Файл                    | Назначение                                          |
| ----------------------- | --------------------------------------------------- |
| `manifest.json`         | Manifest V3, permissions, content scripts, commands |
| `settings.js`           | IIFE: чтение/запись `extensionSettings`             |
| `settings-defaults.js`  | ES-модуль констант настроек для background          |
| `env.js`                | Сгенерированные креды (`npm run env`)               |
| `popup/`                | Окно настроек (лимит, провайдер, вкл/выкл, счётчик) |
| `offscreen/`            | Host для Chrome Translator API                      |
| `offscreen-manager.js`  | Создание offscreen document и messaging             |
| `shadow-dom.js`         | Обход shadow boundary, поиск editable от selection  |
| `field-clipboard.js`    | Clipboard fallback для замены текста                |
| `field-native.js`       | Логика для `<input>` / `<textarea>`                 |
| `field-editable.js`     | Логика для `contenteditable`                        |
| `content.js`            | UI кнопки, события, orchestration, гейт настроек    |
| `selection-context.js`  | Контекст выделения, позиция и замена текста         |
| `selection-observer.js` | Батчинг событий выделения и viewport                |
| `runtime-client.js`     | Кэширование quota и обмен сообщениями с background  |
| `floating-ui.js`        | DOM кнопки и toast                                  |
| `background.js`         | Relay сообщений, hotkey, иконка action              |
| `translation/`          | Контракт, text-utils, Google/MyMemory, сервис       |
| `styles.css`            | Стили кнопки и toast                                |
| `icons/*-disabled.png`  | Grayscale-иконки при выключенном расширении         |

### Permissions

| Permission                        | Зачем                            |
| --------------------------------- | -------------------------------- |
| `<all_urls>`                      | Инъекция content script          |
| `host_permissions` (MyMemory)     | API MyMemory                     |
| `host_permissions` (Google)       | Cloud Translation API            |
| `clipboardRead`, `clipboardWrite` | Fallback через буфер обмена      |
| `storage`                         | Счётчики usage и настройки popup |
| `offscreen`                       | On-device Chrome Translator API  |

## Настройки (`extensionSettings`)

Ключ в `chrome.storage.local`:

```js
{ enabled: true, showCharCounter: true, provider: 'chrome' }
```

- **enabled** — глобальный вкл/выкл: скрывает кнопку, блокирует hotkey; `chrome.action.setIcon` переключает цветные / grayscale иконки
- **showCharCounter** — показывать ли `выделено/остаток` на плавающей кнопке
- **provider** — `chrome` (default), `google` или `mymemory`
- Popup: `action.default_popup` → `popup/popup.html`
- Изменения применяются через `chrome.storage.onChanged` без reload страницы

## Креды (env)

```bash
cp .env.example .env   # заполнить ключи
npm run env            # → env.js
```

| Переменная                 | Назначение                        |
| -------------------------- | --------------------------------- |
| `GOOGLE_TRANSLATE_API_KEY` | Cloud Translation API v2          |
| `MYMEMORY_EMAIL`           | Параметр `de` для лимита MyMemory |

`.env` и `env.js` в `.gitignore`.

## Определение русского текста

```js
/[\u0400-\u04FF]/.test(selectedText);
```

Не показывать кнопку на `type="password"` и пустых выделениях.

## API перевода

### Chrome Translator API (default)

On-device через offscreen document (`offscreen/offscreen.js`). Service worker вызывает `Translator` только через messaging.

| Параметр   | Значение                                        |
| ---------- | ----------------------------------------------- |
| API        | `Translator.availability` / `Translator.create` |
| Languages  | `sourceLanguage=ru`, `targetLanguage=en`        |
| Quota      | Нет локального лимита (`period: 'none'`)        |
| Требования | Chrome 138+ desktop; permission `offscreen`     |

### Google Cloud Translation

| Параметр  | Значение                                                        |
| --------- | --------------------------------------------------------------- |
| Endpoint  | `POST https://translation.googleapis.com/language/translate/v2` |
| Auth      | `key` query param                                               |
| Languages | `source=ru`, `target=en`, `format=text`                         |
| Max chunk | ~4000 символов                                                  |
| Quota     | Локально 500 000 / календарный месяц (`googleMonthlyUsage`)     |

### MyMemory

| Параметр   | Значение                                      |
| ---------- | --------------------------------------------- |
| Endpoint   | `GET https://api.mymemory.translated.net/get` |
| `langpair` | `ru\|en`                                      |
| `de`       | email из env                                  |
| Max chunk  | 450 символов                                  |
| Quota      | Локально 50 000 / день (`dailyUsage`)         |

### Выбор провайдера и fallback

`translation/translation-service.js` читает `settings.provider`.

- `getQuota` — всегда quota выбранного провайдера
- `translate` при `chrome`: если unavailable → Google (если ключ и quota) → MyMemory
- `translate` при `google`: если локальный `remaining` меньше длины текста → MyMemory
- `translate` при `mymemory`: только MyMemory
- Ошибки сети/ключа Google **не** маскируются fallback’ом (только quota / chrome unavailable)
- Ответ: `{ translatedText, provider, quota }` — `provider` = фактический движок

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

Общее API: `window.InputTranslate.{shadow, clipboard, native, editable, extension}`.

## UX-детали

- Позиция кнопки: `getBoundingClientRect()` выделения
- Hotkey: **Alt+Shift+T** (`chrome.commands` → background → content script)
- Кнопка скрывается при `selectionchange` без кириллицы
- Loading: спиннер на кнопке
- Ошибки: toast внизу экрана
- Ctrl+Z работает после замены (через `insertText` / native value)
- Extension context invalidated → toast «Reload page to use Input Translate»

## Безопасность

- Не активируется на полях паролей
- Не логирует переводы
- Текст уходит на Google Cloud Translation и/или MyMemory
- Креды только в `.env` / `env.js` (не коммитятся)

## Структура проекта

```
input-translate-ext/
├── manifest.json
├── background.js
├── env.js                 # generated, gitignored
├── .env.example
├── settings.js
├── settings-defaults.js
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.js
├── offscreen-manager.js
├── translation/
│   ├── provider.js
│   ├── text-utils.js
│   ├── translation-service.js
│   └── providers/
│       ├── chrome-provider.js
│       ├── google-provider.js
│       └── mymemory-provider.js
├── popup/
├── scripts/generate-env.mjs
├── test/
├── content.js
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
- `de` email для лимита 50k

### Фаза 4 ✅

- Popup настроек: лимит, вкл/выкл, счётчик на кнопке
- Grayscale-иконка action при выключении

### Фаза 5 ✅

- Google Cloud Translation API
- Выбор провайдера в popup
- Fallback Google→MyMemory при исчерпании локального лимита
- Креды через `.env` → `npm run env`

### Фаза 6 ✅

- Chrome Translator API (on-device) как default
- Offscreen document + permission `offscreen`
- Fallback Chrome → Google → MyMemory

### Фаза 7 (опционально)

- [ ] Blacklist доменов
- [ ] Настройки направления перевода

## Установка (dev)

1. Клонировать репозиторий
2. `cp .env.example .env` и заполнить ключи
3. `npm install && npm run env`
4. `chrome://extensions` → Режим разработчика
5. «Загрузить распакованное расширение» → папка проекта
6. После каждого обновления кода — refresh расширения + **F5 на вкладках**
7. После смены `.env` — снова `npm run env` + refresh расширения

## Стек

- **JavaScript** (vanilla, без TypeScript и полной сборки)
- **Manifest V3**
- **Google Cloud Translation API** + **MyMemory API** + **Chrome Translator API**
- **Node test runner**, ESLint и Prettier для локальных проверок
- Генерация `env.js` через `npm run env`
