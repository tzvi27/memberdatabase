import { useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, Users, RefreshCw, DollarSign, UserCheck, UserX, FileText } from 'lucide-react';
import { api } from '../lib/api';

type ImportType = 'banquest-members' | 'banquest-transactions' | 'donation-details';

// --- Member Import Types ---
interface Subscription {
  banquestId: string;
  amount: number;
  frequency: string;
  status: string;
  description: string | null;
  failures: number;
}

interface ParsedMember {
  email: string | null;
  firstName: string;
  lastName: string;
  subscriptions: Subscription[];
  existingMemberId?: string;
  isNew: boolean;
  issues: string[];
}

// --- Transaction Import Types ---
interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  cardHolder: string;
  cardLast4: string;
  firstName: string;
  lastName: string;
  email: string | null;
  transactionId: string | null;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  matchType: 'email' | 'name' | 'none';
  isDuplicate: boolean;
}

// --- Donation Details Types ---
interface ParsedDonation {
  source: 'ZELLE' | 'DONORS_FUND';
  date: string;
  donorName: string;
  amount: number;
  memo: string | null;
  externalId: string;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  matchType: 'email' | 'name' | 'none';
  isDuplicate: boolean;
}

interface UploadResponse {
  type: ImportType;
  // Members
  members?: ParsedMember[];
  summary?: any;
  // Transactions
  transactions?: ParsedTransaction[];
  // Donations
  donations?: ParsedDonation[];
}

const TYPE_LABELS: Record<ImportType, string> = {
  'banquest-members': 'Banquest Members & Subscriptions',
  'banquest-transactions': 'Banquest Transaction Report',
  'donation-details': 'Zelle & Donors Fund Donations',
};

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<UploadResponse | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<UploadResponse>('/import/upload', formData);
      setData(response);
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post<any>('/import/confirm');
      setResult(res);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('upload');
    setData(null);
    setResult(null);
    setError('');
    setShowUnmatchedOnly(false);
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-4">Import Data</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}

      {step === 'upload' && <UploadStep loading={loading} onUpload={handleUpload} />}

      {step === 'preview' && data && (
        <>
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            <FileText size={16} />
            Detected: <strong>{TYPE_LABELS[data.type]}</strong>
          </div>

          {data.type === 'banquest-members' && data.members && (
            <MemberPreview
              members={data.members}
              summary={data.summary}
              loading={loading}
              onConfirm={handleConfirm}
              onCancel={reset}
            />
          )}

          {data.type === 'banquest-transactions' && data.transactions && (
            <TransactionPreview
              transactions={data.transactions}
              summary={data.summary}
              loading={loading}
              showUnmatchedOnly={showUnmatchedOnly}
              onToggleUnmatched={setShowUnmatchedOnly}
              onConfirm={handleConfirm}
              onCancel={reset}
            />
          )}

          {data.type === 'donation-details' && data.donations && (
            <DonationPreview
              donations={data.donations}
              summary={data.summary}
              loading={loading}
              showUnmatchedOnly={showUnmatchedOnly}
              onToggleUnmatched={setShowUnmatchedOnly}
              onConfirm={handleConfirm}
              onCancel={reset}
            />
          )}
        </>
      )}

      {step === 'done' && result && (
        <DoneStep type={data?.type || 'banquest-members'} result={result} onReset={reset} />
      )}
    </div>
  );
}

