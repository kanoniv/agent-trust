import express from 'express';
import pg from 'pg';
import { computeRecallSummary, parseWindow } from './recall.js';

const { Pool } = pg;
const app = express();
app.use(express.json());

// CORS - allow observatory
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Name, X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://agent_trust:agent_trust_dev@localhost:5555/agent_trust',
});

// Extract agent name from header
function agentName(req) {
  return req.headers['x-agent-name'] || 'observatory';
}

// Auto-provenance: record action + outcome after successful mutations
async function recordProvenance(agent, action, entityIds, metadata, subjectDid) {
  try {
    // Look up the acting agent's DID
    const agentRow = await pool.query(`SELECT did FROM agents WHERE name = $1`, [agent]);
    const agentDid = agentRow.rows[0]?.did || null;

    await pool.query(
      `INSERT INTO provenance (agent_name, agent_did, action, entity_ids, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [agent, agentDid, action, entityIds, JSON.stringify(metadata)]
    );
    const slug = `auto-outcome-${action}-${Date.now()}`;
    await pool.query(
      `INSERT INTO memory (entry_type, slug, title, content, metadata, author, subject_did)
       VALUES ('outcome', $1, $2, $3, $4, $5, $6)`,
      [slug, `${action}: completed`, `Auto-recorded ${action} by ${agent}`,
       JSON.stringify({ action, result: 'completed', auto_recorded: true }),
       `agent:${agent}`, subjectDid || null]
    );
    // Update reputation for both acting agent and subject
    if (agentDid) updateReputation(agentDid);
    if (subjectDid && subjectDid !== agentDid) updateReputation(subjectDid);
  } catch (e) {
    console.error('Auto-provenance failed:', e.message);
  }
}

// Fetch recall context for an agent by name. Returns null if no DID or no outcomes.
// This is the RL loop closer - callers see the agent's track record automatically.
async function recallContext(agentNameStr) {
  try {
    const agentRow = await pool.query(`SELECT did FROM agents WHERE name = $1`, [agentNameStr]);
    const did = agentRow.rows[0]?.did;
    if (!did) return null;

    const result = await pool.query(
      `SELECT * FROM memory
       WHERE entry_type = 'outcome'
         AND (subject_did = $1 OR author = 'agent:' || $2)
         AND status = 'active'
       ORDER BY created_at DESC LIMIT 20`,
      [did, agentNameStr]
    );
    if (result.rows.length === 0) return null;

    const summary = computeRecallSummary(result.rows);
    return { did, summary };
  } catch {
    return null;
  }
}

// Recompute an agent's reputation from their actual outcomes and update the DB.
// Called after feedback is submitted so the leaderboard stays current.
async function updateReputation(agentDid) {
  try {
    // Find the agent by DID
    const agentRow = await pool.query(`SELECT name, registered_at FROM agents WHERE did = $1`, [agentDid]);
    if (agentRow.rows.length === 0) return;
    const { name, registered_at } = agentRow.rows[0];

    // Count outcomes
    const outcomes = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE metadata->>'result' = 'success') AS successes,
         COUNT(*) FILTER (WHERE metadata->>'result' = 'failure') AS failures,
         AVG((metadata->>'reward_signal')::float) FILTER (WHERE metadata->>'reward_signal' IS NOT NULL) AS avg_reward,
         COUNT(DISTINCT metadata->>'action') AS action_types
       FROM memory
       WHERE entry_type = 'outcome'
         AND (subject_did = $1 OR author = 'agent:' || $2)
         AND status = 'active'`,
      [agentDid, name]
    );
    const row = outcomes.rows[0];
    const total = parseInt(row.total) || 0;
    const successes = parseInt(row.successes) || 0;
    const failures = parseInt(row.failures) || 0;
    const judged = successes + failures;
    const successRate = judged > 0 ? successes / judged : 1.0;
    const avgReward = row.avg_reward ? parseFloat(row.avg_reward) : 0;
    const actionTypes = parseInt(row.action_types) || 0;
    const tenureDays = Math.floor((Date.now() - new Date(registered_at).getTime()) / 86400000);

    // Composite score (0-100): weighted blend
    // Activity uses sigmoid-like curve: diminishing returns, not log-linear
    // 10 actions ≈ 39, 20 ≈ 63, 50 ≈ 92, 100 ≈ 99
    const activityScore = 100 * (1 - Math.exp(-total / 20));           // 30% weight
    const successScore = successRate * 100;                             // 25% weight
    const rewardScore = ((avgReward + 1) / 2) * 100;                   // 20% weight
    const tenureScore = Math.min(100, (tenureDays / 90) * 100);        // 15% weight
    const diversityScore = Math.min(100, (actionTypes / 7) * 100);     // 10% weight

    const composite = Math.round(
      activityScore * 0.30 +
      successScore * 0.25 +
      rewardScore * 0.20 +
      tenureScore * 0.15 +
      diversityScore * 0.10
    );

    const reputation = {
      composite_score: composite,
      total_actions: total,
      success_rate: successRate,
      tenure_days: tenureDays,
      action_diversity: actionTypes,
      feedback_score: avgReward,
      last_computed_at: new Date().toISOString(),
    };

    await pool.query(
      `UPDATE agents SET reputation = $2 WHERE did = $1`,
      [agentDid, JSON.stringify(reputation)]
    );
  } catch (e) {
    console.error('Reputation update failed:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
app.post('/v1/agents/register', async (req, res) => {
  const { name, capabilities, description, did } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    const result = await pool.query(
      `INSERT INTO agents (name, capabilities, description, did)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         capabilities = CASE WHEN cardinality($2::text[]) > 0 THEN $2::text[] ELSE agents.capabilities END,
         description = COALESCE($3, agents.description),
         did = COALESCE($4, agents.did),
         status = 'online',
         last_seen_at = now()
       RETURNING *`,
      [name, capabilities || [], description || null, did || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/v1/agents', async (_, res) => {
  try {
    // Update status based on last_seen_at
    await pool.query(`
      UPDATE agents SET status = CASE
        WHEN last_seen_at < now() - interval '1 hour' THEN 'offline'
        WHEN last_seen_at < now() - interval '5 minutes' THEN 'idle'
        ELSE 'online'
      END
      WHERE status != CASE
        WHEN last_seen_at < now() - interval '1 hour' THEN 'offline'
        WHEN last_seen_at < now() - interval '5 minutes' THEN 'idle'
        ELSE 'online'
      END
    `);
    const result = await pool.query(`SELECT * FROM agents ORDER BY (reputation->>'composite_score')::float DESC NULLS LAST`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/v1/agents/:name', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM agents WHERE name = $1`, [req.params.name]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const agent = result.rows[0];
    const context = await recallContext(agent.name);
    res.json({ ...agent, ...(context ? { rl_context: context } : {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Delegations
// ---------------------------------------------------------------------------
app.post('/v1/delegations', async (req, res) => {
  const { agent_name, scopes, source_restrictions, expires_at, metadata } = req.body;
  const grantor = agentName(req);
  if (!agent_name || !scopes?.length) return res.status(400).json({ error: 'agent_name and scopes required' });

  try {
    const caveats = metadata || {};
    const result = await pool.query(
      `INSERT INTO delegations (grantor_name, agent_name, scopes, source_restrictions, caveats, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [grantor, agent_name, scopes, source_restrictions || null, JSON.stringify(caveats), expires_at || null]
    );
    // Look up the delegatee's DID as the subject
    const delegateeRow = await pool.query(`SELECT did FROM agents WHERE name = $1`, [agent_name]);
    const delegateeDid = delegateeRow.rows[0]?.did || null;
    await recordProvenance(grantor, 'delegate', [], { delegated_to: agent_name, scopes, caveats, expires_at }, delegateeDid);
    // Attach the delegatee's RL context so the caller sees their track record
    const context = await recallContext(agent_name);
    res.json({ ...result.rows[0], ...(context ? { rl_context: context } : {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/v1/delegations', async (req, res) => {
  try {
    const { agent_name } = req.query;
    let query = 'SELECT * FROM delegations WHERE revoked_at IS NULL ORDER BY created_at DESC';
    let params = [];
    if (agent_name) {
      query = 'SELECT * FROM delegations WHERE (agent_name = $1 OR grantor_name = $1) AND revoked_at IS NULL ORDER BY created_at DESC';
      params = [agent_name];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/v1/delegations/:id', async (req, res) => {
  const { scopes } = req.body;
  if (!scopes || !Array.isArray(scopes)) return res.status(400).json({ error: 'scopes array required' });
  try {
    const result = await pool.query(
      `UPDATE delegations SET scopes = $2 WHERE id = $1 AND revoked_at IS NULL RETURNING *`,
      [req.params.id, scopes]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/v1/delegations/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE delegations SET revoked_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    // Subject is the agent whose delegation was revoked
    const revokedAgent = result.rows[0]?.agent_name;
    const revokedRow = revokedAgent ? await pool.query(`SELECT did FROM agents WHERE name = $1`, [revokedAgent]) : { rows: [] };
    await recordProvenance(agentName(req), 'revoke', [], { delegation_id: req.params.id }, revokedRow.rows[0]?.did || null);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------
app.get('/v1/provenance', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { agent_name } = req.query;
  try {
    let query, params;
    if (agent_name) {
      query = `SELECT * FROM provenance WHERE agent_name = $1 ORDER BY created_at DESC LIMIT $2`;
      params = [agent_name, limit];
    } else {
      query = `SELECT * FROM provenance ORDER BY created_at DESC LIMIT $1`;
      params = [limit];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/v1/provenance', async (req, res) => {
  const { action, entity_ids, parent_ids, metadata, signature } = req.body;
  const agent = agentName(req);
  try {
    const result = await pool.query(
      `INSERT INTO provenance (agent_name, action, entity_ids, parent_ids, metadata, signature)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [agent, action, entity_ids || [], parent_ids || [], JSON.stringify(metadata || {}), signature || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------
app.get('/v1/memory', async (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const { entry_type, status, author } = req.query;
  try {
    let query = 'SELECT * FROM memory WHERE 1=1';
    const params = [];
    let idx = 1;
    if (entry_type) { query += ` AND entry_type = $${idx++}`; params.push(entry_type); }
    if (status) { query += ` AND status = $${idx++}`; params.push(status); }
    if (author) { query += ` AND author = $${idx++}`; params.push(author); }
    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(limit);
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/v1/memory', async (req, res) => {
  const { entry_type, slug, title, content, metadata, linked_agents, author, subject_did } = req.body;
  if (!entry_type || !title) return res.status(400).json({ error: 'entry_type and title required' });
  const finalSlug = slug || `${entry_type}-${Date.now()}`;
  try {
    const result = await pool.query(
      `INSERT INTO memory (entry_type, slug, title, content, metadata, linked_agents, author, subject_did)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [entry_type, finalSlug, title, content || '', JSON.stringify(metadata || {}), linked_agents || [], author || 'system', subject_did || null]
    );
    const row = result.rows[0];
    // For task assignments, attach the assignee's RL context
    if (entry_type === 'task' && metadata?.assigned_to) {
      const context = await recallContext(metadata.assigned_to);
      if (context) row.rl_context = context;
    }
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/v1/memory/:id', async (req, res) => {
  const { status, metadata, content } = req.body;
  try {
    const result = await pool.query(
      `UPDATE memory SET
         status = COALESCE($2, status),
         metadata = CASE WHEN $3::jsonb IS NOT NULL THEN metadata || $3::jsonb ELSE metadata END,
         content = COALESCE($4, content),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, status || null, metadata ? JSON.stringify(metadata) : null, content || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Feedback - the real reward signal (quality, not just activity)
// ---------------------------------------------------------------------------
app.post('/v1/memory/feedback', async (req, res) => {
  const { subject_did, action, result, reward_signal, content } = req.body;
  if (!subject_did) return res.status(400).json({ error: 'subject_did required' });
  if (result && !['success', 'failure', 'partial'].includes(result)) {
    return res.status(400).json({ error: 'result must be success, failure, or partial' });
  }
  if (reward_signal !== undefined && (typeof reward_signal !== 'number' || reward_signal < -1 || reward_signal > 1)) {
    return res.status(400).json({ error: 'reward_signal must be a number between -1 and 1' });
  }

  const agent = agentName(req);
  const slug = `feedback-${action || 'general'}-${Date.now()}`;
  const title = `${action || 'feedback'}: ${result || 'rated'}`;
  const meta = {
    action: action || 'feedback',
    result: result || 'rated',
    ...(reward_signal !== undefined ? { reward_signal } : {}),
    feedback: true,
    reported_by: agent,
  };

  try {
    const row = await pool.query(
      `INSERT INTO memory (entry_type, slug, title, content, metadata, author, subject_did)
       VALUES ('outcome', $1, $2, $3, $4, $5, $6) RETURNING *`,
      [slug, title, content || '', JSON.stringify(meta), `agent:${agent}`, subject_did]
    );
    // Recompute the subject agent's reputation so the dashboard updates
    updateReputation(subject_did);
    res.json(row.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Recall - in-context RL: retrieve outcomes + summary for a DID
// ---------------------------------------------------------------------------
app.get('/v1/memory/recall', async (req, res) => {
  const { did, entry_type, limit: rawLimit } = req.query;
  if (!did) return res.status(400).json({ error: 'did query parameter required' });
  const limit = parseInt(rawLimit) || 50;

  try {
    // Fetch outcomes (or all entries) for this DID - as subject OR as author
    let typeFilter = '';
    const params = [did, limit];
    if (entry_type) {
      typeFilter = ' AND entry_type = $3';
      params.push(entry_type);
    }
    const result = await pool.query(
      `SELECT * FROM memory
       WHERE (subject_did = $1 OR author = (SELECT 'agent:' || name FROM agents WHERE did = $1 LIMIT 1))
         AND status = 'active'${typeFilter}
       ORDER BY created_at DESC LIMIT $2`,
      params
    );

    const summary = computeRecallSummary(result.rows);
    res.json({ did, summary, entries: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Trend - time-series reward signals for Observatory charts
// ---------------------------------------------------------------------------
app.get('/v1/memory/trend', async (req, res) => {
  const { did, window: rawWindow } = req.query;
  if (!did) return res.status(400).json({ error: 'did query parameter required' });

  const parsed = parseWindow(rawWindow);
  if (!parsed) return res.status(400).json({ error: 'window must be like 7d or 24h' });
  const { windowStr, interval, bucket, truncField } = parsed;

  try {
    const result = await pool.query(
      `SELECT
         date_trunc($1, created_at) AS bucket,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE metadata->>'result' = 'success') AS successes,
         COUNT(*) FILTER (WHERE metadata->>'result' = 'failure') AS failures,
         AVG((metadata->>'reward_signal')::float) FILTER (WHERE metadata->>'reward_signal' IS NOT NULL) AS avg_reward
       FROM memory
       WHERE entry_type = 'outcome'
         AND (subject_did = $2 OR author = (SELECT 'agent:' || name FROM agents WHERE did = $2 LIMIT 1))
         AND status = 'active'
         AND created_at >= now() - $3::interval
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [truncField, did, interval]
    );

    res.json({
      did,
      window: windowStr,
      bucket,
      points: result.rows.map(r => ({
        time: r.bucket,
        total: parseInt(r.total),
        successes: parseInt(r.successes),
        failures: parseInt(r.failures),
        avg_reward: r.avg_reward ? parseFloat(r.avg_reward) : null,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = parseInt(process.env.PORT || '4100');
app.listen(port, () => {
  console.log(`Agent Trust API running on :${port}`);
});
