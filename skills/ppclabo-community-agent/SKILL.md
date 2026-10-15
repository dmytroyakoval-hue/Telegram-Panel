---
name: ppclabo-community-agent
description: Разработка внешнего модуля PPC Labo Community Agent для Telegram-Panel: интервальные сообщения в разрешённые чаты, AI-комментарии к новым постам каналов и контекстные AI-reply в группах. Использовать при проектировании, реализации, обновлении, тестировании или переносе этого модуля.
---

# PPC Labo Community Agent

## Базовая версия

- Upstream: `moeacgx/Telegram-Panel` tag/version `1.31.88`, upstream SHA `1ae1e42b62e6a87d6d8d1a0940bebd5f4876d050`.
- Пользовательский fork: `dmytroyakoval-hue/Telegram-Panel`.
- Русская baseline-ветка: `ru-localization-v1.31.88`, SHA `ef2edcf818f6456d11b80a2af928e122bdcd3463`.
- Ветка разработки модуля: `community-agent-dev-v1.31.88`.
- Перед любой разработкой модуля сначала читать встроенный skill `skills/tgpanel-module-workflow/SKILL.md` и его ABI/packaging references.

## Архитектурное правило

Разрабатывать Community Agent как внешний `.tpm`-модуль. Не размазывать бизнес-логику по TelegramPanel.Core/Web/frontend. Изменять host только если нужную возможность невозможно получить через модуль; тогда предпочитать маленький общий abstraction contract вместо feature-specific patch.

Модуль должен иметь собственное хранилище в `ModulesRootPath/data/ppclabo.community-agent` и собственный management API под `/api/panel/extensions/community-agent`.

## Три обязательных сценария

### 1. Periodic Presence

Отправлять подготовленное сообщение в разные allowlisted чаты с независимым интервалом, например 24/48/72 часа.

Использовать `IModulePersistentTaskHandler` и `IModulePersistentTaskExecutionHost.DeferAsync(nextEligibleAtUtc,...)`, а не имитировать interval через Cron. После успешной отправки вычислять следующий запуск от фактического времени отправки. Перезапуск контейнера не должен сбрасывать интервал.

Конфиг минимум: account/account source, targets, intervalHours, message rules, selection mode, enabled. Хранить историю отправок и dedup key.

### 2. Channel AI Comment

Следить только за явно выбранными каналами. На новый channel post получать текст и при необходимости media/context, генерировать комментарий через host AI и публиковать его в linked discussion.

Важно: `AccountTelegramToolsService.SendMessageToResolvedChatAsync(... replyToMessageId)` достаточен для обычного chat reply, но в host 1.31.88 нет отдельного helper для channel comments. Для канала использовать WTelegram:

1. `Client.Messages_GetDiscussionMessage(channelPeer, postId)`.
2. Взять discussion root message и его peer из `discussion.chats`.
3. Отправить сообщение в discussion peer с `reply_to_msg_id = root.id`.

Не считать простой `reply_to` на channel peer эквивалентом комментария.

Поддержать dedup по `accountId + channelId + postId`, задержку, лимиты и режимы `draft/manual approval` и `auto`.

### 3. Contextual Chat Reply

Слушать только allowlisted groups/chats. Для каждого incoming message:

- пропускать собственные сообщения, service messages и при необходимости bots;
- поддержать triggers `reply_to_me`, `mention_me`, keyword/semantic relevance;
- собрать 5-15 релевантных сообщений контекста;
- первым AI-вызовом решить `ANSWER/IGNORE` при широком мониторинге;
- вторым AI-вызовом сформировать ответ;
- отправлять reply именно к исходному message ID;
- записывать sent message ID, чтобы распознавать последующие ответы на наши сообщения.

Для внешних публичных сообществ по умолчанию использовать review/approve workflow; полностью автоматический режим включать только явно.

## Доступные host API на 1.31.88

Стабильный `TelegramPanel.Modules.Abstractions`:

- `ITelegramPanelModule`
- `IModuleTaskProvider`
- `IModuleTaskHandler`
- `IModulePersistentTaskHandler`
- `IModulePersistentTaskExecutionHost.DeferAsync / CompleteAsync / RequestPauseAsync`
- `IModuleTaskLifecycleHandler`
- `IModuleTaskStatusProvider`
- `IModuleApiProvider` / `IModuleUiProvider`
- `ITelegramPanelAiService.ChooseActionAsync`
- `ITelegramPanelAiService.ReplyTextAsync`

