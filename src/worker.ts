/* eslint-disable @typescript-eslint/no-var-requires */
const { parentPort } = require('worker_threads');
const { createContext, runInContext } = require('vm');
const { deserialize, serialize } = require('v8');
const crypto = require('crypto');

const isObject = obj => {
  const type = typeof obj;
  return type === 'function' || (type === 'object' && !!obj);
};

// declare object for vmContext
const context = {};

// declare context property where we going to compute your messages
const computeIdVariable = crypto.randomBytes(16).toString('hex');
context[computeIdVariable] = undefined;

// we going to initialize our worker persistent context which we want used to compute your messages
const vmContext = createContext(context);
runInContext(`(__persistent_context_initialization__)();`, vmContext);

parentPort.on('message', async message => {
  const { handler, config } = deserialize(message);
  const response = {
    error: undefined,
    data: undefined,
  };

  try {
    const stringifiedContext = JSON.stringify(config.ctx);

    if (
      isObject(config.ctx) &&
      Object.keys(config.ctx).some(property => vmContext.hasOwnProperty(property))
    ) {
      throw new Error("The transferred context shouldn't overlap the persistent context");
    }

    const contextInitialize = data => {
      Object.keys(data).forEach(key => {
        this[key] = data[key];
      });
    };
    const clearContext = data => {
      Object.keys(data).forEach(key => {
        Reflect.deleteProperty(this, key);
      });
    };
    if (config.ctx) {
      runInContext(`(${contextInitialize.toString()})(${stringifiedContext})`, vmContext);
    }

    const script = `this['${computeIdVariable}'] = (${handler})(${JSON.stringify(config.data)});`;
    runInContext(script, vmContext, { displayErrors: true });
    response.data = await vmContext[computeIdVariable];

    if (config.ctx) {
      runInContext(`(${clearContext.toString()})(${stringifiedContext})`, vmContext);
    }

    Reflect.deleteProperty(context, computeIdVariable);
  } catch (e) {
    response.error = e;
  }

  try {
    parentPort.postMessage(serialize(response));
    Reflect.deleteProperty(response, 'data');
    Reflect.deleteProperty(response, 'error');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
