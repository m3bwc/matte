import { WorkerPool } from '../src';

const pool = new WorkerPool();
const task = (data, resolve, reject, t = 2000) => ({
  handler: (d, s) => {
    return new Promise((r, j) => {
      // @ts-ignore
      const timeout = setTimeout(() => {r(d.data)}, d.timeout);
      s.addEventListener('abort', () => {
        console.log('was aborted');
        clearTimeout(timeout);
        // j();
      });
    });
  },
  promise: {
    resolve,
    reject,
  },
  data: { status: data, timeout: t},
});
pool
  .init({
    workers: { timeout: 500, max: 1, jobs: 1 },
  })
  .then(async () => {
    return new Promise((resolve, reject) => {
      //@ts-ignore
      pool.process<boolean, boolean>(task(false, resolve, reject));
    });
  })
  .catch(console.error)
  .then(() => {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      pool.process<undefined, string>(task(true, resolve, reject, 0));
    })
  }).then((data) => {
    pool.terminate();
  }).catch(console.error);
