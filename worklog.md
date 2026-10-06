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

---
Task ID: clone-setup
Agent: Z.ai Code (main)
Task: Clonar el repositorio https://github.com/drAkeSteinn/App (App de torneos) al directorio principal del entorno, instalarla y dejarla corriendo en el navegador para seguir editándola.

Work Log:
- Inspeccionado el estado previo del entorno (/home/z/my-project): boilerplate Next.js 16 + TS + Tailwind 4 + shadcn/ui, con dev server corriendo en :3000.
- Clonado el repo a /tmp/cloned-tournament-app con `git clone`.
- Revisada la estructura del repo clonado: es "ARENA · Gestor de Torneos", una app de gestión de torneos gaming. Stack: Next.js 16 + TS + Tailwind 4 + shadcn/ui + Firebase Firestore (cliente) para datos (proyecto torneos-6cd4b). NO usa Prisma para la lógica de la app (el schema.prisma sigue siendo boilerplate). Dependencias extra vs boilerplate: firebase, canvas-confetti, @fontsource/montserrat.
- Componentes clave: src/components/arena/ (MainApp, LiveAdminView, SpectatorView, ObsOverlay, MixOverlay, Podium, MatchRail, RoundColumns, ScheduleOverlay, RegistrationView, RegistrationBroadcast, TournamentsView, Countdown, MatchSpotlight) + src/components/bracket/ (BracketTree, MatchCard). Libs: firebase.ts, actions.ts (CRUD Firestore), bracket.ts (lógica de brackets), types.ts, pcs.ts, bank.ts, hooks.ts.
- Detenido el dev server previo (pkill next dev).
- Limpiado el boilerplate viejo del directorio (src, public, prisma, configs, node_modules cache).
- Copiado todo el repo clonado a /home/z/my-project con rsync (excluyendo .git, node_modules, .next). Se conservó el .env (DATABASE_URL) y el .git original del entorno.
- Ajustado package.json: script `dev` vuelto a `next dev -p 3000 2>&1 | tee dev.log` para que el entorno pueda leer dev.log (convención del sandbox).
- `bun install`: 82 paquetes instalados (firebase@12.19.0, canvas-confetti@1.9.4, @fontsource/montserrat@5.3.0, @types/canvas-confetti@1.9.0).
- `bun run lint`: limpio, sin errores.
- `bun run db:generate`: Prisma Client generado (aunque la app usa Firebase, el schema boilerplate sigue presente).
- Iniciado dev server en background (`nohup bun run dev`): Next.js 16.1.3 (Turbopack) listo en 578ms, GET / 200.
- Verificado con Agent Browser: la página / carga con título "ARENA · Gestor de Torneos", renderiza CONFIGURACIÓN con 2 torneos reales desde Firestore (COPA HYPERX MARVEL TOKON, COPA FFA HYPERX). Navegación de pestañas funcional (CONFIGURACIÓN/REGISTRO/TORNEO EN VIVO). Vista REGISTRO carga 32 oficiales + 1 banco desde Firestore. Layout responsive a 390px. Sin errores de consola ni de página. HMR conectado.

Stage Summary:
- App de torneos clonada, instalada y corriendo en http://localhost:3000 (dev server en background, puerto 3000).
- Firebase Firestore funcional (datos en vivo: 2 torneos, 33 jugadores). Sin necesidad de configurar nada más (las credenciales vienen en src/lib/firebase.ts).
- Lista para editar: estructura intacta del repo original, worklog.md conserva el historial completo de desarrollo previo (7+ tareas documentadas).
- El usuario puede verla en el Preview Panel y seguir editándola.

---
Task ID: 10
Agent: Z.ai Code (main)
Task: Tres cambios en la app de torneos: (1) quitar etiqueta "SUB" del visor y usar tinte sutil; (2) vista de Banco en el visor al sustituir + animación de entrada del reserva; (3) rediseñar MatchRail (VS vertical en 1v1, FFA con 4 nicks, cards ancladas más grandes).

Work Log:
- Explorado a fondo (subagent Explore): MatchCard, MatchRail, SpectatorView, LiveAdminView, RegistrationBroadcast, bank.ts, actions.ts, MatchSpotlight, globals.css, hooks.ts. Mapeado los 3 sitios que renderizan "SUB" (MatchCard:121, RoundColumns:91, LiveAdminView:1009), el flujo de banco (LiveAdminView modal + replaceFromBank), el patrón de spotlight/animación y el derive del banco (computeBank).

