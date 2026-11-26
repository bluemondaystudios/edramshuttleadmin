import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from './Icon';

/** Page title with a back button (goes to `back`, or browser history). */
export function PageHeader({ title, back, sub, children }: { title: ReactNode; back?: string; sub?: ReactNode; children?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="page-head with-back">
      {back !== undefined ? (
        <button
          type="button"
          className="back-btn"
          aria-label="Back"
          onClick={() => (back ? navigate(back) : navigate(-1))}
        >
          <Icon name="chevron" style={{ transform: 'rotate(180deg)' }} />
        </button>
      ) : null}
      <div className="page-title">
        <h1>{title}</h1>
        {sub ? <div className="muted">{sub}</div> : null}
      </div>
      {children ? <div className="page-head-actions">{children}</div> : null}
    </div>
  );
}
