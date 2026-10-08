"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  Cast,
  Clock,
  Eye,
  Film,
  Image as ImageIcon,
  Music,
  Pencil,
  Plus,
  Timer,
  Trash2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { Modality, Tournament } from "@/lib/types";
import { MODALITY_LABEL, STATUS_LABEL, playersCapacity, teamSize } from "@/lib/types";
import { createTournament, deleteTournament, updateTournament, type TournamentInput } from "@/lib/actions";
import { fmtDateLong, toLocalInputValue, fromLocalInputValue } from "@/lib/bracket";
import { Btn, Confirm, EmptyState, Field, IconBtn, Modal, ModalityChip, Segmented, StatusChip, TextInput } from "./ui";
import { SoundsConfig } from "./SoundsConfig";
import { VideosManager } from "./VideosManager";
import { AgendaManager } from "./AgendaManager";
import { ObsStreamManager } from "./ObsStreamManager";

/* ============================================================
   Vista CONFIGURACIÓN — crear y administrar torneos
   ============================================================ */

async function fileToLogo(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("No se pudo leer el archivo"));
    fr.readAsDataURL(file);
  });
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      if (!ctx) return res(dataUrl);
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      res(file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

function TournamentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Tournament | null;
  onSave: (data: TournamentInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [logo, setLogo] = useState<string | null>(initial?.logo ?? null);
  const [modality, setModality] = useState<Modality>(initial?.modality ?? 1);
  const [seats, setSeats] = useState<number>(initial?.seats ?? 32);
  const [bankSeats, setBankSeats] = useState<number>(initial?.bankSeats ?? 10);
  const [winsNeeded, setWinsNeeded] = useState<number>(initial?.winsNeeded ?? 2);
  const [matchMins, setMatchMins] = useState<number>(initial?.matchMins ?? 10);
  const [startAt, setStartAt] = useState<string>(toLocalInputValue(initial?.startAt ?? null));
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const seatOptions = [2, 4, 8, 16, 32, 64].map((s) => ({ value: s, label: `${s * teamSize(modality)} JUG` }));

  const submit = () => {
    if (!name.trim()) {
      toast.error("El nombre del torneo es obligatorio");
      return;
    }
    onSave({
      name: name.trim(),
      logo,
      modality,
      seats,
      bankSeats: Math.max(0, Math.min(30, bankSeats)),
      winsNeeded: Math.max(1, Math.min(9, winsNeeded)),
      matchMins: Math.max(1, Math.min(180, matchMins)),
      startAt: fromLocalInputValue(startAt),
      venue: venue.trim(),
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      {/* logo + nombre */}
      <div className="flex gap-4 items-start">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-press relative shrink-0 w-[74px] h-[74px] clip-card border border-white/15 bg-white/[0.04] flex items-center justify-center overflow-hidden hover:border-[#e8102e]/70"
          aria-label="Subir logo del torneo"
        >
          {logo ? (
             
            <img src={logo} alt="Logo del torneo" className="w-full h-full object-contain" />
          ) : (
            <ImageIcon size={22} className="text-[#8e919c]" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setLogo(await fileToLogo(f));
          }}
        />
        <div className="flex-1 space-y-3">
          <Field label="Nombre del torneo">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="EJ. COPA HYPERX CLASIFICATORIA" maxLength={60} />
          </Field>
          <Field label="Sede / Venue (opcional)">
            <TextInput value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="EJ. ARENA GAMING · CDMX" maxLength={60} />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Modalidad">
          <Segmented
            value={modality}
            onChange={(v) => setModality(v)}
            options={([1, 2, 3, 4, 5] as Modality[]).map((m) => ({ value: m, label: MODALITY_LABEL[m] }))}
          />
        </Field>
        <Field label="Jugadores participantes" hint={`→ ${seats} asientos de bracket`}>
          <Segmented value={seats} onChange={(v) => setSeats(v)} options={seatOptions} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Banco (reservas)">
          <TextInput
            type="number"
            min={0}
            max={30}
            value={bankSeats}
            onChange={(e) => setBankSeats(Number(e.target.value))}
          />
        </Field>
        <Field label="Victorias / match">
          <TextInput
            type="number"
            min={1}
            max={9}
            value={winsNeeded}
            onChange={(e) => setWinsNeeded(Number(e.target.value))}
          />
        </Field>
        <Field label="Duración est. (min)">
          <TextInput
            type="number"
            min={1}
            max={180}
            value={matchMins}
            onChange={(e) => setMatchMins(Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Hora de inicio (para el contador del visor)">
        <TextInput type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Btn variant="ghost" onClick={onCancel}>
          Cancelar
        </Btn>
        <Btn variant="red" type="submit">
          <Trophy size={13} />
          {initial ? "Guardar cambios" : "Crear torneo"}
        </Btn>
      </div>
    </form>
  );
}

function TournamentCard({
  t,
  playerCount,
  bankCount,
  onEdit,
  onDelete,
  onRegister,
  onLive,
  onViewer,
}: {
  t: Tournament;
  playerCount: number;
  bankCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onRegister: () => void;
  onLive: () => void;
  onViewer: () => void;
}) {
  const cap = playersCapacity(t);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel clip-card hover-lift p-5 flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 shrink-0 clip-card-sm border border-white/12 bg-black/40 flex items-center justify-center overflow-hidden">
          {t.logo ? (
             
            <img src={t.logo} alt={`Logo ${t.name}`} className="w-full h-full object-contain" />
          ) : (
            <Trophy size={20} className="text-[#e8102e]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display italic text-[19px] leading-tight uppercase truncate" title={t.name}>
            {t.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <StatusChip status={t.status} />
            <ModalityChip modality={t.modality} />
            <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
              {MODALITY_LABEL[t.modality]} · {cap} JUGADORES
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
        <div className="panel-2 clip-card-sm px-3 py-2 flex items-center gap-2">
          <Users size={13} className="text-[#e8102e] shrink-0" />
          <span className="text-[#8e919c]">Oficiales</span>
          <span className="ml-auto text-white tabular-nums">
            {playerCount}/{cap}
          </span>
        </div>
        <div className="panel-2 clip-card-sm px-3 py-2 flex items-center gap-2">
          <Zap size={13} className="text-[#ffb830] shrink-0" />
          <span className="text-[#8e919c]">Banco</span>
          <span className="ml-auto text-white tabular-nums">
            {bankCount}/{t.bankSeats}
          </span>
        </div>
        <div className="panel-2 clip-card-sm px-3 py-2 flex items-center gap-2">
          <Timer size={13} className="text-[#8e919c] shrink-0" />
          <span className="text-[#8e919c]">Match</span>
          <span className="ml-auto text-white">{t.matchMins} min · a {t.winsNeeded}</span>
        </div>
        <div className="panel-2 clip-card-sm px-3 py-2 flex items-center gap-2 min-w-0">
          <Calendar size={13} className="text-[#8e919c] shrink-0" />
          <span className="truncate text-[#c9cbd3]">
            {t.startAt ? fmtDateLong(t.startAt) : "Sin fecha"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <Btn small variant="dark" onClick={onEdit}>
          <Pencil size={11} />
          Editar
        </Btn>
        <Btn small variant="dark" onClick={onRegister}>
          <Users size={11} />
          Registro
        </Btn>
        <Btn small variant="red" onClick={onLive} disabled={t.status === "finished"}>
          Administrar
        </Btn>
        <div className="ml-auto flex gap-1.5">
          <IconBtn title="Abrir visor para espectadores" onClick={onViewer}>
            <Eye size={14} />
          </IconBtn>
          <IconBtn title="Eliminar torneo" danger onClick={onDelete}>
            <Trash2 size={14} />
          </IconBtn>
        </div>
      </div>
    </motion.div>
  );
}

export function TournamentsView({
  tournaments,
  loading,
  error,
  playerCounts,
  bankCounts,
  onGoRegister,
  onGoLive,
  onOpenViewer,
  obsNonce = 0,
}: {
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  playerCounts: Record<string, number>;
  bankCounts: Record<string, number>;
  onGoRegister: (tid: string) => void;
  onGoLive: (tid: string) => void;
  onOpenViewer: () => void;
  /** increments cuando el botón del header pide abrir la sección Transmisión OBS */
  obsNonce?: number;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [deleting, setDeleting] = useState<Tournament | null>(null);
  const [busy, setBusy] = useState(false);
  const [soundsOpen, setSoundsOpen] = useState(false);
  /* Secciones que se abren en VISTA COMPLETA (no en ventana): Videos, Agenda y Transmisión OBS */
  const [subView, setSubView] = useState<null | "videos" | "agenda" | "obs">(null);

  /* el botón "Transmisión OBS" del header salta directo a la sección */
  React.useEffect(() => {
    if (obsNonce > 0) setSubView("obs");
  }, [obsNonce]);

  /* --- Sección Videos (pantalla completa de la pestaña) --- */
  if (subView === "videos") {
    return <VideosManager onBack={() => setSubView(null)} />;
  }
  /* --- Sección Agenda (pantalla completa de la pestaña) --- */
  if (subView === "agenda") {
    return <AgendaManager onBack={() => setSubView(null)} />;
  }
  /* --- Sección Transmisión OBS (pantalla completa de la pestaña) --- */
  if (subView === "obs") {
    return <ObsStreamManager onBack={() => setSubView(null)} />;
  }

  const save = async (data: TournamentInput) => {
    setBusy(true);
    try {
      if (editing) {
        await updateTournament(editing.id, data);
        toast.success("Torneo actualizado");
      } else {
        await createTournament(data);
        toast.success("Torneo creado");
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
            <span className="text-silver-grad">Configuración de</span> <span className="text-red-grad">Torneos</span>
          </h2>
          <p className="text-[11px] text-[#8e919c] font-bold tracking-[0.14em] uppercase mt-2">
            Crea y administra múltiples torneos · modalidad · brackets · banco de reservas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            variant="dark"
            onClick={() => setSubView("videos")}
            title="Videos de la pantalla de espera del visor — subir, listar, resincronizar y elegir cuáles se reproducen"
          >
            <Film size={14} />
            Videos
          </Btn>
          <Btn
            variant="dark"
            onClick={() => setSubView("agenda")}
            title="Agenda de eventos con horario — se desfila en la barra inferior de la pantalla de espera"
          >
            <CalendarDays size={14} />
            Agenda
          </Btn>
          <Btn
            variant="dark"
            onClick={() => setSubView("obs")}
            title="Transmisión OBS — URLs para que OBS transmita a la app y tamaño en píxeles del visor"
          >
            <Cast size={14} />
            Transmisión OBS
          </Btn>
          <Btn
            variant="dark"
            onClick={() => setSoundsOpen(true)}
            title="Personalizar sonidos de la app"
          >
            <Music size={14} />
            Sonidos
          </Btn>
          <Btn
            variant="red"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={14} />
            Nuevo torneo
          </Btn>
        </div>
      </div>

      {error ? (
        <div className="panel clip-card p-4 border-[#e8102e]/50 text-[12px] font-bold text-[#ff8095]">
          Error de conexión con Firebase: {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel clip-card p-5 h-56 animate-pulse" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="panel clip-card">
          <EmptyState
            icon={<Trophy size={26} />}
            title="Aún no hay torneos"
            message="Crea tu primer torneo: define la modalidad (1v1 a 4v4), la cantidad de jugadores, el banco de reservas y el horario de inicio."
            action={
              <Btn variant="red" onClick={() => setFormOpen(true)}>
                <Plus size={14} />
                Crear el primer torneo
              </Btn>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              playerCount={playerCounts[t.id] ?? 0}
              bankCount={bankCounts[t.id] ?? 0}
              onEdit={() => {
                setEditing(t);
                setFormOpen(true);
              }}
              onDelete={() => setDeleting(t)}
              onRegister={() => onGoRegister(t.id)}
              onLive={() => onGoLive(t.id)}
              onViewer={() => onOpenViewer()}
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
        title={editing ? "Editar torneo" : "Nuevo torneo"}
        wide
      >
        {formOpen ? (
          <TournamentForm
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
        title="Eliminar torneo"
        message={`Se eliminará "${deleting?.name}" junto con todos sus jugadores registrados y su bracket. Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteTournament(deleting.id);
            toast.success("Torneo eliminado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al eliminar");
          }
        }}
      />

      <SoundsConfig open={soundsOpen} onClose={() => setSoundsOpen(false)} />
    </div>
  );
}
