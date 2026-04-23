export const buildListenArgs = (options: {
  wikiPath: string;
  port: number;
  lan?: boolean;
  writeWiki?: boolean;
}) => {
  const { wikiPath, port, lan } = options;
  const args = [wikiPath, '--listen', `port=${port}`];

  if (lan) {
    args.push('host=0.0.0.0');
  }

  return args;
};
