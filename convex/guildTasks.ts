import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./users";
import {
  activeMembers,
  displayName,
  fail,
  getMembership,
  grantBadge,
  membersWithPermission,
  notify,
  notifyMember,
  requireMember,
  requirePermission,
  validateUpload,
} from "./lib/access";
import { LIMITS, roleHasPermission } from "./permissions";
import { BASE_XP } from "../src/constants/rpg";
import { calculateXp } from "../src/services/rpg/xpCalculator";
import { getLevelForXp } from "../src/services/rpg/levelCalculator";
import { Difficulty } from "../src/types/habit";
import {
  RecurrenceRule,
  countStreak,
  dayNumber,
  isDayKey,
  isScheduledOnDay,
} from "../src/utils/schedule";

const DAY_MS = 86400000;
const ONCE = "once";

const assignmentArg = v.union(
  v.object({ type: v.literal("everyone") }),
  v.object({ type: v.literal("role"), roleId: v.id("guildRoles") }),
  v.object({ type: v.literal("members"), userIds: v.array(v.id("users")) })
);

const taskFields = {
  name: v.string(),
  description: v.string(),
  difficulty: v.string(),
  recurrence: v.union(v.null(), v.any()),
  dueAt: v.optional(v.number()),
  assignment: assignmentArg,
  rewardMode: v.union(v.literal("on_submission"), v.literal("on_review")),
  proofVideoRequired: v.boolean(),
};

function asDifficulty(value: string): Difficulty {
  if (!(Object.values(Difficulty) as string[]).includes(value)) fail("Pick a difficulty.");
  return value as Difficulty;
}

