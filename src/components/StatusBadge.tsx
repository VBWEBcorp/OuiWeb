import { STATUS_LABELS } from "../lib/constants";

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.draft;
  return (
    <span className={`tag border ${s.color}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}
