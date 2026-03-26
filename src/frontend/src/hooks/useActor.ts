import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getPersistedUrlParameter } from "../utils/urlParams";
// ============================================================
// CRITICAL FILE — DO NOT MODIFY
// This file handles Internet Identity (II) authentication.
// The actor MUST be created with the II identity for writes to
// work. Anonymous actors cannot make update calls in the
// Caffeine environment. Any change here can break all writes.
// ============================================================
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      // ALWAYS create actor with II identity when available.
      // Anonymous actors cannot make update calls — writes will fail.
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;

      const actor = await createActorWithConfig(actorOptions);

      // Initialize access control when we have a real (non-anonymous) identity.
      // This registers the principal as admin (first call with correct token)
      // or as a regular user (subsequent calls). Anonymous callers are ignored
      // by the backend so we skip the call for them.
      if (identity) {
        const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";
        await actor._initializeAccessControlWithSecret(adminToken);
      }

      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  // When the actor changes, invalidate dependent queries so data reloads
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