function cleanRecurrence(value: unknown): RecurrenceRule | null {
  if (value === null || value === undefined) return null;
  const rule = value as RecurrenceRule;
  if (rule.type === "daily") return { type: "daily" };
  if (rule.type === "specific_days") {
    const days = [...new Set(rule.days ?? [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) fail("Pick at least one day for this task.");
    return { type: "specific_days", days };
  }
  if (rule.type === "interval") {
    const every = Math.floor(rule.every ?? 0);
    if (every < 1 || every > 365) fail("The interval must be between 1 and 365 days.");
    return { type: "interval", every };
  }
  fail("That schedule isn't valid.");
}

async function cleanTask(
  ctx: QueryCtx,
  guildId: Id<"guilds">,
  args: {
    name: string;
    description: string;
    difficulty: string;
    recurrence: unknown;
    dueAt?: number;
    assignment: Doc<"guildTasks">["assignment"];
    rewardMode: "on_submission" | "on_review";
    proofVideoRequired: boolean;
  }
) {
  const name = args.name.trim();
  if (name.length === 0 || name.length > LIMITS.taskNameMax) {
    fail(`Task names must be 1–${LIMITS.taskNameMax} characters.`);
  }
  const description = args.description.trim();
  if (description.length > LIMITS.taskDescriptionMax) {
    fail(`Descriptions can be up to ${LIMITS.taskDescriptionMax} characters.`);
  }
  const recurrence = cleanRecurrence(args.recurrence);

  let assignment = args.assignment;
  if (assignment.type === "role") {
    const role = await ctx.db.get(assignment.roleId);
    if (!role || role.guildId !== guildId) fail("That role no longer exists.");
  } else if (assignment.type === "members") {
    const userIds = [...new Set(assignment.userIds)];
    if (userIds.length === 0) fail("Pick at least one member for this task.");
    for (const userId of userIds) {
      if (!(await getMembership(ctx, guildId, userId))) {
        fail("One of the chosen adventurers is no longer in the guild.");
      }
    }
    assignment = { type: "members", userIds };
  }

  return {
    name,
    description,
    difficulty: asDifficulty(args.difficulty),
    recurrence,
    // A due date only makes sense for a one-off task
    dueAt: recurrence ? undefined : args.dueAt,
    assignment,
    rewardMode: args.rewardMode,
    proofVideoRequired: args.proofVideoRequired,
  };
}

function isAssigned(task: Doc<"guildTasks">, member: Doc<"guildMembers">): boolean {
  switch (task.assignment.type) {
    case "everyone":
      return true;
    case "role":
      return task.assignment.roleId === member.roleId;
    case "members":
      return task.assignment.userIds.includes(member.userId);
  }
}

async function assignedUserIds(
  ctx: QueryCtx,
  task: Doc<"guildTasks">,
  exclude: Id<"users">
): Promise<Id<"users">[]> {
  const members = await activeMembers(ctx, task.guildId);
  return members
    .filter((m) => isAssigned(task, m) && !m.muted && m.userId !== exclude)
    .map((m) => m.userId);
}

function createdDayOf(task: Doc<"guildTasks">): number {
  return Math.floor(task.createdAt / DAY_MS);
}

// Shapes a guild's tasks for one member: who each is for, and where that
// member's own submission for the current occurrence stands.
async function tasksForMember(
  ctx: QueryCtx,
  guildId: Id<"guilds">,
  member: Doc<"guildMembers">,
  today: string
) {
  const tasks = await ctx.db
    .query("guildTasks")
    .withIndex("by_guild", (q) => q.eq("guildId", guildId))
    .collect();
  const submissions = await ctx.db
    .query("guildTaskSubmissions")
    .withIndex("by_guild_user", (q) => q.eq("guildId", guildId).eq("userId", member.userId))
    .collect();
  const roles = await ctx.db
    .query("guildRoles")
    .withIndex("by_guild", (q) => q.eq("guildId", guildId))
    .collect();
  const todayNum = isDayKey(today) ? dayNumber(today) : Math.floor(Date.now() / DAY_MS);

  const result = [];
  for (const task of tasks) {
    if (task.archived) continue;
    const rule = task.recurrence as RecurrenceRule | null;
    const mine = submissions.filter((s) => s.taskId === task._id);
    const occurrence = rule ? today : ONCE;
    const current = mine.find((s) => s.occurrence === occurrence) ?? null;

    let streak = 0;
    if (rule) {
      const done = new Set(
        mine.filter((s) => s.status === "approved").map((s) => dayNumber(s.occurrence))
      );
      streak = countStreak(done, rule, createdDayOf(task), todayNum);
    }

    let assignedTo = "Everyone";
    if (task.assignment.type === "role") {
      const roleId = task.assignment.roleId;
      assignedTo = roles.find((r) => r._id === roleId)?.name ?? "A role";
    } else if (task.assignment.type === "members") {
      const count = task.assignment.userIds.length;
      assignedTo = count === 1 ? "1 member" : `${count} members`;
    }

    result.push({
      _id: task._id,
      guildId: task.guildId,
      name: task.name,
      description: task.description,
      difficulty: task.difficulty,
      baseXp: BASE_XP[task.difficulty as Difficulty] ?? 0,
      recurrence: rule,
      createdDay: createdDayOf(task),
      dueAt: task.dueAt ?? null,
      assignment: task.assignment,
      assignedTo,
      assignedToMe: isAssigned(task, member),
      rewardMode: task.rewardMode,
      proofVideoRequired: task.proofVideoRequired,
      streak,
      mine: current
        ? {
            _id: current._id,
            status: current.status,
            reviewNote: current.reviewNote ?? null,
            xpAwarded: current.xpAwarded,
          }
        : null,
    });
  }
  return result;
}

// The task board for one guild.
export const list = query({
  args: { guildId: v.id("guilds"), today: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const guild = await ctx.db.get(args.guildId);
    if (!guild || guild.deletedAt !== undefined) return [];
    const membership = await getMembership(ctx, args.guildId, userId);
    if (!membership) return [];
    return await tasksForMember(ctx, args.guildId, membership.member, args.today);
  },
});

// Every task assigned to the caller across all their guilds, for the home screen.
export const mine = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const memberships = await ctx.db
      .query("guildMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const groups = [];
    for (const member of memberships) {
      if (member.leftAt !== undefined) continue;
      const guild = await ctx.db.get(member.guildId);
      if (!guild || guild.deletedAt !== undefined) continue;
      const tasks = (await tasksForMember(ctx, guild._id, member, args.today)).filter(
        (t) => t.assignedToMe
      );
      if (tasks.length === 0) continue;
      groups.push({
        guildId: guild._id,
        guildName: guild.name,
        emblemUrl: guild.emblemId ? await ctx.storage.getUrl(guild.emblemId) : null,
        tasks,
      });
    }
    return groups.sort((a, b) => a.guildName.localeCompare(b.guildName));
  },
});

