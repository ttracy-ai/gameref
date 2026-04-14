import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Fulfill any pending project invitations for this email on sign-in.
      if (!user.email || !user.id) return true;
      try {
        const invitations = await prisma.projectInvitation.findMany({
          where: { email: user.email.toLowerCase() },
        });
        for (const inv of invitations) {
          await prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: inv.projectId, userId: user.id } },
            update: {},
            create: { projectId: inv.projectId, userId: user.id, role: "member" },
          });
          await prisma.projectInvitation.delete({ where: { id: inv.id } });
        }

        // Auto-set username from Discord if the user doesn't have one yet.
        if (account?.provider === "discord" && profile) {
          const discordProfile = profile as { username?: string };
          if (discordProfile.username) {
            const existing = await prisma.user.findUnique({ where: { id: user.id } });
            if (existing && !existing.username) {
              // Try the Discord username; if taken, leave blank for manual entry.
              const taken = await prisma.user.findUnique({ where: { username: discordProfile.username } });
              if (!taken) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: { username: discordProfile.username },
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("GameRef: error in signIn callback", e);
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
