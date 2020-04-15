import { WorkerPool } from '../src/worker-pool';
import { TaskPriority, QueueType } from '../src/types';

describe('Worker pool', () => {
  let pool: WorkerPool;

  beforeAll(async () => {
    await new Promise(resolve => {
      pool = new WorkerPool({
        queueType: QueueType.FIFO,
        persistentContext: { foo: 'var' },
        persistentContextFn: function(context) {
          this.bar = context;
        },
      });
      pool.once('ready', resolve);
    });
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
        handler: () => {
          return this.bar.foo;
        },
      });
    });
    expect(result).toEqual('var');
  });

  afterAll(async () => {
    await pool.terminate();
  });
});
