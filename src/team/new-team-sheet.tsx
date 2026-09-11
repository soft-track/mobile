import { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { createTeamTeamsPost } from '@/api/generated/endpoints/teams/teams';
import { errorDetail } from '@/api/errors';
import { useTeams } from '@/team/team-context';
import { Alert, AppText, Button, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';

/**
 * Suggest a key from the team name: "Mobile Platform" -> "MOB".
 *
 * A suggestion only. The key is permanent once created
 * (`backend/lib_softtrack/models/teams.py:27-36` -- PATCH accepts name and
 * description, never key), so it is offered rather than imposed, and typing in
 * the field stops the suggestion from overwriting the choice.
 */
export function suggestKey(name: string): string {
  const words = name
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 3);
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('');
}

export function NewTeamSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { setTeamKey } = useTeams();

  const [name, setName] = useState('');
  const [typedKey, setTypedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Derived, not synced: the suggestion applies until someone types their own.
  const key = typedKey ?? suggestKey(name);

  function reset() {
    setName('');
    setTypedKey(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (key.length < 2) {
      setError('A key needs at least 2 letters.');
      return;
    }

    setSubmitting(true);
    try {
      const team = await createTeamTeamsPost({ name: name.trim(), key });
      await queryClient.invalidateQueries({ queryKey: ['/teams'], refetchType: 'all' });
      setTeamKey(team.key);
      reset();
      onClose();
    } catch (err) {
      setError(errorDetail(err, 'Could not create the team.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Create team"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <View style={{ gap: 14, paddingBottom: 8 }}>
        <AppText variant="muted">Teams group issues, cycles and projects.</AppText>

        {error ? <Alert>{error}</Alert> : null}

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Mobile"
          returnKeyType="next"
        />
        <Field
          label="Key"
          value={key}
          // The server uppercases anyway (`lib_softtrack/teams.py:69`); doing it
          // here too means the field shows what will actually be stored.
          onChangeText={(value) => setTypedKey(value.toUpperCase().replace(/[^A-Z]/g, ''))}
          placeholder="MOB"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          returnKeyType="go"
          onSubmitEditing={submit}
          hint="Permanent — it appears in issue IDs like ENG-42."
        />

        <Button onPress={submit} loading={submitting} disabled={!name.trim()}>
          Create team
        </Button>
      </View>
    </Sheet>
  );
}
