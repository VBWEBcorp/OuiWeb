import { useState } from "react";
import { ChevronsUpDown, Check, CircleDot } from "lucide-react";
import { useStore } from "../lib/store";
import { initials } from "../lib/utils";

export default function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const accounts = useStore((s) => s.accounts);
  const currentId = useStore((s) => s.currentAccountId);
  const setCurrent = useStore((s) => s.setCurrentAccountId);
  const current = accounts.find((a) => a._id === currentId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-white/5 border border-bg-border bg-bg-card"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="size-8 rounded-lg grid place-items-center text-xs font-bold text-white shrink-0"
            style={{ background: current?.avatarColor || "#3463ff" }}
          >
            {initials(current?.displayName || "?")}
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-medium truncate">{current?.displayName || "Aucun compte"}</div>
            <div className="text-[11px] text-zinc-500 flex items-center gap-1">
              <CircleDot className={"size-3 " + (current?.connected ? "text-emerald-400" : "text-zinc-500")} />
              {current?.connected ? "Connecté à LinkedIn" : "Non connecté"}
            </div>
          </div>
        </div>
        <ChevronsUpDown className="size-4 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 z-30 card overflow-hidden animate-fade-in">
          {accounts.map((a) => (
            <button
              key={a._id}
              onClick={() => { setCurrent(a._id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-2 hover:bg-white/5 text-left"
            >
              <div
                className="size-7 rounded-md grid place-items-center text-[11px] font-bold text-white"
                style={{ background: a.avatarColor }}
              >
                {initials(a.displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.displayName}</div>
                <div className="text-[11px] text-zinc-500">
                  {a.connected ? "Connecté" : "Non connecté"}
                </div>
              </div>
              {a._id === currentId && <Check className="size-4 text-brand-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
