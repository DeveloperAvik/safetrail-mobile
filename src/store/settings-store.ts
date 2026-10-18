import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Device-local, non-sensitive preferences. */
interface SettingsState {
  onboardingSeen: boolean;
  /** Demo mode: generate synthetic movement instead of reading GPS (clearly labelled as simulated). */
  useSimulatedLocation: boolean;
  set(patch: Partial<Omit<SettingsState, 'set'>>): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({ onboardingSeen: false, useSimulatedLocation: false, set: (patch) => set(patch) }),
    { name: 'safetrail.settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
