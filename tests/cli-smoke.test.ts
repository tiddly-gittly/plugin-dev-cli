import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { execSync, execFileSync } from 'child_process';

const rootDir = path.resolve(__dirname, '..');
const nodeCommand = process.execPath;
const cliEntry = path.join(rootDir, 'dist', 'js', 'main.js');
const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';

const quoteShellArg = (value: string) =>
  process.platform === 'win32'
    ? `"${value.replace(/"/g, '""')}"`
    : `'${value.replace(/'/g, `'"'"'`)}'`;

const runShell = (command: string, cwd = rootDir) =>
  execSync(command, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    shell,
  });

let installedBinDir = '';

const runNode = (args: string[]) =>
  execFileSync(nodeCommand, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
  });

const runBin = (args: string[]) => {
  const binCommand = path.join(
    installedBinDir,
    process.platform === 'win32'
      ? 'tiddlywiki-plugin-dev.cmd'
      : 'tiddlywiki-plugin-dev',
  );

  if (process.platform === 'win32') {
    const quotedArgs = args.map(arg => `"${arg}"`).join(' ');

    return runShell(`${quoteShellArg(binCommand)} ${quotedArgs}`, path.dirname(installedBinDir));
  }

  return execFileSync(binCommand, args, {
    cwd: path.dirname(installedBinDir),
    encoding: 'utf8',
    env: process.env,
  });
};

describe('built cli smoke', () => {
  let installDir = '';

  beforeAll(() => {
    runShell('pnpm build');

    installDir = fs.mkdtempSync(path.join(tmpdir(), 'tw-plugin-cli-smoke-'));
    fs.writeFileSync(
      path.join(installDir, 'package.json'),
      JSON.stringify({ name: 'cli-smoke', private: true }, null, 2),
      'utf8',
    );

    const packedFileName = runShell(
      `pnpm pack --pack-destination ${quoteShellArg(installDir)}`,
    )
      .trim()
      .split(/\r?\n/)
      .pop();

    if (!packedFileName) {
      throw new Error('Failed to determine packed tarball name');
    }

    const packedFilePath = path.isAbsolute(packedFileName)
      ? packedFileName
      : path.join(installDir, packedFileName);

    runShell(`pnpm add ${quoteShellArg(packedFilePath)}`, installDir);
    installedBinDir = path.join(installDir, 'node_modules', '.bin');
  }, 180000);

  afterAll(() => {
    if (installDir) {
      fs.rmSync(installDir, { recursive: true, force: true });
    }
  });

  test('main cli help works from built artifact', () => {
    const output = runNode([cliEntry, '--help']);

    expect(output).toContain('Usage:');
    expect(output).toContain('dev');
    expect(output).toContain('build');
  });

  test('dev subcommand help works from built artifact', () => {
    const output = runNode([cliEntry, 'dev', '--help']);

    expect(output).toContain('Usage:');
    expect(output).toContain('--wiki');
    expect(output).toContain('--src');
  });

  test('dev subcommand help works via package bin shim', () => {
    const output = runBin(['dev', '--help']);

    expect(output).toContain('Usage:');
    expect(output).toContain('--wiki');
    expect(output).toContain('--src');
  });
});
