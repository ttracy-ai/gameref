import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fulfill any pending email invitations that weren't caught at sign-in time
  // (e.g. user was already signed in when invited, or signIn callback edge cases)
  if (session.user.email) {
    const pending = await prisma.projectInvitation.findMany({
      where: { email: session.user.email.toLowerCase() },
    });
    if (pending.length > 0) {
      await Promise.all(
        pending.map((inv) =>
          prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: inv.projectId, userId: session.user.id } },
            update: {},
            create: { projectId: inv.projectId, userId: session.user.id, role: "member" },
          })
        )
      );
      await prisma.projectInvitation.deleteMany({
        where: { email: session.user.email.toLowerCase() },
      });
    }
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { joinedAt: "asc" },
  });

  const projects = memberships.map((m) => ({
    id: m.project.id,
    name: m.project.name,
    createdAt: m.project.createdAt.toISOString(),
    role: m.role,
    ownerId: m.project.ownerId,
  }));

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      ownerId: session.user.id,
      members: {
        create: { userId: session.user.id, role: "team_leader" },
      },
    },
  });

  return NextResponse.json({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    role: "team_leader",
    ownerId: project.ownerId,
  });
}
