# Worklog — Arena Torneos (Gestor de Torneos Gaming)

---
Task ID: 1
Agent: Z.ai Code (main)
Task: Revisión del estado previo + iteración 2: panel colapsable, vista Rondas, reset de marcadores/torneo, revelado progresivo del mix, MatchRail, cartelera de horarios y modo Registro en el visor.

Work Log:
- Revisado el código existente: MainApp, LiveAdminView, SpectatorView, MixOverlay, Podium, BracketTree, MatchCard, lib (types, bracket, actions, hooks, firebase). Firebase Firestore configurado (proyecto torneos-6cd4b), fuentes RBNo3.1 + Montserrat(Gotham) en /public/fonts.
- FIX (bug crítico): BracketTree no propagaba `reveal`/`pool` a los MatchCards de ronda 0 → en el Mix los brackets aparecían todos de golpe. Ahora revealFor() viaja por TreeCtx y cada slot se revela progresivo (hidden→rolling→locked) sincronizado con el overlay, con efecto lock-pop + ring-burst al fijar el nick.
- lib/bracket.ts: nueva función pura `resetAllResults(b)` — limpia marcadores, ganadores y DQs de todo el bracket conservando las asignaciones del mix; vacía slots avanzados (src) y re-propaga byes. FIX: usar `delete s.src` en vez de `undefined` (Firestore rechaza undefined en Transaction.set).
- lib/actions.ts: nueva acción `resetBracketResults(tid)` (transacción).
- components/bracket/BracketTree.tsx: propagación reveal/pool + FitStage con soporte de zoom manual (`zoom` prop, null=auto-fit).
- components/bracket/MatchCard.tsx: efecto de aparición mejorado (lock-pop + flash + ring-burst) cuando el nick se fija en el bracket.
- NUEVO components/arena/RoundColumns.tsx: vista de Rondas en columnas (Octavos/Cuartos/Semis/Gran Final) con cards seleccionables, contador por ronda (done/total), botón de ganador directo por slot, chips de estado (EN JUEGO/FIN/hora).
- REWRITE components/arena/LiveAdminView.tsx: toolbar con switcher Bracket/Rondas, navegación prev/next de matches, zoom manual (−/+/AUTO/Ajustar), panel lateral colapsable de edición del match (MatchPanel, 376px, transición de ancho, pestaña flotante vertical para reabrir), botones "Reiniciar marcadores" y "Reiniciar torneo" con confirmaciones, en móvil el panel cae debajo.
- NUEVO components/arena/MatchRail.tsx: barra inferior de transmisión con los 2 próximos matches ANCLADOS (hora grande rail-time, AM/PM, countdown relativo "EN X MIN/AHORA", marcadores) + marquesina "Cartelera completa" con el resto + panel de configuración (modality/wins/mins).
- NUEVO components/arena/ScheduleOverlay.tsx: cartelera completa de horarios estimados agrupada por ronda con buscador de nick/equipo/tag y estados (Ahora/hora/Por definir).
- NUEVO components/arena/RegistrationBroadcast.tsx: MODO REGISTRO del visor — contador grande de lugares (9/32), barra de ocupación, banco de reservas (n/capacidad con barra dorada y chips), cuadro de lugares con seat-pop animado (llenos con nick, vacíos con pulso rojo "DISPONIBLE"), countdown si hay startAt, marquesina de registrados.
- SpectatorView.tsx: toggle de modo BRACKETS/REGISTRO en el header (sincroniza ?mode=reg en la URL con history.replaceState), botón de cartelera, MatchRail en vivo con fallback a Ticker, overlay de horarios, modo registro y aislación de podio/mix por modo.
- page.tsx: lee ?mode=reg y pasa initialMode a SpectatorView.
- globals.css: nuevas clases rail-card, rail-time, clip-badge-l, lock-pop, ring-burst, seat-pop, seat-empty (pulso de disponible).
- Verificado con Agent Browser: admin (bracket/rondas/zoom/colapso de panel/reiniciar marcadores — Firestore OK), visor (MatchRail anclado, cartelera con búsqueda "ghost", modo registro 9/32, mix progresivo con revelado sincronizado 7/16→¡BRACKETS LISTOS!, pasar a en vivo, marcar ganador KILLERQUEEN 2-0 con avance automático y conector encendido), móvil 390px OK.
- FIX RoundColumns: card exterior era motion.button con botones dentro (HTML inválido) → motion.div con role="button" + keyboard.
- FIX MatchRail: regex de AM/PM para "p.m." con puntos.
- FIX ScheduleOverlay: import faltante de useEffect (Runtime error).
- Lint limpio. Dev server 200 en todas las rutas, sin errores de runtime en consola.

Stage Summary:
- Torneo en Vivo ahora tiene 2 vistas (Bracket + Rondas), panel lateral colapsable, zoom manual y reinicio de marcadores/torneo.
- El mix llena los brackets progresivamente y sincronizados con la animación, con highlight al fijar cada nick.
- El visor tiene: MatchRail con 2 matches anclados + marquesina, cartelera de horarios con buscador para participantes, modo Registro para proyectar el llenado de lugares y del banco.
- Archivos nuevos: RoundColumns.tsx, MatchRail.tsx, ScheduleOverlay.tsx, RegistrationBroadcast.tsx.
-URLs: admin `/`, visor `/?v=show&t=<id>` y `/?v=show&t=<id>&mode=reg`.

---
Task ID: 2
Agent: Z.ai Code (main)
Task: Fases operativas del torneo (Registro abierto → Cerrado → Cuenta regresiva → Mix → En vivo), llenado automático de registros y cartelera completa de matches en el rail.

Work Log:
- lib/types.ts: nuevo estado "closed" (REGISTROS CERRADOS) en TournamentStatus + STATUS_LABEL; Player.demo?: boolean; const PHASES.
- lib/actions.ts: fillSeats() llena asientos oficiales restantes con jugadores demo (nicks/equipos generados, marcados demo:true, batch write); removeDemoPlayers() los elimina en lote; launchMix() documentado como reinicio TOTAL (setDoc sobrescribe el bracket completo → resultados anteriores borrados de la base de datos).
- lib/bracket.ts: computeSchedule ahora asigna horario estimado a TODOS los matches no-bye (incluidas rondas futuras con participantes "Por definir") → la cartelera y el rail muestran la cadena completa desde el inicio.
- LiveAdminView: NUEVA PhaseBar con 5 fases como cards (estado LISTA/EN CURSO + progreso de cupos): F1 "Registro abierto" (+Llenar lugares +Quitar demo N), F2 "Cerrar registros" (Lock), F3 "Cuenta regresiva" con input de minutos configurable (1-720), MiniCountdown en vivo y cancelar (X), F4 "Lanzar mix" (confirm "Lanzar mix — reinicio completo"), F5 "Pasar a en vivo" (+Finalizar); fila de Gestión (Re-mix total / Reiniciar marcadores / Reiniciar torneo / Reabrir) para live/finished; confirms nuevos: fill, demos.
- RegistrationView: botones "Llenar lugares (N)" y "Quitar demo (N)" + chip DEMO en cada fila de jugador generado.
- SpectatorView: AUTO-MODO derivado del status (open/closed → modo registro; mixing/live/finished → brackets) con override manual atado al status vigente (sin setState en effects, lint OK); soporte "closed" en Pregame; orden de lista de torneos incluye closed; MatchRailFallback ya no exige slots completos.
- RegistrationBroadcast: soporte fase cerrada — chip "INSCRIPCIÓN CERRADA", asientos vacíos muestran "Cerrado" (sin pulso), textos de marquee y contadores adaptados.
- MatchRail: incluye TODOS los matches pendientes incluso de rondas futuras: cards ancladas (2) con chip de ronda (16AVOS/OCTAVOS/CUARTOS/SEMI/FINAL) + M#, hora grande, "POR DEFINIR" en cursiva para slots sin participante, y cinta scrollable de MiniRailCards con snap + auto-avance cada 3.5s (pausa en hover/focus) + contador "Cartelera completa · N pendientes"; globals.css: .rail-strip con scrollbar oculta.
- ui.tsx: StatusChip con estilos para "closed".
- page.tsx: SpectatorView ya no recibe initialMode (el modo se auto-gestiona por fase).
- Verificado con Agent Browser: llenado 9→32 (COMPLETO), F1→visor modo registro automático (32/32), F2→visor "INSCRIPCIÓN CERRADA", F3→cuenta regresiva en admin y visor (00:00:46), F4→mix con bracket limpio 0/31 y animación progresiva, ganador→PASA (1/31, rail 30 pendientes), Re-mix total→bracket 100% limpio (sin PASA/DQ antiguos), F5→EN VIVO con rail de 31 pendientes (16AVOS→FINAL con horario y "Por definir"), Finalizar→podio con confeti, Reabrir→EN VIVO, móvil 390px OK, lint limpio.
- Nota: el dev server se detuvo 2 veces por el entorno (sin traza de error en dev.log); se reinició y se re-verificó todo el flujo sin problemas.

