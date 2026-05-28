import axios from 'axios';
import { SERVICES } from '../config/services';

function toMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  if (e instanceof Error) return e.message;
  return 'Request failed';
}

export async function pendingListings() {
  try {
    const res = await axios.get(`${SERVICES.listing}/listings/pending`);
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function approveListing(id: string, adminUid?: string) {
  try {
    const res = await axios.patch(
      `${SERVICES.listing}/listings/${id}/approve`,
      {},
      adminUid ? { headers: { 'x-admin-uid': adminUid } } : {},
    );
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function rejectListing(id: string, reason: string, adminUid?: string) {
  try {
    const res = await axios.patch(
      `${SERVICES.listing}/listings/${id}/reject`,
      { reason },
      adminUid ? { headers: { 'x-admin-uid': adminUid } } : {},
    );
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function addAuditLog(action: string, adminFirebaseUid: string, resourceId?: string, details?: string) {
  try {
    await axios.post(`${SERVICES.listing}/listings/audit`, {
      action, adminFirebaseUid, resourceId, details,
    });
  } catch {
    // best effort
  }
}

export async function adminGetAuditLogs() {
  try {
    const res = await axios.get(`${SERVICES.listing}/listings/audit/all`);
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function createListing(uid: string, input: any) {
  const res = await axios.post(`${SERVICES.listing}/listings`, input, {
    headers: { 'x-user-uid': uid },
  });
  return res.data as unknown;
}

export async function myListings(uid: string) {
  const res = await axios.get(`${SERVICES.listing}/listings/me`, {
    headers: { 'x-user-uid': uid },
  });
  return res.data as unknown;
}

export async function feed() {
  const res = await axios.get(`${SERVICES.listing}/listings/feed`);
  return res.data as unknown;
}

export async function adminAllListings() {
  const res = await axios.get(`${SERVICES.listing}/listings/all`);
  return res.data as unknown;
}

export async function adminListingStats() {
  const res = await axios.get(`${SERVICES.listing}/listings/stats`);
  return res.data as unknown;
}

export async function updateListing(uid: string, id: string, input: any) {
  const res = await axios.patch(`${SERVICES.listing}/listings/${id}`, input, {
    headers: { 'x-user-uid': uid },
  });
  return res.data as unknown;
}

export async function deleteListing(uid: string, id: string) {
  const res = await axios.delete(`${SERVICES.listing}/listings/${id}`, {
    headers: { 'x-user-uid': uid },
  });
  return res.data as unknown;
}

export async function getListing(id: string) {
  const res = await axios.get(`${SERVICES.listing}/listings/${id}`);
  return res.data as unknown;
}

export async function searchListings(params: {
  q?: string;
  category?: string;
  type?: string;
  limit?: number;
  offset?: number;
  includePremium?: boolean;
  startAfter?: string;
  startBefore?: string;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  if (params.type) query.set('type', params.type);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.includePremium === false) query.set('includePremium', 'false');
  if (params.startAfter) query.set('startAfter', params.startAfter);
  if (params.startBefore) query.set('startBefore', params.startBefore);
  const res = await axios.get(
    `${SERVICES.listing}/listings/search?${query.toString()}`,
  );
  return res.data as unknown;
}

export async function nearbyListings(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  query.set('lat', String(params.lat));
  query.set('lng', String(params.lng));
  if (params.radiusKm !== undefined) query.set('radiusKm', String(params.radiusKm));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const res = await axios.get(`${SERVICES.listing}/listings/nearby?${query.toString()}`);
  return res.data as unknown;
}

export async function reportListing(
  uid: string,
  listingId: string,
  reason: string,
  comment?: string,
) {
  try {
    const res = await axios.post(
      `${SERVICES.listing}/listings/${listingId}/report`,
      { reason, comment },
      { headers: { 'x-user-uid': uid } },
    );
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function adminGetReports() {
  try {
    const res = await axios.get(`${SERVICES.listing}/listings/reports/all`);
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function adminDismissReport(reportId: string) {
  try {
    const res = await axios.patch(
      `${SERVICES.listing}/listings/reports/${reportId}/dismiss`,
      {},
    );
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function adminActionReport(reportId: string) {
  try {
    const res = await axios.patch(
      `${SERVICES.listing}/listings/reports/${reportId}/action`,
      {},
    );
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}
