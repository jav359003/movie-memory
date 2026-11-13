# Architecture and decision record

This document explains how Movie Memory works, why each boundary exists, and what happens during success and failure paths. The README remains the setup and submission overview; this is the deeper engineering walkthrough.

## 1. System shape

Movie Memory is a Next.js monolith. Pages, API routes, authentication, and database access live in one deployable application, but code is separated by trust boundary and responsibility.

```text
Untrusted browser
  |
  | HTTP(S) + Auth.js session cookie
  v
Next.js application
  |
  |-- Server Components: redirects and initial reads
  |-- Route Handlers: authenticated HTTP contract
  |-- Auth.js: Google OAuth and session resolution
  |-- Zod: input validation
  |-- Prisma: typed persistence
  `-- OpenAI SDK: server-only fact generation
         |
         +-----------------------> OpenAI API
         |
         `-----------------------> PostgreSQL
```

The browser is always treated as untrusted. TypeScript improves developer correctness, but it does not authenticate a request or validate runtime data. Those checks happen again on the server.

## 2. Module responsibilities

| Module | Responsibility | Why it is separate |
| --- | --- | --- |
| `auth.ts` | Google provider, Prisma adapter, session user ID | One source of authentication configuration |
| `app/page.tsx` | Signed-out landing and post-login routing | Redirect decisions happen before UI is sent |
| `app/onboarding/page.tsx` | Protect first-time-only onboarding | Prevents returning users from repeating onboarding |
| `app/dashboard/page.tsx` | Protected profile and initial fact query | Keeps database reads on the server |
| `components/dashboard-client.tsx` | Edit, cache, refresh, loading, rollback state | Browser-only interaction is contained in one place |
| `lib/contracts.ts` | Transport DTOs and error body | Server and client share the same vocabulary |
| `lib/api.ts` | Fetch and normalized `ApiError` | No component reimplements HTTP error parsing |
| `lib/fact-cache.ts` | TTL storage and in-flight client request reuse | Cache mechanics remain testable without rendering UI |
| `lib/validation.ts` | Runtime movie-title schema | Route logic stays focused on orchestration |
| `lib/http.ts` | Standard error responses | Handled application errors share one failure shape |
| `lib/openai.ts` | Prompt and response validation | API key and provider SDK remain server-only |
| `lib/prisma.ts` | Prisma client lifecycle | Avoids connection churn during development reloads |

## 3. Authentication and navigation

### First login

```text
GET /
  -> auth() finds no session
  -> render landing page
  -> Continue with Google
  -> Auth.js redirects to Google
  -> Google redirects to /api/auth/callback/google
  -> Prisma adapter creates User/Account/Session
  -> return to /
  -> root page finds session but no favoriteMovie
  -> redirect /onboarding
```

### Returning login

The same root-page check finds a non-empty `favoriteMovie` and redirects to `/dashboard`.

### Direct protected navigation

Both `/onboarding` and `/dashboard` call `auth()` on the server. If the session is missing, they redirect to `/`. This server-side guard avoids a client-rendered flash of protected content.

The session callback copies the adapter's database user ID into `session.user.id`. Route handlers use that stable internal ID rather than email or a client-provided field.

## 4. Data model rationale

### Auth.js tables

- `User` stores the profile synchronized from Google plus `favoriteMovie`.
- `Account` associates the user with the Google provider identity.
- `Session` stores database-backed sessions.
- `VerificationToken` is part of the adapter-compatible schema even though this flow currently uses Google OAuth.

### Application table

`MovieFact` stores:

- `userId`: ownership and relation to `User`;
- `movieTitle`: title snapshot at generation time;
- `content`: generated plain text; and
- `createdAt`: ordering and cache-window calculation.

The title is intentionally stored on each fact. Suppose a user changes from `Arrival` to `Heat`. If facts only referred to `User.favoriteMovie`, every old Arrival fact would appear to belong to Heat after the update. The snapshot preserves historical meaning.

The compound index `(userId, movieTitle, createdAt)` supports the important read: newest facts for this user and this movie. The dashboard performs that filter in PostgreSQL rather than fetching unrelated facts and filtering in JavaScript.

The relation uses `onDelete: Cascade`, so deleting a user cannot leave orphaned facts, accounts, or sessions.

### Why `favoriteMovie` is a string

The assignment asks for a favorite movie title, not a normalized movie catalog. A separate `Movie` table would require identity matching, duplicate-title handling, release-year metadata, and likely a third-party movie API. That would add complexity outside the evaluated scope. The current model keeps the input honest: it is the user's chosen title.