// --- Upload Step ---
function UploadStep({ loading, onUpload }: { loading: boolean; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="bg-background border-2 border-dashed border-border rounded-lg p-12 text-center">
      <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
      <p className="text-lg font-medium mb-2">Upload Import File</p>
      <p className="text-sm text-muted-foreground mb-1">
        The system will automatically detect the file type and process it accordingly.
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        Supported: Banquest export (.txt/.tsv), Transaction report (.csv), Donation details (.xlsx)
      </p>
      <label className={`inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md cursor-pointer hover:opacity-90 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
        {loading ? 'Processing...' : 'Choose File'}
        <input type="file" accept=".txt,.csv,.tsv,.xlsx,.xls" onChange={onUpload} className="hidden" disabled={loading} />
      </label>
    </div>
  );
}

// --- Done Step ---
function DoneStep({ type, result, onReset }: { type: ImportType; result: any; onReset: () => void }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
      <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
      <h2 className="text-xl font-bold text-green-800 mb-2">Import Complete</h2>
      {type === 'banquest-members' ? (
        <p className="text-green-700">
          Created {result.created} new members, updated {result.updated} existing members,
          and imported {result.subscriptions} subscriptions.
        </p>
      ) : (
        <p className="text-green-700">
          Imported {result.imported} matched donations
          {result.unmatched > 0 && ` and ${result.unmatched} unmatched (in Misc Donations)`}
          {result.skippedDuplicates > 0 && `, skipped ${result.skippedDuplicates} duplicates`}
          {result.totalAmount > 0 && ` — $${result.totalAmount.toFixed(2)} total`}.
        </p>
      )}
      <button onClick={onReset} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90">
        Import Another File
      </button>
    </div>
  );
}

// --- Member Preview ---
function MemberPreview({ members, summary, loading, onConfirm, onCancel }: {
  members: ParsedMember[]; summary: any; loading: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Members" value={summary.total} icon={Users} />
        <SummaryCard label="New" value={summary.new} icon={CheckCircle} color="text-green-600" />
        <SummaryCard label="Existing (Update)" value={summary.existing} icon={RefreshCw} color="text-blue-600" />
        <SummaryCard label="With Issues" value={summary.withIssues} icon={AlertTriangle} color="text-yellow-600" />
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {summary.totalSubscriptions} subscriptions found across {summary.total} members.
      </p>

      <div className="bg-background rounded-lg border border-border overflow-hidden mb-6">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Subscriptions</th>
                <th className="text-left px-4 py-2 font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-2 font-medium">{m.lastName}, {m.firstName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.email || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.isNew ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {m.isNew ? 'New' : 'Update'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {m.subscriptions.map((s, j) => (
                      <div key={j} className="text-xs">
                        ${s.amount.toFixed(2)}/{s.frequency === 'ANNUAL' ? 'yr' : 'mo'} — {s.description || 'N/A'}
                        {s.failures > 0 && <span className="text-red-600 ml-1">({s.failures} failures)</span>}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2">
                    {m.issues.length > 0 && (
                      <div className="space-y-1">
                        {m.issues.map((issue, j) => (
                          <div key={j} className="flex items-center gap-1 text-xs text-yellow-600">
                            <AlertTriangle size={12} /> {issue}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
        <button onClick={onConfirm} disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm hover:opacity-90 disabled:opacity-50">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          {loading ? 'Importing...' : `Confirm Import (${members.length} members)`}
        </button>
      </div>
    </div>
  );
}

// --- Transaction Preview ---
function TransactionPreview({ transactions, summary, loading, showUnmatchedOnly, onToggleUnmatched, onConfirm, onCancel }: {
  transactions: ParsedTransaction[]; summary: any; loading: boolean;
  showUnmatchedOnly: boolean; onToggleUnmatched: (v: boolean) => void;
  onConfirm: () => void; onCancel: () => void;
}) {
  const newTx = transactions.filter(t => !t.isDuplicate);
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Transactions" value={summary.total} icon={DollarSign} />
        <SummaryCard label="Matched" value={summary.matched} icon={UserCheck} color="text-green-600" />
        <SummaryCard label="Unmatched" value={summary.unmatched} icon={UserX} color="text-amber-600" subtitle="→ Misc Donations" />
        <SummaryCard label="Duplicates (skip)" value={summary.duplicates} icon={RefreshCw} color="text-gray-400" />
      </div>

      {summary.unmatched > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md mb-4 text-sm">
          <AlertTriangle size={14} className="inline mr-1" />
          {summary.unmatched} unmatched transactions will be saved to Misc Donations for manual matching later.
        </div>
      )}

      {summary.duplicates > 0 && (
        <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-3 rounded-md mb-4 text-sm">
          <RefreshCw size={14} className="inline mr-1" />
          {summary.duplicates} transactions already imported — will be skipped.
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showUnmatchedOnly} onChange={e => onToggleUnmatched(e.target.checked)} className="rounded border-border" />
          Show unmatched only
        </label>
      </div>

      <div className="bg-background rounded-lg border border-border overflow-hidden mb-6">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-left px-3 py-2 font-medium">Matched To</th>
              </tr>
            </thead>
            <tbody>
              {transactions
                .filter(t => !showUnmatchedOnly || !t.matchedMemberId)
                .map((t, i) => (
                <tr key={i} className={`border-b border-border ${t.isDuplicate ? 'opacity-40' : !t.matchedMemberId ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-3 py-2">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {t.firstName} {t.lastName}
                    {t.email && <span className="text-xs text-muted-foreground block">{t.email}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.description || '-'}</td>
                  <td className="px-3 py-2 text-right font-medium">${t.amount.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {t.isDuplicate ? (
                      <span className="text-gray-400 text-xs">Already imported</span>
                    ) : t.matchedMemberId ? (
                      <span className="text-green-700 text-xs">
                        {t.matchedMemberName}
                        <span className="text-muted-foreground ml-1">({t.matchType})</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 text-xs">→ Misc Donations</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
        <button onClick={onConfirm} disabled={loading || newTx.length === 0}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm hover:opacity-90 disabled:opacity-50">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          {loading ? 'Importing...' : `Import ${newTx.length} Transactions`}
        </button>
      </div>
    </div>
  );
}

// --- Donation Details Preview ---
function DonationPreview({ donations, summary, loading, showUnmatchedOnly, onToggleUnmatched, onConfirm, onCancel }: {
  donations: ParsedDonation[]; summary: any; loading: boolean;
  showUnmatchedOnly: boolean; onToggleUnmatched: (v: boolean) => void;
  onConfirm: () => void; onCancel: () => void;
}) {
  const newDonations = donations.filter(d => !d.isDuplicate);
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Donations" value={summary.total} icon={DollarSign}
          subtitle={`${summary.bySource.zelle} Zelle, ${summary.bySource.donorsFund} Donors Fund`} />
        <SummaryCard label="Matched" value={summary.matched} icon={UserCheck} color="text-green-600" />
        <SummaryCard label="Unmatched" value={summary.unmatched} icon={UserX} color="text-amber-600" subtitle="→ Misc Donations" />
        <SummaryCard label="Duplicates (skip)" value={summary.duplicates} icon={RefreshCw} color="text-gray-400" />
      </div>

      {summary.unmatched > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md mb-4 text-sm">
          <AlertTriangle size={14} className="inline mr-1" />
          {summary.unmatched} unmatched donations will be saved to Misc Donations for manual matching later.
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showUnmatchedOnly} onChange={e => onToggleUnmatched(e.target.checked)} className="rounded border-border" />
          Show unmatched only
        </label>
      </div>

      <div className="bg-background rounded-lg border border-border overflow-hidden mb-6">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-left px-3 py-2 font-medium">Donor</th>
                <th className="text-left px-3 py-2 font-medium">Memo</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-left px-3 py-2 font-medium">Matched To</th>
              </tr>
            </thead>
            <tbody>
              {donations
                .filter(d => !showUnmatchedOnly || !d.matchedMemberId)
                .map((d, i) => (
                <tr key={i} className={`border-b border-border ${d.isDuplicate ? 'opacity-40' : !d.matchedMemberId ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-3 py-2">{new Date(d.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      d.source === 'ZELLE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {d.source === 'ZELLE' ? 'Zelle' : 'Donors Fund'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{d.donorName}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{d.memo || '-'}</td>
                  <td className="px-3 py-2 text-right font-medium">${d.amount.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {d.isDuplicate ? (
                      <span className="text-gray-400 text-xs">Already imported</span>
                    ) : d.matchedMemberId ? (
                      <span className="text-green-700 text-xs">
                        {d.matchedMemberName}
                        <span className="text-muted-foreground ml-1">({d.matchType})</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 text-xs">→ Misc Donations</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
        <button onClick={onConfirm} disabled={loading || newDonations.length === 0}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm hover:opacity-90 disabled:opacity-50">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          {loading ? 'Importing...' : `Import ${newDonations.length} Donations`}
        </button>
      </div>
    </div>
  );
}

// --- Shared ---
function SummaryCard({ label, value, icon: Icon, color = 'text-foreground', subtitle }: {
  label: string; value: number | string; icon: any; color?: string; subtitle?: string;
}) {
  return (
    <div className="bg-background rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
