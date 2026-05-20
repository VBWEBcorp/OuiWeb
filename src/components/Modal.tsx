import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Max width in px (default 480) */
  width?: number;
};

export default function Modal({ open, onClose, title, subtitle, icon, children, width = 480 }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Card */}
      <div
        className="relative card shadow-glow w-full animate-slide-up"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {(title || icon) && (
          <div className="flex items-start gap-3 p-5 border-b border-bg-border">
            {icon && (
              <div className="size-9 rounded-lg grid place-items-center shrink-0"
                   style={{ background: "var(--brand-soft, rgba(52,99,255,0.15))" }}>
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {title && <h3 className="font-semibold tracking-tight">{title}</h3>}
              {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:text-white hover:bg-white/5 shrink-0"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
