import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { useTheme } from "../lib/auth";

type Variant = "danger" | "warn" | "info";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  icon?: React.ReactNode;
};

const variantStyle: Record<Variant, { ring: string; bg: string; fg: string; btn: string }> = {
  danger: {
    ring: "rgba(244,63,94,0.4)",
    bg:   "rgba(244,63,94,0.10)",
    fg:   "#fb7185",
    btn:  "linear-gradient(180deg, #f43f5e, #be123c)",
  },
  warn: {
    ring: "rgba(245,158,11,0.4)",
    bg:   "rgba(245,158,11,0.10)",
    fg:   "#fbbf24",
    btn:  "linear-gradient(180deg, #f59e0b, #b45309)",
  },
  info: {
    ring: "rgba(59,130,246,0.4)",
    bg:   "rgba(59,130,246,0.10)",
    fg:   "#60a5fa",
    btn:  "linear-gradient(180deg, #3b82f6, #1d4ed8)",
  },
};

export default function ConfirmModal({
  open, onClose, onConfirm,
  title = "Confirmer",
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  icon,
}: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const s = variantStyle[variant];

  useEffect(() => { if (!open) setLoading(false); }, [open]);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // parent should handle errors via toast
    } finally {
      setLoading(false);
    }
  }

  // Use brand color for `info` variant button if a theme is active
  const confirmBg = variant === "info" && theme ? theme.primary : s.btn;
  const confirmShadow = variant === "info" && theme ? `0 14px 36px -14px ${theme.primary}` : `0 14px 36px -14px ${s.fg}`;

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <div className="flex flex-col items-center text-center pt-2">
        <div
          className="size-14 rounded-full grid place-items-center mb-4 animate-fade-in"
          style={{ background: s.bg, boxShadow: `0 0 0 6px ${s.ring}` }}
        >
          {icon || (variant === "danger"
            ? <Trash2 className="size-6" style={{ color: s.fg }} />
            : <AlertTriangle className="size-6" style={{ color: s.fg }} />)}
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {message && (
          <div className="text-sm text-zinc-400 mt-1.5 leading-relaxed max-w-sm">
            {message}
          </div>
        )}

        <div className="flex items-center gap-2 mt-6 w-full">
          <button onClick={onClose} disabled={loading} className="btn-outline flex-1 justify-center">
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn-primary flex-1 justify-center text-white"
            style={{ background: confirmBg, boxShadow: confirmShadow }}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
