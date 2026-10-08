"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addAgendaEvent,
  dayRelation,
  deleteAgendaEvent,
  fmtDayLabel,
  fmtTimeParts,
  localDateKey,
  updateAgendaEvent,
  useAgenda,
  type AgendaEvent,
  type AgendaInput,
} from "@/lib/agenda";
import { Btn, Confirm, EmptyState, Field, IconBtn, Modal, TextInput } from "./ui";

/* ============================================================
   AgendaManager — sección COMPLETA (no modal) de Configuración.
   · Agenda de eventos con fecha y hora; se puede crear, editar
     y eliminar.
   · Puede contener días anteriores y posteriores: en el visor
     SOLO se muestra lo del día en curso (barra inferior de la
     pantalla de espera).
   ============================================================ */

function AgendaForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AgendaEvent | null;
  submitLabel: string;
  onSubmit: (input: AgendaInput) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? localDateKey());
  const [time, setTime] = useState(initial?.time ?? "12:00");
  const [note, setNote] = useState(initial?.note ?? "");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Escribe el título del evento");
      return;
    }
    if (!date || !time) {
      toast.error("Indica fecha y hora del evento");
      return;
    }
    onSubmit({ title, date, time, note });
  };

  return (
    <div className="space-y-3">
      <Field label="Título del evento">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="EJ. INICIO DE TORNEO · COPA HYPERX"
          maxLength={80}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora">
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Nota (opcional)">
        <TextInput
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="EJ. ESCENARIO PRINCIPAL · FASE DE GRUPOS"
          maxLength={90}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Btn variant="ghost" onClick={onCancel}>
            Cancelar
          </Btn>
        ) : null}
        <Btn variant="red" onClick={submit}>
          <CalendarPlus size={13} />
          {submitLabel}
        </Btn>
      </div>
    </div>
  );
}

function AgendaRow({
  ev,
  today,
  onEdit,
  onDelete,
}: {
  ev: AgendaEvent;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rel = dayRelation(ev.date, today);
  const t = fmtTimeParts(ev.time);
  const [y, m, d] = ev.date.split("-").map(Number);
  const dayTile = new Date(y || 2000, (m || 1) - 1, d || 1);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`panel-2 clip-card-sm p-3 flex items-center gap-3 ${
        rel === "today" ? "border-[#e8102e]/45 bg-[#e8102e]/[0.06]" : rel === "past" ? "opacity-45" : ""
      }`}
    >
      {/* tile del día */}
      <div className="w-[54px] shrink-0 clip-badge bg-black/40 border border-white/10 flex flex-col items-center justify-center py-1.5">
        <span className="text-[7.5px] font-extrabold tracking-[0.18em] uppercase text-[#8e919c]">
          {dayTile.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "")}
        </span>
        <span className="font-display italic text-[19px] leading-none text-white">{d}</span>
        <span className="text-[7.5px] font-extrabold tracking-[0.14em] uppercase text-[#8e919c]">
          {dayTile.toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}
        </span>
      </div>

      {/* hora + título */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="red-badge clip-badge px-2 py-[2px] text-[10px] font-extrabold tabular-nums">
            {t.hhmm12} <span className="text-[7px] opacity-75">{t.ampm}</span>
          </span>
          {rel === "today" ? (
            <span className="chip clip-tag bg-[#e8102e]/20 text-[#ff8095] border border-[#e8102e]/50 !text-[7px] !px-1.5 !py-[2px] tracking-[0.16em]">
              Hoy
            </span>
          ) : rel === "future" ? (
            <span className="text-[8px] font-extrabold tracking-[0.14em] uppercase text-[#6b6e78]">
              {fmtDayLabel(ev.date)}
            </span>
          ) : (
            <span className="text-[8px] font-extrabold tracking-[0.14em] uppercase text-[#6b6e78]">
              Día pasado · {fmtDayLabel(ev.date)}
            </span>
          )}
        </div>
        <div className="text-[12px] font-extrabold uppercase text-white truncate mt-1" title={ev.title}>
          {ev.title}
        </div>
        {ev.note ? (
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <StickyNote size={9} className="text-[#6b6e78] shrink-0" />
            <span className="text-[10px] font-semibold text-[#8e919c] truncate">{ev.note}</span>
          </div>
        ) : null}
      </div>

      {/* acciones */}
      <div className="flex items-center gap-1.5 shrink-0">
        <IconBtn title="Editar evento" onClick={onEdit}>
          <Pencil size={13} />
        </IconBtn>
        <IconBtn danger title="Eliminar evento" onClick={onDelete}>
          <Trash2 size={13} />
        </IconBtn>
      </div>
    </motion.div>
  );
}