export const create = mutation({
  args: { guildId: v.id("guilds"), ...taskFields },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { guild } = await requirePermission(ctx, args.guildId, userId, "manage_tasks");
    const fields = await cleanTask(ctx, args.guildId, args);
    const now = Date.now();
    const taskId = await ctx.db.insert("guildTasks", {
      guildId: args.guildId,
      createdBy: userId,
      ...fields,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    const task = (await ctx.db.get(taskId))!;
    await notify(ctx, await assignedUserIds(ctx, task, userId), guild.name, `New task: ${task.name}`, {
      guildId: guild._id,
    });
    return taskId;
  },
});

// Changes apply to future submissions only; nothing already submitted is touched.
export const update = mutation({
  args: { taskId: v.id("guildTasks"), ...taskFields },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) fail("That task no longer exists.");
    await requirePermission(ctx, task.guildId, userId, "manage_tasks");
    const fields = await cleanTask(ctx, task.guildId, args);
    await ctx.db.patch(task._id, { ...fields, updatedAt: Date.now() });
  },
});

export const archive = mutation({
  args: { taskId: v.id("guildTasks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    await requirePermission(ctx, task.guildId, userId, "manage_tasks");
    await ctx.db.patch(task._id, { archived: true, updatedAt: Date.now() });
  },
});

async function loadSubmittableTask(ctx: QueryCtx, taskId: Id<"guildTasks">, userId: Id<"users">) {
  const task = await ctx.db.get(taskId);
  if (!task || task.archived) fail("That task is no longer on the board.");
  const access = await requireMember(ctx, task.guildId, userId);
  if (!isAssigned(task, access.member)) fail("This task isn't assigned to you.");
  return { task, ...access };
}

// Upload URL for a proof video, issued only to someone who may submit the task.
export const generateProofUploadUrl = mutation({
  args: { taskId: v.id("guildTasks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { task } = await loadSubmittableTask(ctx, args.taskId, userId);
    if (!task.proofVideoRequired) fail("This task doesn't take a proof video.");
    return await ctx.storage.generateUploadUrl();
  },
});

// The one place guild XP is written. It runs inside the same mutation that
// marks the submission approved, so a retry can never pay twice.
async function award(
  ctx: MutationCtx,
  task: Doc<"guildTasks">,
  submission: Doc<"guildTaskSubmissions">
) {
  const membership = await getMembership(ctx, task.guildId, submission.userId);
  const difficulty = task.difficulty as Difficulty;
  const rule = task.recurrence as RecurrenceRule | null;

  let streak = 0;
  if (rule && isDayKey(submission.occurrence)) {
    const earlier = await ctx.db
      .query("guildTaskSubmissions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", submission.userId))
      .collect();
    const done = new Set(
      earlier
        .filter((s) => s.status === "approved" && s._id !== submission._id)
        .map((s) => dayNumber(s.occurrence))
    );
    const day = dayNumber(submission.occurrence);
    done.add(day);
    streak = countStreak(done, rule, createdDayOf(task), day);
  }
  const xp = calculateXp(difficulty, streak);

  let leveledUp = false;
  let newLevel = membership?.member.level ?? 1;
  // Someone who has left keeps their frozen XP; nothing is added to it
  if (membership) {
    const total = membership.member.xp + xp;
    newLevel = getLevelForXp(total);
    leveledUp = newLevel > membership.member.level;
    await ctx.db.patch(membership.member._id, { xp: total, level: newLevel });
    if (newLevel >= 10) await grantBadge(ctx, submission.userId, "guild_veteran");
  }
  if (submission.videoId) await grantBadge(ctx, submission.userId, "on_camera");

  await ctx.db.patch(submission._id, {
    status: "approved",
    xpAwarded: membership ? xp : 0,
    resolvedAt: Date.now(),
  });
  return { xpAwarded: membership ? xp : 0, leveledUp, newLevel };
}

export const submit = mutation({
  args: {
    taskId: v.id("guildTasks"),
    // The device's local day for a recurring task; ignored for a one-off
    today: v.string(),
    videoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { task, guild } = await loadSubmittableTask(ctx, args.taskId, userId);
    const rule = task.recurrence as RecurrenceRule | null;

    let occurrence = ONCE;
    if (rule) {
      if (!isDayKey(args.today)) fail("That date isn't valid.");
      const day = dayNumber(args.today);
      // Time zones put "today" at most a day either side of the server's date
      if (Math.abs(day - Math.floor(Date.now() / DAY_MS)) > 1) {
        fail("This task can only be completed on the day it's due.");
      }
      if (!isScheduledOnDay(rule, day, createdDayOf(task))) fail("This task isn't due today.");
      occurrence = args.today;
    }

    if (task.proofVideoRequired) {
      if (!args.videoId) fail("This task needs a proof video.");
      await validateUpload(ctx, args.videoId, "video", LIMITS.videoBytes);
    }
    const videoId = task.proofVideoRequired ? args.videoId : undefined;

    const previous = (
      await ctx.db
        .query("guildTaskSubmissions")
        .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", userId))
        .collect()
    ).find((s) => s.occurrence === occurrence);

    let submissionId: Id<"guildTaskSubmissions">;
    if (previous) {
      if (previous.status !== "rejected") {
        if (args.videoId && args.videoId !== previous.videoId) await ctx.storage.delete(args.videoId);
        fail(
          previous.status === "revoked"
            ? "A reviewer revoked this submission, so it can't be sent again."
            : "You've already submitted this task."
        );
      }
      // Resubmitting after a rejection reuses the same record
      if (previous.videoId && previous.videoId !== videoId) {
        await ctx.storage.delete(previous.videoId);
      }
      await ctx.db.patch(previous._id, {
        status: "pending_review",
        videoId,
        reviewedBy: undefined,
        reviewNote: undefined,
        resolvedAt: undefined,
        submittedAt: Date.now(),
      });
      submissionId = previous._id;
    } else {
      submissionId = await ctx.db.insert("guildTaskSubmissions", {
        taskId: task._id,
        guildId: task.guildId,
        userId,
        occurrence,
        status: "pending_review",
        videoId,
        xpAwarded: 0,
        submittedAt: Date.now(),
      });
    }

    if (task.rewardMode === "on_submission") {
      const submission = (await ctx.db.get(submissionId))!;
      const result = await award(ctx, task, submission);
      return { status: "approved" as const, guildName: guild.name, ...result };
    }

    const submitter = displayName(await ctx.db.get(userId));
    await notify(
      ctx,
      await membersWithPermission(ctx, task.guildId, "review_submissions", userId),
      guild.name,
      `${submitter} submitted "${task.name}" for review.`,
      { guildId: guild._id }
    );
    return {
      status: "pending_review" as const,
      guildName: guild.name,
      xpAwarded: 0,
      leveledUp: false,
      newLevel: 0,
    };
  },
});

// A member can pull back their own submission while it is waiting for review.
export const withdraw = mutation({
  args: { submissionId: v.id("guildTaskSubmissions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission || submission.userId !== userId) return;
    if (submission.status !== "pending_review") fail("This submission has already been reviewed.");
    if (submission.videoId) await ctx.storage.delete(submission.videoId);
    await ctx.db.delete(submission._id);
  },
});

export const reviewQueue = query({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const empty = { pending: [], recent: [] };
    const userId = await getAuthUserId(ctx);
    if (userId === null) return empty;
    const guild = await ctx.db.get(args.guildId);
    if (!guild || guild.deletedAt !== undefined) return empty;
    const membership = await getMembership(ctx, args.guildId, userId);
    if (!membership || !roleHasPermission(membership.role, "review_submissions")) return empty;

    const shape = async (s: Doc<"guildTaskSubmissions">) => {
      const task = await ctx.db.get(s.taskId);
      return {
        _id: s._id,
        taskName: task?.name ?? "Deleted task",
        difficulty: task?.difficulty ?? "easy",
        submitterName: displayName(await ctx.db.get(s.userId)),
        occurrence: s.occurrence,
        submittedAt: s.submittedAt,
        resolvedAt: s.resolvedAt ?? null,
        xpAwarded: s.xpAwarded,
        // Only reviewers reach this query, so only they are handed the video
        videoUrl: s.videoId ? await ctx.storage.getUrl(s.videoId) : null,
      };
    };

    const pendingRows = await ctx.db
      .query("guildTaskSubmissions")
      .withIndex("by_guild_status", (q) =>
        q.eq("guildId", args.guildId).eq("status", "pending_review")
      )
      .collect();
    const approvedRows = await ctx.db
      .query("guildTaskSubmissions")
      .withIndex("by_guild_status", (q) => q.eq("guildId", args.guildId).eq("status", "approved"))
      .collect();
    const revokeCutoff = Date.now() - LIMITS.revokeWindowMs;

    // Nobody reviews or revokes their own work
    const pending = pendingRows
      .filter((s) => s.userId !== userId)
      .sort((a, b) => a.submittedAt - b.submittedAt);
    const recent = approvedRows
      .filter((s) => s.userId !== userId && (s.resolvedAt ?? 0) > revokeCutoff)
      .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
      .slice(0, 30);

    return {
      pending: await Promise.all(pending.map(shape)),
      recent: await Promise.all(recent.map(shape)),
    };
  },
});

async function loadReviewable(
  ctx: MutationCtx,
  submissionId: Id<"guildTaskSubmissions">,
  userId: Id<"users">
) {
  const submission = await ctx.db.get(submissionId);
  if (!submission) fail("That submission no longer exists.");
  const { guild } = await requirePermission(ctx, submission.guildId, userId, "review_submissions");
  if (submission.userId === userId) fail("You can't review your own submission.");
  const task = await ctx.db.get(submission.taskId);
  if (!task) fail("That task no longer exists.");
  return { submission, guild, task };
}

function cleanNote(note: string | undefined, required: boolean): string | undefined {
  const trimmed = (note ?? "").trim().slice(0, LIMITS.reviewNoteMax);
  if (required && trimmed.length === 0) fail("Add a note so they know what to fix.");
  return trimmed.length > 0 ? trimmed : undefined;
}

export const review = mutation({
  args: {
    submissionId: v.id("guildTaskSubmissions"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { submission, guild, task } = await loadReviewable(ctx, args.submissionId, userId);
    if (submission.status !== "pending_review") fail("That submission has already been reviewed.");

    if (!args.approve) {
      const note = cleanNote(args.note, true);
      await ctx.db.patch(submission._id, {
        status: "rejected",
        reviewedBy: userId,
        reviewNote: note,
        resolvedAt: Date.now(),
      });
      await notifyMember(
        ctx,
        guild._id,
        submission.userId,
        guild.name,
        `"${task.name}" was sent back: ${note}`
      );
      return;
    }

    await ctx.db.patch(submission._id, { reviewedBy: userId, reviewNote: cleanNote(args.note, false) });
    const result = await award(ctx, task, submission);
    await notifyMember(
      ctx,
      guild._id,
      submission.userId,
      guild.name,
      result.leveledUp
        ? `"${task.name}" approved: +${result.xpAwarded} XP. You reached Level ${result.newLevel}!`
        : `"${task.name}" approved: +${result.xpAwarded} XP.`
    );
  },
});

// Takes back the XP from an approved submission. This is the check on tasks
// that reward on submission.
export const revoke = mutation({
  args: { submissionId: v.id("guildTaskSubmissions"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { submission, guild, task } = await loadReviewable(ctx, args.submissionId, userId);
    if (submission.status !== "approved") fail("Only approved submissions can be revoked.");
    if (Date.now() > (submission.resolvedAt ?? 0) + LIMITS.revokeWindowMs) {
      fail("Submissions can only be revoked within 7 days of approval.");
    }

    const membership = await getMembership(ctx, guild._id, submission.userId);
    if (membership) {
      const total = Math.max(0, membership.member.xp - submission.xpAwarded);
      await ctx.db.patch(membership.member._id, { xp: total, level: getLevelForXp(total) });
    }
    const note = cleanNote(args.note, false);
    await ctx.db.patch(submission._id, {
      status: "revoked",
      reviewedBy: userId,
      reviewNote: note,
      xpAwarded: 0,
      resolvedAt: Date.now(),
    });
    await notifyMember(
      ctx,
      guild._id,
      submission.userId,
      guild.name,
      `"${task.name}" was revoked and its ${submission.xpAwarded} XP removed.${note ? ` ${note}` : ""}`
    );
  },
});
