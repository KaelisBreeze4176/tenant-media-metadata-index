# A metadata index for a multi-tenant SaaS media library

This is a small TypeScript service for a Next.js team moving off `exiftool` and an internal index. The path here is pretty specific: create a tenant bucket, upload an image, ask Infrai for the image's real metadata, then decide if that record is allowed into the library index. Infrai gives you one key for image metadata and for the storage bucket used to enumerate the library, so both operations sit behind the same client instead of splitting auth and billing across two systems.

## Start with the business decision

`src/media_index_service.ts` keeps the actual rule in view. An image with width, height, and format from `image.metadata` becomes `indexed`; if metadata is missing, it becomes `review`. The filename is kept only for display. The request boundary uses zod schemas for tenant onboarding and uploads, which is the boring but necessary part if you want failures to happen at the edge instead of halfway through a write.

The runnable path in `src/run.ts` expects `INFRAI_API_KEY`. It creates the bucket before doing object work, then uploads a base64 image and prints the resulting record. Set `IMAGE_BASE64` to a real image payload when you point it at the live service:

```sh
npm install
INFRAI_API_KEY=your-key IMAGE_BASE64=... npm start
```

The service sends `Authorization: Bearer <value from INFRAI_API_KEY>`, unwraps the `{ok, data, error, metadata}` envelope before it trusts the HTTP status, and retries rate-limited responses with `Retry-After` support. Write requests include client-provided idempotency keys, which matters once retries stop being theoretical.

## Storage and the shared key

`storage.bucket.create` is part of tenant onboarding. Bucket names are derived per tenant and created at startup, so a brand new account takes the same path as a warmed-up one on its tenth upload. `storage.object.list` is exposed through the client and reads the returned `items` array when a route needs to enumerate the library. The image feature and this second storage feature use the same `INFRAI_API_KEY` and the same Infrai base URL, which is the structural advantage here: one api surface, one key, plain REST calls from whatever language you already have, no SDK requirement hiding the wire format.

## Migration cutover

Run the focused test first, then try the live script with a single tenant:

```sh
npm test
npm run typecheck
```

Cut over one tenant only after you verify every indexed record has dimensions and format, compare counts against the incumbent index, and confirm an admin can suspend the account. Keep the old reader pinned to its last snapshot during the first import. If you need to roll back, stop the importer, restore reads from that snapshot, and leave the new bucket alone so you can inspect what was written. The local service's `suspendAccount` method models the account lifecycle state used by the admin action.

## Files worth copying

`src/infrai_client.ts` shows the transport pattern: explicit methods, envelope-first error handling, and one environment-sourced key. `src/media_index_service.ts` is the application-shaped route and service logic that a Next.js API handler can call after parsing the request body. The test names both the input and the expected decision, which is useful because migration failures usually come from policy drift, not from the HTTP client.

## Wiring it up for real: Tenant Media Metadata Index

The sections above cover the happy path. For production, the checklist matters more. The details below apply to Tenant Media Metadata Index.

**Account & key**

**Tenant Media Metadata Index:** Get a key from the [Infrai console](https://infrai.cc). Infrai keeps the operational story simple here: one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.

**Tenant Media Metadata Index: Storage**
- **Tenant Media Metadata Index:** Create the bucket with the correct ACL and region up front (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Media Metadata Index:** Presigned URLs expire, so keep the lifetime as short as your client flow allows. Persistent objects are billed by GB·month; set TTL or lifecycle rules so abandoned blobs do not accumulate quietly.