Внутренний `TelegramPanel.Core`, который нужен для live-функций:

- `TelegramAccountUpdateHub`
- `TelegramAccountMessageUpdate`
- `AccountTelegramToolsService`
- `ITelegramClientPool`

`TelegramAccountUpdateHub` в 1.31.88 хранит только последние 10 минут и максимум 200 сообщений на аккаунт в памяти. Всё важное для inbox/reply tracking сохранять в БД модуля сразу.

`TelegramAccountMessageUpdate` уже содержит `ReplyToMessageId`, `ThreadId`, sender data, исходный TL `Message` и buttons.

`AccountTelegramToolsService` уже умеет `ResolveChatTargetAsync` и `SendMessageToResolvedChatAsync(..., replyToMessageId)`.

## ABI и обновления

Любая ссылка на `TelegramPanel.Core/Data/Web` является ABI binding. Пока live update stream не вынесен в abstractions:

- ставить `host.min = 1.31.88`;
- собирать модуль против точного production SHA;
- после каждого обновления host перепроверять сигнатуры UpdateHub, message model, AccountTelegramToolsService и ITelegramClientPool;
- запускать compile + package verification + isolated host smoke;
- не класть `TelegramPanel.*.dll` внутрь TPM.

Если будущий host ломает Core ABI, сначала рассмотреть добавление маленького стабильного abstraction для message stream/send/reply вместо постоянного патчинга модуля.

## UI и данные

Предпочтение: self-contained static Vue page внутри модуля, чтобы обновления host frontend не требовали merge. Razor использовать только как fallback.

Минимальные сущности модуля:

- monitor/task settings;
- allowed targets;
- inbound message/event ledger;
- sent message ledger;
- reply links;
- AI drafts/review queue;
- runtime heartbeat/error state.

Не хранить отдельные Telegram API credentials, proxy credentials или AI keys, если они уже управляются host. Использовать аккаунты/proxy/client pool/AI host.

## Подтверждённые приватные/внешние модули автора

Текущий приватный код недоступен, но публичная git-history даёт подтверждённые контракты. Commit `9c0baab` от 2026-07-03 называется `fix: remove private modules from release`; его parent содержит host UI для нескольких private modules:

- `pro.channel-push` — группы каналов, слоты публикации, Cron, Fixed/Random creatives, веса, удаление/ротация и логи. Это ближайший готовый модуль автора к сценарию Periodic Presence; перед собственной реализацией узнать, продаётся ли актуальная версия и поддерживает ли elapsed interval 24/48/72h, а не только Cron.
- `pro.bot-monitor-notify` — мониторинг выбранных источников через Bot или user account, cooldown и уведомления в выбранные targets. Полезен как готовая monitoring infrastructure, но публичный контракт не показывает AI contextual replies.
- `pro.sync-forward` — user/Bot receiver, history clone + realtime watch, watch-only/clone-only, source→target, filters/replacements и persistent progress. Полезен как доказательство зрелого live-watch engine у автора.
- `pro.channel-member-gate` — слушает membership updates через host `BotUpdateHub` и распространяет kick/ban с master на child chats; не целевой сценарий, но подтверждает event-driven private modules.
- `pro.direct-messaging` — предоставляет `direct_message.live` и `direct_message.batch`; host ожидает endpoints `/extensions/direct-messaging/options`, `.../accounts/{id}/groups`, `.../assets`; модуль ведёт dedup ledger, cooldown и rolling-24h limits. В upstream history упоминаются отдельные module tests (86/86).
- `fragment-username-checker` 1.2.9+ — `fragment_username_monitor`; не относится к Community Agent.
- Исторически также существовал `pro.external-otp`; к Community Agent не относится.
- `demo.kick-api` позже вынесен в официальный публичный `Telegram-Panel-Modules`.

Исторический README автора прямо предлагал коммерческие внешние модули и кастомную разработку через Telegram `@SNINKBOT` (данные из истории 2025-12, актуальность контакта нужно проверить перед обращением).

До написания Community Agent сначала спросить автора об актуальных `pro.channel-push`, `pro.bot-monitor-notify`, `pro.sync-forward`, `pro.direct-messaging` и наличии отдельного AI/comment/community module. Не предполагать функциональность, которой нет в публичных контрактах.

## Публично засвеченный исходный код модулей автора

