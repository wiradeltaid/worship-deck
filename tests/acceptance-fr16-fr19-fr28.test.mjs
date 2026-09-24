/**
 * Automated Browser Acceptance Tests for:
 * - FR-16: Two-screen presenter (Presenter + Projector sync, blanking, unblanking, disconnect)
 * - FR-19: On-demand scripture (Lookup, push to projector, clear overlay, invalid ref safety)
 * - FR-28: First-save-wins (409 conflict refusal and reload instead of silent overwrite)
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startBrowserEnvironment,
  stopBrowserEnvironment,
  loginViaUi,
  loginAndGetCookie,
  createServiceViaApi,
  createOperatorAccount,
  fetchRaw,
  DEFAULT_ADMIN_USER,
  DEFAULT_ADMIN_PASS,
} from './helpers/browser-harness.mjs';

describe('FR-16, FR-19, and FR-28 acceptance tests', () => {
  let env;
  let serviceId;
  let adminCookie;
  const operatorUser = 'operator_fr16';
  const operatorPass = 'op-pass-123';

  before(async () => {
    env = await startBrowserEnvironment({ dbName: 'test-fr16-19-28.db' });
    adminCookie = await loginAndGetCookie(env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);

    await createOperatorAccount(env.baseUrl, adminCookie, operatorUser, operatorPass);

    const rawRundown = `SABBATH, AUGUST 22, 2026
DIVINE SERVICE
Opening Song: SDAH #159
Scripture Reading: John 3:16
Sermon: Speaker Name "Original Sermon Title"
Closing Song: SDAH #200`;

    const svc = await createServiceViaApi(env.baseUrl, adminCookie, rawRundown);
    serviceId = svc.id;
  });

  after(async () => {
    await stopBrowserEnvironment(env);
  });

  test('FR-16: Two-screen presenter sync, blanking, unblanking, and projector liveness', async () => {
    const { browser, baseUrl } = env;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    // 1. Open Presenter on Page 1
    const pagePresenter = await context.newPage();
    await loginViaUi(pagePresenter, baseUrl, operatorUser, operatorPass);
    await pagePresenter.goto(`${baseUrl}/services/${serviceId}/present`, { waitUntil: 'domcontentloaded' });

    const presenterHeader = pagePresenter.locator('header p');
    await presenterHeader.waitFor({ state: 'visible', timeout: 15000 });
    assert.match(await presenterHeader.innerText(), /Slide 1 \//);

    // 2. Open Projector on Page 2 (in same browser context so BroadcastChannel connects)
    const pageProjector = await context.newPage();
    await pageProjector.goto(`${baseUrl}/services/${serviceId}/present/projector`, { waitUntil: 'domcontentloaded' });

    // Confirm projector rendered
    await pageProjector.waitForFunction(() => document.body.innerText.length > 0 || document.querySelector('div') !== null, { timeout: 10000 });

    // 3. Presenter advances to slide 2
    const nextBtn = pagePresenter.locator('button:has-text("Next")').first();
    await nextBtn.click();

    // Verify presenter updates to slide 2
    await pagePresenter.waitForFunction(
      () => document.querySelector('header p')?.textContent?.includes('Slide 2 /'),
      { timeout: 5000 }
    );
    assert.match(await presenterHeader.innerText(), /Slide 2 \//);

    // 4. Presenter blanks the screen
    const blankBtn = pagePresenter.locator('button:has-text("Blank screen"), button:has-text("Resume screen")');
    await blankBtn.click();

    // Verify presenter indicates blanked status
    await pagePresenter.waitForFunction(
      () => document.querySelector('button[aria-pressed="true"]') !== null,
      { timeout: 5000 }
    );

    // Verify projector displays black blanking layer
    const blackLayer = pageProjector.locator('div.bg-black.z-50, div.absolute.inset-0.bg-black');
    await blackLayer.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await blackLayer.isVisible(), 'Projector must show black blanking overlay');

    // 5. Presenter unblanks screen
    await blankBtn.click();
    await blackLayer.waitFor({ state: 'hidden', timeout: 5000 });

    // Confirm unblanking returned to slide 2 without losing position
    assert.match(await presenterHeader.innerText(), /Slide 2 \//);

    // 6. Close projector window and confirm presenter keeps driving smoothly
    await pageProjector.close();
    await nextBtn.click();
    await pagePresenter.waitForFunction(
      () => document.querySelector('header p')?.textContent?.includes('Slide 3 /'),
      { timeout: 5000 }
    );
    assert.match(await presenterHeader.innerText(), /Slide 3 \//);

    await context.close();
  });

  test('FR-19: On-demand scripture lookup and projector overlay', async () => {
    const { browser, baseUrl } = env;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    // 1. Open Presenter
    const pagePresenter = await context.newPage();
    await loginViaUi(pagePresenter, baseUrl, operatorUser, operatorPass);
    await pagePresenter.goto(`${baseUrl}/services/${serviceId}/present`, { waitUntil: 'domcontentloaded' });
    await pagePresenter.locator('header p').waitFor({ state: 'visible', timeout: 15000 });

    // 2. Open Projector
    const pageProjector = await context.newPage();
    await pageProjector.goto(`${baseUrl}/services/${serviceId}/present/projector`, { waitUntil: 'domcontentloaded' });
    await pageProjector.waitForFunction(() => document.body.innerText.length > 0 || document.querySelector('div') !== null, { timeout: 10000 });

    // 3. Look up on-demand verse from presenter
    const scriptureInput = pagePresenter.locator('section input[type="text"]').first();
    await scriptureInput.waitFor({ state: 'visible', timeout: 10000 });
    await scriptureInput.fill('John 3:16');

    // Click Push button
    const pushBtn = pagePresenter.locator(
      'button:has-text("Push to congregation screen"), button:has-text("Kirim ke layar jemaat"), button:has-text("Push to projector"), button:has-text("Kirim ke proyektor")'
    );
    await pushBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pushBtn.click();

    // 4. Verify Projector displays scripture overlay with John 3:16
    const scriptureOverlay = pageProjector.locator('text=/John 3:16|Yohanes 3:16/i');
    await scriptureOverlay.waitFor({ state: 'visible', timeout: 10000 });
    assert.ok(await scriptureOverlay.isVisible(), 'Scripture reference must appear on projector overlay');

    // 5. Clear scripture overlay
    const clearBtn = pagePresenter.locator('button:has-text("Clear scripture"), button:has-text("Tutup ayat")');
    await clearBtn.click();

    // Confirm scripture overlay dismissed on projector
    await scriptureOverlay.waitFor({ state: 'hidden', timeout: 5000 });

    // 6. Test invalid / empty scripture lookup safety
    await scriptureInput.fill('');
    assert.ok(await pushBtn.isDisabled(), 'Push button must be disabled for empty reference');

    await context.close();
  });

  test('FR-28: First-save-wins refuses second concurrent save with 409 Conflict', async () => {
    const { browser, baseUrl } = env;

    // Open Tab 1 and Tab 2 in separate contexts/pages
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageTab1 = await context1.newPage();
    await loginViaUi(pageTab1, baseUrl, operatorUser, operatorPass);
    await pageTab1.goto(`${baseUrl}/services/${serviceId}`, { waitUntil: 'domcontentloaded' });

    const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageTab2 = await context2.newPage();
    await loginViaUi(pageTab2, baseUrl, operatorUser, operatorPass);
    await pageTab2.goto(`${baseUrl}/services/${serviceId}`, { waitUntil: 'domcontentloaded' });

    // Both tabs loaded the same initial service state
    const textarea1 = pageTab1.locator('textarea#raw-rundown, textarea[name="raw_payload"], textarea').first();
    await textarea1.waitFor({ state: 'visible', timeout: 15000 });
    const currentText1 = await textarea1.inputValue();

    const textarea2 = pageTab2.locator('textarea#raw-rundown, textarea[name="raw_payload"], textarea').first();
    await textarea2.waitFor({ state: 'visible', timeout: 15000 });

    // 1. Edit and Save in Tab 1 (First save)
    const updatedTextTab1 = currentText1.replace('Original Sermon Title', 'First Tab Saved Sermon Title');
    await textarea1.fill(updatedTextTab1);

    const saveBtn1 = pageTab1.locator('button:has-text("Save Changes"), button:has-text("Simpan Perubahan"), button:has-text("Save"), button:has-text("Simpan")').first();
    const savePromise1 = pageTab1.waitForResponse((res) => res.url().includes('/api/services/') && res.request().method() === 'PUT');
    await saveBtn1.click();
    const res1 = await savePromise1;
    assert.equal(res1.status(), 200, 'First save must succeed with HTTP 200');

    // 2. Edit and Save in Tab 2 (Second save with stale updated_at)
    let dialogFired = false;
    let dialogMessage = '';
    pageTab2.on('dialog', async (dialog) => {
      dialogFired = true;
      dialogMessage = dialog.message();
      console.log('--- TAB 2 CONFLICT DIALOG:', dialogMessage);
      await dialog.accept();
    });

    const conflictingTextTab2 = currentText1.replace('Original Sermon Title', 'Conflicting Second Tab Sermon Title');
    await textarea2.fill(conflictingTextTab2);

    const saveBtn2 = pageTab2.locator('button:has-text("Save Changes"), button:has-text("Simpan Perubahan"), button:has-text("Save"), button:has-text("Simpan")').first();
    const conflictPromise2 = pageTab2.waitForResponse((res) => res.url().includes('/api/services/') && res.request().method() === 'PUT');
    await saveBtn2.click();
    const res2 = await conflictPromise2;
    assert.equal(res2.status(), 409, 'Second concurrent save must be refused with HTTP 409 Conflict');

    // 3. Verify dialog was handled
    await pageTab2.waitForTimeout(1000);
    assert.ok(dialogFired, 'Expected conflict dialog to fire on stale save in Tab 2');
    assert.match(
      dialogMessage,
      /changed elsewhere|berubah/i,
      `Expected conflict notice message, got: "${dialogMessage}"`
    );

    // 4. Verify Tab 1 content is preserved on server and not overwritten
    const getRes = await fetchRaw(`${baseUrl}/api/services/${serviceId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(getRes.status, 200);
    const finalData = JSON.parse(getRes.body);
    assert.ok(
      finalData.raw_payload && finalData.raw_payload.includes('First Tab Saved Sermon Title'),
      'Server must retain Tab 1 changes and not overwrite with stale Tab 2'
    );
    assert.ok(
      !finalData.raw_payload.includes('Conflicting Second Tab Sermon Title'),
      'Conflicting stale save must NOT be written to the database'
    );

    await context1.close();
    await context2.close();
  });
});