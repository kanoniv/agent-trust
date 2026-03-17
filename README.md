# Agent Trust

**Add one agent that controls every other agent.**

An autonomous agent that verifies, scores, and enforces what other agents are allowed to do - using cryptographic proof.

Langfuse can tell you an agent failed. Agent Trust can prove it failed and revoke its permissions before it fails again.

```
pip install kanoniv-trust
```

![Agent Trust Observatory](docs/observatory.png)

## Quick Start

```python
from agent_trust import TrustAgent

trust = TrustAgent()  # SQLite, zero infra

# Register agents - each gets an Ed25519 key pair and DID
trust.register("researcher", capabilities=["search", "analyze"])
trust.register("writer", capabilities=["draft", "edit", "publish"])

# Delegate - scoped permissions, cryptographic not advisory
trust.delegate("researcher", scopes=["search", "analyze"])
trust.delegate("writer", scopes=["draft", "edit"])

# Observe - every action is auto-signed with the agent's keys
trust.observe("researcher", action="search", result="success", reward=0.9)
trust.observe("writer", action="draft", result="failure", reward=-0.5)

# Select - UCB picks the proven agent
best = trust.select(["researcher", "writer"])  # -> "researcher"

# Enforce - not a suggestion
trust.restrict("writer", scopes=["edit"])  # can only edit now
trust.revoke("writer")                      # can't do anything
```

## Capabilities and Delegation

Capabilities define what an agent CAN do. Delegation controls what it's ALLOWED to do.

```python
trust.register("deployer", capabilities=["deploy", "rollback", "monitor"])

# Grant deploy only - not rollback, not monitor
trust.delegate("deployer", scopes=["deploy"])

# Add conditions
trust.delegate("deployer", scopes=["deploy"],
    caveats={"env": "staging", "max_cost": 100})

# Add time limits - auto-expires after 1 hour
trust.delegate("deployer", scopes=["deploy"], expires_in=3600)

# Can't delegate what the agent can't do
trust.delegate("deployer", scopes=["delete_prod"])
# -> TrustError: Cannot delegate ['delete_prod'] - not in capabilities
```

## Authorization

Agents check before acting. The protocol enforces it.

```python
trust.authorized("deployer", "deploy")    # True - delegated
trust.authorized("deployer", "rollback")  # False - not delegated
trust.authorized("deployer", "monitor")   # False - capability exists, not delegated

# After restriction
trust.restrict("deployer", scopes=["monitor"])
trust.authorized("deployer", "deploy")    # False - restricted away
trust.authorized("deployer", "monitor")   # True - only scope left

# After revocation
trust.revoke("deployer")
trust.authorized("deployer", "monitor")   # False - all permissions gone
```

## In-Context RL

Agents read their own verified history before acting. Inject this into the prompt. No gradient descent - structured memory from signed outcomes.

**Nobody else has this.**

```python
# After several observed outcomes...
ctx = trust.recall("researcher")

print(ctx.guidance)
# "Track record for researcher: 8 outcomes. Success rate: 87%.
#  Strong at: search, analyze. Weak at: fact-check.
#  Recent failures: fact-check. Adjust your approach."

print(ctx.strengths)   # ["search", "analyze"]
print(ctx.weaknesses)  # ["fact-check"]
print(ctx.trend)       # "improving"

# Inject into the agent's prompt - it learns from its own history
prompt = f"""Your track record: {ctx.guidance}

Task: {task}"""
```

## LLM Evaluation

Optional autonomous judgment layer. The TrustAgent reasons about output quality using an LLM. Deterministic scoring (`observe`) is always available without an LLM.

```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-haiku-4-5-20251001")

# LLM evaluates the output, scores it, records signed provenance
outcome = trust.evaluate("writer", action="draft",
    task="Write a technical analysis of UCB exploration",
    output="UCB is good. You should use it.",
    llm=llm)
# -> Outcome(result="failure", reward=-0.8, content="Superficial, no technical depth")

# Good output gets rewarded
outcome = trust.evaluate("researcher", action="analyze",
    task="Analyze the agent trust competitive landscape",
    output="The space has 3 tiers: observability (Langfuse), governance (Microsoft AGT), and reputation (Vouch). Nobody combines all three with RL routing.",
    llm=llm)
# -> Outcome(result="success", reward=0.7, content="Clear structure, specific examples")
```

