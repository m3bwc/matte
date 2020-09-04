export interface TaskQueryInterface<T = Record<string, unknown>, U = Record<string, unknown>> {
  ctx?: T;
  data?: U;
}

export enum TaskPriority {
  LOW,
  NORMAL,
  HIGH,
  CRITICAL,
  URGENT,
}

export type TTask = {
  handler: (...args: unknown[]) => unknown;
  resolve?: (value?: any) => unknown;
  callback?: (err: Error, result?: unknown) => void;
  reject?: (reason?: any) => unknown;
  config?: TaskQueryInterface;
};
