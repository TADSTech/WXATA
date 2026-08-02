// ---------------------------------------------------------------------------
// Firebase Admin — Firestore data layer for the WXATA backend.
// Replaces the old Supabase service-role client. Lazy-initialized so that
// importing this module never requires credentials to exist.
// Set these env vars (see .env.example), taken from a Firebase service-account
// JSON file downloaded in the Firebase console:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// ---------------------------------------------------------------------------
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  type Firestore,
  type DocumentSnapshot,
} from "firebase-admin/firestore";

let _app: App | null = null;
let _db: Firestore | null = null;

function getApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    return _app;
  }
  _app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID ?? "",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  return _app;
}

export function db(): Firestore {
  if (!_db) _db = getFirestore(getApp());
  return _db;
}

export function verifyIdToken(token: string) {
  return getAuth(getApp()).verifyIdToken(token);
}

// ---------------------------------------------------------------------------
// Firestore helpers — rows are returned with their doc `id` attached, matching
// the shape the server previously got from Supabase.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = { id: string } & Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(snap: DocumentSnapshot): Row {
  return { id: snap.id, ...(snap.data() ?? {}) } as Row;
}

export async function findWhere(
  collectionName: string,
  field: string,
  value: unknown,
): Promise<Row | null> {
  const snap = await db()
    .collection(collectionName)
    .where(field, "==", value)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return toRow(snap.docs[0]!);
}

export async function getById(
  collectionName: string,
  id: string,
): Promise<Row | null> {
  const snap = await db().collection(collectionName).doc(id).get();
  return snap.exists ? toRow(snap) : null;
}

export async function insert(
  collectionName: string,
  data: Record<string, unknown>,
): Promise<string> {
  const ref = await db().collection(collectionName).add(data);
  return ref.id;
}

export async function updateById(
  collectionName: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await db().collection(collectionName).doc(id).update(patch);
}

export async function updateWhere(
  collectionName: string,
  field: string,
  value: unknown,
  patch: Record<string, unknown>,
): Promise<void> {
  const snap = await db()
    .collection(collectionName)
    .where(field, "==", value)
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.update(patch)));
}

export async function listAll(
  collectionName: string,
  orderByField?: string,
): Promise<Row[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db().collection(collectionName);
  if (orderByField) query = query.orderBy(orderByField, "desc");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap = await (query as any).get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snap.docs.map((d: any) => toRow(d));
}

// ---------------------------------------------------------------------------
// Domain helpers — named wrappers so DashboardServer stays readable
// ---------------------------------------------------------------------------
// api_keys
export const findApiKeyBy = (field: string, value: unknown) =>
  findWhere("api_keys", field, value);

export const insertApiKey = (data: Record<string, unknown>) =>
  insert("api_keys", data);

export const updateApiKeyById = (id: string, patch: Record<string, unknown>) =>
  updateById("api_keys", id, patch);

export const listApiKeys = () => listAll("api_keys", "created_at");

// user_codes
export const insertUserCode = (data: Record<string, unknown>) =>
  insert("user_codes", data);

export const updateUserCodesWhere = (
  field: string,
  value: unknown,
  patch: Record<string, unknown>,
) => updateWhere("user_codes", field, value, patch);

// api_usage_log
export const insertUsageLog = (data: Record<string, unknown>) =>
  insert("api_usage_log", data);

// service_config (doc id = key)
export const getServiceConfigValue = async (
  key: string,
  fallback: string,
): Promise<string> => {
  const row = await getById("service_config", key);
  return (row?.value as string | undefined) ?? fallback;
};

export const listServiceConfig = () => listAll("service_config");

export const upsertServiceConfig = (key: string, value: string) =>
  db().collection("service_config").doc(key).set({ key, value }, { merge: true });
