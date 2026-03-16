import express from 'express';
import pg from 'pg';

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
  return req.headers['x-agent-name'] || 'unknown';
}

// Auto-provenance: record action + outcome after successful mutations
async function recordProvenance(agent, action, entityIds, metadata) {
  try {
    await pool.query(
      `INSERT INTO provenance (agent_name, action, entity_ids, metadata) VALUES ($1, $2, $3, $4)`,
      [agent, action, entityIds, JSON.stringify(metadata)]
    );
    const slug = `auto-outcome-${action}-${Date.now()}`;
    await pool.query(
      `INSERT INTO memory (entry_type, slug, title, content, metadata, author)
       VALUES ('outcome', $1, $2, $3, $4, $5)`,
      [slug, `${action}: success`, `Auto-recorded ${action} by ${agent}`,
       JSON.stringify({ action, result: 'success', reward_signal: 1.0, auto_recorded: true }),
       `agent:${agent}`]
    );
  } catch (e) {
    console.error('Auto-provenance failed:', e.message);
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
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Delegations
// ---------------------------------------------------------------------------
app.post('/v1/delegations', async (req, res) => {
  const { agent_name, scopes, source_restrictions, expires_at } = req.body;
  const grantor = agentName(req);
  if (!agent_name || !scopes?.length) return res.status(400).json({ error: 'agent_name and scopes required' });

  try {
    const result = await pool.query(
      `INSERT INTO delegations (grantor_name, agent_name, scopes, source_restrictions, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [grantor, agent_name, scopes, source_restrictions || null, expires_at || null]
    );
    await recordProvenance(grantor, 'delegate', [], { delegated_to: agent_name, scopes });
    res.json(result.rows[0]);
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

app.delete('/v1/delegations/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE delegations SET revoked_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    await recordProvenance(agentName(req), 'revoke', [], { delegation_id: req.params.id });
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
  try {
    const result = await pool.query(
      `SELECT * FROM provenance ORDER BY created_at DESC LIMIT $1`, [limit]
    );
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
  const { entry_type, slug, title, content, metadata, linked_agents, author } = req.body;
  if (!entry_type || !title) return res.status(400).json({ error: 'entry_type and title required' });
  const finalSlug = slug || `${entry_type}-${Date.now()}`;
  try {
    const result = await pool.query(
      `INSERT INTO memory (entry_type, slug, title, content, metadata, linked_agents, author)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [entry_type, finalSlug, title, content || '', JSON.stringify(metadata || {}), linked_agents || [], author || 'system']
    );
    res.json(result.rows[0]);
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
// Start
// ---------------------------------------------------------------------------
const port = parseInt(process.env.PORT || '4100');
app.listen(port, () => {
  console.log(`Agent Trust API running on :${port}`);
});
