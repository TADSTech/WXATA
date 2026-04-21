# Commands Module System

This folder is reserved for future modular command architecture.

## Planned Structure

```
commands/
├── CommandHandler.ts    # Command loader and router
├── ping.ts              # Example: simple ping command
├── help.ts              # Example: help/menu command
└── games/               # Game modules (trivia, RPG, etc.)
```

## Current Status

The bot currently uses the `botinfo.json` script system for all commands. This folder is scaffolded for future migration to a TypeScript-based command module system where each command is a separate file with:

- Type-safe command definitions
- Middleware support (permissions, rate limiting)
- Hot-reload capability
- Automatic help generation

## Migration Plan

1. Create `CommandHandler` class that loads `.ts` files from this directory
2. Define `Command` interface with `name`, `description`, `execute()`, `permissions`
3. Gradually migrate high-traffic commands from `botinfo.json` to dedicated modules
4. Keep `botinfo.json` for user-defined custom scripts

## Why Not Now?

The current `botinfo.json` system is:
- Simple and hot-reloadable via dashboard
- User-friendly for non-developers
- Sufficient for current feature set

The module system will be introduced when:
- Command count exceeds 20+
- Complex game logic requires better organization
- Team collaboration needs better code structure
