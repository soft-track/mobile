import { useState } from 'react';
import { Alert as RNAlert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  deleteIssueIssuesIssueIdDelete,
  updateIssueIssuesIssueIdPatch,
  useGetIssueIssuesIssueIdGet,
} from '@/api/generated/endpoints/issues/issues';
import type { IssuePriority, IssueUpdate } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import {
  InlineCreate,
  MultiPicker,
  PropertyRow,
  SinglePicker,
} from '@/issues/property-picker';
import {
  DevelopmentSection,
  LinksSection,
  SubIssuesSection,
  WatchToggle,
} from '@/issues/detail/sections';
import { labelFor, useIssueProperties } from '@/issues/use-issue-properties';
import { useTeams } from '@/team/team-context';
import { Icon } from '@/ui/icon';
import { Alert, AppText, Button, Card, Field, Loading } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * One issue, per `docs/design/mobile/144-issue-detail.svg`.
 *
 * Properties are written through as they are picked rather than collected
 * behind a Save button: each is a single-field PATCH, and a form that has to be
 * submitted invites half-made edits to be lost when the screen is dismissed.
 * Title and description are the exception -- they are typed, so they save on
 * blur.
 */
type Picker =
  | 'status'
  | 'priority'
  | 'estimate'
  | 'assignee'
  | 'labels'
  | 'project'
  | 'cycle'
  | null;

