import { EventEmitter } from 'events';
import { cpus } from 'os';
import {
  TWorkerConfig,
  TPoolConfig,
  WorkerPoolInterface,
  TWorkerWrapper,
  TTask,
  WorkerState,
  WorkerResponseInterface,
  TaskPriority,
  QueueType,
  WorkerPoolQueueInterface,
  TQueueImplementation,
} from './types';
import { Worker } from 'worker_threads';
import { readFileSync } from 'fs';
import { join, extname } from 'path';
import TypedArray = NodeJS.TypedArray;
import { PriorityQueue, Queue } from './structures';
import { deserialize, serialize } from 'v8';

export class WorkerPool extends EventEmitter implements WorkerPoolInterface {
  private maxWorkers: number;
  private workerConfig: TWorkerConfig;
  private persistentContextFn: string;
  private taskQueue: WorkerPoolQueueInterface<TTask>;
  private workers: TWorkerWrapper[] = [];

  constructor(config: TPoolConfig = {}) {
    super();
    const { maxWorkers, worker, persistentContextFn, queueType, queueImpl } = config;

    this.setUpMaxWorkers(maxWorkers);
    this.setUpWorkerConfig(worker);
    this.setUpPersistentContextFn(persistentContextFn);
    this.setUpQueue(queueType, queueImpl);

    this.upWorkers();
  }

  private upWorkers(): void {
    for (const position of Array(this.maxWorkers).keys()) {
      const worker = this.make();
      this.workers.push({ worker, status: WorkerState.WORKER_STATE_SPAWNING });
      worker.once(
        'online',
        (index => (): void => {
          setImmediate(() => {
            this.workers[index].status = WorkerState.WORKER_STATE_ONLINE;
            this.workers[index].worker.removeAllListeners();
            if (this.workers.length === this.maxWorkers) {
              this.emit('ready');
            }
          });
        })(position),
      );
      worker.once(
        'error',
        (index => (error: Error): void => {
          setImmediate(() => {
            this.workers[index].status = WorkerState.WORKER_STATE_OFF;
            this.workers[index].worker.removeAllListeners();
            this.emit('error', error);
            if (this.workers.every(w => w.status === WorkerState.WORKER_STATE_OFF)) {
              this.terminate();
            }
          });
        })(position),
      );
    }
  }

  private setUpPersistentContextFn(persistentContextFn: () => void): void {
    this.persistentContextFn = persistentContextFn
      ? persistentContextFn.toString()
      : (() => {
          return;
        }).toString();
  }

  private setUpMaxWorkers(maxWorkers: number): void {
    this.maxWorkers = maxWorkers || cpus().length;
  }

  private setUpWorkerConfig(worker: TWorkerConfig): void {
    this.workerConfig = worker || {
      timeout: 3000,
      resourceLimits: {
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        codeRangeSizeMb: 8,
      },
      executable: readFileSync(join(__dirname, `worker${extname(__filename)}`)).toString('utf8'),
    };
  }

  private setUpQueue(queueType: QueueType, queueImpl?: TQueueImplementation): void {
    if (queueType === QueueType.CUSTOM && typeof queueImpl === 'function') {
      this.taskQueue = new queueImpl();
    } else {
      this.taskQueue =
        queueType === QueueType.FIFO ? new Queue<TTask>() : new PriorityQueue<TTask>();
    }
  }

  private restore(deadWorker: TWorkerWrapper): void {
    deadWorker.worker = this.make();
    deadWorker.status = WorkerState.WORKER_STATE_SPAWNING;
    deadWorker.worker.once('online', () => {
      setImmediate(() => {
        deadWorker.status = WorkerState.WORKER_STATE_ONLINE;
        deadWorker.worker.removeAllListeners();
      });
    });
    deadWorker.worker.once('error', (error: Error) => {
      setImmediate(() => {
        deadWorker.status = WorkerState.WORKER_STATE_OFF;
        deadWorker.worker.removeAllListeners();
        this.emit('error', error);
      });
    });
  }

  private make(): Worker {
    const workerScript = this.workerConfig.executable.replace(
      '__persistent_context_initialization__',
      this.persistentContextFn,
    );
    return new Worker(workerScript, {
      eval: true,
      resourceLimits: this.workerConfig.resourceLimits,
    });
  }

  private async tick(): Promise<void> {
    for (const worker of this.workers.filter(w => w.status === WorkerState.WORKER_STATE_OFF)) {
      this.restore(worker);
    }

    if (this.taskQueue.isEmpty()) {
      return;
    }

    const availableWorker = this.workers.find(
      worker => worker.status === WorkerState.WORKER_STATE_ONLINE,
    );
    if (!availableWorker) {
      setImmediate(() => this.tick());
      return;
    }

    const task = await this.taskQueue.poll();
    availableWorker.status = WorkerState.WORKER_STATE_BUSY;
    try {
      availableWorker.worker.postMessage(
        serialize({
          handler: task.handler.toString(),
          config: task.config,
        }),
      );
      availableWorker.worker.once('message', (message: TypedArray) => {
        const { error, data } = deserialize(message) as WorkerResponseInterface<unknown>;
        const usePromise =
          Boolean(task.resolve) &&
          typeof task.resolve === 'function' &&
          Boolean(task.reject) &&
          typeof task.reject === 'function';
        const callbackExists = Boolean(task.callback) && typeof task.callback === 'function';

        availableWorker.worker.removeAllListeners();
        availableWorker.status = WorkerState.WORKER_STATE_ONLINE;
        setImmediate(() => this.tick());

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
      });
      availableWorker.worker.once('error', (error: Error) => {
        availableWorker.status = WorkerState.WORKER_STATE_OFF;
        task.reject(error);
        setImmediate(() => this.tick());
      });
    } catch (e) {
      availableWorker.status = WorkerState.WORKER_STATE_OFF;
      task.reject(e);
      setImmediate(() => this.tick());
    }
  }

  public async terminate(): Promise<void> {
    await Promise.all(this.workers.map(w => w.worker).map(worker => worker.terminate()));
    this.workers = [];
    await this.taskQueue.clear();
  }

  public async add(task: TTask, priority: TaskPriority = TaskPriority.LOW): Promise<void> {
    await this.taskQueue.add(task, priority);
    setImmediate(() => this.tick());
  }
}
