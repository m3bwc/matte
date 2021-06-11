import { WorkerPool } from '../src';
import { Err, Ok, Result } from 'ts-results';

const range = (min: number, max: number) => {
  const array: Result<number, Error>[] = [];
  const lower = Math.min(min, max);
  const upper = Math.max(min, max) - 1;

  for (let i = lower; i <= upper; i++) {
    array.push(Ok(i));
  }
  return array;
};

const sum = (array: Result<number, Error>[]) => {
  let total = 0;
  for (const i in array) {
    total = total + (array[i].val as number);
  }
  return total;
};

describe('Worker pool', () => {
  const pool = WorkerPool.of();
  const multipleItemsPool = WorkerPool.of();

  beforeAll(async () => {
    await pool.init({
      context: { foo: 'var' },
      fn: {
        context: function (context) {
          this.bar = context;
        },
        terminate: function () {
          return Ok.EMPTY;
        },
      },
    });
    await multipleItemsPool.init({
      context: { foo: 'var' },
      workers: {
        jobs: 4,
      },
      fn: {
        context: function (context) {
          this.bar = context;
        },
        terminate: function () {
          return Ok.EMPTY;
        },
      },
    });
  });

  it('should be process promise data', async () => {
    const result = await new Promise<Result<number, Error>>((resolve, reject) => {
      pool
        .process<undefined, number>({
          promise: {
            resolve,
            reject,
          },
          handler: (data) => {
            return 1 + 1;
          },
        })
        .mapErr((err) => {
          console.log(err);
          reject(Err(err));
        });
    });
    expect(result.val).toEqual(2);
  });

  it('should be process promise with data', async () => {
    const result = await new Promise<Result<string, Error>>((resolve, reject) => {
      pool
        .process<{foo:string}, string>({
          promise: {
            resolve,
            reject,
          },
          data: { foo: 'bar' },
          handler: async (data) => {
            return data.foo;
          },
        })
        .mapErr((err) => {
          console.log(err);
          reject(Err(err));
        });
    });
    expect(result.val).toEqual('bar');
  });

  it('should be process callback', async () => {
    const result = await new Promise<any>((resolve, reject) => {
      pool
        .process({
          callback: (res) => {
            res.map(resolve).mapErr(reject);
          },
          data: { foo: 'bar' },
          handler: (data) => {
            return data.foo;
          },
        })
        .unwrap();
    });
    expect(result).toEqual('bar');
  });

  it('should be process callback error', async () => {
    const result = await new Promise<Error>((resolve, reject) => {
      pool
        .process({
          callback: (result) => {
            result.map(reject).mapErr(resolve);
            return Ok.EMPTY;
          },
          data: { foo: 'bar' },
          handler: () => {
            throw new Error('TestError');
          },
        })
        .unwrap();
    });
    expect(result.message).toEqual('TestError');
  });

  it('should be catch abort signal', async () => {
    const result = await new Promise<boolean>((resolve, reject) => {
      const id = pool
        .process({
          callback: (result) => {
            result.map(() => resolve(true)).mapErr(reject);
          },
          handler: (_, signal) => {
            return new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('TimeouError'));
              }, 150);
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                resolve(void 0);
              });
            });
          },
        })
        .unwrap();
      setTimeout(() => {
        pool.abort(id);
      }, 10);
    });
    expect(result).toBeTruthy();
  });

  it('should process multiple tasks', async () => {
    const rangeLength = 100;
    const result = await Promise.all(
      new Array(rangeLength).fill(null).map(
        (_, data) =>
          new Promise<Result<number, Error>>((resolve, reject) => {
            multipleItemsPool.process<number, number>({
              handler: (position) => position,
              promise: {
                resolve,
                reject,
              },
              data,
            });
          }),
      ),
    );

    expect(sum(result)).toBe(sum(range(0, rangeLength)));
  });

  afterAll((done) => {
    pool.terminate().map(() => done());
  });
});
