import { cookies } from "next/headers";
import prisma from "@/lib/prisma-scope";

const COOKIE = process.env.COOKIE_NAME || "msw_m";

export async function getCtx() {
  const sid = cookies().get(COOKIE)?.value;
  if (!sid) throw new Error("UNAUTH");
  const sess = await prisma.session.findUnique({ where: { id: sid }, select: { userId: true }});
  if (!sess?.userId) throw new Error("UNAUTH");
  const user = await prisma.user.findUnique({ where: { id: sess.userId }, select: { hospitalId: true }});
  if (!user?.hospitalId) throw new Error("NO_HOSPITAL");
  return { hospitalId: user.hospitalId };
}


