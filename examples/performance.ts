import { WorkerPool } from '../src';
import { performance, PerformanceObserver } from 'perf_hooks';

const performanceObserver = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}`);
  });
});
performanceObserver.observe({ entryTypes: ['measure'] });

const n = 35;
measureSingleProcess(n).then( () => measureWorkerThread(n));

function fib(n) {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
}

function measureSingleProcess(n: number) {
  return new Promise((resolve) => {
    const arr = [];
    performance.mark('single process start');
    for (let i = 0; i < 50; i++) {
      arr.push({ i, f: fib(n) });
    }
    performance.mark('single process stop');
    performance.measure('single process', 'single process start', 'single process stop');
    resolve(arr.length);
  });
}

function measureWorkerThread(n: number) {
  const pool = new WorkerPool();

  pool
    .init({
      workers: { timeout: 5000, max: 4, jobs: 1 }
    })
    .then(async () => {
      performance.mark('worker thread start');
      await Promise.all(
        new Array(50).fill(null).map(() => {
          return new Promise((resolve, reject) => {
            pool.process<number, number>({
              data: n,
              handler: (n) => {
                function fib(n) {
                  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
                }
                return fib(n);
              },
              promise: {
                resolve,
                reject,
              },
            });
          });
        }),
      );

      performance.mark('worker thread stop');
      performance.measure('worker thread', 'worker thread start', 'worker thread stop');
      pool.terminate();
    })
    .catch(console.error);
}
