import axios from 'axios';
import { SERVICES } from '../config/services';

export async function registerDeviceToken(uid: string, token: string) {
  await axios.post(`${SERVICES.notification}/devices/register`, { uid, token });
}
