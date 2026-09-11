/**
 * @jest-environment node
 */
import {
  loginAuthLoginPost,
  registerAuthRegisterPost,
} from '@/api/generated/endpoints/auth/auth';
import { createCommentIssuesIssueIdCommentsPost } from '@/api/generated/endpoints/comments/comments';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import {
  listNotificationsNotificationsGet,
  markAllReadNotificationsReadAllPost,
  unreadCountNotificationsUnreadCountGet,
  updateNotificationNotificationsNotificationIdPatch,
} from '@/api/generated/endpoints/notifications/notifications';
import {
  acceptInviteInvitesTokenAcceptPost,
  createInviteTeamsTeamIdInvitesPost,
} from '@/api/generated/endpoints/invites/invites';
import type { TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { seededTeam } from '@/api/__tests__/support/team';

/**
 * The inbox against a real instance.
 *
 * Needs two accounts: the acceptance criterion says no notifications for your
 * own actions, which cannot be shown with one.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);
const DEMO_EMAIL = process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev';
const DEMO_PASSWORD = process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123';
const OTHER_EMAIL = `mob-notify-${RUN}@example.com`;

describeLive('notifications against a live instance', () => {
  let team: TeamRead;
  let demoToken: string;
  let otherToken: string;
  let otherUsername: string;
  let otherId: number;
  const issues: number[] = [];

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const demo = await loginAuthLoginPost({
      username: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    demoToken = demo.access_token;
    await persistToken(demoToken);
    team = await seededTeam();

    const other = await registerAuthRegisterPost({
      email: OTHER_EMAIL,
      password: 'password123',
      full_name: 'Notify Tester',
    });
    otherToken = other.access_token;
    otherUsername = other.user.username;
    otherId = other.user.id;

    // The second account has to be on the team to be assignable or mentionable.
    await persistToken(demoToken);
    const invite = await createInviteTeamsTeamIdInvitesPost(team.id, {
      email: OTHER_EMAIL,
      role: 'member',
    });
    await persistToken(otherToken);
    await acceptInviteInvitesTokenAcceptPost(invite.token);
  });

  afterAll(async () => {
    await persistToken(demoToken);
    for (const id of issues) await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
  });

  it('says nothing about your own actions', async () => {
    await persistToken(otherToken);
    await markAllReadNotificationsReadAllPost();
    const before = await unreadCountNotificationsUnreadCountGet();

    // The other account acts on its own issue, entirely by itself.
    const own = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Own action ${RUN}`,
      assignee_id: otherId,
    });
    issues.push(own.id);
    await createCommentIssuesIssueIdCommentsPost(own.id, { body: 'talking to myself' });

    const after = await unreadCountNotificationsUnreadCountGet();
    expect(after.unread).toBe(before.unread);
  });

  it('raises one when somebody assigns you', async () => {
    await persistToken(demoToken);
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Assign ${RUN}`,
    });
    issues.push(issue.id);
    await updateIssueIssuesIssueIdPatch(issue.id, { assignee_id: otherId });

    await persistToken(otherToken);
    const page = await listNotificationsNotificationsGet({ unread_only: true, limit: 25 });
    const hit = page.items.find((n) => n.issue.id === issue.id);
    expect(hit).toBeDefined();
    expect(hit?.kind).toBe('assigned');
    // Both are what the row renders.
    expect(hit?.actor?.full_name).toEqual(expect.any(String));
    expect(hit?.issue.identifier).toContain(team.key);
  });

  it('raises one when somebody mentions you', async () => {
    await persistToken(demoToken);
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Mention ${RUN}`,
    });
    issues.push(issue.id);
    await createCommentIssuesIssueIdCommentsPost(issue.id, {
      body: `hey @${otherUsername} take a look`,
    });

    await persistToken(otherToken);
    const page = await listNotificationsNotificationsGet({ unread_only: true, limit: 25 });
    const hit = page.items.find((n) => n.issue.id === issue.id);
    expect(hit?.kind).toBe('mentioned');
  });

  it('marks one read, and then all of them', async () => {
    await persistToken(otherToken);
    const unreadBefore = await unreadCountNotificationsUnreadCountGet();
    expect(unreadBefore.unread).toBeGreaterThan(0);

    const page = await listNotificationsNotificationsGet({ unread_only: true, limit: 1 });
    const one = page.items[0];
    await updateNotificationNotificationsNotificationIdPatch(one.id, { read: true });

    const afterOne = await unreadCountNotificationsUnreadCountGet();
    expect(afterOne.unread).toBe(unreadBefore.unread - 1);

    await markAllReadNotificationsReadAllPost();
    expect((await unreadCountNotificationsUnreadCountGet()).unread).toBe(0);
    // And the unread filter is genuinely a filter, not a styling choice.
    const unreadOnly = await listNotificationsNotificationsGet({
      unread_only: true,
      limit: 25,
    });
    expect(unreadOnly.items).toEqual([]);
  });

  it('pages the full list', async () => {
    await persistToken(otherToken);
    const all = await listNotificationsNotificationsGet({ limit: 25 });
    expect(all.total).toBeGreaterThan(0);
    const firstOnly = await listNotificationsNotificationsGet({ limit: 1, offset: 0 });
    expect(firstOnly.items).toHaveLength(1);
    expect(firstOnly.total).toBe(all.total);
  });
});
