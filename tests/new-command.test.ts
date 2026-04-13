import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { createPlugin } from '@/new';

jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn(),
  },
}));

const getPromptMock = async () => {
  const inquirerModule = await import('inquirer');
  return inquirerModule.default.prompt as unknown as jest.Mock;
};

const createTempDir = () => fs.mkdtempSync(path.join(tmpdir(), 'tw-plugin-new-'));

describe('createPlugin', () => {
  beforeEach(async () => {
    const promptSpy = await getPromptMock();
    promptSpy.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates plugin files under encoded plugin directory', async () => {
    const srcDir = createTempDir();
    const promptSpy = await getPromptMock();
    promptSpy.mockResolvedValue({
      pluginType: 'plugin',
      pluginName: 'hello world',
      authorName: 'acme',
      description: 'demo plugin',
    } as never);

    await createPlugin(srcDir);

    expect(promptSpy).toHaveBeenCalledTimes(1);
    const pluginDir = path.join(srcDir, encodeURIComponent('hello world'));
    const infoPath = path.join(pluginDir, 'plugin.info');
    const readmePath = path.join(pluginDir, 'readme.tid');

    expect(fs.existsSync(infoPath)).toBe(true);
    expect(fs.existsSync(readmePath)).toBe(true);

    const pluginInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    expect(pluginInfo).toMatchObject({
      title: '$:/plugins/acme/hello world',
      name: 'hello world',
      author: 'acme',
      description: 'demo plugin',
      'plugin-type': 'plugin',
    });
  });

  test('does not override existing plugin when user declines', async () => {
    const srcDir = createTempDir();
    const pluginDir = path.join(srcDir, 'demo');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.info'), '{"name":"old"}', 'utf8');

    const promptSpy = await getPromptMock();
    promptSpy
      .mockResolvedValueOnce({
        pluginType: 'plugin',
        pluginName: 'demo',
        authorName: 'acme',
        description: 'new',
      } as never)
      .mockResolvedValueOnce({ override: false } as never);

    await createPlugin(srcDir);

    expect(promptSpy).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(path.join(pluginDir, 'plugin.info'), 'utf8')).toBe('{"name":"old"}');
  });
});