Stage Summary:
- Flujo operativo completo en "Torneo en vivo" mediante 5 fases que se reflejan automáticamente en el visor.
- Llenado automático de registros con jugadores demo identificados y eliminables en lote (también desde Registro).
- El mix reinicia por completo el torneo (sin residuos de resultados en la base de datos).
- El rail inferior muestra ahora TODOS los matches pendientes (incl. rondas futuras) con ronda, horario y "Por definir": 2 anclados + cinta auto-desplazable.
- Archivos: types.ts, actions.ts, bracket.ts, LiveAdminView.tsx, RegistrationView.tsx, SpectatorView.tsx, RegistrationBroadcast.tsx, MatchRail.tsx, ui.tsx, page.tsx, globals.css.

---
Task ID: 6
Agent: Z.ai Code (main)
Task: Fix del visor de brackets — la mitad derecha debe verse en espejo (rondas fluyendo hacia el centro, simétrica a la mitad izquierda).

Work Log:
- Diagnóstico en src/components/bracket/BracketTree.tsx: el componente Node NO propagaba la prop `mirror` en la llamada recursiva (<Node r={r-1} m={2*m+i} ctx={ctx} />), por lo que solo la raíz de la mitad derecha se renderizaba en espejo; sus descendientes usaban geometría de flujo izquierda→derecha, quedando las rondas en orden invertido respecto al centro, conectores al revés y encabezados de ronda sin coincidir con las cards (visible con brackets de 32+ participantes).
- Fix de 1 línea: <Node r={r-1} m={2*m+i} mirror={mirror} ctx={ctx} /> — la clase CSS .bnode.mirror (flex row-reverse + padding/conectores invertidos ya definidos en globals.css) ahora se aplica recursivamente a toda la mitad derecha.
- Verificación con Agent Browser sobre el torneo real (COPA HYPERX CLASIFICATORIA, 32 jugadores, ?v=show&t=v5fIicaacHC94sfiCvkt): mediciones de bounding boxes confirman espejo perfecto — SEMI y=266/266, CUARTOS y=183/349 idéntico en ambas mitades, OCTAVOS y=141/224/307/390 simétricos, 16AVOS y=120→411 espejados; 7/7 bnodes de la mitad derecha con clase mirror; encabezados simétricos alrededor del centro (DIECISEISAVOS↔DIECISEISAVOS, OCTAVOS↔OCTAVOS, CUARTOS↔CUARTOS, SEMIFINALES↔SEMIFINALES con GRAN FINAL al centro).
- Verificado también el bracket en la vista admin "Torneo en vivo" (usa el mismo BracketTree): espejo correcto allí también. bun run lint limpio; dev.log sin errores.

Stage Summary:
- El bracket del visor (y del admin) ahora es un espejo real: ambas mitades fluyen hacia la GRAN FINAL central con rondas, conectores y encabezados simétricos.
- Archivo modificado: src/components/bracket/BracketTree.tsx (1 línea, propagación de `mirror`).

---
Task ID: 7
Agent: Z.ai Code (main)
Task: MatchRail (barra inferior del visor) — mostrar SOLO matches programados: excluir los que tienen participantes "Por definir" y los ya completados con ganador.

Work Log:
- MatchRail.tsx: el filtro de `all` ahora exige AMBOS slots con participante definido (`match.slots.every(s => s.pid)`) además de los ya existentes (no bye, no done, con hora programada). Los matches de rondas futuras aparecen automáticamente en cuanto sus dos lugares quedan definidos.
- Limpieza de código muerto: eliminado el campo `ready` de UpcomingInfo, las ramas "POR DEFINIR" de TeamLine/MiniRailCard y el prop `dim`; etiqueta del encabezado cambiada a "Próximos matches · N programados".
- Nuevo helper exportado hasRailMatches(bracket, schedule) con el mismo predicado; MatchRailFallback (SpectatorView) lo usa para caer al Ticker cuando no hay ningún match elegible (antes bastaba un match pendiente con hora para montar el rail, que podía quedar vacío).
- La cartelera completa (ScheduleOverlay) NO se toca: ahí los jugadores buscan su hora, por lo que sí lista todos los matches.
- Verificación con Agent Browser sobre el torneo real: estado inicial → rail "16 programados" (solo dieciseisavos con ambos participantes), cero "Por definir". Se marcaron ganadores de 16AVOS M1 y M2 desde el admin → en el visor desaparecieron esas 2 cards (completadas) y apareció OCTAVOS M1 (KILLERQUEEN vs CiberPanda66, 01:33 AM, chip de ronda) → "15 programados". Se restauró el estado con "Reiniciar marcadores" → 0/31 y rail de vuelta a "16 programados" (confirmado en Firestore vía REST: 0 matches done). Lint limpio, dev.log sin errores.

Stage Summary:
- El rail del visor muestra únicamente matches programados reales: con hora, sin resultado y con ambos participantes definidos; se actualiza en vivo al completarse matches (sale el terminado, entra el siguiente listo).
- Archivos: MatchRail.tsx (filtro + helper + limpieza), SpectatorView.tsx (fallback consistente).

---
Task ID: 7
Agent: Z.ai Code (principal)
Task: Revisar que el reinicio no elimine jugadores registrados, llenar de nuevo todos los slots, y agregar sección "Eliminar todos los registros" en la configuración de registro.

