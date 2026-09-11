/**
 * @jest-environment node
 */
import Axios from 'axios';

import { AXIOS_INSTANCE } from '@/api/client';
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import {
  deleteAttachmentAttachmentsAttachmentIdDelete,
  listIssueAttachmentsIssuesIssueIdAttachmentsGet,
} from '@/api/generated/endpoints/attachments/attachments';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
} from '@/api/generated/endpoints/issues/issues';
import type { AttachmentRead, TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken, getAccessToken } from '@/auth/session';
import { seededTeam } from '@/api/__tests__/support/team';

/**
 * Attachments against a real instance.
 *
 * The acceptance criterion for #9 is that a photo taken on the phone lands on
 * the issue and renders. A jest run has no camera, so a real PNG is built in
 * memory and posted the same way the app posts one -- what is being checked is
 * that multipart upload, the server's type rules, and authenticated reads of
 * the bytes all line up.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);

/** The smallest valid PNG: 1x1, and it really does start with the signature. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function postFile(issueId: number, filename: string, bytes: Buffer, type: string) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type }), filename);
  const { data } = await AXIOS_INSTANCE.post<AttachmentRead>(
    `/issues/${issueId}/attachments`,
    form,
  );
  return data;
}

describeLive('attachments against a live instance', () => {
  let team: TeamRead;
  let issueId: number;

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const token = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    await persistToken(token.access_token);
    team = await seededTeam();
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Attachments ${RUN}`,
    });
    issueId = issue.id;
  });

  afterAll(async () => {
    await deleteIssueIssuesIssueIdDelete(issueId).catch(() => undefined);
  });

  it('accepts an image and marks it as one', async () => {
    const attachment = await postFile(issueId, `shot-${RUN}.png`, PNG_1X1, 'image/png');

    expect(attachment.is_image).toBe(true);
    expect(attachment.content_type).toBe('image/png');
    expect(attachment.size_bytes).toBe(PNG_1X1.length);
    // is_image is what decides between rendering inline and offering to open.
    expect(attachment.url).toContain(String(attachment.id));

    const listed = await listIssueAttachmentsIssuesIssueIdAttachmentsGet(issueId);
    expect(listed.map((a) => a.id)).toContain(attachment.id);

    await deleteAttachmentAttachmentsAttachmentIdDelete(attachment.id);
  });

  it('serves the bytes only with the bearer token', async () => {
    const attachment = await postFile(issueId, `auth-${RUN}.png`, PNG_1X1, 'image/png');
    const base = LIVE_URL!;
    const path = `/attachments/${attachment.id}/content`;

    // With the header the app sends, which is why an image source carries it
    // rather than relying on a plain URL.
    const ok = await AXIOS_INSTANCE.get(path, { responseType: 'arraybuffer' });
    expect(ok.status).toBe(200);
    expect(Buffer.from(ok.data).subarray(0, 8)).toEqual(PNG_1X1.subarray(0, 8));

    // And without it: a bare client, the way a plain <img src> would ask.
    expect(getAccessToken()).not.toBeNull();
    const anonymous = Axios.create({ baseURL: base });
    await expect(anonymous.get(path)).rejects.toMatchObject({
      response: { status: 401 },
    });

    await deleteAttachmentAttachmentsAttachmentIdDelete(attachment.id);
  });

  it('refuses an SVG, which is why the client refuses it first', async () => {
    // 415 for a type that is not on the list at all.
    await expect(
      postFile(issueId, `diagram-${RUN}.svg`, Buffer.from('<svg/>'), 'image/svg+xml'),
    ).rejects.toMatchObject({ response: { status: 415 } });
  });

  it('refuses a file whose bytes are not the image its name claims', async () => {
    // "Screenshot of the bug" is the whole point, so a mislabelled file fails
    // now with a clear error rather than later as a broken image.
    // 422 rather than 415: the extension is allowed, the bytes are not what it
    // claims, and the server says exactly that.
    await expect(
      postFile(issueId, `fake-${RUN}.png`, Buffer.from('not a png at all'), 'image/png'),
    ).rejects.toMatchObject({
      response: { status: 422, data: { detail: expect.stringContaining('not a valid PNG') } },
    });
  });

  it('takes a non-image and does not mark it as one', async () => {
    const attachment = await postFile(
      issueId,
      `notes-${RUN}.txt`,
      Buffer.from('a log line'),
      'text/plain',
    );
    expect(attachment.is_image).toBe(false);
    expect(attachment.content_type).toBe('text/plain');
    await deleteAttachmentAttachmentsAttachmentIdDelete(attachment.id);
  });
});
