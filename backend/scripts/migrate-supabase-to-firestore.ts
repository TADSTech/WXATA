/**
 * One-time migration: export all Supabase data and import it into Firestore.
 *
 * Reads every row from the old Supabase tables via the REST API (service role
 * key) and writes them to Firestore using firebase-admin. Uses `fetch` against
 * the Supabase PostgREST API so no supabase SDK dependency is required.
 *
 * Required env vars (see .env.example):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY        — source
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *   FIREBASE_PRIVATE_KEY                            — destination
 *
 * Usage (from the backend folder):
 *   bun run scripts/migrate-supabase-to-firestore.ts
 *
 * Run it BEFORE pointing the app at Firebase. It is idempotent-ish: docs are
 * written with `set(merge:true)` so re-runs update existing docs instead of
 * duplicating them.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "";
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL ?? "";
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(
  /\\n/g,
  "\n",
);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars. See backend/.env.example",
  );
  process.exit(1);
}

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error(
    "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars.",
  );
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
  });
}

const firestore = getFirestore();

// ---------------------------------------------------------------------------
// Supabase REST reader (PostgREST): paginate every row out of a table
// ---------------------------------------------------------------------------
async function fetchAllFromSupabase(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let start = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&offset=${start}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${start}-${start + pageSize - 1}`,
      },
    });

    if (res.status === 204) break; // empty result set
    if (!res.ok) {
      throw new Error(
        `Supabase read failed for "${table}" (HTTP ${res.status}): ${await res.text()}`,
      );
    }

    const batch = (await res.json()) as Record<string, unknown>[];
    if (batch.length === 0) break;
    rows.push(...batch);

    if (batch.length < pageSize) break;
    start += pageSize;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Firestore writer (batched, max 400 writes per commit to stay under the
// 500-write Firestore batch limit)
// ---------------------------------------------------------------------------
async function writeToFirestore(
  collection: string,
  rows: Record<string, unknown>[],
  docIdOf: (row: Record<string, unknown>) => string | null,
): Promise<number> {
  let written = 0;

  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const batch = firestore.batch();

    for (const row of chunk) {
      const docId = docIdOf(row);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = { ...row };

      // Firestore cannot store undefined values
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined) delete data[k];
      }

      const ref = docId
        ? firestore.collection(collection).doc(docId)
        : firestore.collection(collection).doc();
      batch.set(ref, data, { merge: true });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  → ${collection}: wrote ${written}/${rows.length}`);
  }

  return written;
}

// ---------------------------------------------------------------------------
// Collection mapping:
//   api_keys            → doc id = `key`  (the API key value, as the app expects)
//   users               → doc id = `id`   (the Supabase auth user id)
//   user_codes          → auto-id
//   marketplace_extensions → auto-id
//   service_config      → doc id = `key`
//   api_usage_log       → auto-id
// ---------------------------------------------------------------------------
const TABLES: {
  supabase: string;
  firestore: string;
  docIdOf: (row: Record<string, unknown>) => string | null;
}[] = [
  { supabase: "api_keys", firestore: "api_keys", docIdOf: (r) => (r.key as string) ?? null },
  { supabase: "users", firestore: "users", docIdOf: (r) => (r.id as string) ?? null },
  { supabase: "user_codes", firestore: "user_codes", docIdOf: () => null },
  {
    supabase: "marketplace_extensions",
    firestore: "marketplace_extensions",
    docIdOf: () => null,
  },
  { supabase: "service_config", firestore: "service_config", docIdOf: (r) => (r.key as string) ?? null },
  { supabase: "api_usage_log", firestore: "api_usage_log", docIdOf: () => null },
];

async function main() {
  console.log("Starting Supabase → Firestore migration…\n");

  for (const table of TABLES) {
    console.log(`Reading ${table.supabase}…`);
    const rows = await fetchAllFromSupabase(table.supabase);
    console.log(`  → ${rows.length} rows`);

    if (rows.length === 0) continue;

    await writeToFirestore(table.firestore, rows, table.docIdOf);
  }

  console.log("\nMigration complete. Verify with the Firebase Console → Firestore.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
