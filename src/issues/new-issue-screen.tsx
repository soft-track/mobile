import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { createIssueTeamsTeamIdIssuesPost } from '@/api/generated/endpoints/issues/issues';
import type { IssuePriority } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import {
  InlineCreate,
  MultiPicker,
  PropertyRow,
  SinglePicker,
} from '@/issues/property-picker';
import { labelFor, useIssueProperties } from '@/issues/use-issue-properties';
import { useTeams } from '@/team/team-context';
import { href } from '@/ui/href';
import { Alert, AppText, Button, Card, Field } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * Create an issue, per `docs/design/mobile/143-new-issue.svg`.
 *
 * Every property the web's new-issue modal offers, as tappable rows rather than
 * a column of `<select>`s. Only the title is required -- the rest default the
 * way the API defaults them, so capturing a thought takes one field and a tap.
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

export function NewIssueScreen() {
  const t = useTokens();
  const queryClient = useQueryClient();
  const { team } = useTeams();
  const props = useIssueProperties(team);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState<number | null>(null);
  const [priority, setPriority] = useState<IssuePriority>('no_priority');
  const [estimate, setEstimate] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [labelIds, setLabelIds] = useState<number[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [cycleId, setCycleId] = useState<number | null>(null);

  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!team) return;
    setError(null);
    setSubmitting(true);
    try {
      const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
        title: title.trim(),
        // An empty description is nothing, not an empty string to render.
        description: description.trim() || undefined,
        status_id: statusId ?? undefined,
        priority,
        estimate: estimate as never,
        assignee_id: assigneeId ?? undefined,
        label_ids: labelIds,
        project_id: projectId ?? undefined,
        cycle_id: cycleId ?? undefined,
      });

      await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/issues`] });
      void queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/estimates`] });
      // Straight to what was just made, replacing this screen so Back returns
      // to the board rather than to an empty form.
      router.replace(href(`/issue/${issue.id}`));
    } catch (err) {
      setError(errorDetail(err, 'Could not create the issue.'));
    } finally {
      setSubmitting(false);
    }
  }

  const status = labelFor(props.statusOptions, statusId, 'Team default');
  const assignee = labelFor(props.assigneeOptions, assigneeId, 'Unassigned');
  const project = labelFor(props.projectOptions, projectId, 'None');
  const cycle = labelFor(props.cycleOptions, cycleId, 'None');
  const points = labelFor(props.estimateOptions, estimate, 'Not sized');
  const priorityMeta = labelFor(props.priorityOptions, priority, 'No priority');

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
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
        >
          <AppText variant="label">Cancel</AppText>
        </Pressable>
        <AppText variant="heading" style={{ flex: 1, textAlign: 'center' }}>
          New issue
        </AppText>
        {/* Balances the cancel button so the title sits centred. */}
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <Alert>{error}</Alert> : null}

          <Card style={{ padding: 14, gap: 12 }}>
            <Field
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="What needs doing?"
              returnKeyType="next"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Markdown supported"
              multiline
              numberOfLines={5}
              style={{ minHeight: 120 }}
            />
          </Card>

          <Card style={{ paddingHorizontal: 14 }}>
            <PropertyRow
              label="Status"
              value={status.text}
              color={status.color}
              muted={status.muted}
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
                  : labelIds
                      .map(
                        (id) =>
                          props.labelOptions.find((o) => o.value === id)?.label ?? String(id),
                      )
                      .join(', ')
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

          <Button onPress={submit} loading={submitting} disabled={!title.trim() || !team}>
            Create issue
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      <SinglePicker
        visible={picker === 'status'}
        title="Status"
        options={props.statusOptions}
        selected={statusId}
        emptyLabel="Team default"
        onSelect={setStatusId}
        onClose={() => setPicker(null)}
      />
      <SinglePicker
        visible={picker === 'priority'}
        title="Priority"
        options={props.priorityOptions}
        selected={priority}
        onSelect={(value) => setPriority(value ?? 'no_priority')}
        onClose={() => setPicker(null)}
      />
      <SinglePicker
        visible={picker === 'estimate'}
        title="Estimate"
        options={props.estimateOptions}
        selected={estimate}
        // Not sized is distinct from an estimate of zero, which is why it is a
        // row rather than the absence of one.
        emptyLabel="Not sized"
        onSelect={setEstimate}
        onClose={() => setPicker(null)}
      />
      <SinglePicker
        visible={picker === 'assignee'}
        title="Assignee"
        options={props.assigneeOptions}
        selected={assigneeId}
        emptyLabel="Unassigned"
        onSelect={setAssigneeId}
        onClose={() => setPicker(null)}
      />
      <MultiPicker
        visible={picker === 'labels'}
        title="Labels"
        options={props.labelOptions}
        selected={labelIds}
        onToggle={(id) =>
          setLabelIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onClose={() => setPicker(null)}
        footer={
          <InlineCreate
            placeholder="bug"
            busy={props.creating}
            onCreate={async (name) => {
              const id = await props.createLabel(name);
              if (id !== null) setLabelIds((prev) => [...prev, id]);
            }}
          />
        }
      />
      <SinglePicker
        visible={picker === 'project'}
        title="Project"
        options={props.projectOptions}
        selected={projectId}
        emptyLabel="None"
        onSelect={setProjectId}
        onClose={() => setPicker(null)}
        footer={
          <InlineCreate
            placeholder="Platform"
            busy={props.creating}
            onCreate={async (name) => {
              const id = await props.createProject(name);
              if (id !== null) setProjectId(id);
            }}
          />
        }
      />
      <SinglePicker
        visible={picker === 'cycle'}
        title="Cycle"
        options={props.cycleOptions}
        selected={cycleId}
        emptyLabel="None"
        onSelect={setCycleId}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}
