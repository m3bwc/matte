import { Worker } from 'worker_threads';
import { readFileSync } from 'fs';
import { deserialize, serialize } from 'v8';
import TypedArray = NodeJS.TypedArray;
import { join } from 'path';
import { WorkerResponseInterface } from '../src/types';
import faker from 'faker';

type Resolve<T> = (value?: T | PromiseLike<T>) => void;
type Reject = (reason?: unknown) => void;

const workerExecutable = readFileSync(join(process.cwd(), 'src', 'worker.ts')).toString('utf8');
const setPersistentContextInWorker = (workerExecutable: string) => (fn?: Function): string =>
  workerExecutable.replace(
    '__persistent_context_initialization__',
    Boolean(fn) ? fn.toString() : 'function () { return; }',
  );

const setPersistentContext = setPersistentContextInWorker(workerExecutable);
const createWorker = (workerScript: string): Worker => new Worker(workerScript, { eval: true });
const handleMessageFromWorker = <T>(resolve: Resolve<T>, reject: Reject) => (
  event: TypedArray,
): void => {
  const { error, data } = deserialize(event) as WorkerResponseInterface<T>;
  if (error) reject(error);
  resolve(data);
};
const catchWorkerExit = reject => (code): void => {
  if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
};
const initJob = (worker: Worker) => <T>(
  handler: Function,
  ctx = {},
  data = undefined,
): Promise<T> =>
  new Promise((resolve, reject) => {
    worker.on('message', handleMessageFromWorker<T>(resolve, reject));
    worker.on('exit', catchWorkerExit(reject));
    setImmediate(() => {
      worker.postMessage(
        serialize({
          handler: handler.toString(),
          config: {
            ctx,
            data,
          },
        }),
      );
    });
  });

describe('Worker test', () => {
  it('should be computed in the worker', async () => {
    const worker = createWorker(
      setPersistentContext(() => {
        this.from_content_execute = 100;
      }),
    );
    const job = initJob(worker);
    const result = await job<number>(
      async (data: unknown): Promise<number> => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        return data + from_global_context + from_content_execute;
      },
      { from_global_context: 100 },
      100,
    );

    try {
      await worker.terminate();
      expect(result).toBeDefined();
      expect(result).toEqual(300);
    } catch (e) {
      worker.terminate();
      console.error(e);
      throw e;
    }
  });

  it('should be throw correct error message', async () => {
    const worker = createWorker(setPersistentContext());
    const job = initJob(worker);

    const errorMessage = faker.hacker.phrase();

    try {
      await job(
        () => {
          throw new Error(errorMessage);
        },
        { errorMessage },
      );
    } catch (e) {
      expect(e.message).toEqual(errorMessage);
    }
    worker.terminate();
  });

  it('should be throw correct error message while overlap the persistent context', async () => {
    const fn = (): void => {
      this.foo = undefined;
    };
    const worker = createWorker(setPersistentContext(fn));
    const job = initJob(worker);

    try {
      await job(
        () => {
          return;
        },
        { foo: undefined },
      );
    } catch (e) {
      expect(e.message).toEqual("The transferred context shouldn't overlap the persistent context");
    }
    worker.terminate();
  });
});
