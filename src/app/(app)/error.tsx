"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="card">
        <p className="eyebrow">No se completó la operación</p>
        <h1>Ocurrió un error</h1>
        <p className="lede">No se guardaron cambios parciales. Revisa los datos o intenta nuevamente.</p>
        <button type="button" className="button" onClick={reset}>Reintentar</button>
      </div>
    </div>
  );
}
