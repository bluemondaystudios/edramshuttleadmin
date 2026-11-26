\set ON_ERROR_STOP 1
\set QUIET 1
create function pg_temp.expect_error(q text, pat text) returns void language plpgsql as $f$
begin
  execute q;
  raise exception 'EXPECTED ERROR NOT RAISED: %', q;
exception when others then
  if sqlerrm like 'EXPECTED ERROR NOT RAISED%' then raise; end if;
  if sqlerrm !~* pat then raise exception 'Wrong error for [%]: %', q, sqlerrm; end if;
  raise notice 'ok, refused: %', left(sqlerrm, 90);
end $f$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- Users: A and B are the team, X is a signed-in stranger
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'dev@example.com'),
  ('00000000-0000-0000-0000-0000000000ff', 'stranger@example.com');
insert into public.team_members values
  ('00000000-0000-0000-0000-00000000000a', 'Owner'),
  ('00000000-0000-0000-0000-00000000000b', 'Developer');

-- ===== As team member A =====
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into customers (id, name, phone) values ('c0000000-0000-0000-0000-000000000001', 'Mokoena Family', '082 000 0000');
insert into vehicles  (id, label, seats) values ('d0000000-0000-0000-0000-000000000001', '15 Seater #1', 15);
insert into invoices  (id, customer_id) values ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');
insert into invoices  (id, customer_id) values ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001');
insert into invoice_lines (invoice_id, position, description, vehicle_id, quantity, unit_price_cents) values
  ('10000000-0000-0000-0000-000000000001', 1, 'Airport transfer: O.R. Tambo to Gezina', 'd0000000-0000-0000-0000-000000000001', 2, 85000),
  ('10000000-0000-0000-0000-000000000001', 2, 'Waiting time', null, 1.5, 35000);
do $$ begin
  assert (select total_cents from invoices where id = '10000000-0000-0000-0000-000000000001') = 222500, 'draft total should be 2x850 + 1.5x350 = R2,225.00';
  raise notice 'ok, draft total recalculated: R2,225.00';
end $$;

-- Issuing an empty draft fails and does not use up a number
select pg_temp.expect_error($q$ select issue_invoice('10000000-0000-0000-0000-000000000002') $q$, 'at least one line');

-- Tampering: drafts cannot be issued or created as issued directly
select pg_temp.expect_error($q$ update invoices set status = 'issued', seq = 99, number = 'EDR-0099', issue_date = current_date where id = '10000000-0000-0000-0000-000000000001' $q$, 'issue_invoice');
select pg_temp.expect_error($q$ insert into invoices (customer_id, status, seq, number, issue_date) values ('c0000000-0000-0000-0000-000000000001', 'issued', 50, 'EDR-0050', current_date) $q$, 'drafts');

-- Issue invoice 1
select number, issue_date = current_date as today, due_date - issue_date as terms_days, seller_snapshot->>'address' as seller_address
from issue_invoice('10000000-0000-0000-0000-000000000001');

