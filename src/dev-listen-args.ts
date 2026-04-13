export const buildListenArgs = (options: {
  wikiPath: string;
  port: number;
  lan?: boolean;
  writeWiki?: boolean;
}) => {
  const { wikiPath, port, lan, writeWiki } = options;
  const args = [wikiPath, '--listen', `port=${port}`];

  if (lan) {
    args.push('host=0.0.0.0');
  }

  // In read-only dev mode, explicitly deny anonymous write operations.
  // This prevents accidental filesystem sync when a wiki already bundles
  // filesystem/tiddlyweb plugins.
  if (!writeWiki) {
    args.push('writers=(authenticated)');
  }

  return args;
};
