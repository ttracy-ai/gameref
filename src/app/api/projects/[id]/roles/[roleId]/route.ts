import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getEditorMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

// PATCH — assign/unassign a member, or rename
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, roleId } = await params;
  const body = await request.json();

  const membership = await getEditorMembership(projectId, session.user.id);
  if (!membership || !["team_leader", "moderator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = await prisma.projectRole.findUnique({ where: { id: roleId } });
  if (!role || role.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: { name?: string; userId?: string | null } = {};

  if ("name" in body && body.name?.trim()) updates.name = body.name.trim();

  if ("userId" in body) {
    const newUserId = body.userId ?? null;
    if (newUserId) {
      const targetMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: newUserId } },
      });
      if (!targetMembership) {
        return NextResponse.json({ error: "User is not a member of this project" }, { status: 400 });
      }
    }
    updates.userId = newUserId;
  }

  const updated = await prisma.projectRole.update({
    where: { id: roleId },
    data: updates,
    include: {
      user: {
        include: {
          accounts: { where: { provider: "discord" }, select: { provider: true } },
        },
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    user: updated.user
      ? {
          id: updated.user.id,
          name: updated.user.name,
          username: updated.user.username,
          image:
            updated.user.accounts.length > 0
              ? (updated.user.discordImage ?? updated.user.image)
              : null,
        }
      : null,
  });
}

// DELETE — remove a role slot entirely
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, roleId } = await params;

  const membership = await getEditorMembership(projectId, session.user.id);
  if (!membership || !["team_leader", "moderator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = await prisma.projectRole.findUnique({ where: { id: roleId } });
  if (!role || role.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.projectRole.delete({ where: { id: roleId } });
  return NextResponse.json({ success: true });
}
