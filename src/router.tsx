import { createHashRouter, Navigate } from 'react-router';
import { AppShell } from './ui/AppShell';
import { RequireAuth } from './features/auth/RequireAuth';
import { SignInPage } from './features/auth/SignInPage';
import { HomePage } from './features/dashboard/HomePage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { MorePage } from './features/more/MorePage';

// Hash routes (#/invoices) because GitHub Pages can't rewrite deep links to index.html.
export const router = createHashRouter([
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'invoices/*', element: <InvoicesPage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
