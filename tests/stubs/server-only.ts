/**
 * tests/stubs/server-only.ts — no-op stand-in for the `server-only` package.
 *
 * The real `server-only` module throws if it is bundled into a Client
 * Component, which is exactly the guarantee we want in the app. Under Vitest
 * (plain Node, no RSC graph) that throw is irrelevant noise, so vitest.config
 * aliases `server-only` to this empty module. The production guarantee is
 * unaffected: `next build` still fails if a `server-only` module is pulled into
 * client code.
 */

export {};
