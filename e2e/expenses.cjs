// Phase 2 click-through: log expenses with and without a receipt photo, in flight mode,
// with a lost server response, then edit, filter and soft-delete. Same setup as flow.cjs:
//   node e2e/expenses.cjs <output-dir>
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

// A big phone photo (3000×4000, noisy so it's several MB) with an EXIF "rotate 90°" tag
const photo = path.join(out, 'test-receipt.jpg');
const raw = path.join(out, 'raw-receipt.jpg');
execSync(`convert -size 3000x4000 plasma:green-white -attenuate 0.6 +noise Gaussian -quality 95 -strip ${raw}`);
execSync(`python3 -I ${path.join(__dirname, 'add-exif-orientation.py')} ${raw} ${photo} 6`);
const photoBytes = fs.statSync(photo).size;

let failPage = null;
(async () => {
  const fake = createFakeSupabase({ today });
  let loseNextExpenseResponse = false;
  let flightMode = false; // Playwright's interception still runs when the context is offline, so refuse here too
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.route('**/demo.supabase.co/**', async (route) => {
    const req = route.request();
    if (flightMode) return route.abort('internetdisconnected');
    const res = fake.handle({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postData(), bodyBuffer: req.postDataBuffer() });
    if (loseNextExpenseResponse && req.method() === 'POST' && req.url().includes('/rest/v1/expenses')) {
      loseNextExpenseResponse = false;
      return route.abort('connectionreset'); // saved on the "server", but the phone never hears back
    }
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
  const live = () => fake.db.expenses.filter((e) => !e.deleted_at);
  const waitFor = async (fn, msg, ms = 10000) => {
    const t = Date.now();
    while (!fn()) {
      if (Date.now() - t > ms) throw new Error('TIMEOUT: ' + msg);
      await page.waitForTimeout(100);
    }
  };

  console.log('Sign in and add the fleet');
  await page.goto(base + '/#/sign-in');
  await page.fill('#email', 'owner@example.com');
  await page.fill('#password', 'secret-password');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Received this month');
  await page.goto(base + '/#/vehicles');
  await page.click('text=Add the fleet');
  await page.waitForSelector('text=22 Seater Coach');

  console.log('Empty list');
  await page.click('.bottomnav >> text=Expenses');
  await page.waitForSelector('text=No expenses yet');
  await shot('expenses-empty');

  console.log('Log an expense with a receipt photo');
  await page.click('.nav-new');
  await page.click('dialog[open] >> text=Log expense');
  await page.waitForSelector('text=Snap receipt');
  await shot('log-start');
  const t0 = Date.now();
  await page.setInputFiles('input[type=file][capture]', photo);
  await page.waitForSelector('.receipt-preview img');
  expect(await page.evaluate(() => document.activeElement?.id === 'x-amount'), 'amount field gets the focus after the photo');
  await page.keyboard.type('1 200,50');
  await page.click('.cat:has-text("Fuel")');
  await page.selectOption('#x-veh', { label: '15 Seater Shuttle' });
  await page.fill('#x-supplier', 'Engen Gezina');
  await shot('log-filled');
  await page.click('.action-bar >> text=Save expense');
  await page.waitForSelector('text=Expense saved.');
  await waitFor(() => live().length === 1, 'first expense uploaded');
  console.log(`  (form filled and saved by the script in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const e1 = fake.db.expenses[0];
  expect(e1.amount_cents === 120050 && e1.category === 'fuel' && e1.supplier === 'Engen Gezina', 'expense stored: R 1 200,50, fuel, Engen Gezina');
  expect(e1.receipt_path === `${today.slice(0, 4)}/${today.slice(5, 7)}/${e1.id}.jpg`, 'receipt path is yyyy/mm/<expense id>.jpg');
  const stored = fake.storage.get('receipts/' + e1.receipt_path);
  expect(!!stored && stored.contentType === 'image/jpeg', 'receipt uploaded as JPEG');
  fs.writeFileSync(path.join(out, 'uploaded-receipt.jpg'), stored.bytes);
  const dims = execSync(`identify -format "%wx%h" ${path.join(out, 'uploaded-receipt.jpg')}`).toString();
  console.log(`  (photo ${Math.round(photoBytes / 1024)} KB, 3000×4000 rotated → uploaded ${Math.round(stored.bytes.length / 1024)} KB, ${dims})`);
  expect(stored.bytes.length <= 250 * 1024, 'receipt compressed to 250 KB or less');
  expect(dims === '1400x1050', 'longest side 1400px and EXIF rotation applied (landscape)');
  await page.waitForSelector('.list img.thumb');
  await shot('list-one');

  console.log('Without a photo: asks first');
  await page.click('.page-head a.btn:has-text("Log")');
  await page.waitForSelector('text=Snap receipt');
  await page.fill('#x-amount', '99');
  await page.click('.cat:has-text("Tolls")');
  await page.fill('#x-supplier', 'SANRAL');
  await page.click('.action-bar >> text=Save expense');
  await page.waitForSelector('dialog[open] >> text=Save without a receipt photo?');
  await shot('no-photo-confirm');
  await page.click('dialog[open] >> text=Save anyway');
  await waitFor(() => live().length === 2, 'second expense uploaded');
  expect(fake.db.expenses[1].receipt_path === null, 'saved without a receipt');

  console.log('Flight mode');
  flightMode = true;
  await ctx.setOffline(true);
  await page.waitForSelector('text=Expenses still save');
  await page.click('.page-head a.btn:has-text("Log")');
  await page.waitForSelector('text=Snap receipt');
  await page.setInputFiles('input[type=file][capture]', photo);
  await page.waitForSelector('.receipt-preview img');
  await page.keyboard.type('450');
  await page.click('.cat:has-text("Repairs")');
  await page.fill('#x-supplier', 'Midas Pretoria North');
  await page.click('.action-bar >> text=Save expense');
  await page.waitForSelector('text=Expense saved on this phone');
  await page.waitForSelector('text=Waiting to upload');
  expect(live().length === 2, 'nothing reached the server while offline');
  await shot('offline-queued');
  await page.click('.bottomnav >> text=Home');
  await page.waitForSelector('text=waiting to upload');
  await shot('home-queued');

  console.log('Back online: uploads by itself, exactly once');
  flightMode = false;
  await ctx.setOffline(false);
  await waitFor(() => live().length === 3, 'queued expense uploaded after reconnecting');
  const offlineId = fake.db.expenses[2].id;
  expect(fake.storage.has('receipts/' + fake.db.expenses[2].receipt_path), 'its receipt uploaded too');
  await page.reload(); // app start: retries anything left; must not duplicate
  await page.waitForSelector('text=Received this month');
  await page.waitForTimeout(800);
  expect(fake.db.expenses.filter((e) => e.id === offlineId).length === 1 && live().length === 3, 'exactly once after a reload');

  console.log('Lost server response: the retry must not duplicate');
  loseNextExpenseResponse = true;
  await page.click('.bottomnav >> text=Expenses');
  await page.click('.page-head a.btn:has-text("Log")');
  await page.fill('#x-amount', '35');
  await page.click('.cat:has-text("Parking")');
  await page.click('.action-bar >> text=Save expense');
  await page.click('dialog[open] >> text=Save anyway');
  await waitFor(() => live().length === 4, 'insert reached the server');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); // next retry chance
  await page.waitForTimeout(800);
  const parking = fake.db.expenses.filter((e) => e.category === 'parking');
  expect(parking.length === 1, 'one parking expense after the retry');
  expect(!(await page.locator('text=Waiting to upload').count()), 'nothing left waiting');

  console.log('Monthly total, filters');
  await page.waitForSelector('.section-head >> text=R 1 784,50');
  expect(true, 'month total R 1 784,50');
  await shot('list-all');
  await page.selectOption('select[aria-label="Filter by category"]', 'fuel');
  await page.waitForTimeout(200);
  const listText = await page.locator('main').innerText();
  expect(listText.includes('Engen Gezina') && !listText.includes('SANRAL'), 'category filter');
  await page.selectOption('select[aria-label="Filter by category"]', '');

  console.log('Edit, then soft delete');
  await page.click('text=SANRAL');
  await page.waitForSelector('text=Save changes');
  await page.fill('#x-amount', '109');
  await page.click('.action-bar >> text=Save changes');
  await page.waitForSelector('text=Changes saved.');
  expect(fake.db.expenses.find((e) => e.supplier === 'SANRAL').amount_cents === 10900, 'amount edited');
  await shot('edit');
  page.once('dialog', (dlg) => dlg.accept());
  await page.click('text=Delete expense');
  await page.waitForSelector('h1 >> text=Expenses');
  const sanral = fake.db.expenses.find((e) => e.supplier === 'SANRAL');
  expect(!!sanral && !!sanral.deleted_at, 'deleted expense kept, marked deleted');
  expect(!(await page.locator('main').innerText()).includes('SANRAL'), 'and hidden from the list');

  console.log('Home tile');
  await page.click('.bottomnav >> text=Home');
  await page.waitForSelector('.tile:has-text("Expenses this month") >> text=R 1 685,50');
  expect(true, 'Expenses this month R 1 685,50');
  await shot('home');

  console.log('Desktop');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.click('.rail >> text=Expenses');
  await page.waitForSelector('.list img.thumb');
  await shot('desktop-list');
  await page.click('.rail >> text=New');
  await page.click('dialog[open] >> text=Log expense');
  await page.waitForSelector('text=Snap receipt');
  await shot('desktop-log');

  expect(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('E2E EXPENSES PASSED');
})().catch(async (err) => {
  console.error(err.message.split('\n')[0]);
  if (failPage) await failPage.screenshot({ path: path.join(out, 'FAILURE.png') }).catch(() => {});
  process.exit(1);
});
