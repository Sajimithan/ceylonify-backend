import axios from 'axios';
import { SERVICES } from '../config/services';

function toMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined;
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
    const isTransient =
      axios.isAxiosError(e) &&
      (!e.response || e.response.status >= 500 || e.code === 'ECONNREFUSED');
    if (isTransient) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        return await fn();
      } catch (e2) {
        throw new Error(`[${label}] ${toMessage(e2)}`);
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
) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.identity}/users/${firebaseUid}/itinerary`, {
          listingId,
          plannedDate,
          note,
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
) {
  try {
    await axios.post(`${SERVICES.identity}/users/${firebaseUid}/notifications`, {
      title,
      body,
      type,
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