В upstream git-history реально сохранился полный код двух семейств модулей. Использовать их прежде всего как точные примеры архитектуры автора; не републиковывать удалённый код без проверки лицензии/разрешения.

### MessageReport — лучший архитектурный donor

Deletion commit: `dfbf86230d066fa67d75b6bd21b116ccf288a10a` от 2026-03-10 (`chore: 删除 message report 模块`).
Последний parent с полным исходным кодом: `58273b12cde9f2d9bb91ad75475efaf3d114a33b`.

В parent доступны две версии:
- `src/TelegramPanel.Modules.MessageReport/**`
- `src/TelegramPanel.Modules.MessageReportTask/**`

Новая версия содержит `manifest.json`, `MessageReportTaskModule.cs`, editor Razor, models, handler, rerun builder, `TelegramMessageReportService.cs` и csproj. Manifest: module id `task.message-report`, version `1.0.0`, host min `1.31.6`.

Архитектура особенно полезна нам:
- csproj напрямую ссылается на `Modules.Abstractions`, `Core`, `Data` и WTelegram;
- `ConfigureServices` регистрирует собственный Telegram service, `IModuleTaskHandler` и `IModuleTaskRerunBuilder`;
- handler получает host services через `host.Services.GetRequiredService<T>()`, использует `IsStillRunningAsync`, пишет progress/config и обрабатывает delay/cancel/error;
- Telegram service инжектит `AccountTelegramToolsService` + `ITelegramClientPool`, получает raw `WTelegram.Client` и выполняет MTProto методы напрямую.

Это подтверждает, что Core-binding для нашего Community Agent соответствует реальному паттерну самого автора.

### FragmentUsernameChecker

До удаления private modules полный исходник существовал в:
- `modules/fragment-username-checker/FragmentUsernameChecker.csproj`
- `manifest.json`
- `src/FragmentCheckerService.cs`
- `src/FragmentUsernameCheckerModule.cs`
- `src/FragmentUsernameTaskHandler.cs`
- `src/Pages/FragmentUsernamePage.razor`
- `modules/build-fragment-module.ps1`

Код доступен, например, на parent перед `9c0baab`: `4109a0d383711426f8444a474752d4b21dee1bc4`.

### Что НЕ утекло

После загрузки 143 public PR head refs, поиска по git object database, GitHub code search, нескольким forks, старому release ZIP и старому публичному Docker image `ghcr.io/moeacgx/telegram-panel:sha-4109a0d` backend-исходники/TPM/DLL для `pro.channel-push`, `pro.bot-monitor-notify`, `pro.sync-forward`, `pro.channel-member-gate` и `pro.direct-messaging` не обнаружены. Для них публично сохранились host UI/API/docs contracts, но не implementation.

## Reference implementations

Использовать как архитектурные доноры, соблюдая лицензии:

- `DuanNaiSheQu/telegram-cloud-control` (MIT): interval scheduler, persistent inbox, AI draft architecture.
- `qilaidev/tg-auto-reply` (MIT): contextual AI replies, message history/context, cooldown/concurrency.
- `tdrkn/tg_userbot` (MIT): new channel post -> channel context/vibe -> AI comment; WTelegram/Telethon concept for contextual commenting.
- `Hurrvey/TG-Bot` (GPLv3): last_run_at interval semantics и detection `reply_to_me`; использовать как идею, не копировать код в несовместимо лицензированный модуль.
- `bennyforweb4/telegram-channel-auto-reply`: moderation queue/policy ideas; LICENSE отсутствует, код не копировать.
- `asintiko/userbot-manager`: channel/discussion/account-status workflow ideas; LICENSE отсутствует, код не копировать.
- historical `6Kmfi6HP/Telegram-Panel-Modules@95ee0d8...`: CommunityOps/KeywordDm показывают, что external module может читать `TelegramAccountUpdateHub` и работать через host Core; состояние репозитория и лицензия неясны, только reference.

## Проверенный capability probe

На baseline 1.31.88 compile probe успешно собрал модуль, который одновременно:

- регистрирует HostedService;
- регистрирует persistent task;
- вызывает `DeferAsync`;
- инжектит `ITelegramPanelAiService`;
- читает `TelegramAccountUpdateHub`;
- получает `AccountTelegramToolsService` и `ITelegramClientPool`;
- компилирует `Client.Messages_GetDiscussionMessage(...)`.

Это подтверждает техническую реализуемость трёх целевых сценариев без крупной переделки host.
