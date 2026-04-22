import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { TelemedProviderName } from '@petwell/shared-types';

import { env } from '../config';
import { CreateRoomInput, CreateRoomResult, TelemedProvider } from './telemed-provider.interface';

@Injectable()
export class MockTelemedProvider implements TelemedProvider {
  readonly name = TelemedProviderName.MOCK;

  async createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
    const joinToken = randomUUID();
    return {
      provider: this.name,
      roomUrl: `${env.PUBLIC_APP_URL}/telemed/${input.roomId}?token=${joinToken}`,
      joinToken,
      expiresAt: new Date(new Date(input.startsAt).getTime() + input.durationMinutes * 60 * 1000)
    };
  }
}
