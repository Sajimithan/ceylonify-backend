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
