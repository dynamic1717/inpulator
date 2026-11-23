import { expect, myMemoryReply, test } from './fixtures.js';

const MYMEMORY = 'https://api.mymemory.translated.net/**';

/** Time for the debounced selection handler and language detection to settle. */
const SETTLE_MS = 600;

async function selectAll(locator) {
  await locator.evaluate((element) => {
    element.focus();
    if ('setSelectionRange' in element) {
      element.setSelectionRange(0, element.value.length);
      return;
    }
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    const selection = element.ownerDocument.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

test.describe('with a working translation service', () => {
  test.beforeEach(async ({ context }) => {
    await context.route(MYMEMORY, (route) =>
      route.fulfill({ json: myMemoryReply(route.request().url()) })
    );
  });

  test('translates a textarea selection and Ctrl/Cmd+Z restores it', async ({
    openPage,
  }) => {
    const page = await openPage(
      '<textarea id="field" rows="3">Привет, как дела?</textarea>'
    );
    const field = page.locator('#field');
    await selectAll(field);

    await page.locator('#input-translate-btn').click();
    await expect(field).toHaveValue('EN:ПРИВЕТ, КАК ДЕЛА?');

    await field.press('ControlOrMeta+z');
    await expect(field).toHaveValue('Привет, как дела?');
  });

  test('shows the detected pair on the button', async ({ openPage }) => {
    const page = await openPage('<input id="field" value="Добрый вечер, друзья">');
    await selectAll(page.locator('#field'));

    await expect(page.locator('#input-translate-btn')).toHaveAttribute(
      'title',
      /RU → EN/
    );
  });

  test('keeps line breaks in a multi-line contenteditable selection', async ({
    openPage,
  }) => {
    const page = await openPage(
      '<div id="field" contenteditable="true">Первая строка<div>Вторая строка</div></div>'
    );
    const field = page.locator('#field');
    await selectAll(field);

    await page.locator('#input-translate-btn').click();
    await expect(field).toHaveText(/EN:ПЕРВАЯ СТРОКА\s*ВТОРАЯ СТРОКА/);
    expect(
      await field.evaluate((el) => el.innerText.split('\n').filter(Boolean))
    ).toEqual(['EN:ПЕРВАЯ СТРОКА', 'ВТОРАЯ СТРОКА']);
  });

  test('works inside a srcdoc iframe', async ({ openPage }) => {
    const page = await openPage(
      `<iframe id="frame" srcdoc="<div id='field' contenteditable='true'>Текст внутри фрейма</div>"></iframe>`
    );
    const frame = page.frameLocator('#frame');
    const field = frame.locator('#field');
    await expect(field).toBeVisible();
    await selectAll(field);

    await frame.locator('#input-translate-btn').click();
    await expect(field).toHaveText('EN:ТЕКСТ ВНУТРИ ФРЕЙМА');
  });

  test('is not affected by hostile page CSS and leaves page variables alone', async ({
    openPage,
  }) => {
    const page = await openPage('<textarea id="field">Привет, мир</textarea>', {
      head: `<style>
        :root { --accent: rgb(255, 0, 0); }
        button { background: rgb(255, 255, 0) !important; }
        svg { display: none !important; }
      </style>`,
    });
    await selectAll(page.locator('#field'));

    const button = page.locator('#input-translate-btn');
    await expect(button).toBeVisible();
    expect(
      await button.evaluate((el) => getComputedStyle(el).backgroundColor)
    ).not.toBe('rgb(255, 255, 0)');
    await expect(button.locator('svg.input-translate-icon')).toBeVisible();
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      )
    ).toBe('rgb(255, 0, 0)');
  });

  test('does not offer translation when the text is already in the target language', async ({
    openPage,
  }) => {
    const page = await openPage(
      '<textarea id="field">Hello there, how are you doing today?</textarea>'
    );
    await selectAll(page.locator('#field'));
    await page.waitForTimeout(SETTLE_MS);

    await expect(page.locator('#input-translate-btn')).toBeHidden();
  });

  test('respects skipped languages and blocked sites', async ({
    openPage,
    setSettings,
  }) => {
    await setSettings({ disabledSourceLanguages: ['ru'] });
    let page = await openPage('<textarea id="field">Привет, как дела?</textarea>');
    await selectAll(page.locator('#field'));
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator('#input-translate-btn')).toBeHidden();
    await page.close();

    await setSettings({
      disabledSourceLanguages: [],
      blockedDomains: ['inpulator.test'],
    });
    page = await openPage('<textarea id="field">Привет, как дела?</textarea>');
    await selectAll(page.locator('#field'));
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator('#input-translate-btn')).toBeHidden();
  });

  test('ignores password fields', async ({ openPage }) => {
    const page = await openPage(
      '<input id="field" type="password" value="секретный пароль">'
    );
    await selectAll(page.locator('#field'));
    await page.waitForTimeout(SETTLE_MS);

    await expect(page.locator('#input-translate-btn')).toBeHidden();
  });
});

test('shows an error on the button when the service fails', async ({
  context,
  openPage,
}) => {
  await context.route(MYMEMORY, (route) =>
    route.fulfill({ status: 500, body: 'boom' })
  );
  const page = await openPage('<textarea id="field">Привет, как дела?</textarea>');
  const field = page.locator('#field');
  await selectAll(field);

  const button = page.locator('#input-translate-btn');
  await button.click();

  await expect(button).toHaveClass(/input-translate-btn--error/);
  await expect(button).toHaveAttribute('title', /500/);
  await expect(field).toHaveValue('Привет, как дела?');
});

test('does not overwrite text that changed during translation', async ({
  context,
  openPage,
}) => {
  let release;
  const released = new Promise((resolve) => (release = resolve));
  await context.route(MYMEMORY, async (route) => {
    await released;
    await route.fulfill({ json: myMemoryReply(route.request().url()) });
  });

  const page = await openPage('<textarea id="field">Привет, как дела?</textarea>');
  const field = page.locator('#field');
  await selectAll(field);

  const button = page.locator('#input-translate-btn');
  await button.click();
  await field.evaluate((el) => (el.value = 'Совсем другой текст'));
  release();

  await expect(button).toHaveClass(/input-translate-btn--error/);
  await expect(field).toHaveValue('Совсем другой текст');
});
