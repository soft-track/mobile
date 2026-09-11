import { useState } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';

import { getInstanceUrl } from '@/api/instance';
import {
  deleteAttachmentAttachmentsAttachmentIdDelete,
  useListIssueAttachmentsIssuesIssueIdAttachmentsGet,
} from '@/api/generated/endpoints/attachments/attachments';
import type { AttachmentRead, IssueRead } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { getAccessToken } from '@/auth/session';
import { formatBytes, rejectionFor } from '@/attachments/rules';
import { filenameFrom, uploadAttachment } from '@/attachments/upload';
import { Section } from '@/issues/detail/sections';
import { Icon } from '@/ui/icon';
import { Alert, AppText, Card, Loading } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * The URL an attachment's bytes come from, with the bearer token attached.
 *
 * Attachment content is authenticated, so a plain image source would 401. The
 * token goes in a header rather than the query string -- it would otherwise end
 * up in any log the instance keeps.
 */
function imageSource(attachment: AttachmentRead) {
  const base = getInstanceUrl() ?? '';
  const token = getAccessToken();
  return {
    uri: `${base}/attachments/${attachment.id}/content`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

export function AttachmentsSection({ issue }: { issue: IssueRead }) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const attachments = useListIssueAttachmentsIssuesIssueIdAttachmentsGet(issue.id);

  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [retry, setRetry] = useState<{ uri: string; filename: string } | null>(null);
  const [viewing, setViewing] = useState<AttachmentRead | null>(null);

  const items = attachments.data ?? [];

  async function upload(uri: string, filename: string) {
    setError(null);
    setRetry(null);

    const rejection = rejectionFor(filename, undefined);
    if (rejection) {
      // Refused before spending a minute uploading something that was never
      // going to land.
      setError(rejection.message);
      return;
    }

    setProgress(0);
    try {
      await uploadAttachment({
        issueId: issue.id,
        uri,
        filename,
        onProgress: setProgress,
      });
      await queryClient.invalidateQueries({
        queryKey: [`/issues/${issue.id}/attachments`],
      });
    } catch (err) {
      setError(errorDetail(err, `Could not upload ${filename}.`));
      setRetry({ uri, filename });
    } finally {
      setProgress(null);
    }
  }

  async function fromCamera() {
    setPicking(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('SoftTrack needs camera access to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset) return;
    await upload(asset.uri, asset.fileName ?? filenameFrom(asset.uri));
  }

  async function fromLibrary() {
    setPicking(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ['images', 'videos'],
    });
    const asset = result.assets?.[0];
    if (!asset) return;
    await upload(asset.uri, asset.fileName ?? filenameFrom(asset.uri));
  }

  async function fromFiles() {
    setPicking(false);
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = result.assets?.[0];
    if (!asset) return;

    // The file picker knows the size, so an oversized file is caught here
    // rather than by the server after the whole upload.
    const rejection = rejectionFor(asset.name, asset.size);
    if (rejection) {
      setError(rejection.message);
      return;
    }
    await upload(asset.uri, asset.name);
  }

  return (
    <Section
      title="ATTACHMENTS"
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add attachment"
          onPress={() => setPicking(true)}
        >
          <Icon name="plus" size={16} color={t.brand[600]} />
        </Pressable>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      {retry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retry uploading ${retry.filename}`}
          onPress={() => void upload(retry.uri, retry.filename)}
          style={{
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: t.radius.control,
            backgroundColor: t.line.well,
          }}
        >
          <AppText variant="label" style={{ color: t.brand[600] }}>
            Retry {retry.filename}
          </AppText>
        </Pressable>
      ) : null}

      {progress !== null ? (
        <View style={{ gap: 6 }}>
          <AppText variant="hint">Uploading… {Math.round(progress * 100)}%</AppText>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: t.line.well,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: 4,
                backgroundColor: t.brand[600],
              }}
            />
          </View>
        </View>
      ) : null}

      {attachments.isPending ? <Loading /> : null}

      {items.length > 0 ? (
        <View style={{ gap: 8 }}>
          {items.map((attachment) => (
            <Card key={attachment.id} style={{ padding: 10, gap: 8 }}>
              {attachment.is_image ? (
                <Pressable
                  accessibilityRole="imagebutton"
                  accessibilityLabel={attachment.filename}
                  onPress={() => setViewing(attachment)}
                >
                  <Image
                    source={imageSource(attachment)}
                    style={{ width: '100%', height: 180, borderRadius: t.radius.control }}
                    contentFit="cover"
                    transition={120}
                  />
                </Pressable>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                    {attachment.filename}
                  </AppText>
                  <AppText variant="hint">
                    {formatBytes(attachment.size_bytes)} · {attachment.uploaded_by.full_name}
                  </AppText>
                </View>

                {!attachment.is_image ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${attachment.filename}`}
                    onPress={() => {
                      const base = getInstanceUrl() ?? '';
                      void Linking.openURL(`${base}/attachments/${attachment.id}/content`);
                    }}
                  >
                    <AppText variant="hint" style={{ color: t.brand[600] }}>
                      Open
                    </AppText>
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${attachment.filename}`}
                  onPress={async () => {
                    setError(null);
                    try {
                      await deleteAttachmentAttachmentsAttachmentIdDelete(attachment.id);
                      await queryClient.invalidateQueries({
                        queryKey: [`/issues/${issue.id}/attachments`],
                      });
                    } catch (err) {
                      setError(errorDetail(err, 'Could not delete that attachment.'));
                    }
                  }}
                >
                  <Icon name="trash" size={16} color={t.neutral[400]} />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      ) : !attachments.isPending ? (
        <Card style={{ padding: 14 }}>
          <AppText variant="muted">Nothing attached yet.</AppText>
        </Card>
      ) : null}

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Attach">
        <View style={{ gap: 2, paddingBottom: 12 }}>
          {[
            { label: 'Take a photo', run: fromCamera },
            { label: 'Photo library', run: fromLibrary },
            { label: 'Files', run: fromFiles },
          ].map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => void option.run()}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 10,
                borderRadius: t.radius.control,
              }}
            >
              <AppText variant="body">{option.label}</AppText>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Modal
        visible={viewing !== null}
        transparent
        onRequestClose={() => setViewing(null)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close image"
          onPress={() => setViewing(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {viewing ? (
            <Image
              source={imageSource(viewing)}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </Section>
  );
}
