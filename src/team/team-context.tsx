import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useListMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';
import { useAccessToken } from '@/auth/session';
import { ACTIVE_TEAM_KEY } from '@/storage/keys';
import { readPref, writePref } from '@/storage/prefs';

/**
 * Which team the team-scoped destinations are showing.
 *
 * The web keys this off the URL (`/:teamKey`, `frontend/src/app/App.tsx:72`)
 * because every board view is its own address. A tab bar has no room for that:
 * Board is one destination whose subject changes, so the key lives here and is
 * persisted, and the `/[teamKey]` route sets it rather than replacing the shell.
 */
type TeamContextValue = {
  teams: TeamRead[];
  team: TeamRead | undefined;
  teamKey: string | null;
  setTeamKey: (key: string) => void;
  isPending: boolean;
  isError: boolean;
};

const TeamContext = createContext<TeamContextValue | null>(null);

/** Load the remembered team key. Called once, behind the splash. */
export async function hydrateActiveTeam(): Promise<string | null> {
  return readPref(ACTIVE_TEAM_KEY);
}

export function TeamProvider({
  initialTeamKey,
  children,
}: {
  initialTeamKey: string | null;
  children: ReactNode;
}) {
  const [storedKey, setStoredKey] = useState<string | null>(initialTeamKey);
  // Gated on a session existing: this provider mounts outside the auth guard,
  // and an ungated query fires GET /teams before anyone has signed in -- on
  // web that relative request even "succeeds" against the dev server and hands
  // back HTML where an array belongs.
  const token = useAccessToken();
  const teamsQuery = useListMyTeamsTeamsGet({
    query: { staleTime: 30_000, enabled: Boolean(token) },
  });
  // Never trust the shape blindly: the cache is persisted for a week, and this
  // provider sits above the error boundary -- a poisoned entry restored from
  // storage must degrade to "no teams", not brick the whole app at boot.
  const teams = useMemo(
    () => (Array.isArray(teamsQuery.data) ? teamsQuery.data : []),
    [teamsQuery.data],
  );

  const setTeamKey = useCallback((key: string) => {
    setStoredKey(key);
    void writePref(ACTIVE_TEAM_KEY, key);
  }, []);

  // Fall back to the first team when nothing is remembered, or when the
  // remembered one is gone -- left the team, or it was deleted. Without the
  // fallback the board would sit empty pointing at a team that no longer exists.
  const team = useMemo(() => {
    const match = teams.find((t) => t.key.toLowerCase() === storedKey?.toLowerCase());
    return match ?? teams[0];
  }, [teams, storedKey]);

  const value = useMemo<TeamContextValue>(
    () => ({
      teams,
      team,
      teamKey: team?.key ?? null,
      setTeamKey,
      isPending: teamsQuery.isPending,
      isError: teamsQuery.isError,
    }),
    [teams, team, setTeamKey, teamsQuery.isPending, teamsQuery.isError],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeams(): TeamContextValue {
  const value = useContext(TeamContext);
  if (!value) throw new Error('useTeams must be used inside a TeamProvider');
  return value;
}
