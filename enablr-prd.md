# Enablr — Product Requirements Document
**Version 2.0 | Mobile App (React Native)**

---

## Overview

Enablr is an RPG task tracker for mobile. Personal habits and guild tasks sit side by side: users build habits on their own, join guilds to take on shared tasks, earn XP, level up a character, and unlock badges. Personal habits are offline-first and work seamlessly without internet access, syncing automatically whenever connectivity is restored. Guilds are the social layer: public, searchable groups with custom roles, their own uploaded emblem, a task board, and a separate XP and level counter for every member.

The core thesis: habit apps fail because they feel like chores. By giving streaks and completions a sense of narrative weight (you're not just "logging water intake," you're earning 40 XP for your Mage's stamina tree), Enablr makes the act of showing up feel meaningful. Guilds add the second half of that thesis: showing up matters more when other people are counting on it, and when your rank in the guild is something you earned there.

---

## Goals

- Demonstrate mobile-native engineering competence: offline storage, conflict resolution, push/local notifications, sync
- Demonstrate multi-user product engineering: role-based permissions, server-authoritative rewards, media upload and review
- Ship a polished, demo-ready product that showcases strong UI/UX judgment
- Serve as a portfolio centerpiece showing full product + engineering ownership

---

## MVP Scope

The MVP is intentionally narrow. Ship these nine features fully, not eighteen features partially.

1. Authentication (sign-up, login, OAuth)
2. Habit creation and editing
3. Offline-first local storage with SQLite
4. Cloud sync with conflict resolution
5. RPG progression: XP, leveling, badges (account-wide and per-guild)
6. Push and local notifications
7. Guilds: creation, discovery, request-to-join, custom roles, guild emblem upload
8. Guild tasks: task board, assignment, per-task reward mode
9. Proof video: optional per-task video evidence with review

---

## Feature Specifications

### 1. Authentication

Users can create an account with email/password or sign in via Google/Apple OAuth. Convex Auth handles sessions and token management; tokens are stored in the device's secure store. On first launch, users are prompted to name their RPG character and choose a class (Warrior, Mage, Rogue — purely cosmetic at MVP). Auth state persists locally so the app opens instantly even offline; the token is refreshed when connectivity returns.

Every server function derives the caller's identity from the authenticated session. A user ID passed as an argument from the client is never trusted. Local data is keyed by the real account ID, so two accounts on the same device never see each other's habits, XP, or guilds.

**Out of scope for MVP:** password reset flow, social profiles, account deletion.

---

### 2. Habit Management

Each habit has: a name (required), an optional description, a recurrence (daily, specific days of week, or custom interval), a category (health, learning, mindfulness, productivity, or custom), and a difficulty rating (Easy / Medium / Hard, which maps to XP payout). Users can mark a habit complete by tapping a check button on the home screen; this writes to local storage immediately with a timestamp and triggers an XP calculation.

Editing a habit should not retroactively alter streak history. Deleting a habit soft-deletes it (`archived = true`) so historical completions are preserved for stats but the habit no longer appears in the active list.

Home screen shows today's habits sorted by: incomplete first, then by scheduled time if set, then alphabetically. Completed habits move to a collapsible "done" section. Active habits that are not due today appear in a collapsible "Not due today" section showing when each is next due, so every habit can always be found and edited.

Personal habits and guild tasks appear alongside each other on the home screen. Below today's habits, a "Guild Tasks" section lists every open task assigned to the user across all their guilds, grouped by guild (guild emblem and name as the group header), sorted by due date. Each row is visibly tagged with its guild so it is never mistaken for a personal habit. Habits feed the account level; guild tasks feed that guild's level (see section 5).

---

### 3. Offline-First Storage

All personal data lives locally first. Use SQLite (via `expo-sqlite`) for structured relational data.

**Schema (simplified):**

| Table | Key Fields |
|---|---|
| `users` | id, name, character_name, character_class, xp, level, created_at |
| `habits` | id, user_id, name, description, recurrence, category, difficulty, archived, created_at, updated_at |
| `completions` | id, habit_id, completed_at, xp_earned, synced (boolean), local_version |
| `badges` | id, user_id, badge_type, earned_at, synced |
| `guilds` | id, name, description, emblem_file_id, owner_id, member_count, created_at, updated_at |
| `guild_roles` | id, guild_id, name, color, icon_file_id, position, permissions, is_system |
| `guild_members` | id, guild_id, user_id, role_id, xp, level, joined_at |
| `guild_join_requests` | id, guild_id, user_id, message, status (pending / approved / denied), decided_by, created_at |
| `guild_tasks` | id, guild_id, created_by, name, description, difficulty, recurrence, due_at, assignment (everyone / role / members), reward_mode (on_submission / on_review), proof_video_required, archived, updated_at |
| `guild_task_submissions` | id, task_id, guild_id, user_id, status (pending_upload / pending_review / approved / rejected / revoked), video_file_id, local_video_uri, xp_awarded, reviewed_by, review_note, submitted_at |

Write locally first on every personal action. The `synced` flag on completions and badges tracks what still needs to be pushed to the server. The app must be fully functional — creating habits, logging completions, earning XP — with zero network access.

Guild tables are the exception to local-first. The server is the source of truth for them; the local copies are a read cache so guild screens and the home screen's guild task section render instantly and stay readable offline. The only guild write allowed offline is a task submission, which is stored locally (including the recorded video's file path) and sent when connectivity returns. Role changes, join decisions, and reviews require a connection.