## 5. HTTP API design

### Shared success types

The browser and route handlers share DTOs from `lib/contracts.ts`. Database `Date` values are serialized to ISO strings before crossing the HTTP boundary.

### Shared error type

Every handled API failure follows:

```ts
type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    issues?: Record<string, string[]>;
  };
};
```

The code is stable for program logic, the message is safe for users, and `issues` can carry field-level validation details. The client converts this body into an `ApiError`. If a proxy or unexpected server failure returns non-JSON, the client still raises `UNKNOWN_ERROR` with the HTTP status.

### `GET /api/me`

1. Resolve the server session.
2. Return 401 before any database call if it is absent.
3. Query by `session.user.id`.
4. Return only profile fields required by the product.

### `PUT /api/me/movie`

1. Resolve the server session.
2. Parse JSON safely; malformed JSON becomes invalid input rather than an exception leak.
3. Run the Zod schema.
4. Trim and validate 1-120 characters.
5. Update the row identified by `session.user.id`.
6. Return the canonical stored profile.

There is no `userId` in the request body or URL, so the caller has no ownership selector to tamper with.

### `GET /api/fact`

1. Resolve the server session.
2. Read the current movie from the authenticated user's row.
3. Return `409 MOVIE_REQUIRED` if onboarding is incomplete.
4. For a normal request, check the newest fact inside the 30-second policy window.
5. If no recent fact exists, share any in-flight request for the same user/movie or create one.
6. Call OpenAI, reject empty provider output, and persist the result.
7. Serialize `createdAt` and return the fact.

With `?refresh=1`, step 4 is deliberately skipped because the user explicitly requested a new fact.

## 6. Fact-generation pipeline

```text
Dashboard needs a fact
  |
  v
Read localStorage entry
  |
  +-- fresh (<30s) ------------------------------> render it
  |
  `-- absent/expired
          |
          v
      GET /api/fact
          |
          v
      authenticate + load favorite movie
          |
          v
      recent persisted fact?
          |
          +-- yes -------------------------------> return it
          |
          `-- no
                |
                v
          existing in-flight promise?
                |
                +-- yes -------------------------> await it
                |
                `-- no -> OpenAI -> INSERT -> return
```

After a successful response, the browser writes the result to local storage and inserts it at the front of recent facts without duplicating the same fact ID.

### Why both client and server reuse exist

The required behavior is client-side caching. The server-side check is a narrow safety layer for cases where two browser contexts request before either has written local storage, or React development behavior starts the same load twice.

This does not turn the implementation into Variant A. The primary design and evaluated behavior remain the Variant B typed client, UI state transitions, cache invalidation, and rollback. The server reuse is a cost/correctness guard, not a claimed distributed caching system.

## 7. Client cache semantics

### Identity

Keys include both `userId` and a normalized title. This prevents a shared browser from showing User A's cached fact to User B and prevents an Arrival fact from being reused for `Heat`.

Normalization trims the title and lowercases it, so `Arrival` and ` arrival ` address the same logical entry.

### Time boundary

The entry is valid only when:

```text
now - cachedAt < 30,000 ms
```

At exactly 30,000 ms it expires. The boundary is explicit and covered by a test at `TTL - 1` and `TTL`.

### Invalid JSON

Local storage is client-controlled. Parsing is wrapped in `try/catch`; corrupt data is removed and treated as a miss.

### Explicit refresh

The client clears the entry, passes `refresh=1`, and writes the new result. If refresh fails while an older fact is visible, that fact stays on screen and is written back with a new cache timestamp so a temporary provider failure does not destroy usable UI state.

## 8. Optimistic movie edit

### Why optimistic

The title changes immediately, which makes a small update feel responsive. The server remains authoritative: the response supplies the canonical stored value.

### Success path

```text
submit draft
  -> trim and reject empty/unchanged input locally
  -> snapshot old movie/fact/history
  -> show new title immediately
  -> clear stale fact/history and both relevant cache keys
  -> PUT /api/me/movie
  -> accept returned title
  -> force generation for the saved title
```

### Failure path

```text
PUT fails
  -> restore old movie
  -> restore old draft
  -> restore current fact
  -> restore recent facts
  -> write the previous fact back with a new cache timestamp
  -> reopen edit mode
  -> announce the error beside the form
