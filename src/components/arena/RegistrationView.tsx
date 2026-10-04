"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  BadgeCheck,
  Bot,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  UserPlus,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { Player, SeatType, Tournament } from "@/lib/types";
import { MODALITY_LABEL, isTeamModality, playersCapacity } from "@/lib/types";
import { addPlayer, deletePlayer, fillSeats, removeDemoPlayers, updatePlayer, wipeRegistrations, type PlayerInput } from "@/lib/actions";
import { Btn, Confirm, EmptyState, Field, IconBtn, Modal, ModalityChip, Segmented, TextInput } from "./ui";

/* ============================================================
   Vista REGISTRO — alta/edición de jugadores + banco de reservas
   ============================================================ */

function PlayerForm({
  tournament,
  initial,
  officialFull,
  bankFull,
  teamNames,
  onSave,
  onCancel,
}: {
  tournament: Tournament;
  initial?: Player | null;
  officialFull: boolean;
  bankFull: boolean;
  teamNames: string[];
  onSave: (data: PlayerInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nick, setNick] = useState(initial?.nick ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [team, setTeam] = useState(initial?.team ?? "");
  const defaultSeat: SeatType = initial ? initial.seat : officialFull ? "bank" : "off";
  const [seat, setSeat] = useState<SeatType>(defaultSeat);

  const submit = () => {
    if (!name.trim() || !nick.trim()) {
      toast.error("Nombre y nick son obligatorios");
      return;
    }
    onSave({
      name: name.trim(),
      nick: nick.trim(),
      phone: phone.trim(),
      team: isTeamModality(tournament.modality) ? team.trim() : "",
      seat,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre del jugador">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="NOMBRE COMPLETO" maxLength={60} />
        </Field>
        <Field label="Nick">
          <TextInput value={nick} onChange={(e) => setNick(e.target.value)} placeholder="GAMERTAG" maxLength={24} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Número de teléfono">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55 0000 0000" inputMode="tel" maxLength={20} />
        </Field>
        {isTeamModality(tournament.modality) ? (
          <Field label={`Equipo (${MODALITY_LABEL[tournament.modality]})`} hint="Autocompleta con equipos existentes o escribe uno nuevo">
            <div className="relative">
              <TextInput
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="NOMBRE DE EQUIPO"
                maxLength={30}
                list="team-names"
              />
              <datalist id="team-names">
                {teamNames.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </Field>
        ) : null}
      </div>

      <Field label="Tipo de asiento" hint={officialFull && !initial ? "Cupos oficiales llenos: el registro pasa al banco" : undefined}>
        <Segmented
          value={seat}
          onChange={(v) => {
            if (v === "off" && officialFull && initial?.seat !== "off") {
              toast.error("Los cupos oficiales están llenos");
              return;
            }
            if (v === "bank" && bankFull && initial?.seat !== "bank") {
              toast.error("El banco está lleno");
              return;
            }
            setSeat(v);
          }}
          options={[
            { value: "off" as SeatType, label: `Oficial · ${officialFull ? "LLENO" : "DISPONIBLE"}` },
            { value: "bank" as SeatType, label: `Banco · ${bankFull ? "LLENO" : "DISPONIBLE"}` },
          ]}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onCancel}>
          Cancelar
        </Btn>
        <Btn variant="red" type="submit">
          <UserPlus size={13} />
          {initial ? "Guardar cambios" : "Registrar jugador"}
        </Btn>
      </div>
    </form>
  );
}

function PlayerRow({
  p,
  tournament,
  onEdit,
  onDelete,
  onToggleSeat,
  canPromote,
  canDemote,
}: {
  p: Player;
  tournament: Tournament;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSeat: () => void;
  canPromote: boolean;
  canDemote: boolean;
}) {
  const isBank = p.seat === "bank";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 14 }}
      transition={{ duration: 0.22 }}
      className="panel-2 clip-card-sm flex items-center gap-3 px-3 py-2.5"
    >
      {/* nick plate */}
      <div
        className={`shrink-0 w-[104px] clip-badge flex items-center justify-center px-2 py-1.5 ${
          isBank ? "bg-[#1d1d25] border border-[#ffb830]/40" : "plate"
        }`}
      >
        <span className={`text-[12px] font-extrabold uppercase truncate ${isBank ? "text-[#ffb830]" : "text-[#141519]"}`}>
          {p.nick}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-bold text-white truncate">{p.name}</span>
          {isBank ? (
            <span className="chip clip-tag bg-[#ffb830]/15 text-[#ffb830] border border-[#ffb830]/40 text-[8px] px-1.5 py-[1px] shrink-0">
              BANCO
            </span>
          ) : (
            <span className="chip clip-tag bg-white/[0.07] text-[#c9cbd3] border border-white/10 text-[8px] px-1.5 py-[1px] shrink-0">
              OFICIAL
            </span>
          )}
          {p.demo ? (
            <span className="chip clip-tag bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/40 text-[8px] px-1.5 py-[1px] shrink-0">
              DEMO
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#8e919c] font-semibold mt-0.5 min-w-0">
          {p.phone ? (
            <span className="flex items-center gap-1 truncate">
              <Phone size={9} />
              {p.phone}
            </span>
          ) : null}
          {p.team ? (
            <span className="flex items-center gap-1 truncate">
              <ShieldCheck size={9} className="text-[#e8102e]" />
              {p.team}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <IconBtn
          title={isBank ? "Promover a oficial" : "Mover al banco"}
          onClick={onToggleSeat}
          disabled={isBank ? !canPromote : !canDemote}
        >
          {isBank ? <ArrowUpToLine size={13} /> : <ArrowDownToLine size={13} />}
        </IconBtn>
        <IconBtn title="Editar jugador" onClick={onEdit}>
          <Pencil size={13} />
        </IconBtn>
        <IconBtn title="Eliminar jugador" danger onClick={onDelete}>
          <Trash2 size={13} />
        </IconBtn>
      </div>
    </motion.div>
  );
}

export function RegistrationView({
  tournament,
  players,
  loading,
}: {
  tournament: Tournament | null;
  players: Player[];
  loading: boolean;
}) {
  const [tab, setTab] = useState<"off" | "bank">("off");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);
  const [fillOpen, setFillOpen] = useState(false);
  const [demosOpen, setDemosOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);

  const cap = tournament ? playersCapacity(tournament) : 0;
  const officials = useMemo(() => players.filter((p) => p.seat === "off"), [players]);
  const bank = useMemo(() => players.filter((p) => p.seat === "bank"), [players]);
  const teamNames = useMemo(
    () => Array.from(new Set(players.map((p) => p.team.trim()).filter(Boolean))),
    [players]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tab === "off" ? officials : bank;
    if (!q) return list;
    return list.filter(
      (p) => p.nick.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.team.toLowerCase().includes(q)
    );
  }, [search, tab, officials, bank]);

  const officialFull = officials.length >= cap;
  const bankFull = bank.length >= (tournament?.bankSeats ?? 0);
  const missing = Math.max(0, cap - officials.length);
  const demoCount = useMemo(() => players.filter((p) => p.demo).length, [players]);

  const save = async (data: PlayerInput) => {
    if (!tournament) return;
    try {
      if (editing) {
        await updatePlayer(tournament.id, editing.id, data);
        toast.success("Jugador actualizado");
      } else {
        await addPlayer(tournament.id, data);
        toast.success(`${data.nick} registrado`);
      }
      setAddOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  if (!tournament) {
    return (
      <div className="panel clip-card">
        <EmptyState
          icon={<Users size={26} />}
          title="Selecciona un torneo"
          message="Elige un torneo en el selector superior para registrar jugadores y administrar el banco de reservas."
        />
      </div>
    );
  }

  const pctOff = cap ? Math.min(100, (officials.length / cap) * 100) : 0;
  const pctBank = tournament.bankSeats ? Math.min(100, (bank.length / tournament.bankSeats) * 100) : 0;

  return (
    <div>
      {/* encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h2 className="font-display italic text-[26px] sm:text-[32px] uppercase leading-none">
            <span className="text-silver-grad">Registro de</span> <span className="text-red-grad">Jugadores</span>
          </h2>
          <p className="text-[11px] text-[#8e919c] font-bold tracking-[0.14em] uppercase mt-2 flex items-center gap-2 flex-wrap">
            <span>{tournament.name}</span>
            <ModalityChip modality={tournament.modality} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {demoCount > 0 ? (
            <Btn variant="ghost" onClick={() => setDemosOpen(true)} title="Elimina los jugadores generados automáticamente">
              <Bot size={14} />
              Quitar demo ({demoCount})
            </Btn>
          ) : null}
          <Btn variant="dark" disabled={missing <= 0} onClick={() => setFillOpen(true)} title={missing <= 0 ? "Los asientos ya están completos" : "Completa los cupos con jugadores de demostración"}>
            <Wand2 size={14} />
            Llenar lugares{missing > 0 ? ` (${missing})` : ""}
          </Btn>
          <Btn
            variant="red"
            onClick={() => {
              setEditing(null);
              setAddOpen(true);
            }}
          >
            <UserPlus size={14} />
            Registrar jugador
          </Btn>
        </div>
      </div>

      {/* contadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="panel clip-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="label-cap flex items-center gap-2">
              <BadgeCheck size={12} className="text-[#e8102e]" />
              Asientos oficiales
            </span>
            <span className="font-display italic text-[18px] text-white tabular-nums">
              {officials.length}
              <span className="text-[#8e919c] text-[13px]">/{cap}</span>
            </span>
          </div>
          <div className="h-[6px] bg-black/50 overflow-hidden">
            <motion.div
              className="h-full bg-[linear-gradient(90deg,#ff2440,#e8102e)]"
              animate={{ width: `${pctOff}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
        <div className="panel clip-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="label-cap flex items-center gap-2">
              <Zap size={12} className="text-[#ffb830]" />
              Banco de reservas
            </span>
            <span className="font-display italic text-[18px] text-white tabular-nums">
              {bank.length}
              <span className="text-[#8e919c] text-[13px]">/{tournament.bankSeats}</span>
            </span>
          </div>
          <div className="h-[6px] bg-black/50 overflow-hidden">
            <motion.div
              className="h-full bg-[linear-gradient(90deg,#ffb830,#d99312)]"
              animate={{ width: `${pctBank}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* lista */}
      <div className="panel clip-card p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-1 p-1 bg-black/40 border border-white/10">
            {(
              [
                { id: "off" as const, label: `Oficiales · ${officials.length}` },
                { id: "bank" as const, label: `Banco · ${bank.length}` },
              ]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`tab-btn clip-tag px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] ${
                  tab === t.id ? "active" : "text-[#8e919c] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6e78]" />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="BUSCAR NICK, NOMBRE, TEL…" className="pl-8" />
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-2">
          {loading ? (
            <div className="py-10 text-center text-[11px] font-bold text-[#6b6e78] uppercase tracking-widest">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[12px] font-bold text-[#8e919c] uppercase tracking-wider">
                {search ? "Sin resultados" : tab === "off" ? "Aún no hay jugadores oficiales" : "El banco está vacío"}
              </p>
              <p className="text-[10px] text-[#6b6e78] font-semibold mt-1">
                {tab === "bank"
                  ? "El banco guarda reservas por si un oficial no llega o queda descalificado"
                  : "Usa el botón REGISTRAR JUGADOR para comenzar"}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((p) => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  tournament={tournament}
                  canPromote={!officialFull || p.seat === "off"}
                  canDemote={!bankFull || p.seat === "bank"}
                  onEdit={() => {
                    setEditing(p);
                    setAddOpen(true);
                  }}
                  onDelete={() => setDeleting(p)}
                  onToggleSeat={async () => {
                    const target: SeatType = p.seat === "off" ? "bank" : "off";
                    if (target === "off" && officials.length >= cap) {
                      toast.error("Los cupos oficiales están llenos");
                      return;
                    }
                    if (target === "bank" && bank.length >= tournament.bankSeats) {
                      toast.error("El banco está lleno");
                      return;
                    }
                    try {
                      await updatePlayer(tournament.id, p.id, { seat: target });
                      toast.success(target === "off" ? `${p.nick} promovido a oficial` : `${p.nick} enviado al banco`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Error al mover jugador");
                    }
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ============ configuración de registro — limpiar torneo ============ */}
      <div className="panel clip-card p-4 mt-4 border border-[#e8102e]/30">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="shrink-0 w-9 h-9 clip-badge flex items-center justify-center bg-[#e8102e]/15 border border-[#e8102e]/50 text-[#ff8095]"
            aria-hidden
          >
            <TriangleAlert size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ff8095] flex items-center gap-2">
              Configuración de registro
              <span className="chip clip-tag bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/40 text-[8px] px-1.5 py-[1px]">
                ZONA DE PELIGRO
              </span>
            </div>
            <p className="text-[10.5px] text-[#8e919c] font-semibold mt-1 leading-relaxed">
              Elimina <span className="text-white font-bold">todos los registros</span> para limpiar el torneo: se borran
              los {players.length} jugadores ({officials.length} oficiales + {bank.length} del banco), los brackets y sus
              resultados. El torneo queda en registro abierto conservando su configuración.
            </p>
          </div>
          <Btn
            variant="ghost"
            className="border border-[#e8102e]/40 hover:border-[#e8102e] hover:bg-[#e8102e]/10"
            disabled={players.length === 0}
            title={players.length === 0 ? "No hay registros que eliminar" : "Elimina todos los jugadores registrados"}
            onClick={() => setWipeOpen(true)}
          >
            <Trash2 size={14} />
            Eliminar todos los registros
          </Btn>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        title={editing ? `Editar · ${editing.nick}` : "Registrar jugador"}
        wide
      >
        {addOpen ? (
          <PlayerForm
            key={editing?.id ?? "new"}
            tournament={tournament}
            initial={editing}
            officialFull={officialFull}
            bankFull={bankFull}
            teamNames={teamNames}
            onCancel={() => {
              setAddOpen(false);
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
        confirmLabel="Eliminar"
        title="Eliminar jugador"
        message={`¿Eliminar a ${deleting?.nick} del registro? Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          if (!deleting || !tournament) return;
          try {
            await deletePlayer(tournament.id, deleting.id);
            toast.success("Jugador eliminado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al eliminar");
          }
        }}
      />

      <Confirm
        open={fillOpen}
        onClose={() => setFillOpen(false)}
        confirmLabel={`Llenar ${missing} lugares`}
        title="Llenar registros automáticamente"
        message={`Se agregarán ${missing} jugadores de demostración para completar los ${cap} cupos oficiales. Quedan marcados como DEMO y puedes eliminarlos en lote cuando quieras.`}
        onConfirm={async () => {
          if (!tournament) return;
          try {
            const n = await fillSeats(tournament.id, players, tournament);
            toast.success(`${n} jugadores agregados — torneo completo`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al llenar");
          }
        }}
      />

      <Confirm
        open={demosOpen}
        onClose={() => setDemosOpen(false)}
        danger
        confirmLabel={`Eliminar ${demoCount} demo`}
        title="Eliminar jugadores demo"
        message={`Se eliminarán los ${demoCount} jugadores generados automáticamente. Los registrados manualmente no se tocan.`}
        onConfirm={async () => {
          if (!tournament) return;
          try {
            const n = await removeDemoPlayers(tournament.id, players);
            toast.success(`${n} jugadores demo eliminados`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al eliminar");
          }
        }}
      />

      <Confirm
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        danger
        confirmText="ELIMINAR"
        confirmLabel="Limpiar torneo"
        title="Eliminar todos los registros"
        message={`Se eliminarán TODOS los registros de ${tournament.name}: ${players.length} jugadores (${officials.length} oficiales + ${bank.length} del banco), además del bracket y sus resultados. El torneo quedará limpio y en registro abierto. Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          if (!tournament) return;
          try {
            await wipeRegistrations(tournament.id);
            setTab("off");
            toast.success("Torneo limpio — todos los registros eliminados");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al limpiar el torneo");
          }
        }}
      />
    </div>
  );
}
