# Contributing

Thank you for contributing. This repository is a small educational sample, so the main goal is to keep the code and docs easy to understand, easy to run, and aligned with the observable workflow the repo is trying to demonstrate.

## Before You Change Anything

- Read [README.md](./README.md) and [GETTING_STARTED.md](./GETTING_STARTED.md)
- Keep changes scoped to one concern when possible
- Prefer simple changes over introducing extra abstractions
- Update documentation when behavior, commands, or file layout changes

## Reporting Issues or Proposing Changes

- Provide clear reproduction steps
- Describe the current behavior and the expected behavior
- Keep one issue or proposal per topic
- Include logs, screenshots, or trace screenshots when they help explain the problem

## Development Guidelines

- Preserve the repo's existing structure under `apps/`, `docs/`, and `scripts/`
- Keep the sample runnable with `docker compose up --build`
- Do not add infrastructure or dependencies unless they directly improve the sample
- Prefer documentation that explains why the sample exists, not just what files it contains
- If you change the demo flow, update the related docs in `docs/`

## Branching

Use short, descriptive branch names. These patterns work well for this repo:

- `add/<topic>`
- `update/<topic>`
- `fix/<topic>`
- `remove/<topic>`

Examples:

- `fix/readme-links`
- `add/manual-run-notes`
- `update/worker-error-flow`

## Pull Requests

- Use a descriptive title
- Explain the user-visible or contributor-visible impact
- Mention any docs that were updated
- Include validation details, for example that `docker compose up --build` still works
- If relevant, include screenshots from Aspire Dashboard or Playground

## Code of Conduct

By participating in this project, you agree to follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
