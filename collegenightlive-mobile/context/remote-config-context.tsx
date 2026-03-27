import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { remoteConfig } from '@/lib/firebase';

const DEFAULT_UNDERCOVER_LABEL = 'Security (UC)';
const DEFAULT_CREEP_LABEL = 'Fishy';

interface RemoteConfigContextValue {
  undercoverLabel: string;
  creepLabel: string;
}

const RemoteConfigContext = createContext<RemoteConfigContextValue>({
  undercoverLabel: DEFAULT_UNDERCOVER_LABEL,
  creepLabel: DEFAULT_CREEP_LABEL,
});

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [undercoverLabel, setUndercoverLabel] = useState(DEFAULT_UNDERCOVER_LABEL);
  const [creepLabel, setCreepLabel] = useState(DEFAULT_CREEP_LABEL);

  useEffect(() => {
    (async () => {
      try {
        await fetchAndActivate(remoteConfig);
        setUndercoverLabel(getValue(remoteConfig, 'undercover_label').asString() || DEFAULT_UNDERCOVER_LABEL);
        setCreepLabel(getValue(remoteConfig, 'creep_label').asString() || DEFAULT_CREEP_LABEL);
      } catch (e) {
        console.warn('[Remote Config] fetch failed, using defaults:', e);
      }
    })();
  }, []);

  return (
    <RemoteConfigContext.Provider value={{ undercoverLabel, creepLabel }}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

export function useRemoteConfig() {
  return useContext(RemoteConfigContext);
}
