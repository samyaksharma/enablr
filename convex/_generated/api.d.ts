/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as guildRoles from "../guildRoles.js";
import type * as guildTasks from "../guildTasks.js";
import type * as guilds from "../guilds.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as maintenance from "../maintenance.js";
import type * as permissions from "../permissions.js";
import type * as push from "../push.js";
import type * as reminders from "../reminders.js";
import type * as sync from "../sync.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  guildRoles: typeof guildRoles;
  guildTasks: typeof guildTasks;
  guilds: typeof guilds;
  http: typeof http;
  "lib/access": typeof lib_access;
  maintenance: typeof maintenance;
  permissions: typeof permissions;
  push: typeof push;
  reminders: typeof reminders;
  sync: typeof sync;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
