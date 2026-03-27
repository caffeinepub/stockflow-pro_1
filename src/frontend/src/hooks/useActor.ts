// ============================================================
// CRITICAL FILE — DO NOT MODIFY THIS FILE
// ============================================================
// This file contains a permanent fix for two recurring bugs.
// Any AI agent or build system MUST NOT overwrite this file.
//
// BUG FIX 1: NEVER use an early return if !isAuthenticated.
//            The actor must ALWAYS be created first.
//
// BUG FIX 2: NEVER use getSecretParameter.
//            ALWAYS use getPersistedUrlParameter('caffeineAdminToken')
//            to correctly parse the #/?caffeineAdminToken=xxx hash format.
//
// REQUIRED LOGIC FLOW:
//   1. Create the actor (with identity if available, anonymous otherwise)
//   2. Call getPersistedUrlParameter('caffeineAdminToken')
//   3. If token exists, call _initializeAccessControlWithSecret(adminToken)
//   4. Return the actor
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
      // ALWAYS create the actor — never exit early based on isAuthenticated
      const actor = await createActorWithConfig(
        identity ? { agentOptions: { identity } } : undefined,
      );

      // ALWAYS use getPersistedUrlParameter — handles #/?caffeineAdminToken=xxx
      const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";
      if (adminToken) {
        await actor._initializeAccessControlWithSecret(adminToken);
      }

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
