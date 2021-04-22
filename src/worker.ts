/* eslint-disable @typescript-eslint/no-var-requires */
const { parentPort } = require('worker_threads');
const { createContext, runInContext } = require('vm');
const { deserialize, serialize } = require('v8');
const crypto = require('crypto');

const isObject = (obj) => {
  const type = typeof obj;
  return type === 'function' || (type === 'object' && !!obj);
};

// eslint-disable-next-line
// @ts-ignore
const persistentContext = __persistent_context_data__;

// declare object for vmContext
const context = {
  console,
  require,
  Buffer,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  setImmediate,
};

// we going to initialize our worker persistent context which we want used to compute your messages
const vmContext = createContext(context);
// eslint-disable-next-line
// @ts-ignore
const persistentContextFn = __persistent_context_initialization__;
runInContext(
  `(${persistentContextFn.toString()})(${
    typeof persistentContext !== 'string' ? JSON.stringify(persistentContext) : persistentContext
  });`,
  vmContext,
);

parentPort.on('message', async (message) => {
  const deserialized = deserialize(message);
  const config = deserialized.config ? deserialized.config : { ctx: {}, data: undefined };
  const handler = deserialized.handler;

  const response = {
    error: undefined,
    data: undefined,
    id: deserialized.id,
  };

  try {
    const stringifiedContext = JSON.stringify(config.ctx);

    if (
      isObject(config.ctx) &&
      Object.keys(config.ctx).some((property) => vmContext.hasOwnProperty(property))
    ) {
      throw new Error("The transferred context shouldn't overlap the persistent context");
    }

    const contextInitialize = (data) => {
      Object.keys(data).forEach((key) => {
        this[key] = data[key];
      });
    };
    const clearContext = (data) => {
      Object.keys(data).forEach((key) => {
        Reflect.deleteProperty(this, key);
      });
    };
    if (config.ctx) {
      runInContext(`(${contextInitialize.toString()})(${stringifiedContext})`, vmContext);
    }

    if (!response.id) {
      throw new Error('Response id is not defined');
    }

    const script = `try {
      this['${response.id}'] = (${handler})(${JSON.stringify(config.data)});
     } catch (e) { this['${response.id}'] = e; }`;
    runInContext(script, vmContext, { displayErrors: true });
    response.data = await vmContext[response.id];
    if (response.data instanceof Error) {
      throw response.data;
    }

    if (config.ctx) {
      runInContext(`(${clearContext.toString()})(${stringifiedContext})`, vmContext);
    }

    Reflect.deleteProperty(context, response.id);
  } catch (e) {
    response.error = e;
  }

  try {
    parentPort.postMessage(serialize(response));
    Reflect.deleteProperty(response, 'data');
    Reflect.deleteProperty(response, 'error');
    Reflect.deleteProperty(response, 'id');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
