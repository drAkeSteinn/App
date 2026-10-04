"use client";

import React, { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { fmtDateLong, fmtTime } from "@/lib/bracket";

/* ============================================================
   Countdown gigante para el visor de espectadores
   ============================================================ */

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative min-w-[74px] sm:min-w-[110px] clip-card bg-[linear-gradient(180deg,#17171d,#0b0b0e)] border border-white/12 px-3 py-3 sm:px-5 sm:py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.6)]">
        <span
          key={value}
          className="block font-display italic text-[44px] sm:text-[68px] leading-none text-center text-silver-grad tabular-nums"
        >
          {value}
        </span>
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[linear-gradient(90deg,transparent,#e8102e,transparent)]" />
      </div>
      <span className="text-[9px] sm:text-[10px] font-extrabold tracking-[0.34em] text-[#8e919c] uppercase">{label}</span>
    </div>
  );
}

export function Countdown({ target, compact }: { target: number; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const diff = target - now;
  if (diff <= 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="font-display italic text-[38px] sm:text-[54px] uppercase leading-none text-red-grad beat">
          ¡Comienza!
        </div>
      </div>
    );
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (compact) {
    return (
      <span className="font-display italic text-[18px] text-silver-grad tabular-nums">
        {days > 0 ? `${days}D ` : ""}
        {pad(hours)}:{pad(mins)}:{pad(secs)}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 text-[#c9cbd3]">
        <CalendarClock size={14} className="text-[#ff2440]" />
        <span className="text-[11px] font-extrabold tracking-[0.28em] uppercase">
          {fmtDateLong(target)} · {fmtTime(target)}
        </span>
      </div>
      <div className="flex items-start gap-2 sm:gap-3">
        {days > 0 ? <Cell value={pad(days)} label="Días" /> : null}
        <Cell value={pad(hours)} label="Horas" />
        <span className="font-display italic text-[36px] sm:text-[54px] text-[#e8102e] leading-none pt-3 sm:pt-4">:</span>
        <Cell value={pad(mins)} label="Min" />
        <span className="font-display italic text-[36px] sm:text-[54px] text-[#e8102e] leading-none pt-3 sm:pt-4">:</span>
        <Cell value={pad(secs)} label="Seg" />
      </div>
    </div>
  );
}
