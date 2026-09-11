import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/auth/auth-context';
import { rememberDestination } from '@/auth/pending-destination';
import { useTeams } from '@/team/team-context';
import { Loading } from '@/ui/primitives';

/**
 * `/ENG` — web URL parity for a team.
 *
 * The web makes every board its own address (`/:teamKey`,
 * `frontend/src/app/App.tsx:72`). A tab bar cannot: Board is one destination
 * whose subject changes. So this route is a redirect rather than a screen — it
 * sets the active team and hands over to the Board tab, which keeps links from
 * the web working without the shell growing a second shape.
 *
 * Lowercase tab names (`/board`, `/search`) can never be shadowed by this,
 * because team keys are uppercased server-side
 * (`backend/lib_softtrack/teams.py:69`) and expo-router matches static segments
 * case-sensitively.
 */
export function TeamRoute() {
  const { teamKey = '' } = useLocalSearchParams<{ teamKey: string }>();
  const { isAuthenticated, status } = useAuth();
  const { teams, setTeamKey, isPending } = useTeams();

  useEffect(() => {
    if (!isAuthenticated) {
      // Come back here once there is a session to resolve the key against.
      if (status === 'signedOut') rememberDestination(`/${teamKey}`);
      return;
    }
    if (isPending) return;

    const match = teams.find((team) => team.key.toLowerCase() === teamKey.toLowerCase());
    if (match) setTeamKey(match.key);
    // An unknown key falls through to Home rather than a dead end -- you may
    // have left the team, or the link may be for an instance you are not on.
    router.replace(match ? '/board' : '/');
  }, [isAuthenticated, status, isPending, teams, teamKey, setTeamKey]);

  return <Loading />;
}
