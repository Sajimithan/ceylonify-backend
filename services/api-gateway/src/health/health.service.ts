import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { SERVICES } from '../config/services';

@Injectable()
export class HealthService {
  async healthAll() {
    const entries = Object.entries(SERVICES);

    const results = await Promise.all(
      entries.map(async ([name, baseUrl]) => {
        try {
          const res = await axios.get(`${baseUrl}/health`, { timeout: 2000 });
          return { service: name, ok: true, data: res.data as unknown };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'unknown error';
          return {
            service: name,
            ok: false,
            error: errorMessage,
          };
        }
      }),
    );

    return results;
  }
}
