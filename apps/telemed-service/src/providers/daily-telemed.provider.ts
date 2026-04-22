import { Injectable } from '@nestjs/common';

import { TelemedProviderName } from '@petwell/shared-types';

import { env } from '../config';
import { CreateRoomInput, CreateRoomResult, TelemedProvider } from './telemed-provider.interface';

const DAILY_API_BASE_URL = 'https://api.daily.co/v1';

type DailyRoomResponse = {
  url: string;
};

type DailyMeetingTokenResponse = {
  token: string;
};

@Injectable()
export class DailyTelemedProvider implements TelemedProvider {
  readonly name = TelemedProviderName.DAILY;

  async createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
    if (!env.DAILY_API_KEY) {
      throw new Error('Daily API key is missing');
    }

    const expiresAt = new Date(new Date(input.startsAt).getTime() + (input.durationMinutes + 15) * 60 * 1000);
    const room = await this.createDailyRoom(input.roomId, expiresAt);
    const joinToken = await this.createMeetingToken(input.roomId, expiresAt);

    const roomUrl = new URL(room.url);
    roomUrl.searchParams.set('t', joinToken);

    return {
      provider: this.name,
      roomUrl: roomUrl.toString(),
      joinToken,
      expiresAt
    };
  }

  private async createDailyRoom(roomName: string, expiresAt: Date) {
    return this.dailyRequest<DailyRoomResponse>('/rooms', {
      method: 'POST',
      body: {
        name: roomName,
        privacy: 'private',
        properties: {
          exp: this.toUnixSeconds(expiresAt),
          enable_prejoin_ui: true,
          lang: 'es'
        }
      }
    });
  }

  private async createMeetingToken(roomName: string, expiresAt: Date) {
    const response = await this.dailyRequest<DailyMeetingTokenResponse>('/meeting-tokens', {
      method: 'POST',
      body: {
        properties: {
          room_name: roomName,
          exp: this.toUnixSeconds(expiresAt),
          eject_at_token_exp: true,
          enable_prejoin_ui: true,
          lang: 'es'
        }
      }
    });

    return response.token;
  }

  private async dailyRequest<TResponse>(
    path: string,
    init: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
    }
  ): Promise<TResponse> {
    const response = await fetch(`${DAILY_API_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${env.DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    });

    if (!response.ok) {
      const details = await this.readErrorDetails(response);
      throw new Error(`Daily API request failed with status ${response.status}: ${details}`);
    }

    return (await response.json()) as TResponse;
  }

  private async readErrorDetails(response: Response) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      return JSON.stringify(payload);
    } catch {
      return (await response.text()) || 'unknown error';
    }
  }

  private toUnixSeconds(value: Date) {
    return Math.floor(value.getTime() / 1000);
  }
}
