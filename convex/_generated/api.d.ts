/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as aiService from "../aiService.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as chatQueriesAndMutations from "../chatQueriesAndMutations.js";
import type * as constants from "../constants.js";
import type * as filePreview from "../filePreview.js";
import type * as http from "../http.js";
import type * as router from "../router.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiService: typeof aiService;
  auth: typeof auth;
  chat: typeof chat;
  chatQueriesAndMutations: typeof chatQueriesAndMutations;
  constants: typeof constants;
  filePreview: typeof filePreview;
  http: typeof http;
  router: typeof router;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
