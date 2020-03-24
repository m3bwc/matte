import { TWorkerWrapper } from './worker.types';
import { TTask, TaskPriority } from './task.types';
import { Worker } from 'worker_threads';

export type TWorkerResourceLimit = {
  maxOldGenerationSizeMb: number;
  maxYoungGenerationSizeMb: number;
  codeRangeSizeMb: number;
};

export enum QueueType {
  PRIORITY,
  FIFO,
}

export type TWorkerConfig = {
  resourceLimits: TWorkerResourceLimit;
  timeout: number;
  executable: string;
};

export type TPoolConfig = {
  queueType?: QueueType;
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
