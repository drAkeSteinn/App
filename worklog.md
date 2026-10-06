
---
Task ID: 1
Agent: Z.ai Code (main)
Task: Clonar el repositorio https://github.com/drAkeSteinn/App e integrarlo en el directorio principal del proyecto para continuar editándolo.

Work Log:
- Clonado el repo drAkeSteinn/App en /tmp/app-clone (rama main, 3 commits). La app es "ARENA · Gestor de Torneos": gestor de torneos gaming y concursos express con brackets en vivo, visor para espectadores/OBS, registro de jugadores, banco de reservas y overlay para OBS.
- Analizada la estructura: app client-side con Firebase Firestore (proyecto torneos-6cd4b, config incluida en src/lib/firebase.ts). Prisma permanece con el schema por defecto (no lo usa la app).
- Copiado src/ del repo al proyecto: src/app (page.tsx, layout.tsx, globals.css ~1172 líneas), src/lib (firebase, bracket, actions, hooks, contests, sounds, arenaState, activeTournament, contestHooks, bank, obsLayout, pcs, types), src/components/arena (22 componentes: MainApp, LiveAdminView, SpectatorView, ObsOverlay, MixOverlay, Podium, RegistrationView, ContestsView, TournamentsView, BankView, etc.) y src/components/bracket (BracketTree, MatchCard).
- Copiado assets públicos: fuentes personalizadas (RBNo3.1-ExtraboldItalic.otf, Montserrat 500-800 woff2), hyperlogo.png, Background.jpg, vs.png.
- Instaladas dependencias nuevas con bun: firebase@12.19.0, @fontsource/montserrat@5.3.0, canvas-confetti@1.9.4 (+ @types/canvas-confetti en dev).
- Reiniciado dev server en puerto 3000. Lint sin errores.
- Verificación end-to-end con Agent Browser: GET / 200, título "ARENA · Gestor de Torneos". Las 4 secciones navegables funcionan (CONFIGURACIÓN, REGISTRO, TORNEO EN VIVO, CONCURSOS) y cargan datos reales de Firebase (3 torneos: COPA HYPERX MARVEL TOKON 32/32 oficiales, COPA FFA HYPERX, TEST 64 BRACKET; 2 concursos: COSPLAY TEST, SONIDOS TEST).
- Verificado visor de espectadores /?v=show (modo registro con countdown y cuadro de lugares), vista móvil iPhone 14 (responsive, cards apiladas), footer sticky, consola sin errores y dev.log limpio.

Stage Summary:
- App ARENA Torneos completamente integrada y corriendo en el puerto 3000, conectada a Firebase Firestore (torneos-6cd4b) con datos existentes accesibles.
- Arquitectura: todo client-side con Firebase; Next.js 16 + Turbopack; rutas de vista: / (admin), /?v=show (espectador), /?obs=1 (overlay OBS), /?t={tid} para seleccionar torneo.
- Artifacts: src/ actualizado, public/fonts + imágenes, package.json con firebase/@fontsource/montserrat/canvas-confetti añadidos.

---
Task ID: 2
Agent: Z.ai Code (main)
Task: Ajustes de brackets/flujo solicitados por el usuario: jerarquía visual Gran Final vs 3er lugar, lugares en brackets al terminar la final, seguridades del flujo de torneo (5 fases), orden de columnas en Rondas, horarios de 3er lugar/final en el rail y cartelera, título de Gran Final más protagónico.

