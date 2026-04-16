import { Liveblocks } from "@liveblocks/node";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! });

/** Deterministic color from a user ID — stable across sessions */
function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff;
  return `hsl(${h % 360}, 70%, 60%)`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { room } = await req.json();

  // Room IDs are formatted: gdd_{projectId}_{pageId}
  // projectId is a cuid2 (no underscores); pageId is "home" or a UUID.
  const match = (room as string).match(/^gdd_([^_]+)_.+$/);
  if (!match) return new Response("Invalid room", { status: 400 });

  const projectId = match[1];

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, username: true, discordImage: true },
  });

  const liveblocksSession = liveblocks.prepareSession(session.user.id, {
    userInfo: {
      name: user?.name ?? user?.username ?? "User",
      color: hashColor(session.user.id),
      avatar: user?.discordImage ?? undefined,
    },
  });
  liveblocksSession.allow(room, liveblocksSession.FULL_ACCESS);

  const { body, status } = await liveblocksSession.authorize();
  return new Response(body, { status });
}
