import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="login-shell">
      <div className="login-card">
        <p className="eyebrow">Acceso restringido</p>
        <h1>Esta sección no está disponible para tu rol</h1>
        <p className="lede">La autorización se comprobó en el servidor. Si tu función cambió, pide a administración que revise tu acceso.</p>
        <Link href="/resumen" className="button">Volver al resumen</Link>
      </div>
    </div>
  );
}