Work Log:
- Analizados bracket.ts, types.ts, MatchCard, BracketTree, SpectatorView, MatchRail, RoundColumns, LiveAdminView, ScheduleOverlay, Podium, actions.ts y ui.tsx.
- NUEVO ESTADO "stopped" en TournamentStatus (types.ts) + STATUS_LABEL "DETENIDO" + StatusChip gris (ui.tsx). Diferencia detener (pausa) de finalizar (con campeón).
- actions.ts: closeRegistration() valida lugares oficiales llenos (banco opcional) antes de cerrar registro; stopTournament() → status stopped; finishTournament() valida que la Gran Final tenga ganador antes de marcar finished.
- LiveAdminView/PhaseBar: F2 "Cerrar registros" deshabilitado con hint "Faltan N jugadores · no puedes cerrar aún" si faltan cupos; F4 muestra "🔒 Mix bloqueado · torneo en vivo" cuando status=live (remix bloqueado en vivo, también quitado de Gestión); F5 rediseñada: live → Transmitiendo + Detener torneo (+ Finalizar torneo solo si hay campeón), stopped → Detenido + Reabrir torneo (movido desde Gestión a la fase 5), finished → Finalizado · Podio; Gestión: re-mix solo en stopped/finished.
- Confirm dialogs: nuevo kind "stop" (Detener = pausa, NO finaliza), "finish" reescrito (Finalizar con validación de campeón), "reopen" mensaje actualizado.
- SpectatorView: banner "Torneo detenido" solo con status stopped; status finished sin podio muestra "Torneo finalizado" con trofeos; stopped incluido en forceBank y en el fallback del Ticker.
- MatchCard: nuevo prop big (card 320px con fuentes/marcador/chips más grandes) para la Gran Final; chips de LUGARES en la final: ganador → "🏆 CAMPEÓN" (dorado), perdedor → "2°" (plateado); resto de rondas mantiene "PASA".
- BracketTree: nuevo componente FinalTitle (GRAN FINAL 20px display + trofeos + líneas rojas) usado en las 3 variantes de layout; ChampionPlate más grande (320px, 19px); ThirdPlaceSection reducido y discreto (card 196px, slots 24px, sin líneas conectoras, título "Disputa por el 3er lugar" 8px bronce) + chip "4°" para el perdedor del 3er lugar y "3°" bronce para el ganador.
- RoundColumns: columna "3er Lugar" movida ANTES de la columna "GRAN FINAL" (orden real de juego).
- MatchRail: la Gran Final y el 3er lugar SIEMPRE aparecen en el rail (aunque tengan slots "Por definir") con sus horas correctas; chips "FINAL" dorado y "3ER" bronce; oculto M# en matches estelares; hasRailMatches actualizado.
- ScheduleOverlay (cartelera): grupo "3ER LUGAR" insertado antes de "GRAN FINAL" (orden cronológico); final y 3er lugar siempre visibles con "Por definir"; ★ en vez de M#.
- Verificación con Agent Browser: fase 4 bloqueada en vivo (captura), detener → "Detenido" + Reabrir en fase 5 + Re-mix en Gestión (capturas), reabrir → restaura live; rail: "3ER @ 04:06 | FINAL @ 04:16" (18 programados); cartelera: "3ER LUGAR | GRAN FINAL" ordenado; Rondas: "SEMIFINALES | 3er Lugar | GRAN FINAL"; prueba controlada en TEST 64 BRACKET (backup/restauración exacta del doc) verificó chips 🏆CAMPEÓN/2°, placa de campeón y jerarquía visual; lint limpio; datos restaurados (torneos en live).

Stage Summary:
- Flujo con seguridades: registro solo se cierra con cupos llenos, cuenta regresiva opcional, mix bloqueado en vivo, Detener = pausa (estado stopped, reabrible en fase 5), Finalizar solo con campeón definido.
- Jerarquía visual corregida: Gran Final estelar (título grande con trofeos + card 320px + CAMPEÓN/2° + placa dorada) y 3er lugar discreto (card compacta bronce, chips 3°/4°).
- Rail y cartelera muestran siempre 3er lugar y Gran Final con horarios correctos en orden cronológico.

---
Task ID: 3
Agent: Z.ai Code (main)
Task: Correcciones solicitadas: (1) podio residual del visor al refrescar, (2) Fase 1 "Registro abierto" bloqueada con torneo en vivo + reinicio que limpie TODO, (3) botón "Mostrar podio" no funciona y debe alternar a "Ocultar podio", (4) card de campeón de los brackets debe ir ARRIBA y mucho más grande, parte central normal, cards en ORO/PLATA/BRONCE según lugar sin sombrear al 2°.

