import assert from 'node:assert/strict';
import test from 'node:test';

import { PetsService } from '../src/pets.service';

test('getUpcomingBirthdays returns pets in window with all owner ids', async () => {
  const service = new PetsService({
    pet: {
      findMany: async () => [
        {
          id: 'pet-1',
          ownerId: 'owner-1',
          coOwnerIds: ['owner-2'],
          name: 'Luna',
          birthDate: new Date('2020-04-24T00:00:00.000Z')
        },
        {
          id: 'pet-2',
          ownerId: 'owner-3',
          coOwnerIds: [],
          name: 'Max',
          birthDate: new Date('2020-05-10T00:00:00.000Z')
        }
      ]
    }
  } as never);

  const result = await service.getUpcomingBirthdays('2026-04-20T00:00:00.000Z', '2026-04-27T23:59:59.999Z');

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'pet-1');
  assert.deepEqual(result[0]?.ownerIds, ['owner-1', 'owner-2']);
  assert.equal(result[0]?.nextBirthday.toISOString(), '2026-04-24T00:00:00.000Z');
});
