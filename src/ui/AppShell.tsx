import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { Sheet } from './Sheet';
import { useOnline } from '../lib/useOnline';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/invoices', label: 'Invoices', icon: 'invoice' },
  { to: '/expenses', label: 'Expenses', icon: 'receipt' },
  { to: '/more', label: 'More', icon: 'more' },
];

const QUICK_ACTIONS: { label: string; hint: string; icon: IconName; to?: string }[] = [
  { label: 'New invoice', hint: 'Bill a customer', icon: 'invoice', to: '/invoices/new' },
  { label: 'Record payment', hint: 'Money received for an invoice', icon: 'cash', to: '/invoices?filter=unpaid&for=payment' },
  { label: 'Log expense', hint: 'Coming in the expenses update', icon: 'receipt' },
];

function TabLink({ to, label, icon, end }: (typeof TABS)[number]) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}>
      <Icon name={icon} />
      <span>{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const online = useOnline();
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const [first, second, third, fourth] = TABS as [typeof TABS[number], typeof TABS[number], typeof TABS[number], typeof TABS[number]];

  const newButton = (className: string) => (
    <button type="button" className={className} onClick={() => setQuickOpen(true)} aria-haspopup="dialog">
      <Icon name="plus" size={28} />
      <span className={className === 'nav-new' ? 'visually-hidden' : ''}>New</span>
    </button>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
      </header>

      {!online ? (
        <div className="offline-banner" role="status">
          <Icon name="wifiOff" size={18} />
          You're offline. Changes can't be saved right now.
        </div>
      ) : null}

      <nav className="rail" aria-label="Main">
        {newButton('rail-new btn btn-primary')}
        {TABS.map((t) => (
          <TabLink key={t.to} {...t} />
        ))}
      </nav>

      <main className="content" id="main">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Main">
        <TabLink {...first} />
        <TabLink {...second} />
        {newButton('nav-new')}
        <TabLink {...third} />
        <TabLink {...fourth} />
      </nav>

      <Sheet open={quickOpen} onClose={() => setQuickOpen(false)} title="New">
        <ul className="action-list">
          {QUICK_ACTIONS.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                className="action-row"
                disabled={!a.to}
                onClick={() => {
                  if (!a.to) return;
                  setQuickOpen(false);
                  navigate(a.to);
                }}
              >
                <span className="action-icon">
                  <Icon name={a.icon} />
                </span>
                <span>
                  <strong>{a.label}</strong>
                  <span className="muted small block">{a.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
