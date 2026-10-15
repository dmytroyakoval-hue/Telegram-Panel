# Telegram Panel Community Agent workspace

Before changing code, read:
- `skills/tgpanel-module-workflow/SKILL.md`
- `skills/ppclabo-community-agent/SKILL.md`

Rules:
- Work only inside this development worktree.
- Never modify `/home/dima/projects/telegram-panel`, `docker-data`, production containers, production databases, or production credentials.
- Do not deploy, restart production, or change live configuration unless the orchestrator explicitly asks.
- Prefer an external `.tpm` module over host/core edits.
- If host/core must change, keep the patch minimal and generic.
- The host has no local .NET SDK; use an SDK container for compile/test when needed.
- Preserve the Russian runtime localization architecture.
- Run targeted tests/builds for every change and report exact commands/results.
- Do not implement spam, enforcement evasion, CAPTCHA bypass, account farming, or proxy rotation intended to evade Telegram restrictions.
- For third-party public communities, default to monitoring + AI draft + human approval unless the task explicitly defines a safe authorized auto-send scope.
