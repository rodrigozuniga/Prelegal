const { test, expect } = require('@playwright/test');
const fs = require('fs');

const CREATOR = '/mutual-nda.html';
const DEFAULT_PURPOSE = 'Evaluating whether to enter into a business relationship with the other party.';

const cp = (key) => `[data-cp="${key}"]`;

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

async function download(page) {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#download-btn'),
  ]);
  return { filename: dl.suggestedFilename(), content: fs.readFileSync(await dl.path(), 'utf8') };
}

test.describe('Document rendering', () => {
  test.beforeEach(async ({ page }) => { await page.goto(CREATOR); });

  test('01 initial state shows placeholders, default purpose, today as effective date', async ({ page }) => {
    await expect(page.locator(cp('p1-company'))).toHaveText('[Company]');
    await expect(page.locator(cp('p1-company'))).toHaveClass(/empty/);
    await expect(page.locator(cp('gov-law'))).toHaveText('[State]');
    await expect(page.locator(cp('purpose'))).toHaveText(DEFAULT_PURPOSE);
    await expect(page.locator(cp('effective-date'))).toHaveText(longDate(todayIso()));
  });

  test('02 typing in each field updates the document live', async ({ page }) => {
    const fields = {
      'p1-company': 'Acme Robotics, Inc.',
      'p1-name': 'Jordan Lee',
      'p1-title': 'CEO',
      'p1-address': 'legal@acmerobotics.com',
      'p2-company': 'Blue Harbor Labs LLC',
      'p2-name': 'Sam Rivera',
      'p2-title': 'Managing Member',
      'p2-address': 'sam@blueharborlabs.com',
      'purpose': 'Evaluating a joint pilot program.',
      'gov-law': 'Delaware',
      'jurisdiction': 'New Castle, DE',
      'modifications': 'Section 5 term extended.',
    };
    for (const [id, value] of Object.entries(fields)) {
      await page.fill(`#${id}`, value);
      await expect(page.locator(cp(id)).first()).toHaveText(value);
    }
  });

  test('03 clearing a field restores its placeholder with empty styling', async ({ page }) => {
    await page.fill('#p1-name', 'Jordan Lee');
    await expect(page.locator(cp('p1-name'))).toHaveText('Jordan Lee');
    await page.fill('#p1-name', '');
    await expect(page.locator(cp('p1-name'))).toHaveText('[Name]');
    await expect(page.locator(cp('p1-name'))).toHaveClass(/empty/);
  });

  test('04 governing law and jurisdiction update in both cover page and Standard Terms', async ({ page }) => {
    await page.fill('#gov-law', 'Delaware');
    await page.fill('#jurisdiction', 'New Castle, DE');
    await expect(page.locator(cp('gov-law'))).toHaveText('Delaware');
    await expect(page.locator(cp('gov-law-2'))).toHaveText('Delaware');
    await expect(page.locator(cp('jurisdiction'))).toHaveText('New Castle, DE');
    await expect(page.locator(cp('jurisdiction-2'))).toHaveText('New Castle, DE');
  });

  test('05 empty modifications renders as "None"', async ({ page }) => {
    await expect(page.locator(cp('modifications'))).toHaveText('None');
  });

  test('06 whitespace-only input is treated as empty', async ({ page }) => {
    await page.fill('#p1-company', '     ');
    await expect(page.locator(cp('p1-company'))).toHaveText('[Company]');
    await expect(page.locator(cp('p1-company'))).toHaveClass(/empty/);
  });
});

