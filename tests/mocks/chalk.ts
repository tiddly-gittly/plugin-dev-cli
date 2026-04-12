const createChalkProxy = (): any =>
  new Proxy((text: string) => text, {
    apply: (_target, _thisArg, args: unknown[]) => String(args[0] ?? ''),
    get: () => createChalkProxy(),
  });

export default createChalkProxy();