Work Log:
- Diagnóstico del torneo real (COPA HYPERX, v5fIicaacHC94sfiCvkt) vía Firestore REST: 32 jugadores oficiales INTACTOS (23 demo + 9 manuales), bracket inexistente (404) y status "open" — el reinicio anterior había borrado el bracket pero nunca tocó a los jugadores (comportamiento correcto).
- actions.ts: `launchMix(tid, players, tournament)` ahora auto-llena los cupos oficiales vacíos con jugadores DEMO antes de mezclar (rellenando TODOS los slots del bracket) y re-lee el roster de Firestore; `deleteBracket` también limpia `startAt` (batch); NUEVA `wipeRegistrations(tid)` que borra todos los jugadores (lotes de 400), el bracket y deja el torneo en "open".
- ui.tsx: `Confirm` ahora soporta `confirmText` — exige escribir una palabra (ej. ELIMINAR) para habilitar el botón destructivo; reset del campo en render (sin useEffect, lint OK).
- RegistrationView.tsx: nueva sección "CONFIGURACIÓN DE REGISTRO · ZONA DE PELIGRO" al final de Registro con botón "ELIMINAR TODOS LOS REGISTROS" (deshabilitado si 0 jugadores) + Confirm con texto ELIMINAR que borra jugadores + bracket + resultados.
- LiveAdminView.tsx: llamadas actualizadas a la nueva firma de launchMix; el Confirm del remix avisa que los cupos vacíos se completan con DEMO y que los jugadores NO se eliminan; hints de F4 y botones "Reiniciar torneo" con tooltips aclaratorios.
- Verificación end-to-end con agent-browser + Firestore REST sobre torneo de prueba "TEST RESET QA" (4 asientos, 2 reales LAUMX/DRKO):
  1. LANZAR MIX con 2 cupos vacíos → auto-agregó 2 demo, bracket 3 matches con r0 llena (4/4 slots). ✓
  2. Ganadores marcados → REINICIAR MARCADORES → w/scores limpios, asignaciones conservadas, jugadores intactos. ✓
  3. REINICIAR TORNEO (wipe) → bracket 404, status open, startAt null, 4 jugadores intactos. ✓
  4. LANZAR MIX de nuevo → slots rellenados con los MISMOS 4 jugadores, sin duplicados. ✓
  5. ELIMINAR TODOS LOS REGISTROS (escribiendo ELIMINAR) → 0 jugadores, bracket 404, status open. ✓
- Torneo real: lanzado el mix desde la UI → bracket de 31 matches con las 16 llaves iniciales 100% llenas con los 32 jugadores, status "mixing", viewer reproduce "¡BRACKETS LISTOS!". Sin tocar jugadores.
- Torneo de prueba eliminado; Firebase quedó solo con COPA HYPERX.
- Lint limpio; dev.log sin errores.

Stage Summary:
- El reinicio (Lanzar mix / Reiniciar marcadores / Reiniciar torneo) NUNCA elimina jugadores registrados — verificado en 4 escenarios.
- "Lanzar mix" ahora siempre llena TODOS los slots: completa cupos vacíos con DEMO y sortea con todos los oficiales.
- Nueva zona de peligro en Registro: "Eliminar todos los registros" con confirmación por escritura para limpiar el torneo por completo.
- COPA HYPERX quedó con brackets nuevos y completos (32 jugadores) en fase MIX MATCH, listo para "PASAR A EN VIVO".

---
Task ID: 8
Agent: Z.ai Code (principal)
Task: Al dar click en el contador para lanzar el timer de inicio del torneo, el visor debe cambiar solo a la pestaña de brackets, donde el cronómetro de inicio se ve mejor (grande).

Work Log:
- Diagnóstico: el cronómetro gigante vive en la pestaña BRACKETS del visor (Pregame), pero el AUTO-MODO enviaba status open/closed siempre a REGISTRO, donde el contador solo aparecía compacto al fondo. Al lanzar la cuenta regresiva (F3 "Inicio en X min" → setStartAt con status aún open/closed) el visor se quedaba en registro.
- SpectatorView.tsx: nueva regla de AUTO-MODO — en fases de registro (open/closed), si el torneo tiene startAt programado el modo automático pasa a "brackets" (Pregame con cronómetro gigante); si no hay startAt, permanece "reg". Al cancelar la cuenta regresiva (startAt null) el visor regresa solo al modo registro. Al expirar el contador, el visor permanece en brackets mostrando "¡COMIENZA!" (no cae de vuelta a registro). El override manual del espectador sigue vigente (atado al status actual).
- RegistrationBroadcast.tsx: el bloque del contador compacto del modo registro ahora es un botón (cuando recibe onCountdownClick) con hint "VER CRONÓMETRO EN GRANDE →" — click en el contador del visor también lleva a la pestaña de brackets. Prop nueva: onCountdownClick?: () => void.
- SpectatorView.tsx: pasa onCountdownClick={() => changeMode("brackets")} a RegistrationBroadcast.
- LiveAdminView.tsx: toasts y tooltips de F3/F2 actualizados — "el visor cambia a brackets con el cronómetro" para que el operador sepa qué hará la pantalla de transmisión.
- Verificación end-to-end con agent-browser (2 pestañas: admin + visor, torneo de prueba "QA CRONOMETRO" id aGoCJmtGizebPd52bgyG):
  1. Visor en modo registro (open, 0/4) → click en "INICIO EN 1" del admin → el visor cambió SOLO a Brackets: toggle activo, URL sin mode=reg, "EL TORNEO COMIENZA EN" con celdas gigantes 00 HORAS : 00 MIN : 38 SEG (screenshot /tmp/viewer_countdown.png). ✓
  2. Cancelar cuenta regresiva en el admin (X) → el visor regresó solo a modo registro (&mode=reg). ✓
  3. Re-lanzar el contador → el visor cambió solo a Brackets de nuevo. ✓
  4. Override manual a Registro en el visor → contador compacto clicable con hint → click → el visor volvió a Brackets. ✓
  5. Contador expira → el visor permanece en Brackets con "¡COMIENZA!" gigante (screenshot /tmp/viewer_expira.png). ✓
- Cleanup: torneo QA eliminado desde la UI (Firestore queda solo con COPA HYPERX, que pasó a "live" durante las pruebas sin ser tocada). bun run lint limpio; dev.log sin errores; browser cerrado.

Stage Summary:
- El visor de espectadores ahora salta automáticamente a la pestaña de brackets en cuanto el organizador activa el timer de inicio desde el contador (F3), mostrando el cronómetro en grande; al cancelar vuelve al modo registro y al expirar se queda con "¡COMIENZA!".
- El contador compacto del modo registro también es clicable ("Ver cronómetro en grande →") como acceso directo a la pestaña de brackets.
- Archivos: SpectatorView.tsx, RegistrationBroadcast.tsx, LiveAdminView.tsx (textos).

---
Task ID: 9
Agent: Z.ai Code (principal)
Task: Cortes dramáticos en el visor — glitch que tiembla la pantalla + overlay de ~5 s del enfrentamiento (vs.png) resaltando al ganador al marcar un resultado, y animación similar al poner un match "EN JUEGO". Fondo del visor con Background.jpg.

Work Log:
- Assets: upload/Background.jpg (2264x1200) y upload/vs.png (1254x1254 RGBA) copiados a /public.
- NUEVO components/arena/MatchSpotlight.tsx: overlay de transmisión (z-60) con dos variantes — kind "win" (badge del match + nombres con vs.png al centro, ganador en plata con glow + chip GANADOR + marcador, perdedor atenuado, banner rojo "GANADOR · <nick>") y kind "live" (mismo enfrentamiento con banner "¡EL MATCH ESTÁ EN JUEGO!" pulsante). Animaciones framer-motion: nombres entran con spring desde los lados, vs.png cae con scale 2.8→1, nombres con clase .glitch-in (clip-path cortes de glitch). Se cierra por click o automáticamente.
- SpectatorView.tsx:
  · findSpotlightEvent(): diff puro entre el snapshot anterior y el actual del bracket — dispara "win" cuando un match pasa a done (o cambia de ganador, ej. descalificación) y "live" cuando pasa a live; ignoran byes y transiciones done→ready. Prev guardado en prevBracketRef atado al tid (sin falsos disparos al cambiar de torneo); solo activo en status "live".
  · El overlay se auto-cierra a los 5 s (useEffect + timeout) y regresa a los brackets.
  · SHAKE: glitch sutil de TODA la pantalla vía Web Animations API (el.animate con translate3d/skew de 1-3 px durante 1.9 s, 2 ciclos perceptibles) — se re-dispara en cada evento sin setState (lint react-hooks/set-state-in-effect ok) y respeta prefers-reduced-motion.
  · ShowBackground: Background.jpg object-cover como fondo del visor (vista principal + pantalla de transmisiones) con veladura radial para legibilidad; Backdrop queda como fallback.
