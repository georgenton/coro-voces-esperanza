"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="button button-secondary button-small"
      onClick={async () => {
        await authClient.signOut();
        router.push("/ingresar");
        router.refresh();
      }}
    >
      Salir
    </button>
  );
}
