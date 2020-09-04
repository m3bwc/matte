import { TTask, TaskPriority, IQueuedTask } from './task.types';
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

export type TQueueImplementation = new () => WorkerPoolQueueInterface<IQueuedTask>;

export type TPoolConfig = {
  queueType?: QueueType;
  queueImpl?: TQueueImplementation;
  maxJobsInWorker?: number;
  maxWorkers?: number;
  worker?: TWorkerConfig;
  persistentContextFn?(context?: Record<string, any> | any[]): void;
  persistentContext?: Record<string, any> | any[];
  terminateFn?(): void;
};

export interface WorkerPoolInterface {
  terminate(): Promise<void>;
  add(task: TTask): void;
  add(task: TTask, priority?: TaskPriority): void;
}
