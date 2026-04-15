import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const roles = await prisma.projectRole.findMany({
    where: { projectId },
    include: {
      user: {
        include: {
          accounts: { where: { provider: "discord" }, select: { provider: true } },
        },
      },
    },
    orderBy: [{ userId: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      user: r.user
        ? {
            id: r.user.id,
            name: r.user.name,
            username: r.user.username,
            image: r.user.accounts.length > 0 ? (r.user.discordImage ?? r.user.image) : null,
          }
        : null,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { name, userId } = await request.json();

  if (!name?.trim()) return NextResponse.json({ error: "Role name required" }, { status: 400 });

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!membership || !["team_leader", "moderator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If assigning to a user, verify they're a member of this project
  if (userId) {
    const targetMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "User is not a member of this project" }, { status: 400 });
    }
  }

  const role = await prisma.projectRole.create({
    data: { projectId, name: name.trim(), userId: userId ?? null },
    include: {
      user: {
        include: {
          accounts: { where: { provider: "discord" }, select: { provider: true } },
        },
      },
    },
  });

  return NextResponse.json({
    id: role.id,
    name: role.name,
    description: role.description,
    user: role.user
      ? {
          id: role.user.id,
          name: role.user.name,
          username: role.user.username,
          image: role.user.accounts.length > 0 ? (role.user.discordImage ?? role.user.image) : null,
        }
      : null,
  });
}
