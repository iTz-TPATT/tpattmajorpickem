import jwt from "jsonwebtoken";

export interface TokenPayload { userId: string; username: string; }

export function signToken(p: TokenPayload) {
  return jwt.sign(p, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try { return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload; }
  catch { return null; }
}

export function getTokenFromHeader(req: Request): TokenPayload | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}
