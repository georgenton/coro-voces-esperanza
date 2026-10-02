export type InitialAdminBootstrapState =
  | { kind: "READY" }
  | { kind: "ACTIVE"; userId: string }
  | { kind: "CONFLICT_EXISTING_USER"; userId: string }
  | { kind: "CONFLICT_OTHER_SUPERADMIN" };

export function classifyInitialAdminBootstrap(input: {
  targetUserId: string | null;
  targetIsSuperadmin: boolean;
  superadminUserIds: string[];
}): InitialAdminBootstrapState {
  const otherSuperadminExists = input.superadminUserIds.some((userId) => userId !== input.targetUserId);
  if (otherSuperadminExists) return { kind: "CONFLICT_OTHER_SUPERADMIN" };
  if (!input.targetUserId) {
    return input.superadminUserIds.length === 0 ? { kind: "READY" } : { kind: "CONFLICT_OTHER_SUPERADMIN" };
  }
  if (input.targetIsSuperadmin) return { kind: "ACTIVE", userId: input.targetUserId };
  return { kind: "CONFLICT_EXISTING_USER", userId: input.targetUserId };
}

export function describeInitialAdminConflict(state: InitialAdminBootstrapState) {
  if (state.kind === "CONFLICT_OTHER_SUPERADMIN") {
    return "Ya existe otra cuenta SUPERADMIN. El bootstrap no modificó usuarios ni accesos.";
  }
  if (state.kind === "CONFLICT_EXISTING_USER") {
    return "El correo aprobado ya pertenece a una cuenta sin rol SUPERADMIN. El bootstrap no la elevó ni modificó.";
  }
  return null;
}
