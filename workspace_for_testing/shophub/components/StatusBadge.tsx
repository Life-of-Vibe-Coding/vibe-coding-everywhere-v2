const STATUS_THEME: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() || 'pending';
  const theme = STATUS_THEME[normalized] || STATUS_THEME.pending;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${theme}`}>
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}
