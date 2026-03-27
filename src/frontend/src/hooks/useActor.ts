// ============================================================
// CRITICAL FILE — DO NOT MODIFY THIS INITIALIZATION LOGIC
// Permanent architecture rules enforced here:
//   1. NEVER use an early return if !isAuthenticated
//   2. NEVER use getSecretParameter — use getPersistedUrlParameter ONLY
//   3. Actor is ALWAYS created first, token parsed second,
//      _initializeAccessControlWithSecret called ALWAYS before return
// Violating these rules breaks ALL backend writes silently.
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
      // RULE: Never early-return here. Always create actor, always init.
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;

      const actor = await createActorWithConfig(actorOptions);

      // RULE: Must use getPersistedUrlParameter — handles #/?key=value hash format
      // and caches to sessionStorage so refreshes continue to work.
      const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";
      await actor._initializeAccessControlWithSecret(adminToken);

      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  // When the actor changes, invalidate dependent queries
  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => {
          return !query.queryKey.includes(ACTOR_QUERY_KEY);
        },
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          return !query.queryKey.includes(ACTOR_QUERY_KEY);
        },
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
  };
}
