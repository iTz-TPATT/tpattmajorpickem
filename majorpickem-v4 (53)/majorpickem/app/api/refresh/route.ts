import { NextResponse } from "next/server";
import { getTokenFromHeader, signToken } from "@/lib/auth";

// Silently refreshes a valid token with a new 30-day expiry
// Called on app load so users never get logged out mid-tournament
export async function POST(request: Request) {
  const user = getTokenFromHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const newToken = signToken({ userId: user.userId, username: user.username });
  return NextResponse.json({ token: newToken, username: user.username });
}
