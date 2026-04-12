import { getPort } from 'get-port-please';

export const getWikiListenHost = (lan?: boolean) =>
  lan ? '0.0.0.0' : '127.0.0.1';

export const resolveWikiListenPort = async (lan?: boolean) => {
  const host = getWikiListenHost(lan);
  return getPort({ port: 8080, host });
};

export const createWikiPortResolver = (lan?: boolean) => {
  let resolvedPort: number | undefined;

  return async () => {
    if (resolvedPort !== undefined) {
      return resolvedPort;
    }

    resolvedPort = await resolveWikiListenPort(lan);
    return resolvedPort;
  };
};
