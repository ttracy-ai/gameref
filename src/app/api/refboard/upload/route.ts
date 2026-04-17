import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return new Response("Missing projectId", { status: 400 });

  // Verify the user is a member of the project
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return new Response("Missing file", { status: 400 });

  if (!file.type.startsWith("image/")) {
    return new Response("Only images are allowed", { status: 400 });
  }

  // Max 20 MB per image
  if (file.size > 20 * 1024 * 1024) {
    return new Response("Image too large (max 20 MB)", { status: 413 });
  }

  const ext = file.name.split(".").pop() ?? "png";
  const filename = `refboard/${projectId}/${crypto.randomUUID()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return Response.json({ url: blob.url });
}