-- Issued invoices are frozen
select pg_temp.expect_error($q$ update invoices set notes = 'changed' where id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
select pg_temp.expect_error($q$ update invoice_lines set unit_price_cents = 1 where invoice_id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
select pg_temp.expect_error($q$ insert into invoice_lines (invoice_id, description, unit_price_cents) values ('10000000-0000-0000-0000-000000000001', 'sneaky', 100) $q$, 'cannot be changed');
select pg_temp.expect_error($q$ update invoices set status = 'void' where id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
do $$ declare n int; begin
  delete from invoices where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'issued invoice must not be deletable';
  raise notice 'ok, issued invoice not deletable (0 rows)';
end $$;

-- Payments
select pg_temp.expect_error($q$ insert into payments (invoice_id, amount_cents) values ('10000000-0000-0000-0000-000000000002', 1000) $q$, 'issued invoices');
insert into payments (id, invoice_id, amount_cents, method, reference) values ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 100000, 'eft', 'EDR-0001');
select number, total_cents, paid_cents, balance_cents, is_overdue from invoice_balances where id = '10000000-0000-0000-0000-000000000001';

-- Voiding
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000001', 'Wrong customer') $q$, 'payments recorded');
select pg_temp.expect_error($q$ update invoices set status = 'void', void_reason = 'bypass', voided_at = now() where id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
delete from payments where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000001', '  ') $q$, 'reason is required');
select number, status, void_reason from void_invoice('10000000-0000-0000-0000-000000000001', 'Wrong customer');
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000001', 'again') $q$, 'Only issued');
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000002', 'draft') $q$, 'Only issued');

-- Next invoice gets the next number: no gap from the failed attempt
insert into invoice_lines (invoice_id, description, quantity, unit_price_cents) values ('10000000-0000-0000-0000-000000000002', 'Funeral shuttle: 15 Seater, full day', 1, 500000);
select number as second_number from issue_invoice('10000000-0000-0000-0000-000000000002');
insert into payments (invoice_id, amount_cents, method) values ('10000000-0000-0000-0000-000000000002', 500000, 'cash');

-- Drafts can be deleted, lines go with them
insert into invoices (id, customer_id) values ('10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001');
insert into invoice_lines (invoice_id, description, unit_price_cents) values ('10000000-0000-0000-0000-000000000003', 'temp', 100);
delete from invoices where id = '10000000-0000-0000-0000-000000000003';
do $$ begin
  assert not exists (select 1 from invoices where id = '10000000-0000-0000-0000-000000000003'), 'draft should be deleted';
  assert not exists (select 1 from invoice_lines where invoice_id = '10000000-0000-0000-0000-000000000003'), 'lines should cascade';
  raise notice 'ok, draft and its lines deleted';
end $$;

-- Expenses: soft delete only
insert into expenses (id, amount_cents, category, vehicle_id, supplier, receipt_path) values
  ('f0000000-0000-0000-0000-000000000001', 120050, 'fuel', 'd0000000-0000-0000-0000-000000000001', 'Engen Gezina', '2026/11/f0000000-0000-0000-0000-000000000001.jpg'),
  ('f0000000-0000-0000-0000-000000000002', 9900, 'tolls', null, 'SANRAL', null);
select pg_temp.expect_error($q$ delete from expenses where id = 'f0000000-0000-0000-0000-000000000002' $q$, 'permission denied');
do $$ begin
  update expenses set deleted_at = now() where id = 'f0000000-0000-0000-0000-000000000002';
  assert (select deleted_at from expenses where id = 'f0000000-0000-0000-0000-000000000002') is not null, 'soft delete should work';
  raise notice 'ok, expense hard delete refused, soft delete works';
end $$;
select entry_date = current_date as today, kind, amount_cents, reference, party, category from ledger order by kind;

-- Receipts bucket
insert into storage.objects (bucket_id, name) values ('receipts', '2026/11/f0000000-0000-0000-0000-000000000001.jpg');
do $$ declare n int; begin
  delete from storage.objects where bucket_id = 'receipts';
  get diagnostics n = row_count;
  assert n = 0, 'receipts must not be deletable';
  raise notice 'ok, receipt upload works, delete refused (0 rows)';
end $$;

select pg_temp.expect_error($q$ select * from invoice_counter $q$, 'permission denied');
select pg_temp.expect_error($q$ update invoice_counter set last_seq = 0 $q$, 'permission denied');
select pg_temp.expect_error($q$ delete from audit_log $q$, 'permission denied');
do $$ begin
  assert (select count(*) from audit_log) > 10, 'audit log should have entries';
  raise notice 'ok, audit log has % entries', (select count(*) from audit_log);
end $$;

-- ===== As team member B: sees the same data =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from invoices) = 2, 'team member B should see both invoices';
  raise notice 'ok, second team member sees the same records';
end $$;

-- ===== As a signed-in stranger =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', false);
do $$ begin
  assert (select count(*) from invoices) = 0 and (select count(*) from customers) = 0
     and (select count(*) from expenses) = 0 and (select count(*) from storage.objects) = 0
     and (select count(*) from audit_log) = 0 and (select count(*) from business_settings) = 0,
     'stranger must see nothing';
  raise notice 'ok, stranger sees no rows anywhere';
end $$;
select pg_temp.expect_error($q$ insert into customers (name) values ('x') $q$, 'row-level security');
select pg_temp.expect_error($q$ select issue_invoice('10000000-0000-0000-0000-000000000002') $q$, 'Not allowed');
select pg_temp.expect_error($q$ insert into storage.objects (bucket_id, name) values ('receipts', 'x.jpg') $q$, 'row-level security');

-- ===== Not signed in (anon) =====
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error($q$ select count(*) from invoices $q$, 'permission denied');
select pg_temp.expect_error($q$ select count(*) from customers $q$, 'permission denied');
select pg_temp.expect_error($q$ insert into customers (name) values ('x') $q$, 'permission denied');
select pg_temp.expect_error($q$ select issue_invoice('10000000-0000-0000-0000-000000000002') $q$, 'permission denied');
reset role;
\echo ALL TESTS PASSED
