// =============================================================
// CRITICAL FILE — DO NOT MODIFY OR OVERWRITE
// This file is the permanent actor initialization wrapper.
// It exists to prevent useActor.ts from breaking backend writes.
//
// RULES (enforced for all future builds):
//   1. NEVER use an early return if !isAuthenticated
//   2. NEVER use getSecretParameter — always use getPersistedUrlParameter
//   3. Only call _initializeAccessControlWithSecret when token is NON-EMPTY.
//      Empty-token calls FAIL silently and leave the principal unregistered,
//      causing all writes to be rejected by the Caffeine platform.
//   4. ALWAYS persist the admin token to localStorage so it survives across
//      tabs, refreshes, and Internet Identity redirects.
//   5. This file must NOT import from useActor.ts
//   6. ALWAYS use placeholderData: (prev) => prev to prevent actor becoming null
//      during Internet Identity transitions
// =============================================================

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getPersistedUrlParameter } from "../utils/urlParams";
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
const TOKEN_STORAGE_KEY = "_sf_caffeine_token";

/** Read admin token from URL → sessionStorage → localStorage, in that order.
 *  Whenever found, persist to localStorage for cross-tab / cross-session survival. */
function getAdminToken(): string {
  // 1. URL / sessionStorage (getPersistedUrlParameter stores in sessionStorage when found in URL)
  let token = getPersistedUrlParameter("caffeineAdminToken") ?? "";

  // 2. localStorage fallback — survives new tabs, hard reloads, II redirects
  if (!token) {
    token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  }

  // 3. Persist to localStorage whenever we have a valid token
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    console.warn(
      "[useCustomActor] No Caffeine admin token found. " +
        "Open the app from the full draft URL (with #/?caffeineAdminToken=...) " +
        "so writes can be authorised.",
    );
  }

  return token;
}

export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const lastActorRef = useRef<backendInterface | null>(null);

  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString() ?? "anon"],
    queryFn: async () => {
      // RULE: Never early-return based on isAuthenticated.
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;

      const actor = await createActorWithConfig(actorOptions);

      const adminToken = getAdminToken();

      if (adminToken) {
        // RULE: Only call _initializeAccessControlWithSecret when token is present.
        // Calling with an empty token throws, principal stays unregistered, writes fail.
        try {
          await actor._initializeAccessControlWithSecret(adminToken);
          console.log(
            "[useCustomActor] _initializeAccessControlWithSecret SUCCESS. principal:",
            identity?.getPrincipal().toString() ?? "anon",
          );
        } catch (e) {
          console.error(
            "[useCustomActor] _initializeAccessControlWithSecret FAILED — " +
              "this will block all writes. Error:",
            e,
          );
        }
      }

      lastActorRef.current = actor;
      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
    // CRITICAL: Keep previous actor alive during II identity transitions.
    // Without this, actor becomes null and in-flight writes are dropped.
    placeholderData: (prev) => prev,
  });

  const resolvedActor = actorQuery.data ?? lastActorRef.current;

  useEffect(() => {
    if (actorQuery.data) {
      lastActorRef.current = actorQuery.data;
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: resolvedActor,
    isFetching: actorQuery.isFetching,
  };
}
