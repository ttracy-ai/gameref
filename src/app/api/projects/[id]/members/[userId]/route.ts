import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, userId } = await params;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "team_leader") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });

  return NextResponse.json({ success: true });
}

const VALID_ROLES = ["team_leader", "moderator", "member"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, userId } = await params;
  const { role } = await request.json();

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "team_leader") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
  });

  return NextResponse.json({ success: true });
}
