import { handleRequest } from './broker.js';

export default {
  fetch: (request, env) => handleRequest(request, env),
};