test.describe('Term options and checkboxes', () => {
  test.beforeEach(async ({ page }) => { await page.goto(CREATOR); });

  test('07 MNDA term radios toggle checkboxes and disable the years input', async ({ page }) => {
    const expiresBox = page.locator('[data-check="term-expires"] .box');
    const terminatedBox = page.locator('[data-check="term-terminated"] .box');
    await expect(expiresBox).toHaveText('☒');
    await expect(terminatedBox).toHaveText('☐');

    await page.check('input[name="mnda-term"][value="terminated"]');
    await expect(expiresBox).toHaveText('☐');
    await expect(terminatedBox).toHaveText('☒');
    await expect(page.locator('[data-check="term-expires"]')).toHaveClass(/unchecked/);
    await expect(page.locator('#term-years')).toBeDisabled();

    await page.check('input[name="mnda-term"][value="expires"]');
    await expect(expiresBox).toHaveText('☒');
    await expect(page.locator('#term-years')).toBeEnabled();
  });

  test('08 confidentiality radios toggle checkboxes and disable the years input', async ({ page }) => {
    const yearsBox = page.locator('[data-check="conf-years"] .box');
    const perpBox = page.locator('[data-check="conf-perpetuity"] .box');
    await expect(yearsBox).toHaveText('☒');

    await page.check('input[name="conf-term"][value="perpetuity"]');
    await expect(yearsBox).toHaveText('☐');
    await expect(perpBox).toHaveText('☒');
    await expect(page.locator('#conf-years')).toBeDisabled();

    await page.check('input[name="conf-term"][value="years"]');
    await expect(page.locator('#conf-years')).toBeEnabled();
  });

  test('09 year counts pluralize correctly', async ({ page }) => {
    await expect(page.locator(cp('term-years'))).toHaveText('1 year');
    await page.fill('#term-years', '2');
    await expect(page.locator(cp('term-years'))).toHaveText('2 years');
    await page.fill('#conf-years', '5');
    await expect(page.locator(cp('conf-years'))).toHaveText('5 years');
  });

  test('10 invalid year values fall back to "1 year"', async ({ page }) => {
    await page.fill('#term-years', '0');
    await expect(page.locator(cp('term-years'))).toHaveText('1 year');
    await page.fill('#term-years', '');
    await expect(page.locator(cp('term-years'))).toHaveText('1 year');
  });
});

test.describe('Date handling', () => {
  test.beforeEach(async ({ page }) => { await page.goto(CREATOR); });

  test('11 picked date renders in long US format', async ({ page }) => {
    await page.fill('#effective-date', '2027-03-03');
    await expect(page.locator(cp('effective-date'))).toHaveText('March 3, 2027');
  });

  test('12 no timezone off-by-one on January 1', async ({ page }) => {
    await page.fill('#effective-date', '2026-01-01');
    await expect(page.locator(cp('effective-date'))).toHaveText('January 1, 2026');
  });

  test('13 cleared date restores placeholder', async ({ page }) => {
    await page.fill('#effective-date', '');
    await expect(page.locator(cp('effective-date'))).toHaveText('[Effective Date]');
  });
});

