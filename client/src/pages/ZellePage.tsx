import { useState, useEffect } from 'react';
import { Upload, CheckCircle, Search } from 'lucide-react';
import { api } from '../lib/api';

interface ZellePayment {
  id: string;
  amount: string;
  date: string;
  senderName: string;
  transactionNumber: string | null;
  matched: boolean;
  memberId: string | null;
}

interface MemberOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

export default function ZellePage() {
  const [pending, setPending] = useState<ZellePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<MemberOption[]>([]);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  async function loadPending() {
    try {
      const data = await api.get<ZellePayment[]>('/zelle/pending');
      setPending(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadPending(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post<{ payments: any[] }>('/zelle/upload', formData);
      setUploadResult(`Processed ${data.payments.length} payment(s). ${data.payments.filter((p: any) => p.matched).length} auto-matched.`);
      loadPending();
    } catch (err: any) {
      setUploadResult(`Error: ${err.message}`);
    } finally { setUploading(false); }
  }

  async function handleTextUpload() {
    if (!uploadText.trim()) return;
    setUploading(true);
    try {
      const data = await api.post<{ payments: any[] }>('/zelle/upload', { text: uploadText });
      setUploadResult(`Processed ${data.payments.length} payment(s). ${data.payments.filter((p: any) => p.matched).length} auto-matched.`);
      setUploadText('');
      setShowUpload(false);
      loadPending();
    } catch (err: any) {
      setUploadResult(`Error: ${err.message}`);
    } finally { setUploading(false); }
  }

  async function searchMembers(query: string) {
    setMemberSearch(query);
    if (query.length < 2) { setMemberResults([]); return; }
    try {
      const data = await api.get<{ members: MemberOption[] }>(`/members?search=${encodeURIComponent(query)}&limit=5`);
      setMemberResults(data.members);
    } catch { /* ignore */ }
  }

  async function matchPayment(paymentId: string, memberId: string) {
    try {
      await api.put(`/zelle/${paymentId}/match`, { memberId });
      setMatchingId(null);
      setMemberSearch('');
      setMemberResults([]);
      loadPending();
    } catch { /* ignore */ }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Zelle Payments</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 text-sm font-medium">
            <Upload size={16} /> Upload
          </button>
        </div>
      </div>

      {uploadResult && (
        <div className={`px-4 py-3 rounded-md mb-4 text-sm ${uploadResult.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {uploadResult}
          <button onClick={() => setUploadResult(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {showUpload && (
        <div className="bg-background border border-border rounded-lg p-4 mb-6 space-y-3">
          <p className="text-sm font-medium">Upload Zelle payment data</p>
          <div className="flex gap-3">
            <label className={`flex items-center gap-2 px-4 py-2 border border-border rounded-md cursor-pointer hover:bg-muted text-sm ${uploading ? 'opacity-50' : ''}`}>
              <Upload size={14} /> Upload File
              <input type="file" accept=".txt,.eml,.html" onChange={handleFileUpload} className="hidden" disabled={uploading} />
            </label>
            <span className="text-muted-foreground self-center text-sm">or paste text below:</span>
          </div>
          <textarea
            value={uploadText}
            onChange={e => setUploadText(e.target.value)}
            placeholder="Paste Zelle email content here..."
            className="w-full px-3 py-2 border border-border rounded-md text-sm min-h-[100px]"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowUpload(false)} className="px-3 py-1 text-sm border border-border rounded hover:bg-muted">Cancel</button>
            <button onClick={handleTextUpload} disabled={uploading || !uploadText.trim()}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
              {uploading ? 'Processing...' : 'Process'}
            </button>
          </div>
        </div>
      )}

      {/* Pending Payments */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted border-b border-border">
          <h2 className="text-sm font-medium">Unmatched Payments ({pending.length})</h2>
          <p className="text-xs text-muted-foreground">Match these payments to members</p>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No unmatched payments. All caught up!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Sender</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="text-left px-4 py-2 font-medium">Transaction #</th>
                <th className="text-left px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => (
                <tr key={p.id} className="border-b border-border">
                  <td className="px-4 py-2">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-medium">{p.senderName}</td>
                  <td className="px-4 py-2 text-right">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.transactionNumber || '-'}</td>
                  <td className="px-4 py-2">
                    {matchingId === p.id ? (
                      <div className="space-y-1">
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
                          <button key={m.id} onClick={() => matchPayment(p.id, m.id)}
                            className="block w-full text-left px-2 py-1 text-xs hover:bg-muted rounded">
                            {m.firstName} {m.lastName} {m.email ? `(${m.email})` : ''}
                          </button>
                        ))}
                        <button onClick={() => { setMatchingId(null); setMemberSearch(''); setMemberResults([]); }}
                          className="text-xs text-muted-foreground hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setMatchingId(p.id)}
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
