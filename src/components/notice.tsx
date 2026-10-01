export function Notice({
  success,
  error,
  warning,
}: {
  success?: string;
  error?: string;
  warning?: string;
}) {
  if (success) return <div className="notice notice-success" role="status">{success}</div>;
  if (error) return <div className="notice notice-error" role="alert">{error}</div>;
  if (warning) return <div className="notice notice-warning" role="status">{warning}</div>;
  return null;
}
