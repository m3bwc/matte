import assert from 'assert';
import { WorkerPool } from '../src';

type PowPool = { x: number; y: number };

const pow = ({ x, y }: PowPool) => {
  return Math.pow(x, y);
};

const pool = new WorkerPool();

pool.init({ workers: { timeout: 200 } }).catch(console.error);

pool.once('ready', () => {
  const taskId = pool.process<PowPool, number>({
    handler: pow,
    data: { x: 2, y: 2 },
    callback: (result) => {
      assert.strictEqual(result.val, 4);
      console.log('Always works');
      pool.terminate();
    },
  });
});
