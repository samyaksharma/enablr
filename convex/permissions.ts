// Guild permissions, shared by the Convex functions and the app.
// The server is the only place these are enforced; the app uses them to decide
// what to show.

export const PERMISSIONS = [
  "edit_guild",
  "manage_roles",
  "assign_roles",
  "manage_requests",
  "remove_members",
  "manage_tasks",
  "review_submissions",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  edit_guild: "Edit guild profile",
  manage_roles: "Create, edit, delete roles",
  assign_roles: "Assign roles to members",
  manage_requests: "Manage join requests",
  remove_members: "Remove members",
  manage_tasks: "Create and edit tasks",
  review_submissions: "Review submissions",
};

export type SystemRole = "owner" | "admin" | "mod" | "member";

// Member always sits below every other role.
export const MEMBER_POSITION = 1_000_000;

export const SYSTEM_ROLES: {
  system: SystemRole;
  name: string;
  color: string;
  position: number;
  permissions: Permission[];
}[] = [
  { system: "owner", name: "Owner", color: "#FFD700", position: 0, permissions: [...PERMISSIONS] },
  { system: "admin", name: "Admin", color: "#FF6B6B", position: 1, permissions: [...PERMISSIONS] },
  {
    system: "mod",
    name: "Mod",
    color: "#4ECDC4",
    position: 2,
    permissions: ["manage_requests", "remove_members", "manage_tasks", "review_submissions"],
  },
  { system: "member", name: "Member", color: "#A0A0B8", position: MEMBER_POSITION, permissions: [] },
];

export const LIMITS = {
  guildsJoined: 10,
  guildsOwned: 3,
  customRoles: 20,
  nameMin: 3,
  nameMax: 32,
  descriptionMax: 500,
  roleNameMax: 24,
  taskNameMax: 80,
  taskDescriptionMax: 500,
  joinMessageMax: 200,
  reviewNoteMax: 300,
  imageBytes: 2 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  videoSeconds: 60,
  rejoinAfterDenyMs: 7 * 24 * 60 * 60 * 1000,
  revokeWindowMs: 7 * 24 * 60 * 60 * 1000,
  deleteGraceMs: 7 * 24 * 60 * 60 * 1000,
  videoRetentionMs: 30 * 24 * 60 * 60 * 1000,
} as const;

export const ROLE_COLORS = [
  "#FF6B6B",
  "#FF9800",
  "#FFD93D",
  "#95E77E",
  "#4ECDC4",
  "#5DA9E9",
  "#7C5CFC",
  "#E86FD2",
  "#A0A0B8",
] as const;

export function roleHasPermission(
  role: { system?: SystemRole; permissions: string[] },
  permission: Permission
): boolean {
  return role.system === "owner" || role.permissions.includes(permission);
}
