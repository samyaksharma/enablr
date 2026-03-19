# Enablr — Product Requirements Document
**Version 1.0 | Mobile App (React Native)**

---

## Overview

Enablr is an offline-first habit-tracking mobile app that wraps daily routines in lightweight RPG progression mechanics. Users build habits, earn XP, level up a character, and unlock badges — all of which works seamlessly without internet access, syncing automatically whenever connectivity is restored.

The core thesis: habit apps fail because they feel like chores. By giving streaks and completions a sense of narrative weight (you're not just "logging water intake," you're earning 40 XP for your Mage's stamina tree), Enablr makes the act of showing up feel meaningful.

---

## Goals

- Demonstrate mobile-native engineering competence: offline storage, conflict resolution, push/local notifications, sync
- Ship a polished, demo-ready product that showcases strong UI/UX judgment
- Serve as a portfolio centerpiece showing full product + engineering ownership

---

## MVP Scope

The MVP is intentionally narrow. Ship these six features fully, not twelve features partially.

1. Authentication (sign-up, login, OAuth)
2. Habit creation and editing
3. Offline-first local storage with SQLite or Realm
4. Cloud sync with conflict resolution
5. RPG progression: XP, leveling, badges
6. Push and local notifications

---

## Feature Specifications

### 1. Authentication

Users can create an account with email/password or sign in via Google/Apple OAuth. Firebase Auth handles token management. On first launch, users are prompted to name their RPG character and choose a class (Warrior, Mage, Rogue — purely cosmetic at MVP). Auth state persists locally so the app opens instantly even offline; the token is refreshed when connectivity returns.

**Out of scope for MVP:** password reset flow (use Firebase's default email), social profiles, account deletion.

---

### 2. Habit Management

Each habit has: a name (required), an optional description, a recurrence (daily, specific days of week, or custom interval), a category (health, learning, mindfulness, productivity, or custom), and a difficulty rating (Easy / Medium / Hard, which maps to XP payout). Users can mark a habit complete by tapping a check button on the home screen; this writes to local storage immediately with a timestamp and triggers an XP calculation.

Editing a habit should not retroactively alter streak history. Deleting a habit soft-deletes it (`archived = true`) so historical completions are preserved for stats but the habit no longer appears in the active list.

Home screen shows today's habits sorted by: incomplete first, then by scheduled time if set, then alphabetically. Completed habits move to a collapsible "done" section.

---

### 3. Offline-First Storage

All user data lives locally first. Use SQLite (via `expo-sqlite` or `react-native-sqlite-storage`) for structured relational data, or Realm if the team prefers an object-oriented approach.

**Schema (simplified):**

| Table | Key Fields |
|---|---|
| `users` | id, name, character_name, character_class, xp, level, created_at |
| `habits` | id, user_id, name, description, recurrence, category, difficulty, archived, created_at, updated_at |
| `completions` | id, habit_id, completed_at, xp_earned, synced (boolean), local_version |
| `badges` | id, user_id, badge_type, earned_at, synced |

Write locally first on every action. The `synced` flag on completions and badges tracks what still needs to be pushed to the server. The app must be fully functional — creating habits, logging completions, earning XP — with zero network access.

---

### 4. Sync and Conflict Resolution

When the device comes online (detected via NetInfo), Enablr runs a sync job that:

1. Pushes all unsynced local records (completions, habit changes) to the server
2. Pulls any server-side changes (e.g., user edited habits on another device)
3. Resolves conflicts

**Conflict resolution strategy:** last-write-wins on habit edits (compare `updated_at` timestamps, server wins ties). Completions are append-only — you cannot "un-complete" a habit retroactively, so conflicts here are rare. If a habit was deleted on the server but has local completions, preserve the habit as archived and surface a toast explaining the sync.

**Sync runs:** on app foreground, on network reconnection, and on a background interval if the OS permits (every 15 minutes). Show a subtle sync status indicator (spinner or last-synced timestamp) in the settings screen; do not block the UI for sync.

**Backend:** Firebase Firestore for simplicity, or Hasura/GraphQL if the team wants more query flexibility.

---

### 5. RPG Progression

**XP payouts per completion:**

| Difficulty | Base XP | 3-day streak | 7-day streak | 30-day streak |
|---|---|---|---|---|
| Easy | 10 XP | +10% | +25% | +50% |
| Medium | 25 XP | +10% | +25% | +50% |
| Hard | 50 XP | +10% | +25% | +50% |

Level thresholds follow a simple quadratic curve (Level N requires N² × 100 XP total). Cap MVP at Level 20.

On level-up, show a full-screen celebratory animation (Lottie or React Native Reanimated). Display current level, XP bar toward next level, and character class on the profile screen.

**MVP badge set:**

| Badge | Trigger |
|---|---|
| First Step | Complete any habit for the first time |
| Consistent | Complete the same habit 7 days in a row |
| Dedicated | Complete the same habit 30 days in a row |
| Collector | Have 5 active habits simultaneously |
| Overachiever | Complete all habits in a single day |
| Veteran | Reach Level 10 |

When a badge is earned, show a toast notification and animate the badge into the collection screen. Badge earning is evaluated locally; no server round-trip required.

---

### 6. Notifications

**Local notifications:** scheduled at habit creation or edit. If a habit has a scheduled time, use `react-native-push-notification` or Expo Notifications to fire a local alert at that time daily. These work entirely offline. Message format: *"Time to [habit name] — keep your streak going."*

**Push notifications:** Firebase Cloud Messaging for re-engagement. Triggers:
- Streak at risk (user hasn't completed a habit 2 hours before midnight)
- Weekly summary (Sunday evening: "You completed X habits this week, earning Y XP")

Push requires network; gracefully degrade if offline. Notification permission is requested after the user creates their first habit, not on app launch. Provide a settings toggle to disable per-habit reminders.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native (bare workflow or Expo managed) |
| Local storage | SQLite via `expo-sqlite`, or Realm |
| Auth | Firebase Authentication (email/password + Google OAuth + Apple Sign-In) |
| Sync backend | Firebase Firestore (default) or Hasura with PostgreSQL |
| Notifications | Expo Notifications (local) + Firebase Cloud Messaging (push) |
| State management | Zustand |
| Animations | React Native Reanimated + Lottie |
| Navigation | React Navigation (bottom tab + stack) |
| CI/CD | GitHub Actions + EAS Build |

---

## Non-Functional Requirements

- Cold start time under 2 seconds
- Habit completion interaction (tap to complete, see XP animation) under 100ms perceived latency — local write is instant, sync is async
- App must pass all habit operations in airplane mode without errors or loading states
- Sync must not block the main thread

---

## Architecture Notes

Adopt a local-first architecture where the SQLite/Realm database is the source of truth for the UI. The sync layer is a background service, never a blocker. React Query or a simple Zustand slice manages the sync queue. Never show a loading spinner for data the user has already seen; rely on the local cache and update in place.

For conflict resolution, stamp every write with a `local_version` (incrementing integer) and a `client_id` (UUID generated at install). The server stores both and uses them to detect stale pushes.

---

## UI/UX Principles

The app should feel like a premium consumer product, not a productivity tool.

- **Dark mode first** (the RPG aesthetic earns it), with a clean light mode
- **Micro-interactions** on every state change (habit checked off, XP earned, streak extended)
- The XP animation should feel rewarding, not clinical — use a brief particle burst or glow effect
- **Empty states are opportunities:** no habits yet should show the character asking *"What shall we conquer today?"*
- **Error states** must never be raw JSON or generic "Something went wrong" — every error has a friendly message and a clear recovery action

---

## Out of Scope for MVP

Social features (friends, leaderboards), habit templates library, calendar/history heatmap view, Apple Watch / widget support, multiple characters, paid tiers, habit dependencies, gamified quests or story arcs. Build these only after the MVP ships and is validated.

---

## Testing Strategy

| Type | Coverage |
|---|---|
| Unit | XP calculation, streak calculation, conflict resolution algorithm, badge evaluation |
| Integration | SQLite write/read round-trips, sync queue processing, notification scheduling |
| E2E (Detox) | Sign up → create habit → complete habit → verify XP update |

**CI pipeline (GitHub Actions):** lint on PR, unit + integration tests on PR, E2E on merge to main, EAS Build to generate a preview build on merge to main.

---

## Demo Tips

Film the walkthrough in this order:

1. Enable airplane mode → create a habit → complete it → watch the XP animation. Everything works.
2. Re-enable WiFi → watch the sync indicator resolve and the server confirm the completion.
3. Show the badge unlock and level-up flow.

This sequence demonstrates exactly what's technically interesting about the app in under 90 seconds.

---

## Success Criteria for Portfolio

The MVP is complete when a new user can sign up, create 3 habits, complete them offline on airplane mode, re-enable WiFi and see them sync, earn at least one badge, and level up their character — all without encountering an error state, a loading spinner, or a UI that feels unpolished.

---

## Resume Bullet

> Built an offline-first habit RPG mobile app (React Native, SQLite) with automatic cloud sync, conflict resolution, RPG progression mechanics, and push notifications; shipped with a full CI pipeline and Detox E2E tests.
