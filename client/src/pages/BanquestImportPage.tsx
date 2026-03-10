import { useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, Users, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

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

interface PreviewResponse {
  members: ParsedMember[];
  summary: {
    total: number;
    new: number;
    existing: number;
    withIssues: number;
    totalSubscriptions: number;
  };
}

interface ImportResult {
  created: number;
  updated: number;
  subscriptions: number;
}

export default function BanquestImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post<PreviewResponse>('/banquest/import', formData);
      setPreview(data);
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
      const data = await api.post<ImportResult>('/banquest/confirm');
      setResult(data);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('upload');
    setPreview(null);
    setResult(null);
    setError('');
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Banquest Import</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="bg-background border-2 border-dashed border-border rounded-lg p-12 text-center">
          <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Upload Banquest Export File</p>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your .txt export file from Banquest. The system will parse the data and show you a preview before importing.
          </p>
          <label className={`inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md cursor-pointer hover:opacity-90 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
            {loading ? 'Parsing...' : 'Choose File'}
            <input type="file" accept=".txt,.csv,.tsv" onChange={handleUpload} className="hidden" disabled={loading} />
          </label>
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total Members" value={preview.summary.total} icon={Users} />
            <SummaryCard label="New" value={preview.summary.new} icon={CheckCircle} color="text-green-600" />
            <SummaryCard label="Existing (Update)" value={preview.summary.existing} icon={RefreshCw} color="text-blue-600" />
            <SummaryCard label="With Issues" value={preview.summary.withIssues} icon={AlertTriangle} color="text-yellow-600" />
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {preview.summary.totalSubscriptions} subscriptions found across {preview.summary.total} members.
          </p>

          {/* Members Table */}
          <div className="bg-background rounded-lg border border-border overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Subscriptions</th>
                  <th className="text-left px-4 py-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.members.map((m, i) => (
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

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {loading ? 'Importing...' : `Confirm Import (${preview.summary.total} members)`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
          <h2 className="text-xl font-bold text-green-800 mb-2">Import Complete</h2>
          <p className="text-green-700">
            Created {result.created} new members, updated {result.updated} existing members,
            and imported {result.subscriptions} subscriptions.
          </p>
          <button onClick={reset} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90">
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color = 'text-foreground' }: {
  label: string; value: number; icon: any; color?: string;
}) {
  return (
    <div className="bg-background rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
