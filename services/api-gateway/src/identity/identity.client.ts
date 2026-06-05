import axios from 'axios';
import { BadRequestException } from '@nestjs/common';
import { SERVICES } from '../config/services';

function toMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data!.message.join(', ');
    if (data?.message) return data.message;
    if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
      return 'Identity service is unavailable';
  }
  if (e instanceof Error) return e.message;
  return 'Request failed';
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status;
      if (status && status >= 400 && status < 500) {
        throw new BadRequestException(toMessage(e));
      }
      const isTransient = !e.response || status! >= 500 || e.code === 'ECONNREFUSED';
      if (isTransient) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          return await fn();
        } catch (e2) {
          throw new Error(`[${label}] ${toMessage(e2)}`);
        }
      }
    }
    throw new Error(`[${label}] ${toMessage(e)}`);
  }
}

export async function upsertUser(firebaseUid: string, email?: string) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/upsert-from-firebase`, { firebaseUid, email })
        .then((r) => r.data as unknown),
    'upsertUser',
  );
}

export async function getUser(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/get-by-firebase`, { firebaseUid })
        .then((r) => r.data as unknown),
    'getUser',
  );
}

export async function adminAllUsers() {
  return withRetry(
    () => axios.get(`${SERVICES.identity}/users/all`).then((r) => r.data as unknown),
    'adminAllUsers',
  );
}

export async function adminUserStats() {
  return withRetry(
    () => axios.get(`${SERVICES.identity}/users/stats`).then((r) => r.data as unknown),
    'adminUserStats',
  );
}

export async function adminChangeUserRole(id: string, role: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${id}/role`, { role })
        .then((r) => r.data as unknown),
    'adminChangeUserRole',
  );
}

// ── Saved Listings ──────────────────────────────────────────────────────────

export async function getSavedListings(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/${firebaseUid}/saved`)
        .then((r) => r.data as unknown),
    'getSavedListings',
  );
}

export async function addSavedListing(firebaseUid: string, listingId: string) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/${firebaseUid}/saved/${listingId}`)
        .then((r) => r.data as unknown),
    'addSavedListing',
  );
}

export async function removeSavedListing(firebaseUid: string, listingId: string) {
  return withRetry(
    () =>
      axios
        .delete(`${SERVICES.identity}/users/${firebaseUid}/saved/${listingId}`)
        .then((r) => r.data as unknown),
    'removeSavedListing',
  );
}

// ── Itinerary ────────────────────────────────────────────────────────────────

export async function getItinerary(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/${firebaseUid}/itinerary`)
        .then((r) => r.data as unknown),
    'getItinerary',
  );
}

export async function addToItinerary(
  firebaseUid: string,
  listingId: string,
  plannedDate: string,
  note?: string,
  isGoingEntry?: boolean,
) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/${firebaseUid}/itinerary`, {
          listingId,
          plannedDate,
          note,
          isGoingEntry,
        })
        .then((r) => r.data as unknown),
    'addToItinerary',
  );
}

export async function updateItineraryNote(itemId: string, note: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/itinerary/${itemId}/note`, { note })
        .then((r) => r.data as unknown),
    'updateItineraryNote',
  );
}

export async function removeFromItinerary(itemId: string) {
  return withRetry(
    () =>
      axios
        .delete(`${SERVICES.identity}/users/itinerary/${itemId}`)
        .then((r) => r.data as unknown),
    'removeFromItinerary',
  );
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function updateUserProfile(
  firebaseUid: string,
  fields: { displayName?: string; avatarUrl?: string },
) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${firebaseUid}/profile`, fields)
        .then((r) => r.data as unknown),
    'updateUserProfile',
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function createNotification(
  firebaseUid: string,
  title: string,
  body: string,
  type: string,
  resourceId?: string,
) {
  try {
    await axios.post(`${SERVICES.identity}/users/${firebaseUid}/notifications`, {
      title,
      body,
      type,
      ...(resourceId ? { resourceId } : {}),
    });
  } catch {
    // best effort — never block the main action
  }
}

export async function getNotifications(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/${firebaseUid}/notifications`)
        .then((r) => r.data as unknown),
    'getNotifications',
  );
}

export async function markNotificationRead(firebaseUid: string, notificationId: string) {
  return withRetry(
    () =>
      axios
        .patch(
          `${SERVICES.identity}/users/${firebaseUid}/notifications/${notificationId}/read`,
        )
        .then((r) => r.data as unknown),
    'markNotificationRead',
  );
}

