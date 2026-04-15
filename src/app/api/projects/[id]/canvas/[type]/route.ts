import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; type: string }> };

async function getMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

// GET — load canvas data for a project
export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, type: canvasType } = await params;

  const membership = await getMembership(projectId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.canvasData.findUnique({
    where: { projectId_canvasType: { projectId, canvasType } },
  });

  return NextResponse.json({ data: record?.data ?? null });
}

// PUT — save canvas data for a project
export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, type: canvasType } = await params;

  const membership = await getMembership(projectId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await request.json();

  await prisma.canvasData.upsert({
    where: { projectId_canvasType: { projectId, canvasType } },
    update: { data },
    create: { projectId, canvasType, data },
  });

  return NextResponse.json({ success: true });
}
