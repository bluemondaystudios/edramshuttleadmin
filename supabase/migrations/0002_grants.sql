-- EDRAM Admin: table and function rights for signed-in users
--
-- Newer Supabase projects no longer open new tables to the API roles automatically,
-- so 0001_init.sql alone gives "permission denied for table/view ...".
-- These grants say WHICH operations a signed-in user may attempt; the Row Level
-- Security policies in 0001 still decide WHOSE rows (team members only).
-- Anonymous visitors (anon) get nothing at all.
-- Safe to run more than once.

grant usage on schema public to authenticated;

-- Start from nothing, whatever the project's defaults were, then grant exactly what's needed
revoke all on all tables in schema public from anon, authenticated;

-- Used by every RLS policy, and called by the app to check membership
grant execute on function public.is_team_member() to authenticated;

grant select                         on public.team_members      to authenticated;
grant select, update                 on public.business_settings to authenticated;
grant select, insert, update, delete on public.customers         to authenticated;
grant select, insert, update, delete on public.vehicles          to authenticated;
grant select, insert, update, delete on public.invoices          to authenticated;  -- delete: drafts only (policy)
grant select, insert, update, delete on public.invoice_lines     to authenticated;  -- changes: drafts only (trigger)
grant select, insert, update, delete on public.payments          to authenticated;  -- issued invoices only (trigger)
grant select, insert, update         on public.expenses          to authenticated;  -- no delete: soft delete only
grant select                         on public.audit_log         to authenticated;  -- written only by triggers
grant select                         on public.invoice_balances  to authenticated;
grant select                         on public.ledger            to authenticated;
-- invoice_counter: deliberately no grant; only issue_invoice() touches it

-- Anonymous visitors can't run the membership check either
revoke execute on function public.is_team_member() from anon;
