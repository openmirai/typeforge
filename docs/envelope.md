# Envelope modes

The generator inspects each operation’s success JSON schema and classifies the spec into one of three **envelope modes**. You do not set the mode in `source.ts`; it is inferred.

An object “looks like an envelope” when it has a `data`, `success`, or `message` field.

## shared

Every success response shares the same envelope object (for example `{ success, data, timestamp }`).

- Writes `generated/base.ts` with `BaseResponse<T>`.
- Per-operation response types unwrap `data`: `export type GETApiAcmeV3WidgetsResponse = BaseResponse<Widget[]>`.
- If `apiRoot/models.ts` already exports `BaseResponse<T>` and its fields differ from the spec, generate **fails** until you either update `models.ts` or run `accept-base`.

Synthetic fixture: `test/fixtures/specs/envelope-list.json` (`/api/acme/v3/widgets`).

## raw

Success bodies are not a shared envelope. Types are emitted as the spec schema, with **no** `BaseResponse` wrapper. Typical of cursor-style list payloads.

Synthetic fixture: `test/fixtures/specs/raw-cursor-list.json` (`/api/orbit/v1`).

## mixed

Some operations return an envelope with `data`; others return a plain object. Mixed mode:

1. Writes `generated/base.ts` from the **largest envelope group that includes `data`**.
2. Operations whose success schema has a `data` property use `BaseResponse<Unwrapped>`.
3. Operations without `data` keep the raw schema (no unwrap).

Example from `test/fixtures/specs/mixed-envelope.json`:

| Operation | Success body | Generated response |
| --- | --- | --- |
| `GET /api/acme/v3/widgets` | `{ success, data, timestamp }` | `BaseResponse<string[]>` |
| `GET /api/acme/v3/plain/{token}` | `{ token, caption }` | `{ token: string; caption?: string }` |

Callers still return the HTTPFetch `{ data }` payload (the transport wrapper), not a TypeScript `as` cast. Envelope unwrap is a **type** concern: `TResponse` is `BaseResponse<T>` or the raw body, depending on the operation.

## accept-base

`openapi-codegen accept-base --source atlas` regenerates `generated/base.ts` and rewrites `BaseResponse` in `models.ts` to match the spec. Use it when the envelope shape in the spec is the source of truth and `models.ts` is stale. Do not combine with `--check`.
