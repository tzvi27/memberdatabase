import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, AlertTriangle, FileText } from 'lucide-react';
import { api } from '../lib/api';

interface DashboardData {
  activeMembers: number;
  monthlyRecurringRevenue: number;
  needsAttention: number;
  outstandingBills: { count: number; total: number };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<DashboardData>('/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Loading dashboard...</div>;
  if (!data) return <div className="p-6 text-destructive">Failed to load dashboard</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

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
          icon={DollarSign}
          label="Monthly Recurring"
          value={`$${data.monthlyRecurringRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          color="text-green-600"
          bgColor="bg-green-50"
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
          icon={FileText}
          label="Unpaid Bills"
          value={`$${data.outstandingBills.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle={`${data.outstandingBills.count} bill${data.outstandingBills.count !== 1 ? 's' : ''}`}
          color={data.outstandingBills.total > 0 ? 'text-orange-600' : 'text-green-600'}
          bgColor={data.outstandingBills.total > 0 ? 'bg-orange-50' : 'bg-green-50'}
        />
      </div>

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
