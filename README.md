# Input Translate — Chrome Extension

Расширение для Chrome: перевод выделенного текста с русского на английский прямо в полях ввода.

## Проблема

При написании сообщений на английском часто приходится писать на русском, открывать переводчик, копировать результат и вставлять обратно. Это лишние шаги и потеря времени.

## Решение

Пользователь выделяет русский текст в `input` / `textarea` / `contenteditable` — рядом появляется кнопка перевода. Один клик заменяет выделение на английский перевод.

## User Flow

1. Пользователь вводит текст на русском
2. Выделяет нужный фрагмент
3. Появляется плавающая кнопка перевода
4. Нажатие на кнопку → запрос к API перевода
5. Переведённый текст подставляется на место выделения
6. Кнопка исчезает

## Требования

- Личное использование
- Направление перевода: **RU → EN** (только)
- Кнопка показывается только если в выделении есть кириллица
- Фокус на скорость и удобство
- Бесплатный API перевода

## Архитектура

```
Content Script          Background (Service Worker)
─────────────────       ────────────────────────────
selection listener  →   API-запрос (обход CORS)
floating button UI  ←   перевод
замена текста
```

### Компоненты

| Файл | Назначение |
|------|------------|
| `manifest.json` | Manifest V3, permissions, content scripts, commands |
| `field-native.js` | Логика для `<input>` / `<textarea>` |
| `field-editable.js` | Логика для `contenteditable` |
| `content.js` | UI кнопки, события, orchestration |
| `background.js` | Запросы к API перевода, hotkey relay |
| `styles.css` | Стили плавающей кнопки |

### Permissions

- `<all_urls>` — инъекция content script
- `host_permissions` — доступ к API перевода

## Определение русского текста

```js
/[\u0400-\u04FF]/.test(selectedText)
```

Не показывать кнопку на `type="password"` и пустых выделениях.

## API перевода (варианты)

| API | Лимит | Ключ | Качество |
|-----|-------|------|----------|
| MyMemory | ~5 000 символов/день | Не нужен | Среднее |
| LibreTranslate | ~100 000 символов/мес | Бесплатный | Среднее |
| DeepL Free | ~500 000 символов/мес | Нужен | Высокое |
| Chrome Translator API | Без лимита | On-device | Хорошее |

**MVP:** MyMemory или LibreTranslate.

## Технические ограничения

| Тип поля | Сложность | Статус |
|----------|-----------|--------|
| `<input>`, `<textarea>` | Низкая | ✅ |
| `contenteditable` (Gmail, Slack) | Высокая | ✅ |
| React/Vue controlled inputs | Средняя — нужен `dispatchEvent('input')` | ✅ |
| Cross-origin iframe | Недоступно | — |
| Closed Shadow DOM | Недоступно | — |

## MVP Scope

### Фаза 1 ✅
- [x] `input` и `textarea` на всех сайтах
- [x] Плавающая кнопка при кириллице
- [x] Интеграция с MyMemory
- [x] Loading и error states

### Фаза 2 ✅
- [x] Поддержка `contenteditable`
- [x] Горячая клавиша `Alt+Shift+T`

### Фаза 3 (опционально)
- [ ] Chrome Translator API (offline)
- [ ] Fallback между API
- [ ] Blacklist доменов

## UX-детали

- Позиция кнопки: `getBoundingClientRect()` выделения
- Горячая клавиша: **Alt+Shift+T** — перевод без клика по кнопке
- Скрывать при scroll, resize, смене выделения
- Состояние загрузки на кнопке во время запроса
- При ошибке — не менять текст, показать уведомление
- Ctrl+Z должен работать после замены

## Безопасность

- Не активироваться на полях паролей
- API key хранить в `chrome.storage.local`, не в коде
- Не логировать переводы
- Текст уходит на внешний сервер (кроме on-device API)

## Установка (dev)

1. Клонировать репозиторий
2. Открыть `chrome://extensions`
3. Включить «Режим разработчика»
4. «Загрузить распакованное расширение» → выбрать папку проекта

## Стек

- **JavaScript** (vanilla, без TypeScript и сборки)
- **Manifest V3**
- **MyMemory API** — бесплатный, без API key

TypeScript для MVP не обязателен: расширение маленькое, загружается напрямую через «Load unpacked». TypeScript имеет смысл добавить позже, если проект вырастет.

## Ограничения contenteditable

- **Closed Shadow DOM** (часть Slack/Discord) — content script не проникает
- **Rich text** — вставляется plain text, форматирование выделения теряется
- **Cross-origin iframe** — недоступно

## Структура проекта

```
input-translate-ext/
├── manifest.json       # конфигурация расширения
├── background.js       # service worker, API, hotkey relay
├── field-native.js     # input/textarea: выделение и замена
├── field-editable.js   # contenteditable: выделение и замена
├── content.js          # UI кнопки, события, orchestration
├── styles.css          # стили кнопки и toast
└── README.md
```

## Статус

**Фаза 1 и Фаза 2 реализованы.**

- [x] `input`, `textarea`, `contenteditable`
- [x] Плавающая кнопка при кириллице
- [x] Горячая клавиша Alt+Shift+T
- [x] Интеграция с MyMemory
- [x] Loading и error states
