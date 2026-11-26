// Phase 3 click-through: tax-year report, the export pack and the full backup,
// against the fake Supabase seeded with a realistic year. Same setup as flow.cjs:
//   node e2e/records.cjs <output-dir>
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const { createFakeSupabase } = require('./fakeSupabase.cjs');

const out = process.argv[2] || 'screenshots';
const base = process.env.BASE_URL || 'http://localhost:4173';
fs.mkdirSync(out, { recursive: true });
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function expect(cond, msg) {
  if (!cond) throw new Error('CHECK FAILED: ' + msg);
  console.log('  ok  ' + msg);
}

/** Reads a ZIP with Python's zipfile (independent of the app's ZIP code). */
function readZip(file) {
  const py = `
import json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
bad = z.testzip()
out = {"bad": bad, "files": {}}
for i in z.infolist():
    data = z.read(i.filename)
    if i.filename.endswith((".csv", ".txt", ".json")):
        out["files"][i.filename] = data.decode("utf-8")
    else:
        out["files"][i.filename] = {"size": len(data), "head": data[:5].hex()}
print(json.dumps(out))`;
  return JSON.parse(execSync(`python3 -I -c '${py}' ${file}`, { maxBuffer: 64 * 1024 * 1024 }).toString());
}

let failPage = null;
(async () => {
  const fake = createFakeSupabase({ today });
  const call = (method, p, body, headers = {}) => {
    const res = fake.handle({ method, url: 'https://demo.supabase.co' + p, headers: { prefer: 'return=representation', accept: 'application/vnd.pgrst.object+json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status >= 400) throw new Error(`seed failed ${p}: ${res.body}`);
    return res.body ? JSON.parse(res.body) : null;
  };

  // ---- Seed: one tax year (2026/27) plus some of the year before ----
  const cust = call('POST', '/rest/v1/customers?select=*', { name: 'Mokoena Family', phone: '082 000 0000' });
  const school = call('POST', '/rest/v1/customers?select=*', { name: 'Pretoria Girls High', contact_person: 'Mrs Dlamini' });
  const van = call('POST', '/rest/v1/vehicles?select=*', { label: '15 Seater Shuttle', registration_plate: 'AB 12 CD GP', seats: 15 });
  call('PATCH', '/rest/v1/business_settings?id=eq.1&select=*', { bank_name: 'Example Bank', account_name: 'EDRAM', account_no: '1234567890', branch_code: '250655', account_type: 'Cheque' });
  const invoice = (customer, issueDate, lines) => {
    const inv = call('POST', '/rest/v1/invoices?select=*', { customer_id: customer.id });
    lines.forEach((l, i) => call('POST', '/rest/v1/invoice_lines?select=*', { invoice_id: inv.id, position: i + 1, ...l }));
    return call('POST', '/rest/v1/rpc/issue_invoice', { p_invoice_id: inv.id, p_issue_date: issueDate });
  };
  const i1 = invoice(cust, '2026-01-15', [{ description: 'Airport transfer – O.R. Tambo', quantity: 1, unit_price_cents: 85000, vehicle_id: van.id }]); // last year
  const i2 = invoice(school, '2026-06-01', [{ description: 'School transport (monthly)', quantity: 1, unit_price_cents: 450000 }]);
  const i3 = invoice(cust, '2026-11-20', [{ description: 'Funeral shuttle', quantity: 1, unit_price_cents: 500000, vehicle_id: van.id }]);
  const i4 = invoice(cust, '2026-08-08', [{ description: 'Local trip', quantity: 2, unit_price_cents: 30000 }]);
  call('POST', '/rest/v1/rpc/void_invoice', { p_invoice_id: i4.id, p_reason: 'Duplicate booking' });
  call('POST', '/rest/v1/payments?select=*', { invoice_id: i1.id, paid_on: '2026-03-05', amount_cents: 85000, method: 'eft' }); // received this year
  call('POST', '/rest/v1/payments?select=*', { invoice_id: i2.id, paid_on: '2026-06-10', amount_cents: 450000, method: 'eft', reference: 'EDR-0002' });
  call('POST', '/rest/v1/payments?select=*', { invoice_id: i3.id, paid_on: '2026-11-25', amount_cents: 200000, method: 'cash' });
  const jpg = execSync('convert -size 600x800 xc:white -fill black -draw "text 50,100 \'SLIP\'" jpg:-');
  const expense = (e, withReceipt) => {
    const row = call('POST', '/rest/v1/expenses?select=*', e);
    if (withReceipt) {
      const p = `${e.spent_on.slice(0, 4)}/${e.spent_on.slice(5, 7)}/${row.id}.jpg`;
      call('PATCH', `/rest/v1/expenses?id=eq.${row.id}&select=*`, { receipt_path: p });
      if (withReceipt !== 'missing') fake.storage.set(`receipts/${p}`, { bytes: jpg, contentType: 'image/jpeg' });
    }
    return row;
  };
  expense({ spent_on: '2026-03-02', amount_cents: 120050, category: 'fuel', vehicle_id: van.id, supplier: 'Engen, Gezina', payment_method: 'card' }, true);
  expense({ spent_on: '2026-07-15', amount_cents: 9900, category: 'tolls', supplier: 'SANRAL', payment_method: 'cash' }, false);
  expense({ spent_on: '2026-11-01', amount_cents: 350000, category: 'tyres', vehicle_id: van.id, supplier: 'Tiger Wheel & Tyre', payment_method: 'card' }, true);
  expense({ spent_on: '2026-10-10', amount_cents: 5000, category: 'parking', supplier: 'Menlyn', payment_method: 'cash' }, 'missing');
  const deleted = expense({ spent_on: '2026-09-09', amount_cents: 77700, category: 'other', supplier: 'Typo', payment_method: 'cash' }, false);
  call('PATCH', `/rest/v1/expenses?id=eq.${deleted.id}&select=*`, { deleted_at: new Date().toISOString() });
  expense({ spent_on: '2026-02-20', amount_cents: 1, category: 'other', supplier: 'Last year', payment_method: 'cash' }, false);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/demo.supabase.co/**', async (route) => {
    const req = route.request();
    const res = fake.handle({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postData(), bodyBuffer: req.postDataBuffer() });
    await route.fulfill({ status: res.status, contentType: res.contentType ?? 'application/json', body: res.body });
  });
  const page = await ctx.newPage();
  failPage = page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const shot = async (name) => {
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${pad(++n)}-${name}.png`) });
  };

  console.log('Sign in: Home asks for a first backup');
  await page.goto(base + '/#/sign-in');
  await page.fill('#email', 'owner@example.com');
  await page.fill('#password', 'secret-password');
  await page.click('button[type=submit]');
  await page.waitForSelector("text=You haven't made a backup yet.");
  expect(true, 'backup reminder shown');
  await shot('home-backup-due');

  console.log('Reports for 2026/27');
  await page.click('.bottomnav >> text=More');
  await page.click('text=Reports and export');
  await page.waitForSelector('.tile:has-text("Money received") >> text=R 7 350,00');
  const text = (await page.locator('main').innerText()).replace(/[\u00a0\u202f]/g, ' ');
  // received: 850 (last year's invoice, paid in March) + 4 500 + 2 000 = 7 350
  expect(text.includes('R 7 350,00'), 'money received R 7 350,00 (counted when received)');
  // expenses: 1 200,50 + 99 + 3 500 + 50 (deleted and last year's excluded) = 4 849,50
  expect(text.includes('R 4 849,50'), 'expenses R 4 849,50 (deleted and last year excluded)');
  expect(text.includes('R 2 500,50'), 'received minus expenses R 2 500,50');
  // invoiced: 4 500 + 5 000 (void and last year excluded) = 9 500
  expect(text.includes('R 9 500,00') && text.includes('2 invoices, 1 void'), 'invoiced R 9 500,00, 2 invoices, 1 void');
  expect(text.includes('R 3 000,00'), 'still owed at year end R 3 000,00');
  expect(text.includes('Tyres') && text.includes('Not linked to a vehicle'), 'by category and by vehicle');
  await shot('reports');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('reports-export');

  console.log('Export pack');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('text=Export 2026/27 pack')]);
  expect(dl.suggestedFilename() === 'EDRAM-records-2026-27.zip', 'named EDRAM-records-2026-27.zip');
  const packFile = path.join(out, dl.suggestedFilename());
  await dl.saveAs(packFile);
  await page.waitForSelector('text=to your downloads');
  await shot('export-done');
  const pack = readZip(packFile);
  expect(pack.bad === null, 'ZIP is valid (Python zipfile check)');
  const r = 'EDRAM-records-2026-27/';
  const names = Object.keys(pack.files).sort();
  console.log('   ' + names.join('\n   '));
  expect(['README.txt', 'summary.csv', 'invoices.csv', 'payments.csv', 'expenses.csv'].every((f) => names.includes(r + f)), 'README and the four CSVs');
  expect(names.includes(r + 'invoices/EDR-0002.pdf') && names.includes(r + 'invoices/EDR-0003.pdf') && names.includes(r + 'invoices/EDR-0004.pdf') && !names.includes(r + 'invoices/EDR-0001.pdf'), "PDFs for this year's invoices, the void one included");
  expect(pack.files[r + 'invoices/EDR-0003.pdf'].head === '255044462d', 'the PDFs are PDFs');
  expect(names.filter((f) => f.includes('/receipts/')).length === 2, 'both stored receipts included');
  expect(names.some((f) => /receipts\/2026-11-01_tyres_3500\.00_.*\.jpg$/.test(f)), 'receipt named date_category_amount_id.jpg');
  const readme = pack.files[r + 'README.txt'];
  expect(readme.includes('MISSING FILES') && readme.includes('2026-10-10_parking_50.00_'), 'README lists the receipt that was missing from storage');
  const exp = pack.files[r + 'expenses.csv'];
  expect(exp.charCodeAt(0) === 0xfeff, 'CSV starts with the BOM Excel needs');
  expect(exp.includes('2026-03-02,Fuel,15 Seater Shuttle (AB 12 CD GP),"Engen, Gezina",,Card,1200.50,2026-03-02_fuel_1200.50_'), 'expense rows: ISO dates, plain decimals, quoted commas');
  expect(!exp.includes('Typo') && !exp.includes('Last year'), 'deleted and last-year expenses left out');
  const inv = pack.files[r + 'invoices.csv'];
  expect(inv.includes('EDR-0004,void,2026-08-08') && inv.includes('Duplicate booking'), 'void invoice listed with its reason');
  expect(inv.includes('EDR-0003,issued,2026-11-20,2026-11-27,Mokoena Family,5000.00,2000.00,3000.00'), 'partly paid invoice: total, paid, balance');
  const pay = pack.files[r + 'payments.csv'];
  expect(pay.includes('2026-03-05,EDR-0001') && pay.includes('2026-06-10,EDR-0002') && pay.includes('2026-11-25,EDR-0003'), 'payments received in the year');
  const sum = pack.files[r + 'summary.csv'];
  expect(sum.includes('Money received (payments dated in the year),7350.00,3') && sum.includes('Received minus expenses,2500.50'), 'summary totals match the screen');
  // Every CSV parses cleanly with a standard CSV reader, with the same number of columns on every row
  const pyCheck = `
import csv, io, json, sys
files = json.loads(sys.stdin.read())
for name, text in files.items():
    rows = list(csv.reader(io.StringIO(text.lstrip("\\ufeff"))))
    widths = {len(r) for r in rows}
    assert len(widths) == 1, (name, widths)
print("csv ok")`;
  const csvs = Object.fromEntries(Object.entries(pack.files).filter(([k]) => k.endsWith('.csv')));
  expect(execSync(`python3 -I -c '${pyCheck}'`, { input: JSON.stringify(csvs) }).toString().trim() === 'csv ok', 'all CSVs parse with even rows');

  console.log('Backup');
  await page.goto(base + '/#/more');
  await page.click('text=Backup');
  await page.waitForSelector('text=Never');
  await shot('backup-never');
  const [bdl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('button:has-text("Download everything")')]);
  expect(bdl.suggestedFilename() === `EDRAM-backup-${today}.zip`, `named EDRAM-backup-${today}.zip`);
  const backupFile = path.join(out, bdl.suggestedFilename());
  await bdl.saveAs(backupFile);
  await page.waitForSelector('text=to your downloads');
  await page.waitForSelector('.backup-status >> text=Today');
  expect(!!fake.db.business_settings[0].last_backup_at, 'last backup date recorded');
  await shot('backup-done');
  const bk = readZip(backupFile);
  const b = `EDRAM-backup-${today}/`;
  const data = JSON.parse(bk.files[b + 'data.json']);
  expect(bk.bad === null && data.format === 'edram-admin-backup', 'backup ZIP valid, data.json present');
  expect(data.tables.expenses.length === 6 && data.tables.expenses.some((e) => e.deleted_at), 'every expense backed up, deleted ones too');
  expect(data.tables.invoices.length === 4 && data.tables.payments.length === 3 && data.tables.customers.length === 2, 'invoices, payments and customers backed up');
  expect(['EDR-0001', 'EDR-0002', 'EDR-0003', 'EDR-0004'].every((num) => bk.files[`${b}invoices/${num}.pdf`]), 'a PDF of every invoice');
  expect(Object.keys(bk.files).filter((f) => f.includes('/receipts/')).length === 2, 'every stored receipt');

  console.log('Home: reminder gone');
  await page.click('.bottomnav >> text=Home');
  await page.waitForSelector('text=Recent invoices');
  await page.waitForTimeout(500);
  expect(!(await page.locator('text=backup').count()), 'no backup reminder after backing up');
  await shot('home-after');

  console.log('Desktop');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(base + '/#/reports');
  await page.waitForSelector('text=R 7 350,00');
  await shot('desktop-reports');

  expect(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('E2E RECORDS PASSED');
})().catch(async (err) => {
  console.error(err.message.split('\n')[0]);
  if (failPage) await failPage.screenshot({ path: path.join(out, 'FAILURE.png') }).catch(() => {});
  process.exit(1);
});
