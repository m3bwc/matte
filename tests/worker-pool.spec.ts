import { IQueuedTask, SyncOrAsync, TTask, WorkerPool, WorkerPoolQueueInterface } from '../src';
import { QueueType, TaskPriority } from '../src/types';
import { cpus } from 'os';
import { nanoid } from 'nanoid';

const range = (min: number, max: number) => {
  const array: number[] = [];
  const lower = Math.min(min, max);
  const upper = Math.max(min, max) - 1;

  for (let i = lower; i <= upper; i++) {
    array.push(i);
  }
  return array;
};

const sum = (array: number[]) => {
  let total = 0;
  for (const i in array) {
    total = total + array[i];
  }
  return total;
};

class ArrayedQueue implements WorkerPoolQueueInterface<TTask> {
  private queue: IQueuedTask[];
  constructor() {
    this.queue = [];
  }

  add(task: TTask, ...args: unknown[]): SyncOrAsync<this> {
    this.queue.push({ task, id: nanoid() });
    return this;
  }

  clear(): SyncOrAsync<void> {
    this.queue = [];
  }

  isEmpty(): SyncOrAsync<boolean> {
    return !Boolean(this.queue.length);
  }

  poll(): SyncOrAsync<TTask> {
    return this.queue.pop()?.task;
  }
}

describe('Worker pool', () => {
  let pool: WorkerPool;
  let multipleItemsPool: WorkerPool;

  beforeAll(async () => {
    await Promise.all([
      new Promise((resolve) => {
        pool = new WorkerPool({
          queueType: QueueType.FIFO,
          persistentContext: { foo: 'var' },
          persistentContextFn: function (context) {
            this.bar = context;
          },
        });
        pool.once('ready', resolve);
      }),
      new Promise((resolve) => {
        multipleItemsPool = new WorkerPool({
          maxJobsInWorker: cpus().length,
          queueType: QueueType.CUSTOM,
          queueImpl: ArrayedQueue,
        });
        pool.once('ready', resolve);
      }),
    ]);
  });

  it('should process multiple tasks', async () => {
    const rangeLength = 100;
    const result = (await Promise.all(
      new Array(rangeLength).fill(null).map(
        (_, data) =>
          new Promise((resolve, reject) => {
            multipleItemsPool.add({
              handler: (position) => position,
              resolve,
              reject,
              config: {
                data,
              },
            });
          }),
      ),
    )) as number[];

    expect(sum(result)).toBe(sum(range(0, rangeLength)));
  });

  it('should be process task', async () => {
    const result = await new Promise((resolve, reject) => {
      pool.add({
        resolve,
        reject,
        handler: () => {
          return 1 + 1;
        },
      });
    });
    expect(result).toEqual(2);
  });

  it('should be process task with callback', async () => {
    const result = await new Promise((resolve, reject) => {
      pool.add({
        callback: (err, data) => {
          if (err) reject(err);
          resolve(data);
        },
        handler: () => {
          return 1 + 1;
        },
      });
    });
    expect(result).toEqual(2);
  });

  it('should be catch rejected error', async () => {
    const result = await new Promise((resolve, reject) => {
      pool.add(
        {
          resolve,
          reject,
          handler: () => {
            throw new Error('some');
          },
        },
        TaskPriority.CRITICAL,
      );
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty('message');
    expect(result['message']).toEqual('some');
  });

  it('should be process task with persistence context fn and data', async () => {
    const result = await new Promise((resolve, reject) => {
      pool.add({
        resolve,
        reject,
        handler: function () {
          return this.bar.foo;
        },
      });
    });
    expect(result).toEqual('var');
  });

  afterAll(async () => {
    await Promise.all([pool.terminate(), multipleItemsPool.terminate()]);
  });
});
