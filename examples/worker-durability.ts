import { WorkerPool } from '../src';

const pool = new WorkerPool();

pool
  .init({
    workers: { timeout: 20000, max: 1, jobs: 1 }
  })
  .then(async () => {
        return new Promise((resolve, reject) => {
          pool.process<number, number>({
            handler: () => {
              const arr = [];
              while(true) {
                arr.push({});
              }
            },
            promise: {
              resolve,
              reject,
            },
          });
        });
  })
  .catch(console.error)
  .then(() => {
    pool.process<undefined, string>({
      handler: () => {
        return 'worker is online again'
      },
      callback: (res) => {
        res.map(console.log).mapErr(console.error);
        pool.terminate();
      }
    })
  });
