# Matte

Matte is an implementation a thread pool pattern for node.js

![Thead pool description image](https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Thread_pool.svg/800px-Thread_pool.svg.png)

As we know Node.js is asynchronous but some features stay synchronous. The matte solution can help you to avoid blocking your main thread and compute sync things in another Event loop.

## Built with

* [Node.js](https://nodejs.org/en/) - Platform
* [Typescript](https://www.typescriptlang.org/) - typed superset of JavaScript that compiles to plain JavaScript

## Prerequisites

- Node.js 11.12.0+
- [Typescript](https://www.typescriptlang.org/) knowledge
- [Conventional commit](https://www.conventionalcommits.org/) knowledge

## Installation

`npm install @datapain/matte`

## Usage

```typescript
import { WorkerPool, QueueType } from '@datapain/matte';

const pool = new WorkerPool({
  queueType: QueueType.PRIORITY, // or QueueType.FIFO; default is QueueType.PRIORITY
  maxWorkers: 4, // by default used cpus length
  worker: {
    resourceLimits: { // by default used native worker limits
      maxOldGenerationSizeMb: 64,
      maxYoungGenerationSizeMb: 16,
      codeRangeSizeMb: 4,
    }
    timeout: 1000, // by default is 3000 ms
    executable: './path/to/your/Worker-file', // by default used matte implimentation
  },
  persistentContextFn: () => {
    this.GLOBAL_CONTEXT = 'MATTE IS';
  },
});

new Promise((resolve, reject) => pool.add({
  resolve,
  reject,
  handler: (data) => GLOBAL_CONTEXT + MESSAGE_CONTEXT + data,
  config: {
    data: 'AWESOME',
    ctx: {
      MESSAGE_CONTEXT: ' ',
    }
  }
});
```

## Versioning

We use [SemVer](http://semver.org/) for versioning. 
