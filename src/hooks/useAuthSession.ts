import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import type { RaffilaUser, Session } from "@/lib/auth-store";
import {
  canAccessRoute,
  getSession,
  signOut,
  subscribe,
  initFirebaseAuthListener,
  setFirebaseSession,
  type SignInResult,
} from "@/lib/auth-store";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  logoutFirebase,
  getUserProfile,
  createUserProfile,
  firebaseUserToRaffilaUser,
  updateProfile,
  checkIsAdmin,
} from "@/lib/firebase-auth";
import { logActivity } from "@/lib/activity-log";
import { queueWelcomeEmail } from "@/lib/notify-server";
import { attributeStoredReferral } from "@/lib/referral-capture";
import {
  checkUsernameAvailability,
  checkEmailAvailability,
  claimUsernameAndEmail,
  normalizeUsername,
  normalizeEmail,
} from "@/lib/user-validation";

export function useAuthSession() {
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
    setSession(getSession());
    const unsub = subscribe(setSession);
    const unsubFirebase = initFirebaseAuthListener();
    return () => {
      unsub();
      unsubFirebase();
    };
  }, []);

  return {
    user: session?.user ?? null,
    role: session?.user.role ?? null,
    isAuthenticated: !!session,
    session,
    isMounted: mounted,
  };
}

export function useAuthGate() {
  const { user, isAuthenticated } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const gate = canAccessRoute({ pathname: location.pathname });
    if (gate.allowed) return;
    void navigate({ to: gate.redirect as any });
  }, [user?.id, user?.role, isAuthenticated, location.pathname, navigate]);
}

