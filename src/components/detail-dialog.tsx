"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function DetailDialog({
  open,
  title,
  eyebrow,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function restoreFocus() {
    onClose();
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.hasAttribute("hidden"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="detail-dialog"
      aria-labelledby="detail-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        dialogRef.current?.close();
      }}
      onClose={() => {
        if (open) restoreFocus();
      }}
      onKeyDown={trapFocus}
    >
      <div className="detail-dialog-header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 id="detail-dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Cerrar detalle"
          data-dialog-initial-focus
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>
      <div className="detail-dialog-body">{children}</div>
    </dialog>
  );
}
