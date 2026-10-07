import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { failure, setup, signedIn } from "./test.setup";

type T = ReturnType<typeof setup>;
type Client = Awaited<ReturnType<typeof signedIn>>;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
});

async function foundGuild(owner: Client, name = "Dawn Runners") {
  return await owner.as.mutation(api.guilds.create, { name, description: "We run at dawn." });
}

// Sends a join request and has `approver` accept it.
async function join(guildId: Id<"guilds">, joiner: Client, approver: Client) {
  await joiner.as.mutation(api.guilds.requestJoin, { guildId, message: "" });
  const requests = await approver.as.query(api.guilds.requests, { guildId });
  const request = requests[requests.length - 1];
  await approver.as.mutation(api.guilds.decideRequest, { requestId: request._id, approve: true });
}

async function roleNamed(t: T, guildId: Id<"guilds">, name: string) {
  const role = await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("guildRoles")
      .withIndex("by_guild", (q) => q.eq("guildId", guildId))
      .collect();
    return roles.find((r) => r.name === name);
  });
  if (!role) throw new Error(`No role named ${name}`);
  return role;
}

async function guildXp(t: T, guildId: Id<"guilds">, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const member = await ctx.db
      .query("guildMembers")
      .withIndex("by_guild_user", (q) => q.eq("guildId", guildId).eq("userId", userId))
      .first();
    return member ? { xp: member.xp, level: member.level, leftAt: member.leftAt } : null;
  });
}

const oneOff = {
  name: "Clean the hall",
  description: "",
  difficulty: "medium",
  recurrence: null,
  assignment: { type: "everyone" as const },
  rewardMode: "on_submission" as const,
  proofVideoRequired: false,
};

describe("identity", () => {
  test("guild functions reject callers who are not signed in", async () => {
    const t = setup();
    expect(
      await failure(t.mutation(api.guilds.create, { name: "Nobody", description: "x" }))
    ).toMatch(/Not authenticated/);
    expect(await t.query(api.guilds.myGuilds, {})).toEqual({ guilds: [], pending: [], deleted: [] });
  });
});

describe("creating and finding guilds", () => {
  test("founding a guild makes the founder Owner with the four built-in roles", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const guildId = await foundGuild(owner);

    const overview = await owner.as.query(api.guilds.overview, { guildId });
    expect(overview?.membership?.system).toBe("owner");
    expect(overview?.memberCount).toBe(1);

    const roles = await owner.as.query(api.guildRoles.list, { guildId });
    expect(roles.map((r) => r.name)).toEqual(["Owner", "Admin", "Mod", "Member"]);

    const badges = await owner.as.query(api.sync.pullBadges, {});
    expect(badges.map((b) => b.badgeType)).toContain("founder");
  });

  test("names must be unique and a user can own at most three guilds", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    await foundGuild(owner, "First");
    expect(await failure(foundGuild(owner, "first"))).toMatch(/already exists/);
    await foundGuild(owner, "Second");
    await foundGuild(owner, "Third");
    expect(await failure(foundGuild(owner, "Fourth"))).toMatch(/own up to 3/);
  });

  test("search finds guilds by name and hides deleted ones", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const stranger = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner, "Iron Circle");

    expect((await stranger.as.query(api.guilds.search, { text: "iron" })).map((g) => g.name)).toEqual([
      "Iron Circle",
    ]);
    await owner.as.mutation(api.guilds.deleteGuild, { guildId });
    expect(await stranger.as.query(api.guilds.search, { text: "iron" })).toEqual([]);
    expect(await stranger.as.query(api.guilds.overview, { guildId })).toBeNull();

    await owner.as.mutation(api.guilds.restoreGuild, { guildId });
    expect(await stranger.as.query(api.guilds.search, { text: "iron" })).toHaveLength(1);
  });
});

