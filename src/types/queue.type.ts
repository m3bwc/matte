export type SyncOrAsync<T> = Promise<T> | T;

export interface WorkerPoolQueueInterface<T> {
  add(item: T, ...args: unknown[]): SyncOrAsync<this>;
  clear(): SyncOrAsync<void>;
  isEmpty(): SyncOrAsync<boolean>;
  poll(): SyncOrAsync<T>;
  toString?(callback: (...args: unknown[]) => unknown): SyncOrAsync<string>;
  remove?(item: T): SyncOrAsync<this>;
}