Work Log:
- Diagnosticada la raíz del podio residual: el flag showPodium persiste en tournaments/{tid}/arena/state de Firestore y el visor lo mostraba sin validar si el bracket tiene campeón real.
- arenaState.ts: nueva clearArenaForReset(tid) — limpia showPodium, bankPick y schedOpen en una sola llamada.
- actions.ts: clearArenaForReset invocado en TODAS las rutas de reinicio (launchMix, deleteBracket, wipeRegistrations, resetBracketResults); deleteTournament ahora también borra el doc arena/state.
- SpectatorView: podio derivado del estado (podiumFlag && hasChampion con getPodium); sin campeón real JAMÁS se dibuja aunque el flag venga true; sonido tournamentFinish solo en transición oculto→visible; el podio se muestra en cualquier modo del visor (antes solo en brackets — causa del "botón no funciona"); "Ver brackets" del podio ahora escribe showPodium:false en Firestore (sin residual).
- LiveAdminView: podiumOpen derivado de useArenaState + togglePodium; botón "Mostrar podio ↔ Ocultar podio" en Fase 5 (cuando hay campeón) y en MatchPanel (final con ganador), reflejando el estado real del visor; Fase 1 muestra "🔒 Bloqueado · reinicia el torneo" con status live/stopped/finished (el botón Registro abierto solo existe en closed/mixing); mensajes de confirmación de Reiniciar marcadores/torneo actualizados (mencionan limpieza de podio).
- BracketTree: nuevo ChampionBanner — banner dorado gigante (crown + trofeo + nombre clamp(30px,4.8vw,56px) con text-gold-grad y glow) en la PARTE SUPERIOR de los brackets en los 3 layouts (R=1, FFA, clásico); ChampionPlate central eliminado.
- MatchCard: SlotView con prop tone (gold/silver/bronze) — la card completa se pinta del metal (CSS .slot-gold/.slot-silver/.slot-bronze) con chips oscuras metal-chip; en la final ganador=ORO (🏆 CAMPEÓN) y perdedor=PLATA (2°) SIN el sombreado slot-loser; ThirdPlaceSection: ganador del 3er lugar en BRONCE con chip "3°" oscura, 4° normal sin sombrear.
- globals.css: añadidos .slot-gold/.slot-silver/.slot-bronze, .metal-name/.metal-sub, .metal-chip(-gold/silver/bronze) y .text-gold-grad.
- QA E2E con Agent Browser + torneo temporal "QA PODIO" (script scripts/qa-tournament.mjs, borrado al final): flujo completo cerrar registro → mix → en vivo → semis → final → 3er lugar. Verificado: F1 bloqueada en vivo; banner arriba en admin y visor; ORO/PLATA/BRONCE correctos; Mostrar podio (panel y F5) muestra el podio en el visor con confetti y el botón alterna a Ocultar podio; tras Reiniciar torneo el podio desaparece del visor y NO reaparece al refrescar (flag limpiado en DB + guard de campeón); visor con datos reales (COPA HYPERX MARVEL TOKON, campeona KILLERQUEEN) muestra el banner gigante y los metales correctamente. Lint limpio, consola sin errores, torneo QA eliminado.

Stage Summary:
- Podio a prueba de residuos: triple protección (clearArenaForReset en cada reinicio + guard hasChampion en el visor + cierre del podio escribe la señal off).
- Botón de podio bidireccional y confiable en 2 lugares (Fase 5 y panel del match), siempre sincronizado con el visor.
- Fase 1 inaccesible con el torneo en juego; solo el reinicio total la vuelve a habilitar.
- Campeón con protagonismo total: banner dorado gigante arriba de los brackets y cards de lugares en ORO/PLATA/BRONCE sin sombrear al 2°.

---
Task ID: 4
Agent: Z.ai Code (main)
Task: (1) Optimizar las animaciones del broadcast (VS/enfrentamiento, ganador, sustitución, podio, mix, concursos) que se veían cargadas y consumían muchos recursos — partículas y efectos invisibles incluidos; (2) nueva URL hermana de "Cards OBS" llamada "Animaciones OBS" (botón junto al existente) que muestra SOLO las animaciones para OBS, con URL fija para todos los torneos/concursos.