---

### 4. Sync and Conflict Resolution

When the device comes online (detected via NetInfo), Enablr runs a sync job that:

1. Pushes all unsynced local records (completions, habit changes) to the server
2. Pulls any server-side changes (e.g., user edited habits on another device)
3. Resolves conflicts

**Conflict resolution strategy:** last-write-wins on habit edits (compare `updated_at` timestamps, server wins ties). Completions are append-only — you cannot "un-complete" a habit retroactively, so conflicts here are rare. If a habit was deleted on the server but has local completions, preserve the habit as archived and surface a toast explaining the sync.

**Sync runs:** on app foreground, on network reconnection, and on a background interval if the OS permits (every 15 minutes). Show a subtle sync status indicator (spinner or last-synced timestamp) in the settings screen; do not block the UI for sync.

**Guild data** does not use the push/pull queue. While online, guild screens use live Convex subscriptions, so a role change, an approved join request, or a review result appears without a manual refresh; each update is also written to the local cache. There is no client-side conflict resolution for guild data: the server validates every write against the caller's role permissions and rejects anything stale or unauthorised.

**Queued submissions:** a guild task submitted offline is pushed on the next sync. If it carries a proof video, the upload runs in the background with progress shown on the task row, resumes after interruption, and retries with backoff. The submission stays in `pending_upload` until the server confirms the file; nothing is awarded before that.

**Backend:** Convex (database, server functions, file storage, scheduled jobs).

---

### 5. RPG Progression

Every account has two kinds of progression, and they never mix:

- **Account level** — one XP total and level per account, earned from personal habits. This is the character level shown on the profile.
- **Guild level** — a separate XP total and level for each guild the account belongs to, earned only from that guild's tasks. A member who is Level 12 in one guild starts at Level 1 in the next. Guild XP is stored on the membership record, awarded by the server, and never calculated on the client.

**XP payouts per completion:**

| Difficulty | Base XP | 3-day streak | 7-day streak | 30-day streak |
|---|---|---|---|---|
| Easy | 10 XP | +10% | +25% | +50% |
| Medium | 25 XP | +10% | +25% | +50% |
| Hard | 50 XP | +10% | +25% | +50% |

The same base XP table applies to guild tasks. Streak bonuses apply to personal habits and to recurring guild tasks; one-off guild tasks pay base XP only.

Level thresholds follow a simple quadratic curve (Level N requires N² × 100 XP total). Cap MVP at Level 20. Account level and guild levels use the same curve and cap.

On level-up, show a full-screen celebratory animation (Lottie or React Native Reanimated). Display current level, XP bar toward next level, and character class on the profile screen. The profile also lists each guild the user belongs to with their role, guild level, and XP bar for that guild. A guild level-up shows the same celebration, labelled with the guild's name and emblem.

Leaving or being removed from a guild freezes that membership's XP; rejoining the same guild restores it.

**MVP badge set:**