test.describe('Download and print', () => {
  test.beforeEach(async ({ page }) => { await page.goto(CREATOR); });

  test('14 download button produces an HTML file', async ({ page }) => {
    const { filename, content } = await download(page);
    expect(filename).toMatch(/\.html$/);
    expect(content.length).toBeGreaterThan(1000);
  });

  test('15 downloaded file is standalone and complete', async ({ page }) => {
    await page.fill('#p1-company', 'Acme Inc');
    await page.fill('#gov-law', 'Delaware');
    const { content } = await download(page);
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<style>');
    expect(content).toContain('Acme Inc');
    expect(content).toContain('Mutual Non-Disclosure Agreement');
    expect(content).toContain('Equitable Relief');
    expect(content).toContain('sig-table');
    expect(content).toMatch(/laws of the State of <span[^>]*>Delaware<\/span>/);
  });

  test('16 filename derives from sanitized company names', async ({ page }) => {
    let result = await download(page);
    expect(result.filename).toBe('Mutual-NDA.html');

    await page.fill('#p1-company', 'Acme & Co / West');
    await page.fill('#p2-company', 'Beta LLC');
    result = await download(page);
    expect(result.filename).toBe('Mutual-NDA-Acme-Co-West-Beta-LLC.html');
  });

  test('17 downloaded file reflects checkbox state', async ({ page }) => {
    await page.check('input[name="mnda-term"][value="terminated"]');
    const { content } = await download(page);
    expect(content).toMatch(/<span class="box">☐<\/span>Expires/);
    expect(content).toMatch(/<span class="box">☒<\/span>Continues until terminated/);
  });

  test('18 print media hides the UI and shows only the document', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    const displays = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector('.site-header')).display,
      rail: getComputedStyle(document.querySelector('.form-rail')).display,
      sheet: getComputedStyle(document.querySelector('.sheet')).display,
      cpBackground: getComputedStyle(document.querySelector('.cp')).backgroundColor,
    }));
    expect(displays.header).toBe('none');
    expect(displays.rail).toBe('none');
    expect(displays.sheet).not.toBe('none');
    expect(displays.cpBackground).toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('Security and robustness', () => {
  test.beforeEach(async ({ page }) => { await page.goto(CREATOR); });

  test('19 HTML injection renders as literal text everywhere', async ({ page }) => {
    const payload = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    await page.fill('#p1-company', payload);
    await expect(page.locator(cp('p1-company'))).toHaveText(payload);
    expect(await page.locator('#document script, #document img').count()).toBe(0);
    const { content } = await download(page);
    expect(content).toContain('&lt;script&gt;');
    expect(content).not.toContain('<script>alert');
  });

  test('20 very long input does not break the layout', async ({ page }) => {
    await page.fill('#p1-company', 'A'.repeat(500));
    await page.fill('#purpose', 'Long purpose. '.repeat(100));
    const overflow = await page.evaluate(() =>
      document.body.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('table.sig-table')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('21 landing dropdown navigates to the creator; other options do not', async ({ page }) => {
    await page.goto('/index.html');
    await page.selectOption('#prelegal-menu', 'intake');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/index\.html/);

    await page.selectOption('#prelegal-menu', 'mutual-nda.html');
    await expect(page).toHaveURL(/mutual-nda\.html/);
  });

  test('22 wordmark links back to the landing page', async ({ page }) => {
    await page.goto(CREATOR);
    await page.click('.wordmark');
    await expect(page).toHaveURL(/index\.html/);
  });
});

test.describe('Accessibility and responsive', () => {
  test('23 keyboard reaches inputs and buttons with visible focus', async ({ page }) => {
    await page.goto(CREATOR);
    const reached = new Set();
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        return { id: el.id || el.className, outline: getComputedStyle(el).outlineStyle };
      });
      reached.add(info.id);
      if (info.id === 'download-btn' || info.id === 'print-btn') {
        expect(info.outline).not.toBe('none');
      }
    }
    expect(reached).toContain('p1-company');
    expect(reached).toContain('download-btn');
    expect(reached).toContain('print-btn');
  });

  test('24 every form control has an accessible label', async ({ page }) => {
    await page.goto(CREATOR);
    const unlabeled = await page.evaluate(() => {
      const controls = document.querySelectorAll('#nda-form input, #nda-form textarea');
      return Array.from(controls)
        .filter((el) =>
          !el.getAttribute('aria-label') &&
          !(el.id && document.querySelector(`label[for="${el.id}"]`)) &&
          !el.closest('label'))
        .map((el) => el.id || el.name);
    });
    expect(unlabeled).toEqual([]);
  });

  test.describe('reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });
    test('25 highlight transition is disabled under prefers-reduced-motion', async ({ page }) => {
      await page.goto(CREATOR);
      const result = await page.evaluate(() => ({
        matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        duration: getComputedStyle(document.querySelector('.cp')).transitionDuration,
      }));
      expect(result.matches).toBe(true);
      expect(result.duration).toBe('0s');
    });
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 375, height: 812 } });
    test('26 layout stacks on mobile with no horizontal overflow', async ({ page }) => {
      await page.goto(CREATOR);
      const layout = await page.evaluate(() => ({
        columns: getComputedStyle(document.querySelector('.layout')).gridTemplateColumns.split(' ').length,
        twoCol: getComputedStyle(document.querySelector('.two-col')).gridTemplateColumns.split(' ').length,
        overflow: document.body.scrollWidth - window.innerWidth,
      }));
      expect(layout.columns).toBe(1);
      expect(layout.twoCol).toBe(1);
      expect(layout.overflow).toBeLessThanOrEqual(0);
    });
  });

  test('27 page renders with web fonts blocked', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await page.goto(CREATOR);
    await expect(page.locator('.sheet h2')).toBeVisible();
    await expect(page.locator('#download-btn')).toBeVisible();
    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.sheet')).fontFamily
    );
    expect(fontFamily).toContain('Georgia');
  });
});