Work Log:
- Auditoría de rendimiento de TODAS las animaciones: glitchIn (clip-path animado = repaint por frame sobre texto gigante), shake de pantalla (1.9s con skewX de página completa vía WAAPI), rollBlur (filter: blur INFINITO en el mix), confetti (Podio 220 partículas + interval cada 2.6s PARA SIEMPRE; SubEnter 110; Cosplay 80 + interval 1.8s infinito; SoundWinner 90 + interval 1.6s infinito), scanline (animaba top = layout+paint infinito), noise (mix-blend-mode overlay full-screen recomponiendo toda la escena), drop-shadows de 26-44px sobre elementos animados, backdrop-blur full-screen en Podio/MixOverlay.
- Investigación en línea (web search): confirmadas las prácticas — clip-path/drop-shadow no se componen por GPU; animar transform/opacity en vez de top/left; will-change con moderación; confetti requiere cleanup. Las optimizaciones aplicadas siguen exactamente esas pautas.
- globals.css: glitchIn reducido a 4 pasos/0.38s (esencia del reveal glitch conservada); scanline ahora usa transform: translateY (GPU) en vez de top; rollBlur→rollJitter (transform+opacity, sin blur); noise sin mix-blend-mode (opacity simple); seatAvailable ralentizado a 4.2s; añadida clase .obs-anim-btn (acento dorado).
- lib/spotlight.ts (NUEVO): tipos SpotlightData/SpotlightPlayer/SubEnterData + findSpotlightEvent + hook useDramaCuts — lógica de cortes dramáticos EXTRAÍDA del visor y COMPARTIDA entre /?v=show y /?obs=anims (mismas animaciones garantizadas, sin sonidos en el hook: cada vista decide).
- SpectatorView: refactorizado a useDramaCuts (sin duplicación); sonidos winner/matchLive mantenidos en el visor; shake optimizado (0.85s, solo translate3d, sin skew).
- MatchSpotlight: prop `transparent` (velo suave radial para OBS en vez de fondo casi opaco); drop-shadows reducidos (vs.png 44px→20px, nick 26px→14px).
- SubEnterOverlay: prop `transparent`; confetti 110→60 partículas; drop-shadow 30px→16px.
- Podium: confetti 220→110 + lluvia que SE DETIENE sola a los 12s (antes infinita); sin backdrop-blur; destellos 5→3; props `transparent` (velo suave) y `hideControls` (sin botón "Ver brackets" para OBS).
- MixOverlay: sin backdrop-blur-md en el panel; interval del shuffle 110ms→130ms.
- ContestViewer: CosplaySpotlight 80→45 + interval 1.8s→3.2s con auto-stop 10s; SoundWinner 90→50 + auto-stop 10s; trofeo sin animación de filter (solo scale).
- AnimOverlay.tsx (NUEVO): componente de la URL /?obs=anims — fondo transparente (misma técnica que Cards OBS: obs-mode), resuelve el torneo ACTIVO (o ?t=<id>), reproduce SOLO las animaciones: MatchSpotlight (VS/ganador), SubEnterOverlay (reserva entra) y Podium (misma señal showPodium + guard anti-residual hasChampion), mudo a propósito (el audio lo pone el visor), sin nada dibujado cuando no hay animación.
- page.tsx: ruta `obs=anims` añadida. MainApp: botón "Animaciones OBS" (icono Clapperboard, carcasa oscura + hover dorado) junto a "Cards OBS", abre /?obs=anims en nueva pestaña.
- QA E2E con Agent Browser + torneo temporal "QA ANIMS" (8 jugadores demo, creado y ELIMINADO al final): flujo completo llenar→cerrar registro→mix→en vivo. Verificado: /?obs=anims idle 100% transparente (html/body transparent + obs-mode); botón abre la URL en nueva pestaña; al poner CUARTOS M2 en juego el spotlight VS se monta en el overlay (DOM + opacity=1); al marcar ganador de M1 el corte GANADOR se renderiza en /?obs=anims con velo transparente (captura: tag M1, nicks, PC chips, chip GANADOR dorado, banner "GANADOR · PIXELDRAKE74"); /?v=show refactorizado muestra el mismo corte de ganador (captura BLACKKING73) + brackets/banner campeón intactos con datos reales (COPA HYPERX MARVEL TOKON, FERALFOX73 campeón); /?obs=1 cards funcionan; lint limpio; sin errores de runtime en consola ni dev.log; torneo QA eliminado (datos reales intactos).

