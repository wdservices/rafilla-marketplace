import {
  onAuthChange,
  getUserProfile,
  createUserProfile,
  firebaseUserToRaffilaUser,
  checkIsAdmin,
  type FirebaseUser,
} from "./firebase-auth";

export type UserRole = "user" | "admin" | "partner" | "staff";

export type RaffilaUser = {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  handle?: string | undefined;
  email: string;
  phone: string;
  avatarMonogram: string;
  avatarUrl?: string | undefined;
  verified?: boolean | undefined;
  tagline?: string | undefined;
  isGoogleUser?: boolean | undefined;
  profileComplete?: boolean | undefined;
  partnerId?: string | undefined;
  businessName?: string | undefined;
};

const STORAGE_KEY = "raffila:auth:session:v1";
export const REMEMBER_ME_DAYS = 30;
export const REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000;

export type Session = {
  user: RaffilaUser;
  createdAt: string;
  expiresAt?: number;
  remember?: boolean;
} | null;

function readSession(): Session {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed || !parsed?.user?.id) return null;

    // Check expiration if set
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: Session) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

let inMemorySession: Session = readSession();
type Listener = (s: Session) => void;
const listeners = new Set<Listener>();

function emit(s: Session) {
  inMemorySession = s;
  listeners.forEach((l) => l(s));
}

export type SignInResult =
  | { ok: true; user: RaffilaUser; redirect: string }
  | { ok: false; code: "invalid_credentials" | "invalid_input"; message: string };

export function setFirebaseSession(user: RaffilaUser, remember = true) {
  const expiresAt = Date.now() + (remember ? REMEMBER_ME_MS : 24 * 60 * 60 * 1000);
  const session: Session = {
    user,
    createdAt: new Date().toISOString(),
    expiresAt,
    remember,
  };
  writeSession(session);
  emit(session);
}

export function signOut() {
  writeSession(null);
  emit(null);
}

export function getSession(): Session {
  return inMemorySession;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  listener(inMemorySession);
  return () => listeners.delete(listener);
}

let firebaseUnsubscribe: (() => void) | null = null;

export function initFirebaseAuthListener() {
  if (firebaseUnsubscribe) return firebaseUnsubscribe;

  firebaseUnsubscribe = onAuthChange(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      const current = getSession();
      if (current && current.user.id.startsWith("firebase_")) {
        signOut();
      }
      return;
    }

    // Skip if session was set by demo/partner credentials
    const current = getSession();
    if (
      current &&
      (current.user.id.startsWith("usr_") ||
        current.user.id.startsWith("adm_") ||
        current.user.id.startsWith("ptr_"))
    ) {
      return;
    }

    try {
      let profile = await getUserProfile(fbUser.uid);
      const isUserAdmin = checkIsAdmin(profile) || checkIsAdmin(fbUser.email);

      // If user is admin but doc is missing or missing role: "admin", sync it to Firestore
      if (isUserAdmin && (!profile || profile["role"] !== "admin")) {
        try {
          await createUserProfile(fbUser.uid, {
            email: fbUser.email || "",
            role: "admin",
            isAdmin: true,
            verified: true,
          });
          profile = { ...(profile || {}), role: "admin", isAdmin: true };
        } catch (syncErr) {
          console.warn("Could not sync admin status to Firestore:", syncErr);
        }
      }

      const raffilaUser = firebaseUserToRaffilaUser(fbUser, profile ?? undefined);
      const firebaseUser: RaffilaUser = {
        ...raffilaUser,
        role: isUserAdmin ? "admin" : raffilaUser.role,
        id: `firebase_${fbUser.uid}`,
      };

      const remember =
        current?.remember ??
        (typeof window !== "undefined" &&
          window.localStorage.getItem("raffila:remember_me") === "true");
      const expiresAt = Date.now() + (remember ? REMEMBER_ME_MS : 24 * 60 * 60 * 1000);

      const session: Session = {
        user: firebaseUser,
        createdAt: new Date().toISOString(),
        expiresAt,
        remember,
      };
      writeSession(session);
      emit(session);
    } catch (err) {
      console.error("Failed to load Firebase user profile:", err);
    }
  });

  return firebaseUnsubscribe;
}

type AuthGateResult =
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated" | "unauthorized"; redirect: string };

export function canAccessRoute(input: { pathname: string }): AuthGateResult {
  const session = getSession();
  const isAdminRoute = input.pathname === "/admin" || input.pathname.startsWith("/admin/");
  const isDashboardRoute =
    input.pathname === "/dashboard" || input.pathname.startsWith("/dashboard/");
  const isPartnerRoute = input.pathname === "/partner" || input.pathname.startsWith("/partner/");
  const isCrmRoute = input.pathname === "/crm" || input.pathname.startsWith("/crm/");

  if (!isAdminRoute && !isDashboardRoute && !isPartnerRoute && !isCrmRoute) {
    return { allowed: true };
  }

  if (!session) {
    return { allowed: false, reason: "unauthenticated", redirect: "/auth" };
  }

  const isUserAdmin =
    session.user.role === "admin" ||
    checkIsAdmin(session.user.role) ||
    checkIsAdmin(session.user.email);

  // Self-heal stale session if role was stored as user
  if (isUserAdmin && session.user.role !== "admin") {
    session.user.role = "admin";
    writeSession(session);
    emit(session);
  }

  const isStaff = session.user.role === "staff";

  // Admin routes: only admins
  if (isAdminRoute && !isUserAdmin) {
    return {
      allowed: false,
      reason: "unauthorized",
      redirect: session.user.role === "partner" ? "/partner" : session.user.role === "staff" ? "/crm" : "/dashboard",
    };
  }

  // CRM routes: only staff (admins can also access if they want, but staff cannot access admin)
  if (isCrmRoute && !isStaff && !isUserAdmin) {
    return {
      allowed: false,
      reason: "unauthorized",
      redirect: session.user.role === "partner" ? "/partner" : "/dashboard",
    };
  }

  // Staff must not enter the admin dashboard
  if (isAdminRoute && isStaff) {
    return {
      allowed: false,
      reason: "unauthorized",
      redirect: "/crm",
    };
  }

  if (isDashboardRoute && isUserAdmin) {
    return { allowed: false, reason: "unauthorized", redirect: "/admin" };
  }
  if (isDashboardRoute && session.user.role === "partner") {
    return { allowed: false, reason: "unauthorized", redirect: "/partner" };
  }
  if (isDashboardRoute && isStaff) {
    return { allowed: false, reason: "unauthorized", redirect: "/crm" };
  }
  if (isPartnerRoute && session.user.role !== "partner" && !isUserAdmin) {
    return { allowed: false, reason: "unauthorized", redirect: "/become-a-partner" };
  }
  return { allowed: true };
}
