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

export async function approveListing(id: string) {
  try {
    const res = await axios.patch(
      `${SERVICES.listing}/listings/${id}/approve`,
      {},
    );
    return res.data as unknown;
  } catch (e) {
    throw new Error(toMessage(e));
  }
}

export async function rejectListing(id: string, reason: string) {
  try {
    const res = await axios.patch(`${SERVICES.listing}/listings/${id}/reject`, {
      reason,
    });
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
}) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  if (params.type) query.set('type', params.type);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  const res = await axios.get(
    `${SERVICES.listing}/listings/search?${query.toString()}`,
  );
  return res.data as unknown;
}
