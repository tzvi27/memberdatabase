import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, Plus, Download, FileText, Trash2, GitMerge } from 'lucide-react';
import { api } from '../lib/api';
import { getToken } from '../lib/auth';
import { toast } from '../lib/toast';

interface RecurringDonation {
  id: string;
  amount: string;
  frequency: string;
  status: string;
  startDate: string;
  nextDueDate: string | null;
  description: string | null;
  failures: number;
  numLeft: string | null;
  cardLast4: string | null;
}

interface OneTimeDonation {
  id: string;
  amount: string;
  date: string;
  source: string;
  description: string | null;
  notes: string | null;
}

interface Bill {
  id: string;
  totalAmount: string;
  date: string;
  status: string;
  notes: string | null;
  lineItems: { id: string; itemName: string; amount: string }[];
}

interface ZellePayment {
  id: string;
  amount: string;
  date: string;
  senderName: string;
  transactionNumber: string | null;
  matched: boolean;
}

interface Member {
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
  status: string;
  statusManuallySet: boolean;
  aliyahName: string | null;
  wifeName: string | null;
  seatNumber: number | null;
  recurringDonations: RecurringDonation[];
  oneTimeDonations: OneTimeDonation[];
  bills: Bill[];
  zellePayments: ZellePayment[];
}

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'recurring' | 'donations' | 'bills' | 'zelle'>('recurring');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  const loadMember = useCallback(async () => {
    try {
      const data = await api.get<Member>(`/members/${id}`);
      setMember(data);
    } catch {
      setError('Member not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadMember(); }, [loadMember]);

  function startEdit() {
    if (!member) return;
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email || '',
      phone: member.phone || '',
      street: member.street || '',
      city: member.city || '',
      state: member.state || '',
      zip: member.zip || '',
      country: member.country || '',
      notes: member.notes || '',
      status: member.status,
      aliyahName: member.aliyahName || '',
      wifeName: member.wifeName || '',
      seatNumber: member.seatNumber?.toString() || '',
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/members/${id}`, form);
      await loadMember();
      setEditing(false);
      toast('Member saved successfully');
    } catch (err: any) {
      setError(err.message);
      toast(err.message || 'Failed to save member', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/members/${id}/permanent`);
      navigate('/members');
    } catch (err: any) {
      setError(err.message || 'Failed to delete member');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!member) return <div className="p-6 text-destructive">{error || 'Member not found'}</div>;

  const totalDonations =
    member.oneTimeDonations.reduce((s, d) => s + Number(d.amount), 0) +
    member.zellePayments.filter(z => z.matched).reduce((s, z) => s + Number(z.amount), 0);

  const unpaidBills = member.bills
    .filter(b => b.status !== 'PAID')
    .reduce((s, b) => s + Number(b.totalAmount), 0);

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => navigate('/members')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Back to Members
      </button>

      {/* Header */}
      <div className="bg-background rounded-lg border border-border p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{member.firstName} {member.lastName}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                member.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{member.status}</span>
              {member.statusManuallySet && <span className="text-xs text-muted-foreground">(manual)</span>}
              <button
                onClick={async () => {
                  const newStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                  if (confirm(`Set this member as ${newStatus}? This will override automatic status detection.`)) {
                    try {
                      await api.patch(`/members/${id}/status`, { status: newStatus });
                      loadMember();
                    } catch { /* ignore */ }
                  }
                }}
                className="text-xs text-accent hover:underline"
              >
                Toggle
              </button>
            </div>
          </div>
          {!editing ? (
            <div className="flex gap-3">
              <button onClick={startEdit} className="flex items-center gap-1 text-sm text-accent hover:underline">
                <Edit2 size={14} /> Edit
              </button>
              <button onClick={() => setShowMerge(true)} className="flex items-center gap-1 text-sm text-accent hover:underline">
                <GitMerge size={14} /> Merge
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 text-sm text-destructive hover:underline">
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
          <EditForm form={form} setForm={setForm} />
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <InfoRow label="Email" value={member.email} />
            <InfoRow label="Phone" value={member.phone} />
            <InfoRow label="Address" value={[member.street, member.city, member.state, member.zip, member.country].filter(Boolean).join(', ')} />
            <InfoRow label="Seat #" value={member.seatNumber?.toString()} />
            <InfoRow label="Aliyah Name" value={member.aliyahName} />
            <InfoRow label="Wife's Name" value={member.wifeName} />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-background rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Donations</p>
          <p className="text-xl font-bold text-green-600">${totalDonations.toFixed(2)}</p>
        </div>
        <div className="bg-background rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Outstanding Balance</p>
          <p className="text-xl font-bold text-red-600">${unpaidBills.toFixed(2)}</p>
        </div>
      </div>

      {/* Annual Receipt */}
      <AnnualReceiptSection memberId={member.id} />

      {/* Notes */}
      <div className="bg-background rounded-lg border border-border p-4 mb-4">
        <h3 className="text-sm font-medium mb-2">Notes</h3>
        {editing ? (
          <textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{member.notes || 'No notes.'}</p>
        )}
      </div>

      {/* Transaction Tabs */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {(['recurring', 'donations', 'bills', 'zelle'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'recurring' ? `Recurring (${member.recurringDonations.length})` :
               tab === 'donations' ? `Donations (${member.oneTimeDonations.length})` :
               tab === 'bills' ? `Bills (${member.bills.length})` :
               `Zelle (${member.zellePayments.length})`}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'recurring' && <RecurringTab items={member.recurringDonations} onUpdated={loadMember} />}
          {activeTab === 'donations' && <DonationsTab items={member.oneTimeDonations} memberId={member.id} onAdded={loadMember} />}
          {activeTab === 'bills' && <BillsTab items={member.bills} memberId={member.id} onAdded={loadMember} />}
          {activeTab === 'zelle' && <ZelleTab items={member.zellePayments} />}
        </div>
      </div>
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-2">Delete Member</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to permanently delete <strong>{member.firstName} {member.lastName}</strong>?
              This will also delete all their transactions (donations, bills, recurring donations).
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMerge && (
        <MergeModal
          currentMember={member}
          onClose={() => setShowMerge(false)}
          onMerged={loadMember}
        />
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

function EditForm({ form, setForm }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  function u(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" value={form.firstName} onChange={v => u('firstName', v)} />
        <Field label="Last Name" value={form.lastName} onChange={v => u('lastName', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" value={form.email} onChange={v => u('email', v)} />
        <Field label="Phone" value={form.phone} onChange={v => u('phone', v)} />
      </div>
      <Field label="Street" value={form.street} onChange={v => u('street', v)} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="City" value={form.city} onChange={v => u('city', v)} />
        <Field label="State" value={form.state} onChange={v => u('state', v)} />
        <Field label="ZIP" value={form.zip} onChange={v => u('zip', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Aliyah Name" value={form.aliyahName} onChange={v => u('aliyahName', v)} />
        <Field label="Wife's Name" value={form.wifeName} onChange={v => u('wifeName', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seat #" value={form.seatNumber} onChange={v => u('seatNumber', v)} type="number" />
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Status</label>
          <select value={form.status} onChange={e => u('status', e.target.value)}
            className="w-full px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
    </div>
  );
}

function RecurringTab({ items, onUpdated }: { items: RecurringDonation[]; onUpdated: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  async function saveDescription(id: string) {
    try {
      await api.patch(`/members/recurring-donations/${id}`, { description: editValue });
      setEditingId(null);
      onUpdated();
    } catch { /* ignore */ }
  }

  async function clearFailures(id: string) {
    try {
      await api.patch(`/members/recurring-donations/${id}/clear-failures`, {});
      onUpdated();
      toast('Payment failures cleared');
    } catch {
      toast('Failed to clear failures', 'error');
    }
  }

  async function deleteRecurring(id: string) {
    if (!confirm('Delete this recurring donation? This cannot be undone.')) return;
    try {
      await api.delete(`/members/recurring-donations/${id}`);
      onUpdated();
      toast('Recurring donation deleted');
    } catch {
      toast('Failed to delete recurring donation', 'error');
    }
  }


  if (!items.length) return <p className="text-sm text-muted-foreground">No recurring donations.</p>;
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm table-fixed">
      <thead><tr className="text-left text-muted-foreground">
        <th className="pb-2 w-[28%]">Description</th><th className="pb-2 w-[10%]">Amount</th><th className="pb-2 w-[10%]">Freq</th>
        <th className="pb-2 w-[8%]">Card</th><th className="pb-2 w-[10%]">Status</th><th className="pb-2 w-[12%]">Next Due</th><th className="pb-2 w-[7%]">Duration</th><th className="pb-2 w-[7%]">Fails</th><th className="pb-2 w-[8%]"></th>
      </tr></thead>
      <tbody>
        {items.map(d => (
          <tr key={d.id} className="border-t border-border">
            <td className="py-2 pr-2 truncate" title={d.description || ''}>
              {editingId === d.id ? (
                <div className="flex items-center gap-1">
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveDescription(d.id); if (e.key === 'Escape') setEditingId(null); }}
                    className="px-2 py-1 border border-border rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus
                  />
                  <button onClick={() => saveDescription(d.id)} className="text-green-600 hover:text-green-800"><Save size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                </div>
              ) : (
                <span
                  className="cursor-pointer hover:text-accent truncate block"
                  onClick={() => { setEditingId(d.id); setEditValue(d.description || ''); }}
                  title={d.description || 'Click to edit'}
                >
                  {d.description || '-'}
                </span>
              )}
            </td>
            <td className="py-2 pr-2">${Number(d.amount).toFixed(2)}</td>
            <td className="py-2 pr-2 capitalize">{d.frequency.toLowerCase()}</td>
            <td className="py-2 pr-2 text-muted-foreground">{d.cardLast4 ? `••${d.cardLast4}` : '-'}</td>
            <td className="py-2 pr-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{d.status}</span>
            </td>
            <td className="py-2 pr-2">{d.nextDueDate ? new Date(d.nextDueDate).toLocaleDateString() : '-'}</td>
            <td className="py-2 pr-2 text-center">{d.numLeft ? d.numLeft : '*'}</td>
            <td className="py-2 pr-2">
              {d.failures > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="text-red-600 font-medium">{d.failures}</span>
                  <button
                    onClick={() => clearFailures(d.id)}
                    title="Clear payment failures"
                    className="text-muted-foreground hover:text-foreground"
                  ><X size={12} /></button>
                </span>
              ) : '0'}
            </td>
            <td className="py-2">
              <button
                onClick={() => deleteRecurring(d.id)}
                title="Delete recurring donation"
                className="text-muted-foreground hover:text-destructive"
              ><Trash2 size={14} /></button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function DonationsTab({ items, memberId, onAdded }: { items: OneTimeDonation[]; memberId: string; onAdded: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], source: 'CASH', description: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/members/${memberId}/donations`, form);
      setShowForm(false);
      setForm({ amount: '', date: new Date().toISOString().split('T')[0], source: 'CASH', description: '', notes: '' });
      onAdded();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm text-accent hover:underline">
          <Plus size={14} /> Add Donation
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="border border-border rounded-md p-3 mb-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Amount *</label>
              <input type="number" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-2 py-1 border border-border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date *</label>
              <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-2 py-1 border border-border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Source *</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full px-2 py-1 border border-border rounded text-sm">
                <option value="CASH">Cash</option>
                <option value="CHECK">Check</option>
                <option value="ZELLE">Zelle</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g., Kiddush Sponsorship" className="w-full px-2 py-1 border border-border rounded text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 text-sm border border-border rounded hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>
      )}
      {!items.length && !showForm ? <p className="text-sm text-muted-foreground">No one-time donations yet.</p> : items.length > 0 && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground">
            <th className="pb-2 pr-4">Date</th><th className="pb-2 pr-4">Amount</th><th className="pb-2 pr-4">Source</th><th className="pb-2 pr-4">Description</th><th className="pb-2"></th>
          </tr></thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id} className="border-t border-border">
                <td className="py-2 pr-4 whitespace-nowrap">{new Date(d.date).toLocaleDateString()}</td>
                <td className="py-2 pr-4 whitespace-nowrap">${Number(d.amount).toFixed(2)}</td>
                <td className="py-2 pr-4 capitalize whitespace-nowrap">{d.source.toLowerCase().replace('_', ' ')}</td>
                <td className="py-2 pr-4">{d.description || '-'}</td>
                <td className="py-2"><OpenReceipt url={`/api/members/${memberId}/receipt/${d.id}`} label="Receipt" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BillsTab({ items, memberId, onAdded }: { items: Bill[]; memberId: string; onAdded: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [lineItems, setLineItems] = useState([{ itemName: '', amount: '' }]);
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNotes, setBillNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function addLineItem() { setLineItems(li => [...li, { itemName: '', amount: '' }]); }
  function updateLineItem(idx: number, field: string, value: string) {
    setLineItems(li => li.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }
  function removeLineItem(idx: number) { setLineItems(li => li.filter((_, i) => i !== idx)); }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const validItems = lineItems.filter(li => li.itemName && li.amount);
    if (!validItems.length) return;
    setSaving(true);
    try {
      await api.post(`/members/${memberId}/bills`, {
        lineItems: validItems.map(li => ({ itemName: li.itemName, amount: Number(li.amount) })),
        date: billDate,
        notes: billNotes || null,
      });
      setShowForm(false);
      setLineItems([{ itemName: '', amount: '' }]);
      setBillNotes('');
      onAdded();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function updateBillStatus(billId: string, status: string) {
    try {
      await api.put(`/members/bills/${billId}`, { status });
      onAdded();
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm text-accent hover:underline">
          <Plus size={14} /> Add Bill
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="border border-border rounded-md p-3 mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="w-full px-2 py-1 border border-border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <input type="text" value={billNotes} onChange={e => setBillNotes(e.target.value)}
                className="w-full px-2 py-1 border border-border rounded text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Line Items</label>
            {lineItems.map((li, idx) => (
              <div key={idx} className="flex gap-2 mb-1">
                <input type="text" placeholder="Item name" value={li.itemName} onChange={e => updateLineItem(idx, 'itemName', e.target.value)}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm" required />
                <input type="number" step="0.01" placeholder="Amount" value={li.amount} onChange={e => updateLineItem(idx, 'amount', e.target.value)}
                  className="w-24 px-2 py-1 border border-border rounded text-sm" required />
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLineItem(idx)} className="text-destructive text-sm px-1">X</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addLineItem} className="text-xs text-accent hover:underline mt-1">+ Add item</button>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 text-sm border border-border rounded hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Bill'}
            </button>
          </div>
        </form>
      )}
      {!items.length && !showForm ? <p className="text-sm text-muted-foreground">No bills yet.</p> : (
        <div className="space-y-3">
          {items.map(b => (
            <div key={b.id} className="border border-border rounded-md p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">{new Date(b.date).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">${Number(b.totalAmount).toFixed(2)}</span>
                  <select value={b.status} onChange={e => updateBillStatus(b.id, e.target.value)}
                    className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${
                      b.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      b.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                    <option value="UNPAID">UNPAID</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PAID">PAID</option>
                  </select>
                </div>
              </div>
              {b.lineItems.map(li => (
                <div key={li.id} className="flex justify-between text-sm text-muted-foreground pl-2">
                  <span>{li.itemName}</span><span>${Number(li.amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-border">
                <DownloadPDF url={`/api/members/${memberId}/invoice/${b.id}`} label="Download Invoice" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadPDF({ url, label }: { url: string; label: string }) {
  function handleDownload() {
    const token = getToken();
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${label}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }
  return (
    <button onClick={handleDownload} className="flex items-center gap-1 text-xs text-accent hover:underline">
      <Download size={12} /> {label}
    </button>
  );
}

function OpenReceipt({ url, label }: { url: string; label: string }) {
  function handleOpen() {
    const token = getToken();
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.text())
      .then(html => {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
      });
  }
  return (
    <button onClick={handleOpen} className="flex items-center gap-1 text-xs text-accent hover:underline">
      <FileText size={12} /> {label}
    </button>
  );
}

function AnnualReceiptSection({ memberId }: { memberId: string }) {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear - 1}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear - 1}-12-31`);

  function handleOpen() {
    const token = getToken();
    const url = `/api/members/${memberId}/annual-receipt?start=${startDate}&end=${endDate}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.text())
      .then(html => {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
      });
  }

  return (
    <div className="bg-background rounded-lg border border-border p-4 mb-4">
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><FileText size={14} /> Annual Donation Receipt</h3>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-2 py-1 border border-border rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-2 py-1 border border-border rounded text-sm" />
        </div>
        <button onClick={handleOpen}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
          <FileText size={14} /> Generate Receipt
        </button>
      </div>
    </div>
  );
}

function ZelleTab({ items }: { items: ZellePayment[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No Zelle payments.</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground">
        <th className="pb-2">Date</th><th className="pb-2">Amount</th><th className="pb-2">Sender</th><th className="pb-2">Transaction #</th>
      </tr></thead>
      <tbody>
        {items.map(z => (
          <tr key={z.id} className="border-t border-border">
            <td className="py-2">{new Date(z.date).toLocaleDateString()}</td>
            <td className="py-2">${Number(z.amount).toFixed(2)}</td>
            <td className="py-2">{z.senderName}</td>
            <td className="py-2 text-muted-foreground">{z.transactionNumber || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MergeModal({ currentMember, onClose, onMerged }: {
  currentMember: Member;
  onClose: () => void;
  onMerged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ id: string; firstName: string; lastName: string; email: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<typeof results[0] | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get<{ members: typeof results }>(`/members?search=${encodeURIComponent(search)}&limit=10`);
        setResults(data.members.filter(m => m.id !== currentMember.id));
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, currentMember.id]);

  async function handleMerge() {
    if (!selected) return;
    setMerging(true);
    setError('');
    try {
      await api.post(`/members/${currentMember.id}/merge/${selected.id}`);
      onMerged();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-2">Merge Member</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Search for a duplicate member to merge into <strong>{currentMember.firstName} {currentMember.lastName}</strong>.
          All transactions from the selected member will be transferred here, and the other member will be deleted.
        </p>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
          className="w-full px-3 py-2 border border-border rounded-md text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />
        {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
        {results.length > 0 && !selected && (
          <div className="border border-border rounded-md max-h-48 overflow-y-auto mb-3">
            {results.map(m => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-b-0"
              >
                {m.lastName}, {m.firstName} {m.email ? `(${m.email})` : ''}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="border border-accent rounded-md p-3 mb-3 bg-accent/5">
            <p className="text-sm font-medium">
              Merge &quot;{selected.firstName} {selected.lastName}&quot; into &quot;{currentMember.firstName} {currentMember.lastName}&quot;
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All transactions from {selected.firstName} will be moved here.
              {selected.firstName} {selected.lastName} will be permanently deleted.
            </p>
          </div>
        )}
        {error && <p className="text-destructive text-sm mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!selected || merging}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
          >
            {merging ? 'Merging...' : 'Merge Members'}
          </button>
        </div>
      </div>
    </div>
  );
}

