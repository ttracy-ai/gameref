import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true, email: true, image: true },
  });

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await request.json();
  const trimmed = (username ?? "").trim();

  if (!trimmed) return NextResponse.json({ error: "Username cannot be empty." }, { status: 400 });
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(trimmed)) {
    return NextResponse.json(
      { error: "Username must be 2–32 characters and contain only letters, numbers, _, ., or -." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { username: trimmed },
      select: { username: true },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    // Unique constraint violation
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update username." }, { status: 500 });
  }
}