Stage Summary:
- Animaciones optimizadas conservando su esencia: los costos invisibles (blur infinito, clip-path largo, blend-mode full-screen, partículas perpetuas, top animado, drop-shadows enormes, backdrop-blur) eliminados o acotados; ahora todo lo posible corre en transform/opacity (compositor GPU) y las partículas tienen auto-stop.
- Nueva URL fija /?obs=anims ("Animaciones OBS") que muestra únicamente las animaciones optimizadas sobre fondo transparente para OBS, sincronizada con el visor vía el hook compartido useDramaCuts (lib/spotlight.ts); botón hermano de "Cards OBS" en el header.
- Sonidos exclusivos del visor para no duplicar audio; el overlay OBS es mudo.

---
Task ID: 5
Agent: Z.ai Code (main)
Task: Unificar el estilo y la distribución de todos los controles del header de administración (tabs "Configuración/Registro/Torneo en vivo/Concursos" hasta el botón "Visor").

Work Log:
- Diagnóstico con Agent Browser a 1500px: la pestaña CONCURSOS quedaba cortada (la nav tenía overflow-x propio y se comprimía), "Animaciones OBS"/"Cards OBS" se envolvían en 2 líneas, 3 alturas distintas (~44/40/32px) y 3 formas de clip distintas (clip-tag / clip-btn / clip-card-sm), botones sueltos sin agrupar.
- globals.css: nuevas clases .hdr-ctl (altura implícita 38px standalone / 30px en dock, 10px extrabold uppercase tracking .14em, nowrap, transiciones) y .hdr-dock (contenedor segmentado p-1 bg-black/40 border-white/10, hijos estirados a igual altura). Misma familia de corte clip-tag para TODOS los controles del header.
- MainApp.tsx: header reestructurado en dos docks segmentados — dock de navegación (4 tabs, activo rojo, inactivos con bg sutil y hover) y dock de salidas (Animaciones OBS con icono dorado, Cards OBS con icono rojo, Visor relleno rojo como CTA primaria), con el selector de torneo justo a la izquierda de las salidas. Todo shrink-0 con overflow-x no-scrollbar solo como fallback.
- Responsive progresivo: labels de OBS solo ≥1500px (icon-only entre 1280-1499), texto de marca oculto <1280px; sin overflow horizontal medido en 1280/1500/1536; <1024 hace scroll horizontal táctil sin cortar controles a la mitad.
- ui.tsx Select rediseñado: trigger con .hdr-ctl h-38 clip-tag (misma altura/tipografía que el resto), dropdown portado a document.body con position:fixed (top/left/width desde getBoundingClientRect) — NECESARIO porque el overflow-x del header recortaba el panel y backdrop-blur creaba containing block; cierre por scroll (capture)/resize/Escape y click-fuera (incluye el panel portado); shape clip-tag también en el panel.
- BUGS encontrados y corregidos durante QA: (1) chunk CSS obsoleto en .next — resuelto limpiando .next y reiniciando dev server; (2) AnimatePresence de framer-motion se come los hijos createPortal (el panel nunca montaba con open=true) — resuelto renderizando el portal directamente (entra con animación, sale instantáneo).
- QA E2E con Agent Browser: dropdown muestra 3 torneos con logo/hint y selección resaltada; cambiar selección funciona (COPA FFA HYPERX ↔ MARVEL TOKON, restaurado); tabs Cambian y cargan datos (Configuración, Registro 32/32, Torneo en vivo con brackets, Concursos); los 3 botones abren sus URLs en nueva pestaña (/?obs=anims, /?obs=1, /?v=show); hover dorado en Animaciones OBS; visor /?v=show intacto; móvil 390 usable con scroll; lint limpio; consola y dev.log sin errores.

Stage Summary:
- Header con lenguaje visual 100% unificado: dos docks segmentados simétricos (navegación | torneo+salidas), todos los controles a 38px con el mismo corte angular y tipografía; acentos por función (rojo=activo/primario, dorado=animaciones, rojo tenue=cards).
- Select de torneo ahora con panel portal fijo (a prueba de contextos de overflow/blur) con cierre por Escape/scroll/click-fuera.
- Sin desbordes medidos en 1280-1536px; degradación elegante hacia tablets/móvil.
