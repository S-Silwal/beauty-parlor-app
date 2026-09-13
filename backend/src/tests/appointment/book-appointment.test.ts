import { describe, it } from '@jest/globals';

// See ../appointment.test.ts for the current booking coverage.
describe('POST /api/appointments/book', () => {
  it.todo('rejects a booking that overlaps an existing appointment');
  it.todo('rejects booking a cancelled/completed appointment\'s old slot correctly');
});