export function AgendaManager({ onBack }: { onBack: () => void }) {
  const { data: events, loading } = useAgenda();
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [deleting, setDeleting] = useState<AgendaEvent | null>(null);
  /* día en curso fijado al montar la sección (la agenda se gestiona por sesión) */
  const today = React.useMemo(() => localDateKey(), []);

  const handleAdd = async (input: AgendaInput) => {
    try {
      await addAgendaEvent(input);
      toast.success("Evento agregado a la agenda");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al agregar el evento");
    }
  };

  const handleUpdate = async (input: AgendaInput) => {
    if (!editing) return;
    try {
      await updateAgendaEvent(editing.id, input);
      toast.success("Evento actualizado");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    }
  };

  const todayCount = events.filter((e) => e.date === today).length;

  return (
    <div>
      {/* ===== encabezado de la sección ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              title="Volver a torneos"
              aria-label="Volver a torneos"
              className="btn-press p-2 border border-white/15 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
            >
              <ArrowLeft size={16} />
            </button>
            <h2 className="font-display italic text-[26px] sm:text-[32px] uppercase leading-none">
              <span className="text-silver-grad">Agenda de</span> <span className="text-red-grad">Eventos</span>
            </h2>
          </div>
          <p className="text-[11px] text-[#8e919c] font-bold tracking-[0.14em] uppercase mt-2 ml-[52px]">
            Crea, edita o elimina eventos · en el visor se muestra lo del día en curso
          </p>
        </div>
        <span className="chip clip-tag bg-[#ffb830]/12 border border-[#ffb830]/35 text-[#ffb830] text-[10px] px-3 py-1.5">
          <CalendarDays size={11} />
          {todayCount} evento{todayCount === 1 ? "" : "s"} hoy
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        {/* ===== formulario ===== */}
        <div className="panel clip-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarPlus size={14} className="text-[#e8102e]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white">Nuevo evento</span>
          </div>
          <AgendaForm submitLabel="Agregar evento" onSubmit={handleAdd} />
          <p className="text-[9.5px] font-semibold text-[#6b6e78] mt-4 leading-relaxed">
            Los eventos se sincronizan en tiempo real. En la pantalla de espera del visor solo desfila lo de HOY en la barra
            inferior.
          </p>
        </div>

        {/* ===== lista ===== */}
        <div className="panel clip-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock3 size={14} className="text-[#ffb830]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white">
              Agenda completa · {events.length} evento{events.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <div className="text-[11px] font-bold text-[#6b6e78] uppercase py-8 text-center">Cargando…</div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={26} />}
              title="Agenda vacía"
              message="Agrega el primer evento con el formulario: título, fecha, hora y una nota opcional."
            />
          ) : (
            <div className="space-y-2 max-h-[54vh] overflow-y-auto pr-1 scroll-slim">
              <AnimatePresence initial={false}>
                {events.map((ev) => (
                  <AgendaRow
                    key={ev.id}
                    ev={ev}
                    today={today}
                    onEdit={() => setEditing(ev)}
                    onDelete={() => setDeleting(ev)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ===== editar ===== */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar evento">
        {editing ? (
          <AgendaForm key={editing.id} initial={editing} submitLabel="Guardar cambios" onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
        ) : null}
      </Modal>

      {/* ===== eliminar ===== */}
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        confirmLabel="Eliminar"
        title="Eliminar evento"
        message={`Se eliminará "${deleting?.title}" (${deleting ? fmtDayLabel(deleting.date) : ""} · ${deleting?.time}) de la agenda. Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteAgendaEvent(deleting.id);
            toast.success("Evento eliminado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al eliminar");
          }
        }}
      />
    </div>
  );
}
