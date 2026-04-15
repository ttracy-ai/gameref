import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getOwnerMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const membership = await getOwnerMembership(projectId, session.user.id);
  if (!membership || !["team_leader", "moderator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const link = await prisma.projectInviteLink.findFirst({ where: { projectId } });
  return NextResponse.json({ token: link?.token ?? null });
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const membership = await getOwnerMembership(projectId, session.user.id);
  if (!membership || !["team_leader", "moderator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete any existing link and create a fresh one
  await prisma.projectInviteLink.deleteMany({ where: { projectId } });
  const link = await prisma.projectInviteLink.create({
    data: { projectId, createdBy: session.user.id },
  });
  return NextResponse.json({ token: link.token });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const membership = await getOwnerMembership(projectId, session.user.id);
  if (!membership || !["team_leader", "moderator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.projectInviteLink.deleteMany({ where: { projectId } });
  return NextResponse.json({ revoked: true });
}
