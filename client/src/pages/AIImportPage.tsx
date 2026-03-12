import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Sparkles, Edit2, X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface PreviewDonation {
  firstName: string;
  lastName: string;
  amount: number;
  date: string;
  description: string | null;
  source: string;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  matchType: 'name' | 'none';
}

interface Preview {
  donations: PreviewDonation[];
  summary: { total: number; matched: number; unmatched: number; totalAmount: number };
}

const SOURCE_LABELS: Record<string, string> = {
  CREDIT_CARD: 'Credit Card',
  ZELLE: 'Zelle',
  CASH: 'Cash',
  CHECK: 'Check',
  OJC: 'OJC',
  DONORS_FUND: 'Donors Fund',
  OTHER: 'Other',
};

export default function AIImportPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ imported: number; unmatched: number; total: number } | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setPreview(null);
    setDone(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api.post<Preview>('/ai-import/upload', form);
      setPreview(result);
    } catch (err: any) {
      toast(err.message || 'Failed to process file', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);
    try {
      const result = await api.post<{ imported: number; unmatched: number; total: number }>(
        '/ai-import/confirm',
        { donations: preview.donations },
      );
      setDone(result);
      setPreview(null);
      toast(`Imported ${result.imported} matched, ${result.unmatched} to misc`);
    } catch (err: any) {
      toast(err.message || 'Import failed', 'error');
    } finally {
      setConfirming(false);
    }
  }

  async function searchMembers(q: string) {
    setMemberSearch(q);
    if (q.length < 2) { setMemberResults([]); return; }
    try {
      const data = await api.get<{ members: typeof memberResults }>(`/members?search=${encodeURIComponent(q)}&limit=8`);
      setMemberResults(data.members);
    } catch { /* ignore */ }
  }

  function assignMember(idx: number, member: { id: string; firstName: string; lastName: string } | null) {
    if (!preview) return;
    const updated = preview.donations.map((d, i) =>
      i === idx
        ? { ...d, matchedMemberId: member?.id || null, matchedMemberName: member ? `${member.firstName} ${member.lastName}` : null, matchType: member ? 'name' as const : 'none' as const }
        : d
    );
    setPreview({ ...preview, donations: updated, summary: recalcSummary(updated) });
    setEditingIdx(null);
    setMemberSearch('');
    setMemberResults([]);
  }

  function recalcSummary(donations: PreviewDonation[]) {
    return {
      total: donations.length,
      matched: donations.filter(d => d.matchedMemberId).length,
      unmatched: donations.filter(d => !d.matchedMemberId).length,
      totalAmount: donations.reduce((s, d) => s + d.amount, 0),
    };
  }

  function removeDonation(idx: number) {
    if (!preview) return;
    const updated = preview.donations.filter((_, i) => i !== idx);
    setPreview({ ...preview, donations: updated, summary: recalcSummary(updated) });
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <Sparkles size={22} className="text-accent" /> AI Donation Import
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload any file — PDF, Excel, CSV, image, or text. AI will extract donation records and match them to members.
      </p>

      {/* Upload area */}
      {!preview && !done && (
        <div
          className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-accent transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {uploading ? (
            <div>
              <Sparkles size={40} className="mx-auto text-accent mb-3 animate-pulse" />
              <p className="text-muted-foreground font-medium">AI is reading your file...</p>
            </div>
          ) : (
            <div>
              <Upload size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-1">Drop a file here or click to browse</p>
              <p className="text-sm text-muted-foreground">Supports PDF, Excel, CSV, images, and text files</p>
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {done && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle size={40} className="mx-auto text-green-600 mb-3" />
          <p className="text-lg font-bold text-green-700">{done.total} donations imported</p>
          <p className="text-sm text-muted-foreground mt-1">
            {done.imported} matched to members · {done.unmatched} sent to Misc Donations
          </p>
          <button
            onClick={() => setDone(null)}
            className="mt-4 px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div>
          {/* Summary bar */}
          <div className="flex items-center gap-6 bg-background border border-border rounded-lg p-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{preview.summary.total}</p>
              <p className="text-xs text-muted-foreground">Extracted</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{preview.summary.matched}</p>
              <p className="text-xs text-muted-foreground">Matched</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">{preview.summary.unmatched}</p>
              <p className="text-xs text-muted-foreground">To Misc</p>
            </div>
            <div className="text-center ml-auto">
              <p className="text-2xl font-bold text-green-600">
                ${preview.summary.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Total Amount</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || preview.donations.length === 0}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
              >
                {confirming ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>

          {/* Donation rows */}
          <div className="bg-background border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border bg-muted/40">
                  <th className="px-4 py-2">Donor</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Matched Member</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {preview.donations.map((d, idx) => (
                  <tr key={idx} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{d.firstName} {d.lastName}</td>
                    <td className="px-4 py-2">${d.amount.toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {SOURCE_LABELS[d.source] || d.source}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[160px] truncate" title={d.description || ''}>
                      {d.description || '-'}
                    </td>
                    <td className="px-4 py-2">
                      {editingIdx === idx ? (
                        <div className="relative">
                          <input
                            autoFocus
                            value={memberSearch}
                            onChange={e => searchMembers(e.target.value)}
                            placeholder="Search member..."
                            className="px-2 py-1 border border-border rounded text-sm w-44 focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          {memberResults.length > 0 && (
                            <div className="absolute z-10 top-full left-0 bg-background border border-border rounded shadow-lg w-56 max-h-40 overflow-y-auto">
                              <button
                                onClick={() => assignMember(idx, null)}
                                className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted border-b border-border"
                              >
                                — Unmatched (Misc)
                              </button>
                              {memberResults.map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => assignMember(idx, m)}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                                >
                                  {m.lastName}, {m.firstName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingIdx(idx); setMemberSearch(''); setMemberResults([]); }}
                          className="flex items-center gap-1 text-sm"
                        >
                          {d.matchedMemberId ? (
                            <span className="text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle size={13} /> {d.matchedMemberName}
                            </span>
                          ) : (
                            <span className="text-orange-500 flex items-center gap-1">
                              <AlertCircle size={13} /> Misc
                            </span>
                          )}
                          <Edit2 size={11} className="text-muted-foreground ml-1" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => removeDonation(idx)} className="text-muted-foreground hover:text-destructive">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.donations.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">All rows removed.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
