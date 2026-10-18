import type { NetworkQuality } from '@safetrail/contracts';
import * as Network from 'expo-network';

/** Map platform network state to the coarse quality the backend understands. */
export function toQuality(state: Network.NetworkState | null | undefined): NetworkQuality {
  if (!state) return 'unknown';
  if (state.isConnected === false) return 'offline';
  if (state.isInternetReachable === false) return 'weak';
  if (state.isConnected) return 'good';
  return 'unknown';
}

export async function currentQuality(): Promise<NetworkQuality> {
  try {
    return toQuality(await Network.getNetworkStateAsync());
  } catch {
    return 'unknown';
  }
}

export function onNetworkChange(fn: (q: NetworkQuality) => void) {
  const sub = Network.addNetworkStateListener((s) => fn(toQuality(s)));
  return () => sub.remove();
}