export async function markAllNotificationsRead(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${firebaseUid}/notifications/read-all`)
        .then((r) => r.data as unknown),
    'markAllNotificationsRead',
  );
}

// ── AI Usage ─────────────────────────────────────────────────────────────────

export interface AiUsageResponse {
  requestsUsed: number;
  tokensUsed: number;
  resetAt: string;
  subscriptionTier: 'FREE' | 'PREMIUM';
  isPremium: boolean;
  role: string;
}

export async function getAiUsage(firebaseUid: string): Promise<AiUsageResponse> {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/${firebaseUid}/ai-usage`)
        .then((r) => r.data as AiUsageResponse),
    'getAiUsage',
  );
}

export async function incrementAiUsage(firebaseUid: string, tokensUsed: number): Promise<void> {
  try {
    await axios.post(`${SERVICES.identity}/users/${firebaseUid}/ai-usage/increment`, { tokensUsed });
  } catch {
    // best effort — never block the AI response
  }
}

export async function updateSubscription(firebaseUid: string, tier: 'FREE' | 'PREMIUM'): Promise<void> {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${firebaseUid}/subscription`, { tier })
        .then(() => undefined),
    'updateSubscription',
  );
}

// ── Saved Chats ───────────────────────────────────────────────────────────────

export async function saveChat(firebaseUid: string, name: string, messages: string) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/${firebaseUid}/chats`, { name, messages })
        .then((r) => r.data as unknown),
    'saveChat',
  );
}

export async function getSavedChats(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/${firebaseUid}/chats`)
        .then((r) => r.data as unknown),
    'getSavedChats',
  );
}

export async function deleteSavedChat(firebaseUid: string, chatId: string) {
  return withRetry(
    () =>
      axios
        .delete(`${SERVICES.identity}/users/${firebaseUid}/chats/${chatId}`)
        .then((r) => r.data as unknown),
    'deleteSavedChat',
  );
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

export async function getFeatureFlags() {
  const res = await axios.get(`${SERVICES.identity}/users/feature-flags`);
  return res.data as unknown;
}

export async function updateFeatureFlagClient(
  key: string,
  updates: { enabledForTravelers?: boolean; enabledForHosts?: boolean },
  adminUid: string,
) {
  const res = await axios.patch(`${SERVICES.identity}/users/feature-flags/${key}`, { ...updates, adminUid });
  return res.data as unknown;
}

// ── Host Application ──────────────────────────────────────────────────────────

export async function getHostApplication(firebaseUid: string) {
  try {
    const res = await axios.get(`${SERVICES.identity}/host-applications/by-uid/${firebaseUid}`);
    return res.data as { phoneNumber?: string } | null;
  } catch { return null; }
}

export async function updateUserPhone(firebaseUid: string, phone: string) {
  try {
    await axios.patch(`${SERVICES.identity}/users/${firebaseUid}/phone`, { phone });
  } catch { /* best effort */ }
}

// ── Notification helpers ──────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<
  { firebaseUid: string; fcmToken: string | null }[]
> {
  try {
    const res = await axios.get(`${SERVICES.identity}/users/admins`);
    return res.data as { firebaseUid: string; fcmToken: string | null }[];
  } catch {
    return [];
  }
}

export async function getNearbyTravelers(
  lat: number,
  lng: number,
  radiusKm = 50,
): Promise<{ firebaseUid: string; fcmToken: string | null }[]> {
  try {
    const res = await axios.get(
      `${SERVICES.identity}/users/nearby-travelers?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
    );
    return res.data as { firebaseUid: string; fcmToken: string | null }[];
  } catch {
    return [];
  }
}

export async function updateUserLocation(uid: string, lat: number, lng: number) {
  try {
    await axios.patch(`${SERVICES.identity}/users/${uid}/location`, { lat, lng });
  } catch {
    // best effort
  }
}

// ── P3.1: Account Suspension ──────────────────────────────────────────────────

export async function suspendUser(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${firebaseUid}/suspend`)
        .then((r) => r.data as unknown),
    'suspendUser',
  );
}

export async function activateUser(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${firebaseUid}/activate`)
        .then((r) => r.data as unknown),
    'activateUser',
  );
}

// ── P3.4: Announcements ───────────────────────────────────────────────────────

export async function broadcastNotification(title: string, body: string, roles?: string[]): Promise<{ sent: number }> {
  try {
    const res = await axios.post(`${SERVICES.identity}/users/broadcast-notification`, { title, body, roles });
    return res.data as { sent: number };
  } catch {
    return { sent: 0 };
  }
}

export async function getAllFcmTokens(roles?: string[]): Promise<{ firebaseUid: string; fcmToken: string }[]> {
  try {
    const params = roles && roles.length > 0 ? `?roles=${roles.join(',')}` : '';
    const res = await axios.get(`${SERVICES.identity}/users/all-fcm-tokens${params}`);
    return res.data as { firebaseUid: string; fcmToken: string }[];
  } catch {
    return [];
  }
}

