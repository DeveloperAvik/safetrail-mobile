import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as React from 'react';
import { AppState } from 'react-native';
import { monitoring } from '@/features/tracking/monitoring-controller';
import { qk, useCurrentTrip, useProfile, useSafetyStatus } from '@/hooks/queries';
import { notifyPrompt } from '@/services/local-notifications';
import { offlineQueue } from '@/services/offline-queue';
import { useMonitoringStore } from '@/store/monitoring-store';
import { useSettingsStore } from '@/store/settings-store';

/**
 * Keeps device-side monitoring in sync with server state: runs location collection only while
 * a trip is active AND the user has consented and enabled monitoring; surfaces prompts.
 */
export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const trip = useCurrentTrip();
  const profile = useProfile();
  const status = useSafetyStatus();
  const useSimulatedLocation = useSettingsStore((s) => s.useSimulatedLocation);
  const lastPromptRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    monitoring.setEvaluationListener(() => void qc.invalidateQueries({ queryKey: qk.status }));
    const unsub = offlineQueue.subscribe(() => void monitoring.refreshQueueCounts());
    void monitoring.refreshQueueCounts();
    // Retry the offline queue when the app returns to the foreground.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void monitoring.syncNow();
    });
    return () => {
      unsub();
      sub.remove();
    };
  }, [qc]);

  const active = trip.data?.status === 'active';
  const allowed = Boolean(profile.data?.monitoring.monitoringEnabled && profile.data.consent.locationMonitoring);
  const tripId = trip.data?.id;
  React.useEffect(() => {
    const current = useMonitoringStore.getState();
    if (active && allowed && trip.data && profile.data) {
      if (!current.active || current.tripId !== tripId || current.source !== (useSimulatedLocation ? 'simulated' : 'device')) {
        void monitoring.start(trip.data, {
          samplingIntervalSec: profile.data.monitoring.samplingIntervalSec,
          backgroundLocation: profile.data.monitoring.backgroundLocation,
          source: useSimulatedLocation ? 'simulated' : 'device',
        });
      }
    } else if (current.active) {
      void monitoring.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, allowed, tripId, useSimulatedLocation, profile.data?.monitoring.samplingIntervalSec]);

  const prompt = status.data?.openPrompt;
  React.useEffect(() => {
    if (!prompt || prompt.id === lastPromptRef.current) return;
    lastPromptRef.current = prompt.id;
    void notifyPrompt(prompt.id, prompt.kind === 'incident_confirmation' ? 'Possible incident — respond now' : 'Are you OK?', prompt.message);
    router.push({ pathname: '/safety/prompt', params: { id: prompt.id } });
  }, [prompt]);

  return <>{children}</>;
}
