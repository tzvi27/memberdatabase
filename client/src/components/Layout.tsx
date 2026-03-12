import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Upload, Inbox, CreditCard, Heart, LogOut } from 'lucide-react';
import { clearToken } from '../lib/auth';
import { api } from '../lib/api';
import ToastContainer from './ToastContainer';

export default function Layout() {
  const navigate = useNavigate();
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  useEffect(() => {
    api.get<{ unmatchedCount: number }>('/dashboard')
      .then(d => setUnmatchedCount(d.unmatchedCount))
      .catch(() => {});
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  const mainNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/members', icon: Users, label: 'Members' },
    { to: '/donors', icon: Heart, label: 'Donors' },
    { to: '/import', icon: Upload, label: 'Import' },
    { to: '/zelle', icon: CreditCard, label: 'Zelle' },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-primary text-primary-foreground flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-lg font-bold">KNY</h1>
          <p className="text-xs opacity-70">Member Management</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {mainNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-white/20 font-medium' : 'hover:bg-white/10 opacity-80'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/unmatched"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-white/20 font-medium' : 'hover:bg-white/10 opacity-80'
              }`
            }
          >
            <Inbox size={18} />
            <span className="flex-1">Misc Donations</span>
            {unmatchedCount > 0 && (
              <span className="bg-orange-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-tight">
                {unmatchedCount}
              </span>
            )}
          </NavLink>
        </nav>
        <div className="p-2 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm opacity-80 hover:bg-white/10 w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-muted overflow-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
