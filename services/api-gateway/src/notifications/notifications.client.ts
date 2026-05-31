import axios from 'axios';
import { SERVICES } from '../config/services';

export async function registerDeviceToken(uid: string, token: string) {
  try {
    await axios.post(`${SERVICES.notification}/devices/register`, { uid, token });
  } catch {
    // best effort — notification service may not be running
  }
}
