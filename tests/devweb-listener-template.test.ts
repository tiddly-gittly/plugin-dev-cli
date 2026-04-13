import vm from 'vm';
import { renderDevWebListenerScript } from '@/devweb-listener-template';

describe('devweb listener template', () => {
  test('falls back to window.WebSocket and reloads page on refresh message', () => {
    const createdUrls: string[] = [];
    const closeSpy = jest.fn();
    const instances: FakeSocket[] = [];

    class FakeSocket {
      onopen?: () => void;
      onmessage?: (event: { data: string }) => void;
      onclose?: () => void;

      constructor(url: string) {
        createdUrls.push(url);
        instances.push(this);
      }

      close() {
        closeSpy();
      }
    }

    const reloadSpy = jest.fn();
    const context: Record<string, unknown> = {
      exports: {},
      globalThis: {},
      window: { WebSocket: FakeSocket },
      document: {
        location: {
          protocol: 'http:',
          hostname: '127.0.0.1',
          reload: reloadSpy,
        },
      },
      console: {
        debug: jest.fn(),
        error: jest.fn(),
      },
    };

    const script = renderDevWebListenerScript(8081);
    vm.runInNewContext(script, context);

    const startup = (context.exports as { startup?: () => void }).startup;
    expect(typeof startup).toBe('function');

    startup?.();

    expect(createdUrls).toEqual(['ws://127.0.0.1:8081']);

    expect(instances.length).toBe(1);
    instances[0].onmessage?.({ data: 'refresh' });

    expect(closeSpy).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test('uses wss when page is served over https', () => {
    const createdUrls: string[] = [];

    class FakeSocket {
      onopen?: () => void;
      onmessage?: (event: { data: string }) => void;
      onclose?: () => void;

      constructor(url: string) {
        createdUrls.push(url);
      }

      close() {
        // noop
      }
    }

    const context: Record<string, unknown> = {
      exports: {},
      globalThis: { WebSocket: FakeSocket },
      window: { WebSocket: FakeSocket },
      document: {
        location: {
          protocol: 'https:',
          hostname: 'example.com',
          reload: jest.fn(),
        },
      },
      console: {
        debug: jest.fn(),
        error: jest.fn(),
      },
    };

    const script = renderDevWebListenerScript(443);
    vm.runInNewContext(script, context);

    const startup = (context.exports as { startup?: () => void }).startup;
    startup?.();

    expect(createdUrls).toEqual(['wss://example.com:443']);
  });
});
