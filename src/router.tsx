import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import { AppShell } from './ui/AppShell';
import { RequireAuth } from './features/auth/RequireAuth';
import { SignInPage } from './features/auth/SignInPage';
import { HomePage } from './features/dashboard/HomePage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { InvoiceEditorPage } from './features/invoices/InvoiceEditor';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { MorePage } from './features/more/MorePage';
import { CustomersPage } from './features/customers/CustomersPage';
import { CustomerDetail } from './features/customers/CustomerDetail';
import { VehiclesPage } from './features/vehicles/VehiclesPage';
import { SettingsPage } from './features/settings/SettingsPage';

// The PDF library is large, so the invoice detail screen (which builds PDFs) loads on first use.
const InvoiceDetail = lazy(() => import('./features/invoices/InvoiceDetail'));

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
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/new', element: <InvoiceEditorPage /> },
      { path: 'invoices/:id/edit', element: <InvoiceEditorPage /> },
      {
        path: 'invoices/:id',
        element: (
          <Suspense fallback={<div className="page" aria-busy="true" />}>
            <InvoiceDetail />
          </Suspense>
        ),
      },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetail /> },
      { path: 'vehicles', element: <VehiclesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
