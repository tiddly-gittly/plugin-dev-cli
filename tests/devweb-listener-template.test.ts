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
          host: '127.0.0.1:8081',
          reload: reloadSpy,
        },
      },
      console: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const script = renderDevWebListenerScript();
    vm.runInNewContext(script, context);

    const startup = (context.exports as { startup?: () => void }).startup;
    expect(typeof startup).toBe('function');

    startup?.();

    expect(createdUrls).toEqual(['ws://127.0.0.1:8081/__dev_ws?gen=0']);

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
          host: 'example.com:443',
          reload: jest.fn(),
        },
      },
      console: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const script = renderDevWebListenerScript();
    vm.runInNewContext(script, context);

    const startup = (context.exports as { startup?: () => void }).startup;
    startup?.();

    expect(createdUrls).toEqual(['wss://example.com:443/__dev_ws?gen=0']);
  });

  test('bakes the build generation into the WebSocket URL query string', () => {
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
          host: 'example.com:443',
          reload: jest.fn(),
        },
      },
      console: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const script = renderDevWebListenerScript(42);
    vm.runInNewContext(script, context);

    const startup = (context.exports as { startup?: () => void }).startup;
    startup?.();

    expect(createdUrls).toEqual(['wss://example.com:443/__dev_ws?gen=42']);
  });

  test('defaults generation to 0 when no argument is passed', () => {
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
          protocol: 'http:',
          host: 'localhost:8080',
          reload: jest.fn(),
        },
      },
      console: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const script = renderDevWebListenerScript();
    vm.runInNewContext(script, context);

    const startup = (context.exports as { startup?: () => void }).startup;
    startup?.();

    expect(createdUrls).toEqual(['ws://localhost:8080/__dev_ws?gen=0']);
  });
});