| Badge | Trigger |
|---|---|
| First Step | Complete any habit for the first time |
| Consistent | Complete the same habit 7 days in a row |
| Dedicated | Complete the same habit 30 days in a row |
| Collector | Have 5 active habits simultaneously |
| Overachiever | Complete all habits in a single day |
| Veteran | Reach Level 10 |
| Sworn In | Join a guild for the first time |
| Founder | Create a guild |
| On Camera | Have a proof video approved |
| Guild Veteran | Reach Level 10 in any guild |

When a badge is earned, show a toast notification and animate the badge into the collection screen. Habit badges are evaluated locally; no server round-trip required. Guild badges are granted by the server when the triggering event is recorded.

---

### 6. Notifications

**Local notifications:** scheduled at habit creation or edit. If a habit has a scheduled time, use Expo Notifications to fire a local alert at that time on the days the habit recurs. These work entirely offline. Message format: *"Time to [habit name] — keep your streak going."*

**Push notifications:** sent through the Expo Push Service from Convex scheduled functions and mutations. Triggers:
- Streak at risk (user hasn't completed a habit 2 hours before midnight)
- Weekly summary (Sunday evening: "You completed X habits this week, earning Y XP")
- Join request received (sent to members whose role can manage join requests)
- Join request approved or denied (sent to the requester)
- Guild task assigned to you
- Submission awaiting review (sent to members whose role can review)
- Submission approved, rejected, or revoked (sent to the submitter, with XP earned or the reviewer's note)

Push requires network; gracefully degrade if offline. Notification permission is requested after the user creates their first habit or joins their first guild, whichever comes first, not on app launch. Provide a settings toggle to disable per-habit reminders and a per-guild mute.

---

### 7. Guilds

A guild is a public group with its own identity, roles, task board, and member progression. A user can belong to up to 10 guilds and own up to 3.

**Identity.** Each guild has a name (required, unique, 3–32 characters), a description (required, up to 500 characters), and an uploaded guild emblem: one square image used everywhere the guild appears (search results, task rows, the guild page header). The emblem is picked from the gallery or camera, cropped in-app, resized on device to 1024 px (2 MB cap), and stored in Convex File Storage; smaller sizes are scaled from it. A guild without an upload gets a generated emblem from its initials and a colour.

**Discovery and joining.** All guilds are public and searchable by name. The public guild page shows the emblem, name, description, member count, and the guild's staff (see member list privacy below) — nothing else. Joining is by request: the user taps "Request to Join", optionally adds a short message, and waits. A member whose role has the *Manage join requests* permission approves or denies it. A user may have one pending request per guild; a denied user may request again after 7 days.

**Member list privacy.** The full member list is visible to members only. Every member of a guild can see who else is in it, along with each member's role, guild level, and join date. Non-members see only the guild's staff — the Owner and everyone holding the Admin or Mod role — shown by name and role on the public guild page, so a prospective member knows who runs the guild; holders of the Member role or of any custom role are never shown to non-members. The server enforces this: the member query returns the full list to members and the staff-only list to everyone else.

**Roles.** Every guild starts with four system roles. Owner and Member cannot be deleted or renamed; Admin and Mod can be edited.

| Permission | Owner | Admin | Mod | Member |
|---|---|---|---|---|
| Edit guild profile (name, description, emblem) | Yes | Yes | No | No |
| Create, edit, delete roles | Yes | Yes | No | No |
| Assign roles to members | Yes | Yes | No | No |
| Manage join requests | Yes | Yes | Yes | No |
| Remove members | Yes | Yes | Yes | No |
| Create and edit tasks | Yes | Yes | Yes | No |
| Review submissions | Yes | Yes | Yes | No |
| Complete tasks | Yes | Yes | Yes | Yes |
| Transfer ownership, delete guild | Yes | No | No | No |

**Custom roles.** Members with the *Create, edit, delete roles* permission can create up to 20 custom roles per guild. A custom role has a name, a colour, an optional uploaded icon (256 px), a position in the role order, and its own on/off setting for each permission in the table above except ownership transfer and guild deletion. Each member holds exactly one role. Roles are ordered, and the order is a hard limit: a member can only assign, edit, or remove roles and members ranked below their own, and can never grant a permission they do not hold themselves.

**Leaving and deletion.** Any member can leave. The Owner must transfer ownership before leaving. Deleting a guild removes its tasks, submissions, and uploaded files after a 7-day grace period during which the Owner can restore it.

**Safety.** Any user can report a guild, and any reviewer can report a proof video, for abusive content. Reported items are hidden pending review and logged for the app operator.

---

### 8. Guild Tasks

Guild tasks live on a task board inside each guild and are created by members whose role has the *Create and edit tasks* permission.

Each task has: a name (required), an optional description, a difficulty (Easy / Medium / Hard, mapped to the XP table in section 5), a type (one-off with an optional due date, or recurring using the same recurrence options as habits), and an assignment (everyone in the guild, everyone holding a given role, or specific members).

Two settings are chosen when the task is created:

- **Reward mode** — *On submission*: the member receives guild XP the moment the server accepts their submission. *On review*: the submission waits in a review queue and XP is awarded only when a reviewer approves it.
- **Proof video** — off by default. When on, the member must attach a video to submit (see section 9).

The two settings are independent, giving four combinations: instant reward with no proof, instant reward once a video is uploaded, reviewed with no video (a reviewer confirms the work was done), and reviewed with video.

**Submission states:** `pending_upload` → `pending_review` → `approved` or `rejected`. Tasks set to reward on submission skip straight to `approved`. A rejected submission carries a required note from the reviewer and can be resubmitted. A reviewer can revoke an approved submission within 7 days, which removes the XP it awarded and moves it to `revoked`; this is the check on instant-reward tasks.

A member can submit each one-off task once, and each recurring task once per scheduled occurrence. Reviewers cannot review their own submissions. Editing a task's difficulty, reward mode, or proof setting applies to future submissions only. Archiving a task removes it from the board and keeps its submission history.

The review queue is a tab on the guild page, visible to members with the *Review submissions* permission, sorted oldest first, with a badge count on the guild's tab icon.

---

### 9. Proof Video

When a task has proof video turned on, tapping complete opens a capture sheet: record with the camera or choose an existing video from the gallery. The member previews the clip, can retake it, and then submits.

**Limits:** 60 seconds maximum, compressed on device to 720p before upload, 50 MB maximum after compression. Clips over the limit are rejected before upload with a message saying how much to trim.

**Upload:** the video is written to app storage first, then uploaded to Convex File Storage through a short-lived upload URL issued to the authenticated member for that specific task. Upload runs in the background with a progress bar on the task row and resumes if interrupted. If the device is offline the submission is queued (see section 4).

**Who can watch:** only the member who submitted it and members of that guild whose role has the *Review submissions* permission. Videos are streamed through signed, expiring URLs issued per viewing; there is no public link and no share button.

**Review screen:** the reviewer sees the task, the submitter's name, the submission time, and the video player, with Approve and Reject actions. Reject requires a note.

**Retention:** the video file is deleted 30 days after the submission is approved, rejected, or revoked; the submission record and its outcome are kept. A member can delete their own video while it is still pending review, which withdraws the submission.

Camera and microphone permission is requested the first time a member opens the capture sheet, not before.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native with Expo (prebuild / development builds) |
| Local storage | SQLite via `expo-sqlite` |
| Auth | Convex Auth (email/password + Google OAuth + Apple Sign-In), tokens in `expo-secure-store` |
| Sync backend | Convex (database, queries, mutations, scheduled functions) |
| File storage | Convex File Storage (guild emblems, role icons, proof videos) |
| Media capture | `expo-image-picker` (image and video pick/record), `expo-image-manipulator` (crop/resize), `react-native-compressor` (video compression), `expo-video` (playback), `expo-file-system` (background upload) |
| Notifications | Expo Notifications (local) + Expo Push Service (push). Android delivery uses FCM credentials as the transport only; no Firebase SDK or other Firebase service is used |
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
- Guild screens render from the local cache in under 300ms and update in place when live data arrives
- Video upload never blocks the UI, survives the app being backgrounded, and resumes after a dropped connection
- Every guild read and write is authorised on the server against the caller's role; the client hiding a button is never the only check
- Guild XP cannot be changed by any client-supplied value

---

## Architecture Notes

Adopt a local-first architecture where the SQLite database is the source of truth for the UI of personal data. The sync layer is a background service, never a blocker. A simple Zustand slice manages the sync queue. Never show a loading spinner for data the user has already seen; rely on the local cache and update in place.

For conflict resolution, stamp every write with a `local_version` (incrementing integer) and a `client_id` (UUID generated at install). The server stores both and uses them to detect stale pushes.

Guild data inverts this: Convex is the source of truth and SQLite is a cache. All guild mutations go through a single permission helper that loads the caller's membership and role from the authenticated session and checks the required permission and role order before doing anything. Guild XP is written only inside the server mutations that accept or approve a submission, and the award and the status change happen in the same transaction so a retry can never pay twice.

Uploads use Convex's three-step flow: a mutation issues an upload URL after checking the caller may submit that task, the client posts the file, and a second mutation attaches the returned storage ID to the submission. A daily scheduled function deletes expired proof videos and files belonging to deleted guilds.

---

## UI/UX Principles

The app should feel like a premium consumer product, not a productivity tool.

- **Dark mode first** (the RPG aesthetic earns it), with a clean light mode
- **Micro-interactions** on every state change (habit checked off, XP earned, streak extended)
- The XP animation should feel rewarding, not clinical — use a brief particle burst or glow effect
- **Empty states are opportunities:** no habits yet should show the character asking *"What shall we conquer today?"*; no guild yet should invite the user to *"Find your banner"*
- **Error states** must never be raw JSON or generic "Something went wrong" — every error has a friendly message and a clear recovery action
- **Guild identity is always visible:** anything belonging to a guild carries its emblem, and a member's role is shown as a coloured chip with the role's icon
- **Waiting is a state, not a dead end:** a pending join request, an uploading video, and a submission awaiting review each show what is happening and what comes next

---

## Out of Scope for MVP

Friends lists, guild and global leaderboards, guild chat and comments, guild-vs-guild competition, private or invite-only guilds, multiple roles per member, automated video moderation, habit templates library, calendar/history heatmap view, Apple Watch / widget support, multiple characters, paid tiers, habit dependencies, gamified quests or story arcs. Build these only after the MVP ships and is validated.

---

## Testing Strategy

| Type | Coverage |
|---|---|
| Unit | XP calculation, streak calculation, conflict resolution algorithm, badge evaluation, role permission and role-order checks, submission state transitions |
| Integration | SQLite write/read round-trips, sync queue processing, notification scheduling, Convex function tests for guild authorisation (non-member, member, mod, admin, owner against every guild function), XP award idempotency, member list privacy (member sees everyone, non-member sees staff only) |
| E2E (Detox) | Sign up → create habit → complete habit → verify XP update; create guild → second account requests to join → approve → assign task with proof video → submit → approve → verify guild XP |

**CI pipeline (GitHub Actions):** lint on PR, unit + integration tests on PR, E2E on merge to main, EAS Build to generate a preview build on merge to main.

---

## Demo Tips

Film the walkthrough in this order:

1. Enable airplane mode → create a habit → complete it → watch the XP animation. Everything works.
2. Re-enable WiFi → watch the sync indicator resolve and the server confirm the completion.
3. Show the badge unlock and level-up flow.
4. Create a guild, upload its emblem, and add a custom role with its own colour and icon.
5. On a second account, search for the guild and request to join; approve the request from the first.
6. Create a guild task with proof video on and reward on review → record and submit the video on the second account → approve it on the first → watch the guild level bar move while the account level stays put.

Steps 1–3 demonstrate what is technically interesting about the offline side in under 90 seconds; steps 4–6 do the same for guilds in about two minutes.

---

## Success Criteria for Portfolio

The MVP is complete when a new user can sign up, create 3 habits, complete them offline on airplane mode, re-enable WiFi and see them sync, earn at least one badge, and level up their character; and when that user can create a guild with a custom role and uploaded emblem, approve a second user's join request, assign a task that requires a proof video, and approve the submitted video so the second user gains XP in that guild only — all without encountering an error state, a loading spinner, or a UI that feels unpolished.

---

## Resume Bullet

> Built an offline-first RPG task tracker (React Native, SQLite, Convex) with automatic cloud sync and conflict resolution, public guilds with custom role-based permissions and per-guild progression, video proof-of-completion with a review workflow, and push notifications; shipped with a full CI pipeline and Detox E2E tests.
