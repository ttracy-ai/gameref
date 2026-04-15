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

  const [members, invitations] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          include: {
            accounts: { where: { provider: "discord" }, select: { provider: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.projectInvitation.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.userId,
      name: m.user.name,
      username: m.user.username,
      email: m.user.email,
      image: m.user.accounts.length > 0 ? m.user.image : null,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      createdAt: i.createdAt.toISOString(),
    })),
    currentUserRole: membership.role,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { email } = await request.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = email.trim();

  // Determine if this is a @username lookup or an email
  const isUsername = raw.startsWith("@");
  let targetUser: { id: string; email: string | null } | null = null;

  if (isUsername) {
    const username = raw.slice(1).toLowerCase();
    targetUser = await prisma.user.findUnique({ where: { username } });
    if (!targetUser) {
      return NextResponse.json(
        { error: `No user found with username @${username}. They must sign in to Plan A Project first.` },
        { status: 404 }
      );
    }
  }

  // Can't invite yourself
  const selfEmail = session.user.email?.toLowerCase();
  if (!isUsername) {
    const normalizedEmail = raw.toLowerCase();
    if (normalizedEmail === selfEmail) {
      return NextResponse.json({ error: "You are already a member." }, { status: 400 });
    }
    targetUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!targetUser) {
      // Pending email invitation
      await prisma.projectInvitation.upsert({
        where: { projectId_email: { projectId, email: normalizedEmail } },
        update: {},
        create: { projectId, email: normalizedEmail },
      });
      return NextResponse.json({ added: false, pending: true });
    }
  } else {
    if (targetUser!.id === session.user.id) {
      return NextResponse.json({ error: "You are already a member." }, { status: 400 });
    }
  }

  // Add user directly
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: targetUser!.id } },
    update: {},
    create: { projectId, userId: targetUser!.id, role: "member" },
  });
  return NextResponse.json({ added: true, pending: false });
}