## Reputation

Computed from verified, signed outcomes. Not self-reported. Not LLM judgment.

```python
rep = trust.reputation("researcher")

rep.score            # 72.5/100 composite
rep.success_rate     # 0.87
rep.avg_reward       # 0.65
rep.verified_actions # 8 (all signed with Ed25519)
rep.trend            # "improving"
rep.top_strengths    # ["search", "analyze"]
rep.top_weaknesses   # ["fact-check"]
rep.current_scopes   # ["search", "analyze"]
```

## Portable Agent Identity

Agents own their keys. Generate once, save to disk, load on any service. Works across distributed systems.

```python
from agent_trust import AgentIdentity

# Agent creates its own identity
identity = AgentIdentity.generate("field-agent")
identity.save("~/.agent-trust/field-agent.key")

# On any machine, any service
identity = AgentIdentity.load("~/.agent-trust/field-agent.key")

# Register with any TrustAgent
trust.register("field-agent", did=identity.did, capabilities=["search"])

# Agent signs its own actions
sig, ts = identity.sign_action("search", result="success", reward=0.9)
trust.observe("field-agent", action="search", result="success",
              reward=0.9, signature=sig, signed_at=ts)
# -> verified_actions += 1
```

## UCB Selection

Upper Confidence Bound balances exploiting proven agents with exploring under-tested ones. Mathematically principled, not hardcoded.

```python
# UCB explores untested agents (infinite score)
trust.select(["proven-agent", "new-agent"])  # -> "new-agent" (explore)

# After both are tested, exploits the better one
trust.select(["proven-agent", "new-agent"])  # -> "proven-agent" (exploit)

# Full ranking
trust.rank(["researcher", "writer", "deployer"])
# -> ["researcher", "deployer", "writer"]  (best first)

# Greedy - always picks highest reward, no exploration
trust.select(["a", "b"], strategy="greedy")
```

## Framework Integrations

### CrewAI

```python
from agent_trust.integrations.crewai import TrustManager

manager = TrustManager()
manager.register_crew([researcher, writer])

crew = Crew(
    agents=[researcher, writer],
    process=Process.hierarchical,
    manager_agent=manager.as_agent(),
    task_callback=manager.task_callback,  # auto-records outcomes
)
```

### LangChain

```python
from agent_trust.integrations.langchain import trust_tools, TrustCallbackHandler

# Add trust tools to any agent
tools = trust_tools(trust) + [your_other_tools...]

# Auto-observe outcomes via callback
handler = TrustCallbackHandler(trust, agent_name="researcher")
agent.invoke({"input": "..."}, config={"callbacks": [handler]})
```

## What Exists vs What's Missing

|  | Langfuse | AgentOps | CrewAI | MS Agent Gov | Agent Trust |
|--|---------|---------|--------|-------------|-------------|
| Agent Identity (DIDs) | No | No | No | Yes | Yes |
| Signed Provenance | No | No | No | Partial | Yes |
| Scoped Delegation | No | No | Hardcoded | Policy-based | Cryptographic |
| Reputation Scoring | No | No | No | Yes | Yes |
| RL / Adaptive Routing | No | No | No | No | **Yes** |
| Autonomous Trust Agent | No | No | No | No | **Yes** |
| Enforcement | No | No | No | Yes | Yes |

## Observatory

Visual control panel. Leaderboard, trust graph, RL panel, provenance feed.

```bash
git clone https://github.com/kanoniv/agent-trust.git
cd agent-trust
docker compose up
```

Open [http://localhost:4173](http://localhost:4173).

## Hosted Backend

Local SQLite for development. Hosted API for shared reputation across teams.

```python
# Local - zero infra
trust = TrustAgent()

# Hosted - shared reputation
trust = TrustAgent(url="http://your-api:4100")

# Persistent identity across restarts
trust = TrustAgent(private_key="base64...")
```

```
pip install kanoniv-trust[hosted]
```

## Interactive Demo

See the full [demo notebook](examples/demo.ipynb) - covers everything above with live output.

## License

MIT