export function useAuthActions() {
  const navigate = useNavigate();

  return {
    async signIn(input: {
      email: string;
      password: string;
      remember?: boolean;
      /**
       * Post sign-in destination. `false` stays on the current page — used by
       * the guest-checkout dialog, which resumes the pending payment in place
       * instead of sending the fresh session to the dashboard.
       */
      redirectTo?: string | false | undefined;
    }): Promise<SignInResult> {
      const remember = input.remember ?? true;

      // Firebase Auth only — every account lives in Firebase, roles come
      // from the Firestore user document. No local credentials exist.
      try {
        const cred = await loginWithEmail(input.email, input.password, remember);
        let profile = await getUserProfile(cred.user.uid);

        // Pending admin invite for this email? Apply it now.
        if (profile?.["role"] !== "admin") {
          const { consumeAdminInvite } = await import("@/lib/activity-log");
          if (await consumeAdminInvite(cred.user.email || input.email, cred.user.uid)) {
            profile = await getUserProfile(cred.user.uid);
          }
        }

        if (String(profile?.["status"] ?? "").toLowerCase() === "suspended") {
          return {
            ok: false,
            code: "invalid_credentials",
            message: "This account has been suspended. Contact Raffila support.",
          };
        }

        const isUserAdmin = checkIsAdmin(profile) || checkIsAdmin(cred.user.email);
        const raffilaUser = firebaseUserToRaffilaUser(cred.user, profile ?? {});
        const user: RaffilaUser = {
          ...raffilaUser,
          role: isUserAdmin ? "admin" : (profile?.["role"] as any) || raffilaUser.role,
          id: `firebase_${cred.user.uid}`,
        };
        setFirebaseSession(user, remember);
        // Apply a captured referral link (?ref= / invite page) to this
        // account. Fire-and-forget — never blocks sign-in.
        attributeStoredReferral(cred.user.uid);

        if (typeof window !== "undefined") {
          if (remember) {
            window.localStorage.setItem("raffila:saved_email", input.email.trim());
            window.localStorage.setItem("raffila:remember_me", "true");
          } else {
            window.localStorage.removeItem("raffila:saved_email");
            window.localStorage.setItem("raffila:remember_me", "false");
          }
        }

        const roleRedirect =
          user.role === "admin"
            ? "/admin"
            : user.role === "staff"
              ? "/crm"
              : user.role === "partner"
                ? "/partner"
                : "/dashboard";
        let redirect: string;
        if (input.redirectTo === false) redirect = "";
        else redirect = input.redirectTo ?? roleRedirect;
        void logActivity({
          eventType: "AUTH_LOGIN",
          targetType: "session",
          summary: `Signed in with email`,
        });
        if (redirect) {
          setTimeout(() => void navigate({ to: redirect as any }), 0);
        }
        return { ok: true, user, redirect };
      } catch (err: any) {
        const message =
          err?.code === "auth/user-not-found"
            ? "No account found with this email"
            : err?.code === "auth/wrong-password"
              ? "Incorrect password"
              : err?.code === "auth/invalid-credential"
                ? "Invalid email or password"
                : err?.message || "Login failed";
        return { ok: false, code: "invalid_credentials", message };
      }
    },

    async signInWithGoogle(options?: {
      redirectTo?: string | false | undefined;
    }): Promise<
      | { ok: true; user: RaffilaUser; redirect: string; needsProfile: boolean }
      | { ok: false; message: string }
    > {
      try {
        const result = await loginWithGoogle();
        const fbUser = result.user;
        let profile = await getUserProfile(fbUser.uid);

        if (!profile) {
          // First Google login — preserve the Google identity and photo in
          // Firestore right away. The doc stays "incomplete" (no
          // phone/address/dob) so the user is still routed through profile
          // completion below.
          const stub = firebaseUserToRaffilaUser(fbUser);
          try {
            await createUserProfile(fbUser.uid, {
              email: fbUser.email || "",
              firstName: stub.firstName,
              lastName: stub.lastName,
              handle: stub.handle,
              avatarUrl: fbUser.photoURL || "",
              avatarMonogram: stub.avatarMonogram,
              role: "user",
              isAdmin: false,
              verified: true,
            });
            profile = await getUserProfile(fbUser.uid);
          } catch (stubErr) {
            console.warn("Could not save Google profile stub:", stubErr);
          }
          if (fbUser.email) {
            void queueWelcomeEmail({
              data: { uid: fbUser.uid, email: fbUser.email, firstName: stub.firstName },
            }).catch(() => {});
          }
        }

        // Backfill: heal docs that are missing the Google photo.
        if (profile && !profile["avatarUrl"] && fbUser.photoURL) {
          try {
            await createUserProfile(fbUser.uid, { avatarUrl: fbUser.photoURL });
            profile = { ...profile, avatarUrl: fbUser.photoURL };
          } catch (healErr) {
            console.warn("Could not backfill avatar:", healErr);
          }
        }

        // Pending admin invite for this email? Apply it now.
        if (profile?.["role"] !== "admin") {
          const { consumeAdminInvite } = await import("@/lib/activity-log");
          if (await consumeAdminInvite(fbUser.email || "", fbUser.uid)) {
            profile = await getUserProfile(fbUser.uid);
          }
        }

        // The Firestore user doc exists now — apply any captured referral.
        if (profile) attributeStoredReferral(fbUser.uid);

        if (String(profile?.["status"] ?? "").toLowerCase() === "suspended") {
          return {
            ok: false,
            message: "This account has been suspended. Contact Raffila support.",
          };
        }

        const raffilaUser = firebaseUserToRaffilaUser(fbUser, profile ?? undefined);

        if (!raffilaUser.profileComplete) {
          // New or unfinished Google user — must complete registration.
          const user: RaffilaUser = {
            ...raffilaUser,
            id: `firebase_${fbUser.uid}`,
            profileComplete: false,
          };
          setFirebaseSession(user, true);
          void logActivity({
            eventType: "AUTH_REGISTER",
            targetType: "session",
            summary: `Started Google registration`,
          });
          return { ok: true, user, redirect: "/auth?mode=complete", needsProfile: true };
        }

        // Existing complete user — role comes from the Firestore user document.
        const isUserAdmin = checkIsAdmin(profile);
        const user: RaffilaUser = {
          ...raffilaUser,
          role: isUserAdmin ? "admin" : (profile?.["role"] as any) || raffilaUser.role,
          id: `firebase_${fbUser.uid}`,
        };
        setFirebaseSession(user, true);

        const roleRedirect =
          user.role === "admin"
            ? "/admin"
            : user.role === "staff"
              ? "/crm"
              : user.role === "partner"
                ? "/partner"
                : "/dashboard";
        let redirect: string;
        if (options?.redirectTo === false) redirect = "";
        else redirect = options?.redirectTo ?? roleRedirect;
        void logActivity({
          eventType: "AUTH_LOGIN",
          targetType: "session",
          summary: `Signed in with Google (${user.role})`,
        });
        if (redirect) {
          setTimeout(() => void navigate({ to: redirect as any }), 0);
        }
        return { ok: true, user, redirect, needsProfile: false };
      } catch (err: any) {
        if (err?.code === "auth/popup-closed-by-user") {
          return { ok: false, message: "Sign-in cancelled" };
        }
        if (err?.code === "auth/unauthorized-domain") {
          const currentHost =
            typeof window !== "undefined" ? window.location.hostname : "your custom domain";
          return {
            ok: false,
            message: `Google Sign-In is not authorized for "${currentHost}". Add "${currentHost}" in Firebase Console > Authentication > Settings > Authorized domains, or sign in using your Firebase email and password below.`,
          };
        }
        return { ok: false, message: err?.message || "Google sign-in failed" };
      }
    },

    async registerWithFirebase(input: {
      email: string;
      password: string;
      username: string;
      displayName?: string;
      phone?: string;
      address?: string;
      dob?: string;
    }): Promise<{ ok: true; user: RaffilaUser } | { ok: false; message: string }> {
      try {
        const cleanUsername = normalizeUsername(input.username || input.displayName || "");
        const cleanEmail = normalizeEmail(input.email);

        // Pre-validate username uniqueness
        const userCheck = await checkUsernameAvailability(cleanUsername);
        if (!userCheck.available) {
          return { ok: false, message: userCheck.error || "This username is already taken" };
        }

        // Pre-validate email uniqueness
        const emailCheck = await checkEmailAvailability(cleanEmail);
        if (!emailCheck.available) {
          return { ok: false, message: emailCheck.error || "This email is already registered" };
        }

        const cred = await registerWithEmail(cleanEmail, input.password);

        // Update native Firebase Auth profile
        try {
          await updateProfile(cred.user, { displayName: cleanUsername });
        } catch (pErr) {
          console.warn("Could not update auth display name:", pErr);
        }

        // New registrations are always regular users.
        // Admin access is granted manually in the Firebase Console
        // by setting `role: "admin"` on the user's Firestore document.
        await createUserProfile(cred.user.uid, {
          firstName: cleanUsername,
          lastName: "",
          handle: cleanUsername,
          displayName: cleanUsername,
          email: cleanEmail,
          phone: input.phone || "",
          address: input.address || "",
          dob: input.dob || "",
          avatarMonogram: cleanUsername.slice(0, 2).toUpperCase() || "U",
          role: "user",
          isAdmin: false,
          verified: false,
        });

        // Reserve in public uniqueness collections
        await claimUsernameAndEmail({
          username: cleanUsername,
          email: cleanEmail,
          uid: cred.user.uid,
        });

        // Pending admin invite for this email? Apply it now.
        const { consumeAdminInvite } = await import("@/lib/activity-log");
        await consumeAdminInvite(cleanEmail, cred.user.uid);

        // Firestore profile exists — apply any captured referral link.
        attributeStoredReferral(cred.user.uid);

        const profile = await getUserProfile(cred.user.uid);
        const raffilaUser = firebaseUserToRaffilaUser(cred.user, profile ?? {});
        const user: RaffilaUser = { ...raffilaUser, id: `firebase_${cred.user.uid}` };
        setFirebaseSession(user, true);

        if (typeof window !== "undefined") {
          window.localStorage.setItem("raffila:saved_email", cleanEmail);
          window.localStorage.setItem("raffila:remember_me", "true");
        }

        void logActivity({
          eventType: "AUTH_REGISTER",
          targetType: "user",
          targetId: cred.user.uid,
          summary: `Created account (${cleanUsername})`,
        });
        void queueWelcomeEmail({
          data: { uid: cred.user.uid, email: cleanEmail, firstName: cleanUsername },
        }).catch(() => {});
        return { ok: true, user };
      } catch (err: any) {
        const message =
          err?.code === "auth/email-already-in-use"
            ? "An account with this email already exists. Please sign in instead."
            : err?.code === "auth/weak-password"
              ? "Password must be at least 6 characters"
              : err?.message || "Registration failed";
        return { ok: false, message };
      }
    },

    async completeGoogleProfile(data: {
      phone: string;
      address: string;
      dob: string;
      handle?: string;
      avatarUrl?: string;
    }): Promise<{ ok: true } | { ok: false; message: string }> {
      try {
        const session = getSession();
        if (!session?.user?.id?.startsWith("firebase_")) {
          return { ok: false, message: "No active Firebase session" };
        }
        const uid = session.user.id.replace("firebase_", "");

        const chosenHandle = data.handle
          ? normalizeUsername(data.handle)
          : session.user.handle || "";
        if (chosenHandle && chosenHandle !== session.user.handle) {
          const avail = await checkUsernameAvailability(chosenHandle, uid);
          if (!avail.available) {
            return { ok: false, message: avail.error || "This username is already taken" };
          }
        }

        await createUserProfile(uid, {
          phone: data.phone,
          address: data.address,
          dob: data.dob,
          handle: chosenHandle,
          avatarUrl: data.avatarUrl || session.user.avatarUrl || "",
          role: "user",
          isAdmin: false,
        });

        if (chosenHandle) {
          await claimUsernameAndEmail({
            username: chosenHandle,
            email: session.user.email,
            uid,
          });
        }

        // Profile complete — apply any captured referral link.
        attributeStoredReferral(uid);

        const profile = await getUserProfile(uid);
        const fbUser = {
          uid,
          email: session.user.email,
          displayName: `${session.user.firstName || ""} ${session.user.lastName || ""}`,
          photoURL: session.user.avatarUrl || null,
          providerData: [{ providerId: "google.com" }],
        } as any;
        const raffilaUser = firebaseUserToRaffilaUser(fbUser, profile ?? undefined);
        const updatedUser: RaffilaUser = {
          ...raffilaUser,
          id: `firebase_${uid}`,
          profileComplete: true,
        };
        setFirebaseSession(updatedUser, true);
        void logActivity({
          eventType: "USER_UPDATE",
          targetType: "user",
          targetId: uid,
          summary: `Completed registration (${chosenHandle || updatedUser.email})`,
        });
        return { ok: true };
      } catch (err: any) {
        return { ok: false, message: err?.message || "Failed to save profile" };
      }
    },

    signOut(target: { to?: "/" | "/auth" | "/staff" } = { to: "/auth" }) {
      // Log while the session is still available.
      void logActivity({ eventType: "AUTH_LOGOUT", targetType: "session", summary: "Signed out" });
      logoutFirebase().catch(() => {});
      signOut();
      setTimeout(() => void navigate({ to: target.to as any }), 0);
    },
  };
}

export function initialsOf(user: RaffilaUser | { firstName: string; lastName: string }) {
  return (user.firstName.slice(0, 1) + user.lastName.slice(0, 1)).toUpperCase();
}
