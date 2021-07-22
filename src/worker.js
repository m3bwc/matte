/* eslint-disable @typescript-eslint/no-var-requires */
const { parentPort } = require('worker_threads');
const { createContext, runInContext } = require('vm');
const { deserialize, serialize } = require('v8');

const persistentContext = __persistent_context_data__;

const context = {
  console,
  require,
  Error,
  Buffer,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  setImmediate,
  controllers: new Map(),
  processing: new Map(),
};

const vmContext = createContext(context);
const persistentContextFn = __persistent_context_initialization__;
const terminateFn = __terminate_context_initialization__;

runInContext(
  `(${persistentContextFn.toString()})(${
    typeof persistentContext !== 'string' ? JSON.stringify(persistentContext) : persistentContext
  });`,
  vmContext,
);

const abortFunction = (context) => (id) => {
  const controller = context.controllers.get(id);
  if (controller) controller.abort();
};

const abort = abortFunction(vmContext);

parentPort.on('message', (message) => {
  setImmediate(async () => {
    const deserialized = deserialize(message);

    const { handler, data, id } = deserialized;

    const response = {
      error: undefined,
      data: undefined,
      id,
    };

    if (deserialized.event === 'abort' && deserialized.id) {
      abort(deserialized.id);
    }

    if (deserialized.event === 'terminate') {
      Array.from(vmContext.controllers.keys()).forEach((id) => {
        abort(id);
      });
      runInContext(`(${terminateFn.toString()})()`, vmContext);
    }

    if (handler) {
      let controller;
      try{
         controller =
          'AbortController' in global
            ? new AbortController()
            : new (require('abort-controller').AbortController)();

      } catch(e) {
        controller = { signal: undefined, abort: () => {} }
      } finally {
        vmContext.controllers.set(id, controller);
      }

      try {
        if (!response.id) {
          throw new Error('Response id is not defined');
        }

        const script = `
        try {
          processing.set('${response.id}', (${handler})(${JSON.stringify(data)}, this.controllers.get('${id}').signal));
        } catch (e) {
          processing.set('${response.id}', e);
        }`;
        runInContext(script, vmContext, { displayErrors: true });
        response.data = await vmContext.processing.get(response.id);
        if (response.data instanceof Error) {
          throw response.data;
        }
      } catch (e) {
        response.error = e;
        response.data = undefined;
      }

      try {
        parentPort.postMessage(serialize(response));
      } catch (e) {
        console.error(e);
        process.exit(1);
      } finally {
        vmContext.controllers.delete(id);
        vmContext.processing.delete(response.id);
        Reflect.deleteProperty(response, 'data');
        Reflect.deleteProperty(response, 'error');
        Reflect.deleteProperty(response, 'id');
      }
    }
  });
});
