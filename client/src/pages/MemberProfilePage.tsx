import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X } from 'lucide-react';
import { api } from '../lib/api';

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
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
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              member.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>{member.status}</span>
          </div>
          {!editing ? (
            <button onClick={startEdit} className="flex items-center gap-1 text-sm text-accent hover:underline">
              <Edit2 size={14} /> Edit
            </button>
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
          {activeTab === 'recurring' && <RecurringTab items={member.recurringDonations} />}
          {activeTab === 'donations' && <DonationsTab items={member.oneTimeDonations} />}
          {activeTab === 'bills' && <BillsTab items={member.bills} />}
          {activeTab === 'zelle' && <ZelleTab items={member.zellePayments} />}
        </div>
      </div>
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

function RecurringTab({ items }: { items: RecurringDonation[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No recurring donations.</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground">
        <th className="pb-2">Description</th><th className="pb-2">Amount</th><th className="pb-2">Frequency</th>
        <th className="pb-2">Status</th><th className="pb-2">Next Due</th><th className="pb-2">Failures</th>
      </tr></thead>
      <tbody>
        {items.map(d => (
          <tr key={d.id} className="border-t border-border">
            <td className="py-2">{d.description || '-'}</td>
            <td className="py-2">${Number(d.amount).toFixed(2)}</td>
            <td className="py-2 capitalize">{d.frequency.toLowerCase()}</td>
            <td className="py-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{d.status}</span>
            </td>
            <td className="py-2">{d.nextDueDate ? new Date(d.nextDueDate).toLocaleDateString() : '-'}</td>
            <td className="py-2">{d.failures > 0 ? <span className="text-red-600 font-medium">{d.failures}</span> : '0'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DonationsTab({ items }: { items: OneTimeDonation[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No one-time donations yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground">
        <th className="pb-2">Date</th><th className="pb-2">Amount</th><th className="pb-2">Source</th><th className="pb-2">Description</th>
      </tr></thead>
      <tbody>
        {items.map(d => (
          <tr key={d.id} className="border-t border-border">
            <td className="py-2">{new Date(d.date).toLocaleDateString()}</td>
            <td className="py-2">${Number(d.amount).toFixed(2)}</td>
            <td className="py-2 capitalize">{d.source.toLowerCase().replace('_', ' ')}</td>
            <td className="py-2">{d.description || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BillsTab({ items }: { items: Bill[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No bills yet.</p>;
  return (
    <div className="space-y-3">
      {items.map(b => (
        <div key={b.id} className="border border-border rounded-md p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">{new Date(b.date).toLocaleDateString()}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">${Number(b.totalAmount).toFixed(2)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                b.status === 'PAID' ? 'bg-green-100 text-green-700' :
                b.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>{b.status}</span>
            </div>
          </div>
          {b.lineItems.map(li => (
            <div key={li.id} className="flex justify-between text-sm text-muted-foreground pl-2">
              <span>{li.itemName}</span><span>${Number(li.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      ))}
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

