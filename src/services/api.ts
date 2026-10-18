import {
  authTokensResponseSchema,
  authUserSchema,
  baselineSummarySchema,
  incidentSchema,
  locationBatchResponseSchema,
  notificationSchema,
  paginated,
  profileSchema,
  safetyPromptSchema,
  safetyStateSchema,
  safetyStatusSchema,
  scenarioInfoSchema,
  scenarioRunResultSchema,
  sosResponseSchema,
  stateTransitionSchema,
  syncBatchResponseSchema,
  tripSchema,
  trustedContactSchema,
  locationSampleSchema,
  type CreateContactRequest,
  type CreateTripRequest,
  type LocationSampleInput,
  type ResolveIncidentRequest,
  type SosRequest,
  type SyncEvent,
  type TripAction,
  type UpdateConsentRequest,
  type UpdateContactRequest,
  type UpdateProfileRequest,
} from '@safetrail/contracts';
import { z } from 'zod';
import { config } from './config';
import { request } from './api-client';

/** Typed client for the SafeTrail REST API. Responses are validated against shared contracts. */
export const api = {
  auth: {
    register: (body: { email: string; password: string; displayName: string }) =>
      request('/auth/register', { method: 'POST', body: { ...body, clientType: 'mobile' }, schema: authTokensResponseSchema, auth: false }),
    login: (body: { email: string; password: string }) =>
      request('/auth/login', { method: 'POST', body: { ...body, clientType: 'mobile' }, schema: authTokensResponseSchema, auth: false }),
    refresh: (refreshToken: string) =>
      request('/auth/refresh', { method: 'POST', body: { refreshToken }, schema: authTokensResponseSchema, auth: false }),
    logout: (refreshToken: string | null) =>
      request('/auth/logout', { method: 'POST', body: refreshToken ? { refreshToken } : {}, auth: false }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request('/auth/password', { method: 'POST', body: { currentPassword, newPassword } }),
  },
  users: {
    me: () => request('/users/me', { schema: authUserSchema }),
    deleteMe: (password: string) => request('/users/me', { method: 'DELETE', body: { password, confirm: 'DELETE' } }),
  },
  profile: {
    get: () => request('/profile', { schema: profileSchema }),
    update: (body: UpdateProfileRequest) => request('/profile', { method: 'PATCH', body, schema: profileSchema }),
    consent: (body: UpdateConsentRequest) => request('/profile/consent', { method: 'PUT', body, schema: profileSchema }),
  },
  trips: {
    list: (page = 1) => request(`/trips?page=${page}&pageSize=20`, { schema: paginated(tripSchema) }),
    current: () => request('/trips/current', { schema: z.object({ trip: tripSchema.nullable() }) }),
    get: (id: string) => request(`/trips/${id}`, { schema: tripSchema }),
    create: (body: CreateTripRequest) => request('/trips', { method: 'POST', body, schema: tripSchema }),
    transition: (id: string, action: TripAction) => request(`/trips/${id}/transitions`, { method: 'POST', body: { action }, schema: tripSchema }),
    route: (id: string) => request(`/trips/${id}/route?limit=1000`, { schema: z.object({ items: z.array(locationSampleSchema) }) }),
    uploadLocations: (id: string, samples: LocationSampleInput[]) =>
      request(`/trips/${id}/locations`, { method: 'POST', body: { samples }, schema: locationBatchResponseSchema }),
    checkIn: (id: string) => request(`/trips/${id}/check-in`, { method: 'POST', schema: tripSchema }),
    transitions: (id: string) => request(`/trips/${id}/transitions`, { schema: z.object({ items: z.array(stateTransitionSchema) }) }),
  },
  safety: {
    status: () => request('/safety/status', { schema: safetyStatusSchema }),
    respond: (promptId: string, response: 'ok' | 'help') =>
      request(`/safety/prompts/${promptId}/respond`, {
        method: 'POST',
        body: { response },
        schema: z.object({ prompt: safetyPromptSchema, state: safetyStateSchema }),
      }),
  },
  baseline: {
    get: () => request('/baseline', { schema: baselineSummarySchema }),
    reset: () => request('/baseline/reset', { method: 'POST', schema: baselineSummarySchema }),
    setEnabled: (enabled: boolean) => request('/baseline/enabled', { method: 'PUT', body: { enabled }, schema: baselineSummarySchema }),
  },
  emergency: {
    sos: (body: SosRequest) =>
      request('/emergency/sos', { method: 'POST', body, schema: sosResponseSchema, timeoutMs: config.sosTimeoutMs }),
  },
  incidents: {
    list: () => request('/incidents?pageSize=50', { schema: paginated(incidentSchema) }),
    get: (id: string) => request(`/incidents/${id}`, { schema: incidentSchema }),
    resolve: (id: string, body: ResolveIncidentRequest) => request(`/incidents/${id}/resolve`, { method: 'POST', body, schema: incidentSchema }),
  },
  contacts: {
    list: () =>
      request('/contacts', {
        schema: z.object({
          items: z.array(trustedContactSchema),
          readiness: z.object({ total: z.number(), verified: z.number(), pending: z.number() }),
        }),
      }),
    create: (body: CreateContactRequest) =>
      request('/contacts', {
        method: 'POST',
        body,
        schema: z.object({ contact: trustedContactSchema, devVerification: z.object({ token: z.string(), code: z.string() }).optional() }),
      }),
    update: (id: string, body: UpdateContactRequest) => request(`/contacts/${id}`, { method: 'PATCH', body, schema: trustedContactSchema }),
    invite: (id: string) => request(`/contacts/${id}/invite`, { method: 'POST' }),
    revoke: (id: string) => request(`/contacts/${id}/revoke`, { method: 'POST', schema: trustedContactSchema }),
    remove: (id: string) => request(`/contacts/${id}`, { method: 'DELETE' }),
    /** Development convenience: accept an invitation (normally done by the contact). */
    verify: (token: string, code: string) => request('/contacts/verify', { method: 'POST', body: { token, code }, auth: false }),
  },
  notifications: {
    list: () => request('/notifications?pageSize=50', { schema: paginated(notificationSchema).extend({ unread: z.number() }) }),
    read: (id: string) => request(`/notifications/${id}/read`, { method: 'POST', schema: notificationSchema }),
  },
  sync: {
    batch: (events: SyncEvent[]) => request('/sync/batch', { method: 'POST', body: { events }, schema: syncBatchResponseSchema }),
  },
  simulation: {
    scenarios: () => request('/simulation/scenarios', { schema: z.object({ items: z.array(scenarioInfoSchema) }) }),
    run: (id: string) => request(`/simulation/scenarios/${id}/run`, { method: 'POST', body: {}, schema: scenarioRunResultSchema, timeoutMs: 60_000 }),
    seedBaseline: () => request('/simulation/baseline/seed', { method: 'POST', schema: baselineSummarySchema }),
  },
};
