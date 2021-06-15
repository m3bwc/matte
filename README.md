# Matte

Matte is an implementation a thread pool pattern for node.js

![Thead pool description image](https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Thread_pool.svg/800px-Thread_pool.svg.png)

As we know Node.js is asynchronous but some features stay synchronous. The matte solution can help you to avoid blocking your main thread and compute sync things in another Event loop.
## Features
- Easy to use
- Task timeouts
- Cancellable tasks
- Autorestart worker when they fall
- Can be filled by your inline functions
- All your handlers are covered by VM context
- You can parallel tasks in one worker or workers group
- Leverage all CPU cores
- Async workers
- Very small package
- ts-results compatible
- rxjs compatible

## Built with

* [Node.js](https://nodejs.org/en/) - Platform
* [Typescript](https://www.typescriptlang.org/) - typed superset of JavaScript that compiles to plain JavaScript

## Prerequisites

- Node.js 12.x+
- [Typescript](https://www.typescriptlang.org/) knowledge

## Installation

`npm install @datapain/matte`

## Usage

First of all, let's look at a basic example where we want to execute some Math operation:

### Basic math operation

```typescript
import assert from 'assert';
import { WorkerPool } from '@datapain/matte';

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
      pool.terminate();
    },
  });
});
```
### Task abortion
The next example will describe how we able to abort some tasks:
```typescript
import assert from 'assert';
import { WorkerPool } from '@datapain/matte';
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

```

### Predefined context functions
```typescript
import assert from 'assert';
import { WorkerPool } from '../src';

const pool = new WorkerPool();

pool
  .init({
    workers: { timeout: 100 },
    fn: {
      context: () => {
        this.pow = ({ x, y }) => { // this - because it will been run in the VM context
          return Math.pow(x, y);
        };
      },
    },
  })
  .catch(console.error);

pool.once('ready', () => {
  pool
    .process<undefined, unknown>({
      handler: () => {
        return pow({x:2, y:2});
      },
      callback: (result) => {
        result.map(res => assert.strictEqual(res, 4));
        pool.terminate();
      },
    })
    .andThen((id) => pool.abort(id));
});

```

## Versioning

We use [SemVer](http://semver.org/) for versioning. 
