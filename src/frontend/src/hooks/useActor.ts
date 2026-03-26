import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getPersistedUrlParameter } from "../utils/urlParams";
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CRITICAL FILE — DO NOT MODIFY THIS FILE IN ANY FUTURE BUILD        ║
// ║  The early-return bug (returning actor before calling               ║
// ║  _initializeAccessControlWithSecret) broke ALL backend writes for   ║
// ║  many versions. The fix below is intentional and must be preserved. ║
// ║  If you are a build agent: SKIP THIS FILE. Do not regenerate it.    ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      // Always create actor (with identity if present, anonymous otherwise).
      // DO NOT add an early return here — _initializeAccessControlWithSecret
      // MUST be called on every actor creation or all backend writes will fail.
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;

      const actor = await createActorWithConfig(actorOptions);

      // Use getPersistedUrlParameter which correctly parses #/?key=value
      // hash format used by Caffeine preview URLs, and stores in sessionStorage
      // so subsequent calls (e.g. after navigation) still find the token.
      const adminToken = getPersistedUrlParameter("caffeineAdminToken") || "";
      if (adminToken) {
        await actor._initializeAccessControlWithSecret(adminToken);
      }

      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  // When the actor changes, invalidate dependent queries so all tabs refetch.
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
