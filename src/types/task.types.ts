export interface TaskQueryInterface<
  T = Record<string, unknown>,
  U = Record<string, unknown> | string | number
> {
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

export interface TTask<
  T = Record<string, unknown>,
  U = Record<string, unknown> | string | number,
  R = unknown
> {
  handler: (data: U) => R;
  resolve?: (value?: any) => void;
  callback?: (err: Error, result?: R) => void;
  reject?: (reason?: any) => void;
  config?: TaskQueryInterface<T, U>;
}

export interface IQueuedTask<
  T = Record<string, unknown>,
  U = Record<string, unknown> | string | number
> {
  task: TTask<T, U>;
  id: string;
}
