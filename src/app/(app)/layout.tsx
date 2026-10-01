import { AppShell } from "@/components/app-shell";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAccess();
  return <AppShell access={access}>{children}</AppShell>;
}
