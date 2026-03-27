// =============================================================
// CRITICAL FILE — DO NOT MODIFY OR OVERWRITE
// This file is the permanent actor initialization wrapper.
// It exists to prevent useActor.ts from breaking backend writes.
//
// RULES (enforced for all future builds):
//   1. NEVER use an early return if !isAuthenticated
//   2. NEVER use getSecretParameter — always use getPersistedUrlParameter
//   3. Always call _initializeAccessControlWithSecret UNCONDITIONALLY (even with empty token)
//      — this registers the caller's principal with the Caffeine platform.
//      Guarding with `if (adminToken)` causes writes to be rejected for users
//      who open the app without the token in the URL.
//   4. This file must NOT import from useActor.ts
//   5. ALWAYS use placeholderData: (prev) => prev to prevent actor becoming null
//      during Internet Identity transitions — this is critical for write reliability
// =============================================================

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getPersistedUrlParameter } from "../utils/urlParams";
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";

export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  // Keep a ref to the last known good actor so we never return null during transitions
  const lastActorRef = useRef<backendInterface | null>(null);

  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString() ?? "anon"],
    queryFn: async () => {
      // RULE: Never early-return based on isAuthenticated.
      // Always create the actor, always initialize with the token.
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;

      const actor = await createActorWithConfig(actorOptions);

      // RULE: Use getPersistedUrlParameter — handles #/?caffeineAdminToken=xxx format
      const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";

      // CRITICAL: Call _initializeAccessControlWithSecret UNCONDITIONALLY.
      // Do NOT guard with `if (adminToken)` — the Caffeine platform requires this call
      // to register the caller's principal. Skipping it causes ALL writes to be rejected.
      try {
        await actor._initializeAccessControlWithSecret(adminToken);
        console.log(
          "[useCustomActor] _initializeAccessControlWithSecret SUCCESS. token present:",
          !!adminToken,
          "principal:",
          identity?.getPrincipal().toString() ?? "anon",
        );
      } catch (e) {
        console.error(
          "[useCustomActor] _initializeAccessControlWithSecret FAILED - this will block all writes!",
          e,
        );
      }

      // Store as last known good actor
      lastActorRef.current = actor;
      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
    // CRITICAL: Keep previous actor data while new identity-based actor is loading.
    // Without this, actor becomes null during the II identity transition window,
    // causing all write useEffects to skip (if (!actor) return) and data to be lost.
    placeholderData: (prev) => prev,
  });

  // Store the resolved actor and never return null — fall back to last known good
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
