/**
 * In-process per-order mutex. Callback and verify requests for the same order run one after another,
 * so the state check, the gateway call and the status change cannot interleave.
 * The map lives on globalThis so that it survives dev hot reloads within one process.
 *
 * Note: this only serializes requests inside one Node process. Multi-instance deployments need a shared lock.
 */
const g = globalThis as unknown as { __PROFARM_ORDER_LOCKS__?: Map<string, Promise<unknown>> };
const locks: Map<string, Promise<unknown>> = g.__PROFARM_ORDER_LOCKS__ || (g.__PROFARM_ORDER_LOCKS__ = new Map());

export async function withOrderLock<T>(orderKey: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = locks.get(orderKey) || Promise.resolve();
  const run = previous.catch(() => undefined).then(() => fn());
  const tail = run.catch(() => undefined);
  locks.set(orderKey, tail);
  try {
    return await run;
  } finally {
    if (locks.get(orderKey) === tail) {
      locks.delete(orderKey);
    }
  }
}
