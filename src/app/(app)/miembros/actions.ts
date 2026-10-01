"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole, MemberStatus } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/names";

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 180) : "No se pudo completar la operación.";
}

export async function createMemberAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/miembros?success=Miembro creado";
  try {
    const displayName = String(formData.get("displayName") ?? "").trim();
    if (displayName.length < 3) throw new Error("El nombre debe tener al menos 3 caracteres.");
    const status = String(formData.get("status") ?? "REVIEW_REQUIRED") as MemberStatus;
    if (!Object.values(MemberStatus).includes(status)) throw new Error("Estado inválido.");
    const sectionId = String(formData.get("sectionId") ?? "") || null;
    const joinedOnText = String(formData.get("joinedOn") ?? "");
    const joinedOn = joinedOnText ? new Date(`${joinedOnText}T00:00:00Z`) : null;
    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
        data: {
          displayName,
          originalName: displayName,
          normalizedName: normalizeName(displayName),
          status,
          currentSectionId: sectionId,
          joinedOn,
        },
      });
      if (sectionId && joinedOn) {
        await tx.sectionAssignment.create({
          data: { memberId: created.id, sectionId, startsOn: joinedOn, source: "MANUAL" },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "MEMBER_CREATED",
          entityType: "Member",
          entityId: created.id,
          summary: "Ficha de miembro creada manualmente.",
        },
      });
      return created;
    });
    target = `/miembros/${member.id}?success=Miembro creado`;
    revalidatePath("/miembros");
  } catch (error) {
    target = `/miembros?error=${encodeURIComponent(safeMessage(error))}`;
  }
  redirect(target);
}
