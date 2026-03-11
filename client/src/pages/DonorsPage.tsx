import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X } from 'lucide-react';
import { api } from '../lib/api';

interface Donor {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  oneTimeDonations: { amount: string }[];
  zellePayments: { amount: string }[];
}

export default function DonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      const data = await api.get<{ donors: Donor[]; total: number }>(`/donors?${params}`);
      setDonors(data.donors);
      setTotal(data.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/donors', form);
      setShowAdd(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  function totalDonations(d: Donor) {
    return d.oneTimeDonations.reduce((s, x) => s + Number(x.amount), 0) +
      d.zellePayments.reduce((s, x) => s + Number(x.amount), 0);
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Donors</h1>
          <p className="text-sm text-muted-foreground">Non-member donors. {total} total.</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 text-sm font-medium">
          <Plus size={16} /> Add Donor
        </button>
      </div>

      {showAdd && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">New Donor</h3>
            <button onClick={() => setShowAdd(false)}><X size={16} className="text-muted-foreground" /></button>
          </div>
          {error && <p className="text-destructive text-sm mb-2">{error}</p>}
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="First Name *" required value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="px-3 py-1.5 border border-border rounded-md text-sm" />
              <input type="text" placeholder="Last Name *" required value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="px-3 py-1.5 border border-border rounded-md text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="email" placeholder="Email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="px-3 py-1.5 border border-border rounded-md text-sm" />
              <input type="text" placeholder="Phone" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="px-3 py-1.5 border border-border rounded-md text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1 text-sm border border-border rounded hover:bg-muted">Cancel</button>
              <button type="submit" disabled={saving} className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search donors..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 border border-border rounded-md text-sm" />
          </div>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : donors.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No donors found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Phone</th>
                <th className="text-right px-4 py-2 font-medium">Total Donated</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {donors.map(d => (
                <tr key={d.id} className="border-b border-border hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/donors/${d.id}`)}>
                  <td className="px-4 py-2 font-medium">{d.lastName}, {d.firstName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{d.email || '-'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{d.phone || '-'}</td>
                  <td className="px-4 py-2 text-right font-medium">${totalDonations(d).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      d.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border text-sm">
            <span className="text-muted-foreground">Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-border rounded hover:bg-muted disabled:opacity-50">Prev</button>
              <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-border rounded hover:bg-muted disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