- globals.css: @keyframes glitchIn (cortes clip-path de entrada para los nombres) + prefers-reduced-motion; el shake quedó en WAAPI (sin CSS muerto).
- Ajuste: los marcadores del overlay solo se muestran si alguno es > 0 (al marcar ganador directo el 0-0 no se muestra).
- Verificación con agent-browser (2 sesiones paralelas: visor en primer plano + admin en segunda sesión, torneo de prueba "QA SPOTLIGHT" 4 jugadores, mix lanzado y pasado a EN VIVO):
  1. MARCAR EN JUEGO en SEMI M1 → visor: overlay VS con ambos nicks + "¡EL MATCH ESTÁ EN JUEGO!" (/tmp/spotlight_live.png tomado en GRAN FINAL). ✓
  2. GANADOR en GRAN FINAL → visor: overlay con ganador resaltado (plata+glow), perdedor atenuado, banner "GANADOR · ULTRAFALCON27" y detrás la card CAMPEÓN (/tmp/spotlight_winner.png). ✓
  3. Sondeo 400ms: none → live+VS+SHAKE (animación de raíz activa via getAnimations) → live+VS → none (auto-cierre ~5 s). ✓
  4. Detección robusta: done→ready (reiniciar marcadores) NO dispara; done→done con ganador distinto SÍ (branch winnerChanged). ✓
  5. Background.jpg cargado (naturalWidth>0) en visor, transmisiones y móvil 390px. ✓
  6. Nota: el snapshot de Firestore al visor llega con 1-2 s de retardo — el corte aparece ~1.5 s después del click del admin (normal en Firestore).
- Debug temporal (console.log + data-spot) añadido y ELIMINADO tras el diagnóstico; lint limpio; QA SPOTLIGHT eliminado (Firestore solo con COPA HYPERX, intacta en "live"); dev.log sin errores; navegadores cerrados.

Stage Summary:
- El visor ahora tiene cortes de transmisión dramáticos: al marcar ganador, tiembla sutilmente (glitch), muestra el enfrentamiento con vs.png resaltando al ganador ~5 s y regresa solo a los brackets; al marcar "EN JUEGO" lanza la presentación VS equivalente.
- El visor completo usa Background.jpg como fondo (vista brackets, modo registro, transmisiones).
- Archivos: MatchSpotlight.tsx (nuevo), SpectatorView.tsx, globals.css, public/Background.jpg, public/vs.png.

---
Task ID: 10
Agent: Z.ai Code (principal)
Task: (a) Animaciones de spotlight a 10 segundos; (b) sistema de PCs del escenario (4 PCs, asignación por match según modalidad, máx. 2 simultáneos en 1v1 y 1 en el resto); (c) PC visible en cards de admin/visor/rail; (d) fuente web para OBS Studio (/?obs=1&t=<id>) con fondo transparente, cards fijas 16:9 con PC+nombre+marcador, animación de ganador y estado "Esperando match".

Work Log:
- Investigación OBS (web-search): el Browser Source de OBS renderiza la página con alfa — su CSS por defecto (body background rgba(0,0,0,0)) hace el fondo transparente; basta que la página no pinte fondo. Confirmado con obsproject.com/kb/browser-source y guías de overlays.
- lib/pcs.ts (NUEVO): motor de PCs — pcCountFor (1v1→2, 2v2→4, 3v3→3 "hasta PC3", 4v4→4), maxSimultaneous (1v1→2, resto→1), pcGroups ([PC1,PC2]/[PC3,PC4] para 1v1; grupo único para el resto), pcForPlayer (1v1: PC por slot; 2v2: equipo A PC1+2 / equipo B PC3+4; 3v3/4v4: estación por posición), pcsForSide, firstFreeGroup y plannedPcs (en juego conservan PCs guardadas; listos heredan grupos libres en orden de bracket).
- types.ts: Match.pcs?: string[]. bracket.ts: applyWin/applyUnwin/resetAllResults liberan pcs (delete, compatible con Firestore).
- actions.ts: setMatchLive(tid,r,m,on,modality) asigna el primer grupo libre DENTRO de la transacción y lanza "Sin PCs disponibles: máximo N match(es)…" si no hay grupo; al detener libera PCs. El guard del admin muestra ese error como toast.
- OBS (components/arena/ObsOverlay.tsx NUEVO + page.tsx ?obs=1 + globals.css obs-*): página 100% transparente (body/root/frame rgba(0,0,0,0) verificado), layout fijo por modalidad (1v1: 2 zonas apiladas PC1·PC2 arriba y PC3·PC4 abajo; 2v2/3v3/4v4: una zona con 2/3/4 cards por lado), card = recuadro 16:9 transparente + barra [PC rojo][NICK][marcador], vs.png entre lados (atenuado si zona vacía), entrada obs-enter al iniciar match, pop del marcador al cambiar, glow dorado + cinta GANADOR + perdedor atenuado al definir ganador (8 s, snapshot con PCs previas) y luego "ESPERANDO MATCH" pulsante hasta que otro match se marque en vivo. Sin info extra (solo PC+nombre+marcador). Tamaños en vw para escalar con el canvas de OBS.
- Spotlight del visor: duración 5000→10000 ms (verificado por sondeo 1 s: visible t=2s→11s, fuera en t=12s) y nuevos chips PC por lado (aPcs/bPcs vía pcsForSide; en "win" toma PCs del snapshot previo porque ya se liberaron).
- Chips de PC en: MatchCard (bracket admin+visor, rojo=EN JUEGO, gris=planificada), RoundColumns (nuevo prop modality), MatchRail (cards ancladas), MatchPanel del admin + botón "Marcar en juego" deshabilitado con title "Sin PCs disponibles — máximo 2 match(es) en juego en 1v1" cuando liveCount>=maxSim, y chip toolbar "EN JUEGO 1/2". Toasts al marcar/detener.
- Verificación end-to-end (agent-browser, 2 torneos QA creados por REST y eliminados después; COPA HYPERX intacta):
  1. QA 4 jugadores: mix → en vivo → OBS vacío con 4 "Esperando match" y vs.png cargado; M1 en juego → visor: spotlight "¡EL MATCH ESTÁ EN JUEGO!" con chips PC1/PC2 (10 s) y OBS zona 1 con PC1:ShadowWolf42 vs PC2:DarkViper99; M2 en juego → OBS zona 2 PC3:IronKing88 vs PC4:NeonFox77 (2 simultáneos).
  2. Marcador +1 → OBS actualiza a 1-0 en vivo. GANADOR M1 → visor: spotlight "Ganador · ShadowWolf42" 10 s; OBS: cinta GANADOR + glow dorado en PC1 + perdedor atenuado; a los ~8 s la zona pasa a "Esperando match" ✓.
  3. Reasignación: ganador M2 → GRAN FINAL lista planifica PC1·PC2 (grupo libre); en juego → OBS la muestra en zona 1 y PC3·PC4 queda "Esperando match" ✓.
  4. QA 8 jugadores (capacidad): plan M1=PC1·PC2, M2=PC3·PC4, M3/M4 sin PCs; con 2 en juego el botón de M3 sale DESHABILITADO con tooltip "Sin PCs disponibles — máximo 2 match(es) en juego en 1v1" y chip "EN JUEGO 2/2"; ganador M1 → M3 hereda PC1·PC2 y al ponerlo en juego OBS muestra 2 matches simultáneos (PC1/PC2 + PC3/PC4) ✓.
  5. Transparencia: body/root/frame con backgroundColor rgba(0,0,0,0) (el blanco de las capturas es el lienzo del navegador; en OBS se compone la escena). Screenshots: /tmp/obs_winner.png, /tmp/obs_esperando.png, /tmp/obs_qa2_2matches.png.
