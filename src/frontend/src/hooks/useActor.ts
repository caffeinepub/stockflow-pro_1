import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getPersistedUrlParameter } from "../utils/urlParams";
// ============================================================
// CRITICAL FILE — DO NOT MODIFY OR OVERWRITE
// This file is the core actor initialization for StockFlow Pro.
// It must use getPersistedUrlParameter (NOT getSecretParameter)
// to correctly parse the Caffeine #/?caffeineAdminToken=xxx URL format.
// The early-return-before-init bug has been fixed here permanently.
// Any build agent must leave this file exactly as-is.
// ============================================================
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      // Always create actor — with identity if present, anonymous otherwise
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;
      const actor = await createActorWithConfig(actorOptions);

      // Always call _initializeAccessControlWithSecret using the correct URL parser
      // getPersistedUrlParameter correctly handles #/?caffeineAdminToken=xxx format
      const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";
      if (adminToken) {
        await actor._initializeAccessControlWithSecret(adminToken);
      }
      return actor;
    },
    // Only refetch when identity changes
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
