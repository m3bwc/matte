import { Err, Ok, Result } from 'ts-results';
import { nanoid } from 'nanoid';
import { Worker } from 'worker_threads';
import { readFileSync } from 'fs';
import { join } from 'path';
import EventEmitter from 'events';
import { cpus } from 'os';
import type { AbortSignal } from 'abort-controller';

const kTickEvent = Symbol('kTickEvent');
const kTaskAdded = Symbol('kTaskAdded');

const isFunction = (functionToCheck: unknown): boolean => {
  return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
};

const makeFunctionString = (_function: unknown): string => {
  return (isFunction(_function) ? _function : () => ({})).toString();
};

type Maybe<T> = T | undefined;

type TaskIdentity = string;

type WorkerNodeResourceLimit = {
  maxOldGenerationSizeMb?: number;
  maxYoungGenerationSizeMb?: number;
  codeRangeSizeMb?: number;
  stackSizeMb?: number;
};

type WorkerNodeResponse<V> = {
  error: Error;
  data: V;
  id: TaskIdentity;
};

type TaskTimeout = {
  timeout: NodeJS.Timeout;
};

interface TaskPayload<P, V> {
  context?: unknown;
  data?: P;
  handler: (data: P & { id: TaskIdentity }) => (signal: AbortSignal) => V;
  callback?: (data: Result<Maybe<V>, Error>) => void;
  promise?: {
    resolve: (value?: Ok<V> | PromiseLike<Ok<V>>) => void;
    reject: (reason: Err<Error>) => void;
  };
}

enum WorkerStatus {
  WORKER_STATE_ONLINE = 'WORKER_STATE_ONLINE',
  WORKER_STATE_SPAWNING = 'WORKER_STATE_SPAWNING',
  WORKER_STATE_BUSY = 'WORKER_STATE_BUSY',
  WORKER_STATE_OFF = 'WORKER_STATE_OFF',
}

type WorkerNode = {
  status: WorkerStatus;
  worker: Worker;
  jobs: number;
};

export type WorkerPoolLogger = {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  verbose: (...args: unknown[]) => void;
};

export type WorkersConfig = {
  max?: number;
  jobs?: number;
  timeout?: number;
  resources?: WorkerNodeResourceLimit;
};

export type WorkerPoolContext = {
  verbose?: boolean;
  logger?: WorkerPoolLogger;
  fn?: {
    context?: (data: unknown) => void;
    terminate?: () => Result<void, Error>;
  };
  context?: unknown;
  workers?: WorkersConfig;
};

export class WorkerPool<P, V> extends EventEmitter {
  private terminated = false;
  private timeout: number;
  private maxJobs: number;
  private taskQueue = new Map<TaskIdentity, TaskPayload<P, V>>();
  private processing = new Map<TaskIdentity, TaskPayload<P, V> & TaskTimeout>();
  private workers: WorkerNode[] = [];
  private logger: WorkerPoolLogger;
  private workersConfig: WorkersConfig;
  private workerScript: string;

  private constructor() {
    super();
    this.on(kTaskAdded, () => this.tick());
    this.setMaxListeners(0);
  }

  private get isntTerminated(): Result<void, Error> {
    return this.terminated ? Err(new Error(`${this.constructor.name} is terminated`)) : Ok.EMPTY;
  }

  private get freeNode(): Result<WorkerNode, Error> {
    const worker = this.workers.find((w) => w.status === WorkerStatus.WORKER_STATE_ONLINE);
    return worker ? Ok(worker) : Err(Error('No free worker'));
  }

  public static of<PT, VT>(): WorkerPool<PT, VT> {
    return new WorkerPool<PT, VT>();
  }

  public init(context: WorkerPoolContext): Promise<Result<void, Error>> {
    return new Promise((resolve, reject) => {
      this.once('ready', () => {
        resolve(Ok.EMPTY);
      });
      if (this.terminated) {
        return this.terminate().map(() => {
          this.terminated = false;
          return this.init(context);
        });
      }
      this.terminated = false;
      try {
        this.workersConfig = context?.workers;
        this.maxJobs = this.workersConfig?.jobs > 0 ? this.workersConfig?.jobs : 1;
        this.timeout = context.workers?.timeout || 15000;
        this.logger = { ...console, verbose: context.verbose ? console.log : () => undefined };

        const maxWorkers = this.workersConfig?.max > 0 ? this.workersConfig?.max : cpus().length;
        const persistentContextFn = makeFunctionString(context?.fn?.context);
        const terminateFn = makeFunctionString(context?.fn?.context);
        this.workerScript = readFileSync(join(__dirname, 'worker.js'), 'utf8')
          .replace('__persistent_context_initialization__', persistentContextFn)
          .replace('__persistent_context_data__', JSON.stringify(context?.context))
          .replace('__terminate_context_initialization__', terminateFn);

        for (const position of Array(maxWorkers).keys()) {
          const worker = new Worker(this.workerScript, {
            eval: true,
            ...(context?.workers?.resources || {}),
          });
          this.workers.push({ worker, status: WorkerStatus.WORKER_STATE_SPAWNING, jobs: 0 });
          worker.once(
            'online',
            this.handleWorkerOnline(position, () => {
              if (
                this.workers.length === maxWorkers &&
                this.workers.every((worker) => worker.status === WorkerStatus.WORKER_STATE_ONLINE)
              ) {
                this.emit('ready');
              }
            }),
          );
          worker.once('error', this.handleWorkerError(position));
          worker.on('message', this.handleWorkerMessage(position));
        }
      } catch (e) {
        reject(Err(e));
      }
    });
  }

