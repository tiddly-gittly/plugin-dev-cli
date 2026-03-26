import { createQueuedWatchHandler } from '@/dev-watch';

describe('createQueuedWatchHandler', () => {
  test('keeps running after a failed batch and retries on the next change', async () => {
    const batches: string[][] = [];
    const onError = jest.fn();
    let attempts = 0;
    const handler = createQueuedWatchHandler({
      runBatch: async paths => {
        batches.push(paths);
        attempts += 1;
        if (attempts === 1) {
          throw new Error('syntax error');
        }
      },
      onError,
    });

    await handler('broken.ts');
    await handler('fixed.ts');

    expect(batches).toEqual([['broken.ts'], ['fixed.ts']]);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test('queues file changes that arrive during an active batch', async () => {
    const batches: string[][] = [];
    let releaseBatch: (() => void) | undefined;
    const handler = createQueuedWatchHandler({
      runBatch: async paths => {
        batches.push(paths);
        if (batches.length === 1) {
          await new Promise<void>(resolve => {
            releaseBatch = resolve;
          });
        }
      },
    });

    const running = handler('a.ts');
    await Promise.resolve();
    await handler('b.ts');
    await handler('c.ts');
    releaseBatch?.();
    await running;

    expect(batches).toEqual([['a.ts'], ['b.ts', 'c.ts']]);
  });
});
