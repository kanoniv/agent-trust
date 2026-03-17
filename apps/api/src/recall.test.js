import { describe, it, expect } from 'vitest';
import { computeRecallSummary, parseWindow } from './recall.js';

// --- Helper to build outcome rows ---
function outcome(action, result, rewardSignal) {
  return {
    entry_type: 'outcome',
    metadata: { action, result, reward_signal: rewardSignal },
  };
}

// =========================================================================
// computeRecallSummary
// =========================================================================
describe('computeRecallSummary', () => {
  it('returns null stats for empty rows', () => {
    const s = computeRecallSummary([]);
    expect(s.total_outcomes).toBe(0);
    expect(s.successes).toBe(0);
    expect(s.failures).toBe(0);
    expect(s.success_rate).toBeNull();
    expect(s.avg_reward).toBeNull();
    expect(s.recent_trend).toBe('stable');
    expect(s.top_success_actions).toEqual([]);
    expect(s.top_failure_actions).toEqual([]);
  });

  it('filters non-outcome rows', () => {
    const rows = [
      { entry_type: 'knowledge', metadata: {} },
      { entry_type: 'decision', metadata: {} },
      outcome('resolve', 'success', 1.0),
    ];
    const s = computeRecallSummary(rows);
    expect(s.total_outcomes).toBe(1);
    expect(s.successes).toBe(1);
  });

  it('computes correct success rate', () => {
    const rows = [
      outcome('resolve', 'success', 1.0),
      outcome('resolve', 'success', 0.8),
      outcome('merge', 'failure', -0.5),
      outcome('search', 'success', 0.9),
    ];
    const s = computeRecallSummary(rows);
    expect(s.total_outcomes).toBe(4);
    expect(s.successes).toBe(3);
    expect(s.failures).toBe(1);
    expect(s.success_rate).toBe(0.75);
  });

  it('computes correct avg reward', () => {
    const rows = [
      outcome('resolve', 'success', 1.0),
      outcome('resolve', 'success', 0.5),
      outcome('resolve', 'failure', 0.0),
    ];
    const s = computeRecallSummary(rows);
    expect(s.avg_reward).toBe(0.5);
  });

  it('ignores rows with missing reward_signal for avg calculation', () => {
    const rows = [
      outcome('resolve', 'success', 1.0),
      { entry_type: 'outcome', metadata: { action: 'search', result: 'success' } }, // no reward_signal
      outcome('merge', 'failure', 0.0),
    ];
    const s = computeRecallSummary(rows);
    expect(s.avg_reward).toBe(0.5); // (1.0 + 0.0) / 2
    expect(s.total_outcomes).toBe(3); // all 3 count as outcomes
  });

  // --- Trend detection ---
  it('detects improving trend (recent rewards higher than prior)', () => {
    // Recent (first 5): all 0.9. Prior (next 5): all 0.3.
    const rows = [
      ...Array(5).fill(null).map(() => outcome('resolve', 'success', 0.9)),
      ...Array(5).fill(null).map(() => outcome('resolve', 'failure', 0.3)),
    ];
    const s = computeRecallSummary(rows);
    expect(s.recent_trend).toBe('improving');
  });

  it('detects declining trend (recent rewards lower than prior)', () => {
    const rows = [
      ...Array(5).fill(null).map(() => outcome('resolve', 'failure', 0.2)),
      ...Array(5).fill(null).map(() => outcome('resolve', 'success', 0.9)),
    ];
    const s = computeRecallSummary(rows);
    expect(s.recent_trend).toBe('declining');
  });

  it('detects stable trend when difference is within threshold', () => {
    const rows = [
      ...Array(5).fill(null).map(() => outcome('resolve', 'success', 0.75)),
      ...Array(5).fill(null).map(() => outcome('resolve', 'success', 0.72)),
    ];
    const s = computeRecallSummary(rows);
    expect(s.recent_trend).toBe('stable');
  });

  it('stays stable when fewer than 6 rewards', () => {
    const rows = [
      ...Array(5).fill(null).map(() => outcome('resolve', 'success', 1.0)),
    ];
    const s = computeRecallSummary(rows);
    expect(s.recent_trend).toBe('stable');
  });

  it('handles exactly 6 rewards (minimum for trend)', () => {
    const rows = [
      ...Array(5).fill(null).map(() => outcome('resolve', 'success', 1.0)),
      outcome('resolve', 'failure', 0.0), // 6th, goes into "prior" bucket (1 item)
    ];
    const s = computeRecallSummary(rows);
    // recent avg = 1.0, prior avg = 0.0 (1 item), diff = 1.0 > 0.1
    expect(s.recent_trend).toBe('improving');
  });

  // --- Top actions ---
  it('ranks top success actions by count', () => {
    const rows = [
      outcome('resolve', 'success', 1.0),
      outcome('resolve', 'success', 1.0),
      outcome('resolve', 'success', 1.0),
      outcome('search', 'success', 0.8),
      outcome('search', 'success', 0.8),
      outcome('merge', 'success', 0.9),
    ];
    const s = computeRecallSummary(rows);
    expect(s.top_success_actions).toEqual(['resolve', 'search', 'merge']);
  });

  it('ranks top failure actions and excludes zero-failure actions', () => {
    const rows = [
      outcome('merge', 'failure', -0.5),
      outcome('merge', 'failure', -0.3),
      outcome('split', 'failure', -0.7),
      outcome('resolve', 'success', 1.0), // no failures
    ];
    const s = computeRecallSummary(rows);
    expect(s.top_failure_actions).toEqual(['merge', 'split']);
    expect(s.top_failure_actions).not.toContain('resolve');
  });

  it('limits to top 3 actions', () => {
    const rows = [
      outcome('a', 'success', 1.0),
      outcome('b', 'success', 1.0),
      outcome('c', 'success', 1.0),
      outcome('d', 'success', 1.0),
      outcome('e', 'success', 1.0),
    ];
    const s = computeRecallSummary(rows);
    expect(s.top_success_actions).toHaveLength(3);
  });

  it('uses "unknown" for outcomes with no action in metadata', () => {
    const rows = [
      { entry_type: 'outcome', metadata: { result: 'success', reward_signal: 1.0 } },
    ];
    const s = computeRecallSummary(rows);
    expect(s.top_success_actions).toEqual(['unknown']);
  });

  it('handles outcomes with null metadata gracefully', () => {
    const rows = [
      { entry_type: 'outcome', metadata: null },
      { entry_type: 'outcome' },
    ];
    const s = computeRecallSummary(rows);
    expect(s.total_outcomes).toBe(2);
    expect(s.successes).toBe(0);
    expect(s.failures).toBe(0);
    expect(s.avg_reward).toBeNull();
  });

  it('handles negative reward signals', () => {
    const rows = [
      outcome('merge', 'failure', -1.0),
      outcome('merge', 'failure', -0.5),
    ];
    const s = computeRecallSummary(rows);
    expect(s.avg_reward).toBe(-0.75);
  });

  it('handles single outcome', () => {
    const rows = [outcome('resolve', 'success', 0.95)];
    const s = computeRecallSummary(rows);
    expect(s.total_outcomes).toBe(1);
    expect(s.successes).toBe(1);
    expect(s.failures).toBe(0);
    expect(s.success_rate).toBe(1.0);
    expect(s.avg_reward).toBe(0.95);
    expect(s.recent_trend).toBe('stable');
  });

  it('counts partial result (not success or failure) as neither', () => {
    const rows = [
      outcome('resolve', 'partial', 0.5),
      outcome('resolve', 'success', 1.0),
    ];
    const s = computeRecallSummary(rows);
    expect(s.total_outcomes).toBe(2);
    expect(s.successes).toBe(1);
    expect(s.failures).toBe(0);
    // success_rate counts success / total, so partial counts against success rate
    expect(s.success_rate).toBe(0.5);
  });
});