  public process(task: TaskPayload<P, V>): Result<string, Error> {
    return this.isntTerminated.map(() => {
      const id = nanoid();
      this.taskQueue.set(id, task);
      this.emit(kTaskAdded);
      return id;
    });
  }

  public abort(id: TaskIdentity): Result<void, Error> {
    return this.isntTerminated.andThen(() => {
      if (this.taskQueue.has(id)) {
        this.taskQueue.delete(id);
        return Ok.EMPTY;
      }
      if (this.processing.has(id)) {
        try {
          this.workers.forEach((node) => node.worker.postMessage({ event: 'abort', id }));
          return Ok.EMPTY;
        } catch (e) {
          return Err(e);
        }
      }
      return Err(new Error(`Task with id "${id}" was not found`));
    });
  }

  public terminate(): Result<void, Error> {
    return this.isntTerminated
      .map(() => {
        this.terminated = true;
        try {
          this.workers.forEach((node) => node.worker.postMessage({ event: 'terminate' }));
        } catch (e) {
          this.logger.error(e);
          return Err(e);
        }
        setTimeout(() => {
          this.workers.map((node) => node.worker.terminate());
        }, this.timeout);

        return Ok.EMPTY;
      })
      .unwrap();
  }

  private reload(position: number, workerScript: string): void {
    const worker = new Worker(workerScript, {
      eval: true,
      ...(this.workersConfig?.resources || {}),
    });
    this.workers[position].worker = worker;
    this.workers[position].jobs = 0;

    worker.once('online', this.handleWorkerOnline(position).bind(this));
    worker.once('error', this.handleWorkerError(position).bind(this));
    worker.on('message', this.handleWorkerMessage(position).bind(this));
  }

  private handleWorkerOnline(index: number, cb?: () => void): (...args: unknown[]) => void {
    return () => {
      this.workers[index].status = WorkerStatus.WORKER_STATE_ONLINE;
      this.emit(kTickEvent);
      if (isFunction(cb)) {
        cb();
      }
    };
  }

  private handleWorkerError(index: number): (...args: unknown[]) => void {
    return (error: Error): void => {
      this.logger.error(error);
      this.workers[index].status = WorkerStatus.WORKER_STATE_OFF;
      this.workers[index].worker.removeAllListeners();
      this.reload(index, this.workerScript);
    };
  }

  private handleWorkerMessage(index: number): (...args: unknown[]) => void {
    return (message: WorkerNodeResponse<V>): void => {
      const { error, data, id } = message;

      const jobs = this.workers[index].jobs - 1;
      this.workers[index].jobs = jobs < 0 ? 0 : jobs;
      if (this.workers[index].jobs < this.maxJobs) {
        this.workers[index].status = WorkerStatus.WORKER_STATE_ONLINE;
      }

      const payload = this.processing.get(id);

      if (id && payload && payload.timeout) {
        clearTimeout(payload.timeout);
      }

      this.processing.delete(id);

      this.emit(kTickEvent);
      this.sendMessage(payload, error ? Err(error) : Ok(data));
    };
  }

  private tick(): Result<void, Error> {
    this.workers.forEach((node, i) => {
      if (node.status === WorkerStatus.WORKER_STATE_OFF) {
        this.reload(i, this.workerScript);
      }
    });

    if (this.taskQueue.size === 0) {
      return Ok.EMPTY;
    }

    return this.freeNode
      .map((node) => {
        node.jobs += 1;
        if (node.jobs === this.maxJobs) {
          node.status = WorkerStatus.WORKER_STATE_BUSY;
        }
        const [id, payload] = this.taskQueue[Symbol.iterator]().next().value as [
          TaskIdentity,
          TaskPayload<P, V>,
        ];
        const timeout = setTimeout(() => {
          this.abort(id).andThen(() =>
            this.sendMessage(payload, Err(new Error('TaskTimeoutError'))),
          );
        }, this.timeout);
        this.processing.set(id, { ...payload, timeout });
        try {
          node.worker.postMessage({
            handler: payload.handler?.toString(),
            data: payload.data,
            id,
          });
        } catch (e) {
          this.logger.error(e);

          this.sendMessage(payload, e).andThen(() => {
            node.worker?.terminate();
            node.status = WorkerStatus.WORKER_STATE_OFF;
            this.emit(kTickEvent);
            return Ok.EMPTY;
          });
        }
        this.taskQueue.delete(id);
        return;
      })
      .mapErr((err) => {
        this.once(kTickEvent, () => this.tick());
        return err;
      });
  }

  private sendMessage(
    payload: TaskPayload<P, V>,
    data: Result<Maybe<V>, Error>,
  ): Result<void, Error> {
    try {
      if (payload.callback) {
        payload.callback(data);
      } else if (
        payload.promise &&
        isFunction(payload.promise.resolve) &&
        isFunction(payload.promise.reject)
      ) {
        if (data.err) {
          payload.promise.reject(data);
        } else {
          payload.promise.resolve(data as Ok<V>);
        }
      }
      return Ok.EMPTY;
    } catch (e) {
      return Err(e);
    }
  }
}
