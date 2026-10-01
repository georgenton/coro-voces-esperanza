"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function QrDisplay({ rehearsalId }: { rehearsalId: string }) {
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const response = await fetch(`/api/rehearsals/${rehearsalId}/qr`, { cache: "no-store" });
      if (!active) return;
      if (!response.ok) { setError("No se pudo renovar el QR."); return; }
      const data = await response.json() as { dataUrl: string };
      setImage(data.dataUrl); setError("");
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 50_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [rehearsalId]);
  return <div className="qr-frame">{error ? <p className="notice notice-error">{error}</p> : image ? <Image src={image} alt="Código QR temporal del ensayo" width={512} height={512} unoptimized /> : <p>Cargando QR temporal…</p>}</div>;
}
