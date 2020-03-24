export interface TaskQueryInterface<T = {}, U = {}> {
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
  handler: Function;
  resolve: Function;
  reject: Function;
  config?: TaskQueryInterface;
};