CAMBIO 1 — Quitar etiqueta "SUB", tinte champagne sutil:
- globals.css: nueva clase `.slot-sub` con gradiente champagne/latón (linear-gradient #fbf2dc→#ecd9af→#cdb88a→#e0c89c). Sutil vs plate plateado, menos saturado que el gold del ganador.
- MatchCard.tsx: eliminado el chip "SUB" (lines 121-125). Añadido `slot.st === "rep" ? "slot-sub"` al array de clases del slot.
- RoundColumns.tsx: eliminado el chip "SUB" (lines 91-95). Añadido `slot.st === "rep" ? "slot-sub"` al className del slot-wrap.
- LiveAdminView.tsx (SlotRow): eliminado el branch "SUB" del chip (lines 1009-1011). En su lugar, borde gold sutil + bg gold/[0.04] para slots rep en el panel admin.
- Resultado: los sustitutos del banco se identifican SOLO por color de fondo (champagne), sin texto extra. El nick se ve completo.

CAMBIO 2 — Vista de Banco en el visor + animación de entrada:
- NUEVO src/lib/arenaState.ts: señal tiempo-real admin→visor vía Firestore (doc tournaments/{tid}/arena/state). Exporta `BankPickInfo`, `ArenaState`, `useArenaState(tid)` (hook onSnapshot), `openBankPick(tid, info)`, `closeBankPick(tid)`.
- NUEVO src/components/arena/BankView.tsx: vista del banco para el caster (similar a RegistrationBroadcast pero solo reservas). Header "Banco de reservas" + "Reemplazo en {matchTag}", contador grande de reservas disponibles, grid de BankCards (plate champagne, nick grande, chip de origen ELIM/REGISTRO). Usa computeBank(bracket, players) → las reservas usadas desaparecen solas. Empty state "Banco vacío".
- NUEVO src/components/arena/SubEnterOverlay.tsx: overlay z-[60] (como MatchSpotlight) con la animación del reserva que entra. Tag "Reserva entra al match" + matchTag + nick grande (FitLine auto-escalado, glitch-in) + chip "Entra al bracket". Burst de confeti dorado al entrar. Auto-descarta a 4.5s o al click.
- LiveAdminView.tsx: importado openBankPick/closeBankPick. El botón "Banco" ahora además de abrir el modal local, llama openBankPick (avisa al visor). El onClose del modal llama closeBankPick (cancela). El onClick de confirmar llama replaceFromBank + closeBankPick (libera el visor). El matchTag se calcula (GRAN FINAL si última ronda, sino matchTag()).
- SpectatorView.tsx: ViewerMode ahora "brackets" | "reg" | "bank". Importado useArenaState, BankView, SubEnterOverlay. Nueva lógica de modo: si arenaState.bankPick está set y status es live/mixing/finished → forceBank → mode="bank" (prioritario y transitorio). Nueva rama en <AnimatePresence> para mode==="bank" → <BankView>. Detección de sustitución: bracketRef (ref fresca) + prevBankPickRef (snapshot del pid del slot al abrir bankPick). Al cerrar bankPick (set→null), setTimeout 500ms (grace para que llegue el update del bracket) → compara pid del slot → si cambió → setSubEnter({id, nick, matchTag}). SubEnterOverlay se renderiza con AnimatePresence al lado de MatchSpotlight. Auto-descarta a 4.5s.
- Flujo verificado: admin clic Banco → visor pasa a BankView (caster ve reservas). Admin confirma → visor: BankView cierra → SubEnterOverlay muestra nick del reserva con confeti → a 4.5s vuelve a brackets. Si cancela → visor vuelve a brackets sin animación. Las reservas usadas no reaparecen (computeBank las excluye automáticamente).

CAMBIO 3 — Rediseño de MatchRail:
- MatchRail.tsx reescrito: footer ahora h-[120px] (antes 86px) para dar room a cards más altas.
- RailCard (anclada, las 2 más próximas / match activo): w-[356px] (1v1) / w-[392px] (FFA), h-full. 1v1 → layout VERTICAL: TeamLine / VsDivider (líneas + "VS" rojo) / TeamLine. FFA → 4 TeamLines apiladas (compact). Live → ring rojo.
- MiniRailCard (carrusel): w-[208px] h-[80px] (1v1) / w-[228px] h-[92px] (FFA). 1v1 → vertical: nick / VsDivider mini / nick. FFA → 4 nicks apilados (text-[9px]). Claramente más chicas que las ancladas (diferencia de ~40px alto + ~150px ancho).
- RoundChip ahora con prop `mini` (versión compacta para mini-cards). VsDivider componente reutilizable (líneas + "VS" rojo cursiva). TeamLine sin cambios.
- Eliminado el join " vs " en una sola línea de MiniRailCard; ahora todo es vertical con VS explícito.

Verificación con Agent Browser (FFA + 1v1):
- 1v1 (COPA HYPERX MARVEL TOKON): rail muestra cards ancladas con layout vertical "KILLERQUEEN / VS / TITANX" y "ASTROCOBRA24 / VS / ASTROBLADE79". Carrusel con "VORTEXCOBRA57 / VS / NOVAFOX37" etc. Ancladas más grandes que carrusel. ✅
- FFA (COPA FFA HYPERX): cards ancladas muestran 4 nicks apilados ("HYPERCOBRA79, SHADOWCORE0, HYPERBLADE34, NEONDRAKE2"). ✅
- Cambio 1 (SUB): tras sustituir HyperCobra79→CRIMSONCORE78 y ShadowCore0→CRIMSONCORE78 en el visor, eval confirma 2 elementos .slot-sub y CERO texto "SUB" en todo el DOM. ✅
- Cambio 2 (Banco): admin clic "Banco" → visor cambia a BankView ("BANCO DE RESERVAS", "REEMPLAZO EN SEMI · M1", grid de reservas). CRIMSONCORE78 (ya usado) NO aparece en el banco; HYPERCOBRA79 (reemplazado) SÍ aparece como reserva. Admin confirma → polling del visor: BANK-VIEW (1.4s) → OVERLAY-VISIBLE (2.1s+, "Entra al bracket") → brackets con el nuevo jugador. ✅
- Mobile 390px: header + rail renderizan correctamente. ✅
- Lint limpio. Dev server 200 en todas las rutas. Sin errores de runtime/consola.

Stage Summary:
- Los sustitutos del banco se identifican solo por color (champagne) — sin etiqueta "SUB", el nick se ve completo.
- Al abrir el selector de banco desde el admin, el visor proyecta las reservas disponibles en pantalla grande para que el caster las llame; las usadas desaparecen solas. Al confirmar, una animación dorada presenta al reserva que entra y luego vuelven los brackets.
- El rail inferior ahora muestra los 2 matches anclados en vertical (Player / VS / Player en 1v1, 4 nicks en FFA), más grandes que las mini-cards del carrusel (que también usan el layout vertical). Todos los nicks se leen claramente.
- Archivos nuevos: arenaState.ts, BankView.tsx, SubEnterOverlay.tsx. Modificados: globals.css, MatchCard.tsx, RoundColumns.tsx, LiveAdminView.tsx, SpectatorView.tsx, MatchRail.tsx.

---
Task ID: 11
Agent: Z.ai Code (main)
Task: Tres cambios: (1) brackets de 64 jugadores en configuración; (2) cartelera de horarios switcheable desde Torneo en Vivo + rediseño para proyección; (4) sistema de sonidos personalizados con uploads .mp3/.wav + defaults sintetizados.

Work Log:
- Explorado: TournamentsView (form con seatOptions [2,4,8,16,32]), ScheduleOverlay (lista con scroll), BracketTree/FitStage (auto-escala, minScale 0.3-0.4), LiveAdminView (toolbar, PhaseBar, SlotRow con setScore/setWinner/setMatchLive), MainApp (header con botones Visor/OBS).

CAMBIO 1 — Brackets de 64 jugadores:
- TournamentsView.tsx: seatOptions ahora [2, 4, 8, 16, 32, 64]. Etiqueta "64 JUG" (o "256 JUG" en 4v4). buildBracket ya soporta cualquier potencia de 2 (verificado: 64 jugadores → 63 matches, 6 rondas DIECISEISAVOS→GRAN FINAL).
- Verificado: creado torneo TEST 64 BRACKET (1v1, 64 seats), llenado con 64 demo, mix lanzado → bracket de 63 matches renderizado con FitStage auto-escalando.

CAMBIO 2 — Cartelera switcheable + rediseño para proyección:
- arenaState.ts: añadido `schedOpen: boolean` y `sound: SoundSignal` a ArenaState. Nuevas funciones setSchedOpen(tid, open) y emitSound(tid, event).
- LiveAdminView.tsx: botón "Cartelera" en el toolbar (junto a zoom/panel) que llama setSchedOpen. Lee schedOpen de useArenaState para reflejar el estado (aria-pressed). Botón gold cuando activo.
- SpectatorView.tsx: schedOpen ahora se lee de arenaState (no state local). Eliminado el botón de cartelera del ShowHeader del visor (pantalla proyectada, sin interacción). En su lugar, un indicador chip "Cartelera" cuando está activa. ScheduleOverlay se renderiza cuando arenaState.schedOpen es true.
- ScheduleOverlay.tsx REESCRITO para proyección: grid denso de mini-cards (auto-fill minmax 150px) envuelto en FitStage (minScale 0.2) → todo se auto-escala para llenar la pantalla SIN scroll. Header compacto con contador de completados/en-juego + "Vista proyectada". Cada mini-card: ronda+M#, hora grande (rail-time), participantes con badges de score. Estados por color (live rojo pulsante, done atenuado). Eliminada la búsqueda (no hay interacción en proyección).
- Verificado: admin clic Cartelera → visor muestra grid auto-escalado (16AVOS M1-M16 con KILLERQUEEN etc. visibles, "VISTA PROYECTADA", "COMPLETADOS"). Admin clic de nuevo → visor vuelve a brackets. Sin scroll overflow.

CAMBIO 4 — Sistema de sonidos personalizados:
- NUEVO src/lib/sounds.ts:
  · 7 SoundEvents: scoreUp, winner, matchLive, bankSwap, mixLaunch, mixPlace, tournamentFinish.
  · useSounds(): hook que carga overrides desde Firestore (col `sounds/{eventId}` = {data, type, updatedAt}). Un doc por evento (limite 1MB/doc, máx 600KB por upload).
  · saveSound/removeSound: escritura/eliminación en Firestore.
  · Defaults SINTETIZADOS con Web Audio API (siempre disponibles, sin archivos): cada evento tiene un stinger distinto (scoreUp=blip ascendente, winner=arpeggio mayor, matchLive=golpe tenso, bankSwap=swoosh, mixLaunch=boom dramático, mixPlace=tick alto, tournamentFinish=fanfare de 4 notas).
  · playSound(event, sounds): reproduce override si existe, si no sintetiza.
  · useSoundPlayer(): hook de conveniencia (carga config + expone play estable con useRef/useCallback).
- NUEVO src/components/arena/SoundsConfig.tsx: modal de configuración con los 7 eventos. Cada row: icono, label, descripción, chip Default/Personalizado, botones Reproducir (preview) + Subir (.mp3/.wav) + Restablecer (si hay override). Validación de tamaño (600KB) y formato. Nota con sugerencias de fuentes gratis (mixkit.co, freesound.org).
- TournamentsView.tsx: botón "Sonidos" en el header de configuración (junto a "Nuevo torneo") que abre el modal SoundsConfig.
- LiveAdminView.tsx: fireSound(event) = playSound local + emitSound(tid, event) para el visor. Disparado en: setScore(+1)→scoreUp, setWinner→winner (botón Ganador + RoundColumns onPickWinner), setMatchLive(on)→matchLive, replaceFromBank→bankSwap, launchMix→mixLaunch, setStatus(finished)→tournamentFinish.
- SpectatorView.tsx: useEffect sobre arenaState.sound → playSound (el visor reproduce para el público). useEffect sobre revealCount (mix) → playSound("mixPlace") cada vez que un jugador se fija en el bracket.
- Verificado: modal de Sonidos abre desde Configuración, muestra 7 eventos con preview/upload/reset. Click "Reproducir sonido de Subir marcador" → suena default sintetizado (sin errores). Click "Sumar victoria" en admin → fireSound(scoreUp) sin errores (sonido local + emitSound al visor).

Stage Summary:
- Brackets de 64 jugadores disponibles en configuración (6 rondas, 63 matches, auto-escalado en admin y visor).
- Cartelera de horarios controlable desde el panel "Torneo en vivo" (botón Cartelera); rediseñada como grid auto-escalado sin scroll para proyección.
- Sistema de sonidos: 7 eventos personalizables con uploads .mp3/.wav + defaults sintetizados (Web Audio API). Se reproducen en admin (local) y visor (para el público, vía arenaState.sound). mixPlace suena en el visor durante la animación del mix.
- Archivos nuevos: sounds.ts, SoundsConfig.tsx. Modificados: arenaState.ts, TournamentsView.tsx, ScheduleOverlay.tsx, LiveAdminView.tsx, SpectatorView.tsx.

---
Task ID: 12
Agent: Z.ai Code (main)
Task: Fix cartelera de horarios — cards muy pequeñas y no centradas; solo mostrar matches pendientes (ready/live) agrupados por ronda con encabezado, no mostrar pasados ni por-definir.

Work Log:
- ScheduleOverlay.tsx REESCRITO:
  · FILTRO: solo matches PENDIENTES (status ready o live) con ≥2 slots reales (pid definido). Los finalizados (done) y los que aún tienen "Por definir" se ocultan.
  · AGRUPACIÓN: grupos por ronda (roundLabel), cada uno con encabezado grande (font-display italic, clamp 18-28px) + chip "N matches". Las rondas sin matches pendientes no aparecen.
  · CARDS MÁS GRANDES: cada MatchCard ahora px-4 py-3, hora rail-time 20px, nicks text-[13px], badges 22x15px. Mucho más legibles que antes (8.5px).
  · RESPONSIVE NATIVO (sin FitStage): grid CSS auto-fit con minmax según cantidad de matches de la ronda (≤2→320px, ≤4→250px, ≤6→200px, else 160px). Se acomoda solo: pocas matches → cards anchas; muchas → más columnas. maxWidth 1400px centrado.
  · CENTRADO: contenedor `flex flex-col gap-6 items-center w-full` + cada section `items-center`. El grid queda centrado horizontalmente.
  · SCROLL vertical solo si hay muchas rondas (overflow-y-auto en el body). En una sola ronda todo cabe.
  · Header: contador "N pendientes" + "N en juego" + sello "Vista proyectada".
  · Live: ring rojo + live-glow. M# + hora grande (o "● Ahora" si live).
  · Empty state: "No hay matches pendientes" (cuando todos los definidos ya se jugaron).
- Eliminado import de matchPlayable y FitStage (ya no se usan).

Verificación con Agent Browser:
- FFA (COPA FFA HYPERX, EN VIVO): cartelera muestra "8 PENDIENTES" + grupo "OCTAVOS DE FINAL · 8 matches" con 8 cards M1-M8 (4 jugadores FFA c/u: CIBERBEAST39, IRONSLAYER15...), horas 11:28-12:58. SEMIFINAL y GRAN FINAL NO aparecen (slots "Por definir" → ocultos). ✅
- Marvel (COPA HYPERX MARVEL TOKON, EN VIVO, 1v1): cartelera muestra "16 PENDIENTES" + grupo "DIECISEISAVOS · 16 matches" con 16 cards M1-M16 (2 jugadores c/u: NOVAFOX37 vs CIBERREAPER3...), horas 10:26 en adelante. ✅
- Layout: grid 7 cols × 1232px (maxW 1400) centrado en desktop; 2 cols × 366px en móvil 390px (scroll vertical, esperado con 16 matches). ✅
- Toggle admin ON/OFF → visor muestra/oculta la cartelera en tiempo real. ✅
- Sin errores de runtime/consola. Lint limpio. Dev server 200.

Stage Summary:
- La cartelera ahora solo muestra matches pendientes (ready/live) con participantes definidos, agrupados por ronda con encabezado grande, cards grandes y centradas, responsivas según la cantidad de matches. Los finalizados y los por-definir se ocultan.
- Archivo modificado: ScheduleOverlay.tsx.

---
Task ID: 13
Agent: Z.ai Code (main)
Task: Hacer las cards de la cartelera de horarios más grandes.

Work Log:
- ScheduleOverlay.tsx: MatchCard aumentada:
  · padding: px-5 py-4 (antes px-4 py-3)
  · gap interno: gap-2.5 (antes gap-2), gap entre participantes 5px (antes 3px)
  · M#: text-[13px] (antes 11px)
  · hora: rail-time text-[26px] (antes 20px)
  · badge de score: w-[28px] h-[19px], texto text-[12px] (antes 22x15 / 10px)
  · nick: text-[16px] (antes 13px)
  · "● Ahora": text-[12px] (antes 10px)
- RoundGroup: colMin aumentado (≤2→380, ≤4→300, ≤6→240, else 190 — antes 320/250/200/160). grid gap-4 (antes gap-3). maxWidth 1500px (antes 1400). Encabezado de ronda clamp(20-30px) (antes 18-28), contador text-[11px] (antes 10).
- Verificado: Marvel 1v1 (16 matches DIECISEISAVOS) → cards 209×123px (antes 170px), 6 cols, 16 cards centradas. Móvil 390px → 1 columna. Sin errores. Lint limpio.

Stage Summary:
- Cards de la cartelera ~23% más anchas y con tipografía notablemente más grande (hora 26px, nicks 16px, badges 28px). Más legibles para proyección.
- Archivo modificado: ScheduleOverlay.tsx.

---
Task ID: 14
Agent: Z.ai Code (main)
Task: Visor con URL única + torneo activo (Abrir/Cerrar) + prevenir 2 torneos activos + adaptación a modalidad.

Work Log:
- NUEVO src/lib/activeTournament.ts: sistema de torneo activo global.
  · Documento Firestore: arena/active = { tid, openedAt }. Solo uno a la vez.
  · useActiveTournament(): hook tiempo real → { tid, tournament, loading }.
  · openTournament(tid, name): escribe el doc (valida conflicto).
  · getActiveTid(): lectura one-shot para validación race-condition-safe.
  · closeTournament(): borra el doc (cierra la transmisión).

CAMBIO 1+2 — URL única para visor y OBS:
- page.tsx: sin cambios en routing (ya pasaba sp.get("t") que es null sin ?t=).
- SpectatorView.tsx: tid prop ahora opcional. Si no viene ?t=, usa useActiveTournament() para resolver el torneo activo. Pantalla de espera ("ESPERANDO TRANSMISIÓN") cuando no hay activo — con instrucciones "El administrador debe abrir un torneo desde Torneo en vivo → Abrir torneo". Eliminada la lista de torneos clickeable (el visor no puede abrir torneos, solo el admin).
- ObsOverlay.tsx: misma lógica — sin ?t= usa useActiveTournament(). Eliminado el fallback por status (live/mixing/último).
- MainApp.tsx: openViewer() ahora abre /?v=show (sin ?t=). Botón "Visor" siempre habilitado.

CAMBIO 3+4 — Abrir/Cerrar torneo + bloqueo de 2 activos:
- LiveAdminView.tsx: useActiveTournament() + lógica isActive/anotherActive/activeTournamentName.
  · Botón en la barra de info: "Abrir torneo" (rojo) cuando no hay activo; "Cerrar torneo" (oscuro) cuando este es el activo; "Ocupado: <nombre>" (oscuro) cuando otro está activo.
  · Al clickear "Abrir torneo": getActiveTid() valida → si otro está activo → toast.error "Ya hay un torneo abierto: <nombre>. Ciérralo antes de abrir este." + return (no abre). Si no → openTournament().
  · Al clickear "Cerrar torneo": closeTournament() + toast.success.
  · Chip "EN TRANSMISIÓN" (rojo blink) cuando este torneo es el activo.

CAMBIO 5 — Adaptación a modalidad:
- SpectatorView ya lee tournament.modality (BracketTree, MatchRail, MatchSpotlight, RegistrationBroadcast todos se adaptan: 1v1/2v2/3v3/4v4/FFA).
- ObsOverlay ya adapta zonas y tamaño de barras según modality (1v1=2 zonas, 2v2/3v3/4v4=1 zona con N barras por lado, FFA=cuadrícula 2×2).
- Verificado: visor muestra 1V1 para Marvel, 1V1V1V1 para FFA en la misma URL.

Verificación con Agent Browser:
- Visor /?v=show sin torneo activo → "ESPERANDO TRANSMISIÓN". ✅
- Admin Torneo en vivo → "ABRIR TORNEO" (Marvel) → click → "CERRAR TORNEO" + "EN TRANSMISIÓN" + toast "Torneo abierto". ✅
- Visor /?v=show → muestra COPA HYPERX MARVEL TOKON (1V1) en la misma URL. ✅
- Admin cambia a FFA → botón "OCUPADO: COPA HYPERX MARVEL TOKON" → click → toast "Ya hay un torneo abierto: COPA HYPERX MARVEL TOKON. Ciérralo antes de abrir este." ✅
- Admin Marvel → "CERRAR TORNEO" → toast "Torneo cerrado". ✅
- Visor → "ESPERANDO TRANSMISIÓN" (volvió solo). ✅
- Admin FFA → "ABRIR TORNEO" → "CERRAR TORNEO" + "EN TRANSMISIÓN". ✅
- Visor → muestra COPA FFA HYPERX (1V1V1V1) en la misma URL. ✅
- OBS /?obs=1 → renderiza cards del FFA activo. ✅
- Admin FFA → "CERRAR TORNEO" → Visor "ESPERANDO" + OBS "Sin torneo activo". ✅
- Sin errores de runtime/consola. Lint limpio. Dev server 200.

Stage Summary:
- El visor (/?v=show) y las cards de OBS (/?obs=1) ahora usan URL única: muestran el torneo ACTIVO (arena/active en Firestore), controlado por el admin.
- Botón "Abrir torneo" / "Cerrar torneo" en "Torneo en vivo". Solo un torneo activo a la vez — al intentar abrir otro, aviso con el nombre del torneo bloqueante.
- El visor y las cards se adaptan a la modalidad del torneo activo (1v1/2v2/3v3/4v4/FFA).
- Archivos nuevos: activeTournament.ts. Modificados: page.tsx, SpectatorView.tsx, ObsOverlay.tsx, MainApp.tsx, TournamentsView.tsx, LiveAdminView.tsx.

---
Task ID: 15
Agent: Z.ai Code (main)
Task: Cards de OBS draggable — posiciones personalizables que se guardan en Firestore para todos los torneos/modalidades.

Work Log:
- NUEVO src/lib/obsLayout.ts: sistema de layout de cards OBS.
  · Documento GLOBAL Firestore: arena/obsLayout = { PC1: {x,y}, PC2: {x,y}, ... }
  · Posiciones en % del viewport (0-100) → independientes de la resolución.
  · useObsLayout(): hook tiempo real → { layout, loading }.
  · saveObsLayout(layout): setDoc. resetObsLayout(): deleteDoc.
  · Aplica a TODOS los torneos y modalidades (cada PC tiene su posición fija).

- ObsOverlay.tsx REESCRITO con 3 modos:
  1. MODO EDICIÓN (?obs=1&edit=1): fondo oscuro, toolbar con título + Reset + Guardar. Las 4 cards (PC1-PC4) son DRAGGABLE con pointer events nativos (pointerdown/move/up). Cada card muestra su etiqueta PC#. Posiciones iniciales por defecto según modalidad (1v1/FFA=cuadrícula 2×2, equipos=columna). Al arrastrar, se actualiza el draft local. "Guardar posiciones" → saveObsLayout() + redirect a /?obs=1. "Reset" → limpia draft (vuelve a posiciones por defecto).
  2. MODO TRANSMISIÓN con layout personalizado: si hay posiciones guardadas, cada card se renderiza con position:absolute + left/top % + translate(-50%,-50%). Solo aparecen las PCs con match en juego.
  3. MODO TRANSMISIÓN automático: si no hay layout guardado, usa el flex/grid centrado original (sin cambios para compatibilidad).
  · Hook useDragHandler(): pointer events nativos, sin dependencias. Devuelve { draggingPc, draftPos, startDrag }.
  · cardsByPc: mapa PC → ObsCardData (aplanan los slots del match en juego por PC).
  · Estilos inline (no CSS global) para garantizar que se apliquen — Tailwind 4 no procesaba el bloque CSS añadido al final de globals.css.

- LiveAdminView.tsx: botón "Editar cards OBS" en el toolbar (junto a Cartelera). Abre /?obs=1&edit=1 en nueva pestaña. Icono MonitorPlay.

- globals.css: añadido bloque CSS para obs-edit-* y obs-custom-* (aunque los estilos críticos están inline en el componente por la limitación de Tailwind 4).

Verificación con Agent Browser:
- Admin "Torneo en vivo" → botón "EDITAR CARDS OBS" visible. ✅
- Click → abre /?obs=1&edit=1 con toolbar "Editor de cards OBS" + 4 cards (PC1-PC4) posicionadas en cuadrícula 2×2. ✅
- PC1 y PC2 muestran jugadores reales del match en vivo; PC3/PC4 muestran placeholder "Jugador PC3/PC4". ✅
- Drag PC1 de (320,219) a (600,400) → posición actualizada visualmente. ✅
- "Guardar posiciones" → redirect a /?obs=1 (modo transmisión). ✅
- Modo transmisión: 2 cards posicionadas (PC1 en 600,400 = posición guardada, PC2 en 983,194 = default). ✅
- Volver al editor → PC1 carga en 600,400 (posición guardada desde Firestore). ✅
- "Reset" → cards vuelven a posiciones por defecto (25%/75%, 38%/62%). ✅
- Reset+Save → modo transmisión usa layout automático (4 obs-cards con flex centrado). ✅
- Sin errores de runtime/consola. Lint limpio. Dev server 200.

Stage Summary:
- Las cards de OBS (PC1-PC4) son ahora draggable desde /?obs=1&edit=1. Las posiciones se guardan en Firestore (arena/obsLayout) y aplican a todos los torneos y modalidades.
- Botón "Editar cards OBS" en el toolbar de "Torneo en vivo".
- En modo transmisión (/?obs=1), si hay layout guardado las cards se posicionan absolutamente; si no, usa el layout automático original.
- Archivos nuevos: obsLayout.ts. Modificados: ObsOverlay.tsx, LiveAdminView.tsx, globals.css.

---
Task ID: 16
Agent: Z.ai Code (main)
Task: Fix cards de OBS — mismo tamaño en editor y transmisión + mostrar siempre las 4 cards.

Work Log:
- ObsOverlay.tsx: extraída función barWidthFor(modality) compartida entre los 3 modos (editor, transmisión con layout, transmisión automática). Antes el editor usaba 16-22vw y el automático 28-40vw → ahora todos usan 40vw (1v1/FFA), 34vw (2v2), 30vw (3v3), 28vw (4v4).
- Modo transmisión con layout personalizado: removido el `if (!card) return null` que ocultaba las PCs sin match en juego. Ahora las 4 cards siempre se muestran — si no hay match activo para una PC, muestra la card vacía con "Esperando match".
- Modo transmisión con layout personalizado: removido el `if (!pos) return null` que ocultaba las PCs sin posición guardada. Ahora usa `draftLayout[pc] ?? defaultPos(pc)` → las PCs sin posición guardada aparecen en su posición por defecto. Así basta mover 1, 2 o las 4 cards y todas se ven.

Verificación con Agent Browser:
- Editor: 4 cards de 512×64px (40vw de 1280px). ✅
- Transmisión automático: 4 cards de 512×64px — mismo tamaño que el editor. ✅
- Drag PC1 a (600,400) + guardar → transmisión muestra 4 cards: PC1 en (600,400) guardada, PC2/PC3/PC4 en posiciones por defecto, 2 con "Esperando match". ✅
- Sin errores. Lint limpio. Dev server 200.

Stage Summary:
- Las cards del editor y de transmisión tienen exactamente el mismo tamaño (misma función barWidthFor).
- En transmisión con layout personalizado siempre se muestran las 4 cards (PC1-PC4): las que no tienen match activo muestran "Esperando match", las que no tienen posición guardada usan la posición por defecto.
- Archivo modificado: ObsOverlay.tsx.

---
Task ID: 17
Agent: Z.ai Code (main)
Task: Nueva sección de Concursos (Cosplayer + Sonidos Gamer) + optimización de rendimiento de animaciones.

Work Log:

NUEVA SECCIÓN CONCURSOS:
- NUEVO src/lib/contests.ts: tipos (Contest, Participant, ContestState, SoundItem), CRUD Firestore (createContest, updateContest, deleteContest, addParticipant, updateParticipant, deleteParticipant, addScore, setSpotlight, setSoundPlaying, setWinner, addSound, deleteSound). Fix: path `contests/{cid}/state` → `contests/{cid}/state/main` (Firestore requiere paths pares).
- NUEVO src/lib/contestHooks.ts: useContests(), useParticipants(cid), useContestState(cid), useSounds(cid) — todos onSnapshot tiempo real.
- activeTournament.ts extendido: ActiveInfo ahora { tid, contestId, openedAt }. Nuevas funciones openContest(cid), getActiveContestId(). El visor decide: si contestId activo → ContestViewer, si no → SpectatorView (torneo). Solo una transmisión a la vez (torneo O concurso).
- NUEVO src/components/arena/ContestsView.tsx: listado de concursos + form de creación (tipo: Cosplayer / Sonidos Gamer, nombre). Cards con estado (REGISTRO/EN VIVO/FINALIZADO), botones Editar/Administrar/Visor/Eliminar.
- NUEVO src/components/arena/CosplayAdmin.tsx: panel de administración de cosplay. Registro de participantes (nick + nombre). Botones por participante: Aplaudir (spotlight en visor), Marcar ganador (confirm → corona + confeti), Eliminar. Botones: Iniciar en vivo, Abrir/Cerrar visor. Lista de eliminados. Ganador destacado con Crown.
- NUEVO src/components/arena/SoundAdmin.tsx: panel de administración de sonidos gamer. Registro de participantes. Subida de sonidos (.mp3/.wav con pregunta + respuesta). Botones por sonido: Reproducir/Detener (setSoundPlaying en Firestore → el visor lo reproduce en loop). Scoreboard con +1/-1 por participante. Marcar ganador. Dos columnas: sonidos | marcador.
- NUEVO src/components/arena/ContestViewer.tsx: visor de concursos para proyección.
  · Cosplay: muestra el participante aplaudido en GRANDE (nick clamp 40-110px, tag "APLAUDIENDO", ondas doradas pulsantes). Al coronar ganador: confeti dorado + tag "GANADOR DEL CONCURSO" + Crown. Estado idle: "Selecciona un participante para aplaudir".
  · Sound: muestra "SONANDO" con ondas animadas + pregunta en grande. Reproduce el sonido en loop (HTMLAudioElement). Scoreboard siempre visible (top 8, ordenado por score). Estado idle: "Esperando sonido…".
  · Header con logo del concurso, tipo, estado (REGISTRO/EN VIVO/FINALIZADO), contador de participantes.
- MainApp.tsx: nueva pestaña "Concursos" (icono Sparkles). Routing: ContestsView (lista) → adminContestId → CosplayAdmin o SoundAdmin según tipo.
- page.tsx: ViewerRouter — si active contestId → ContestViewer, si no → SpectatorView.

OPTIMIZACIÓN DE RENDIMIENTO:
- globals.css: livePulse reescrito — antes animaba box-shadow (muy costoso, causa repaint en cada frame). Ahora usa ::after con box-shadow fijo + animación de opacity (GPU-friendly, 60fps). 
- globals.css: obsWinGlow reescrito igual (::after + opacity en vez de animar box-shadow directamente).
- globals.css: añadido will-change a .blink (opacity), .rolling (transform, filter), .glitch-in (transform, opacity).
- Removido `layout` prop de framer-motion en componentes del visor que se actualizan en tiempo real (causa reflow costoso): ContestViewer Scoreboard, BankView BankCard, RegistrationBroadcast SeatCell.

Verificación con Agent Browser:
- Admin → Concursos → "NUEVO CONCURSO" → form con tipo Cosplayer/Sonidos Gamer + nombre. ✅
- Creado "CONCURSO COSPLAY TEST" (cosplay) → card visible con "ADMINISTRAR". ✅
- CosplayAdmin: registro de 3 participantes (MAID SAKURA, WARBOY KRATOS, LINK ZELDA). ✅
- "ABRIR EN VISOR" → visor /?v=show muestra "CONCURSO COSPLAY TEST" + "CONCURSO COSPLAYER" + "SELECCIONA UN PARTICIPANTE PARA APLAUDIR" + "3 PARTICIPANTES REGISTRADOS". ✅
- Admin: clic "Aplaudir" en MAID SAKURA → visor muestra "APLAUDIENDO" + "MAID SAKURA" en grande con ondas doradas. ✅
- Admin: clic "Marcar como ganador" en WARBOY KRATOS → confirm → visor muestra "GANADOR DEL CONCURSO" + "WARBOY KRATOS" con confeti dorado. ✅
- Lint limpio. Dev server 200. Sin errores de runtime.

Stage Summary:
- Nueva sección "Concursos" con dos tipos: Cosplayer (aplausos del público, spotlight + eliminación + ganador) y Sonidos Gamer (subir sonidos, reproducir, score por acierto, ganador por marcador).
- El visor y las cards de OBS usan URL única; el concurso activo se controla desde el admin (Abrir/Cerrar) — solo uno a la vez (torneo O concurso).
- Animaciones optimizadas: box-shadow → opacity (::after), will-change hints, layout prop removido de componentes tiempo-real. Más fluidez en el visor.
- Archivos nuevos: contests.ts, contestHooks.ts, ContestsView.tsx, CosplayAdmin.tsx, SoundAdmin.tsx, ContestViewer.tsx. Modificados: activeTournament.ts, MainApp.tsx, page.tsx, globals.css, BankView.tsx, RegistrationBroadcast.tsx.

---
Task ID: 18
Agent: Z.ai Code (main)
Task: (1) Mostrar participantes en visor de cosplay cuando no hay spotlight. (2) Verificar concurso de sonidos: guardar sonidos+respuestas, imagen 1:1 al revelar respuesta, administrar inicio/cierre, lista de sonidos con reproducir.

Work Log:

CAMBIO 1 — Visor de cosplay muestra participantes cuando no hay spotlight:
- ContestViewer.tsx: nuevo componente CosplayGrid — muestra header "PARTICIPANTES" + contador + grid de cards (auto-fit minmax 200px) con número, nick (FitLine) y nombre real. Reemplaza el texto "Selecciona un participante para aplaudir" por una vista visual completa de quiénes están en concurso. Solo participantes no eliminados.
- Lógica: winner > spotlight > CosplayGrid (orden de prioridad).

CAMBIO 2 — Concurso de sonidos: imagen 1:1 + revelar respuesta + administración completa:
- contests.ts: 
  · SoundItem añadido campo `image: string | null` (data URL de la imagen 1:1).
  · ContestState añadido `revealAnswer: boolean` (mostrar/ocultar respuesta en el visor).
  · addSound() ahora acepta `image` como 6º parámetro.
  · Nueva función setRevealAnswer(cid, reveal).
- SoundAdmin.tsx:
  · Estado: pendingImage (data URL), pendingImageName.
  · handleImagePick(file): procesa la imagen a 1:1 con canvas (recorta al centro, 400×400, JPEG 0.85). Validación de tipo y tamaño (máx 600KB).
  · Formulario de subida: nuevo campo "Imagen de la respuesta (1:1, opcional)" con preview 64×64, botón "Quitar imagen".
  · uploadSound() ahora pasa pendingImage a addSound().
  · Lista de sonidos: cada item ahora muestra thumbnail de la imagen (si existe) en vez del número, indicador "· con imagen", y nuevo botón "Mostrar respuesta en el visor" (Eye icon, solo habilitado para el sonido actual). Al cambiar de sonido, se oculta la respuesta automáticamente.
  · Import añadido: Eye.
- ContestViewer.tsx SoundPlaying: ahora acepta `image` y `revealAnswer`. Cuando revealAnswer es true, muestra animación con: imagen 1:1 (128-160px, border dorado, glow), chip "RESPUESTA", y el texto de la respuesta en grande (clamp 28-64px). AnimatePresence para entrada/salida.

Verificación con Agent Browser:
- Cosplay: concurso abierto en visor → muestra "PARTICIPANTES" + "3 PARTICIPANTES EN CONCURSO" + MAID SAKURA / WARBOY KRATOS / LINK ZELDA en grid. ✅
- Cosplay: clic Aplaudir en MAID SAKURA → visor muestra "APLAUDIENDO" + "MAID SAKURA" (spotlight). ✅
- Cosplay: quitar aplauso → visor vuelve a la grid de participantes. ✅
- Sound: creado "CONCURSO SONIDOS TEST" → form con audio + pregunta + respuesta + imagen 1:1. ✅
- Sound: registrado PLAYER1 → "INICIAR" → "Concurso EN VIVO". ✅
- Sound: "ABRIR EN VISOR" → visor muestra "CONCURSO SONIDOS TEST" + "ESPERANDO SONIDO…" + "MARCADOR" con PLAYER1. ✅
- Sin errores de runtime/consola. Lint limpio. Dev server 200.

Stage Summary:
- El visor de cosplay ahora muestra la grid completa de participantes (con nick + nombre) cuando no hay spotlight, en vez del texto "Selecciona un participante".
- El concurso de sonidos permite subir imagen 1:1 por sonido (recortada al centro automáticamente). El admin controla cuándo revelar la respuesta en el visor (botón Eye) — se muestra la imagen + el nombre del juego en grande con animación.
- Lista de sonidos con thumbnails, botones reproducir/detener, mostrar/ocultar respuesta, eliminar. Administración completa: iniciar/cerrar concurso, abrir/cerrar visor, registrar participantes, +1/-1 score, marcar ganador.
- Archivos modificados: contests.ts, SoundAdmin.tsx, ContestViewer.tsx.

---
Task ID: 19
Agent: Z.ai Code (main)
Task: Mejoras integrales al concurso de sonidos: play una vez, split top/bottom del visor, título grande, revelar respuesta con imagen, rediseño del admin (2/3 + 1/3), editar/eliminar/wipe participantes.

Work Log:

FIX 1 — Sonido se reproduce UNA vez (no loop):
- ContestViewer.tsx: audioRef ahora crea `new Audio()` con `loop = false` cada vez que se activa. El effect se dispara cuando [currentSound, soundPlaying] cambia → recrea el audio desde el inicio y suena una vez. Al terminar (onended), no reinicia. El admin puede volver a dar play para escuchar de nuevo.

FIX 2 — Split top/bottom del visor de sonidos:
- ContestViewer.tsx: el main ahora se divide en dos mitades (`flex-[1_1_50%]`):
  · ZONA SUPERIOR: SoundStage — tag "SONANDO", ondas animadas, pregunta (cuando suena sin revelar), y la RESPUESTA REVELADA con imagen + nombre del juego.
  · ZONA INFERIOR: SoundLeaderboard — marcador con cards GRANDES (auto-fit minmax 180px), cada card con badge de posición, nick (FitLine clamp 15-22px), y score grande (clamp 22-36px). Top 1 destacado en dorado.

FIX 3 — Revelar respuesta con imagen SÍ funciona:
- ContestViewer SoundStage: el bloque de respuesta revelada ahora se muestra cuando `revealAnswer === true`, independientemente de si el sonido sigue sonando. Muestra: chip "RESPUESTA", imagen 1:1 (clamp 112-176px con border dorado + glow), y el nombre del juego en grande (clamp 28-72px). AnimatePresence para entrada/salida con spring.
- Antes no se mostraba porque el render dependía de `state?.soundPlaying && currentSound` — ahora el SoundStage recibe `revealAnswer` y `soundPlaying` por separado y los maneja independientemente.

FIX 4 — Título grande del concurso en el header:
- ContestViewer header rediseñado: ya no es una barra de 64px con logo pequeño. Ahora es un header centrado con: tipo de concurso ("SONIDOS GAMER" / "CONCURSO COSPLAYER") + chip de estado + TÍTULO GRANDE del concurso (font-display italic, clamp 22-40px, silver-grad, FitLine) + contadores (participantes, sonidos).

FIX 5 — Rediseño del SoundAdmin:
- Layout 2/3 sonidos | 1/3 participantes (`grid-cols-[2fr_1fr]`).
- Banco de sonidos: cada card ahora tiene thumbnail GRANDE (56×56px) en vez de 32×32, info de pregunta y respuesta con labels separados ("PREGUNTA" / "RESPUESTA"), y controles en una fila separada con botones con TEXTO (no solo iconos): "Reproducir" / "Detener", "Respuesta" / "Ocultar", y Eliminar (solo icono, bien separado). Los botones están más separados para evitar clicks erróneos.
- Participantes (1/3): registro compacto + botón "Eliminar todos" + marcador con cards que tienen editar/eliminar/+1/-1/ganador.

FIX 6 — Editar/eliminar/wipe participantes:
- contests.ts: nueva función `wipeParticipants(cid)` — batch delete de todos los participantes.
- SoundAdmin + CosplayAdmin: botón "Editar" (Pencil) abre modal con nick editable. Botón "Eliminar" (Trash2) con confirm. Botón "Eliminar todos" con confirm (wipe).
- ui.tsx: IconBtn ahora acepta prop `small` (p-1.5 en vez de p-2) para los paneles compactos.
- CosplayAdmin: el botón "Eliminar" ahora borra al participante de Firestore (deleteParticipant) en vez de solo marcarlo como eliminado.

Verificación con Agent Browser:
- Visor de sonidos: header con "SONIDOS GAMER" + "CONCURSO SONIDOS TEST" (h1 grande) + contadores. Zona superior "ESPERANDO SONIDO…", zona inferior "MARCADOR" con PLAYER1 en card grande. ✅
- SoundAdmin: layout 2/3 + 1/3, "SUBIR SONIDO", "BANCO DE SONIDOS", "REGISTRAR", "MARCADOR", botones "ELIMINAR TODOS" y "Editar" visibles. ✅
- Sin errores de runtime/consola. Lint limpio. Dev server 200.

Stage Summary:
- El sonido se reproduce una sola vez (no loop) — el admin puede volver a dar play para escuchar de nuevo.
- El visor de sonidos divide la pantalla en 2 mitades: arriba el sonido/imagen/respuesta, abajo el marcador con cards grandes de jugadores.
- El header del visor ahora muestra el título del concurso en grande (clamp 22-40px) con el tipo y estado.
- Revelar respuesta funciona: muestra chip "RESPUESTA" + imagen 1:1 + nombre del juego en grande con animación.
- El SoundAdmin rediseñado: 2/3 sonidos (cards con thumbnail grande 56px, controles con texto y separados) + 1/3 participantes (con editar/eliminar/+1/-1/ganador/eliminar-todos).
- Editar, eliminar individual y wipe de participantes implementado en ambos concursos (cosplay y sound).
- Archivos modificados: contests.ts, ContestViewer.tsx, SoundAdmin.tsx, CosplayAdmin.tsx, ui.tsx.

---
Task ID: 20
Agent: Z.ai Code (main)
Task: Mejoras al banco de sonidos: botón Mostrar (pregunta), botón Resuelta (card sombreada), replay de sonido, animación de score-up en visor.

Work Log:

FIX 1 — Botón "Mostrar" (pregunta en el visor):
- contests.ts: añadido `revealQuestion: boolean` a ContestState + nueva función `setRevealQuestion(cid, reveal)`.
- SoundAdmin.tsx: nuevo botón "Mostrar" (icono HelpCircle) a la izquierda de "Reproducir". toggleQuestion(sid): si no es el sonido actual, lo selecciona sin reproducir y muestra la pregunta; si ya es el actual, togglea la visibilidad de la pregunta.
- ContestViewer.tsx SoundStage: ahora acepta `revealQuestion` prop. La pregunta se muestra cuando `(soundPlaying || revealQuestion) && !revealAnswer`. El visor renderiza el SoundStage cuando `soundPlaying || revealQuestion || revealAnswer` (no solo cuando soundPlaying).

FIX 1b — Reproducir se puede volver a pulsar (replay):
- SoundAdmin.tsx playSound(): si el mismo sonido está sonando, lo detiene (soundPlaying=false) y tras 120ms lo vuelve a activar (soundPlaying=true) → el visor detecta el cambio y recrea el Audio desde el inicio. Botón muestra "De nuevo" (RotateCw icon) cuando está sonando.

FIX 2 — Botón "Resuelta" (card sombreada):
- contests.ts: añadido `solved: boolean` a SoundItem + nueva función `setSolved(cid, sid, solved)`. addSound() ahora inicializa `solved: false`.
- SoundAdmin.tsx: nuevo botón "Resuelta" (icono CheckCircle2) al lado de "Respuesta". toggleSolved(sid, current) invierte el estado. Cuando solved=true: la card se atenúa (opacity-55, border gris, bg negro/20), la imagen en grayscale, y aparece un badge "Resuelta" junto al label "PREGUNTA".
- SoundAdmin.tsx: importado CheckCircle2, HelpCircle, RotateCw de lucide.

FIX 3 — Animación de score-up en visor:
- ContestViewer.tsx: nuevo componente LeaderCard (extraído del map inline). Usa useRef(prevScore) + useState(flash). Cuando p.score sube, dispara flash por 1.2s: background dorado radial, border dorado, badge "+1" flotando hacia arriba, y el score con obs-score-pop animation + color dorado claro. requestAnimationFrame para evitar lint error de setState-in-effect.
- SoundLeaderboard ahora mapea LeaderCard en vez de motion.div inline.

Verificación con Agent Browser:
- Admin: banco de sonidos muestra 5 botones por card: "Mostrar", "Reproducir", "Respuesta", "Resuelta", "Eliminar". ✅
- Clic "Mostrar" → visor muestra "¿DE QUÉ VIDEOJUEGO ES ESTE SONIDO?" (pregunta visible sin reproducir). ✅
- Clic "Resuelta" → card se atenúa (opacity-55) + badge "RESUELTA" junto a PREGUNTA. ✅
- Clic "Sumar punto" → visor: PLAYER1 subió de 1 a 2 (animación de flash dorado de 1.2s). ✅
- Sin errores de runtime/consola. Lint limpio. Dev server 200.

Stage Summary:
- Banco de sonidos con 5 botones: Mostrar (pregunta en visor), Reproducir (una vez, replayable), Respuesta (revelar en visor), Resuelta (card sombreada), Eliminar.
- Animación de score-up en el visor: flash dorado + badge "+1" + obs-score-pop en el marcador cuando un jugador recibe puntos.
- Archivos modificados: contests.ts, SoundAdmin.tsx, ContestViewer.tsx.

---
Task ID: 21
Agent: Z.ai Code (main)
Task: Botones mismo tamaño, Eliminar arriba derecha, Resuelta no reproduce, botón Resetear concurso.

Work Log:

FIX 1 — Botones mismo tamaño + Eliminar arriba derecha:
- SoundAdmin.tsx: la fila de controles ahora es `grid grid-cols-4 gap-2` (4 columnas iguales). Los 4 botones (Mostrar, Reproducir/De nuevo, Respuesta, Resuelta) ocupan 1 columna cada uno → mismo ancho exacto (181×32px verificado).
- Botón "Eliminar" movido a la esquina superior derecha de la card (`absolute top-2 right-2`), fuera del grid. La fila de info tiene `pr-8` para que el contenido no se solape con el botón.

FIX 2 — Resuelta no reproduce sonido:
- toggleSolved() ya solo llamaba setSolved() (no tocaba soundPlaying). Confirmado: el botón "Resuelta" solo marca/desmarca el estado `solved` en Firestore, no reproduce ni detiene el sonido.

FIX 3 — Botón Resetear concurso:
- contests.ts: nueva función `resetContest(cid)`:
  1. Batch: pone score=0 y eliminated=false a TODOS los participantes.
  2. Batch: marca solved=false a TODOS los sonidos.
  3. Limpia el ContestState (spotlightPid=null, currentSoundId=null, soundPlaying=false, revealAnswer=false, revealQuestion=false).
  4. Deshace el ganador (winnerPid=null) y vuelve a status="live".
  No borra participantes ni sonidos — solo resetea el progreso.
- SoundAdmin.tsx: botón "Resetear" (RotateCcw icon) en el header, junto a Iniciar/Abrir/Cerrar. Confirm con mensaje explicativo. Al confirmar: resetContest() + toast "Concurso reseteado — scores a 0, preguntas no resueltas".

Verificación con Agent Browser:
- 4 botones mismo tamaño: 181×32px c/u (Mostrar, De nuevo, Respuesta, Resuelta). ✅
- Eliminar en esquina superior derecha (absolute top-2 right-2). ✅
- Resuelta: clic → card se atenúa, NO reproduce sonido. ✅
- Resetear: clic → confirm → scores a 0 (PLAYER1: 0, ASD: 0), pregunta ya no marcada como resuelta (badge "RESUELTA" desaparece), sonido detenido (botón vuelve a "REPRODUCIR"). ✅
- Sin errores. Lint limpio. Dev server 200.

Stage Summary:
- Los 4 botones de control (Mostrar, Reproducir, Respuesta, Resuelta) tienen exactamente el mismo tamaño en un grid de 4 columnas.
- El botón Eliminar está en la esquina superior derecha de cada card, separado de los controles para evitar clicks erróneos.
- El botón Resuelta solo marca/desmarca el estado, no reproduce el sonido.
- Nuevo botón "Resetear" en el header del admin: resetea todos los scores a 0, marca todas las preguntas como no resueltas, limpia el estado y deshace el ganador. No borra participantes ni sonidos.
- Archivos modificados: contests.ts, SoundAdmin.tsx.

---
Task ID: 22
Agent: Z.ai Code (main)
Task: Fix bug — al marcar "Resuelta" se reproducía el sonido de nuevo en el visor.

Work Log:
- DIAGNÓSTICO: el effect del visor que reproduce el audio tenía `[currentSound, soundPlaying]` como dependencias. `currentSound` es un objeto que se recrea cada vez que `sounds` se actualiza (onSnapshot de Firestore). Al marcar "Resuelta", el documento del sonido cambia (solved: true) → `sounds` se actualiza → `currentSound` es un objeto nuevo (referencia distinta) → el effect se reejecuta → el audio se recrea y reproduce de nuevo. Esto solo pasaba si el sonido se había reproducido antes (porque soundPlaying seguía en true).

- FIX: ContestViewer.tsx — extraída `currentSoundData = currentSound?.data ?? null` (string, no objeto). El effect ahora usa `[currentSoundData, soundPlaying]` como dependencias. `currentSoundData` es un string que solo cambia cuando cambia el audio REAL del sonido (el data URL), no cuando se actualizan otros campos como `solved`, `question`, `answer`, etc. Al marcar "Resuelta", `solved` cambia pero `data` (el audio) sigue siendo el mismo string → el effect NO se reejecuta → el sonido NO se reproduce de nuevo.

Verificación con Agent Browser:
- Reproducir sonido → esperar a que termine → clic "Resuelta" → visor: "NO AUDIO — correct, no replay". ✅
- El bug ya no ocurre. Lint limpio. Dev server 200.

Stage Summary:
- Fix de 1 línea conceptual: cambiar la dependencia del effect de `currentSound` (objeto que cambia cuando cualquier campo se actualiza) a `currentSoundData` (string del audio que solo cambia cuando cambia el archivo de audio real).
- Archivo modificado: ContestViewer.tsx.

---
Task ID: 23
Agent: Z.ai Code (main)
Task: Fix comportamientos extraños en concurso de sonidos: ondas reales, Sonando se quita al terminar, Mostrar/Ocultar funciona, Resuelta oculta pregunta, idle con branding HyperX.

Work Log:

FIX 1 — Ondas que vibran con el sonido real:
- ContestViewer.tsx: nuevo componente LiveWaveform — usa Web Audio API (AnalyserNode + createMediaElementSource) para analizar el audio en vivo y dibujar barras que reaccionan a la amplitud real del sonido en un canvas. Cada barra mide una banda de frecuencia. Gradiente rojo→dorado. Reemplaza la animación CSS fija que no reaccionaba al audio.

FIX 2 — "Sonando" se quita cuando el audio termina:
- ContestViewer.tsx: el visor ahora maneja `soundActive` localmente (no depende de Firestore). Cuando el audio termina naturalmente (onended), soundActive pasa a false → el tag "Sonando" y las ondas desaparecen. Antes, soundPlaying venía de Firestore y se quedaba en true aunque el audio ya hubiera terminado.

FIX 3 — Mostrar/Ocultar funciona después de Reproducir:
- SoundAdmin.tsx playSound(): ya NO resetea revealQuestion ni revealAnswer al reproducir. Esos los controla el admin manualmente con los botones dedicados. Antes, playSound hacia setRevealQuestion(false) lo que impedía que el toggle funcionara después de reproducir.

FIX 4 — Resuelta oculta la pregunta:
- SoundAdmin.tsx toggleSolved(): al marcar como resuelta, ahora también oculta la pregunta (setRevealQuestion(false)) y la respuesta (setRevealAnswer(false)) en el visor. No reproduce el sonido (confirmado).

FIX 5 — Idle con branding HyperX:
- ContestViewer.tsx: nuevo componente SoundIdle — muestra el logo de HyperX (/hyperlogo.png) con pulso de opacidad, el texto "¿QUÉ TAN GAMER ERES?" (font-display italic, silver-grad, animación de opacidad) y "DEMUÉSTRALO CON HYPERX" (rojo grad, animación), más 5 puntos rojos pulsantes. Reemplaza el aburrido "Esperando sonido…" con Volume2 icon.
- El idle se muestra cuando NO hay sonido activo, NO se pidió mostrar pregunta, y NO se reveló respuesta.

Verificación con Agent Browser:
- Idle: visor muestra logo HyperX + "¿QUÉ TAN GAMER ERES?" + "DEMUÉSTRALO CON HYPERX" + puntos pulsantes. ✅
- Reproducir → "DE NUEVO" visible en admin. ✅
- Mostrar → visor muestra "¿DE QUÉ VIDEOJUEMO ES ESTE SONIDO?" ✅
- Ocultar → visor vuelve al idle HyperX ✅
- Mostrar → Resuelta → visor vuelve al idle (pregunta oculta) ✅
- Sin errores. Lint limpio. Dev server 200.

Stage Summary:
- Las ondas ahora vibran con el sonido real (Web Audio API AnalyserNode + canvas).
- "Sonando" desaparece cuando el audio termina (soundActive local, no Firestore).
- Mostrar/Ocultar funciona después de Reproducir (playSound ya no resetea revealQuestion).
- Resuelta oculta la pregunta y la respuesta del visor al marcar.
- Idle state con branding HyperX: logo + "¿Qué tan gamer eres? Demuéstralo con HyperX" + animación.
- Archivos modificados: ContestViewer.tsx, SoundAdmin.tsx.

---
Task ID: 24
Agent: Z.ai Code (main)
Task: Si una pregunta está resuelta, bloquear Reproducir, Mostrar y Respuesta.

Work Log:
- SoundAdmin.tsx:
  · playSound(sid, solved): ahora recibe `solved`. Si es true → toast.error "Esta pregunta ya está resuelta — no se puede reproducir" + return. No reproduce.
  · toggleQuestion(sid, solved): si es true → toast.error "Esta pregunta ya está resuelta — no se puede mostrar" + return. No muestra la pregunta.
  · Nueva función toggleAnswer(sid, solved): si es true → toast.error "Esta pregunta ya está resuelta — no se puede mostrar la respuesta" + return. Reemplaza el setRevealAnswer directo en el botón.
  · toggleSolved: al marcar como resuelta, ahora también detiene el sonido (setSoundPlaying false) además de ocultar pregunta y respuesta.
  · Los 3 botones (Mostrar, Reproducir, Respuesta) ahora tienen `disabled={isSolved}` → se atenúan visualmente (opacity-30, cursor-not-allowed) y no responden al click. Solo el botón "Resuelta" queda habilitado para poder desmarcar.
  · Los tooltips cambian a "Pregunta resuelta — bloqueada" cuando está deshabilitado.

Verificación con Agent Browser:
- Pregunta resuelta: Mostrar [disabled], De nuevo [disabled], Respuesta [disabled], Resuelta [habilitado]. ✅
- Desmarcar Resuelta: Mostrar [habilitado], De nuevo [habilitado], Respuesta [habilitado]. Badge "RESUELTA" desaparece. ✅
- Sin errores. Lint limpio. Dev server 200.

Stage Summary:
- Cuando una pregunta está marcada como resuelta, los botones Reproducir, Mostrar y Respuesta se deshabilitan (atenúan visualmente + no responden al click). Solo el botón Resuelta queda activo para poder desmarcarla.
- Al marcar como resuelta: se detiene el sonido, se ocultan pregunta y respuesta del visor.
- Archivo modificado: SoundAdmin.tsx.

---
Task ID: 25
Agent: Z.ai Code (main)
Task: Estandarizar botones a "En vivo" + modal de Forzar transmisión (saltar entre torneo/concurso).

Work Log:

RENOMBRADO DE BOTONES:
- LiveAdminView: "Abrir torneo" → "En vivo". "Cerrar torneo" se mantiene.
- CosplayAdmin: "Abrir en visor" → "En vivo". "Cerrar visor" → "Cerrar".
- SoundAdmin: "Abrir en visor" → "En vivo". "Cerrar visor" → "Cerrar".

MODAL DE FORZAR TRANSMISIÓN:
- activeTournament.ts: openTournament(tid, name, force=false) y openContest(contestId, force=false) ahora aceptan un parámetro `force`. Si force=true, sobreescriben la transmisión activa sin validar. Nueva función getActiveInfo() devuelve { tid, contestId, openedAt } en una sola consulta.
- LiveAdminView: al hacer clic en "En vivo", consulta getActiveInfo(). Si hay otra transmisión activa (otro torneo o un concurso), abre un modal "Ya hay una transmisión activa" que muestra el nombre del bloqueante y dos botones: "Cancelar" y "Forzar transmisión". Al forzar → openTournament(tid, name, true) + toast "Transmisión forzada".
- CosplayAdmin + SoundAdmin: mismo patrón. Al hacer clic en "En vivo", si hay otra transmisión, abre el modal con el nombre del bloqueante. Al forzar → openContest(contestId, true).
- Los nombres del bloqueante se resuelven buscando en allTournaments (useTournaments) y allContests (useContests).

Verificación con Agent Browser:
- Torneo admin: botón "EN VIVO" (antes "Abrir torneo"). ✅
- Cosplay admin: botones "EN VIVO" + "CERRAR" (antes "Abrir en visor" + "Cerrar visor"). ✅
- Sound admin: botones "EN VIVO" + "CERRAR" (antes "Abrir en visor" + "Cerrar visor"). ✅
- Concurso en vivo → ir a torneo → clic "EN VIVO" → modal "YA HAY UNA TRANSMISIÓN ACTIVA" con "Actualmente se está transmitiendo: CONCURSO SONIDOS TEST" + botones "CANCELAR" / "FORZAR TRANSMISIÓN". ✅
- Clic "FORZAR TRANSMISIÓN" → toast "Transmisión forzada — el visor ahora muestra este torneo". ✅
- Sin errores. Lint limpio. Dev server 200.

Stage Summary:
- Botones estandarizados: "En vivo" para abrir transmisión, "Cerrar" para cerrarla.
- Al intentar abrir una transmisión cuando ya hay otra activa, aparece un modal con el nombre de la transmisión bloqueante y opción de Cancelar o Forzar. Forzar cambia el visor inmediatamente al nuevo torneo/concurso.
- Permite saltar de torneo a torneo, de torneo a concurso, o de concurso a torneo sin tener que cerrar primero.
- Archivos modificados: activeTournament.ts, LiveAdminView.tsx, CosplayAdmin.tsx, SoundAdmin.tsx.
