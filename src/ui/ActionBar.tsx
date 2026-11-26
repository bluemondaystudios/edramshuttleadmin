import type { ReactNode } from 'react';

/** Primary actions pinned to the bottom of the screen, within thumb reach. */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="action-bar">{children}</div>;
}
