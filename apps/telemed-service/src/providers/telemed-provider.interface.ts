import { TelemedProviderName } from '@petwell/shared-types';

export interface CreateRoomInput {
  roomId: string;
  appointmentId: string;
  ownerId: string;
  veterinarianId: string;
  startsAt: string;
  durationMinutes: number;
}

export interface CreateRoomResult {
  provider: TelemedProviderName;
  roomUrl: string;
  joinToken: string;
  expiresAt: Date;
}

export interface TelemedProvider {
  readonly name: TelemedProviderName;
  createRoom(input: CreateRoomInput): Promise<CreateRoomResult>;
}
