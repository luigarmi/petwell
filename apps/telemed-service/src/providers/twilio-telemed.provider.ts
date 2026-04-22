import { Injectable } from '@nestjs/common';

import { TelemedProviderName } from '@petwell/shared-types';

import { CreateRoomInput, CreateRoomResult, TelemedProvider } from './telemed-provider.interface';

@Injectable()
export class TwilioTelemedProvider implements TelemedProvider {
  readonly name = TelemedProviderName.TWILIO;

  async createRoom(_input: CreateRoomInput): Promise<CreateRoomResult> {
    throw new Error('Twilio provider is prepared but not activated. Add valid Twilio credentials to enable it.');
  }
}
