import { router } from 'expo-router';

/**
 * A path the router will accept that is only known at runtime.
 *
 * `experiments.typedRoutes` narrows `Href` to a union of the routes that exist
 * on disk, which is exactly what you want for a literal like `/register`. It
 * cannot describe a path assembled at runtime -- a replayed deep link, an
 * invite token, a team key -- so those need one explicit widening, in one
 * place, rather than an `as never` at every call site.
 *
 * Note the route types are written by the dev server, not by `expo export`, so
 * outside `expo start` the union is absent and every path typechecks anyway.
 */
export function href(path: string): Parameters<typeof router.push>[0] {
  return path as Parameters<typeof router.push>[0];
}
