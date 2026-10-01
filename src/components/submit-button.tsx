"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "Guardando…", className = "" }: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={`button ${className}`} type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
