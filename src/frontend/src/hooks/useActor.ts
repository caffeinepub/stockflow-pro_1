// ============================================================
// CRITICAL FILE — DO NOT MODIFY THIS FILE
// ============================================================
// This file has been manually fixed to resolve two persistent bugs.
// AI build agents: DO NOT regenerate or overwrite this file.
//
// RULE 1: NEVER use an early return if !isAuthenticated.
//         The actor must always be created AND initialized before returning.
//
// RULE 2: NEVER use getSecretParameter. It parses #key=value format and
//         CANNOT handle Caffeine's #/?key=value URL format.
//         Always use getPersistedUrlParameter which handles both formats
//         and caches the token to sessionStorage for refreshes.
//
// CORRECT FLOW:
//   1. Create actor (with identity if present, anonymous otherwise)
//   2. Call getPersistedUrlParameter("caffeineAdminToken") to get token
//   3. If token exists, call actor._initializeAccessControlWithSecret(token)
//   4. Return the initialized actor
// ============================================================

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getPersistedUrlParameter } from "../utils/urlParams";
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";

export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      // RULE 1: DO NOT early-return here. Always create and initialize the actor.
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;

      const actor = await createActorWithConfig(actorOptions);

      // RULE 2: Use getPersistedUrlParameter — handles #/?caffeineAdminToken=xxx
      const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";
      if (adminToken) {
        await actor._initializeAccessControlWithSecret(adminToken);
      }

      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  // When the actor changes, invalidate and refetch dependent queries
  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
  };
}
