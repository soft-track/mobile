import Axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

import { getInstanceUrl } from '@/api/instance';
import { getAccessToken, signalUnauthorized } from '@/auth/session';

/**
 * The shared HTTP client, and the mutator Orval generates against.
 *
 * A port of `frontend/src/api/client.ts` with the three changes a mobile client
 * needs. Read that file alongside this one; the contract is otherwise identical.
 */

/**
 * Routes where a 401 is an answer rather than an expired session.
 *
 * `POST /auth/login` returns 401 "Incorrect email or password"
 * (`backend/lib_identity/identity.py:181`), so without this guard every failed
 * sign-in would clear the session and bounce the router. The web gets away with
 * no explicit list because its redirect is guarded by "am I already on /login".
 */
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/config', '/health'];

export const AXIOS_INSTANCE = Axios.create({ timeout: 15000 });

AXIOS_INSTANCE.interceptors.request.use((config) => {
  // Resolved per request rather than baked into the instance. This is what makes
  // "works against any instance" true, and it is the whole of issue #15's
  // instance switch -- do not hoist it onto Axios.create.
  config.baseURL = getInstanceUrl() ?? undefined;

  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // React Native's URLSearchParams encodes correctly but defines no
  // Symbol.toStringTag, so axios's isURLSearchParams check -- which goes through
  // Object.prototype.toString -- does not recognise it and JSON.stringifies the
  // body instead. Orval emits a URLSearchParams for /auth/login, so serialising
  // it here is the difference between signing in and a 422 on every attempt.
  if (config.data instanceof URLSearchParams) {
    config.data = config.data.toString();
  }

  return config;
});

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    const isPublic = PUBLIC_PATHS.some((path) => url.startsWith(path));
    if (error.response?.status === 401 && !isPublic) {
      signalUnauthorized();
    }
    return Promise.reject(error);
  },
);

/**
 * Orval's axios mutator contract: takes an AxiosRequestConfig, returns a
 * cancellable promise resolving to the response data.
 */
export const apiClient = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({ ...config, cancelToken: source.token }).then(
    ({ data }) => data,
  ) as Promise<T> & { cancel: () => void };
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };
  return promise;
};

export default apiClient;
