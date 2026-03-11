import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, AlertTriangle, FileText, Inbox, Heart, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';

interface DashboardData {
  activeMembers: number;
  monthlyRecurringRevenue: number;
  membershipRecurring: number;
  otherRecurring: number;
  monthlyOtherDonations: number;
  needsAttention: number;
  unmatchedCount: number;
  outstandingBills: { count: number; total: number };
}

interface StatsData {
  period: { start: string; end: string };
  membershipRecurring: number;
  otherRecurring: number;
  oneTimeDonations: number;
  total: number;
  donationCount: number;
  breakdown: { category: string; amount: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsPeriod, setStatsPeriod] = useState<'this-month' | 'last-month' | 'this-year' | 'custom'>('this-month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<DashboardData>('/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (statsPeriod === 'custom' && (!customStart || !customEnd)) return;
    setStatsLoading(true);
    const params = new URLSearchParams({ period: statsPeriod });
    if (statsPeriod === 'custom') {
      params.set('start', customStart);
      params.set('end', customEnd);
    }
    api.get<StatsData>(`/dashboard/stats?${params}`)
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [statsPeriod, customStart, customEnd]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading dashboard...</div>;
  if (!data) return <div className="p-6 text-destructive">Failed to load dashboard</div>;

  const CATEGORY_LABELS: Record<string, string> = {
    MEMBERSHIP_RECURRING: 'Membership Recurring',
    OTHER_RECURRING: 'Other Recurring',
    ONE_TIME_DONATION: 'One-Time Donations',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Monthly Revenue Tiles */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <DashboardCard
          icon={DollarSign}
          label="Membership Recurring"
          value={`$${data.membershipRecurring.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Monthly"
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <DashboardCard
          icon={TrendingUp}
          label="Other Recurring"
          value={`$${data.otherRecurring.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Monthly"
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <DashboardCard
          icon={Heart}
          label="Other Donations"
          value={`$${data.monthlyOtherDonations.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="This month"
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardCard
          icon={Users}
          label="Active Members"
          value={data.activeMembers.toString()}
          color="text-primary"
          bgColor="bg-blue-50"
          onClick={() => navigate('/members')}
        />
        <DashboardCard
          icon={AlertTriangle}
          label="Needs Attention"
          value={data.needsAttention.toString()}
          subtitle="Failed payments"
          color={data.needsAttention > 0 ? 'text-red-600' : 'text-green-600'}
          bgColor={data.needsAttention > 0 ? 'bg-red-50' : 'bg-green-50'}
          onClick={() => navigate('/members?filter=needs-attention')}
        />
        <DashboardCard
          icon={Inbox}
          label="Unmatched"
          value={data.unmatchedCount.toString()}
          subtitle="Donations to match"
          color={data.unmatchedCount > 0 ? 'text-orange-600' : 'text-green-600'}
          bgColor={data.unmatchedCount > 0 ? 'bg-orange-50' : 'bg-green-50'}
          onClick={() => navigate('/unmatched')}
        />
        <DashboardCard
          icon={FileText}
          label="Unpaid Bills"
          value={`$${data.outstandingBills.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle={`${data.outstandingBills.count} bill${data.outstandingBills.count !== 1 ? 's' : ''}`}
          color={data.outstandingBills.total > 0 ? 'text-orange-600' : 'text-green-600'}
          bgColor={data.outstandingBills.total > 0 ? 'bg-orange-50' : 'bg-green-50'}
        />
      </div>

      {/* Stats Section */}
      <div className="bg-background border border-border rounded-lg p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">Revenue Breakdown</h2>
        <div className="flex gap-2 mb-4">
          {(['this-month', 'last-month', 'this-year', 'custom'] as const).map(p => (
            <button key={p} onClick={() => setStatsPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm ${statsPeriod === p ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>
              {p === 'this-month' ? 'This Month' : p === 'last-month' ? 'Last Month' : p === 'this-year' ? 'This Year' : 'Custom'}
            </button>
          ))}
        </div>

        {statsPeriod === 'custom' && (
          <div className="flex gap-3 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Start</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="px-2 py-1 border border-border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">End</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="px-2 py-1 border border-border rounded text-sm" />
            </div>
          </div>
        )}

        {statsLoading ? (
          <p className="text-sm text-muted-foreground">Loading stats...</p>
        ) : stats ? (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {stats.breakdown.map(b => (
                <div key={b.category} className="border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[b.category] || b.category}</p>
                  <p className="text-xl font-bold mt-1">${b.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">${stats.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <p className="text-sm text-muted-foreground">{stats.donationCount} one-time donation{stats.donationCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/members')}
          className="bg-background border border-border rounded-lg p-6 text-left hover:shadow-md transition-shadow"
        >
          <Users size={24} className="text-primary mb-2" />
          <h3 className="font-medium">View Members</h3>
          <p className="text-sm text-muted-foreground">Browse and manage member profiles</p>
        </button>
        <button
          onClick={() => navigate('/import')}
          className="bg-background border border-border rounded-lg p-6 text-left hover:shadow-md transition-shadow"
        >
          <FileText size={24} className="text-primary mb-2" />
          <h3 className="font-medium">Import Data</h3>
          <p className="text-sm text-muted-foreground">Import from Banquest export file</p>
        </button>
      </div>
    </div>
  );
}

function DashboardCard({ icon: Icon, label, value, subtitle, color, bgColor, onClick }: {
  icon: any; label: string; value: string; subtitle?: string; color: string; bgColor: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-background border border-border rounded-lg p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className={`inline-flex p-2 rounded-lg ${bgColor} mb-3`}>
        <Icon size={20} className={color} />
      </div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color} mt-1`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
