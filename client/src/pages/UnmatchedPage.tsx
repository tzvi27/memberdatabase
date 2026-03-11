import { useState, useEffect } from 'react';
import { Search, CheckCircle, Inbox } from 'lucide-react';
import { api } from '../lib/api';

interface UnmatchedItem {
  id: string;
  type: 'donation' | 'zelle';
  date: string;
  amount: number;
  source: string;
  donorName: string;
  description: string | null;
  externalId: string | null;
}

interface MemberOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

const SOURCE_LABELS: Record<string, { label: string; class: string }> = {
  ZELLE: { label: 'Zelle', class: 'bg-purple-100 text-purple-700' },
  DONORS_FUND: { label: 'Donors Fund', class: 'bg-blue-100 text-blue-700' },
  CREDIT_CARD: { label: 'Credit Card', class: 'bg-gray-100 text-gray-700' },
  CASH: { label: 'Cash', class: 'bg-green-100 text-green-700' },
  CHECK: { label: 'Check', class: 'bg-amber-100 text-amber-700' },
  OTHER: { label: 'Other', class: 'bg-gray-100 text-gray-500' },
};

export default function UnmatchedPage() {
  const [items, setItems] = useState<UnmatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [matchingType, setMatchingType] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<MemberOption[]>([]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ items: UnmatchedItem[]; total: number }>('/unmatched');
      setItems(data.items);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function searchMembers(query: string) {
    setMemberSearch(query);
    if (query.length < 2) { setMemberResults([]); return; }
    try {
      const data = await api.get<{ members: MemberOption[] }>(`/members?search=${encodeURIComponent(query)}&limit=5`);
      setMemberResults(data.members);
    } catch { /* ignore */ }
  }

  async function matchItem(itemId: string, memberId: string, type: string) {
    try {
      await api.put(`/unmatched/${itemId}/match`, { memberId, type });
      setMatchingId(null);
      setMemberSearch('');
      setMemberResults([]);
      load();
    } catch { /* ignore */ }
  }

  function startMatching(item: UnmatchedItem) {
    setMatchingId(item.id);
    setMatchingType(item.type);
    setMemberSearch('');
    setMemberResults([]);
  }

  function cancelMatching() {
    setMatchingId(null);
    setMemberSearch('');
    setMemberResults([]);
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Misc Donations</h1>
          <p className="text-sm text-muted-foreground">Unmatched donations from all import sources. Match them to members manually.</p>
        </div>
        <span className="text-sm text-muted-foreground">{items.length} unmatched</span>
      </div>

      <div className="bg-background rounded-lg border border-border overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox size={40} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No unmatched donations. All caught up!</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Source</th>
                <th className="text-left px-4 py-2 font-medium">Donor</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="text-left px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={`${item.type}-${item.id}`} className="border-b border-border">
                  <td className="px-4 py-2">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_LABELS[item.source]?.class || 'bg-gray-100 text-gray-500'}`}>
                      {SOURCE_LABELS[item.source]?.label || item.source}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium">{item.donorName}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{item.description || '-'}</td>
                  <td className="px-4 py-2 text-right font-medium">${item.amount.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {matchingId === item.id ? (
                      <div className="space-y-1 min-w-[200px]">
                        <div className="relative">
                          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search member..."
                            value={memberSearch}
                            onChange={e => searchMembers(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 border border-border rounded text-xs"
                            autoFocus
                          />
                        </div>
                        {memberResults.map(m => (
                          <button key={m.id} onClick={() => matchItem(item.id, m.id, matchingType)}
                            className="block w-full text-left px-2 py-1 text-xs hover:bg-muted rounded">
                            {m.firstName} {m.lastName} {m.email ? `(${m.email})` : ''}
                          </button>
                        ))}
                        <button onClick={cancelMatching} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startMatching(item)}
                        className="text-xs text-accent hover:underline flex items-center gap-1">
                        <CheckCircle size={12} /> Match
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
