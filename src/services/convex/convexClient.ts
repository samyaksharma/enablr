import { ConvexReactClient } from "convex/react";
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL!;

// For use in React component tree (providers, hooks)
export const convex = new ConvexReactClient(CONVEX_URL);

// For imperative use outside React (syncService, pushNotifications)
export const convexHttpClient = new ConvexHttpClient(CONVEX_URL);
