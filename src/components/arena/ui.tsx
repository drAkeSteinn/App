"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import type { TournamentStatus } from "@/lib/types";
import { MODALITY_LABEL, STATUS_LABEL } from "@/lib/types";

/* ============================================================
   Kit de UI estilo arena (custom, sin dependencias de estilo)
   ============================================================ */

/* ---------------- Emblem (logo del app — HyperX) ---------------- */
export function Emblem({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/hyperlogo.png"
      alt="Arena Torneos"
      width={size}
      height={size}
      className={`clip-card-sm object-cover bg-black/40 ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/* ---------------- Botones ---------------- */
type BtnVariant = "red" | "dark" | "silver" | "ghost" | "gold";
export function Btn({
  children,
  onClick,
  variant = "dark",
  disabled,
  className = "",
  type = "button",
  title,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
  small?: boolean;
}) {
  const styles: Record<BtnVariant, string> = {
    red: "text-white bg-[linear-gradient(160deg,#ff2440,#e8102e_55%,#8f0a1e)] shadow-[0_6px_20px_rgba(232,16,46,0.35)] hover:brightness-110",
    dark: "text-white bg-[#1a1a21] border border-white/15 hover:border-[#e8102e]/70 hover:bg-[#20202a]",
    silver: "text-[#141519] bg-[linear-gradient(180deg,#fdfdfe,#dfe1e7_55%,#b9bdc7)] hover:brightness-105",
    gold: "text-[#241500] bg-[linear-gradient(180deg,#ffe9b0,#ffc94d_50%,#d99312)] hover:brightness-105",
    ghost: "text-[#8e919c] hover:text-white hover:bg-white/5",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`btn-press clip-btn font-goth font-extrabold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 ${
        small ? "text-[10px] px-3 py-2" : "text-[11px] px-5 py-3"
      } ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  onClick,
  title,
  danger,
  active,
  disabled,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`btn-press ${small ? "p-1.5" : "p-2"} inline-flex items-center justify-center border transition-colors ${
        danger
          ? "border-[#e8102e]/40 text-[#ff2440] hover:bg-[#e8102e] hover:text-white"
          : active
            ? "border-[#e8102e] bg-[#e8102e]/15 text-white"
            : "border-white/12 text-[#8e919c] hover:text-white hover:border-white/40"
      } disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

/* ---------------- Inputs ---------------- */
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label-cap block mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block mt-1 text-[10px] text-[#6b6e78] font-semibold">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`field-input clip-card-sm w-full px-3 py-2.5 text-[13px] ${className}`} />;
}

/* ---------------- Segmented ---------------- */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 p-1 bg-black/40 border border-white/10 ${className}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`btn-press flex-1 clip-tag py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] transition-colors ${
            value === o.value
              ? "bg-[linear-gradient(160deg,#ff2440,#a30d24)] text-white shadow-[0_4px_14px_rgba(232,16,46,0.35)]"
              : "text-[#8e919c] hover:text-white bg-white/[0.04]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Select custom ---------------- */
export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  logo?: string | null;
}
export function Select({
  value,
  options,
  onChange,
  placeholder = "SELECCIONA",
  className = "",
}: {
  value: string | null;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* click fuera (del trigger Y del panel portal) cierra */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* con el panel en position:fixed, cualquier scroll/resize lo desalinea → cerrar */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 6, left: r.left, width: r.width });
    }
    setOpen((v) => !v);
  };

  const current = options.find((o) => o.value === value);
  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`hdr-ctl clip-tag w-full h-[38px] justify-between gap-2 bg-[rgba(255,255,255,0.045)] border px-3 font-bold uppercase tracking-[0.1em] hover:border-[#e8102e]/60 ${
          open ? "border-[#e8102e]" : "border-white/15"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {current?.logo ? (
            <img src={current.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
          ) : null}
          <span className={`truncate text-[11px] ${current ? "text-white" : "text-[#6b6e78]"}`}>{current?.label ?? placeholder}</span>
        </span>
        <ChevronDown size={14} className={`text-[#8e919c] transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && rect
        ? createPortal(
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14 }}
                role="listbox"
                style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 95 }}
                className="max-h-72 overflow-y-auto bg-[#101014] border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.7)] clip-tag"
              >
                {options.length === 0 ? (
                  <div className="px-3 py-3 text-[11px] text-[#6b6e78] font-bold uppercase tracking-wider">Sin opciones</div>
                ) : (
                  options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={o.value === value}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2 border-b border-white/5 last:border-0 transition-colors ${
                        o.value === value ? "bg-[#e8102e]/20 text-white" : "text-[#c9cbd3] hover:bg-white/5"
                      }`}
                    >
                      {o.logo ? (
                        <img src={o.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                      ) : (
                        <span className="w-5 h-5 shrink-0 inline-flex items-center justify-center">
                          {o.value === value ? <Check size={13} className="text-[#ff2440]" /> : null}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-[12px] font-bold uppercase tracking-wide truncate">{o.label}</span>
                        {o.hint ? <span className="block text-[10px] text-[#6b6e78] font-semibold">{o.hint}</span> : null}
                      </span>
                    </button>
                  ))
                )}
            </motion.div>,
            document.body
          )
        : null}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} bg-[#0d0d10] border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.8)] clip-card max-h-[88vh] flex flex-col`}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10 bg-[linear-gradient(90deg,rgba(232,16,46,0.18),transparent_40%)]">
              <div className="flex items-center gap-3">
                <span className="slashes w-6 h-4 inline-block" aria-hidden />
                <h3 className="font-display italic text-[17px] uppercase tracking-wide text-white">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="btn-press p-1.5 text-[#8e919c] hover:text-white border border-white/10 hover:border-[#e8102e]/60"
              >
                <X size={15} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ---------------- Confirm ----------------
   Con `confirmText` se exige escribir una palabra (ej. ELIMINAR) antes de
   habilitar el botón de confirmación — para acciones destructivas. */
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "CONFIRMAR",
  danger,
  confirmText,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  confirmText?: string;
}) {
  const [txt, setTxt] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    // al abrir el modal se limpia el campo (patrón de ajuste de estado en render)
    setPrevOpen(open);
    setTxt("");
  }
  const ok = !confirmText || txt.trim().toUpperCase() === confirmText.toUpperCase();
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-[13px] text-[#c9cbd3] font-semibold leading-relaxed">{message}</p>
      {confirmText ? (
        <div className="mt-4">
          <div className="text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-[#8e919c] mb-2">
            Escribe <span className="text-[#ff8095]">{confirmText}</span> para habilitar la acción
          </div>
          <TextInput value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={confirmText} maxLength={30} />
        </div>
      ) : null}
      <div className="flex justify-end gap-2 mt-6">
        <Btn variant="ghost" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn
          variant={danger ? "red" : "silver"}
          disabled={!ok}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

/* ---------------- Chips ---------------- */
export function StatusChip({ status, big }: { status: TournamentStatus; big?: boolean }) {
  const map: Record<TournamentStatus, string> = {
    open: "bg-white/10 text-[#d9dbe1] border-white/20",
    closed: "bg-[#ffb830]/12 text-[#ffb830] border-[#ffb830]/45",
    mixing: "bg-[#e8102e]/20 text-[#ff8095] border-[#e8102e]/60 live-glow",
    live: "bg-[linear-gradient(160deg,#ff2440,#a30d24)] text-white border-[#ff2440]/60 live-glow",
    stopped: "bg-[#6b6e78]/20 text-[#c9cbd3] border-[#8e919c]/50",
    finished: "bg-[#ffb830]/15 text-[#ffb830] border-[#ffb830]/50",
  };
  const dot: Record<TournamentStatus, string> = {
    open: "bg-[#d9dbe1]",
    closed: "bg-[#ffb830]",
    mixing: "bg-[#ff2440] blink",
    live: "bg-white blink",
    stopped: "bg-[#c9cbd3] blink",
    finished: "bg-[#ffb830]",
  };
  return (
    <span
      className={`chip clip-tag border ${map[status]} ${big ? "text-[12px] px-4 py-1.5" : ""}`}
      aria-label={STATUS_LABEL[status]}
    >
      <span className={`w-1.5 h-1.5 ${dot[status]}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ModalityChip({ modality, big }: { modality: number; big?: boolean }) {
  return (
    <span className={`chip clip-tag bg-[linear-gradient(180deg,#f7f7f9,#b9bdc7)] text-[#141519] ${big ? "text-[12px] px-4 py-1.5" : ""}`}>
      {MODALITY_LABEL[modality] ?? `${modality}v${modality}`}
    </span>
  );
}

/* ---------------- Fondo de arena (negro + rojo angular) ---------------- */
export function Backdrop({ variant = "app" }: { variant?: "app" | "show" }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#070708] noise vignette" aria-hidden>
      {/* polígono rojo principal (derecha) */}
      <div
        className="absolute"
        style={{
          top: "-12%",
          right: "-18%",
          width: "62vw",
          height: "130%",
          background: "linear-gradient(215deg, #ff2440 -5%, #c00d24 30%, #6e0a1a 72%, #2a040b 100%)",
          clipPath: "polygon(38% 0, 100% 0, 100% 100%, 0 100%)",
          opacity: variant === "show" ? 0.95 : 0.8,
          transform: "skewX(-4deg)",
        }}
      />
      {/* banda diagonal oscura */}
      <div
        className="absolute"
        style={{
          top: "-20%",
          left: "8%",
          width: "34vw",
          height: "150%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.008))",
          clipPath: "polygon(0 0, 34% 0, 78% 100%, 0 100%)",
          transform: "skewX(-8deg)",
          opacity: 0.5,
        }}
      />
      {/* franja roja diagonal inferior izquierda */}
      <div
        className="absolute"
        style={{
          bottom: "-30%",
          left: "-14%",
          width: "55vw",
          height: "80%",
          background: "linear-gradient(25deg, #e8102e 0%, #6e0a1a 55%, transparent 100%)",
          clipPath: "polygon(0 30%, 100% 0, 100% 26%, 0 78%)",
          opacity: 0.42,
        }}
      />
      {/* líneas diagonales sutiles */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-60deg, rgba(255,255,255,0.022) 0 2px, transparent 2px 110px)",
        }}
      />
      {/* glow radial */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === "show"
              ? "radial-gradient(70% 55% at 50% 36%, rgba(232,16,46,0.16), transparent 70%)"
              : "radial-gradient(55% 45% at 70% 20%, rgba(232,16,46,0.13), transparent 70%)",
        }}
      />
      {variant === "show" ? <div className="absolute inset-0 scanline" /> : null}
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-16 h-16 mb-5 flex items-center justify-center border border-white/12 bg-white/[0.03] clip-card text-[#e8102e]">
        {icon}
      </div>
      <h3 className="font-display italic text-[20px] uppercase text-white mb-2">{title}</h3>
      <p className="text-[12px] text-[#8e919c] font-semibold max-w-sm leading-relaxed mb-6">{message}</p>
      {action}
    </div>
  );
}