describe("joining and member list privacy", () => {
  test("joining is by request and needs someone with the permission to approve", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const cy = await signedIn(t, "Cy");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);

    await cy.as.mutation(api.guilds.requestJoin, { guildId, message: "Let me in" });
    expect(await failure(cy.as.mutation(api.guilds.requestJoin, { guildId, message: "" }))).toMatch(
      /already have a request/
    );

    // A regular member can neither see nor decide requests
    expect(await bo.as.query(api.guilds.requests, { guildId })).toEqual([]);
    const [request] = await owner.as.query(api.guilds.requests, { guildId });
    expect(
      await failure(bo.as.mutation(api.guilds.decideRequest, { requestId: request._id, approve: true }))
    ).toMatch(/role doesn't allow/);

    await owner.as.mutation(api.guilds.decideRequest, { requestId: request._id, approve: true });
    const overview = await cy.as.query(api.guilds.overview, { guildId });
    expect(overview?.membership?.roleName).toBe("Member");
    expect(overview?.memberCount).toBe(3);
    expect((await cy.as.query(api.sync.pullBadges, {})).map((b) => b.badgeType)).toContain("sworn_in");
  });

  test("a declined request can't be repeated for a week", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);

    await bo.as.mutation(api.guilds.requestJoin, { guildId, message: "" });
    const [request] = await owner.as.query(api.guilds.requests, { guildId });
    await owner.as.mutation(api.guilds.decideRequest, { requestId: request._id, approve: false });

    expect(await failure(bo.as.mutation(api.guilds.requestJoin, { guildId, message: "" }))).toMatch(
      /declined/
    );
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
    await bo.as.mutation(api.guilds.requestJoin, { guildId, message: "" });
  });

  test("members see the full roster; non-members see only the staff", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const cy = await signedIn(t, "Cy");
    const stranger = await signedIn(t, "Dee");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    await join(guildId, cy, owner);
    const mod = await roleNamed(t, guildId, "Mod");
    await owner.as.mutation(api.guildRoles.assign, { guildId, userId: bo.userId, roleId: mod._id });

    const forMember = await cy.as.query(api.guilds.members, { guildId });
    expect(forMember.scope).toBe("full");
    expect(forMember.members.map((m) => m.name)).toEqual(["Ada", "Bo", "Cy"]);
    expect(forMember.members[0].level).toBe(1);

    const forStranger = await stranger.as.query(api.guilds.members, { guildId });
    expect(forStranger.scope).toBe("staff");
    expect(forStranger.members.map((m) => m.name)).toEqual(["Ada", "Bo"]);
    expect(forStranger.members[0].level).toBeNull();
    expect(forStranger.members[0].joinedAt).toBeNull();

    // Non-members get no tasks, roles or requests either
    expect(await stranger.as.query(api.guildRoles.list, { guildId })).toEqual([]);
    expect(await stranger.as.query(api.guildTasks.list, { guildId, today: "2026-01-01" })).toEqual([]);
    const publicPage = await stranger.as.query(api.guilds.overview, { guildId });
    expect(publicPage?.membership).toBeNull();
    expect(publicPage?.staff.map((s) => s.name)).toEqual(["Ada", "Bo"]);
  });
});

