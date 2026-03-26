export interface QueuedWatchHandlerOptions {
  runBatch: (paths: string[]) => Promise<void>;
  onError?: (error: unknown, paths: string[]) => void;
}

export const createQueuedWatchHandler = ({
  runBatch,
  onError,
}: QueuedWatchHandlerOptions) => {
  let pendingPaths: string[] | undefined;

  return async (changedPath?: string) => {
    if (pendingPaths !== undefined) {
      if (changedPath) {
        pendingPaths.push(changedPath);
      }
      return;
    }

    pendingPaths = changedPath ? [changedPath] : [];

    while (true) {
      const batch = pendingPaths;
      pendingPaths = [];

      try {
        await runBatch(batch);
      } catch (error) {
        onError?.(error, batch);
      }

      if (pendingPaths.length === 0) {
        pendingPaths = undefined;
        return;
      }
    }
  };
};
