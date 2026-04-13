import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { init } from '@/init';

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

describe('init', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns early when target project already exists', async () => {
    const existingDir = fs.mkdtempSync(path.join(tmpdir(), 'tw-plugin-init-'));
    const promptSpy = await getPromptMock();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await init(existingDir, 'https://example.com/repo.git');

    expect(promptSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(`${existingDir} already exists!`);
  });
});
