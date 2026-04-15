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

        // Auto-set username and save Discord avatar when signing in with Discord.
        if (account?.provider === "discord" && profile) {
          const discordProfile = profile as { id?: string; username?: string; avatar?: string };
          const updates: Record<string, string> = {};

          // Save Discord avatar URL so it persists even when user later logs in with Google.
          if (discordProfile.id && discordProfile.avatar) {
            updates.discordImage = `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`;
          }

          // Auto-set username if the user doesn't have one yet.
          if (discordProfile.username) {
            const existing = await prisma.user.findUnique({ where: { id: user.id } });
            if (existing && !existing.username) {
              const taken = await prisma.user.findUnique({ where: { username: discordProfile.username } });
              if (!taken) updates.username = discordProfile.username;
            }
          }

          if (Object.keys(updates).length > 0) {
            await prisma.user.update({ where: { id: user.id }, data: updates });
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
