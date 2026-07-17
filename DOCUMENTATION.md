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
- Бесплатный API перевода (MyMemory)

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
TRANSLATE / GET_QUOTA msg  →      Translation service → MyMemory API
                             ←    перевод + quota
        ↓
replace text (native / editable / clipboard)
```

### Компоненты

| Файл                    | Назначение                                          |
| ----------------------- | --------------------------------------------------- |
| `manifest.json`         | Manifest V3, permissions, content scripts, commands |
| `shadow-dom.js`         | Обход shadow boundary, поиск editable от selection  |
| `field-clipboard.js`    | Clipboard fallback для замены текста                |
| `field-native.js`       | Логика для `<input>` / `<textarea>`                 |
| `field-editable.js`     | Логика для `contenteditable`                        |
| `content.js`            | UI кнопки, события, orchestration                   |
| `selection-context.js`  | Контекст выделения, позиция и замена текста         |
| `selection-observer.js` | Батчинг событий выделения и viewport                |
| `runtime-client.js`     | Кэширование quota и обмен сообщениями с background  |
| `floating-ui.js`        | DOM кнопки и toast                                  |
| `background.js`         | Relay сообщений и hotkey                            |
| `translation/`          | Контракт провайдера, MyMemory и сервис перевода     |
| `styles.css`            | Стили кнопки и toast                                |

### Permissions

| Permission                        | Зачем                              |
| --------------------------------- | ---------------------------------- |
| `<all_urls>`                      | Инъекция content script            |
| `host_permissions` (MyMemory)     | API перевода                       |
| `clipboardRead`, `clipboardWrite` | Fallback через буфер обмена        |
| `storage`                         | Локальный счётчик символов за день |

## Определение русского текста

```js
/[\u0400-\u04FF]/.test(selectedText);
```

Не показывать кнопку на `type="password"` и пустых выделениях.

## API перевода

**Текущая реализация:** [MyMemory](https://mymemory.translated.net/doc/spec.php)

| Параметр   | Значение                                      |
| ---------- | --------------------------------------------- |
| Endpoint   | `GET https://api.mymemory.translated.net/get` |
| `langpair` | `ru\|en`                                      |
| `de`       | email для повышенного лимита (50k chars/day)  |
| Max chunk  | 450 символов (API limit ~500 bytes)           |

### Провайдеры и quota

`translation/translation-service.js` даёт content script единый результат
`{ translatedText, provider, quota }`. Сейчас подключён только `mymemory`;
Chrome Translator API добавляется отдельным провайдером без изменений UI или
обработчика сообщений.

- API возвращает `quotaFinished: true` при исчерпании — обрабатывается провайдером MyMemory
- Точный остаток API **не отдаёт**
- Локальный счётчик в `chrome.storage.local` (`dailyUsage`: `{ date, charsUsed }`), лимит 50 000/день
- Счётчик на кнопке: `{selectedLength}/{localRemaining}`

### Альтернативы (не реализованы)

| API                   | Лимит     | Качество |
| --------------------- | --------- | -------- |
| LibreTranslate        | ~100k/мес | Среднее  |
| DeepL Free            | ~500k/мес | Высокое  |
| Chrome Translator API | On-device | Хорошее  |

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
- Текст уходит на MyMemory API
- Email в `de` параметре — для лимита API, хранится в провайдере MyMemory

## Структура проекта

```
input-translate-ext/
├── manifest.json
├── background.js
├── translation/
│   ├── provider.js
│   ├── translation-service.js
│   └── providers/mymemory-provider.js
├── shadow-dom.js
├── field-clipboard.js
├── field-native.js
├── field-editable.js
├── floating-ui.js
├── selection-context.js
├── selection-observer.js
├── runtime-client.js
├── test/                 # unit-тесты чистой логики
├── eslint.config.js
├── .prettierrc.json
└── package.json
├── content.js
├── styles.css
├── README.md           # описание продукта
└── DOCUMENTATION.md    # этот файл
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

### Фаза 3 ✅ (частично)

- Локальный quota counter на кнопке
- Обработка `quotaFinished`
- `de` email для лимита 50k

### Фаза 4 (опционально)

- [ ] Chrome Translator API (offline)
- [ ] Fallback между API
- [ ] Blacklist доменов
- [ ] Popup настроек (email, язык)

## Установка (dev)

1. Клонировать репозиторий
2. `chrome://extensions` → Режим разработчика
3. «Загрузить распакованное расширение» → папка проекта
4. После каждого обновления кода — refresh расширения + **F5 на вкладках**

## Стек

- **JavaScript** (vanilla, без TypeScript и сборки)
- **Manifest V3**
- **MyMemory API**
- **Node test runner**, ESLint и Prettier для локальных проверок

TypeScript и сборка имеют смысл при росте проекта (popup, несколько API, настройки).
