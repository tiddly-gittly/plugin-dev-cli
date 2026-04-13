import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import tmp from 'tmp';

describe('tailwind v4 postcss compat', () => {
  let tmpDir: tmp.DirResult;

  beforeAll(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
  });

  afterAll(() => {
    tmpDir.removeCallback();
  });

  test('should build plugin with tailwind v4 css import without postcss error', () => {
    const projectDir = tmpDir.name;

    // Create minimal plugin structure
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'wiki'), { recursive: true });

    // Plugin with Tailwind CSS import
    fs.writeFileSync(
      path.join(projectDir, 'src', 'index.ts'),
      `
import './index.css';
export const demo = 'tailwind-test';
`,
    );

    // Minimal Tailwind CSS
    fs.writeFileSync(
      path.join(projectDir, 'src', 'index.css'),
      `
@import "tailwindcss";
.custom { @apply text-blue-500; }
`,
    );

    // Minimal wiki
    fs.writeFileSync(path.join(projectDir, 'wiki', 'tiddlywiki.info'), '{}');

    // Run build
    try {
      const output = execFileSync(process.execPath, [
        path.resolve(__dirname, '../dist/js/main.js'),
        'build',
      ], {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      // Should not contain PostCSS error about tailwindcss plugin
      expect(output).not.toMatch(/Error: Build failed/);
      expect(output).not.toMatch(/postcss.*error/i);
    } catch (error) {
      // If command fails, check that it's not a PostCSS/Tailwind error
      const stderr = (error as any).stderr || '';
      const stdout = (error as any).stdout || '';
      const fullOutput = stderr + stdout;

      // These specific errors indicate Tailwind v4 integration issue
      expect(fullOutput).not.toMatch(/postcss.*lazy-result/i);
      expect(fullOutput).not.toMatch(/tailwindcss.*plugin.*error/i);
      throw error;
    }
  });
});
