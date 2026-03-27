import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getPersistedUrlParameter } from "../utils/urlParams";
// ============================================================
// CRITICAL FILE — DO NOT MODIFY THIS FILE IN ANY BUILD
// This file is the core actor initialization for StockFlow Pro.
// The exact logic here is required for backend writes to work.
// Any change to this file will break all data persistence.
// ============================================================
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      // Always create actor — with identity if available, anonymous otherwise
      // DO NOT add an early return here. _initializeAccessControlWithSecret MUST always be called.
      const actor = await createActorWithConfig(
        identity ? { agentOptions: { identity } } : undefined,
      );
      // Use getPersistedUrlParameter — correctly parses #/?caffeineAdminToken=xxx format
      // DO NOT replace with getSecretParameter or getSecretFromHash — those use the wrong format
      const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";
      if (adminToken) {
        await actor._initializeAccessControlWithSecret(adminToken);
      }
      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

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
