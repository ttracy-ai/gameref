import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config — no Prisma, no Node.js-only dependencies.
// Used by middleware to verify JWT sessions without hitting the database.
export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
};
