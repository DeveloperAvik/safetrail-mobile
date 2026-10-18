# SafeTrail mobile app

Expo SDK 58 · Expo Router · React Native Reusables (shadcn-style components) + NativeWind ·
TanStack Query · Zustand · React Hook Form + Zod · SecureStore · Location · Network · Notifications ·
TaskManager · react-native-maps.

```bash
cp .env.example .env          # EXPO_PUBLIC_API_URL for devices/emulators
npm run start                 # Expo (from this folder) — or `npm run dev:mobile` from the root
npm test                      # Jest
npm run typecheck
npm run export:check          # Metro production bundle check
```

Routes live in `app/` (auth, tabs, trips, safety, emergency, contacts, settings); logic in `src/`
(`services` — API client, offline queue, secure storage, background task; `features` — sampler,
monitoring controller, SOS; `store`; `components`; `theme`). See ../../docs/deployment.md for
Expo Go vs development builds and iOS/Android background-location differences.
