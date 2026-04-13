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

  test('keeps write-wiki disabled by default', async () => {
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
    ]);

    expect(actions.runDev).toHaveBeenCalledWith('wiki-dir', 'src-dir', {
      writeWiki: undefined,
      excludeFilter: undefined,
      lan: undefined,
    });
  });

  test('routes build --library to buildLibrary and exits cleanly', async () => {
    const actions = createActions();
    const program = createProgram(actions);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null) => {
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
      .mockImplementation((code?: string | number | null) => {
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

  test('maps test command options to runTest action', async () => {
    const actions = createActions();
    const program = createProgram(actions);

    await program.parseAsync([
      'node',
      'tiddlywiki-plugin-dev',
      'test',
      '--wiki',
      'wiki-dir',
      '--src',
      'src-dir',
      '--exclude',
      '[prefix[$:/plugins/acme/]]',
    ]);

    expect(actions.runTest).toHaveBeenCalledWith(
      'wiki-dir',
      'src-dir',
      '[prefix[$:/plugins/acme/]]',
    );
  });

  test('maps new command options to createPlugin action', async () => {
    const actions = createActions();
    const program = createProgram(actions);

    await program.parseAsync([
      'node',
      'tiddlywiki-plugin-dev',
      'new',
      '--src',
      'plugins-src',
    ]);

    expect(actions.createPlugin).toHaveBeenCalledWith('plugins-src');
  });

  test('uses default template repo for init command', async () => {
    const actions = createActions();
    const program = createProgram(actions);

    await program.parseAsync([
      'node',
      'tiddlywiki-plugin-dev',
      'init',
      'my-project',
    ]);

    expect(actions.init).toHaveBeenCalledWith(
      'my-project',
      'https://github.com/tiddly-gittly/Modern.TiddlyDev.git',
      undefined,
    );
  });

  test('routes online publish options to publishOnlineHTML and exits cleanly', async () => {
    const actions = createActions();
    const program = createProgram(actions);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null) => {
        throw new Error(`exit:${code ?? 0}`);
      });

    await expect(
      program.parseAsync([
        'node',
        'tiddlywiki-plugin-dev',
        'publish',
        'public-dir',
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
      ]),
    ).rejects.toThrow('exit:0');

    expect(actions.publishOnlineHTML).toHaveBeenCalledWith(
      'wiki-dir',
      'public-dir',
      'site.html',
      '[tag[publish]]',
      true,
      'src-dir',
      '[prefix[$:/plugins/acme/]]',
    );
    expect(actions.publishOfflineHTML).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
