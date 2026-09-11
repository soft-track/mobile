import { useState } from 'react';
import { Alert as RNAlert, Pressable, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  deleteRuleAutomationRulesRuleIdDelete,
  updateRuleAutomationRulesRuleIdPatch,
  useListRulesTeamsTeamIdAutomationRulesGet,
  useListRunsTeamsTeamIdAutomationRunsGet,
} from '@/api/generated/endpoints/automations/automations';
import type {
  AutomationRuleRead,
  AutomationTrigger,
  RuleActions,
  RuleConditions,
  TeamRead,
} from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { useTeamData } from '@/board/use-team-data';
import { PRIORITY_LABEL } from '@/issues/issue-meta';
import { Alert, AppText, Button, Card } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Automation rules and their run log.
 *
 * Rules render as English rather than as a form of dropdowns. A rule is read
 * far more often than it is written -- usually to work out why an issue moved --
 * and "When an issue is created, set its priority to High" answers that in a
 * glance where a grid of selects does not.
 */
const TRIGGER_TEXT: Record<AutomationTrigger, string> = {
  issue_created: 'an issue is created',
  status_changed: 'an issue changes status',
  issue_assigned: 'an issue is assigned',
  comment_added: 'a comment is added',
  cycle_completed: 'a cycle is completed',
  branch_created: 'a branch is created',
  pull_request_opened: 'a pull request is opened',
  pull_request_merged: 'a pull request is merged',
};

type Lookup = {
  status: (id: number) => string;
  label: (id: number) => string;
  project: (id: number) => string;
  member: (id: number) => string;
  cycle: (id: number) => string;
};

function conditionText(conditions: RuleConditions, look: Lookup): string[] {
  const parts: string[] = [];
  if (conditions.if_status_id) parts.push(`it is in ${look.status(conditions.if_status_id)}`);
  if (conditions.if_priority) parts.push(`its priority is ${PRIORITY_LABEL[conditions.if_priority]}`);
  if (conditions.if_label_id) parts.push(`it has the ${look.label(conditions.if_label_id)} label`);
  if (conditions.if_project_id) parts.push(`it is in ${look.project(conditions.if_project_id)}`);
  if (conditions.if_assignee_id) parts.push(`it is assigned to ${look.member(conditions.if_assignee_id)}`);
  if (conditions.if_unassigned) parts.push('it is unassigned');
  return parts;
}

function actionText(actions: RuleActions, look: Lookup): string[] {
  const parts: string[] = [];
  if (actions.set_status_id) parts.push(`move it to ${look.status(actions.set_status_id)}`);
  if (actions.set_priority) parts.push(`set its priority to ${PRIORITY_LABEL[actions.set_priority]}`);
  if (actions.set_assignee_id) parts.push(`assign it to ${look.member(actions.set_assignee_id)}`);
  if (actions.add_label_id) parts.push(`add the ${look.label(actions.add_label_id)} label`);
  if (actions.set_cycle_id) parts.push(`put it in ${look.cycle(actions.set_cycle_id)}`);
  if (actions.move_to_active_cycle) parts.push('move it into the active cycle');
  if (actions.comment_body) parts.push('leave a comment');
  return parts;
}

/** A rule as a sentence. Exported because the phrasing is worth testing. */
export function describeRule(rule: AutomationRuleRead, look: Lookup): string {
  const when = TRIGGER_TEXT[rule.trigger] ?? rule.trigger;
  const ifs = conditionText(rule.conditions, look);
  const dos = actionText(rule.actions, look);

  const condition = ifs.length > 0 ? ` and ${ifs.join(' and ')}` : '';
  const action = dos.length > 0 ? dos.join(', and ') : 'do nothing';
  return `When ${when}${condition}, ${action}.`;
}

export function AutomationPanel({
  visible,
  onClose,
  team,
  isAdmin,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
  isAdmin: boolean;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const data = useTeamData(team);

  const rules = useListRulesTeamsTeamIdAutomationRulesGet(team.id, {
    query: { enabled: visible },
  });
  const runs = useListRunsTeamsTeamIdAutomationRunsGet(
    team.id,
    { limit: 20 },
    { query: { enabled: visible } },
  );

  const [error, setError] = useState<string | null>(null);

  const look: Lookup = {
    // A rule can outlive the row it names, so every lookup has a fallback
    // rather than rendering "undefined" into a sentence.
    status: (id) => data.statuses.find((s) => s.id === id)?.name ?? 'a deleted status',
    label: (id) => data.labels.find((l) => l.id === id)?.name ?? 'a deleted label',
    project: (id) => data.projects.find((p) => p.id === id)?.name ?? 'a deleted project',
    member: (id) =>
      data.members.find((m) => m.user.id === id)?.user.full_name ?? 'a former member',
    cycle: (id) => data.cycles.find((c) => c.id === id)?.display_name ?? 'a deleted cycle',
  };

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: [`/teams/${team.id}/automation-rules`],
      });
    } catch (err) {
      setError(errorDetail(err, fallback));
    }
  }

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="Automation">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        {(rules.data ?? []).map((rule) => (
          <Card key={rule.id} style={{ padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppText variant="label" style={{ flex: 1 }}>
                {rule.name}
              </AppText>
              <Switch
                value={rule.is_enabled}
                disabled={!isAdmin}
                accessibilityLabel={`${rule.name} enabled`}
                onValueChange={(value) =>
                  void run(
                    () =>
                      updateRuleAutomationRulesRuleIdPatch(rule.id, {
                        is_enabled: value,
                      }).then(() => undefined),
                    'Could not change that rule.',
                  )
                }
              />
            </View>

            <AppText variant="body" style={{ fontSize: 14 }}>
              {describeRule(rule, look)}
            </AppText>

            {isAdmin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${rule.name}`}
                onPress={() =>
                  RNAlert.alert(`Delete ${rule.name}?`, 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        void run(
                          () =>
                            deleteRuleAutomationRulesRuleIdDelete(rule.id).then(
                              () => undefined,
                            ),
                          'Could not delete that rule.',
                        ),
                    },
                  ])
                }
              >
                <AppText variant="hint" style={{ color: t.danger[700] }}>
                  Delete
                </AppText>
              </Pressable>
            ) : null}
          </Card>
        ))}

        {(rules.data ?? []).length === 0 && !rules.isPending ? (
          <Card style={{ padding: 14 }}>
            <AppText variant="muted">No automation rules yet.</AppText>
          </Card>
        ) : null}

        {/* Rules can be read, enabled, disabled and deleted here. Authoring one
            is a trigger plus six optional conditions plus seven optional
            actions, which is a form that belongs on a wider screen -- the web
            settings page has it. */}
        {isAdmin ? (
          <AppText variant="hint">
            New rules are written on the web settings page; everything else about
            them is here.
          </AppText>
        ) : null}

        <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.line.hairline }}>
          <AppText variant="eyebrow">RECENT RUNS</AppText>
          {(runs.data?.items ?? []).map((entry) => (
            <Card key={entry.id} style={{ padding: 12, gap: 2 }}>
              <AppText variant="body" numberOfLines={1} style={{ fontSize: 13 }}>
                {entry.rule_name}
              </AppText>
              <AppText variant="hint" numberOfLines={2}>
                {entry.issue_identifier ? `${entry.issue_identifier} · ` : ''}
                {entry.summary}
              </AppText>
            </Card>
          ))}
          {(runs.data?.items ?? []).length === 0 && !runs.isPending ? (
            <AppText variant="muted">Nothing has run yet.</AppText>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
