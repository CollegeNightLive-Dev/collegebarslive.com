import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface School {
  id: string;
  label: string;
  shortLabel: string;
  accent: string;
  lat: number;
  lng: number;
  /** Optional map zoom; tighter = more zoomed in (e.g. campus / High Street). */
  latitudeDelta?: number;
  longitudeDelta?: number;
  /** Optional city/region for geocoding (e.g. bar names). */
  city?: string;
}

const DEFAULT_MAP_DELTA = 0.018;

export const SCHOOLS: School[] = [
  { id: 'ohio-state',      label: 'Ohio State',  shortLabel: 'OSU', accent: '#ba0c2f', lat: 39.9997,  lng: -83.0130,  latitudeDelta: 0.012, longitudeDelta: 0.012, city: 'Columbus, OH' },
  { id: 'miami-oh',        label: 'Miami (OH)',  shortLabel: 'MU',  accent: '#c41230', lat: 39.5090,  lng: -84.7350,  city: 'Oxford, OH' },
  { id: 'cincinnati',      label: 'Cincinnati',  shortLabel: 'UC',  accent: '#e00122', lat: 39.1329,  lng: -84.5150,  city: 'Cincinnati, OH' },
  { id: 'purdue',          label: 'Purdue',      shortLabel: 'PU',  accent: '#ceb888', lat: 40.4259,  lng: -86.9081,  city: 'West Lafayette, IN' },
  { id: 'ohio-university', label: 'Ohio Univ.',  shortLabel: 'OU',  accent: '#2e4d30', lat: 39.3231,  lng: -82.1013, city: 'Athens, OH' },
];

export function getMapRegion(school: School) {
  return {
    latitude: school.lat,
    longitude: school.lng,
    latitudeDelta: school.latitudeDelta ?? DEFAULT_MAP_DELTA,
    longitudeDelta: school.longitudeDelta ?? DEFAULT_MAP_DELTA,
  };
}

const STORAGE_KEY = 'selected_school';

interface SchoolContextValue {
  school: School;
  setSchool: (s: School) => void;
}

const SchoolContext = createContext<SchoolContextValue>({
  school: SCHOOLS[0],
  setSchool: () => {},
});

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [school, setSchoolState] = useState<School>(SCHOOLS[0]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((id) => {
      if (id) {
        const found = SCHOOLS.find((s) => s.id === id);
        if (found) setSchoolState(found);
      }
    });
  }, []);

  const setSchool = useCallback((s: School) => {
    setSchoolState(s);
    AsyncStorage.setItem(STORAGE_KEY, s.id);
  }, []);

  return (
    <SchoolContext.Provider value={{ school, setSchool }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
