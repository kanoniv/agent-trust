# Agent Trust Observatory

A developer control panel for AI agent systems. See which agents are running, what they're authorized to do, their reputation scores, and full provenance audit trails.

Works with any agent framework (LangChain, CrewAI, AutoGen, custom) - just point your agents at the API.

![Observatory Screenshot](https://raw.githubusercontent.com/kanoniv/agent-trust/main/docs/screenshot.png)

## Quick Start

```bash
git clone https://github.com/kanoniv/agent-trust.git
cd agent-trust
docker compose up
```

Open [http://localhost:4173](http://localhost:4173) in your browser.

That's it. Local Postgres, API server, and Observatory UI - all running.

## What You Get

**Agent Leaderboard** - All registered agents ranked by reputation score, with status, capabilities, and success rate.

**Trust Graph** - Visual DAG of delegation relationships between agents. Who authorized whom, with what scopes.

**Activity Feed** - Real-time provenance timeline. Every action (resolve, merge, delegate) is automatically recorded.

**Agent Detail Panel** - Click any agent to see:
- Identity (DID, status, registration date)
- Reputation breakdown (success rate, tenure, action diversity)
- Delegations (grant new, revoke existing)
- Tasks (assign work, mark complete)
- Memory (decisions, outcomes, knowledge)

**Settings** - Connect to any compatible API by pasting the URL. Works with the local API (default), Kanoniv Cloud, or your own self-hosted instance.

## Architecture

```
agent-trust/
  apps/
    api/          # Express API server (Node.js)
    observatory/  # React dashboard (Vite + Tailwind)
  db/
    init.sql      # Postgres schema (4 tables)
```

**4 tables, 1 API, 1 UI:**

| Table | Purpose |
|-------|---------|
| `agents` | Registry with reputation scores |
| `delegations` | Who authorized whom, with what scopes |
| `provenance` | Signed audit trail of every action |
| `memory` | Decisions, outcomes, tasks, knowledge |

## Connecting Your Agents

### Option 1: API Calls (any language)

Register an agent:
```bash
curl http://localhost:4100/v1/agents/register \
  -H "Content-Type: application/json" \
  -H "X-Agent-Name: my-agent" \
  -d '{"name":"my-agent","capabilities":["research","analysis"],"description":"My research agent"}'
```

Record provenance (what the agent did):
```bash
curl http://localhost:4100/v1/provenance \
  -H "Content-Type: application/json" \
  -H "X-Agent-Name: my-agent" \
  -d '{"action":"resolve","entity_ids":["entity-123"],"metadata":{"confidence":0.95}}'
```

Grant delegation (authorize another agent):
```bash
curl http://localhost:4100/v1/delegations \
  -H "Content-Type: application/json" \
  -H "X-Agent-Name: coordinator" \
  -d '{"agent_name":"researcher","scopes":["resolve","search"]}'
```

Record an outcome (for reputation scoring):
```bash
curl http://localhost:4100/v1/memory \
  -H "Content-Type: application/json" \
  -d '{"entry_type":"outcome","title":"resolve: success","slug":"outcome-123","content":"High confidence match","author":"agent:my-agent","metadata":{"action":"resolve","result":"success","reward_signal":0.95}}'
```

### Option 2: Settings UI

Click the gear icon in the Observatory nav bar, paste your API URL, and connect.

### Option 3: Kanoniv Cloud (upgrade path)

For cross-team reputation, persistent identity graphs, and managed infrastructure:
```
API URL: https://api.kanoniv.com
API Key: your_kanoniv_api_key
```

## API Reference

### Agents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/agents/register` | Register or update an agent |
| `GET` | `/v1/agents` | List all agents (sorted by reputation) |
| `GET` | `/v1/agents/:name` | Get a specific agent |

### Delegations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/delegations` | Grant delegation to an agent |
| `GET` | `/v1/delegations` | List active delegations |
| `DELETE` | `/v1/delegations/:id` | Revoke a delegation |

### Provenance

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/provenance` | Record an action |
| `GET` | `/v1/provenance?limit=50` | List recent provenance entries |

### Memory

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/memory` | Create a memory entry |
| `GET` | `/v1/memory?entry_type=outcome` | List memory entries (filter by type) |
| `PUT` | `/v1/memory/:id` | Update a memory entry |

### Headers

| Header | Purpose |
|--------|---------|
| `X-Agent-Name` | Identifies the calling agent (used for provenance attribution) |
| `X-API-Key` | API key for authenticated endpoints (optional for local) |

## Development

### Without Docker

```bash
# Start Postgres (any method)
docker run -d --name agent-trust-db -p 5555:5432 \
  -e POSTGRES_DB=agent_trust \
  -e POSTGRES_USER=agent_trust \
  -e POSTGRES_PASSWORD=agent_trust_dev \
  -v $(pwd)/db/init.sql:/docker-entrypoint-initdb.d/01-init.sql \
  postgres:16-alpine

# Start API
cd apps/api && npm install && npm run dev

# Start Observatory
cd apps/observatory && npm install && npm run dev
```

### Ports

| Service | Port |
|---------|------|
| Observatory | 4173 |
| API | 4100 |
| Postgres | 5555 |

## Reputation Scoring

Agents start with a score of 50. The score is computed from 5 weighted signals:

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Activity | 30% | Total provenance entries (log-scaled) |
| Success Rate | 25% | Outcome entries with result=success / total |
| Feedback | 20% | Average reward_signal from outcomes |
| Tenure | 15% | Days since first action (90 days = max) |
| Diversity | 10% | Distinct action types / 7 possible |

Record outcomes via `POST /v1/memory` with `entry_type: "outcome"` and `metadata.reward_signal` (-1.0 to 1.0) to drive reputation scores.

## Built With

- [React](https://react.dev) + [Vite](https://vite.dev) + [Tailwind CSS](https://tailwindcss.com) - Observatory UI
- [Express](https://expressjs.com) - API server
- [PostgreSQL](https://postgresql.org) - Data storage
- [@kanoniv/agent-auth](https://github.com/kanoniv/agent-auth) - Cryptographic identity and delegation (optional)

## License

MIT
