import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

interface OneTimeDonation {
  id: string;
  amount: string;
  date: string;
  source: string;
  description: string | null;
}

interface ZellePayment {
  id: string;
  amount: string;
  date: string;
  senderName: string;
  transactionNumber: string | null;
}

interface Donor {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  notes: string | null;
  wifeName: string | null;
  status: string;
  oneTimeDonations: OneTimeDonation[];
  zellePayments: ZellePayment[];
}

export default function DonorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [donor, setDonor] = useState<Donor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'donations' | 'zelle'>('donations');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadDonor = useCallback(async () => {
    try {
      const data = await api.get<Donor>(`/donors/${id}`);
      setDonor(data);
    } catch {
      setError('Donor not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDonor(); }, [loadDonor]);

  function startEdit() {
    if (!donor) return;
    setForm({
      firstName: donor.firstName,
      lastName: donor.lastName,
      email: donor.email || '',
      phone: donor.phone || '',
      street: donor.street || '',
      city: donor.city || '',
      state: donor.state || '',
      zip: donor.zip || '',
      country: donor.country || '',
      notes: donor.notes || '',
      wifeName: donor.wifeName || '',
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/donors/${id}`, form);
      await loadDonor();
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/donors/${id}`);
      navigate('/donors');
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
      setDeleting(false);
      setShowDelete(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!donor) return <div className="p-6 text-destructive">{error || 'Donor not found'}</div>;

  const totalDonations =
    donor.oneTimeDonations.reduce((s, d) => s + Number(d.amount), 0) +
    donor.zellePayments.reduce((s, z) => s + Number(z.amount), 0);

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => navigate('/donors')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Back to Donors
      </button>

      <div className="bg-background rounded-lg border border-border p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{donor.firstName} {donor.lastName}</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              donor.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>{donor.status}</span>
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Non-member Donor</span>
          </div>
          {!editing ? (
            <div className="flex gap-3">
              <button onClick={startEdit} className="flex items-center gap-1 text-sm text-accent hover:underline">
                <Edit2 size={14} /> Edit
              </button>
              <button onClick={() => setShowDelete(true)} className="flex items-center gap-1 text-sm text-destructive hover:underline">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <X size={14} /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1 rounded-md hover:opacity-90 disabled:opacity-50">
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-destructive text-sm mb-3">{error}</p>}

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InputField label="First Name" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
              <InputField label="Last Name" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
              <InputField label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <InputField label="Street" value={form.street} onChange={v => setForm(f => ({ ...f, street: v }))} />
            <div className="grid grid-cols-3 gap-3">
              <InputField label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
              <InputField label="State" value={form.state} onChange={v => setForm(f => ({ ...f, state: v }))} />
              <InputField label="ZIP" value={form.zip} onChange={v => setForm(f => ({ ...f, zip: v }))} />
            </div>
            <InputField label="Wife's Name" value={form.wifeName} onChange={v => setForm(f => ({ ...f, wifeName: v }))} />
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-md text-sm min-h-[60px]" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <InfoRow label="Email" value={donor.email} />
            <InfoRow label="Phone" value={donor.phone} />
            <InfoRow label="Address" value={[donor.street, donor.city, donor.state, donor.zip, donor.country].filter(Boolean).join(', ')} />
            <InfoRow label="Wife's Name" value={donor.wifeName} />
          </div>
        )}
      </div>

      <div className="bg-background rounded-lg border border-border p-4 mb-4">
        <p className="text-xs text-muted-foreground">Total Donations</p>
        <p className="text-xl font-bold text-green-600">${totalDonations.toFixed(2)}</p>
      </div>

      {donor.notes && !editing && (
        <div className="bg-background rounded-lg border border-border p-4 mb-4">
          <h3 className="text-sm font-medium mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{donor.notes}</p>
        </div>
      )}

      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {(['donations', 'zelle'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab === 'donations' ? `Donations (${donor.oneTimeDonations.length})` : `Zelle (${donor.zellePayments.length})`}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'donations' && (
            donor.oneTimeDonations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one-time donations.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="pb-2">Date</th><th className="pb-2">Amount</th><th className="pb-2">Source</th><th className="pb-2">Description</th>
                </tr></thead>
                <tbody>
                  {donor.oneTimeDonations.map(d => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="py-2">{new Date(d.date).toLocaleDateString()}</td>
                      <td className="py-2">${Number(d.amount).toFixed(2)}</td>
                      <td className="py-2 capitalize">{d.source.toLowerCase().replace('_', ' ')}</td>
                      <td className="py-2 text-muted-foreground">{d.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {activeTab === 'zelle' && (
            donor.zellePayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Zelle payments.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="pb-2">Date</th><th className="pb-2">Amount</th><th className="pb-2">Sender</th><th className="pb-2">Transaction #</th>
                </tr></thead>
                <tbody>
                  {donor.zellePayments.map(z => (
                    <tr key={z.id} className="border-t border-border">
                      <td className="py-2">{new Date(z.date).toLocaleDateString()}</td>
                      <td className="py-2">${Number(z.amount).toFixed(2)}</td>
                      <td className="py-2">{z.senderName}</td>
                      <td className="py-2 text-muted-foreground">{z.transactionNumber || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-2">Deactivate Donor</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to deactivate <strong>{donor.firstName} {donor.lastName}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50">
                {deleting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value || '-'}</span>
    </div>
  );
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
    </div>
  );
}
