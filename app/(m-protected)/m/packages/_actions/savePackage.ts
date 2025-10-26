// app/(m-protected)/m/packages/_actions/savePackage.ts
"use server";
export const runtime = "nodejs";

import prisma, { runAs } from "@/lib/prisma-scope";
import type { PackageCategory } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { upsertPackageByTitle } from "@/lib/repos/packages";

export async function savePackage(input: {
  category: PackageCategory;
  title: string;
  summary?: string | null;
  price?: number | null;
  visible?: boolean;
  tags?: any;
}) {
  const s = await requireSession();
  const hospitalId = s.hid ?? (s as any).hospitalId;
  if (!hospitalId) throw new Error("UNAUTHORIZED");

  const savedId = await runAs(hospitalId, async () => {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true },
    });
    if (!hospital) throw new Error("HOSPITAL_NOT_FOUND");

    const saved = await upsertPackageByTitle(hospitalId, {
      category: input.category,
      title: String(input.title ?? "").trim(),
      summary: input.summary ?? null,
      price: typeof input.price === "number" ? input.price : null,
      visible: typeof input.visible === "boolean" ? input.visible : true,
      tags: input.tags,
    });

    return saved.id;
  });

  return { ok: true, id: savedId };
}


