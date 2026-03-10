import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, UserCheck, UserX } from 'lucide-react';
import { api } from '../lib/api';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  recurringDonations: { amount: string; frequency: string }[];
}

interface MembersResponse {
  members: Member[];
  total: number;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await api.get<MembersResponse>(`/members${params}`);
      setMembers(data.members);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(loadMembers, 300);
    return () => clearTimeout(timeout);
  }, [loadMembers]);

  function getMonthlyTotal(member: Member): number {
    return member.recurringDonations.reduce((sum, d) => {
      const amount = Number(d.amount);
      return sum + (d.frequency === 'ANNUAL' ? amount / 12 : amount);
    }, 0);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Members ({total})</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 text-sm font-medium"
        >
          <Plus size={16} />
          Add Member
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="bg-background rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  {search ? 'No members found matching your search.' : 'No members yet. Import from Banquest or add manually.'}
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => navigate(`/members/${member.id}`)}
                  className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    {member.lastName}, {member.firstName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{member.email || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      member.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {member.status === 'ACTIVE' ? <UserCheck size={12} /> : <UserX size={12} />}
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${getMonthlyTotal(member).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} onSaved={loadMembers} />}
    </div>
  );
}

function AddMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    street: '', city: '', state: '', zip: '', country: '',
    aliyahName: '', wifeName: '', seatNumber: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/members', form);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Add Member</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name *" value={form.firstName} onChange={(v) => update('firstName', v)} required />
            <Field label="Last Name *" value={form.lastName} onChange={(v) => update('lastName', v)} required />
          </div>
          <Field label="Email" value={form.email} onChange={(v) => update('email', v)} type="email" />
          <Field label="Phone" value={form.phone} onChange={(v) => update('phone', v)} />
          <Field label="Street" value={form.street} onChange={(v) => update('street', v)} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" value={form.city} onChange={(v) => update('city', v)} />
            <Field label="State" value={form.state} onChange={(v) => update('state', v)} />
            <Field label="ZIP" value={form.zip} onChange={(v) => update('zip', v)} />
          </div>
          <Field label="Country" value={form.country} onChange={(v) => update('country', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Aliyah Name" value={form.aliyahName} onChange={(v) => update('aliyahName', v)} />
            <Field label="Wife's Name" value={form.wifeName} onChange={(v) => update('wifeName', v)} />
          </div>
          <Field label="Seat Number" value={form.seatNumber} onChange={(v) => update('seatNumber', v)} type="number" />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}
