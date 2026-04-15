import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET — validate token and return project info (used by the invite page)
export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const link = await prisma.projectInviteLink.findUnique({
    where: { token },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!link) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });
  return NextResponse.json({ projectId: link.project.id, projectName: link.project.name });
}

// POST — authenticated user joins the project
export async function POST(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  const link = await prisma.projectInviteLink.findUnique({
    where: { token },
    include: { project: true },
  });
  if (!link) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: link.projectId, userId: session.user.id } },
    update: {},
    create: { projectId: link.projectId, userId: session.user.id, role: "member" },
  });

  return NextResponse.json({ projectId: link.projectId, projectName: link.project.name });
}