describe("roles and role order", () => {
  test("only roles with the permission can create roles, and never above their own grants", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const cy = await signedIn(t, "Cy");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    await join(guildId, cy, owner);

    const newRole = { guildId, name: "Scribe", color: "#7C5CFC", permissions: ["manage_tasks"] };
    expect(await failure(bo.as.mutation(api.guildRoles.create, newRole))).toMatch(/role doesn't allow/);

    // A custom role that can manage roles but nothing else
    const stewardId = await owner.as.mutation(api.guildRoles.create, {
      guildId,
      name: "Steward",
      color: "#FF9800",
      permissions: ["manage_roles"],
    });
    await owner.as.mutation(api.guildRoles.assign, { guildId, userId: bo.userId, roleId: stewardId });

    expect(await failure(bo.as.mutation(api.guildRoles.create, newRole))).toMatch(
      /can't grant a permission you don't have/
    );
    const scribeId = await bo.as.mutation(api.guildRoles.create, { ...newRole, permissions: [] });

    // Steward outranks Scribe (created later, so lower) but not Admin
    const admin = await roleNamed(t, guildId, "Admin");
    expect(
      await failure(
        bo.as.mutation(api.guildRoles.update, {
          roleId: admin._id,
          name: "Admin",
          color: "#FF6B6B",
          permissions: [],
        })
      )
    ).toMatch(/ranked below your own/);
    await bo.as.mutation(api.guildRoles.update, {
      roleId: scribeId,
      name: "Archivist",
      color: "#4ECDC4",
      permissions: [],
    });
    expect((await roleNamed(t, guildId, "Archivist")).color).toBe("#4ECDC4");

    // Steward has no assign permission
    expect(
      await failure(bo.as.mutation(api.guildRoles.assign, { guildId, userId: cy.userId, roleId: scribeId }))
    ).toMatch(/role doesn't allow/);
  });

  test("nobody can assign the Owner role or change someone ranked at or above them", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const cy = await signedIn(t, "Cy");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    await join(guildId, cy, owner);
    const admin = await roleNamed(t, guildId, "Admin");
    const ownerRole = await roleNamed(t, guildId, "Owner");
    const member = await roleNamed(t, guildId, "Member");
    await owner.as.mutation(api.guildRoles.assign, { guildId, userId: bo.userId, roleId: admin._id });
    await owner.as.mutation(api.guildRoles.assign, { guildId, userId: cy.userId, roleId: admin._id });

    expect(
      await failure(bo.as.mutation(api.guildRoles.assign, { guildId, userId: cy.userId, roleId: ownerRole._id }))
    ).toMatch(/Transfer Ownership/);
    // Bo and Cy are both Admins: neither outranks the other
    expect(
      await failure(bo.as.mutation(api.guildRoles.assign, { guildId, userId: cy.userId, roleId: member._id }))
    ).toMatch(/ranked below you/);
    expect(
      await failure(bo.as.mutation(api.guilds.removeMember, { guildId, userId: owner.userId }))
    ).toMatch(/ranked below you/);
    // An Admin can't hand out their own rank
    expect(
      await failure(bo.as.mutation(api.guildRoles.assign, { guildId, userId: cy.userId, roleId: admin._id }))
    ).toMatch(/ranked below/);
  });

  test("deleting a custom role drops its holders back to Member", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    const roleId = await owner.as.mutation(api.guildRoles.create, {
      guildId,
      name: "Scout",
      color: "#95E77E",
      permissions: [],
    });
    await owner.as.mutation(api.guildRoles.assign, { guildId, userId: bo.userId, roleId });
    await owner.as.mutation(api.guildRoles.remove, { roleId });

    const overview = await bo.as.query(api.guilds.overview, { guildId });
    expect(overview?.membership?.roleName).toBe("Member");
    const memberRole = await roleNamed(t, guildId, "Member");
    expect(await failure(owner.as.mutation(api.guildRoles.remove, { roleId: memberRole._id }))).toMatch(
      /Built-in roles/
    );
  });

  test("the Owner must transfer ownership before leaving", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);

    expect(await failure(owner.as.mutation(api.guilds.leave, { guildId }))).toMatch(/Transfer ownership/);
    expect(
      await failure(bo.as.mutation(api.guilds.transferOwnership, { guildId, userId: bo.userId }))
    ).toMatch(/Only the Owner/);

    await owner.as.mutation(api.guilds.transferOwnership, { guildId, userId: bo.userId });
    expect((await bo.as.query(api.guilds.overview, { guildId }))?.membership?.system).toBe("owner");
    expect((await owner.as.query(api.guilds.overview, { guildId }))?.membership?.roleName).toBe("Admin");
    await owner.as.mutation(api.guilds.leave, { guildId });
    expect((await bo.as.query(api.guilds.overview, { guildId }))?.memberCount).toBe(1);
  });
});

