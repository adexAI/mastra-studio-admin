import { createContext, useContext, useLayoutEffect, useEffect, useState } from 'react';
import { useMastraInstanceStatus } from '../hooks/use-mastra-instance-status';
import type { StudioConfig } from '../types';

export type StudioConfigContextType = StudioConfig & {
  isLoading: boolean;
  setConfig: (partialNewConfig: Partial<StudioConfig>) => void;
};

export const StudioConfigContext = createContext<StudioConfigContextType>({
  baseUrl: '',
  headers: {},
  apiPrefix: undefined,
  isLoading: false,
  setConfig: () => {},
});

export const useStudioConfig = () => {
  return useContext(StudioConfigContext);
};

export interface StudioConfigProviderProps {
  children: React.ReactNode;
  endpoint?: string;
  defaultApiPrefix?: string;
}

const LOCAL_STORAGE_KEY = 'mastra-studio-config';

export const StudioConfigProvider = ({
  children,
  endpoint = 'http://localhost:4111',
  defaultApiPrefix = '/api',
}: StudioConfigProviderProps) => {
  const { data: instanceStatus, isLoading: isStatusLoading, error } = useMastraInstanceStatus(endpoint);
  const [config, setConfig] = useState<StudioConfig & { isLoading: boolean }>({
    baseUrl: '',
    headers: {},
    apiPrefix: undefined,
    isLoading: true,
  });

  useLayoutEffect(() => {
    // Handle error case - stop loading but don't configure
    if (error && !isStatusLoading) {
      return setConfig({ baseUrl: '', headers: {}, apiPrefix: undefined, isLoading: false });
    }

    // Don't run the effect during the fetch request
    if (!instanceStatus?.status) return;

    const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedConfig) {
      const parsedConfig = JSON.parse(storedConfig);

      if (typeof parsedConfig === 'object' && parsedConfig !== null) {
        // Use stored apiPrefix if set, otherwise fall back to CLI default for back-compat
        const normalizedConfig = {
          ...parsedConfig,
          apiPrefix: parsedConfig.apiPrefix ?? defaultApiPrefix,
        };
        return setConfig({ ...normalizedConfig, isLoading: false });
      }
    }

    if (instanceStatus.status === 'active') {
      return setConfig(prev => ({ ...prev, baseUrl: endpoint, apiPrefix: defaultApiPrefix, isLoading: false }));
    }

    return setConfig({ baseUrl: '', headers: {}, apiPrefix: undefined, isLoading: false });
  }, [instanceStatus, endpoint, defaultApiPrefix, isStatusLoading, error]);

  const doSetConfig = (partialNewConfig: Partial<StudioConfig>) => {
    setConfig(prev => {
      const nextConfig = { ...prev, ...partialNewConfig };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextConfig));
      return nextConfig;
    });
  };

  // // Keep a ref so the message handler always calls the latest doSetConfig
  // // without needing to re-attach the listener on every render.
  // const doSetConfigRef = useRef(doSetConfig);
  // doSetConfigRef.current = doSetConfig;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
          console.log('[StudioConfigProvider] parsed message data:', data);
        } catch (err) {
          console.log('[StudioConfigProvider] failed to parse message data:', event.data, err);
          return;
        }
      }
      console.log('[StudioConfigProvider] message received:', data);
      if (data?.type !== 'localStorage-sync') return;
      let incoming = data?.headers;
      // Some senders nest the payload inside data.data as a JSON string
      if (!Array.isArray(incoming) && typeof data?.data === 'string') {
        try {
          const inner = JSON.parse(data.data);
          console.log('[StudioConfigProvider] newHeaders:', { headers: inner?.headers });
          setConfig(prev => {
            const nextConfig = { ...prev, ...{ headers: inner?.headers } };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextConfig));
            console.log('[StudioConfigProvider] nextConfig:', nextConfig);
            return nextConfig;
          });
        } catch (err) {
          console.log('[StudioConfigProvider] failed to parse data.data:', data.data, err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []); // empty deps — attach once, never re-register

  return (
    <StudioConfigContext.Provider value={{ ...config, setConfig: doSetConfig }}>
      {children}
    </StudioConfigContext.Provider>
  );
};
