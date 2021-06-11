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
- [Conventional commit](https://www.conventionalcommits.org/) knowledge

## Installation

`npm install @datapain/matte`

## Versioning

We use [SemVer](http://semver.org/) for versioning. 
