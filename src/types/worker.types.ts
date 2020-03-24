import { Worker } from 'worker_threads';

export enum WorkerState {
  WORKER_STATE_ONLINE = 'WORKER_STATE_ONLINE',
  WORKER_STATE_SPAWNING = 'WORKER_STATE_SPAWNING',
  WORKER_STATE_BUSY = 'WORKER_STATE_BUSY',
  WORKER_STATE_OFF = 'WORKER_STATE_OFF',
}

export type TWorkerWrapper = {
  status: WorkerState;
  worker: Worker;
};
