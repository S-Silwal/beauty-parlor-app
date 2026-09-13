import { describe, it } from '@jest/globals';

describe('DELETE /api/appointments/:id/cancel', () => {
  it.todo('cancels a PENDING/CONFIRMED appointment owned by the caller');
  it.todo('rejects cancelling another user\'s appointment');
  it.todo('rejects cancelling an already-cancelled or completed appointment');
});
