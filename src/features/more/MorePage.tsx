import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { signOut } from '../auth/signOut';
import { Icon, type IconName } from '../../ui/Icon';

const ITEMS: { label: string; icon: IconName }[] = [
  { label: 'Customers', icon: 'users' },
  { label: 'Vehicles', icon: 'van' },
  { label: 'Reports and export', icon: 'chart' },
  { label: 'Backup', icon: 'download' },
  { label: 'Settings', icon: 'settings' },
];

export function MorePage() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <div className="page">
      <div className="page-head">
        <h1>More</h1>
        {session?.user.email ? <p className="muted">Signed in as {session.user.email}</p> : null}
      </div>

      <ul className="list card">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <div className="list-row is-disabled" aria-disabled="true">
              <span className="list-icon">
                <Icon name={item.icon} />
              </span>
              <span className="list-main">
                <strong>{item.label}</strong>
              </span>
              <span className="muted small">Soon</span>
            </div>
          </li>
        ))}
      </ul>

      <ul className="list card">
        <li>
          <button
            type="button"
            className="list-row"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await signOut();
            }}
          >
            <span className="list-icon">
              <Icon name="logout" />
            </span>
            <span className="list-main">
              <strong>{busy ? 'Signing out…' : 'Sign out'}</strong>
            </span>
          </button>
        </li>
      </ul>

      <p className="muted small center">EDRAM Admin v{__APP_VERSION__}</p>
    </div>
  );
}
