// ---------------------------------------------------------------------------
// Firebase client — Auth + Firestore data-access layer for the WXATA frontend.
// Replaces the old Supabase client. Set these env vars (see .env.example):
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
//   VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,
//   VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
// ---------------------------------------------------------------------------
import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  applyActionCode,
  onAuthStateChanged,
  signOut,
  reload,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  type DocumentData,
} from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const githubProvider = new GithubAuthProvider();
export const googleProvider = new GoogleAuthProvider();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
export function signInDeveloperWithGithub(): Promise<void> {
  return signInWithRedirect(auth, githubProvider);
}

export function signInBotWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function getGithubRedirectResult() {
  return getRedirectResult(auth);
}

export function signInBotWithPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function createBotAccount(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function sendBotVerificationEmail(user: User, url: string) {
  return sendEmailVerification(user, {
    url,
    handleCodeInApp: true,
  });
}

export function applyVerificationCode(oobCode: string) {
  return applyActionCode(auth, oobCode);
}

export function refreshCurrentUser() {
  const user = auth.currentUser;
  return user ? reload(user) : Promise.resolve();
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function signOutBot() {
  return signOut(auth);
}

// ---------------------------------------------------------------------------
// Firestore helpers — rows are returned with their doc `id` attached, mirroring
// the shape the pages previously got from Supabase.
// ---------------------------------------------------------------------------
type Row = DocumentData & { id: string };

function toRow(docSnap: DocumentData & { id: string }): Row {
  const data = (docSnap as DocumentData).data?.() ?? docSnap;
  return { id: docSnap.id, ...data } as Row;
}

export async function getDocById(collectionName: string, id: string): Promise<Row | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  return toRow(snap);
}

export async function findFirst(
  collectionName: string,
  field: string,
  value: unknown,
): Promise<Row | null> {
  const q = query(
    collection(db, collectionName),
    where(field, "==", value),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return toRow(snap.docs[0] as unknown as DocumentData & { id: string });
}

export async function listDocs(
  collectionName: string,
  options?: {
    whereField?: string;
    whereValue?: unknown;
    orderByField?: string;
    descending?: boolean;
  },
): Promise<Row[]> {
  const constraints: unknown[] = [];
  if (options?.whereField && options?.whereValue !== undefined) {
    constraints.push(where(options.whereField, "==", options.whereValue));
  }
  if (options?.orderByField) {
    constraints.push(
      orderBy(options.orderByField, options.descending ? "desc" : "asc"),
    );
  }
  const q = query(collection(db, collectionName), ...(constraints as never[]));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toRow(d as unknown as DocumentData & { id: string }));
}

export async function insertDoc(
  collectionName: string,
  data: Record<string, unknown>,
): Promise<string> {
  const ref = await addDoc(collection(db, collectionName), data);
  return ref.id;
}

export async function setDocById(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  merge = true,
): Promise<void> {
  await setDoc(doc(db, collectionName, id), data, { merge });
}

export async function updateDocById(
  collectionName: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), patch);
}

export async function updateDocsWhere(
  collectionName: string,
  field: string,
  value: unknown,
  patch: Record<string, unknown>,
): Promise<void> {
  const q = query(collection(db, collectionName), where(field, "==", value));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, patch)));
}

export async function deleteDocById(
  collectionName: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}

// ---------------------------------------------------------------------------
// Domain helpers — named wrappers so pages stay readable
// ---------------------------------------------------------------------------
// users (doc id = Firebase uid)
export const findUserByUsername = (username: string) =>
  findFirst("users", "username", username);

export const findUserByEmail = (email: string) =>
  findFirst("users", "email", email.toLowerCase());

export const findUserByUid = (uid: string) => getDocById("users", uid);

// Resolve a signed-in user to their profile doc. The doc id is normally the
// Firebase uid, but Google-linked accounts keep their doc under the original
// uid with a `google_uid` field, so check both.
export async function findUserByAuthUid(uid: string): Promise<Row | null> {
  const byDocId = await getDocById("users", uid);
  if (byDocId) return byDocId;
  return findFirst("users", "google_uid", uid);
}

export const insertUser = (uid: string, data: Record<string, unknown>) =>
  setDocById("users", uid, data, false);

export const updateUser = (uid: string, patch: Record<string, unknown>) =>
  updateDocById("users", uid, patch);

// user_codes
export const findCodeByCode = (code: string) =>
  findFirst("user_codes", "code", code);

export const listUserCodes = () =>
  listDocs("user_codes", { orderByField: "created_at", descending: true });

export const updateUserCode = (id: string, patch: Record<string, unknown>) =>
  updateDocById("user_codes", id, patch);

export const deleteUserCode = (id: string) => deleteDocById("user_codes", id);

export const insertUserCode = (data: Record<string, unknown>) =>
  insertDoc("user_codes", data);

// marketplace_extensions
export const listApprovedExtensions = () =>
  listDocs("marketplace_extensions", { whereField: "status", whereValue: "approved" });

export const listAllExtensions = () => listDocs("marketplace_extensions");

export const insertExtension = (data: Record<string, unknown>) =>
  insertDoc("marketplace_extensions", data);

export const updateExtension = (id: string, patch: Record<string, unknown>) =>
  updateDocById("marketplace_extensions", id, patch);

export const deleteExtension = (id: string) =>
  deleteDocById("marketplace_extensions", id);

// service_config (doc id = key)
export const listServiceConfig = () =>
  listDocs("service_config", { orderByField: "key" });

export const getServiceConfigValue = async (
  key: string,
  fallback: string,
): Promise<string> => {
  const row = await getDocById("service_config", key);
  return (row?.value as string | undefined) ?? fallback;
};

export const upsertServiceConfig = (
  key: string,
  value: string,
  description?: string,
) => setDocById("service_config", key, { key, value, description }, true);

// api_keys (admin-only reads from the browser)
export const listApiKeys = () =>
  listDocs("api_keys", { orderByField: "created_at", descending: true });

export { type User, type DocumentData };
