import { useState, useEffect } from 'react';
import { Search, CheckCircle, Inbox, RefreshCw, Users, Heart, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

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

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

interface SimilarResult {
  similar: { id: string; type: string; amount: number; date: string }[];
  count: number;
  donorName: string;
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
  const [matchTarget, setMatchTarget] = useState<'member' | 'donor'>('member');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [rerunning, setRerunning] = useState(false);
  const [rerunResult, setRerunResult] = useState<string | null>(null);
  const [bulkPrompt, setBulkPrompt] = useState<{ donorName: string; similar: SimilarResult['similar']; memberId?: string; donorId?: string; targetName: string } | null>(null);
  const [bulkMatching, setBulkMatching] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ items: UnmatchedItem[]; total: number }>('/unmatched');
      setItems(data.items);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function searchEntities(query: string) {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const endpoint = matchTarget === 'member' ? '/members' : '/donors';
      const data = await api.get<{ members?: SearchResult[]; donors?: SearchResult[] }>(`${endpoint}?search=${encodeURIComponent(query)}&limit=5`);
      setSearchResults(data.members || data.donors || []);
    } catch { /* ignore */ }
  }

  async function matchItem(itemId: string, targetId: string, type: string, targetName: string) {
    try {
      const body = matchTarget === 'member'
        ? { memberId: targetId, type }
        : { donorId: targetId, type };
      await api.put(`/unmatched/${itemId}/match`, body);

      // Check for similar unmatched records
      try {
        const sim = await api.get<SimilarResult>(`/unmatched/${itemId}/similar?type=${type}`);
        if (sim.count > 0) {
          setBulkPrompt({
            donorName: sim.donorName,
            similar: sim.similar,
            memberId: matchTarget === 'member' ? targetId : undefined,
            donorId: matchTarget === 'donor' ? targetId : undefined,
            targetName,
          });
        }
      } catch { /* ignore */ }

      setMatchingId(null);
      setSearchQuery('');
      setSearchResults([]);
      load();
    } catch { /* ignore */ }
  }

  async function handleBulkMatch() {
    if (!bulkPrompt) return;
    setBulkMatching(true);
    try {
      await api.post('/unmatched/bulk-match', {
        items: bulkPrompt.similar.map(s => ({ id: s.id, type: s.type })),
        memberId: bulkPrompt.memberId,
        donorId: bulkPrompt.donorId,
      });
      setBulkPrompt(null);
      load();
    } catch { /* ignore */ } finally { setBulkMatching(false); }
  }

  async function handleRerun() {
    setRerunning(true);
    setRerunResult(null);
    try {
      const data = await api.post<{ processed: number; newMatches: number }>('/unmatched/rerun-matching');
      setRerunResult(`Matched ${data.newMatches} of ${data.processed} records.`);
      load();
    } catch (err: any) {
      setRerunResult(`Error: ${err.message}`);
    } finally { setRerunning(false); }
  }

  async function deleteItem(item: UnmatchedItem) {
    if (!confirm(`Delete this donation from "${item.donorName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/unmatched/${item.id}?type=${item.type}`);
      toast('Donation deleted');
      load();
    } catch { toast('Failed to delete', 'error'); }
  }

  function startMatching(item: UnmatchedItem) {
    setMatchingId(item.id);
    setMatchingType(item.type);
    setSearchQuery('');
    setSearchResults([]);
  }

  function cancelMatching() {
    setMatchingId(null);
    setSearchQuery('');
    setSearchResults([]);
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Misc Donations</h1>
          <p className="text-sm text-muted-foreground">Unmatched donations from all import sources. Match them to members or donors.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{items.length} unmatched</span>
          <button onClick={handleRerun} disabled={rerunning}
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-50">
            <RefreshCw size={14} className={rerunning ? 'animate-spin' : ''} />
            {rerunning ? 'Running...' : 'Rerun Matching'}
          </button>
        </div>
      </div>

      {rerunResult && (
        <div className={`px-4 py-3 rounded-md mb-4 text-sm ${rerunResult.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {rerunResult}
          <button onClick={() => setRerunResult(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {bulkPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-2">Match Similar Records?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              There {bulkPrompt.similar.length === 1 ? 'is' : 'are'} <strong>{bulkPrompt.similar.length}</strong> other
              unmatched donation{bulkPrompt.similar.length !== 1 ? 's' : ''} from &quot;<strong>{bulkPrompt.donorName}</strong>&quot;.
              Match all of them to <strong>{bulkPrompt.targetName}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkPrompt(null)} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">Skip</button>
              <button onClick={handleBulkMatch} disabled={bulkMatching}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50">
                {bulkMatching ? 'Matching...' : `Match All ${bulkPrompt.similar.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th className="px-4 py-2"></th>
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
                      <div className="space-y-1 min-w-[220px]">
                        <div className="flex gap-1 mb-1">
                          <button onClick={() => { setMatchTarget('member'); setSearchQuery(''); setSearchResults([]); }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${matchTarget === 'member' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            <Users size={10} /> Member
                          </button>
                          <button onClick={() => { setMatchTarget('donor'); setSearchQuery(''); setSearchResults([]); }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${matchTarget === 'donor' ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                            <Heart size={10} /> Donor
                          </button>
                        </div>
                        <div className="relative">
                          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder={`Search ${matchTarget}...`}
                            value={searchQuery}
                            onChange={e => searchEntities(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 border border-border rounded text-xs"
                            autoFocus
                          />
                        </div>
                        {searchResults.map(r => (
                          <button key={r.id} onClick={() => matchItem(item.id, r.id, matchingType, `${r.firstName} ${r.lastName}`)}
                            className="block w-full text-left px-2 py-1 text-xs hover:bg-muted rounded">
                            {r.firstName} {r.lastName} {r.email ? `(${r.email})` : ''}
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
                  <td className="px-4 py-2">
                    <button onClick={() => deleteItem(item)} title="Delete" className="text-muted-foreground hover:text-destructive">
                      <Trash2 size={14} />
                    </button>
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
