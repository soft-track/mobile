import { Share } from 'react-native';

/**
 * Hand an invitation link to the system share sheet.
 *
 * This instance sends no email, so the link only reaches anybody if the person
 * creating it can pass it on. The web URL is shared rather than the custom
 * scheme: it opens for someone with no app installed, and the app can pick it
 * up from there.
 */
export async function shareInvite(
  token: string,
  teamName: string,
  instanceUrl: string | null,
): Promise<void> {
  const link = instanceUrl
    ? `${instanceUrl}/invite/${token}`
    : `softtrack://invite/${token}`;

  try {
    await Share.share({
      message: `Join ${teamName} on SoftTrack: ${link}`,
      url: link,
    });
  } catch {
    // Dismissing the share sheet is not a failure worth reporting.
  }
}
