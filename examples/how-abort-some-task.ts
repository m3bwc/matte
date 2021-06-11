import assert from 'assert';
import { WorkerPool } from '../src';
import type { AbortSignal } from 'abort-controller';

const reallyLongTask = async (_, signal: AbortSignal) => new Promise((res, rej) => {
  const timeoutId = setTimeout(() => {
    res('BOOM!');
  }, 200);
  signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    rej(new Error('Task was aborted'));
  })
})

const pool = new WorkerPool();

pool.init({ workers: { timeout: 100 } }).catch(console.error);

pool.once('ready', () => {
  pool.process<undefined, unknown>({
    handler: reallyLongTask,
    callback: (result) => {
      result.map(() => {
        throw new Error('BOOM');
      }).mapErr((err) => {
        assert.strictEqual(err.message, 'Task was aborted');
        console.log('Always works!');
      })
      pool.terminate();
    },
  }).andThen(id => pool.abort(id));
});
