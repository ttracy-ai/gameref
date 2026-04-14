import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      // When a user signs in, fulfill any pending project invitations for their email.
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
      } catch (e) {
        console.error("GameRef: error fulfilling invitations", e);
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
