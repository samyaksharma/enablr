/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

export const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
  "!./test.setup.ts",
]);

export function setup() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

// Creates an account and returns a client that calls functions as that user.
export async function signedIn(t: T, characterName: string) {
  const userId: Id<"users"> = await t.run((ctx) => ctx.db.insert("users", { characterName }));
  // Convex Auth puts "<userId>|<sessionId>" in the token subject
  return { userId, as: t.withIdentity({ subject: `${userId}|test-session` }) };
}

// The server's message for an error raised with fail().
export async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: any) {
    return typeof error?.data === "string" ? error.data : String(error?.message ?? error);
  }
  throw new Error("Expected the call to be rejected, but it succeeded");
}
