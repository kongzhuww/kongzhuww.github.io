"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

// A piece of user preference that lives in localStorage AND (when the user is
// signed in with GitHub) syncs to Supabase's `user_prefs` table — so it survives
// cache-clears and follows the user across devices.
export function useCloudPref<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lsKey = `lw-pref-${key}`;

  // load local copy immediately + wire auth
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) setValue(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    const supabase = getSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [lsKey]);

  // once signed in: pull the cloud copy (cloud wins); if none yet, push local up
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (!session) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("user_prefs").select("value").eq("key", key).maybeSingle();
      if (cancelled) return;
      if (data && data.value != null) {
        setValue(data.value as T);
        try {
          localStorage.setItem(lsKey, JSON.stringify(data.value));
        } catch {
          /* ignore */
        }
      } else {
        let cur: T = initial;
        try {
          const raw = localStorage.getItem(lsKey);
          if (raw) cur = JSON.parse(raw);
        } catch {
          /* ignore */
        }
        await supabase
          .from("user_prefs")
          .upsert({ user_id: session.user.id, key, value: cur, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, key, lsKey]);

  const update = useCallback(
    (next: T | ((p: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(lsKey, JSON.stringify(v));
        } catch {
          /* ignore */
        }
        const supabase = getSupabase();
        if (supabase && session) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            supabase
              .from("user_prefs")
              .upsert({ user_id: session.user.id, key, value: v, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
          }, 600);
        }
        return v;
      });
    },
    [lsKey, key, session],
  );

  const signIn = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
  }, []);

  return { value, setValue: update, signedIn: Boolean(session), ready, signIn };
}
