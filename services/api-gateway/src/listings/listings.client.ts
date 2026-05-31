import axios from 'axios';
import { SERVICES } from '../config/services';

function toMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
      return 'Listing service is unavailable';
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

export async function pendingListings() {
  return withRetry(
    () => axios.get(`${SERVICES.listing}/listings/pending`).then((r) => r.data as unknown),
    'pendingListings',
  );
}

export async function approveListing(id: string, adminUid?: string) {
  return withRetry(
    () =>
      axios
        .patch(
          `${SERVICES.listing}/listings/${id}/approve`,
          {},
          adminUid ? { headers: { 'x-admin-uid': adminUid } } : {},
        )
        .then((r) => r.data as unknown),
    'approveListing',
  );
}

export async function rejectListing(id: string, reason: string, adminUid?: string) {
  return withRetry(
    () =>
      axios
        .patch(
          `${SERVICES.listing}/listings/${id}/reject`,
          { reason },
          adminUid ? { headers: { 'x-admin-uid': adminUid } } : {},
        )
        .then((r) => r.data as unknown),
    'rejectListing',
  );
}

export async function addAuditLog(
  action: string,
  adminFirebaseUid: string,
  resourceId?: string,
  details?: string,
) {
  try {
    await axios.post(`${SERVICES.listing}/listings/audit`, {
      action,
      adminFirebaseUid,
      resourceId,
      details,
    });
  } catch {
    // best effort
  }
}

export async function adminGetAuditLogs() {
  return withRetry(
    () => axios.get(`${SERVICES.listing}/listings/audit/all`).then((r) => r.data as unknown),
    'adminGetAuditLogs',
  );
}

export async function createListing(uid: string, input: any) {
  return withRetry(
    () =>
      axios
        .post(`${SERVICES.listing}/listings`, input, {
          headers: { 'x-user-uid': uid },
        })
        .then((r) => r.data as unknown),
    'createListing',
  );
}

export async function myListings(uid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.listing}/listings/me`, {
          headers: { 'x-user-uid': uid },
        })
        .then((r) => r.data as unknown),
    'myListings',
  );
}

export async function feed() {
  return withRetry(
    () => axios.get(`${SERVICES.listing}/listings/feed`).then((r) => r.data as unknown),
    'feed',
  );
}

export async function adminAllListings() {
  return withRetry(
    () => axios.get(`${SERVICES.listing}/listings/all`).then((r) => r.data as unknown),
    'adminAllListings',
  );
}

export async function adminListingStats() {
  return withRetry(
    () => axios.get(`${SERVICES.listing}/listings/stats`).then((r) => r.data as unknown),
    'adminListingStats',
  );
}

export async function updateListing(uid: string, id: string, input: any) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.listing}/listings/${id}`, input, {
          headers: { 'x-user-uid': uid },
        })
        .then((r) => r.data as unknown),
    'updateListing',
  );
}

export async function deleteListing(uid: string, id: string) {
  return withRetry(
    () =>
      axios
        .delete(`${SERVICES.listing}/listings/${id}`, {
          headers: { 'x-user-uid': uid },
        })
        .then((r) => r.data as unknown),
    'deleteListing',
  );
}

export async function getListing(id: string) {
  return withRetry(
    () => axios.get(`${SERVICES.listing}/listings/${id}`).then((r) => r.data as unknown),
    'getListing',
  );
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
  hidePastEvents?: boolean;
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
  if (params.hidePastEvents) query.set('hidePastEvents', 'true');
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.listing}/listings/search?${query.toString()}`)
        .then((r) => r.data as unknown),
    'searchListings',
  );
}

export async function listingsByHost(hostUid: string) {
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.listing}/listings/me`, { headers: { 'x-user-uid': hostUid } })
        .then((r) => r.data as unknown),
    'listingsByHost',
  );
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
  return withRetry(
    () =>
      axios
        .get(`${SERVICES.listing}/listings/nearby?${query.toString()}`)
        .then((r) => r.data as unknown),
    'nearbyListings',
  );
}

export async function reportListing(
  uid: string,
  listingId: string,
  reason: string,
  comment?: string,
  imageUrls?: string[],
) {
  return withRetry(
    () =>
      axios
        .post(
          `${SERVICES.listing}/listings/${listingId}/report`,
          { reason, comment, imageUrls },
          { headers: { 'x-user-uid': uid } },
        )
        .then((r) => r.data as unknown),
    'reportListing',
  );
}

export async function adminGetReports() {
  return withRetry(
    () =>
      axios.get(`${SERVICES.listing}/listings/reports/all`).then((r) => r.data as unknown),
    'adminGetReports',
  );
}

export async function adminDismissReport(reportId: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.listing}/listings/reports/${reportId}/dismiss`, {})
        .then((r) => r.data as unknown),
    'adminDismissReport',
  );
}

export async function adminActionReport(reportId: string) {
  return withRetry(
    () =>
      axios
        .patch(`${SERVICES.listing}/listings/reports/${reportId}/action`, {})
        .then((r) => r.data as unknown),
    'adminActionReport',
  );
}

export async function approvedCountByHost(hostUid: string): Promise<number> {
  try {
    const res = await axios.get(
      `${SERVICES.listing}/listings/approved-count?hostUid=${encodeURIComponent(hostUid)}`,
    );
    return (res.data as { count: number }).count ?? 0;
  } catch {
    return 0;
  }
}
