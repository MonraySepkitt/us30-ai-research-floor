import { useState } from "react";

export function PCSection({
  title, accent, defaultOpen = true, children,
}: {
  title: string; accent: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: accent + "33" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex justify-between items-center py-[5px] px-0 text-left"
      >
        <span className="text-[7px]" style={{ color: accent }}>{title}</span>
        <span className="text-[7px] text-muted-foreground">{open ? "[-]" : "[+]"}</span>
      </button>
      {open && (
        <div className="pb-3 pl-1 flex flex-col gap-[5px] text-[7px] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
