import { TTask, TaskPriority } from './task.types';
import { WorkerPoolQueueInterface } from './queue.type';

export type TWorkerResourceLimit = {
  maxOldGenerationSizeMb: number;
  maxYoungGenerationSizeMb: number;
  codeRangeSizeMb: number;
};

export enum QueueType {
  PRIORITY,
  FIFO,
  CUSTOM,
}

export type TWorkerConfig = {
  resourceLimits?: TWorkerResourceLimit;
  timeout?: number;
  executable?: string;
};

export type TQueueImplementation = new () => WorkerPoolQueueInterface<TTask>;

export type TPoolConfig = {
  queueType?: QueueType;
  queueImpl?: TQueueImplementation;
  maxWorkers?: number;
  worker?: TWorkerConfig;
  persistentContextFn?(): void;
};

export interface WorkerPoolInterface {
  // new (config: TPoolConfig): AbstractWorkerPool; TODO: fix typing for the constructor
  terminate(): Promise<void>;
  add(task: TTask): void;
  add(task: TTask, priority?: TaskPriority): void;
}
