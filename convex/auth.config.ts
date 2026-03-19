// import { Password } from "@convex-dev/auth/providers/Password";
// import { convexAuth } from "@convex-dev/auth/server";

// export const { auth, signIn, signOut, store } = convexAuth({
//   providers: [Password],
// });

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};