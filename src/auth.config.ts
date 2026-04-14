import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";

// Edge-safe config — no Prisma, no Node.js-only dependencies.
// Used by middleware to verify JWT sessions without hitting the database.
export const authConfig: NextAuthConfig = {
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Discord({ allowDangerousEmailAccountLinking: true }),
  ],
  pages: { signIn: "/login" },
};
