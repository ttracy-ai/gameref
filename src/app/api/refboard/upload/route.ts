import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return new Response("Missing projectId", { status: 400 });

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  const formData = await req.formData();
  const file    = formData.get("file") as File | null;
  const srcUrl  = formData.get("url")  as string | null;

  let uploadFile: File;

  if (file) {
    // Direct file upload from disk
    if (!file.type.startsWith("image/")) return new Response("Only images are allowed", { status: 400 });
    if (file.size > 20 * 1024 * 1024) return new Response("Image too large (max 20 MB)", { status: 413 });
    uploadFile = file;
  } else if (srcUrl) {
    // Proxy a web URL server-side — avoids browser CORS restrictions
    try {
      const res = await fetch(srcUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GameRef/1.0)" },
      });
      if (!res.ok) return new Response(`Could not fetch image (${res.status})`, { status: 400 });
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) return new Response("URL did not return an image", { status: 400 });
      if (blob.size > 20 * 1024 * 1024) return new Response("Image too large (max 20 MB)", { status: 413 });
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      uploadFile = new File([blob], `image.${ext}`, { type: blob.type });
    } catch {
      return new Response("Failed to fetch image URL", { status: 400 });
    }
  } else {
    return new Response("Missing file or url", { status: 400 });
  }

  const ext = uploadFile.name.split(".").pop() ?? "png";
  const filename = `refboard/${projectId}/${crypto.randomUUID()}.${ext}`;

  const blob = await put(filename, uploadFile, {
    access: "public",
    contentType: uploadFile.type,
  });

  return Response.json({ url: blob.url });
}
