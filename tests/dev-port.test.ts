import { getWikiListenHost, resolveWikiListenPort } from '@/dev-port';

const mockGetPort = jest.fn();

jest.mock('get-port-please', () => ({
  getPort: (...args: unknown[]) => mockGetPort(...args),
}));

describe('dev port selection', () => {
  beforeEach(() => {
    mockGetPort.mockReset();
  });

  test('uses localhost host when lan is disabled', async () => {
    mockGetPort.mockResolvedValue(59224);

    const port = await resolveWikiListenPort(false);

    expect(port).toBe(59224);
    expect(mockGetPort).toHaveBeenCalledWith({
      port: 8080,
      host: '127.0.0.1',
    });
  });

  test('uses 0.0.0.0 host when lan is enabled', async () => {
    mockGetPort.mockResolvedValue(8088);

    const port = await resolveWikiListenPort(true);

    expect(port).toBe(8088);
    expect(mockGetPort).toHaveBeenCalledWith({
      port: 8080,
      host: '0.0.0.0',
    });
  });

  test('getWikiListenHost returns expected host by mode', () => {
    expect(getWikiListenHost(false)).toBe('127.0.0.1');
    expect(getWikiListenHost(true)).toBe('0.0.0.0');
  });
});
