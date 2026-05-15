const CONFIG: Record<string, { label: string; className: string }> = {
  high:   { label: 'High Confidence',   className: 'bg-emerald-100 text-emerald-700' },
  medium: { label: 'Medium Confidence', className: 'bg-amber-100 text-amber-700' },
  low:    { label: 'Low Confidence',    className: 'bg-red-100 text-red-600' },
  failed: { label: 'Failed',            className: 'bg-slate-100 text-slate-500' },
};

export function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const { label, className } = CONFIG[confidence] ?? CONFIG.medium;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
