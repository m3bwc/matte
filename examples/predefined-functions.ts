import assert from 'assert';
import { WorkerPool } from '../src';

const pool = new WorkerPool();

pool
  .init({
    workers: { timeout: 100 },
    fn: {
      context: () => {
        // @ts-ignore
        this.pow = ({ x, y }) => {
          return Math.pow(x, y);
        };
      },
    },
  })
  .catch(console.error)
  .then(() => {
    pool
      .process<undefined, number>({
        handler: () => {
          // @ts-ignore
          return pow({ x: 2, y: 2 });
        },
        callback: (result) => {
          result.map((res) => assert.strictEqual(res, 4));
          pool.terminate();
        },
      })
      .andThen((id) => pool.abort(id));
  });
