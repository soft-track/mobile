import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  createCommentIssuesIssueIdCommentsPost,
  useListCommentsIssuesIssueIdCommentsGet,
} from '@/api/generated/endpoints/comments/comments';
import { listIssuesTeamsTeamIdIssuesGet } from '@/api/generated/endpoints/issues/issues';
import type { CommentRead, IssueRead, TeamMemberRead } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { Section } from '@/issues/detail/sections';
import { MarkdownBody } from '@/markdown/markdown';
import { MarkdownEditor } from '@/markdown/markdown-editor';
import type { Mentionable } from '@/markdown/mentions';
import { href } from '@/ui/href';
import { Alert, AppText, Avatar, Button, Card } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

const PAGE = 20;

/** Members are what `@` can name, and the API restricts mentions to them. */
export function mentionablesFrom(members: TeamMemberRead[]): Mentionable[] {
  return members.map((member) => ({
    id: member.user.id,
    full_name: member.user.full_name,
    username: member.user.username,
  }));
}

/**
 * Resolve `TEAMKEY-123` to an issue and open it.
 *
 * There is no lookup-by-identifier endpoint, so this searches the teams the
 * viewer is actually on -- which is also the access rule: a link to an issue on
 * a team you cannot see simply does not resolve, rather than erroring.
 */
export async function openIssueByIdentifier(
  identifier: string,
  teamIds: number[],
): Promise<boolean> {
  for (const teamId of teamIds) {
    const page = await listIssuesTeamsTeamIdIssuesGet(teamId, { limit: 200 }).catch(
      () => null,
    );
    const match = page?.items.find(
      (issue) => issue.identifier.toLowerCase() === identifier.toLowerCase(),
    );
    if (match) {
      router.push(href(`/issue/${match.id}`));
      return true;
    }
  }
  return false;
}

function CommentCard({
  comment,
  people,
  onOpenIssue,
}: {
  comment: CommentRead;
  people: Mentionable[];
  onOpenIssue: (identifier: string) => void;
}) {
  const t = useTokens();
  // A comment with no author came from an automation rule, not a person.
  const automation = comment.author === null;

  return (
    <Card style={{ padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {automation ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: t.line.well,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="hint">⚙</AppText>
          </View>
        ) : (
          <Avatar
            name={comment.author?.full_name ?? ''}
            color={comment.author?.avatar_color ?? t.neutral[400]}
            size={28}
          />
        )}
        <AppText
          variant="label"
          style={automation ? { fontStyle: 'italic', color: t.neutral[500] } : undefined}
        >
          {automation ? 'Automation' : comment.author?.full_name}
        </AppText>
      </View>

      <MarkdownBody source={comment.body} people={people} onOpenIssue={onOpenIssue} />
    </Card>
  );
}

export function CommentsSection({
  issue,
  members,
  teamIds,
}: {
  issue: IssueRead;
  members: TeamMemberRead[];
  teamIds: number[];
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const people = mentionablesFrom(members);

  const [limit, setLimit] = useState(PAGE);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const comments = useListCommentsIssuesIssueIdCommentsGet(issue.id, { limit, offset: 0 });
  const items = comments.data?.items ?? [];
  const total = comments.data?.total ?? 0;

  const onOpenIssue = (identifier: string) => {
    void openIssueByIdentifier(identifier, teamIds);
  };

  async function post() {
    setError(null);
    setPosting(true);
    try {
      await createCommentIssuesIssueIdCommentsPost(issue.id, { body: body.trim() });
      setBody('');
      await queryClient.invalidateQueries({
        queryKey: [`/issues/${issue.id}/comments`],
      });
      // Commenting auto-watches server-side, so the toggle has to re-read.
      void queryClient.invalidateQueries({ queryKey: [`/issues/${issue.id}/watch`] });
    } catch (err) {
      setError(errorDetail(err, 'Could not post that comment.'));
    } finally {
      setPosting(false);
    }
  }

  return (
    <Section title={total > 0 ? `COMMENTS · ${total}` : 'COMMENTS'}>
      {error ? <Alert>{error}</Alert> : null}

      <View style={{ gap: 10 }}>
        {items.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            people={people}
            onOpenIssue={onOpenIssue}
          />
        ))}

        {items.length === 0 && !comments.isPending ? (
          <Card style={{ padding: 14 }}>
            <AppText variant="muted">No comments yet.</AppText>
          </Card>
        ) : null}

        {total > items.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load more comments"
            onPress={() => setLimit((current) => current + PAGE)}
            style={{
              paddingVertical: 12,
              alignItems: 'center',
              borderRadius: t.radius.control,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.line.hairline,
            }}
          >
            <AppText variant="label" style={{ color: t.brand[600] }}>
              Show {Math.min(PAGE, total - items.length)} more
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <Card style={{ padding: 14, gap: 10 }}>
        <MarkdownEditor
          value={body}
          onChangeText={setBody}
          people={people}
          placeholder="Leave a comment. @ to mention someone."
          minHeight={90}
        />
        <Button onPress={post} loading={posting} disabled={!body.trim()}>
          Comment
        </Button>
      </Card>
    </Section>
  );
}
