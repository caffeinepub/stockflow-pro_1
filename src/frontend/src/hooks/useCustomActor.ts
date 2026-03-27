// =============================================================
// CRITICAL FILE — DO NOT MODIFY OR OVERWRITE
// This file is the permanent actor initialization wrapper.
//
// ROOT CAUSE OF ALL WRITE FAILURES (discovered after 50+ deployments):
//   _initializeAccessControlWithSecret only works for ANONYMOUS principals.
//   When the actor is created with an II identity, the II principal is NOT
//   recognized by the Caffeine draft access control — writes are rejected.
//   The actor MUST always be anonymous (no identity). The admin token
//   (not II identity) handles Caffeine platform authorization.
//
// RULES (DO NOT CHANGE):
//   1. NEVER pass identity into createActorWithConfig. Always pass undefined.
//   2. NEVER use getSecretParameter. Use getPersistedUrlParameter + getSecretFromHash.
//   3. ALWAYS call _initializeAccessControlWithSecret unconditionally.
//   4. ALWAYS persist the admin token to localStorage.
//   5. queryKey is STATIC — never add identity to it.
//   6. Do NOT import from useActor.ts.
//
// TOKEN LOOKUP ORDER:
//   1. getPersistedUrlParameter  → handles #/?caffeineAdminToken=xxx
//   2. getSecretFromHash         → handles #caffeineAdminToken=xxx (NO /? prefix)
//   3. localStorage              → persists across tabs, hard reloads, II redirects
// =============================================================

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import {
  getPersistedUrlParameter,
  getSecretFromHash,
} from "../utils/urlParams";

const ACTOR_QUERY_KEY = "actor";
const TOKEN_STORAGE_KEY = "_sf_caffeine_token";

function getAdminToken(): string {
  let token = getPersistedUrlParameter("caffeineAdminToken") ?? "";
  if (!token) {
    token = getSecretFromHash("caffeineAdminToken") ?? "";
  }
  if (!token) {
    token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  }
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    console.warn(
      "[useCustomActor] No Caffeine admin token found. " +
        "Open the app from the full draft URL (with #caffeineAdminToken=...) " +
        "so writes can be authorised.",
    );
  }
  return token;
}

export function useActor() {
  const queryClient = useQueryClient();
  const lastActorRef = useRef<backendInterface | null>(null);

  // STATIC query key. Actor is always anonymous. See rules above.
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY],
    queryFn: async () => {
      // ALWAYS create anonymous actor — NEVER pass II identity.
      const actor = await createActorWithConfig(undefined);

      const adminToken = getAdminToken();

      try {
        await actor._initializeAccessControlWithSecret(adminToken);
        console.log(
          "[useCustomActor] _initializeAccessControlWithSecret SUCCESS. token present:",
          !!adminToken,
        );
      } catch (e) {
        console.warn(
          "[useCustomActor] _initializeAccessControlWithSecret failed (writes may be blocked):",
          e,
        );
      }

      lastActorRef.current = actor;
      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
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
