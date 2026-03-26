import { createProgram, ProgramActions } from '@/program';

const createActions = (): ProgramActions => ({
  init: jest.fn(async () => undefined),
  runDev: jest.fn(async () => undefined),
  runTest: jest.fn(async () => undefined),
  createPlugin: jest.fn(async () => undefined),
  build: jest.fn(async () => undefined),
  buildLibrary: jest.fn(async () => undefined),
  publishOnlineHTML: jest.fn(async () => undefined),
  publishOfflineHTML: jest.fn(async () => undefined),
});

describe('createProgram', () => {
  test('registers the user-facing commands', () => {
    const program = createProgram(createActions());
    const commandNames = program.commands.map(command => command.name());

    expect(commandNames).toEqual([
      'dev',
      'test',
      'build',
      'new',
      'init',
      'publish',
    ]);
  });

  test('keeps the dev command wired to wiki and source options', () => {
    const program = createProgram(createActions());
    const devCommand = program.commands.find(
      command => command.name() === 'dev',
    );
    const optionFlags = devCommand?.options.map(option => option.long);

    expect(devCommand?.description()).toContain('wiki folder');
    expect(optionFlags).toEqual(
      expect.arrayContaining(['--wiki', '--src', '--write-wiki', '--lan']),
    );
  });

  test('maps dev command options to runDev action', async () => {
    const actions = createActions();
    const program = createProgram(actions);

    await program.parseAsync([
      'node',
      'tiddlywiki-plugin-dev',
      'dev',
      '--wiki',
      'wiki-dir',
      '--src',
      'src-dir',
      '--exclude',
      '[prefix[$:/plugins/acme/]]',
      '--write-wiki',
      '--lan',
    ]);

    expect(actions.runDev).toHaveBeenCalledWith('wiki-dir', 'src-dir', {
      writeWiki: true,
      excludeFilter: '[prefix[$:/plugins/acme/]]',
      lan: true,
    });
  });

  test('routes build --library to buildLibrary and exits cleanly', async () => {
    const actions = createActions();
    const program = createProgram(actions);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: number) => {
        throw new Error(`exit:${code ?? 0}`);
      });

    await expect(
      program.parseAsync([
        'node',
        'tiddlywiki-plugin-dev',
        'build',
        '--library',
        '--output',
        'dist-dir',
        '--wiki',
        'wiki-dir',
        '--src',
        'src-dir',
        '--exclude',
        '[tag[skip]]',
      ]),
    ).rejects.toThrow('exit:0');

    expect(actions.buildLibrary).toHaveBeenCalledWith(
      'dist-dir',
      '[tag[skip]]',
      'src-dir',
      'wiki-dir',
    );
    expect(actions.build).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('routes offline publish options to publishOfflineHTML', async () => {
    const actions = createActions();
    const program = createProgram(actions);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: number) => {
        throw new Error(`exit:${code ?? 0}`);
      });

    await expect(
      program.parseAsync([
        'node',
        'tiddlywiki-plugin-dev',
        'publish',
        'public-dir',
        '--offline',
        '--html',
        'site.html',
        '--wiki',
        'wiki-dir',
        '--src',
        'src-dir',
        '--exclude',
        '[tag[publish]]',
        '--exclude-plugin',
        '[prefix[$:/plugins/acme/]]',
        '--no-library',
      ]),
    ).rejects.toThrow('exit:0');

    expect(actions.publishOfflineHTML).toHaveBeenCalledWith(
      'wiki-dir',
      'public-dir',
      'site.html',
      '[tag[publish]]',
      false,
      'src-dir',
      '[prefix[$:/plugins/acme/]]',
    );
    expect(actions.publishOnlineHTML).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
