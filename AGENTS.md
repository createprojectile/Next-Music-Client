# AGENTS.md — информация для агентов и поддержка проекта

Этот файл — быстрая шпаргалка для AI-агентов и разработчиков, которые будут
обновлять Next Music Client. Перед изменениями обязательно читай этот файл:
здесь собраны неочевидные детали, которые легко сломать при обновлении.

## 1. Что это за проект

Desktop-модификация веб-клиента Яндекс Музыки на Electron + Vite.

- Главный процесс (Electron): `src/index.js`, `src/lib/**`
- Рендерер (настройки, загрузка, info): `src/renderer/**`
- Скрипты, внедряемые в страницу Яндекс Музыки: `src/inject/**`
- Ассеты, темы, иконки: `src/assets/**`
- Дефолтный конфиг пользователя: `src/defaultConfig.lua`
- Языковые файлы: `src/data/lang/{en,ru}.json`
- Сборка: `vite.config.js` (два режима — renderer и `main`), `electron-builder`

Версия приложения хранится **только** в `package.json` → `version`.
При релизе также обновляются `changelog`/теги в GitHub (см. git log).

## 2. Команды

```
pnpm install
pnpm dev            # vite (:6788) + electron
pnpm build          # сборка в dist/
pnpm build:win      # + NSIS-установщик в release/
pnpm build:linux    # + AppImage/deb/pacman/rpm
pnpm format         # prettier --write .
pnpm format:check
pnpm lint
```

Стиль: Prettier, табуляция, двойные кавычки, `printWidth: 80`.
Коммиты — Conventional Commits (`fix:`, `feat:`, `chore:`, `refactor:`, `docs:`).

## 3. Важно: `.env` и секреты

- `vite.config.js` загружает `.env` через `dotenv` и требует `ENCRYPTION_KEY`.
- Секреты пользователя (`github`, `discord`) хранятся в зашифрованном виде в
  `Config.lua` (путь — `app.getPath("userData")`), см. `src/config.js` →
  `SECRET_KEYS` и `src/lib/config/schema.js`.
- **Никогда** не коммить `.env`, токены и client secret.

## 4. Discord: RPC и OAuth2 (частая точка поломок)

### 4.1 Где что лежит

| Что | Файл |
| --- | --- |
| Discord RPC (Rich Presence) | `src/lib/richPresence.js` |
| OAuth2 + PKCE авторизация (Listen Along) | `src/lib/listenAlong/discordAuth.js` |
| **Единые константы приложения** | `src/lib/discord/config.js` |
| Страница callback после входа | `src/lib/listenAlong/callback/callback.html` |
| Копирование callback-файлов в dist | `vite.config.js` → `copyListenAlongCallback()` |

Раньше `client_id` дублировался в двух файлах, а `redirect_uri` был захардкожен
внутри `discordAuth.js`. Теперь всё импортируется из `src/lib/discord/config.js`.
**Не добавляй новые хардкоженные ID/URI.**

### 4.2 Почему возникает «Некорректный OAuth2 redirect_uri»

Discord сравнивает `redirect_uri` из запроса **символ в символ** со списком
Redirects в настройках приложения
(`https://discord.com/developers/applications/<ID>/oauth2`).
Любое расхождение — `localhost` вместо `127.0.0.1`, другой порт, другой путь,
trailing slash — даёт ошибку «Invalid OAuth2 redirect_uri» ещё на странице Discord.

Оба запроса (авторизация и обмен кода на токен) обязаны использовать **один и
тот же** URI — это гарантируется общим `DISCORD_REDIRECT_URI`.

### 4.3 Переменные окружения (переопределение без правки кода)

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `NEXT_MUSIC_DISCORD_CLIENT_ID` | `1300258490815741952` | ID приложения Discord (RPC + OAuth2) |
| `NEXT_MUSIC_DISCORD_REDIRECT_URI` | `http://127.0.0.1:51820/callback` | точный Redirect из Developer Portal |
| `NEXT_MUSIC_DISCORD_REDIRECT_PORT` | `51820` | порт, если URI не задан явно |

Локальный HTTP-сервер слушает host/port, **вычисленные из redirect URI**, поэтому
при смене URI не нужно вручную менять `server.listen(...)`.

При запуске OAuth в консоль пишется фактический callback URL — первый признак
при диагностике.

### 4.4 Если приложение Discord нужно пересоздать

1. https://discord.com/developers/applications → **New Application** → имя
   `Next Music` → **Create**.
2. Скопировать **Application ID** (он же Client ID).
3. Вкладка **OAuth2 → Redirects → Add Redirect**, ввести ровно:
   `http://127.0.0.1:51820/callback` → **Save Changes**.
4. Client Secret **не нужен** — работает PKCE (`code_challenge_method=S256`).
5. После получения нового Application ID заменить `DEFAULT_CLIENT_ID` в
   `src/lib/discord/config.js`, затем обновить AGENTS.md и README.
6. Если меняется redirect URI — заменить `DEFAULT_REDIRECT_PORT` / путь в
   `src/lib/discord/config.js` и проверить, что URI из п. 3 совпадает с кодом.

Проверка: кнопка подключения в `Настройки → Discord` должна открыть Discord без
ошибки redirect_uri, а после подтверждения — страницу `Congratulations!`.

## 5. Чек-лист обновления приложения

1. Прочитать этот файл и `README.md`.
2. Обновить код; не дублировать константы — добавлять в соответствующий
   `src/lib/**` модуль.
3. Если добавлена новая настройка:
   - `src/defaultConfig.lua` (дефолт),
   - `src/lib/config/schema.js` (схема валидации),
   - `src/lib/listenAlong/state.js` или `src/renderer/settings/modules/state.js`
     (список полей для UI),
   - `src/data/lang/en.json` **и** `src/data/lang/ru.json` (все ключи!).
4. Если добавлен новый файл в `src/lib/**` со статикой — проверить копирование в
   `vite.config.js`.
5. `pnpm format && pnpm format:check && pnpm build`.
6. Закоммитить изменения с Conventional Commits; перед релизом поднять версию
   в `package.json`.

## 6. Чего не делать

- Не хардкодить Discord client ID / redirect URI вне `src/lib/discord/config.js`.
- Не менять `redirect_uri` только в authorize-запросе — обмен токена сломается.
- Не коммитить `.env` и токены.
- Не удалять старые ключи из языковых файлов без проверки всех языков.
- Не биндить callback-сервер на `0.0.0.0` — только loopback.
