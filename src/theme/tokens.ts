import type { SafetyState } from '@safetrail/contracts';

/** Hex equivalents of the CSS-variable palette for APIs that need raw colours (maps, status bar). */
export const colors = {
  primary: '#0F766E',
  sos: '#C81E1E',
  muted: '#64748B',
  route: '#0EA5E9',
  planned: '#94A3B8',
};

/** State colours: validated for colour-vision deficiency (adjacent ΔE ≥ 8) in light and dark mode. */
export const STATE_META: Record<SafetyState, { label: string; hex: string; className: string; textClass: string; summary: string; action: string }> = {
  NORMAL: {
    label: 'Normal',
    hex: '#15803D',
    className: 'bg-state-normal',
    textClass: 'text-state-normal',
    summary: 'Everything looks as expected.',
    action: 'Monitoring continues quietly.',
  },
  DEVIATION: {
    label: 'Deviation',
    hex: '#2563EB',
    className: 'bg-state-deviation',
    textClass: 'text-state-deviation',
    summary: 'Something differs from your plan or usual pattern.',
    action: 'A gentle reminder only — no one is alerted.',
  },
  SUSPICIOUS: {
    label: 'Check-in needed',
    hex: '#CA8A04',
    className: 'bg-state-suspicious',
    textClass: 'text-state-suspicious',
    summary: 'Several readings look unusual.',
    action: 'Please confirm you are OK.',
  },
  POTENTIAL_INCIDENT: {
    label: 'Possible incident',
    hex: '#7E22CE',
    className: 'bg-state-potential',
    textClass: 'text-state-potential',
    summary: 'Strong signs you may need help.',
    action: 'Respond before the countdown ends, or contacts will be alerted.',
  },
  EMERGENCY: {
    label: 'Emergency',
    hex: '#B91C1C',
    className: 'bg-state-emergency',
    textClass: 'text-state-emergency',
    summary: 'An emergency is active.',
    action: 'Your trusted contacts are being alerted.',
  },
};

export const SIGNAL_LABEL: Record<string, string> = {
  ROUTE_DEVIATION: 'Away from planned route',
  UNFAMILIAR_AREA: 'Unfamiliar area',
  UNUSUAL_SPEED: 'Unusual speed',
  SUDDEN_SPEED_CHANGE: 'Sudden speed change',
  PROLONGED_INACTIVITY: 'No movement for a long time',
  SENSOR_EVENT: 'Device sensor event',
  NIGHT_TIME_ACTIVITY: 'Unusual time of day',
  WEATHER_WARNING: 'Weather warning',
  CONNECTIVITY_DEGRADED: 'Weak connectivity',
  SIGNAL_LOST: 'Location updates stopped',
  MISSED_CHECK_IN: 'Missed check-in',
  MODEL_ANOMALY: 'Unusual pattern (AI estimate)',
  PROMPT_UNANSWERED: 'Check-in not answered',
  USER_REQUESTED_HELP: 'You asked for help',
  MANUAL_SOS: 'Manual SOS',
};
