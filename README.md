# Agent Trust

**Add one agent that controls every other agent.**

An autonomous agent that verifies, scores, and enforces what other agents are allowed to do - using cryptographic proof.

Langfuse can tell you an agent failed. Agent Trust can prove it failed and revoke its permissions before it fails again.

```
pip install kanoniv-trust
```

![Agent Trust Observatory](docs/observatory.png)

## 5 Lines of Code

```python
from agent_trust import TrustAgent

trust = TrustAgent()  # SQLite, zero infra

# Register agents with verified identity (Ed25519 DIDs)
trust.register("researcher", capabilities=["search"])
trust.register("writer", capabilities=["write"])

# Grant scoped delegation - cryptographic, not advisory
trust.delegate("researcher", scopes=["search", "analyze"])
trust.delegate("writer", scopes=["write", "summarize"])

# Observe outcomes - creates signed provenance
trust.observe("researcher", action="search", result="success", reward=0.9)
trust.observe("writer", action="write", result="failure", reward=-0.5)

# Select best agent - UCB exploration, verified reputation
best = trust.select(["researcher", "writer"])  # -> "researcher"

# Enforce - real authority, not a recommendation
trust.restrict("writer", scopes=["summarize"])  # limit permissions
trust.revoke("writer")                           # revoke all access

# Reputation from verified, signed outcomes - not self-reported metrics
trust.reputation("writer")
# -> ReputationReport(score=18, success_rate=0.0, trend="declining", current_scopes=[])
```

## Why

Every orchestration framework trusts agents by default. No identity verification. No delegation enforcement. No way to learn which agents to trust. That's insane.

Agent Trust is the immune system your multi-agent system is missing:

```
Agents produce actions
       |
Protocol verifies actions (signed provenance, DIDs, delegation)
       |
TrustAgent interprets + enforces (reputation, UCB, restrict/revoke)
```

- **Identity**: Each agent gets an Ed25519 key pair and a `did:key` identifier
- **Provenance**: Every action is signed. Tamper-proof audit trail.
- **Delegation**: Scoped permissions that can be restricted or revoked in real time
- **Reputation**: Computed from verified, signed outcomes - not self-reported metrics or LLM judgment
- **Routing**: UCB (Upper Confidence Bound) balances exploiting proven agents with exploring under-tested ones
- **Enforcement**: Restrict scopes or revoke delegation entirely. Not advisory - cryptographic.

## What Exists vs What's Missing

|  | Langfuse | AgentOps | CrewAI | MS Agent Gov | Agent Trust |
|--|---------|---------|--------|-------------|-------------|
| Agent Identity (DIDs) | No | No | No | Yes | Yes |
| Signed Provenance | No | No | No | Partial | Yes |
| Scoped Delegation | No | No | Hardcoded | Policy-based | Cryptographic |
| Reputation Scoring | No | No | No | Yes | Yes |
| RL / Adaptive Routing | No | No | No | No | **Yes** |
| Autonomous Trust Agent | No | No | No | No | **Yes** |
| Enforcement (restrict/revoke) | No | No | No | Yes | Yes |

The combination - an autonomous trust agent with cryptographic identity, signed provenance, reputation from verified data, cryptographic delegation enforcement, AND learned routing - does not exist anywhere as a single integrated system.

## CrewAI Integration

```python
from crewai import Agent, Crew, Process
from agent_trust.integrations.crewai import TrustManager

researcher = Agent(role="Researcher", goal="Find information", backstory="Expert researcher")
writer = Agent(role="Writer", goal="Write content", backstory="Expert writer")

# Trust-based manager replaces hardcoded delegation
manager = TrustManager()
manager.register_crew([researcher, writer])

crew = Crew(
    agents=[researcher, writer],
    tasks=[...],
    process=Process.hierarchical,
    manager_agent=manager.as_agent(),
    task_callback=manager.task_callback,  # auto-records outcomes
)
```

**Before**: `allowed_agents=["researcher", "writer"]` - random or first-match.
**After**: `trust.select(["researcher", "writer"])` - earned reputation.

## Observatory

A visual control panel for your agent system. See reputation scores, trust graphs, delegation chains, and provenance audit trails in real time.

```bash
git clone https://github.com/kanoniv/agent-trust.git
cd agent-trust
docker compose up
```

Open [http://localhost:4173](http://localhost:4173).

**Agent Leaderboard** - Agents ranked by reputation score, with status and success rate.

**Trust Graph** - Visual DAG of delegation relationships. Who authorized whom, with what scopes.

**In-Context RL Panel** - Learning curves, strong/weak action badges, UCB exploration stats.

**Activity Feed** - Real-time provenance timeline. Every action is automatically recorded and signed.

## SDK API Reference

### `TrustAgent(db_path=None, url=None, private_key=None)`

- `TrustAgent()` - SQLite at `~/.agent-trust/trust.db`
- `TrustAgent(db_path=":memory:")` - in-memory (testing)
- `TrustAgent(url="http://...")` - hosted backend (shared reputation)
- `TrustAgent(private_key="base64...")` - persistent identity across restarts

### Methods

| Method | Description |
|--------|-------------|
| `register(name, capabilities)` | Register an agent with verified identity |
| `delegate(agent, scopes)` | Grant scoped delegation (signed) |
| `observe(agent, action, result, reward)` | Record outcome with signed provenance |
| `select(agents, strategy="ucb")` | Select best agent from verified reputation |
| `rank(agents, strategy="ucb")` | Rank agents by reputation (best first) |
| `reputation(agent)` | Get full reputation report |
| `restrict(agent, scopes)` | Limit an agent's permissions |
| `revoke(agent)` | Revoke all delegation |
| `recall(agent)` | In-context RL - agent reads its own history |
| `evaluate(agent, action, output, llm)` | LLM-powered quality judgment (opt-in) |
| `authorized(agent, scope)` | Check if agent can perform an action |

### See it in action

Open the [interactive demo notebook](examples/demo.ipynb) - covers identity, delegation, caveats, expiry, authorization, observation, in-context RL, LLM evaluation, enforcement, and portable agent identity.

## Architecture

```
agent-trust/
  sdks/python/       # Python SDK (pip install kanoniv-trust)
  apps/
    api/             # Express API server (Node.js)
    observatory/     # React dashboard (Vite + Tailwind)
  examples/          # Demo notebook + LangGraph multi-agent demo
  db/
    init.sql         # Postgres schema (4 tables)
```

### Hosted Backend

Local SQLite is great for development. For shared reputation across teams:

```python
trust = TrustAgent(url="http://your-agent-trust-api:4100")
```

Same API, shared persistence. An agent's reputation follows it across systems.

```
pip install kanoniv-trust[hosted]
```

## License

MIT