// =========================================================================
// parseWindow
// =========================================================================
describe('parseWindow', () => {
  it('defaults to 7d when no input', () => {
    const p = parseWindow(undefined);
    expect(p.windowStr).toBe('7d');
    expect(p.interval).toBe('7 days');
    expect(p.bucket).toBe('1 day');
    expect(p.truncField).toBe('day');
  });

  it('parses hours correctly', () => {
    const p = parseWindow('24h');
    expect(p.windowStr).toBe('24h');
    expect(p.interval).toBe('24 hours');
    expect(p.bucket).toBe('1 hour');
    expect(p.truncField).toBe('hour');
  });

  it('parses days correctly', () => {
    const p = parseWindow('30d');
    expect(p.windowStr).toBe('30d');
    expect(p.interval).toBe('30 days');
    expect(p.bucket).toBe('1 day');
    expect(p.truncField).toBe('day');
  });

  it('uses hourly buckets for <= 48h windows', () => {
    expect(parseWindow('1h').bucket).toBe('1 hour');
    expect(parseWindow('48h').bucket).toBe('1 hour');
    expect(parseWindow('2d').bucket).toBe('1 hour');  // 2d = 48h
  });

  it('uses daily buckets for > 48h windows', () => {
    expect(parseWindow('49h').bucket).toBe('1 day');
    expect(parseWindow('3d').bucket).toBe('1 day');   // 3d = 72h
    expect(parseWindow('7d').bucket).toBe('1 day');
  });

  it('returns null for invalid formats', () => {
    expect(parseWindow('abc')).toBeNull();
    expect(parseWindow('7w')).toBeNull();
    expect(parseWindow('7')).toBeNull();
    expect(parseWindow('d7')).toBeNull();
    expect(parseWindow('-5d')).toBeNull();
  });

  it('defaults falsy input to 7d', () => {
    // Empty string and null both fall through to default '7d'
    expect(parseWindow('')).not.toBeNull();
    expect(parseWindow('').windowStr).toBe('7d');
    expect(parseWindow(null)).not.toBeNull();
    expect(parseWindow(null).windowStr).toBe('7d');
  });

  it('handles large numbers', () => {
    const p = parseWindow('365d');
    expect(p.interval).toBe('365 days');
    expect(p.bucket).toBe('1 day');
  });

  it('handles 1h (minimum)', () => {
    const p = parseWindow('1h');
    expect(p.interval).toBe('1 hours');
    expect(p.bucket).toBe('1 hour');
  });

  it('handles 1d', () => {
    const p = parseWindow('1d');
    expect(p.interval).toBe('1 days');
    expect(p.bucket).toBe('1 hour');  // 24h <= 48h threshold
  });
});
