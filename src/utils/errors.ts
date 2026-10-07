import { ConvexError } from 'convex/values';

// Turns anything thrown by a server call into a sentence that is safe to show.
// Messages the server wrote for the user arrive as a ConvexError; everything
// else (network drops, bugs) gets a plain fallback, never raw error text.
export function errorMessage(
  error: unknown,
  fallback = "That didn't go through. Check your connection and try again."
): string {
  if (error instanceof ConvexError && typeof error.data === 'string') {
    return error.data;
  }
  return fallback;
}
