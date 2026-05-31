import axios from 'axios';
import { SERVICES } from '../config/services';

export async function upsertUser(firebaseUid: string, email?: string) {
  const res = await axios.post(
    `${SERVICES.identity}/users/upsert-from-firebase`,
    { firebaseUid, email },
  );
  return res.data as unknown;
}

export async function getUser(firebaseUid: string) {
  const res = await axios.post(`${SERVICES.identity}/users/get-by-firebase`, {
    firebaseUid,
  });
  return res.data as unknown;
}

export async function adminAllUsers() {
  const res = await axios.get(`${SERVICES.identity}/users/all`);
  return res.data as unknown;
}

export async function adminUserStats() {
  const res = await axios.get(`${SERVICES.identity}/users/stats`);
  return res.data as unknown;
}

export async function adminChangeUserRole(id: string, role: string) {
  const res = await axios.patch(`${SERVICES.identity}/users/${id}/role`, {
    role,
  });
  return res.data as unknown;
}

// ── Saved Listings ──────────────────────────────────────────────────────────

export async function getSavedListings(firebaseUid: string) {
  const res = await axios.get(
    `${SERVICES.identity}/users/${firebaseUid}/saved`,
  );
  return res.data as unknown;
}

export async function addSavedListing(firebaseUid: string, listingId: string) {
  const res = await axios.post(
    `${SERVICES.identity}/users/${firebaseUid}/saved/${listingId}`,
  );
  return res.data as unknown;
}

export async function removeSavedListing(
  firebaseUid: string,
  listingId: string,
) {
  const res = await axios.delete(
    `${SERVICES.identity}/users/${firebaseUid}/saved/${listingId}`,
  );
  return res.data as unknown;
}

// ── Itinerary ────────────────────────────────────────────────────────────────

export async function getItinerary(firebaseUid: string) {
  const res = await axios.get(`${SERVICES.identity}/users/${firebaseUid}/itinerary`);
  return res.data as unknown;
}

export async function addToItinerary(firebaseUid: string, listingId: string, plannedDate: string, note?: string) {
  const res = await axios.post(`${SERVICES.identity}/users/${firebaseUid}/itinerary`, {
    listingId, plannedDate, note,
  });
  return res.data as unknown;
}

export async function updateItineraryNote(itemId: string, note: string) {
  const res = await axios.patch(`${SERVICES.identity}/users/itinerary/${itemId}/note`, { note });
  return res.data as unknown;
}

export async function removeFromItinerary(itemId: string) {
  const res = await axios.delete(`${SERVICES.identity}/users/itinerary/${itemId}`);
  return res.data as unknown;
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function updateUserProfile(
  firebaseUid: string,
  fields: { displayName?: string; avatarUrl?: string },
) {
  const res = await axios.patch(`${SERVICES.identity}/users/${firebaseUid}/profile`, fields);
  return res.data as unknown;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function createNotification(
  firebaseUid: string,
  title: string,
  body: string,
  type: string,
) {
  try {
    await axios.post(`${SERVICES.identity}/users/${firebaseUid}/notifications`, { title, body, type });
  } catch {
    // best effort — never block the main action
  }
}

export async function getNotifications(firebaseUid: string) {
  const res = await axios.get(`${SERVICES.identity}/users/${firebaseUid}/notifications`);
  return res.data as unknown;
}

export async function markNotificationRead(firebaseUid: string, notificationId: string) {
  const res = await axios.patch(`${SERVICES.identity}/users/${firebaseUid}/notifications/${notificationId}/read`);
  return res.data as unknown;
}

export async function markAllNotificationsRead(firebaseUid: string) {
  const res = await axios.patch(`${SERVICES.identity}/users/${firebaseUid}/notifications/read-all`);
  return res.data as unknown;
}

// ── Saved Chats ───────────────────────────────────────────────────────────────

export async function saveChat(firebaseUid: string, name: string, messages: string) {
  const res = await axios.post(`${SERVICES.identity}/users/${firebaseUid}/chats`, { name, messages });
  return res.data as unknown;
}

export async function getSavedChats(firebaseUid: string) {
  const res = await axios.get(`${SERVICES.identity}/users/${firebaseUid}/chats`);
  return res.data as unknown;
}

export async function deleteSavedChat(firebaseUid: string, chatId: string) {
  const res = await axios.delete(`${SERVICES.identity}/users/${firebaseUid}/chats/${chatId}`);
  return res.data as unknown;
}

// ── Notification helpers ──────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<{ firebaseUid: string; fcmToken: string | null }[]> {
  try {
    const res = await axios.get(`${SERVICES.identity}/users/admins`);
    return res.data as { firebaseUid: string; fcmToken: string | null }[];
  } catch { return []; }
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
  } catch { return []; }
}

export async function updateUserLocation(uid: string, lat: number, lng: number) {
  try {
    await axios.patch(`${SERVICES.identity}/users/${uid}/location`, { lat, lng });
  } catch { /* best effort */ }
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
  const res = await axios.post(`${SERVICES.identity}/host-applications`, input);
  return res.data as unknown;
}

export async function adminPendingHostApplications() {
  const res = await axios.get(`${SERVICES.identity}/host-applications?status=PENDING`);
  return res.data as unknown;
}

export async function adminReviewHostApplication(firebaseUid: string, approve: boolean, reviewNote?: string) {
  const res = await axios.patch(`${SERVICES.identity}/host-applications`, {
    firebaseUid, approve, reviewNote,
  });
  return res.data as unknown;
}
