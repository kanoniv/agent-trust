import {
  LayoutDashboard,
  Users,
  Waypoints,
  Shield,
  MessageCircle,
  Globe,
} from 'lucide-react';

export const GOLD = '#C5A572';

export const DEFAULT_SCOPES = [
  'read', 'write', 'execute', 'delegate', 'admin',
];

export const EXPIRY_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 168 },
  { label: '30 days', value: 720 },
  { label: 'No expiry', value: 0 },
];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'agents', label: 'Agents', icon: Users, path: '/agents' },
  { id: 'graph', label: 'Trust Graph', icon: Waypoints, path: '/graph' },
  { id: 'provenance', label: 'Provenance', icon: Shield, path: '/provenance' },
  { id: 'interop', label: 'Interop', icon: Globe, path: '/interop' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, path: '/chat' },
] as const;