// ── P4.2: Subscription History ────────────────────────────────────────────────

export async function getSubscriptionHistory(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/${firebaseUid}/subscription-history`)
        .then((r) => r.data as unknown),
    'getSubscriptionHistory',
  );
}

// ── Delete Account ────────────────────────────────────────────────────────────

export async function deleteUserAccount(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .delete(`${SERVICES.identity}/users/${firebaseUid}`)
        .then((r) => r.data as unknown),
    'deleteUserAccount',
  );
}

// ── F2: Verification & Self-Upgrade ──────────────────────────────────────────

export async function markEmailVerifiedClient(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${firebaseUid}/mark-email-verified`)
        .then((r) => r.data as unknown),
    'markEmailVerified',
  );
}

export async function markPhoneVerifiedClient(firebaseUid: string, phone: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/users/${firebaseUid}/mark-phone-verified`, { phone })
        .then((r) => r.data as unknown),
    'markPhoneVerified',
  );
}

export async function selfUpgradePremiumClient(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/${firebaseUid}/self-upgrade-premium`)
        .then((r) => r.data as unknown),
    'selfUpgradePremium',
  );
}

// ── F4: Going ─────────────────────────────────────────────────────────────────

export async function getGoingCount(listingId: string): Promise<number> {
  try {
    const res = await axios.get<{ count: number }>(`${SERVICES.identity}/users/going-count/${listingId}`);
    return res.data.count ?? 0;
  } catch {
    return 0;
  }
}

export async function checkGoing(firebaseUid: string, listingId: string): Promise<{ isGoing: boolean; itemId: string | null }> {
  try {
    const res = await axios.get(`${SERVICES.identity}/users/${firebaseUid}/going/${listingId}`);
    return res.data as { isGoing: boolean; itemId: string | null };
  } catch {
    return { isGoing: false, itemId: null };
  }
}

// ── F5: Experiences ───────────────────────────────────────────────────────────

export async function shareExperience(
  firebaseUid: string,
  listingId: string,
  rating: number,
  text: string,
  imageUrls: string[],
) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/${firebaseUid}/experiences`, { listingId, rating, text, imageUrls })
        .then((r) => r.data as unknown),
    'shareExperience',
  );
}

export async function getMyExperiences(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/${firebaseUid}/experiences`)
        .then((r) => r.data as unknown),
    'getMyExperiences',
  );
}

export async function deleteExperience(firebaseUid: string, id: string) {
  return withRetry(
    () =>
      axios
        .delete(`${SERVICES.identity}/users/${firebaseUid}/experiences/${id}`)
        .then((r) => r.data as unknown),
    'deleteExperience',
  );
}

export async function getListingExperiences(listingId: string) {
  try {
    const res = await axios.get(`${SERVICES.identity}/experiences/listing/${listingId}`);
    return res.data as unknown;
  } catch {
    return [];
  }
}

// ── F6: Hosts ─────────────────────────────────────────────────────────────────

export async function getAllHosts(limit?: number, offset?: number) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/hosts?limit=${limit ?? 20}&offset=${offset ?? 0}`)
        .then((r) => r.data as unknown),
    'getAllHosts',
  );
}

export async function getHostProfile(firebaseUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/users/host/${firebaseUid}`)
        .then((r) => r.data as unknown),
    'getHostProfile',
  );
}

// ── Host Applications ──────────────────────────────────────────────────────────

export async function submitHostApplication(input: {
  firebaseUid: string;
  email?: string;
  hostTypes: string;
  businessName?: string;
  businessAddress?: string;
  businessLat?: number;
  businessLng?: number;
  phoneNumber?: string;
  licenseNumber?: string;
  idType?: string;
  idDocumentUrl?: string;
  businessDocUrl?: string;
  healthCertUrl?: string;
  licenseDocUrl?: string;
  bankDocUrl?: string;
}) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/host-applications`, input)
        .then((r) => r.data as unknown),
    'submitHostApplication',
  );
}

export async function adminPendingHostApplications() {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.identity}/host-applications?status=PENDING`)
        .then((r) => r.data as unknown),
    'adminPendingHostApplications',
  );
}

export async function adminReviewHostApplication(
  firebaseUid: string,
  approve: boolean,
  reviewNote?: string,
) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.identity}/host-applications`, {
          firebaseUid,
          approve,
          reviewNote,
        })
        .then((r) => r.data as unknown),
    'adminReviewHostApplication',
  );
}
