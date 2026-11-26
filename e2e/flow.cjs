// Clicks through the invoice flow in headless Chromium against the fake Supabase,
// checking results and saving screenshots and the downloaded PDFs.
//
//   VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=demo npx vite build --outDir /tmp/edram-e2e
//   npx vite preview --outDir /tmp/edram-e2e --port 4173 &
//   node e2e/flow.cjs <output-dir>
//
// Playwright isn't a project dependency; this uses the copy installed globally in the dev container.
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

let failPage = null;
(async () => {
  const fake = createFakeSupabase({ today });
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
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `${pad(++n)}-${name}.png`) });
  };
  const text = () => page.locator('main').innerText();
  const download = async (click) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), click()]);
    const file = path.join(out, dl.suggestedFilename().replace('.pdf', `-${n}.pdf`));
    await dl.saveAs(file);
    return file;
  };

  console.log('Sign in');
  await page.goto(base + '/#/sign-in');
  await page.fill('#email', 'owner@example.com');
  await page.fill('#password', 'secret-password');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Received this month');
  expect(true, 'signed in and Home shows');

  console.log('Vehicles');
  await page.goto(base + '/#/vehicles');
  await page.click('text=Add the fleet');
  await page.waitForSelector('text=22 Seater Coach');
  expect(fake.db.vehicles.length === 7, 'fleet of 7 added');
  await shot('vehicles');

  console.log('Settings');
  await page.goto(base + '/#/settings');
  await page.waitForSelector('#s-bank');
  await page.fill('#s-bank', 'Example Bank');
  await page.fill('#s-accname', 'EDRAM Shuttle and Tours');
  await page.fill('#s-accno', '1234567890');
  await page.fill('#s-branch', '250655');
  await page.fill('#s-acctype', 'Business cheque');
  await page.selectOption('#s-entity', 'sole_proprietor');
  await shot('settings');
  await page.click('text=Save settings');
  await page.waitForSelector('text=Settings saved.');
  expect(fake.db.business_settings[0].account_no === '1234567890', 'bank details saved');

  console.log('New invoice for a new customer');
  await page.goto(base + '/#/');
  await page.click('.nav-new');
  await shot('quick-actions');
  await page.click('dialog[open] >> text=New invoice');
  await page.waitForSelector('text=Choose customer');
  await shot('editor-empty');
  // Issue with nothing filled in: validation messages
  await page.click('.action-bar >> text=Issue invoice');
  await page.waitForSelector('text=Choose who the invoice is for');
  expect(true, 'validation asks for a customer and a price');
  await page.click('text=Choose customer');
  await page.click('dialog[open] >> text=New customer');
  await page.fill('#c-name', 'Thabo Nkosi');
  await page.fill('#c-phone', '082 123 4567');
  await shot('new-customer');
  await page.click('text=Save and use');
  await page.waitForSelector('.picker >> text=Thabo Nkosi');
  await page.click('button:has-text("Pick")');
  await shot('presets');
  await page.click('dialog[open] >> text=Airport transfer – O.R. Tambo');
  await page.selectOption('#l0-veh', { label: '7 Seater Van #1' });
  await page.fill('#l0-qty', '2');
  await page.fill('#l0-price', '850');
  await page.click('text=Add line');
  await page.fill('#l1-desc', 'Waiting time');
  await page.fill('#l1-qty', '1,5');
  await page.fill('#l1-price', 'R350');
  await page.fill('#notes', 'Pick-up 05:30 at Gezina.');
  expect((await page.locator('.total-row').innerText()).replace(/\s/g, '').includes('R2225,00'), 'live total R 2 225,00');
  await shot('editor-filled');
  await page.click('.action-bar >> text=Issue invoice');
  await page.waitForSelector('dialog[open] >> text=Issue EDR-0001?');
  await shot('issue-confirm');
  await page.click('dialog[open] >> button:has-text("Issue invoice")');
  await page.waitForSelector('h1 >> text=EDR-0001');
  expect((await text()).includes('Unpaid'), 'issued EDR-0001 shows Unpaid');
  expect(fake.db.invoices[0].total_cents === 222500, 'database total R 2 225,00');
  await shot('detail-issued');

  console.log('Share (headless Chromium cannot share files, so it falls back to download)');
  const pdf1 = await download(() => page.click('.action-bar >> text=Share'));
  await page.waitForSelector('dialog[open] >> text=Open WhatsApp');
  const wa = await page.getAttribute('dialog[open] >> a:has-text("Open WhatsApp")', 'href');
  expect(wa.startsWith('https://wa.me/27821234567?text=Hi%20Thabo%2C%20please%20find%20invoice%20EDR-0001'), 'WhatsApp link to 27821234567 with the message');
  await shot('share-fallback');
  await page.keyboard.press('Escape');

  console.log('Record a full payment');
  await page.click('.action-bar >> text=Record payment');
  await page.waitForSelector('#p-amount');
  expect((await page.inputValue('#p-amount')) === '2225.00', 'amount defaults to the balance');
  await page.click('dialog[open] >> button[role=radio]:has-text("Cash")');
  await shot('payment');
  await page.click('text=Save payment');
  await page.waitForSelector('.page-head >> text=Paid');
  expect(true, 'invoice shows Paid');
  await shot('detail-paid');
  const pdfPaid = await download(() => page.click('text=Download PDF'));

  console.log('Voiding is blocked while payments exist');
  await page.click('.list-row:has-text("Void invoice")');
  await page.waitForSelector('dialog[open] >> text=can\'t be voided');
  await shot('void-blocked');
  await page.click('dialog[open] >> text=OK');

  console.log('Duplicate, issue EDR-0002, then void it');
  await page.click('text=Duplicate as new draft');
  await page.waitForSelector('text=Edit draft');
  expect((await page.inputValue('#l0-desc')) === 'Airport transfer – O.R. Tambo', 'duplicate copies the lines');
  await page.click('.action-bar >> text=Issue invoice');
  await page.waitForSelector('dialog[open] >> text=Issue EDR-0002?');
  await page.click('dialog[open] >> button:has-text("Issue invoice")');
  await page.waitForSelector('h1 >> text=EDR-0002');
  await page.click('.list-row:has-text("Void invoice")');
  await page.click('dialog[open] >> button[type=submit]');
  await page.waitForSelector('text=Give a reason');
  await page.fill('#void-reason', 'Duplicate booking');
  await shot('void-reason');
  await page.click('dialog[open] >> button[type=submit]');
  await page.waitForSelector('.alert >> text=Duplicate booking');
  expect(fake.db.invoices.find((i) => i.number === 'EDR-0002').status === 'void', 'EDR-0002 is void and keeps its number');
  await shot('detail-void');
  const pdfVoid = await download(() => page.click('text=Download PDF'));

  console.log('A draft, then the list');
  await page.goto(base + '/#/invoices/new');
  await page.click('text=Choose customer');
  await page.click('dialog[open] >> text=Thabo Nkosi');
  await page.fill('#l0-desc', 'School transport (monthly)');
  await page.fill('#l0-price', '4 500');
  await page.click('text=Save draft');
  await page.waitForSelector('text=Draft saved.');
  expect(fake.db.invoices.filter((i) => i.status === 'draft').length === 1, 'draft saved without a number');
  await page.goto(base + '/#/invoices');
  await page.waitForSelector('text=EDR-0002');
  await shot('invoices-all');
  await page.getByRole('tab', { name: /^Paid/ }).click();
  await page.waitForTimeout(300);
  expect((await text()).includes('EDR-0001') && !(await text()).includes('EDR-0002'), 'Paid filter');
  await page.getByRole('tab', { name: /^All/ }).click();
  await page.fill('input[type=search]', 'edr2');
  await page.waitForTimeout(300);
  expect((await text()).includes('EDR-0002') && !(await text()).includes('EDR-0001'), 'search by number');

  console.log('Record payment from the + menu');
  await page.goto(base + '/#/');
  await page.waitForSelector('text=Recent invoices');
  await shot('home');
  await page.click('.nav-new');
  await page.click('dialog[open] >> text=Record payment');
  await page.waitForSelector('text=Choose the invoice that was paid');
  await shot('pick-for-payment');

  console.log('Customer');
  await page.goto(base + '/#/customers');
  await page.click('text=Thabo Nkosi');
  await page.waitForSelector('text=Billed (issued)');
  await shot('customer');

  console.log('Desktop');
  await page.setViewportSize({ width: 1366, height: 768 });
  const id1 = fake.db.invoices.find((i) => i.number === 'EDR-0001').id;
  await page.goto(base + `/#/invoices/${id1}`);
  await page.waitForSelector('h1 >> text=EDR-0001');
  await shot('desktop-detail');
  await page.goto(base + '/#/invoices/new');
  await page.waitForSelector('text=Choose customer');
  await shot('desktop-editor');

  // Numbers ran without gaps
  const numbers = fake.db.invoices.filter((i) => i.number).map((i) => i.number).sort();
  expect(JSON.stringify(numbers) === JSON.stringify(['EDR-0001', 'EDR-0002']), 'numbers EDR-0001, EDR-0002 with no gaps');
  expect(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  for (const f of [pdf1, pdfPaid, pdfVoid]) console.log('PDF', f);
  await browser.close();
  console.log('E2E FLOW PASSED');
})().catch(async (err) => {
  console.error(err.message.split('\n')[0]);
  if (failPage) await failPage.screenshot({ path: path.join(out, 'FAILURE.png') }).catch(() => {});
  process.exit(1);
});
