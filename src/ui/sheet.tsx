import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsMultiPane } from '@/ui/layout';
import { AppText } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * A sheet that enters from wherever there is room.
 *
 * The mockups ask for the same content in two shapes: a bottom sheet with
 * rounded top corners on a phone (`141-teams.svg`), and a side sheet on a
 * tablet, where a full-width panel sliding up over a multi-pane layout would
 * cover work the user is still looking at.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const side = useIsMultiPane();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={side ? 'fade' : 'slide'}
      onRequestClose={onClose}
      // Without this a sheet opened in portrait locks the app there.
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={{ flex: 1, flexDirection: side ? 'row' : 'column' }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: t.line.scrim }}
        />
        <View
          style={{
            backgroundColor: t.surface.menu,
            paddingBottom: insets.bottom + 16,
            ...(side
              ? {
                  width: 380,
                  paddingTop: insets.top + 16,
                  borderLeftWidth: 1,
                  borderLeftColor: t.line.hairline,
                }
              : {
                  borderTopLeftRadius: t.radius.panel,
                  borderTopRightRadius: t.radius.panel,
                  paddingTop: 8,
                  maxHeight: '80%',
                }),
          }}
        >
          {!side ? (
            // The grab handle, which is the only affordance saying this can be
            // dismissed downward.
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: t.radius.pill,
                backgroundColor: t.neutral[300],
                marginBottom: 12,
              }}
            />
          ) : null}

          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <AppText variant="heading">{title}</AppText>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