describe("tasks, rewards and guild XP", () => {
  test("only roles with the permission can post tasks", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    expect(await failure(bo.as.mutation(api.guildTasks.create, { guildId, ...oneOff }))).toMatch(
      /role doesn't allow/
    );
  });

  test("reward on submission pays guild XP once and leaves the account level alone", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    const taskId = await owner.as.mutation(api.guildTasks.create, { guildId, ...oneOff });

    const result = await bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" });
    expect(result).toMatchObject({ status: "approved", xpAwarded: 25 });
    expect(await guildXp(t, guildId, bo.userId)).toMatchObject({ xp: 25, level: 1 });

    expect(
      await failure(bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" }))
    ).toMatch(/already submitted/);
    expect(await guildXp(t, guildId, bo.userId)).toMatchObject({ xp: 25 });

    // Account XP is a separate counter and is not touched by guild tasks
    const account = await bo.as.query(api.users.currentUser, {});
    expect(account?.xp).toBeUndefined();
  });

  test("XP in one guild does not carry over to another", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const first = await foundGuild(owner, "First");
    const second = await foundGuild(owner, "Second");
    await join(first, bo, owner);
    await join(second, bo, owner);
    const taskId = await owner.as.mutation(api.guildTasks.create, {
      guildId: first,
      ...oneOff,
      difficulty: "hard",
    });
    await bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" });

    expect(await guildXp(t, first, bo.userId)).toMatchObject({ xp: 50 });
    expect(await guildXp(t, second, bo.userId)).toMatchObject({ xp: 0, level: 1 });
  });

  test("reward on review waits for a reviewer, who can't be the submitter", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    const taskId = await owner.as.mutation(api.guildTasks.create, {
      guildId,
      ...oneOff,
      rewardMode: "on_review",
    });

    // The owner submits their own task and cannot approve it themselves
    await owner.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" });
    expect((await owner.as.query(api.guildTasks.reviewQueue, { guildId })).pending).toEqual([]);

    const pending = await bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" });
    expect(pending).toMatchObject({ status: "pending_review", xpAwarded: 0 });
    expect(await guildXp(t, guildId, bo.userId)).toMatchObject({ xp: 0 });

    // A regular member has no review queue and can't review
    expect((await bo.as.query(api.guildTasks.reviewQueue, { guildId })).pending).toEqual([]);
    const queue = await owner.as.query(api.guildTasks.reviewQueue, { guildId });
    expect(queue.pending.map((s) => s.submitterName)).toEqual(["Bo"]);
    const submissionId = queue.pending[0]._id;
    expect(
      await failure(bo.as.mutation(api.guildTasks.review, { submissionId, approve: true }))
    ).toMatch(/role doesn't allow/);

    // Rejecting needs a note, and the member can then resubmit
    expect(
      await failure(owner.as.mutation(api.guildTasks.review, { submissionId, approve: false, note: " " }))
    ).toMatch(/Add a note/);
    await owner.as.mutation(api.guildTasks.review, { submissionId, approve: false, note: "Not swept" });
    const [task] = await bo.as.query(api.guildTasks.list, { guildId, today: "2026-01-01" });
    expect(task.mine).toMatchObject({ status: "rejected", reviewNote: "Not swept" });

    await bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" });
    await owner.as.mutation(api.guildTasks.review, { submissionId, approve: true });
    expect(await guildXp(t, guildId, bo.userId)).toMatchObject({ xp: 25 });
    expect(
      await failure(owner.as.mutation(api.guildTasks.review, { submissionId, approve: true }))
    ).toMatch(/already been reviewed/);
    expect(await guildXp(t, guildId, bo.userId)).toMatchObject({ xp: 25 });
  });

  test("a reviewer can revoke an approval within 7 days, removing its XP", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    const first = await owner.as.mutation(api.guildTasks.create, { guildId, ...oneOff });
    const second = await owner.as.mutation(api.guildTasks.create, { guildId, ...oneOff, name: "Second" });
    await bo.as.mutation(api.guildTasks.submit, { taskId: first, today: "2026-01-01" });
    await bo.as.mutation(api.guildTasks.submit, { taskId: second, today: "2026-01-01" });
    expect(await guildXp(t, guildId, bo.userId)).toMatchObject({ xp: 50 });

    const recent = (await owner.as.query(api.guildTasks.reviewQueue, { guildId })).recent;
    expect(recent).toHaveLength(2);
    const firstSubmission = recent.find((s) => s.taskName === "Clean the hall")!;
    const secondSubmission = recent.find((s) => s.taskName === "Second")!;

    await owner.as.mutation(api.guildTasks.revoke, { submissionId: firstSubmission._id });
    expect(await guildXp(t, guildId, bo.userId)).toMatchObject({ xp: 25 });
    expect(
      await failure(bo.as.mutation(api.guildTasks.submit, { taskId: first, today: "2026-01-01" }))
    ).toMatch(/revoked/);

    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
    expect(
      await failure(owner.as.mutation(api.guildTasks.revoke, { submissionId: secondSubmission._id }))
    ).toMatch(/within 7 days/);
  });

  test("tasks can only be submitted by the people they are assigned to", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const cy = await signedIn(t, "Cy");
    const stranger = await signedIn(t, "Dee");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    await join(guildId, cy, owner);
    const taskId = await owner.as.mutation(api.guildTasks.create, {
      guildId,
      ...oneOff,
      assignment: { type: "members", userIds: [bo.userId] },
    });

    expect(await failure(cy.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" }))).toMatch(
      /isn't assigned to you/
    );
    expect(
      await failure(stranger.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" }))
    ).toMatch(/not a member/);
    await bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" });

    const [forCy] = await cy.as.query(api.guildTasks.list, { guildId, today: "2026-01-01" });
    expect(forCy.assignedToMe).toBe(false);
    expect(await cy.as.query(api.guildTasks.mine, { today: "2026-01-01" })).toEqual([]);
  });

  test("a recurring task pays once per day and builds a streak bonus", async () => {
    const t = setup();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    const taskId = await owner.as.mutation(api.guildTasks.create, {
      guildId,
      ...oneOff,
      difficulty: "easy",
      recurrence: { type: "daily" },
    });

    let total = 0;
    for (const day of ["2026-03-01", "2026-03-02", "2026-03-03"]) {
      vi.setSystemTime(new Date(`${day}T12:00:00Z`));
      const result = await bo.as.mutation(api.guildTasks.submit, { taskId, today: day });
      total += result.xpAwarded;
      expect(await failure(bo.as.mutation(api.guildTasks.submit, { taskId, today: day }))).toMatch(
        /already submitted/
      );
    }
    // 10 + 10 + 11 (the third day in a row earns the 3-day bonus)
    expect(total).toBe(31);

    // A date that isn't today is refused
    expect(
      await failure(bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-04-01" }))
    ).toMatch(/only be completed on the day/);
  });

  test("a task that needs a proof video can't be submitted without one", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    const taskId = await owner.as.mutation(api.guildTasks.create, {
      guildId,
      ...oneOff,
      proofVideoRequired: true,
    });
    expect(await failure(bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" }))).toMatch(
      /needs a proof video/
    );
    const plainTask = await owner.as.mutation(api.guildTasks.create, { guildId, ...oneOff, name: "Plain" });
    expect(
      await failure(bo.as.mutation(api.guildTasks.generateProofUploadUrl, { taskId: plainTask }))
    ).toMatch(/doesn't take a proof video/);
  });

  test("leaving freezes guild XP and rejoining restores it", async () => {
    const t = setup();
    const owner = await signedIn(t, "Ada");
    const bo = await signedIn(t, "Bo");
    const guildId = await foundGuild(owner);
    await join(guildId, bo, owner);
    const taskId = await owner.as.mutation(api.guildTasks.create, { guildId, ...oneOff });
    await bo.as.mutation(api.guildTasks.submit, { taskId, today: "2026-01-01" });

    await bo.as.mutation(api.guilds.leave, { guildId });
    expect((await bo.as.query(api.guilds.overview, { guildId }))?.membership).toBeNull();
    expect((await guildXp(t, guildId, bo.userId))?.xp).toBe(25);

    await join(guildId, bo, owner);
    const overview = await bo.as.query(api.guilds.overview, { guildId });
    expect(overview?.membership).toMatchObject({ xp: 25, roleName: "Member" });
    expect(overview?.memberCount).toBe(2);
  });
});
