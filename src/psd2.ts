import { euro } from './finance';

export type ExternalAccount = {
  bank: string;
  flag: string;
  type: 'checking' | 'savings' | 'investment';
  balanceCents: number;
  lastSyncedAt: string;
  status: 'connected' | 'expired';
};

// Fully mocked PSD2-connected external accounts per demo user
export const PSD2_ACCOUNTS: Record<string, ExternalAccount[]> = {
  // Robin — salary sweeps suggest money going to another bank
  CUST00047: [
    { bank: 'OP', flag: '🇫🇮', type: 'savings', balanceCents: 1240000, lastSyncedAt: '2026-11-13', status: 'connected' },
    { bank: 'Nordea', flag: '🇫🇮', type: 'checking', balanceCents: 387500, lastSyncedAt: '2026-11-13', status: 'connected' },
    { bank: 'Danske Bank', flag: '🇩🇰', type: 'investment', balanceCents: 890000, lastSyncedAt: '2026-10-28', status: 'expired' },
  ],
  // Alex — older saver, likely has OP savings + investment depot
  CUST00115: [
    { bank: 'OP', flag: '🇫🇮', type: 'savings', balanceCents: 2150000, lastSyncedAt: '2026-11-12', status: 'connected' },
    { bank: 'Evli', flag: '🇫🇮', type: 'investment', balanceCents: 4320000, lastSyncedAt: '2026-11-10', status: 'connected' },
  ],
  // Noa — young investor, Nordea student account
  CUST00050: [
    { bank: 'Nordea', flag: '🇫🇮', type: 'checking', balanceCents: 214000, lastSyncedAt: '2026-11-13', status: 'connected' },
    { bank: 'Nordnet', flag: '🇸🇪', type: 'investment', balanceCents: 670000, lastSyncedAt: '2026-11-11', status: 'connected' },
  ],
  // Sam — family, joint Danske checking
  CUST00038: [
    { bank: 'Danske Bank', flag: '🇩🇰', type: 'checking', balanceCents: 520000, lastSyncedAt: '2026-11-13', status: 'connected' },
    { bank: 'OP', flag: '🇫🇮', type: 'savings', balanceCents: 3100000, lastSyncedAt: '2026-10-15', status: 'expired' },
  ],
  // Maya — young professional, one expired Nordea
  CUST00117: [
    { bank: 'Nordea', flag: '🇫🇮', type: 'checking', balanceCents: 98000, lastSyncedAt: '2026-11-13', status: 'connected' },
    { bank: 'Revolut', flag: '🇬🇧', type: 'savings', balanceCents: 43500, lastSyncedAt: '2026-10-01', status: 'expired' },
  ],
};

export function getPsd2Accounts(userId: string): ExternalAccount[] {
  return PSD2_ACCOUNTS[userId] ?? [];
}

export function psd2TotalCents(accounts: ExternalAccount[]): number {
  return accounts.filter(a => a.status === 'connected').reduce((sum, a) => sum + a.balanceCents, 0);
}

export function psd2InvestmentCents(accounts: ExternalAccount[]): number {
  return accounts.filter(a => a.status === 'connected' && a.type === 'investment').reduce((sum, a) => sum + a.balanceCents, 0);
}

export function psd2AgentContext(userId: string): string {
  const accounts = getPsd2Accounts(userId);
  if (!accounts.length) return '';
  const connected = accounts.filter(a => a.status === 'connected');
  const expired = accounts.filter(a => a.status === 'expired');
  const total = psd2TotalCents(accounts);
  const lines = connected.map(a => `- ${a.bank} ${a.type}: ${euro(a.balanceCents)} (synced ${a.lastSyncedAt})`);
  if (expired.length) lines.push(`- ${expired.map(a => a.bank).join(', ')}: connection expired, balance unavailable`);
  return `\nCONNECTED EXTERNAL ACCOUNTS (via PSD2 open banking):\n${lines.join('\n')}\nTotal across all connected external accounts: ${euro(total)}\nUse this data when the user asks about total savings, full financial picture, or cross-bank balances.\n`;
}