- FIX lint: setState diferido con setTimeout(0) en el effect de detección de victoria de ObsOverlay (react-hooks/set-state-in-effect). Lint limpio; dev.log sin errores; navegadores cerrados; QA1/QA2 eliminados (Firestore solo con COPA HYPERX en live).

Stage Summary:
- El visor mantiene el corte dramático ahora por 10 segundos (ganador resaltado con PCs de cada lado) y regresa solo a los brackets.
- El escenario tiene 4 PCs gestionadas automáticamente: los matches EN JUEGO toman el primer grupo libre (1v1: 2 simultáneos en PC1+PC2 / PC3+PC4; 2v2/3v3/4v4: 1 simultáneo), al definir ganador las PCs se liberan y el siguiente match listo las hereda; la capacidad se bloquea en el admin con aviso claro.
- Nueva URL para OBS Studio: /?obs=1&t=<id> — fondo transparente, cards fijas 16:9 (video del jugador debajo), barra PC+nombre+marcador, VS central, animación de ganador ~8 s y "ESPERANDO MATCH" entre matches; se actualiza sola al iniciar/finalizar matches.
- Archivos: lib/pcs.ts (nuevo), ObsOverlay.tsx (nuevo), types.ts, bracket.ts, actions.ts, page.tsx, globals.css, MatchSpotlight.tsx, SpectatorView.tsx, MatchCard.tsx, LiveAdminView.tsx, RoundColumns.tsx, MatchRail.tsx.

---
Task ID: 11
Agent: Z.ai Code (principal)
Task: En "Torneo en vivo" debe verse —al igual que en los brackets del visor— a qué PC se asignó cada match. INCIDENCIA: borrado accidental de COPA HYPERX durante el QA y restauración completa vía PITR de Firestore.

