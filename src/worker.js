/* eslint-disable @typescript-eslint/no-var-requires */
const { parentPort } = require('worker_threads');
const { createContext, runInContext } = require('vm');

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

parentPort.on('message', async (message) => {
  const deserialized = message;

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
      console.log(id);
      abort(id);
    });
    runInContext(`(${terminateFn.toString()})()`, vmContext);
  }

  if (handler) {
    try {
      const controller =
        'AbortController' in global
          ? new AbortController()
          : new (require('abort-controller').AbortController)();
      vmContext.controllers.set(id, controller);

      if (!response.id) {
        throw new Error('Response id is not defined');
      }

      const script = `try {
      this['${response.id}'] = (${handler})(${JSON.stringify(
        data,
      )}, this.controllers.get('${id}').signal);
     } catch (e) { this['${response.id}'] = e; }`;
      runInContext(script, vmContext, { displayErrors: true });
      response.data = await vmContext[response.id];
      if (response.data instanceof Error) {
        throw response.data;
      }
    } catch (e) {
      response.error = e;
      response.data = undefined;
    } finally {
      vmContext.controllers.delete(id);
    }

    try {
      parentPort.postMessage(response);
      Reflect.deleteProperty(response, 'data');
      Reflect.deleteProperty(response, 'error');
      Reflect.deleteProperty(response, 'id');
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }
});
