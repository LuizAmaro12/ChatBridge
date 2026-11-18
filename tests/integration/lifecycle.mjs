import { once } from 'node:events';

// Attach rejection handlers to both waits before either event can occur.
// A transport error must fail the caller, never become an orphaned rejection.
export async function openAndWaitForClose(client) {
  const [closed] = await Promise.all([once(client.ws, 'close'), client.open()]);
  return closed;
}