Work Log (feature — asignación de PCs visible en Torneo en vivo):
- Diagnóstico: los chips de PC existían en MatchCard/RoundColumns/MatchPanel pero a 8px y gris tenue (#6b6e78) — invisibles en la práctica; el visor además muestra PCs en su MatchRail, el admin no tenía nada equivalente.
- lib/pcs.ts: NUEVOS helpers — pcsCompact() ([PC1,PC2]→"PC1·2"), pcOccupancy(b, modality) → mapa de las 4 PCs con qué match (tag + r/m + matchId), qué ocupante (nick del lado en 1v1, miembro en 2v2, "POS N" en 3v3/4v4) y estado (live/ready) lo ocupa; respeta el mismo orden de asignación que plannedPcs (en juego primero, luego listos en orden de bracket).
- LiveAdminView: NUEVO PcDock "PCS DEL ESCENARIO" integrado al panel del stage (visible en vistas Bracket y Rondas): 4 celdas PC1..PC4 con match, ocupante y estado (● EN JUEGO rojo / PLANIFICADA gris / LIBRE punteada), "Máx N simultáneos" según modalidad, clic en celda ocupada abre ese match en el panel; scroll horizontal en móvil.
- MatchCard (admin + visor): chip superior de PC más visible (9px, planned #a9adb8 / live rojo) y NUEVO badge de PC por slot (lado A: "PC1", 2v2 lado B: "PC3·4") en rojo si live, gris si planificado; no aparece durante la animación de mix ni en matches sin asignación.
- RoundColumns: mismo chip superior reforzado + badge PC por slot en cada card.
- MatchPanel: NUEVOS chips por miembro "NICK · PCn" (pcForPlayer) en cada SlotRow con match en juego o planificado.
- Verificado con agent-browser: COPA HYPERX (1v1): dock PC1/PC2=M3 en juego, PC3/PC4=M4 planificada, badges por slot en bracket y rondas, panel con "ULTRADRAKE75 · PC3"/"FERALGHOST71 · PC4", clic en celda PC4 abre M4. Torneo QA 2v2 (8 demo): dock mapea PC1=RapidGhost11, PC2=GhostPanda15 (lado A), PC3=RapidCore91, PC4=DarkKing88 (lado B) del mismo match; al marcar ganador M1, el dock re-planificó automáticamente las 4 PCs a los miembros de M2 (herencia visible). Móvil 390px: dock con scroll horizontal OK. Lint limpio.

Work Log (INCIDENCIA + recuperación):
- Mientras eliminaba el torneo QA desde la UI, un script de navegación DOM subió 6 niveles desde el h3 equivocado y clickeó "Eliminar torneo" de COPA HYPERX (v5fIicaacHC94sfiCvkt): deleteTournament borró torneo + 32 jugadores + bracket/main.
- RECUPERACIÓN: Firestore tenía PITR habilitado → leí el snapshot pre-borrado vía REST (readTime=2026-10-02T04:50:00Z): tournaments/v5fIicaacHC94sfiCvkt (con logo base64), players (32 docs con IDs originales), bracket/main (31 matches con resultados: M1 SHADOWWMX PASA, M2 RAPIDWOLF52 PASA, M3 EN JUEGO SHADOWHAWK58 vs KILLERQUEEN con pcs [PC1,PC2], M4 ULTRADRAKE75 vs FERALGHOST71 planificada PC3·PC4).
- Script bun (firebase client SDK, mismas credenciales del app) re-escribió los 34 documentos con los MISMOS IDs; luego borró el QA PCDOCK (xJKrEKHDFHqFRHjvAbq8) vía script (no UI). Scripts temporales eliminados tras usarlos.
- Verificación post-restauración: Firestore REST lista solo COPA HYPERX; app muestra EN VIVO 32/32, bracket 2/31 con M3 en juego PC1/PC2 y dock idéntico al pre-borrado; visor /?v=show&t=v5fIicaacHC94sfiCvkt intacto (rail "M3 PC1·PC2 EN JUEGO", 15 programados); dev.log sin errores.

Stage Summary:
- Torneo en vivo ahora muestra la asignación de PCs a nivel de sección (PcDock monitor de escenario), de card (chip de match + badge por lado) y de jugador (chips por miembro en el panel), igual que el visor.
- COPA HYPERX MARVEL TOKON quedó restaurada al 100% (jugadores, llaves, resultados, PCs y logo) gracias a PITR; Firestore quedó solo con ese torneo.
- Archivos: lib/pcs.ts, LiveAdminView.tsx (PcDock + MatchPanel), bracket/MatchCard.tsx, RoundColumns.tsx.

---
Task ID: obs-cards-button
Agent: Z.ai Code (main)
Task: Agregar botón "Cards OBS" junto a las secciones del header que abra la web de cards para OBS en ventana nueva; hacer esa web GENERAL para todos los torneos (URL estable, se configura una sola vez en OBS).

Work Log:
- ObsOverlay.tsx: ahora es web GENERAL — si no viene ?t=, resuelve el torneo ACTIVO automáticamente (status live → mixing → el más reciente por createdAt); ?obs=1&t=<id> sigue soportado como override; estado "Sin torneo activo" sutil si no hay torneos; comentarios de URL actualizados a /?obs=1.
- MainApp.tsx: NUEVO botón "Cards OBS" en el header (junto al botón Visor, arriba de las secciones Configuración/Registro/Torneo en vivo) con icono MonitorPlay; abre window.open("/?obs=1", "_blank") — siempre habilitado porque la web es general; header row ahora con overflow-x-auto sm:overflow-x-visible + .no-scrollbar para que nada se corte en móvil.
- globals.css: NUEVOS estilos .obs-btn (carcasa oscura con inset-ring, acento rojo al hover — distinto del botón rojo Visor) y .obs-no-tournament; utilidad genérica .no-scrollbar; comentario de la sección OBS actualizado a /?obs=1.
- Verificado con agent-browser: clic en "Cards OBS" abre nueva pestaña con URL visible http://localhost:3000/?obs=1 (lista para copiar a OBS); el overlay resolvió solo COPA HYPERX MARVEL TOKON (1v1, EN VIVO): zona PC1·PC2 con SHADOWHAWK58 vs KILLERQUEEN 0-0 y zona PC3·PC4 "ESPERANDO MATCH" con geometría idéntica; override /?obs=1&t=<id> sigue renderizando 2 zonas/4 cards; desktop y móvil (390px) OK — header scrollable sin clip; secciones Configuración y Torneo en vivo sin regresiones (PcDock con PCs intacto). Lint limpio; dev.log sin errores.

Stage Summary:
- La web de cards para OBS es ahora GENERAL: URL /?obs=1 permanente (no cambia por torneo), ideal para Browser Source de OBS configurado una sola vez.
- Botón "Cards OBS" en el header junto a Visor, abre ventana nueva donde se ve la URL para pasarla a OBS.
- Archivos: src/components/arena/ObsOverlay.tsx, src/components/arena/MainApp.tsx, src/app/globals.css.

---
Task ID: obs-cards-bars-only
Agent: Z.ai Code (main)
Task: Rediseño de las cards OBS — eliminar los recuadros blancos (frames 16:9) y el VS; dejar únicamente la barra de cada jugador (PC + nick + marcador), más grandes para usarse en OBS sin escalar.

Work Log:
- ObsOverlay.tsx: ObsCard reducido a la barra única (eliminado el div .obs-frame y el badge "Ganador" que vivía dentro del frame); eliminado el <img> del VS en ObsZone; el estado GANADOR ahora se expresa en la propia barra (borde/glow dorado + marcador dorado vía .obs-card.is-winner .obs-bar/.obs-score); perdedor se atenúa (.is-lose).
- Tamaños nuevos (vars CSS por modalidad en .obs-root): --bar-h 4vw→3.2vw, --f-nick 1.9vw→1.45vw, --f-score 2.7vw→2.1vw, --score-w 3.8vw→2.9vw según modalidad; ancho de barra 32vw (1v1) / 30vw (2v2) / 27vw (3v3) / 26vw (4v4).
- Layout por equipos: en 2v2/3v3/4v4 cada lado se apila en COLUMNA (.obs-zone-side.is-col) para que cada nick conserve barra ancha y legible (fila horizontal truncaba nicks a ~2 caracteres en 4v4); 1v1 sigue en fila (1 barra por lado).
- globals.css: eliminados .obs-frame*, .obs-winner-badge/obsBadgePop y .obs-vs; .obs-bar ahora width:100% + var(--bar-h) + sombra suave; nuevos estilos de barra ganadora; .obs-wait más grande (1vw); reduced-motion actualizado.
- Verificado con agent-browser a 1920×1080 (canvas OBS): 1v1 real (COPA HYPERX) muestra solo [PC1|SHADOWHAWK58|0] y [PC2|KILLERQUEEN|0], sin recuadros ni VS; zona 2 en "ESPERANDO MATCH" translúcida; glow dorado del ganador y atenuado del perdedor verificados por inyección de clases (sin tocar datos); preview 4v4 por columnas: 8 barras de 26vw → zona 1048×336px, todos los nicks legibles y sin desbordar; sin errores en consola; lint limpio.

Stage Summary:
- El overlay OBS (/?obs=1) quedó en modo "bars-only": única elemento visible es la barra PC+nick+marcador por jugador, grande y lista para OBS sin escalar.
- Por equipos las alineaciones se apilan en columnas (lado A vs lado B) para máximo ancho de nick; el ganador se resalta en dorado sobre la propia barra.
- Archivos: src/components/arena/ObsOverlay.tsx, src/app/globals.css.

---
Task ID: obs-cards-bigger
Agent: Z.ai Code (main)
Task: Hacer las barras de las cards OBS aún más grandes ("que cada card sea mas grande aun").

Work Log:
- ObsOverlay.tsx: subidos todos los tamaños por modalidad — ancho de barra 32/30/27/26vw → 40/34/30/28vw; --bar-h 4/3.6/3.4/3.2vw → 5/4.4/4.2/4vw; --f-nick 1.9/1.7/1.55/1.45vw → 2.4/2.1/1.95/1.85vw; --f-score 2.7/2.4/2.2/2.1 → 3.4/3/2.8/2.6vw; --score-w 3.8/3.2/3/2.9 → 4.8/4/3.8/3.6vw; --f-pc 1.15/1.05/1/0.95 → 1.4/1.25/1.2/1.15vw.
- globals.css: padding interno proporcional (.obs-pc 0.55→0.7vw, .obs-nick 0.6→0.8vw) y .obs-wait 1→1.1vw.
- Verificado con agent-browser a 1920×1080: 1v1 real con barras de 768×96px y nick ~46px; preview 4v4 inyectado con vars correctas (28vw×4vw) → zona 1125×336px, nicks completos y sin desbordar; sin errores; lint limpio.

Stage Summary:
- Cards OBS un ~25% más grandes en todas las modalidades, manteniendo el ajuste en canvas 1920×1080 sin escalar en OBS.
- Archivos: src/components/arena/ObsOverlay.tsx, src/app/globals.css.

---
Task ID: 5
Agent: Z.ai Code (main)
Task: (1) Nicks completos en una línea en las animaciones del visor (spotlight ganador/match en juego y podio); (2) Logo de la App = HyperX (upload/Hyperlogo.png); (3) Nueva modalidad "1v1v1v1" (FFA de 4 jugadores enfrentándose) en todo el stack; (4) cards OBS FFA con nicks auto-ajustados.

Work Log:
- LOGO: public/hyperlogo.png copiado desde upload/Hyperlogo.png; Emblem (ui.tsx) ahora renderiza la imagen HyperX con clip-card-sm; favicon/apple-icon en layout.tsx metadata.icons. Splash y header usan el nuevo logo automáticamente.
- NICK 1 LÍNEA: MatchSpotlight reescrito — nuevo componente FitLine (midición con ResizeObserver + document.fonts-ready, transform scale con origen anclado al lado) garantiza que el nick NUNCA se parta en 2 renglones: usa todo el espacio disponible de su mitad y se auto-escala si es más largo. También aplicado al banner "Ganador · NICK" y al Podium (export FitLine desde MatchSpotlight; nombres de campeón/sub/terceros completos con clamp de tamaño).
- FFA (Modalidad 5 = "1v1v1v1", 4 jugadores por match):
  · types.ts: Modality 1|2|3|4|5, MODALITY_LABEL[5]="1v1v1v1", MODALITY_SLOTS (5→4 slots), slotsPerMatch/slotsOf/teamSize/isTeamModality, playersCapacity (FFA: seats×1), matchPlayable (≥2 slots llenos: permite finales FFA parciales).
  · bracket.ts: buildBracket(parts, slots) GENERALIZADO n-ario (rondas ceil(prev/S), byes con 1 solo participante, parciales jugables), nextOf/advanceSlot/applyWin/applyUnwin con S, Bracket.s serializado (compat: inferido de slots.length), teamsInRound S-aware, matchTag/ronda final = "GRAN FINAL" siempre (roundLabel/roundShortLabel), getPodium FFA (subcampeón y 3er lugar = mejores scores del resto de la final).
  · pcs.ts: FFA consume las 4 PCs (1 jugador por PC, pcGroups [[PC1..PC4]]), pcForPlayer/pcsForSide/pcOccupancy por slot.
  · actions.ts: fillSeats/launchMix con playersCapacity y slotsPerMatch, disqualify FFA no avanza automáticamente, replaceFromBank FFA individual, setMatchLive/plannedPcs con matchPlayable.
  · BracketTree: árbol S-aware; FFA se dibuja izquierda→derecha (ronda 1 → GRAN FINAL) con headers por ronda y conectores de S hijos; reveal del mix por S slots (base = m×S). MatchCard/RoundColumns/MatchPanel/MatchRail/ScheduleOverlay/SpectatorView/ObsOverlay generalizados a N slots (parts array, join " VS ").
  · TournamentsView: selector de modalidad 1v1/2v2/3v3/4v4/1v1v1v1; asientos "N JUG" según teamSize. RegistrationView: campo equipo solo en 2v2-4v4. ModalityChip/MainApp/MatchRail usan MODALITY_LABEL.
  · ObsOverlay: zona FFA = 4 barras en fila (.obs-zone.is-ffa, gap 1.1vw, barras 23.4vw); ObsNick con auto-fit iterativo (baja el font-size hasta que el texto cabe, re-mide en document.fonts.ready por FOUT, piso 0.5×base con fallback "…").
- VERIFICACIÓN E2E (agent-browser 1920×1080, torneo real "COPA FFA HYPERX", 16 demo): creación (modalidad 1V1V1V1 visible) → capacidad 16/16 → mix → bracket 4-ario (4×OCTAVOS de 4 slots + GRAN FINAL) → animación de reveal 16 slots → match EN JUEGO con PC1..PC4 en PcDock y en el visor → spotlight FFA 2×2 "en juego" con nick de 24 caracteres COMPLETO en una línea → ganador → spotlight dorado + banner completo → avance a GRAN FINAL (4 clasados) → /?obs=1: 4 barras con nicks completos (auto-fit, sin "…") → podio: campeón SHADOWHAWK77, subcampeón ELCAMPEONSUPREMOXLARGO99 (score), 3er lugar DARKCORE92+STORMRHINO61, sin truncados → bracket final con conectores 4→1. Lint limpio, sin errores de consola ni runtime (se reinició el dev server por caché CSS obsoleta de Turbopack tras editar globals.css).

Stage Summary:
- El visor nunca parte los nicks: spotlight (1v1/equipos/FFA) y podio los muestran completos en una línea con auto-escala.
- La app usa el logo HyperX en header, splash y favicon.
- Nueva modalidad FFA "1v1v1v1" (4 jugadores, 4 PCs, 1 zona OBS de 4 barras) operativa de punta a punta: registro → mix → en vivo → ganadores → podio.
- Archivos: types.ts, bracket.ts, pcs.ts, actions.ts, ui.tsx, layout.tsx, MainApp.tsx, TournamentsView.tsx, RegistrationView.tsx, RegistrationBroadcast.tsx, LiveAdminView.tsx, RoundColumns.tsx, MatchCard.tsx, BracketTree.tsx, SpectatorView.tsx, MatchSpotlight.tsx, Podium.tsx, MatchRail.tsx, ScheduleOverlay.tsx, ObsOverlay.tsx, globals.css, public/hyperlogo.png.

---
Task ID: 6
Agent: Z.ai Code (main)
Task: Cards OBS del FFA (1v1v1v1) en cuadrícula 2×2 con el mismo tamaño de card que las demás modalidades.

Work Log:
- ObsOverlay.tsx: la zona FFA pasó de "4 barras en fila" a CUADRÍCULA 2×2 (PC1·PC2 arriba, PC3·PC4 abajo, orden por número de PC). barW del FFA = 40vw y sizeVars idénticos a 1v1 (--bar-h 5vw, --f-nick 2.4vw, --f-score 3.4vw, --score-w 4.8vw, --f-pc 1.4vw) — cada card tan grande como las de 1v1. Comentario del header actualizado.
- globals.css: .obs-zone.is-ffa ahora es display:grid con grid-template-columns: repeat(2, max-content) y gap 2.2vw/2.6vw centrado.
- Verificado con agent-browser (1920×1080, torneo real de 32 jugadores, R1·M1 en juego): 4 barras de 768×96px (idénticas a 1v1) en 2 filas × 2 columnas, zona 167→1753px centrada sin desbordar; glow dorado del ganador y marcador dorado verificados en la 2×2; estado "ESPERANDO MATCH" respeta la misma geometría 2×2. Se deshizo el ganador de prueba para dejar el torneo limpio. Lint limpio.

Stage Summary:
- El overlay OBS FFA ahora es una cuadrícula 2×2 con cards del mismo tamaño que 1v1 (768×96px en canvas 1920×1080), coherente con el resto de modalidades.
- Archivos: src/components/arena/ObsOverlay.tsx, src/app/globals.css.

---
Task ID: 7
Agent: Z.ai Code (main)
Task: Optimizar el bracket FFA (1v1v1v1): eliminar el relleno a potencia de 4 (32 jugadores → 32 slots, no 64) y dibujarlo en ESPEJO como el 1v1 (final al centro, mitades izquierda/derecha), revisando diferencias de diseño vs 1v1.

Work Log:
- bracket.ts (buildBracket): eliminado el padding a potencia de S para FFA — la ronda 1 tiene sólo ceil(n/4) matches redondeados a PAR (32 jugadores → [8,2,1] = 32 slots R1, 21 matches totales vs 21→11); todas las rondas intermedias también pares para permitir el espejo. S=2 mantiene el árbol binario clásico intacto (verificado: n=32 → [16,8,4,2,1]).
- bracket.ts: SLOTS ADAPTATIVOS — cada match recibe tantos slots como matches REALES de la ronda anterior lo alimentan (matriz de "realidad": r0 tiene ≥1 participante, r>0 tiene ≥1 hijo real). La Gran Final queda con los clasados reales (2 semis → final de 2, 4 semis → final de 4); nunca más slots "Por definir" imposibles de llenar. Matches fantasma (bye sin participantes ni hijos) no generan slots ni se dibujan.
- bracket.ts: autoByeAdvance() — matches de UN sólo clasado real (no jugables) avanzan automáticamente en cadena (build time y runtime vía applyWin); applyUnwin/resetAllResults siguen consistentes. Prueba pura con bun: formas n=4..64, flujo completo de winners, unwin en cascada, reset, podio FFA (2º/3º por score), byes n=9/17/20/24/33 — todo correcto.
- bracket.ts: nombres de ronda FFA por Nº DE MATCHES (roundLabel/roundShortLabel/matchTag): 8 matches → OCTAVOS, 4 → CUARTOS, 2 → SEMIFINALES (antes decía "CUARTOS DE FINAL" para las semis por contar participantes); matchTag ahora usa roundShortLabel.
- BracketTree.tsx: rama S>2 reescrita a LAYOUT ESPEJO — Gran Final al centro con ChampionPlate, mitad izquierda (feeders 0..half) y mitad derecha en espejo (feeders restantes), FinalConn a cada lado; columnas de >1 hijo con .bkid/.bkids y --k; hijos solteros renderizan Node directo como en 1v1. Node filtra matches fantasma sólo en FFA (S=2 rendering 100% intacto) y pasa --k al contenedor de hijos.
- globals.css: .bkids::before ahora abarca del centro del primer hijo al último vía calc(100%/(var(--k)*2)) (2 hijos → 25%/75% como antes; 4 hijos → 12.5%/87.5%, antes quedaban desconectados los extremos); nueva variante .bkids.rside (línea y stubs en el lado izquierdo) para la columna derecha del final.
- pcs.ts: ffaTrim() en plannedPcs — matches FFA parciales (final de 2/3) sólo muestran/reservan las PCs de sus slots (final de 2 → PC1·PC2, header y dock correctos).
- ObsOverlay.tsx: slotCount del FFA adaptativo al match en juego (R1=4, final parcial=2/3, sin match=4) → la Gran Final de 2 muestra 2 barras del tamaño 1v1 en vez de 2 + 2 "Esperando match".
- LiveAdminView.tsx: título del panel usa roundLabel (FFA: "SEMIFINALES · Match 1" en vez de "Ronda de 8 · Match 1").
- VERIFICACIÓN E2E (agent-browser 1920×1080, torneo real COPA FFA HYPERX de 32 jugadores): 1v1 intacto (espejo + PC plan). RE-MIX TOTAL → bracket [8,2,1]: OCTAVOS DE FINAL con 4 matches por lado (16 slots izq + 16 der), SEMIFINALES hacia el centro, GRAN FINAL de 2 slots al centro; headers y tags correctos en admin (árbol + RONDAS) y visor; M1 EN JUEGO con PC1..PC4 por jugador en dock/panel; jugados 8 octavos → semis llenas con ganadores correctos (M1-M4→SEMI·M1, M5-M8→SEMI·M2) → final de 2 → campeón + placa CAMPEÓN + conectores rojos; visor reproduce mix 0/32 y termina en "¡BRACKETS LISTOS!"; OBS /?obs=1: estado de espera 2×2 y, con la final en juego, exactamente 2 barras (PC1/PC2) del tamaño 1v1. Estado del torneo restaurado (final FINALIZADA, campeón CRIMSONKING93). Lint limpio; sin errores de consola (solo warnings esperados de Firestore por clicks automatizados rápidos).

Stage Summary:
- El bracket FFA ya no desperdicia slots: 32 jugadores = 32 slots de primera ronda (16 por lado), igual que el 1v1, con la Gran Final al centro en modo espejo.
- Slots y PCs adaptativos: la final tiene exactamente los clasados reales (2 semis → final de 2) y el OBS muestra sólo las barras reales.
- Nombres de ronda coherentes con el formato FFA (OCTAVOS/CUARTOS/SEMIFINALES por nº de matches).
- NOTA: los brackets FFA existentes conservan la estructura vieja hasta que se lance un nuevo mix (RE-MIX TOTAL reconstruye con la forma optimizada).
- Archivos: src/lib/bracket.ts, src/lib/pcs.ts, src/components/bracket/BracketTree.tsx, src/components/arena/ObsOverlay.tsx, src/components/arena/LiveAdminView.tsx, src/app/globals.css.

---
Task ID: 8
Agent: Z.ai Code (main)
Task: Sistema de BANCOS rotativos por rondas — los eliminados de cada eliminatoria reemplazan al banco y cubren no-shows en la ronda siguiente (cualquier modalidad).

Work Log:
- Nuevo src/lib/bank.ts (lógica pura, sin estado propio): computeBank(bracket, players) deriva el banco efectivo en tiempo real — antes de que termine la primera eliminatoria usa las reservas del registro (seat==="bank", excluyendo las ya insertadas en el bracket); cuando existe una ronda completa (isRoundComplete/lastCompletedRound), el banco se RENUEVA con TODOS los eliminados de esa ronda (slots perdedores de matches no-bye, ganador definido; byes no generan reservas). Los eliminados que ya cubrieron un no-show (pids presentes en slots de rondas posteriores) salen del banco solos. Entradas BankEntry {key estable, label, detail, members, origin: register|round, fromRound, dq}. Si el admin reinicia resultados o deshace, el banco se recalcula solo (vista derivada, siempre consistente).
- actions.ts: replaceFromBank generalizado a BankPick {label, members, full?} — modalidades individuales (1v1/FFA) o full:true reemplazan el participante COMPLETO (así un equipo eliminado entra entero como reserva); equipos + reserva individual del registro conservan la integración por miembro (sustituye DQ → completa hueco → 1er integrante). Guard nuevo: matches status "done" no admiten reemplazos.
- LiveAdminView: bankInfo = computeBank(bracket, players) reemplaza al filtro estático. Modal de banco reescrita: encabezado contextual ("Reservas del registro…" vs "Banco renovado: reservas eliminadas en CUARTOS DE FINAL"), cada entrada con chip de origen ("REGISTRO" gris / "ELIM. CUARTOS" ámbar) y chip DQ rojo si aplica. Panel "banco rápido" del MatchPanel muestra origen y conteo ("Banco de registro (2)" / "Banco · eliminados de CUARTOS DE FINAL (4)") con hint del ciclo de renovación. Botón BANCO por slot deshabilitado si el match terminó o banco vacío (con title explicativo).
- SpectatorView: ticker del visor muestra el banco efectivo — "BANCO DE RESERVAS: N DISPONIBLES" (fase registro) o "BANCO · ELIMINADOS DE CUARTOS DE FINAL: N RESERVAS" (banco rotativo).
- VERIFICACIÓN E2E (agent-browser 1920×1080, torneo nuevo BANCO TEST E2E 1v1 · 8 plazas · banco 2): 8 demo + 2 reservas manuales → mix → (A) panel muestra "BANCO DE REGISTRO (2)" con BANKONE/BANKTWO y modal con chips REGISTRO ✔; (B) completados los 4 matches de CUARTOS → banco reemplazado por los 4 eliminados (IRONFALCON66, STORMREAPER23, VORTEXSTRIKE12, STORMPANDA23) y las reservas del registro desaparecen ✔; (C) no-show en SEMI·M1 → sustitución con IRONFALCON66: badge SUB en panel y árbol, PC1 replanificada, banco baja a (3) solo ✔; (D) el suplente gana y avanza a la GRAN FINAL ✔; ticker del visor "BANCO · ELIMINADOS DE CUARTOS DE FINAL: 3 RESERVAS" ✔. Firestore verificado (slot r1m0 con st:"rep", pid del suplente). Sin errores de consola, lint limpio. Torneo de prueba eliminado al final.

Stage Summary:
- El banco ahora es rotativo: al cerrar cada eliminatoria, los eliminados de esa ronda se convierten en las únicas reservas (los lugares anteriores se liberan) y pueden cubrir no-shows de la ronda siguiente; al entrar a un match salen del banco automáticamente. Funciona igual en 1v1, FFA (individuos) y 2v2/3v3/4v4 (equipos completos). Implementado como vista derivada del bracket: cero migraciones, siempre consistente con resets/deshacer.
- Archivos: src/lib/bank.ts (nuevo), src/lib/actions.ts, src/components/arena/LiveAdminView.tsx, src/components/arena/SpectatorView.tsx.
