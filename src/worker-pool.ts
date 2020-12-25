import { EventEmitter } from 'events';
import { cpus } from 'os';
import {
  IQueuedTask,
  QueueType,
  TaskPriority,
  TPoolConfig,
  TQueueImplementation,
  TTask,
  TWorkerConfig,
  TWorkerWrapper,
  WorkerPoolInterface,
  WorkerPoolQueueInterface,
  WorkerResponseInterface,
  WorkerState,
} from './types';
import { Worker } from 'worker_threads';
import { readFileSync } from 'fs';
import { extname, join } from 'path';
import { PriorityQueue, Queue } from './structures';
import { deserialize, serialize } from 'v8';
import { nanoid } from 'nanoid';
import { isFunction, makeWorker } from './utils';
import TypedArray = NodeJS.TypedArray;
import { promisify } from 'util';

const kTickEvent = Symbol('kTickEvent');
const kTaskAdded = Symbol('kTaskAdded');

const sleep = promisify(setTimeout);

export class WorkerPool extends EventEmitter implements WorkerPoolInterface {
  private maxWorkers: number;
  private workerConfig: TWorkerConfig;
  private persistentContextFn: string;
  private taskQueue: WorkerPoolQueueInterface<IQueuedTask>;
  private workers: TWorkerWrapper[] = [];
  private persistentContext: Record<string, any> | any[];
  private terminated = true;
  private terminateFn: () => void;
  private maxJobsInWorker: number;
  private jobsInProgress = new Map<string, TTask>();

  public async refresh(config: TPoolConfig = {}) {
    if (!this.terminated) {
      await this.terminate();
    }
    const {
      maxWorkers,
      worker,
      persistentContextFn,
      queueType,
      queueImpl,
      persistentContext,
      terminateFn,
      maxJobsInWorker,
    } = config;

    this.setUpMaxJobsInWorker(maxJobsInWorker);
    this.setUpMaxWorkers(maxWorkers);
    this.setUpWorkerConfig(worker);
    this.setUpPersistentContextFn(persistentContextFn, persistentContext);
    this.setUpQueue(queueType, queueImpl);
    this.setUpTerminateFn(terminateFn);

    this.upWorkers();
    this.terminated = false;
  }

  constructor(config: TPoolConfig = {}) {
    super();
    this.refresh(config);
    this.on(kTaskAdded, () => this.tick());
    this.setMaxListeners(0);
  }

  private upWorkers(): void {
    for (const position of Array(this.maxWorkers).keys()) {
      const worker = this.make();
      this.workers.push({ worker, status: WorkerState.WORKER_STATE_SPAWNING, jobs: 0 });
      worker.once(
        'online',
        ((index) => (): void => {
          this.workers[index].status = WorkerState.WORKER_STATE_ONLINE;
          this.emit(kTickEvent);
          if (
            this.workers.length === this.maxWorkers &&
            this.workers.every((worker) => worker.status === WorkerState.WORKER_STATE_ONLINE)
          ) {
            this.emit('ready');
          }
        })(position),
      );
      worker.once(
        'error',
        ((index) => (error: Error): void => {
          this.workers[index].status = WorkerState.WORKER_STATE_OFF;
          this.workers[index].worker.removeAllListeners();
          this.emit('error', error);
          if (this.workers.every((w) => w.status === WorkerState.WORKER_STATE_OFF)) {
            this.terminate();
          }
        })(position),
      );

      worker.on(
        'message',
        ((index) => (message: TypedArray) => {
          const { error, data, id } = deserialize(message) as WorkerResponseInterface<unknown>;
          const task = this.jobsInProgress.get(id);
          const usePromise = isFunction(task.resolve) && isFunction(task.reject);
          const callbackExists = isFunction(task.callback);

          const jobs = this.workers[index].jobs - 1;
          this.workers[index].jobs = jobs < 0 ? 0 : jobs;
          if (this.workers[index].jobs < this.maxJobsInWorker) {
            this.workers[index].status = WorkerState.WORKER_STATE_ONLINE;
          }

          this.emit(kTickEvent);

          if (error) {
            const e = new Error(error.message);
            if (usePromise) {
              task.reject(error);
            } else {
              if (callbackExists) {
                task.callback(e);
              } else {
                throw e;
              }
            }
            return;
          }
          return usePromise
            ? task.resolve(data)
            : callbackExists
            ? task.callback(null, data)
            : undefined;
        })(position),
      );
    }
  }

  private setUpPersistentContextFn(
    persistentContextFn: () => void,
    persistentContext: Record<string, any> | any[],
  ): void {
    this.persistentContextFn = persistentContextFn
      ? persistentContextFn.toString()
      : (() => {
          return;
        }).toString();
    this.persistentContext = persistentContext || undefined;
  }

