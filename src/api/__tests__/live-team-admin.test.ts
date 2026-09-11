/**
 * @jest-environment node
 */
import {
  loginAuthLoginPost,
  registerAuthRegisterPost,
} from '@/api/generated/endpoints/auth/auth';
import {
  acceptInviteInvitesTokenAcceptPost,
  createInviteTeamsTeamIdInvitesPost,
  listInvitesTeamsTeamIdInvitesGet,
  revokeInviteTeamsTeamIdInvitesInviteIdDelete,
} from '@/api/generated/endpoints/invites/invites';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  getIssueIssuesIssueIdGet,
} from '@/api/generated/endpoints/issues/issues';
import {
  createStatusTeamsTeamIdStatusesPost,
  deleteStatusStatusesStatusIdDelete,
  listStatusesTeamsTeamIdStatusesGet,
  reorderStatusesTeamsTeamIdStatusesOrderPut,
} from '@/api/generated/endpoints/statuses/statuses';
import {
  createTeamTeamsPost,
  listTeamMembersTeamsTeamIdMembersGet,
  removeTeamMemberTeamsTeamIdMembersUserIdDelete,
  updateTeamMemberRoleTeamsTeamIdMembersUserIdPatch,
  updateTeamTeamsTeamIdPatch,
} from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';

/**
 * Team administration against a real instance.
 *
 * Works on a team created for the run rather than the demo one, because these
 * delete statuses and change roles.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);
const KEY = `T${RUN}`.replace(/[^A-Za-z]/g, 'X').toUpperCase().slice(0, 6);

describeLive('team administration against a live instance', () => {
  let team: TeamRead;
  let adminToken: string;
  let otherToken: string;
  let otherId: number;

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const admin = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    adminToken = admin.access_token;
    await persistToken(adminToken);

    team = await createTeamTeamsPost({ name: `Admin ${RUN}`, key: KEY });

    const other = await registerAuthRegisterPost({
      email: `mob-admin-${RUN}@example.com`,
      password: 'password123',
      full_name: 'Second Admin',
    });
    otherToken = other.access_token;
    otherId = other.user.id;
  });

  it('renames the team but never its key', async () => {
    const updated = await updateTeamTeamsTeamIdPatch(team.id, {
      name: `Renamed ${RUN}`,
      description: 'Set from mobile',
    });
    expect(updated.name).toBe(`Renamed ${RUN}`);
    expect(updated.description).toBe('Set from mobile');
    // The key is permanent, which is why the field is read-only.
    expect(updated.key).toBe(KEY);
  });

  it('invites, lists, and revokes', async () => {
    const invite = await createInviteTeamsTeamIdInvitesPost(team.id, {
      email: `revoke-${RUN}@example.com`,
      role: 'member',
    });
    expect((await listInvitesTeamsTeamIdInvitesGet(team.id)).map((i) => i.id)).toContain(
      invite.id,
    );

    await revokeInviteTeamsTeamIdInvitesInviteIdDelete(team.id, invite.id);
    expect((await listInvitesTeamsTeamIdInvitesGet(team.id)).map((i) => i.id)).not.toContain(
      invite.id,
    );
  });

  it('refuses to leave the team without another admin', async () => {
    // The guard the Manage sheet explains rather than discovers.
    await expect(
      removeTeamMemberTeamsTeamIdMembersUserIdDelete(team.id, otherId),
    ).rejects.toMatchObject({ response: { status: 404 } });

    const members = await listTeamMembersTeamsTeamIdMembersGet(team.id);
    const me = members[0];
    await expect(
      updateTeamMemberRoleTeamsTeamIdMembersUserIdPatch(team.id, me.user.id, {
        role: 'member',
      }),
      // 409: demoting the last admin conflicts with the team still needing one,
      // which is the guard the Manage sheet explains up front.
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('promotes a second member to admin', async () => {
    const invite = await createInviteTeamsTeamIdInvitesPost(team.id, {
      email: `mob-admin-${RUN}@example.com`,
      role: 'member',
    });
    await persistToken(otherToken);
    await acceptInviteInvitesTokenAcceptPost(invite.token);

    await persistToken(adminToken);
    const promoted = await updateTeamMemberRoleTeamsTeamIdMembersUserIdPatch(
      team.id,
      otherId,
      { role: 'admin' },
    );
    expect(promoted.role).toBe('admin');
  });

  it('creates, reorders and deletes a status, moving its issues', async () => {
    const before = await listStatusesTeamsTeamIdStatusesGet(team.id);
    const created = await createStatusTeamsTeamIdStatusesPost(team.id, {
      name: `Review ${RUN}`,
      category: 'started',
    });

    // Reordering sends every id at once, so two people cannot interleave into
    // an order neither chose.
    const reversed = [created.id, ...before.map((s) => s.id)];
    const reordered = await reorderStatusesTeamsTeamIdStatusesOrderPut(team.id, {
      status_ids: reversed,
    });
    expect(reordered.map((s) => s.id)).toEqual(reversed);

    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `In deleted status ${RUN}`,
      status_id: created.id,
    });

    const destination = before[0];
    await deleteStatusStatusesStatusIdDelete(created.id, { move_to_id: destination.id });

    // Where the issues go is required rather than guessed -- so they are
    // exactly where they were sent.
    expect((await getIssueIssuesIssueIdGet(issue.id)).status.id).toBe(destination.id);
    await deleteIssueIssuesIssueIdDelete(issue.id).catch(() => undefined);
  });

  it('will not delete a status without saying where its issues go', async () => {
    const statuses = await listStatusesTeamsTeamIdStatusesGet(team.id);
    await expect(
      deleteStatusStatusesStatusIdDelete(statuses[0].id, {} as never),
    ).rejects.toMatchObject({ response: { status: 422 } });
  });
});
