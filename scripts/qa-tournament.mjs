/**
 * Script QA — crea/borra un torneo temporal para probar el flujo del podio.
 *   bun scripts/qa-tournament.mjs create
 *   bun scripts/qa-tournament.mjs delete <tid>
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD1DNQM4WHvhi47CguiIK99Apaq7FYgbrM",
  authDomain: "torneos-6cd4b.firebaseapp.com",
  projectId: "torneos-6cd4b",
  storageBucket: "torneos-6cd4b.firebasestorage.app",
  messagingSenderId: "903696146795",
  appId: "1:903696146795:web:d36e00ef40ea865d4fec2e",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const fdb = getFirestore(app);
const tCol = collection(fdb, "tournaments");

const cmd = process.argv[2];

if (cmd === "create") {
  const ref = await addDoc(tCol, {
    name: "QA PODIO (temporal)",
    logo: null,
    modality: 1,
    seats: 4,
    bankSeats: 0,
    winsNeeded: 1,
    matchMins: 5,
    startAt: null,
    venue: "QA Lab",
    status: "open",
    createdAt: Date.now(),
  });
  const pCol = collection(fdb, "tournaments", ref.id, "players");
  const nicks = ["AlphaQA", "BravoQA", "CharlieQA", "DeltaQA"];
  let i = 0;
  for (const nick of nicks) {
    await addDoc(pCol, {
      name: `Jugador ${nick}`,
      nick,
      phone: "55 0000 0000",
      team: "",
      seat: "off",
      createdAt: Date.now() + i++,
    });
  }
  console.log("CREATED", ref.id);
} else if (cmd === "delete") {
  const tid = process.argv[3];
  if (!tid) throw new Error("faltan tid");
  const batch = writeBatch(fdb);
  const players = await getDocs(collection(fdb, "tournaments", tid, "players"));
  players.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(fdb, "tournaments", tid, "bracket", "main"));
  batch.delete(doc(fdb, "tournaments", tid, "arena", "state"));
  batch.delete(doc(fdb, "tournaments", tid));
  await batch.commit();
  console.log("DELETED", tid);
} else {
  throw new Error("uso: create | delete <tid>");
}
process.exit(0);
