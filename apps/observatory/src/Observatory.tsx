import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Shield, Users, Activity, ChevronRight, Fingerprint,
  Star, TrendingUp, Clock, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, RefreshCw, Zap, Eye, Link2, Plus, Trash2,
  ClipboardList, Brain, Send, Settings, ExternalLink, Check,
  BarChart3, RotateCw,
} from 'lucide-react';

const GOLD = '#C19A5B';
const STORAGE_KEY = 'agent-trust-connection';

interface ConnectionConfig {
  apiUrl: string;
  apiKey: string;
  agentName: string;
}

function getConnection(): ConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { apiUrl: '', apiKey: '', agentName: '' };
}

function saveConnection(config: ConnectionConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const conn = getConnection();
  const base = conn.apiUrl || '';
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (conn.apiKey) headers['X-API-Key'] = conn.apiKey;
  headers['X-Agent-Name'] = conn.agentName || 'observatory';
  return fetch(`${base}${path}`, { ...options, headers });
}

// ---------------------------------------------------------------------------
// Settings Panel
// ---------------------------------------------------------------------------

const SettingsPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [config, setConfig] = useState<ConnectionConfig>(getConnection);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const base = config.apiUrl || '';
      const headers: Record<string, string> = {};
      if (config.apiKey) headers['X-API-Key'] = config.apiKey;
      const res = await fetch(`${base}/health`, { headers });
      setTestResult(res.ok ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveConnection(config);
    setTestResult(null);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#12121a] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#C5A572]" />
            <h2 className="text-sm font-bold text-[#E8E8ED]">Connect API</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">
              API Endpoint
            </label>
            <input
              value={config.apiUrl}
              onChange={e => { setConfig(c => ({ ...c, apiUrl: e.target.value })); setTestResult(null); }}
              placeholder="http://localhost:4100 or https://api.kanoniv.com"
              className="w-full px-3 py-2 text-xs bg-[#0a0a0a] border border-white/10 rounded-lg text-zinc-300 placeholder-zinc-600 focus:border-[#C5A572]/50 focus:outline-none"
            />
            <p className="text-[9px] text-zinc-600 mt-1">Leave empty to use the proxy (same origin)</p>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">
              API Key <span className="text-zinc-700">(optional)</span>
            </label>
            <input
              value={config.apiKey}
              onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
              placeholder="kn_live_..."
              type="password"
              className="w-full px-3 py-2 text-xs bg-[#0a0a0a] border border-white/10 rounded-lg text-zinc-300 placeholder-zinc-600 focus:border-[#C5A572]/50 focus:outline-none font-mono"
            />
            <p className="text-[9px] text-zinc-600 mt-1">For authenticated APIs (Kanoniv Cloud, self-hosted)</p>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">
              Agent Name <span className="text-zinc-700">(optional)</span>
            </label>
            <input
              value={config.agentName}
              onChange={e => setConfig(c => ({ ...c, agentName: e.target.value }))}
              placeholder="observatory"
              className="w-full px-3 py-2 text-xs bg-[#0a0a0a] border border-white/10 rounded-lg text-zinc-300 placeholder-zinc-600 focus:border-[#C5A572]/50 focus:outline-none"
            />
            <p className="text-[9px] text-zinc-600 mt-1">Identifies this UI as an agent when creating delegations/tasks</p>
          </div>

          {testResult && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
              testResult === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            )}>
              {testResult === 'ok' ? <Check className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
              {testResult === 'ok' ? 'Connected successfully' : 'Connection failed - check the URL'}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleTest} disabled={testing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-colors disabled:opacity-50">
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              Test Connection
            </button>
            <button onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#C5A572] text-[#0a0a0f] text-xs font-bold hover:bg-[#D4BC94] transition-colors">
              <Check className="w-3 h-3" />
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentRecord {
  id: string;
  name: string;
  status: string;
  capabilities: string[];
  description: string | null;
  last_seen_at: string;
  registered_at: string;
  metadata: Record<string, unknown>;
  did: string | null;
  reputation: {
    composite_score: number;
    total_actions: number;
    success_rate: number;
    tenure_days: number;
    action_diversity?: number;
    feedback_score?: number;
    last_computed_at: string | null;
    action_breakdown?: Record<string, number>;
  } | null;
}

interface ProvenanceEntry {
  id: string;
  agent_name: string;
  action: string;
  entity_ids: string[];
  parent_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Delegation {
  id: string;
  grantor_name: string;
  agent_name: string;
  scopes: string[];
  source_restrictions: string[] | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface OutcomeEntry {
  id: string;
  entry_type: string;
  title: string;
  content: string;
  metadata: {
    action?: string;
    result?: string;
    reward_signal?: number;
  };
  author: string;
  created_at: string;
}

interface TaskEntry {
  id: string;
  title: string;
  content: string;
  status: string;
  metadata: {
    assigned_to?: string;
    priority?: string;
    status?: string;
  };
  author: string;
  created_at: string;
}

interface MemoryEntry {
  id: string;
  entry_type: string;
  title: string;
  content: string;
  status: string;
  author: string;
  created_at: string;
}

interface RecallSummary {
  total_outcomes: number;
  successes: number;
  failures: number;
  success_rate: number | null;
  avg_reward: number | null;
  recent_trend: 'improving' | 'declining' | 'stable';
  top_success_actions: string[];
  top_failure_actions: string[];
}

interface RecallResponse {
  did: string;
  summary: RecallSummary;
  entries: OutcomeEntry[];
}

interface TrendPoint {
  time: string;
  total: number;
  successes: number;
  failures: number;
  avg_reward: number | null;
}

interface TrendResponse {
  did: string;
  window: string;
  bucket: string;
  points: TrendPoint[];
}

const DEFAULT_SCOPES = [
  'read', 'write', 'execute', 'delegate', 'admin',
];

const EXPIRY_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 168 },
  { label: '30 days', value: 720 },
  { label: 'No expiry', value: 0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function shortDid(did: string): string {
  if (!did) return '-';
  const parts = did.split(':');
  if (parts.length >= 3) return `did:..${parts[parts.length - 1].slice(0, 8)}`;
  return did.slice(0, 16);
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const secs = Math.floor((now - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'online': return 'text-emerald-400';
    case 'idle': return 'text-amber-400';
    case 'offline': return 'text-zinc-500';
    default: return 'text-zinc-400';
  }
}

function statusDot(status: string): string {
  switch (status) {
    case 'online': return 'bg-emerald-400';
    case 'idle': return 'bg-amber-400';
    case 'offline': return 'bg-zinc-600';
    default: return 'bg-zinc-600';
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function outcomeIcon(result: string) {
  switch (result) {
    case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'failure': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'partial': return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    case 'rollback': return <RefreshCw className="w-3.5 h-3.5 text-orange-400" />;
    default: return <Activity className="w-3.5 h-3.5 text-zinc-400" />;
  }
}

// ---------------------------------------------------------------------------
// Reputation Badge
// ---------------------------------------------------------------------------

const ReputationBadge: React.FC<{ score: number; size?: 'sm' | 'lg' }> = ({ score, size = 'sm' }) => {
  const radius = size === 'lg' ? 28 : 16;
  const stroke = size === 'lg' ? 3 : 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const dim = (radius + stroke) * 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={radius + stroke} cy={radius + stroke} r={radius}
          fill="none" stroke="currentColor" strokeWidth={stroke}
          className="text-zinc-800"
        />
        <circle
          cx={radius + stroke} cy={radius + stroke} r={radius}
          fill="none"
          stroke={score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : score >= 40 ? '#fb923c' : '#f87171'}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn(
        "absolute font-bold",
        size === 'lg' ? 'text-lg' : 'text-[10px]',
        scoreColor(score),
      )}>
        {Math.round(score)}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Trust Graph (SVG DAG)
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  name: string;
  status: string;
  score: number;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  scopes: string[];
}

const TrustGraph: React.FC<{
  agents: AgentRecord[];
  delegations: Delegation[];
  selectedId: string | null;
  onSelect: (name: string) => void;
}> = ({ agents, delegations, selectedId, onSelect }) => {
  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-xs">
        No agents registered yet
      </div>
    );
  }

  const cols = Math.min(agents.length, 4);
  const nodeWidth = 140;
  const nodeHeight = 60;
  const gapX = 40;
  const gapY = 50;

  const nodes: GraphNode[] = agents.map((a, i) => ({
    id: a.name,
    name: a.name,
    status: a.status,
    score: a.reputation?.composite_score ?? 50,
    x: (i % cols) * (nodeWidth + gapX) + 30,
    y: Math.floor(i / cols) * (nodeHeight + gapY) + 20,
  }));

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const edges: GraphEdge[] = delegations
    .filter(d => !d.revoked_at)
    .map(d => ({ from: d.grantor_name, to: d.agent_name, scopes: d.scopes }))
    .filter(e => nodeMap.has(e.from) && nodeMap.has(e.to));

  const svgWidth = cols * (nodeWidth + gapX) + 20;
  const rows = Math.ceil(agents.length / cols);
  const svgHeight = rows * (nodeHeight + gapY) + 20;

  return (
    <svg width={svgWidth} height={svgHeight} className="w-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#C19A5B" fillOpacity={0.5} />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = nodeMap.get(e.from)!;
        const to = nodeMap.get(e.to)!;
        const x1 = from.x + nodeWidth / 2;
        const y1 = from.y + nodeHeight;
        const x2 = to.x + nodeWidth / 2;
        const y2 = to.y;
        const midY = (y1 + y2) / 2;
        return (
          <g key={`edge-${i}`}>
            <path
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              fill="none" stroke="#C19A5B" strokeWidth={1.5} strokeOpacity={0.4}
              markerEnd="url(#arrowhead)"
            />
            {e.scopes.length > 0 && (
              <text x={(x1 + x2) / 2} y={midY - 4} textAnchor="middle" className="fill-zinc-600 text-[8px]">
                {e.scopes.slice(0, 3).join(', ')}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map(node => {
        const isSelected = selectedId === node.id;
        return (
          <g key={node.id} onClick={() => onSelect(node.id)} className="cursor-pointer">
            <rect x={node.x} y={node.y} width={nodeWidth} height={nodeHeight} rx={8}
              fill={isSelected ? '#1a1a2e' : '#111118'}
              stroke={isSelected ? '#C19A5B' : '#27272a'}
              strokeWidth={isSelected ? 1.5 : 1}
            />
            <circle cx={node.x + 14} cy={node.y + 16} r={3}
              fill={node.status === 'online' ? '#34d399' : node.status === 'idle' ? '#fbbf24' : '#52525b'}
            />
            <text x={node.x + 24} y={node.y + 19} className="fill-zinc-200 text-[11px] font-medium">
              {node.name.length > 14 ? node.name.slice(0, 14) + '..' : node.name}
            </text>
            <rect x={node.x + 10} y={node.y + 34} width={nodeWidth - 50} height={4} rx={2} fill="#27272a" />
            <rect x={node.x + 10} y={node.y + 34}
              width={Math.max(0, (nodeWidth - 50) * (node.score / 100))} height={4} rx={2}
              fill={node.score >= 80 ? '#34d399' : node.score >= 60 ? '#fbbf24' : node.score >= 40 ? '#fb923c' : '#f87171'}
            />
            <text x={node.x + nodeWidth - 30} y={node.y + 39}
              className={cn("text-[10px] font-bold",
                node.score >= 80 ? 'fill-emerald-400' : node.score >= 60 ? 'fill-amber-400' : 'fill-orange-400'
              )}>
              {Math.round(node.score)}
            </text>
            <text x={node.x + 10} y={node.y + 52} className="fill-zinc-600 text-[8px]">
              {(() => {
                const agent = agents.find(a => a.name === node.id);
                const caps = agent?.capabilities ?? [];
                return caps.length > 0 ? caps.slice(0, 3).join(', ') : 'no capabilities';
              })()}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export const Observatory: React.FC = () => {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [provenance, setProvenance] = useState<ProvenanceEntry[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connected, setConnected] = useState(!!getConnection().apiUrl);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [tab, setTab] = useState<'graph' | 'leaderboard'>('leaderboard');
  const refreshTimer = useRef<number | null>(null);

  // Action form state
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantScopes, setGrantScopes] = useState<string[]>([]);
  const [grantCustomScope, setGrantCustomScope] = useState('');
  const [grantExpiry, setGrantExpiry] = useState(0);
  const [grantMaxCost, setGrantMaxCost] = useState('');
  const [grantResources, setGrantResources] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskContent, setTaskContent] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryType, setMemoryType] = useState('knowledge');
  const [actionLoading, setActionLoading] = useState(false);
  const [recallData, setRecallData] = useState<RecallResponse | null>(null);
  const [trendData, setTrendData] = useState<TrendResponse | null>(null);
  const [trendWindow, setTrendWindow] = useState('7d');

  const fetchData = useCallback(async () => {
    try {
      const f = (path: string) => apiFetch(path).catch(() => null);
      const [agentsRes, provRes, delRes, outRes, taskRes, memRes] = await Promise.all([
        f('/v1/agents'),
        f('/v1/provenance?limit=50'),
        f('/v1/delegations'),
        f('/v1/memory?entry_type=outcome&limit=30'),
        f('/v1/memory?entry_type=task&status=active&limit=30'),
        f('/v1/memory?limit=30'),
      ]);

      if (agentsRes?.ok) setAgents(await agentsRes.json());
      if (provRes?.ok) {
        const data = await provRes.json();
        setProvenance(Array.isArray(data) ? data : data.entries ?? []);
      }
      if (delRes?.ok) {
        const data = await delRes.json();
        setDelegations(Array.isArray(data) ? data : data.delegations ?? []);
      }
      if (outRes?.ok) {
        const data = await outRes.json();
        setOutcomes(Array.isArray(data) ? data : data.entries ?? []);
      }
      if (taskRes?.ok) {
        const data = await taskRes.json();
        setTasks(Array.isArray(data) ? data : data.entries ?? []);
      }
      if (memRes?.ok) {
        const data = await memRes.json();
        setMemories(Array.isArray(data) ? data : data.entries ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    refreshTimer.current = window.setInterval(fetchData, 30000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [fetchData]);

  // --- Action handlers ---
  const handleGrantDelegation = async () => {
    if (!selectedAgent || grantScopes.length === 0) return;
    setActionLoading(true);
    const expiresAt = grantExpiry > 0
      ? new Date(Date.now() + grantExpiry * 3600000).toISOString()
      : null;
    const caveats: Record<string, unknown> = {};
    if (grantMaxCost) caveats.max_cost = parseFloat(grantMaxCost);
    if (grantResources) caveats.resources = grantResources.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await apiFetch('/v1/delegations', {
        method: 'POST',
        body: JSON.stringify({
          agent_name: selectedAgent,
          scopes: grantScopes,
          expires_at: expiresAt,
          ...(Object.keys(caveats).length > 0 ? { source_restrictions: null, metadata: caveats } : {}),
        }),
      });
      setShowGrantForm(false);
      setGrantScopes([]);
      setGrantCustomScope('');
      setGrantExpiry(0);
      setGrantMaxCost('');
      setGrantResources('');
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleRevokeDelegation = async (delegationId: string) => {
    setActionLoading(true);
    try {
      await apiFetch(`/v1/delegations/${delegationId}`, { method: 'DELETE' });
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleRemoveScope = async (delegationId: string, currentScopes: string[], scopeToRemove: string) => {
    const newScopes = currentScopes.filter(s => s !== scopeToRemove);
    if (newScopes.length === 0) {
      // Last scope - revoke the whole delegation
      return handleRevokeDelegation(delegationId);
    }
    setActionLoading(true);
    try {
      await apiFetch(`/v1/delegations/${delegationId}`, {
        method: 'PUT',
        body: JSON.stringify({ scopes: newScopes }),
      });
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleCreateTask = async () => {
    const assignee = taskAssignee || selectedAgent;
    if (!assignee || !taskTitle) return;
    setActionLoading(true);
    const slug = `task-${taskTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 180)}-${Date.now()}`;
    try {
      await apiFetch('/v1/memory', {
        method: 'POST',
        body: JSON.stringify({
          entry_type: 'task',
          slug,
          title: taskTitle,
          content: taskContent,
          author: 'observatory',
          metadata: { assigned_to: assignee, priority: taskPriority, status: 'open' },
        }),
      });
      setShowTaskForm(false);
      setTaskTitle('');
      setTaskContent('');
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleCompleteTask = async (taskId: string) => {
    setActionLoading(true);
    try {
      await apiFetch(`/v1/memory/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'resolved', metadata: { status: 'done' } }),
      });
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleCreateMemory = async () => {
    if (!memoryTitle) return;
    setActionLoading(true);
    const slug = `obs-${memoryType}-${memoryTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 160)}-${Date.now()}`;
    const linkedEntities: string[] = [];
    try {
      await apiFetch('/v1/memory', {
        method: 'POST',
        body: JSON.stringify({
          entry_type: memoryType,
          slug,
          title: memoryTitle,
          content: memoryContent,
          author: 'observatory',
          linked_entities: linkedEntities,
        }),
      });
      setShowMemoryForm(false);
      setMemoryTitle('');
      setMemoryContent('');
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleArchiveMemory = async (memoryId: string) => {
    setActionLoading(true);
    try {
      await apiFetch(`/v1/memory/${memoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'archived' }),
      });
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  // Derive the selected agent's DID (stable reference - only changes when agent or selection changes)
  const selectedDid = agents.find(a => a.name === selectedAgent)?.did ?? null;

  // Fetch recall + trend data when an agent with a DID is selected
  useEffect(() => {
    if (!selectedDid) {
      setRecallData(null);
      setTrendData(null);
      return;
    }
    const fetchRL = async () => {
      try {
        const [recallRes, trendRes] = await Promise.all([
          apiFetch(`/v1/memory/recall?did=${encodeURIComponent(selectedDid)}&entry_type=outcome`),
          apiFetch(`/v1/memory/trend?did=${encodeURIComponent(selectedDid)}&window=${trendWindow}`),
        ]);
        if (recallRes.ok) setRecallData(await recallRes.json());
        if (trendRes.ok) setTrendData(await trendRes.json());
      } catch { /* silent */ }
    };
    fetchRL();
  }, [selectedDid, trendWindow]);

  const selected = agents.find(a => a.name === selectedAgent);
  const selectedProvenance = provenance.filter(p => p.agent_name === selectedAgent);
  const selectedDelegations = delegations.filter(d => d.agent_name === selectedAgent || d.grantor_name === selectedAgent);
  const selectedTasks = tasks.filter(t => t.metadata?.assigned_to === selectedAgent);
  const selectedMemories = memories.filter(m => m.author === `agent:${selectedAgent}` || m.author === 'observatory');

  const onlineCount = agents.filter(a => a.status === 'online').length;
  const avgScore = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + (a.reputation?.composite_score ?? 50), 0) / agents.length)
    : 0;
  const totalActions = agents.reduce((sum, a) => sum + (a.reputation?.total_actions ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={() => { setConnected(true); setLoading(true); fetchData(); }}
      />
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#C5A572]" />
            <span className="text-sm font-bold tracking-tight">Agent Trust</span>
            <span className="text-[10px] text-zinc-600 font-medium ml-1">Observatory</span>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {getConnection().apiUrl || 'local'}
              </span>
            )}
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-14 flex h-screen">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#C5A572] animate-spin" />
            </div>
          ) : (
            <>
              {/* Header + Stats */}
              <div className="shrink-0 px-8 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-5 h-5 text-[#C5A572]" />
                  <h1 className="text-lg font-bold text-[#E8E8ED]">Agent Console</h1>
                  <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {agents.length} agent{agents.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Agents Online', value: onlineCount, color: 'text-emerald-400' },
                    { label: 'Total Registered', value: agents.length, color: 'text-[#E8E8ED]' },
                    { label: 'Avg Reputation', value: avgScore, color: scoreColor(avgScore) },
                    { label: 'Total Actions', value: totalActions.toLocaleString(), color: 'text-[#E8E8ED]' },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-[#12121a] border border-white/[.06] px-4 py-3">
                      <div className="text-[10px] text-zinc-500 mb-1">{s.label}</div>
                      <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="shrink-0 px-8 pb-3">
                <div className="flex gap-1 bg-[#12121a] rounded-lg p-1 w-fit">
                  {[
                    { id: 'leaderboard' as const, icon: Users, label: 'Leaderboard' },
                    { id: 'graph' as const, icon: Link2, label: 'Trust Graph' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        tab === t.id ? 'bg-[#C19A5B]/15 text-[#C19A5B]' : 'text-zinc-500 hover:text-zinc-300'
                      )}>
                      <t.icon className="w-3.5 h-3.5 inline mr-1.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-8 pb-6" style={{ scrollbarGutter: 'stable' }}>
                {tab === 'leaderboard' ? (
                  <div className="rounded-lg bg-[#12121a] border border-white/[.06] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          {['#', 'Agent', 'DID', 'Status', 'Score', 'Actions', 'Success', 'Capabilities', ''].map(h => (
                            <th key={h} className={cn(
                              "text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3",
                              h === 'Score' || h === 'Actions' || h === 'Success' ? 'text-center' : 'text-left',
                              h === '#' && 'w-10', h === '' && 'w-8'
                            )}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((agent, idx) => {
                          const rep = agent.reputation;
                          const score = rep?.composite_score ?? 50;
                          const isSelected = selectedAgent === agent.name;
                          return (
                            <tr key={agent.id}
                              onClick={() => setSelectedAgent(isSelected ? null : agent.name)}
                              className={cn(
                                "border-b border-white/[.03] cursor-pointer transition-colors",
                                isSelected ? 'bg-[#C19A5B]/5' : 'hover:bg-white/[.02]'
                              )}>
                              <td className="px-4 py-3 text-xs text-zinc-600 font-mono">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="text-xs font-medium text-[#E8E8ED]">{agent.name}</div>
                                {agent.description && (
                                  <div className="text-[10px] text-zinc-600 mt-0.5 truncate max-w-[160px]">{agent.description}</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {agent.did ? shortDid(agent.did) : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(agent.status))} />
                                  <span className={cn("text-xs", statusColor(agent.status))}>{agent.status}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center"><ReputationBadge score={score} /></td>
                              <td className="px-4 py-3 text-center text-xs text-zinc-400 font-mono">{rep?.total_actions ?? 0}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn("text-xs font-mono",
                                  (rep?.success_rate ?? 1) >= 0.9 ? 'text-emerald-400' :
                                  (rep?.success_rate ?? 1) >= 0.7 ? 'text-amber-400' : 'text-red-400'
                                )}>
                                  {((rep?.success_rate ?? 1) * 100).toFixed(0)}%
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {agent.capabilities.slice(0, 3).map(cap => (
                                    <span key={cap} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{cap}</span>
                                  ))}
                                  {agent.capabilities.length > 3 && (
                                    <span className="text-[9px] text-zinc-600">+{agent.capabilities.length - 3}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform",
                                  isSelected ? 'text-[#C19A5B] rotate-90' : 'text-zinc-700'
                                )} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {agents.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                        <Users className="w-8 h-8 mb-3 text-zinc-700" />
                        <p className="text-sm">No agents registered</p>
                        <p className="text-xs mt-1">Register an agent via POST /v1/agents/register to get started</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#12121a] border border-white/[.06] p-6 overflow-x-auto">
                    <TrustGraph agents={agents} delegations={delegations}
                      selectedId={selectedAgent}
                      onSelect={(name) => setSelectedAgent(selectedAgent === name ? null : name)}
                    />
                  </div>
                )}

                {/* Activity Feed */}
                <div className="mt-4 rounded-lg bg-[#12121a] border border-white/[.06] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-[#C5A572]" />
                    <h2 className="text-sm font-medium text-[#E8E8ED]">Activity Feed</h2>
                    <span className="text-[10px] text-zinc-600">{provenance.length} recent</span>
                  </div>
                  {provenance.length === 0 ? (
                    <p className="text-xs text-zinc-600">No provenance entries yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {provenance.slice(0, 15).map(entry => {
                        const agentName = entry.agent_name;
                        return (
                          <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/[.02] transition-colors">
                            <Zap className="w-3 h-3 text-[#C5A572] shrink-0" />
                            <span className="text-xs text-[#E8E8ED] font-medium w-24 truncate">{agentName}</span>
                            <span className="text-xs text-zinc-400 w-16">{entry.action}</span>
                            <span className="text-[10px] font-mono text-zinc-600 flex-1 truncate">
                              {entry.entity_ids.slice(0, 2).map(id => shortId(id)).join(', ')}
                              {entry.entity_ids.length > 2 && ` +${entry.entity_ids.length - 2}`}
                            </span>
                            <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(entry.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right sidebar - Agent detail */}
        {selected && (
          <div className="w-[360px] shrink-0 border-l border-zinc-800/60 bg-[#0f0f0f] overflow-y-auto">
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#E8E8ED]">{selected.name}</h2>
                  {selected.description && <p className="text-[10px] text-zinc-500 mt-0.5">{selected.description}</p>}
                </div>
                <ReputationBadge score={selected.reputation?.composite_score ?? 50} size="lg" />
              </div>

              {/* Identity */}
              <Section icon={Fingerprint} title="Identity">
                {[
                  ['DID', selected.did ?? 'none'],
                  ['Agent ID', shortId(selected.id)],
                  ['Status', null],
                  ['Registered', timeAgo(selected.registered_at)],
                  ['Last seen', timeAgo(selected.last_seen_at)],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-[10px] text-zinc-600">{label}</span>
                    {label === 'Status' ? (
                      <div className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(selected.status))} />
                        <span className={cn("text-[10px]", statusColor(selected.status))}>{selected.status}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-400">{value}</span>
                    )}
                  </div>
                ))}
              </Section>

              {/* Reputation */}
              {selected.reputation && (
                <Section icon={Star} title="Reputation">
                  {[
                    { label: 'Success Rate', value: `${(selected.reputation.success_rate * 100).toFixed(0)}%`, pct: selected.reputation.success_rate * 100 },
                    { label: 'Total Actions', value: String(selected.reputation.total_actions), pct: Math.min(100, selected.reputation.total_actions) },
                    { label: 'Tenure', value: `${selected.reputation.tenure_days}d`, pct: Math.min(100, (selected.reputation.tenure_days / 90) * 100) },
                    { label: 'Action Diversity', value: String(selected.reputation.action_diversity ?? 0), pct: ((selected.reputation.action_diversity ?? 0) / 7) * 100 },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[10px] text-zinc-500">{item.label}</span>
                        <span className="text-[10px] text-zinc-300 font-mono">{item.value}</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full">
                        <div className="h-1 rounded-full bg-[#C5A572]" style={{ width: `${Math.min(100, item.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                  {selected.reputation.last_computed_at && (
                    <p className="text-[9px] text-zinc-600 mt-1">Last computed: {timeAgo(selected.reputation.last_computed_at)}</p>
                  )}
                </Section>
              )}

              {/* Capabilities */}
              <Section icon={Zap} title="Capabilities">
                <div className="flex flex-wrap gap-1.5">
                  {selected.capabilities.length > 0 ? (
                    selected.capabilities.map(cap => (
                      <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-[#C19A5B]/10 text-[#C19A5B] border border-[#C19A5B]/20">{cap}</span>
                    ))
                  ) : (
                    <span className="text-[10px] text-zinc-600">No capabilities declared</span>
                  )}
                </div>
              </Section>

              {/* Delegations */}
              <Section icon={Link2} title={`Delegations (${selectedDelegations.length})`}>
                {selectedDelegations.map(d => (
                  <div key={d.id} className="rounded-lg bg-[#0a0a0f] border border-white/5 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-zinc-400">{d.grantor_name}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-zinc-600" />
                        <span className="text-zinc-300 font-medium">{d.agent_name}</span>
                      </div>
                      {!d.revoked_at && (
                        <button onClick={() => handleRevokeDelegation(d.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                          title="Revoke delegation">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {d.scopes.map(s => (
                        <span key={s} className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400 group">
                          {s}
                          {!d.revoked_at && d.scopes.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveScope(d.id, d.scopes, s); }}
                              className="opacity-0 group-hover:opacity-100 ml-0.5 hover:text-red-400 transition-all"
                              title={`Remove ${s}`}
                            >
                              <XCircle className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {d.expires_at && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-2.5 h-2.5 text-zinc-600" />
                        <span className="text-[8px] text-zinc-600">
                          Expires: {new Date(d.expires_at).toLocaleDateString()} {new Date(d.expires_at).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Grant delegation form */}
                {showGrantForm ? (
                  <div className="rounded-lg bg-[#0a0a0f] border border-[#C19A5B]/20 p-3 space-y-3">
                    <p className="text-[10px] text-zinc-400 font-medium">Grant delegation to {selectedAgent}</p>

                    {/* Scopes */}
                    <div>
                      <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Scopes</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_SCOPES.map(scope => (
                          <button key={scope}
                            onClick={() => setGrantScopes(prev =>
                              prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
                            )}
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded-full border transition-colors",
                              grantScopes.includes(scope)
                                ? 'bg-[#C19A5B]/15 text-[#C19A5B] border-[#C19A5B]/30'
                                : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-500'
                            )}>
                            {scope}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        <input
                          value={grantCustomScope}
                          onChange={e => setGrantCustomScope(e.target.value)}
                          placeholder="Custom scope..."
                          className="flex-1 px-2 py-1 text-[9px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-300 placeholder-zinc-700 focus:border-[#C5A572]/50 focus:outline-none"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && grantCustomScope.trim()) {
                              setGrantScopes(prev => prev.includes(grantCustomScope.trim()) ? prev : [...prev, grantCustomScope.trim()]);
                              setGrantCustomScope('');
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (grantCustomScope.trim()) {
                              setGrantScopes(prev => prev.includes(grantCustomScope.trim()) ? prev : [...prev, grantCustomScope.trim()]);
                              setGrantCustomScope('');
                            }
                          }}
                          className="px-1.5 py-1 text-[9px] rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                        >Add</button>
                      </div>
                    </div>

                    {/* Expiry */}
                    <div>
                      <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Expiry</label>
                      <div className="flex flex-wrap gap-1.5">
                        {EXPIRY_OPTIONS.map(opt => (
                          <button key={opt.value}
                            onClick={() => setGrantExpiry(opt.value)}
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded-full border transition-colors",
                              grantExpiry === opt.value
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-500'
                            )}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Caveats */}
                    <div>
                      <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Caveats (optional)</label>
                      <div className="space-y-1.5">
                        <input
                          value={grantMaxCost}
                          onChange={e => setGrantMaxCost(e.target.value)}
                          placeholder="Max cost (e.g. 10.00)"
                          type="number"
                          step="0.01"
                          className="w-full px-2 py-1 text-[9px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-300 placeholder-zinc-700 focus:border-[#C5A572]/50 focus:outline-none"
                        />
                        <input
                          value={grantResources}
                          onChange={e => setGrantResources(e.target.value)}
                          placeholder="Resource restrictions (comma-separated, e.g. entities/*, memory/*)"
                          className="w-full px-2 py-1 text-[9px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-300 placeholder-zinc-700 focus:border-[#C5A572]/50 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button onClick={handleGrantDelegation}
                        disabled={grantScopes.length === 0 || actionLoading}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#C5A572] text-[#0a0a0f] text-[10px] font-bold disabled:opacity-30">
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Grant
                      </button>
                      <button onClick={() => { setShowGrantForm(false); setGrantScopes([]); setGrantCustomScope(''); setGrantExpiry(0); setGrantMaxCost(''); setGrantResources(''); }}
                        className="px-2.5 py-1 rounded-md text-zinc-500 text-[10px] hover:text-zinc-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowGrantForm(true)}
                    className="flex items-center gap-1.5 text-[10px] text-[#C19A5B] hover:text-[#D4BC94] transition-colors mt-1">
                    <Plus className="w-3 h-3" /> Grant delegation
                  </button>
                )}
              </Section>

              {/* Tasks */}
              <Section icon={ClipboardList} title={`Tasks (${selectedTasks.length})`}>
                {selectedTasks.map(t => (
                  <div key={t.id} className="flex items-start gap-2 py-1.5 px-2.5 rounded bg-[#0a0a0f] border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-zinc-300 truncate">{t.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[8px] px-1 py-0.5 rounded",
                          t.metadata?.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' :
                          t.metadata?.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                          'bg-amber-500/10 text-amber-400'
                        )}>{t.metadata?.status ?? 'open'}</span>
                        <span className="text-[8px] text-zinc-600">{t.metadata?.priority ?? 'medium'}</span>
                      </div>
                    </div>
                    {t.metadata?.status !== 'done' && (
                      <button onClick={() => handleCompleteTask(t.id)}
                        className="p-1 rounded hover:bg-emerald-500/10 text-zinc-600 hover:text-emerald-400 transition-colors"
                        title="Mark done">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {showTaskForm ? (
                  <div className="rounded-lg bg-[#0a0a0f] border border-[#C19A5B]/20 p-3 space-y-2">
                    <select value={taskAssignee || selectedAgent || ''}
                      onChange={e => setTaskAssignee(e.target.value)}
                      className="w-full px-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-400 focus:outline-none">
                      {agents.map(a => (
                        <option key={a.name} value={a.name}>{a.name}</option>
                      ))}
                    </select>
                    <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                      placeholder="Task title"
                      className="w-full px-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-300 focus:border-[#C5A572]/50 focus:outline-none" />
                    <textarea value={taskContent} onChange={e => setTaskContent(e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full px-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-300 focus:border-[#C5A572]/50 focus:outline-none resize-none" />
                    <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)}
                      className="w-full px-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-400 focus:outline-none">
                      <option value="low">Low priority</option>
                      <option value="medium">Medium priority</option>
                      <option value="high">High priority</option>
                      <option value="critical">Critical</option>
                    </select>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleCreateTask}
                        disabled={!taskTitle || actionLoading}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#C5A572] text-[#0a0a0f] text-[10px] font-bold disabled:opacity-30">
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Assign
                      </button>
                      <button onClick={() => { setShowTaskForm(false); setTaskTitle(''); setTaskContent(''); setTaskAssignee(''); }}
                        className="px-2.5 py-1 rounded-md text-zinc-500 text-[10px] hover:text-zinc-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowTaskForm(true)}
                    className="flex items-center gap-1.5 text-[10px] text-[#C19A5B] hover:text-[#D4BC94] transition-colors mt-1">
                    <Plus className="w-3 h-3" /> Assign task
                  </button>
                )}
              </Section>

              {/* Memory */}
              <Section icon={Brain} title={`Memory (${selectedMemories.length})`}>
                {selectedMemories.slice(0, 8).map(m => (
                  <div key={m.id} className="flex items-start gap-2 py-1.5 px-2.5 rounded bg-[#0a0a0f] border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-500">{m.entry_type}</span>
                        <span className="text-[10px] text-zinc-300 truncate">{m.title}</span>
                      </div>
                      <div className="text-[9px] text-zinc-600 mt-0.5 truncate">{m.content}</div>
                    </div>
                    <button onClick={() => handleArchiveMemory(m.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                      title="Archive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {showMemoryForm ? (
                  <div className="rounded-lg bg-[#0a0a0f] border border-[#C19A5B]/20 p-3 space-y-2">
                    <select value={memoryType} onChange={e => setMemoryType(e.target.value)}
                      className="w-full px-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-400 focus:outline-none">
                      <option value="knowledge">Knowledge</option>
                      <option value="decision">Decision</option>
                      <option value="investigation">Investigation</option>
                      <option value="pattern">Pattern</option>
                    </select>
                    <input value={memoryTitle} onChange={e => setMemoryTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full px-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-300 focus:border-[#C5A572]/50 focus:outline-none" />
                    <textarea value={memoryContent} onChange={e => setMemoryContent(e.target.value)}
                      placeholder="Content"
                      rows={3}
                      className="w-full px-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-white/10 rounded text-zinc-300 focus:border-[#C5A572]/50 focus:outline-none resize-none" />
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleCreateMemory}
                        disabled={!memoryTitle || actionLoading}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#C5A572] text-[#0a0a0f] text-[10px] font-bold disabled:opacity-30">
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                        Save
                      </button>
                      <button onClick={() => { setShowMemoryForm(false); setMemoryTitle(''); setMemoryContent(''); }}
                        className="px-2.5 py-1 rounded-md text-zinc-500 text-[10px] hover:text-zinc-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowMemoryForm(true)}
                    className="flex items-center gap-1.5 text-[10px] text-[#C19A5B] hover:text-[#D4BC94] transition-colors mt-1">
                    <Plus className="w-3 h-3" /> Add memory
                  </button>
                )}
              </Section>

              {/* In-Context RL */}
              <Section icon={BarChart3} title="In-Context RL">
                {recallData && recallData.summary.total_outcomes > 0 ? (
                  <div className="space-y-3">
                    {/* RL Loop Diagram */}
                    <div className="rounded-lg bg-[#0a0a0f] border border-white/5 p-2">
                      <RLLoopDiagram trend={recallData.summary.recent_trend} />
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Success', value: recallData.summary.success_rate !== null ? `${(recallData.summary.success_rate * 100).toFixed(0)}%` : '-', color: 'text-emerald-400' },
                        { label: 'Avg Reward', value: recallData.summary.avg_reward !== null ? recallData.summary.avg_reward.toFixed(2) : '-', color: 'text-[#C19A5B]' },
                        { label: 'Outcomes', value: String(recallData.summary.total_outcomes), color: 'text-zinc-300' },
                      ].map(s => (
                        <div key={s.label} className="rounded bg-[#0a0a0f] border border-white/5 px-2 py-1.5 text-center">
                          <div className={cn("text-sm font-bold font-mono", s.color)}>{s.value}</div>
                          <div className="text-[8px] text-zinc-600 mt-0.5">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Learning Curve */}
                    {trendData && trendData.points.length > 1 && (
                      <div className="rounded-lg bg-[#0a0a0f] border border-white/5 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-zinc-500 font-medium">Reward Signal</span>
                          <div className="flex gap-1">
                            {['24h', '7d', '30d'].map(w => (
                              <button key={w} onClick={() => setTrendWindow(w)}
                                className={cn("text-[8px] px-1.5 py-0.5 rounded",
                                  trendWindow === w ? 'bg-[#C19A5B]/15 text-[#C19A5B]' : 'text-zinc-600 hover:text-zinc-400'
                                )}>{w}</button>
                            ))}
                          </div>
                        </div>
                        <LearningCurve points={trendData.points} />
                      </div>
                    )}

                    {/* Top Actions */}
                    {(recallData.summary.top_success_actions.length > 0 || recallData.summary.top_failure_actions.length > 0) && (
                      <div className="flex gap-3">
                        {recallData.summary.top_success_actions.length > 0 && (
                          <div className="flex-1">
                            <div className="text-[8px] text-zinc-600 mb-1">Strong at</div>
                            <div className="flex flex-wrap gap-1">
                              {recallData.summary.top_success_actions.map(a => (
                                <span key={a} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{a}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {recallData.summary.top_failure_actions.length > 0 && (
                          <div className="flex-1">
                            <div className="text-[8px] text-zinc-600 mb-1">Weak at</div>
                            <div className="flex flex-wrap gap-1">
                              {recallData.summary.top_failure_actions.map(a => (
                                <span key={a} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">{a}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Outcomes */}
                    <div>
                      <div className="text-[8px] text-zinc-600 mb-1.5">Recent</div>
                      {recallData.entries.slice(0, 6).map(o => (
                        <div key={o.id} className="flex items-start gap-2 py-1.5 px-2.5 rounded bg-[#0a0a0f] border border-white/5 mb-1">
                          {outcomeIcon(o.metadata?.result ?? '')}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-zinc-300 truncate">{o.title}</div>
                            <div className="text-[9px] text-zinc-600 mt-0.5 truncate">{o.content}</div>
                          </div>
                          {o.metadata?.reward_signal !== undefined && (
                            <span className={cn("text-[9px] font-mono shrink-0",
                              o.metadata.reward_signal >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                              {o.metadata.reward_signal >= 0 ? '+' : ''}{o.metadata.reward_signal.toFixed(1)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-600 py-2">
                    {selected?.did ? 'No outcomes recorded yet' : 'Agent has no DID - register with a DID to enable RL'}
                  </div>
                )}
              </Section>

              {/* Provenance */}
              {selectedProvenance.length > 0 && (
                <Section icon={Eye} title={`Provenance (${selectedProvenance.length})`}>
                  {selectedProvenance.slice(0, 10).map(p => (
                    <div key={p.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded bg-[#0a0a0f] border border-white/5">
                      <span className="text-[10px] text-zinc-400 w-12">{p.action}</span>
                      <span className="text-[9px] font-mono text-zinc-600 flex-1 truncate">
                        {p.entity_ids.map(id => shortId(id)).join(', ')}
                      </span>
                      <span className="text-[9px] text-zinc-600 shrink-0">{timeAgo(p.created_at)}</span>
                    </div>
                  ))}
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Learning Curve Chart (SVG)
// ---------------------------------------------------------------------------

const LearningCurve: React.FC<{
  points: TrendPoint[];
  width?: number;
  height?: number;
}> = ({ points, width = 300, height = 100 }) => {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-[10px] text-zinc-600">
        No outcome data yet
      </div>
    );
  }

  const pad = { top: 8, right: 8, bottom: 20, left: 28 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  // Reward values (0-1 scale, default 0.5 for null)
  const values = points.map(p => p.avg_reward ?? 0.5);
  const minV = 0;
  const maxV = 1;

  const x = (i: number) => pad.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => pad.top + h - ((v - minV) / (maxV - minV)) * h;

  // Line path
  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // Area path (filled below line)
  const areaPath = `${linePath} L${x(values.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  // X-axis labels (first, middle, last)
  const formatTime = (t: string) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <g key={v}>
          <line x1={pad.left} y1={y(v)} x2={width - pad.right} y2={y(v)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <text x={pad.left - 4} y={y(v) + 3} textAnchor="end"
            className="fill-zinc-600" style={{ fontSize: '8px' }}>{v.toFixed(1)}</text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#rewardGradient)" />
      <defs>
        <linearGradient id="rewardGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C19A5B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#C19A5B" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Line */}
      <path d={linePath} fill="none" stroke="#C19A5B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5"
          fill="#0a0a0f" stroke="#C19A5B" strokeWidth="1.5" />
      ))}

      {/* Success/failure bars at bottom */}
      {points.map((p, i) => {
        const barW = Math.max(2, w / points.length - 2);
        const bx = x(i) - barW / 2;
        const ratio = p.total > 0 ? p.successes / p.total : 0.5;
        return (
          <g key={`bar-${i}`}>
            <rect x={bx} y={height - 12} width={barW * ratio} height={4} rx="1" fill="#34d399" opacity="0.6" />
            <rect x={bx + barW * ratio} y={height - 12} width={barW * (1 - ratio)} height={4} rx="1" fill="#f87171" opacity="0.4" />
          </g>
        );
      })}

      {/* X-axis time labels */}
      {points.length > 0 && (
        <>
          <text x={x(0)} y={height - 1} textAnchor="start" className="fill-zinc-600" style={{ fontSize: '8px' }}>
            {formatTime(points[0].time)}
          </text>
          {points.length > 2 && (
            <text x={x(points.length - 1)} y={height - 1} textAnchor="end" className="fill-zinc-600" style={{ fontSize: '8px' }}>
              {formatTime(points[points.length - 1].time)}
            </text>
          )}
        </>
      )}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// RL Loop Diagram
// ---------------------------------------------------------------------------

const RLLoopDiagram: React.FC<{ trend: 'improving' | 'declining' | 'stable' }> = ({ trend }) => {
  const trendColor = trend === 'improving' ? 'text-emerald-400' : trend === 'declining' ? 'text-red-400' : 'text-zinc-400';
  const trendLabel = trend === 'improving' ? 'Learning' : trend === 'declining' ? 'Degrading' : 'Stable';

  return (
    <div className="flex items-center justify-between px-2 py-2">
      {[
        { icon: Zap, label: 'Act', color: 'text-[#C19A5B]' },
        { icon: Eye, label: 'Outcome', color: 'text-zinc-400' },
        { icon: Brain, label: 'Memorize', color: 'text-purple-400' },
        { icon: RotateCw, label: trendLabel, color: trendColor },
      ].map((step, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ArrowRight className="w-3 h-3 text-zinc-700 shrink-0" />}
          <div className="flex flex-col items-center gap-0.5">
            <step.icon className={cn("w-3.5 h-3.5", step.color)} />
            <span className={cn("text-[8px] font-medium", step.color)}>{step.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sidebar Section helper
// ---------------------------------------------------------------------------

const Section: React.FC<{
  icon: React.FC<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
  <div className="mb-5">
    <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <Icon className="w-3 h-3" />
      {title}
    </h3>
    <div className="space-y-1.5">
      {children}
    </div>
  </div>
);
