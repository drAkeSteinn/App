"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Eye, Music, Palette, Pencil, Plus, Sparkles, Trash2, Trophy, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Contest, ContestType } from "@/lib/contests";
import { createContest, deleteContest, updateContest } from "@/lib/contests";
import { useContests } from "@/lib/contestHooks";
import { Btn, Confirm, EmptyState, Field, IconBtn, Modal, Segmented, TextInput } from "./ui";

/* ============================================================
   ContestsView — administración de concursos express.
   Crear/listar concursos de Sonidos Gamer y Cosplayer.
   ============================================================ */

const TYPE_META: Record<ContestType, { label: string; icon: React.ReactNode; desc: string }> = {
  cosplay: {
    label: "Cosplayer",
    icon: <Palette size={14} />,
    desc: "Decidido por aplausos del público — elimina participantes y corona al ganador.",
  },
  sound: {
    label: "Sonidos Gamer",
    icon: <Music size={14} />,
    desc: "Sube sonidos, reprodúcelos y suma score a quien adivine de qué juego son.",
  },
};

function ContestForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Contest | null;
  onSave: (data: { type: ContestType; name: string }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ContestType>(initial?.type ?? "cosplay");
  const [name, setName] = useState(initial?.name ?? "");
  const submit = () => {
    if (!name.trim()) {
      toast.error("El nombre del concurso es obligatorio");
      return;
    }
    onSave({ type, name: name.trim() });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <Field label="Tipo de concurso">
        <Segmented
          value={type}
          onChange={(v) => setType(v)}
          options={[
            { value: "cosplay" as ContestType, label: "Cosplayer" },
            { value: "sound" as ContestType, label: "Sonidos Gamer" },
          ]}
        />
      </Field>
      <Field label="Nombre del concurso">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="EJ. CONCURSO DE COSPLAY HYPERX"
          maxLength={60}
        />
      </Field>
      <div className="panel-2 clip-card-sm p-3 text-[11px] font-semibold text-[#8e919c] leading-relaxed">
        {TYPE_META[type].icon} {TYPE_META[type].desc}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Btn variant="ghost" onClick={onCancel}>
          Cancelar
        </Btn>
        <Btn variant="red" type="submit">
          <Trophy size={13} />
          {initial ? "Guardar cambios" : "Crear concurso"}
        </Btn>
      </div>
    </form>
  );
}

function ContestCard({
  c,
  participantCount,
  onEdit,
  onDelete,
  onAdmin,
  onViewer,
}: {
  c: Contest;
  participantCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onAdmin: () => void;
  onViewer: () => void;
}) {
  const meta = TYPE_META[c.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel clip-card hover-lift p-5 flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 shrink-0 clip-card-sm border border-white/12 bg-black/40 flex items-center justify-center text-[#e8102e]">
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display italic text-[19px] leading-tight uppercase truncate" title={c.name}>
            {c.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`chip clip-tag ${c.status === "live" ? "bg-[#e8102e] text-white" : c.status === "finished" ? "bg-[#ffb830] text-[#241500]" : "bg-white/[0.06] text-[#c9cbd3] border border-white/10"}`}>
              {c.status === "register" ? "REGISTRO" : c.status === "live" ? "EN VIVO" : "FINALIZADO"}
            </span>
            <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
              {meta.label}
            </span>
            <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
              <Users size={11} />
              {participantCount}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-auto pt-1">
        <Btn small variant="dark" onClick={onEdit}>
          <Pencil size={11} />
          Editar
        </Btn>
        <Btn small variant="red" onClick={onAdmin}>
          <Sparkles size={11} />
          Administrar
        </Btn>
        <div className="ml-auto flex gap-1.5">
          <IconBtn title="Abrir visor" onClick={onViewer}>
            <Eye size={14} />
          </IconBtn>
          <IconBtn title="Eliminar concurso" danger onClick={onDelete}>
            <Trash2 size={14} />
          </IconBtn>
        </div>
      </div>
    </motion.div>
  );
}

export function ContestsView({
  onAdmin,
  onViewer,
}: {
  onAdmin: (cid: string) => void;
  onViewer: () => void;
}) {
  const { data: contests, loading } = useContests();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contest | null>(null);
  const [deleting, setDeleting] = useState<Contest | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (data: { type: ContestType; name: string }) => {
    setBusy(true);
    try {
      if (editing) {
        await updateContest(editing.id, data);
        toast.success("Concurso actualizado");
      } else {
        await createContest(data);
        toast.success("Concurso creado");
      }
      setFormOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display italic text-[26px] sm:text-[32px] uppercase leading-none">
            <span className="text-silver-grad">Concursos</span> <span className="text-red-grad">Express</span>
          </h2>
          <p className="text-[11px] text-[#8e919c] font-bold tracking-[0.14em] uppercase mt-2">
            Concursos de Sonidos Gamer y Cosplayer · registro + votación en vivo
          </p>
        </div>
        <Btn
          variant="red"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={14} />
          Nuevo concurso
        </Btn>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel clip-card p-5 h-48 animate-pulse" />
          ))}
        </div>
      ) : contests.length === 0 ? (
        <div className="panel clip-card">
          <EmptyState
            icon={<Sparkles size={26} />}
            title="Aún no hay concursos"
            message="Crea un concurso de Cosplayer o de Sonidos Gamer para empezar."
            action={
              <Btn variant="red" onClick={() => setFormOpen(true)}>
                <Plus size={14} />
                Crear el primer concurso
              </Btn>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contests.map((c) => (
            <ContestCard
              key={c.id}
              c={c}
              participantCount={0}
              onEdit={() => {
                setEditing(c);
                setFormOpen(true);
              }}
              onDelete={() => setDeleting(c)}
              onAdmin={() => onAdmin(c.id)}
              onViewer={onViewer}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Editar concurso" : "Nuevo concurso"}
      >
        {formOpen ? (
          <ContestForm
            key={editing?.id ?? "new"}
            initial={editing}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSave={save}
          />
        ) : null}
      </Modal>

      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        confirmLabel="Eliminar todo"
        title="Eliminar concurso"
        message={`Se eliminará "${deleting?.name}" junto con todos sus participantes y sonidos. Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteContest(deleting.id);
            toast.success("Concurso eliminado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al eliminar");
          }
        }}
      />
    </div>
  );
}