```

The snapshots are necessary because multiple pieces of UI state depend on the movie. Rolling back only the heading would leave fact content and cache state inconsistent.

### Stale-response protection

`activeMovieRef` records which movie is currently authoritative in the UI. A slow response for an old movie may still complete, but it is not allowed to overwrite the active movie's state.

## 9. Failure matrix

| Failure | Server behavior | Client behavior |
| --- | --- | --- |
| No session | `401 UNAUTHORIZED` or page redirect | User returns to landing/sign-in |
| Empty/too-long title | `400 INVALID_MOVIE` with field issues | Preserve input and show message |
| No favorite movie | `409 MOVIE_REQUIRED` | User can return to onboarding |
| OpenAI error/timeout | Log provider failure, return normalized 502 | Show retry; preserve an existing fact |
| Empty OpenAI output | Treat as generation failure | Same recoverable state |
| Invalid local cache JSON | Remove entry | Fetch a valid fact |
| Movie update failure | No committed client assumption | Complete optimistic rollback |
| Missing Google photo | No error | Render initials fallback |
| Missing Google name | No error | Email local part, then `Movie fan` |

## 10. Concurrency reasoning

There are two in-flight maps:

- the client map coalesces simultaneous loads for one local cache key; and
- the server map coalesces simultaneous normal requests for one authenticated user/movie.

Both promises are removed in `finally`, so a rejected request cannot permanently poison a key.

The limitation is important: the server map exists only in one JavaScript process. Two serverless instances can still generate simultaneously. A distributed production design could use:

- a PostgreSQL advisory lock;
- a unique generation-window key and conflict retry; or
- Redis `SET NX` with an expiration.

The current choice is proportional to a small take-home and is documented rather than overstated.

## 11. UI-state design

The fact surface has four meaningful modes:

1. **Initial loading:** labelled skeleton; no false content.
2. **Ready:** fact and explicit generation action.
3. **Refreshing:** keep current content visible, lower its emphasis, disable duplicate generation.
4. **Error/empty:** explain what happened and provide a next action.

Movie-save errors and fact-generation errors are separate state values because they have different recovery locations. Combining them would place a save error inside the fact panel and make the recovery unclear.

Focus rings are global and visible. Buttons expose disabled states, form errors use `role="alert"`, loading uses `role="status"`, and animation respects reduced-motion preferences.

## 12. Test strategy

The test suite follows the architecture instead of testing implementation trivia.

### Cache unit tests

- same logical key shares an in-flight load;
- the cache is fresh at 29,999 ms; and
- the cache is expired at 30,000 ms.

### API client tests

- structured 401 errors retain status/code/message;
- non-JSON 500 errors still normalize safely; and
- explicit refresh adds the correct query parameter.

### Component tests

- the optimistic title appears before the PUT resolves;
- success keeps the new title;
- failure restores edit mode, old value, fact list, and cache;
- a fresh local cache avoids the API; and
- a failed initial load exposes a working retry.

### Route-handler tests

- unauthenticated requests stop before database access;
- invalid input stops before database writes;
- OpenAI failure becomes a stable 502 error;
- simultaneous normal fact requests share one provider call; and
- explicit refresh bypasses recent-fact reuse.

External Google, PostgreSQL, and OpenAI services are not contacted in unit tests. Those boundaries are mocked so the tests are deterministic. The production build verifies TypeScript and framework integration; the live local flow verifies the configured services together.

## 13. Alternatives considered

### Server actions instead of route handlers

Server actions would reduce HTTP boilerplate, but they would hide the typed endpoint layer explicitly requested by Variant B. Route handlers make status codes and contracts inspectable.

### React Query or SWR

Either could manage caching, retries, and invalidation, but this app has one cached read and one mutation. The custom module is smaller than the configuration and makes the exact 30-second rule easy to test.

### Normalize movies into their own table

That would be appropriate with a trusted catalog and stable movie IDs. Without one, a `Movie` table would pretend user-entered strings are canonical and add unresolved deduplication problems.

### Trust the optimistic value after PUT

The UI could keep the draft without reading the response, but the server performs trimming and is authoritative. Accepting the returned value keeps both sides aligned.

## 14. Review summary

If explaining the architecture briefly, emphasize these points:

1. Application data ownership is always derived from the authenticated server session.
2. The schema preserves fact history by snapshotting the movie title.
3. The typed API layer creates one success/error vocabulary for the UI.
4. The 30-second cache is scoped by user and movie with an exact tested boundary.
5. Optimistic editing snapshots and restores every dependent state value.
6. Loading and failure states preserve usable content and provide recovery.
7. Process-local coalescing is useful but honestly documented as non-distributed.
