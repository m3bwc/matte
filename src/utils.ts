import { TWorkerResourceLimit } from './types';
import { Worker } from 'worker_threads';

export const makeWorker = (
  workerExecutable: string,
  options?: {
    persistentContextFn: string;
    persistentContext: Record<string, any>;
    resourceLimits?: TWorkerResourceLimit;
  },
): Worker => {
  const resourceLimits = options?.resourceLimits;
  const workerScript = workerExecutable
    .replace('__persistent_context_initialization__', options?.persistentContextFn)
    .replace('__persistent_context_data__', JSON.stringify(options?.persistentContext));
  return new Worker(workerScript, {
    eval: true,
    ...(resourceLimits ? { resourceLimits } : {}),
  });
};

export const isFunction = (arg: unknown): boolean => {
  return Boolean(arg) && typeof arg === 'function';
};