export function IssueDetailScreen() {
  const t = useTokens();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const issueId = Number(id);
  const { teams } = useTeams();

  const issueQuery = useGetIssueIssuesIssueIdGet(issueId, {
    query: { enabled: Number.isInteger(issueId) },
  });
  const issue = issueQuery.data;

  // The issue names its own team, which is not necessarily the active one --
  // a link can arrive from anywhere.
  const team = teams.find((candidate) => candidate.id === issue?.team_id);
  const props = useIssueProperties(team);

  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  async function patch(update: IssueUpdate) {
    if (!issue) return;
    setError(null);
    setSaving(true);
    try {
      await updateIssueIssuesIssueIdPatch(issue.id, update);
      await queryClient.invalidateQueries({ queryKey: [`/issues/${issue.id}`] });
      // The board groups by status and totals points, so both have to re-read.
      void queryClient.invalidateQueries({ queryKey: [`/teams/${issue.team_id}/issues`] });
      void queryClient.invalidateQueries({ queryKey: [`/teams/${issue.team_id}/estimates`] });
    } catch (err) {
      setError(errorDetail(err, 'Could not save that change.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!issue) return;
    RNAlert.alert(
      `Delete ${issue.identifier}?`,
      'This also deletes its attachments. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIssueIssuesIssueIdDelete(issue.id);
              await queryClient.invalidateQueries({
                queryKey: [`/teams/${issue.team_id}/issues`],
              });
              router.back();
            } catch (err) {
              setError(errorDetail(err, 'Could not delete the issue.'));
            }
          },
        },
      ],
    );
  }

  if (issueQuery.isPending) return <Loading />;

  if (!issue) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
          <AppText variant="heading">Issue not found</AppText>
          <AppText variant="muted" style={{ textAlign: 'center' }}>
            It may have been deleted, or belong to a team you are not on.
          </AppText>
          <Button variant="ghost" onPress={() => router.back()}>
            Go back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const status = labelFor(props.statusOptions, issue.status.id, 'None');
  const priorityMeta = labelFor(props.priorityOptions, issue.priority, 'No priority');
  const points = labelFor(props.estimateOptions, issue.estimate ?? null, 'Not sized');
  const assignee = labelFor(props.assigneeOptions, issue.assignee?.id ?? null, 'Unassigned');
  const project = labelFor(props.projectOptions, issue.project_id ?? null, 'None');
  const cycle = labelFor(props.cycleOptions, issue.cycle_id ?? null, 'None');
  const labelIds = (issue.labels ?? []).map((label) => label.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }} edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        >
          <AppText variant="label">Back</AppText>
        </Pressable>
        <AppText variant="identifier" style={{ flex: 1, textAlign: 'center' }}>
          {issue.identifier}
        </AppText>
        {saving ? <AppText variant="hint">Saving…</AppText> : <WatchToggle issue={issue} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        {error ? <Alert>{error}</Alert> : null}

        {issue.blocked_by_count > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: t.danger[50],
              borderRadius: t.radius.control,
              padding: 12,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.danger[500] }} />
            <AppText variant="body" style={{ color: t.danger[700] }}>
              Blocked by {issue.blocked_by_count} issue
              {issue.blocked_by_count === 1 ? '' : 's'}
            </AppText>
          </View>
        ) : null}

        <Card style={{ padding: 14, gap: 12 }}>
          <Field
            label="Title"
            value={title ?? issue.title}
            onChangeText={setTitle}
            multiline
            onBlur={() => {
              if (title !== null && title.trim() && title.trim() !== issue.title) {
                void patch({ title: title.trim() });
              }
              setTitle(null);
            }}
          />
          <Field
            label="Description"
            value={description ?? issue.description ?? ''}
            onChangeText={setDescription}
            placeholder="Markdown supported"
            multiline
            style={{ minHeight: 100 }}
            onBlur={() => {
              if (description !== null && description !== (issue.description ?? '')) {
                void patch({ description: description || null });
              }
              setDescription(null);
            }}
          />
        </Card>

        <Card style={{ paddingHorizontal: 14 }}>
          <PropertyRow
            label="Status"
            value={status.text}
            color={status.color}
            onPress={() => setPicker('status')}
          />
          <PropertyRow
            label="Priority"
            value={priorityMeta.text}
            color={priorityMeta.color}
            onPress={() => setPicker('priority')}
          />
          <PropertyRow
            label="Estimate"
            value={points.text}
            muted={points.muted}
            onPress={() => setPicker('estimate')}
          />
          <PropertyRow
            label="Assignee"
            value={assignee.text}
            color={assignee.color}
            muted={assignee.muted}
            onPress={() => setPicker('assignee')}
          />
          <PropertyRow
            label="Labels"
            value={
              labelIds.length === 0
                ? 'None'
                : (issue.labels ?? []).map((label) => label.name).join(', ')
            }
            muted={labelIds.length === 0}
            onPress={() => setPicker('labels')}
          />
          <PropertyRow
            label="Project"
            value={project.text}
            muted={project.muted}
            onPress={() => setPicker('project')}
          />
          <PropertyRow
            label="Cycle"
            value={cycle.text}
            muted={cycle.muted}
            onPress={() => setPicker('cycle')}
          />
        </Card>

        <SubIssuesSection issue={issue} />
        <LinksSection issue={issue} />
        <DevelopmentSection issue={issue} />

        <Card style={{ padding: 14 }}>
          <AppText variant="hint">Opened by {issue.creator.full_name}</AppText>
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${issue.identifier}`}
          onPress={confirmDelete}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: t.radius.control,
            backgroundColor: t.danger[50],
          }}
        >
          <Icon name="trash" size={16} color={t.danger[700]} />
          <AppText variant="label" style={{ color: t.danger[700] }}>
            Delete issue
          </AppText>
        </Pressable>
      </ScrollView>

      <SinglePicker
        visible={picker === 'status'}
        title="Status"
        options={props.statusOptions}
        selected={issue.status.id}
        onSelect={(value) => value !== null && void patch({ status_id: value })}
        onClose={() => setPicker(null)}
      />
      <SinglePicker
        visible={picker === 'priority'}
        title="Priority"
        options={props.priorityOptions}
        selected={issue.priority}
        onSelect={(value) => void patch({ priority: (value ?? 'no_priority') as IssuePriority })}
        onClose={() => setPicker(null)}
      />
      <SinglePicker
        visible={picker === 'estimate'}
        title="Estimate"
        options={props.estimateOptions}
        selected={issue.estimate ?? null}
        emptyLabel="Not sized"
        onSelect={(value) => void patch({ estimate: value as never })}
        onClose={() => setPicker(null)}
      />
      <SinglePicker
        visible={picker === 'assignee'}
        title="Assignee"
        options={props.assigneeOptions}
        selected={issue.assignee?.id ?? null}
        emptyLabel="Unassigned"
        onSelect={(value) => void patch({ assignee_id: value })}
        onClose={() => setPicker(null)}
      />
      <MultiPicker
        visible={picker === 'labels'}
        title="Labels"
        options={props.labelOptions}
        selected={labelIds}
        onToggle={(labelId) =>
          void patch({
            label_ids: labelIds.includes(labelId)
              ? labelIds.filter((x) => x !== labelId)
              : [...labelIds, labelId],
          })
        }
        onClose={() => setPicker(null)}
        footer={
          <InlineCreate
            placeholder="bug"
            busy={props.creating}
            onCreate={async (name) => {
              const newId = await props.createLabel(name);
              if (newId !== null) void patch({ label_ids: [...labelIds, newId] });
            }}
          />
        }
      />
      <SinglePicker
        visible={picker === 'project'}
        title="Project"
        options={props.projectOptions}
        selected={issue.project_id ?? null}
        emptyLabel="None"
        onSelect={(value) => void patch({ project_id: value })}
        onClose={() => setPicker(null)}
        footer={
          <InlineCreate
            placeholder="Platform"
            busy={props.creating}
            onCreate={async (name) => {
              const newId = await props.createProject(name);
              if (newId !== null) void patch({ project_id: newId });
            }}
          />
        }
      />
      <SinglePicker
        visible={picker === 'cycle'}
        title="Cycle"
        options={props.cycleOptions}
        selected={issue.cycle_id ?? null}
        emptyLabel="None"
        onSelect={(value) => void patch({ cycle_id: value })}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}
