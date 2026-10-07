import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { failure, setup, signedIn } from "./test.setup";

function habit(overrides: Record<string, unknown> = {}) {
  return {
    externalId: "habit-1",
    name: "Read",
    description: "",
    recurrence: { type: "daily" },
    category: "learning",
    difficulty: "easy",
    archived: false,
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    clientId: "device-a",
    localVersion: 1,
    ...overrides,
  };
}

describe("sync", () => {
  test("pushes are rejected without a session, and pulls return nothing", async () => {
    const t = setup();
    expect(await failure(t.mutation(api.sync.pushHabits, { habits: [habit()] }))).toMatch(
      /Not authenticated/
    );
    expect(await t.query(api.sync.pullHabits, {})).toEqual([]);
  });

  test("each account only ever sees its own habits", async () => {
    const t = setup();
    const ada = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    await ada.as.mutation(api.sync.pushHabits, { habits: [habit()] });

    expect(await ada.as.query(api.sync.pullHabits, {})).toHaveLength(1);
    expect(await bo.as.query(api.sync.pullHabits, {})).toEqual([]);
    // Another account can't overwrite the habit by reusing its ID
    expect(
      await failure(bo.as.mutation(api.sync.pushHabits, { habits: [habit({ name: "Hijacked" })] }))
    ).toMatch(/another account/);
  });

  test("last write wins on habit edits, and the server wins ties", async () => {
    const t = setup();
    const ada = await signedIn(t, "Ada");
    await ada.as.mutation(api.sync.pushHabits, {
      habits: [habit({ name: "Newer", updatedAt: "2026-01-03T00:00:00.000Z" })],
    });

    await ada.as.mutation(api.sync.pushHabits, {
      habits: [habit({ name: "Stale", updatedAt: "2026-01-02T00:00:00.000Z" })],
    });
    await ada.as.mutation(api.sync.pushHabits, {
      habits: [habit({ name: "Tie", updatedAt: "2026-01-03T00:00:00.000Z" })],
    });
    expect((await ada.as.query(api.sync.pullHabits, {}))[0].name).toBe("Newer");

    await ada.as.mutation(api.sync.pushHabits, {
      habits: [habit({ name: "Latest", archived: true, updatedAt: "2026-01-04T00:00:00.000Z" })],
    });
    const [pulled] = await ada.as.query(api.sync.pullHabits, {});
    expect(pulled).toMatchObject({ name: "Latest", archived: true });
  });

  test("a pull since a cursor returns records by when the server received them", async () => {
    const t = setup();
    const ada = await signedIn(t, "Ada");
    await ada.as.mutation(api.sync.pushHabits, { habits: [habit()] });
    const cursor = await ada.as.mutation(api.sync.serverTime, {});
    expect(await ada.as.query(api.sync.pullCompletions, { since: cursor })).toEqual([]);

    // Completed offline long ago, but only reaching the server now
    await new Promise((resolve) => setTimeout(resolve, 5));
    await ada.as.mutation(api.sync.pushCompletions, {
      completions: [
        {
          externalId: "c-1",
          habitId: "habit-1",
          completedAt: "2025-12-25T08:00:00.000Z",
          xpEarned: 10,
          clientId: "device-a",
          localVersion: 1,
        },
      ],
    });
    const pulled = await ada.as.query(api.sync.pullCompletions, { since: cursor });
    expect(pulled.map((c) => c.externalId)).toEqual(["c-1"]);

    // Pushing the same completion again doesn't duplicate it
    await ada.as.mutation(api.sync.pushCompletions, {
      completions: [
        {
          externalId: "c-1",
          habitId: "habit-1",
          completedAt: "2025-12-25T08:00:00.000Z",
          xpEarned: 10,
          clientId: "device-a",
          localVersion: 1,
        },
      ],
    });
    expect(await ada.as.query(api.sync.pullCompletions, {})).toHaveLength(1);
  });

  test("account XP never goes down, and one badge of each type is kept", async () => {
    const t = setup();
    const ada = await signedIn(t, "Ada");
    const profile = { name: "Ada", characterName: "Ada", characterClass: "mage" };
    await ada.as.mutation(api.sync.pushUserProfile, { ...profile, xp: 500, level: 2 });
    await ada.as.mutation(api.sync.pushUserProfile, { ...profile, xp: 120, level: 1 });
    expect(await ada.as.query(api.users.currentUser, {})).toMatchObject({ xp: 500, level: 2 });

    const badge = { badgeType: "first_step", earnedAt: "2026-01-01T00:00:00.000Z" };
    await ada.as.mutation(api.sync.pushBadges, { badges: [{ externalId: "b-1", ...badge }] });
    await ada.as.mutation(api.sync.pushBadges, { badges: [{ externalId: "b-2", ...badge }] });
    expect(await ada.as.query(api.sync.pullBadges, {})).toHaveLength(1);
  });
});