  private setUpMaxWorkers(maxWorkers: number): void {
    this.maxWorkers = maxWorkers || cpus().length;
  }

  private setUpWorkerConfig(worker: TWorkerConfig): void {
    this.workerConfig = {
      timeout: worker?.timeout || 3000,
      resourceLimits: worker?.resourceLimits || {
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        codeRangeSizeMb: 8,
      },
      executable:
        worker?.executable ||
        readFileSync(join(__dirname, `worker${extname(__filename)}`)).toString('utf8'),
    };
  }

  private setUpQueue(queueType: QueueType, queueImpl?: TQueueImplementation): void {
    if (queueType === QueueType.CUSTOM && typeof queueImpl === 'function') {
      this.taskQueue = new queueImpl();
    } else {
      this.taskQueue =
        queueType === QueueType.PRIORITY
          ? new PriorityQueue<IQueuedTask>()
          : new Queue<IQueuedTask>();
    }
  }

  private restore(deadWorker: TWorkerWrapper): void {
    deadWorker.worker = this.make();
    deadWorker.status = WorkerState.WORKER_STATE_SPAWNING;
    deadWorker.worker.once('online', () => {
      deadWorker.status = WorkerState.WORKER_STATE_ONLINE;
      deadWorker.worker.removeAllListeners();
      this.emit(kTickEvent);
    });
    deadWorker.worker.once('error', (error: Error) => {
      deadWorker.status = WorkerState.WORKER_STATE_OFF;
      deadWorker.worker.removeAllListeners();
      this.emit('error', error);
    });
  }

  private make(): Worker {
    return makeWorker(this.workerConfig.executable, {
      resourceLimits: this.workerConfig.resourceLimits,
      persistentContextFn: this.persistentContextFn,
      persistentContext: this.persistentContext,
    });
  }

  private async tick(): Promise<void> {
    for (const worker of this.workers.filter((w) => w.status === WorkerState.WORKER_STATE_OFF)) {
      this.restore(worker);
    }

    if (this.taskQueue.isEmpty()) {
      return;
    }

    const availableWorker = this.workers.find(
      (worker) => worker.status === WorkerState.WORKER_STATE_ONLINE,
    );
    if (!availableWorker) {
      this.once(kTickEvent, () => this.tick());
      return;
    }

    const queueItem = await this.taskQueue.poll();
    availableWorker.jobs += 1;
    if (availableWorker.jobs === this.maxJobsInWorker) {
      availableWorker.status = WorkerState.WORKER_STATE_BUSY;
    }
    try {
      this.jobsInProgress.set(queueItem.id, queueItem.task);
      availableWorker.worker.postMessage(
        serialize({
          handler: queueItem.task.handler.toString(),
          config: queueItem.task.config,
          id: queueItem.id,
        }),
      );
    } catch (e) {
      availableWorker.status = WorkerState.WORKER_STATE_OFF;
      queueItem.task.reject(e);
      this.emit(kTickEvent);
    }
  }

  public async terminate(): Promise<void> {
    this.terminated = true;
    await this.taskQueue.clear();
    if (this.workers.every((worker) => worker.jobs === 0)) {
      this.maxJobsInWorker = 1;
      await Promise.all(
        this.workers.map(
          () =>
            new Promise((resolve, reject) =>
              this.runTask({
                resolve,
                reject,
                handler:
                  this.terminateFn ||
                  function () {
                    return;
                  },
              }),
            ),
        ),
      );

      await Promise.all(this.workers.map((w) => w.worker).map((worker) => worker.terminate()));
      this.workers = [];
      await this.taskQueue.clear();
    } else {
      await sleep(50);
      return this.terminate();
    }
  }

  private async runTask(task: TTask, priority: TaskPriority = TaskPriority.LOW): Promise<void> {
    await this.taskQueue.add({ task, id: nanoid() }, priority);
    this.emit(kTaskAdded);
  }

  public async add(task: TTask, priority: TaskPriority = TaskPriority.LOW): Promise<void> {
    if (!this.terminated) {
      return await this.runTask(task, priority);
    }
    throw new Error('Current Worker pool is terminated');
  }

  private setUpTerminateFn(terminateFn: () => void): void {
    this.terminateFn = terminateFn;
  }

  public setUpMaxJobsInWorker(maxJobsInWorker: number): void {
    this.maxJobsInWorker = maxJobsInWorker && maxJobsInWorker > 1 ? maxJobsInWorker : 1;
  }
}
