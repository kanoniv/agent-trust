# Contributing to Agent Trust Observatory

Thanks for your interest in contributing! This project is maintained by [Kanoniv](https://kanoniv.com).

## How to Contribute

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** with clear, focused commits
3. **Test locally** with `docker compose up` - verify everything works
4. **Open a Pull Request** against `main`

All PRs require review before merging. Direct pushes to `main` are blocked.

## Development Setup

```bash
git clone https://github.com/kanoniv/agent-trust.git
cd agent-trust
docker compose up db -d          # Start Postgres
cd apps/api && npm install && npm run dev      # Start API (port 4100)
cd apps/observatory && npm install && npm run dev  # Start UI (port 4173)
```

## Project Structure

```
apps/api/          - Express API server
apps/observatory/  - React + Vite dashboard
db/init.sql        - Postgres schema
```

## Guidelines

- Keep the API simple - this is a developer tool, not an enterprise platform
- No external dependencies without discussion - the API is intentionally minimal (Express + pg)
- The Observatory should work without authentication for local use
- All API endpoints must use parameterized queries (no string interpolation in SQL)
- Test with `docker compose up` before submitting

## Areas for Contribution

- **Framework integrations** - Python/JS wrappers for LangChain, CrewAI, AutoGen
- **Reputation scoring** - implement the scoring worker in the API
- **Trust Graph visualization** - improve the SVG DAG layout algorithm
- **DID support** - integrate `@kanoniv/agent-auth` for cryptographic identity
- **Documentation** - examples, tutorials, API docs

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Docker/OS version if relevant

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
