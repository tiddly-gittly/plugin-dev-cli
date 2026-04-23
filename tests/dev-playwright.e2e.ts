import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { once } from 'events';
import {
  execFileSync,
  execSync,
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'child_process';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright-chromium';

jest.setTimeout(300000);

const rootDir = path.resolve(__dirname, '..');
const cliEntry = path.join(rootDir, 'dist', 'js', 'main.js');

const createTempDir = () =>
  fs.mkdtempSync(path.join(tmpdir(), 'tw-plugin-playwright-'));

const withTimeout = async <T>(
  promise: Promise<T>,
  timeout: number,
  getError: () => Error,
) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(getError()), timeout);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const waitForChildExit = async (
  child: ChildProcessWithoutNullStreams,
  timeout = 5000,
) => {
  if (child.exitCode !== null) {
    return;
  }

  await withTimeout(
    once(child, 'exit').then(() => undefined),
    timeout,
    () => new Error('Timed out waiting for child process exit'),
  );
};

const waitFor = async (
  check: () => boolean,
  timeout = 15000,
  interval = 200,
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (check()) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timed out after ${timeout}ms`);
};

const walkFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir).flatMap(entry => {
    const fullPath = path.join(dir, entry);
    const stats = fs.statSync(fullPath);

    return stats.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
};

const snapshotWikiFiles = (wikiDir: string) => {
  const tiddlersDir = path.join(wikiDir, 'tiddlers');

  return new Map(
    walkFiles(tiddlersDir).flatMap(filePath => {
      try {
        return [
          [
            path.relative(tiddlersDir, filePath),
            fs.readFileSync(filePath, 'utf8'),
          ] as const,
        ];
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return [];
        }

        throw error;
      }
    }),
  );
};

const findSavedTiddler = (wikiDir: string, title: string) => {
  const wikiFiles = snapshotWikiFiles(wikiDir);

  for (const [relativePath, content] of wikiFiles.entries()) {
    if (content.includes(`title: ${title}`)) {
      return { relativePath, content };
    }
  }

  return undefined;
};

const createFixture = () => {
  const tempDir = createTempDir();
  const wikiDir = path.join(tempDir, 'wiki');
  const srcDir = path.join(tempDir, 'src');
  const pluginDir = path.join(srcDir, 'demo');

  fs.mkdirSync(path.join(wikiDir, 'tiddlers'), { recursive: true });
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(wikiDir, 'tiddlywiki.info'),
    JSON.stringify(
      {
        plugins: ['tiddlywiki/filesystem', 'tiddlywiki/tiddlyweb'],
      },
      null,
      2,
    ),
    'utf8',
  );
  fs.writeFileSync(
    path.join(pluginDir, 'plugin.info'),
    JSON.stringify(
      {
        title: '$:/plugins/acme/demo',
        name: 'demo',
        author: 'acme',
        description: 'playwright demo',
        'plugin-type': 'plugin',
      },
      null,
      2,
    ),
    'utf8',
  );
  fs.writeFileSync(
    path.join(pluginDir, 'hello.tid'),
    ['title: $:/plugins/acme/demo/hello', '', 'Hello from Playwright'].join(
      '\n',
    ),
    'utf8',
  );

  return { tempDir, wikiDir, srcDir };
};

const stopProcess = async (child: ChildProcessWithoutNullStreams) => {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill();

  try {
    await waitForChildExit(child);
  } catch {
    if (process.platform === 'win32' && child.pid) {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
      await waitFor(() => child.exitCode !== null, 5000).catch(() => undefined);
      return;
    }

    child.kill('SIGKILL');
    await waitFor(() => child.exitCode !== null, 5000).catch(() => undefined);
  }
};

const fetchStatus = async (baseUrl: string) => {
  const response = await fetch(new URL('/status', baseUrl));
  return (await response.json()) as { read_only: boolean };
};

const startDevServer = async (options: {
  cwd: string;
  wikiDir: string;
  srcDir: string;
  writeWiki?: boolean;
}) => {
  const { cwd, wikiDir, srcDir, writeWiki } = options;
  const args = [cliEntry, 'dev', '--wiki', wikiDir, '--src', srcDir];

  if (writeWiki) {
    args.push('--write-wiki');
  }

  const child = spawn(process.execPath, args, {
    cwd,
    env: process.env,
    stdio: 'pipe',
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  let output = '';
  const ready = new Promise<string>((resolve, reject) => {
    const onData = (chunk: string) => {
      output += chunk;
      const match = output.match(/Serving on (https?:\/\/\S+)/);

      if (match) {
        resolve(match[1]);
      }
    };
    const onExit = (code: number | null) => {
      reject(
        new Error(
          `dev server exited before becoming ready (code: ${code ?? 'null'})\n${output}`,
        ),
      );
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', onExit);
  });

  const url = await withTimeout(ready, 30000, () => {
    return new Error(`Timed out waiting for dev server\n${output}`);
  });

  return { child, url };
};

const createTiddlerFromBrowser = async (
  page: Page,
  title: string,
  text: string,
) => {
  const newTiddlerButton = page
    .locator('button[class$="Buttons%2Fnew-tiddler"]')
    .first();
  const titleInput = page.locator('input.tc-titlebar').first();
  const bodyTextarea = page.frameLocator('iframe').first().locator('textarea');
  const saveButton = page
    .locator('button[class$="Buttons%2Fsave"]')
    .first();

  await newTiddlerButton.waitFor({ state: 'visible' });
  expect(await newTiddlerButton.isVisible()).toBe(true);
  await newTiddlerButton.click();

  await titleInput.waitFor({ state: 'visible' });
  await bodyTextarea.first().waitFor({ state: 'visible' });
  expect(await titleInput.isEditable()).toBe(true);
  expect(await bodyTextarea.first().isEditable()).toBe(true);
  await titleInput.fill(title);
  await bodyTextarea.first().fill(text);

  expect(await saveButton.isVisible()).toBe(true);
  await saveButton.click();
  await page.waitForFunction(
    expectedTitle => Boolean((globalThis as any).$tw?.wiki?.getTiddler(expectedTitle)),
    title,
  );
};

describe('dev mode Playwright e2e', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    execSync('pnpm build', {
      cwd: rootDir,
      encoding: 'utf8',
      env: process.env,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });
    browser = await chromium.launch({ headless: true });
  }, 180000);

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await context.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('default dev mode keeps the web UI editable without writing new wiki files', async () => {
    const fixture = createFixture();
    let server: Awaited<ReturnType<typeof startDevServer>> | undefined;

    try {
      server = await startDevServer({
        cwd: fixture.tempDir,
        wikiDir: fixture.wikiDir,
        srcDir: fixture.srcDir,
      });
      const title = `PlaywrightDev${Date.now()}`;
      const text = 'Created in default dev mode';

      await page.goto(server.url, { waitUntil: 'domcontentloaded' });
      const status = await fetchStatus(server.url);
      expect(status.read_only).toBe(false);

      const beforeFiles = snapshotWikiFiles(fixture.wikiDir);
      await createTiddlerFromBrowser(page, title, text);
      await new Promise(resolve => setTimeout(resolve, 2500));

      const afterFiles = snapshotWikiFiles(fixture.wikiDir);
      expect(afterFiles).toEqual(beforeFiles);
      expect(findSavedTiddler(fixture.wikiDir, title)).toBeUndefined();
    } finally {
      if (server) {
        await stopProcess(server.child);
      }
      fs.rmSync(fixture.tempDir, { recursive: true, force: true });
    }
  });

  test('write-wiki mode keeps the web UI editable and writes the new tiddler to disk', async () => {
    const fixture = createFixture();
    let server: Awaited<ReturnType<typeof startDevServer>> | undefined;

    try {
      server = await startDevServer({
        cwd: fixture.tempDir,
        wikiDir: fixture.wikiDir,
        srcDir: fixture.srcDir,
        writeWiki: true,
      });
      const title = `PlaywrightWiki${Date.now()}`;
      const text = 'Created in write-wiki mode';

      await page.goto(server.url, { waitUntil: 'domcontentloaded' });
      const status = await fetchStatus(server.url);
      expect(status.read_only).toBe(false);

      const beforeFiles = snapshotWikiFiles(fixture.wikiDir);
      await createTiddlerFromBrowser(page, title, text);
      await waitFor(
        () => findSavedTiddler(fixture.wikiDir, title) !== undefined,
        15000,
      );

      const afterFiles = snapshotWikiFiles(fixture.wikiDir);
      expect(afterFiles.size).toBeGreaterThan(beforeFiles.size);
      expect(findSavedTiddler(fixture.wikiDir, title)).toEqual(
        expect.objectContaining({
          content: expect.stringContaining(`title: ${title}`),
        }),
      );
    } finally {
      if (server) {
        await stopProcess(server.child);
      }
      fs.rmSync(fixture.tempDir, { recursive: true, force: true });
    }
  });
});