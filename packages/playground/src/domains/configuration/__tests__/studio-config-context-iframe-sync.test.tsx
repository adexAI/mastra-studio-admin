// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw-server';
import { StudioConfigProvider, useStudioConfig } from '../context/studio-config-context';

const BASE_URL = 'http://localhost:4111';
const LOCAL_STORAGE_KEY = 'mastra-studio-config';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });

type RenderedConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  apiPrefix?: string;
  isLoading: boolean;
};

function ConfigProbe() {
  const { baseUrl, headers, apiPrefix, isLoading } = useStudioConfig();

  return <pre data-testid="config">{JSON.stringify({ baseUrl, headers, apiPrefix, isLoading })}</pre>;
}

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StudioConfigProvider endpoint={BASE_URL}>
        <ConfigProbe />
      </StudioConfigProvider>
    </QueryClientProvider>,
  );
}

function readConfig() {
  return JSON.parse(screen.getByTestId('config').textContent ?? '{}') as RenderedConfig;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('StudioConfigProvider iframe sync', () => {
  it('updates persisted config from a localStorage-sync iframe message', async () => {
    server.use(http.get(BASE_URL, () => HttpResponse.text('ok')));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    renderProvider();

    await waitFor(() => expect(readConfig().isLoading).toBe(false));

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'localStorage-sync',
            baseUrl: 'https://custom.mastra.test',
            headers: { Authorization: 'Bearer iframe-token' },
          },
        }),
      );
    });

    await waitFor(() =>
      expect(readConfig()).toMatchObject({
        baseUrl: 'https://custom.mastra.test',
        headers: { Authorization: 'Bearer iframe-token' },
        apiPrefix: '/api',
        isLoading: false,
      }),
    );

    expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}')).toMatchObject({
      baseUrl: 'https://custom.mastra.test',
      headers: { Authorization: 'Bearer iframe-token' },
      apiPrefix: '/api',
    });
  });
});
