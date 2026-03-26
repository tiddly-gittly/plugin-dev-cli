import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { waitForFile } from '@/utils';

describe('waitForFile', () => {
  test('resolves after the file is created', async () => {
    const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'tw-plugin-dev-'));
    const filePath = path.join(tempDir, 'output.txt');
    const startedAt = Date.now();

    setTimeout(() => {
      fs.writeFileSync(filePath, 'ok', 'utf-8');
    }, 150);

    await waitForFile(filePath);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(100);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
