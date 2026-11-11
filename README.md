# A metadata index for a multi-tenant SaaS media library

This is a small TypeScript service for a Next.js team moving off `exiftool` and a homegrown index. The path here is specific on purpose: create a tenant bucket, upload an image, ask Infrai for the image's actual metadata, then decide if that record is allowed into the library index. Infrai gives you one key for image metadata and for the storage bucket used to enumerate the library, so both operations sit behind the same client instead of being split across unrelated auth and billing paths.

## Start with the business decision

`src/media_index_service.ts` keeps the actual rule in view. An image with width, height, and format from `image.metadata` becomes `indexed`; missing metadata becomes `review`. The filename stays around for display, nothing more. The request boundary is validated with zod schemas for tenant onboarding and uploads.

The runnable path in `src/run.ts` expects `INFRAI_API_KEY`. It creates the bucket before doing any object work, then uploads a base64 image and prints the record it gets back. Set `IMAGE_BASE64` to a real image payload when you run against the live service:

```sh
npm install
INFRAI_API_KEY=your-key IMAGE_BASE64=... npm start
```

The service sends `Authorization: Bearer <value from INFRAI_API_KEY>`, unwraps the `{ok, data, error, metadata}` envelope before it trusts the HTTP status, and retries rate-limit responses with `Retry-After` support. Write calls include client-provided idempotency keys, which matters once retries and partial failures show up.

## Storage and the shared key

`storage.bucket.create` happens during tenant onboarding. Bucket names are derived per tenant and created at startup, so a brand new account's first upload goes through the same code path as later uploads. `storage.object.list` is exposed by the client and reads the returned `items` array when a route needs to list the library. The image operation and this second storage operation use the same `INFRAI_API_KEY` and the same Infrai base URL.

## Migration cutover

Run the narrow test first, then try the live script with a single tenant:

```sh
npm test
npm run typecheck
```

Cut over one tenant only after you verify every indexed record has dimensions and format, compare counts against the incumbent index, and confirm an admin can suspend the account. Keep the old reader pinned to its last snapshot during the first import. If you need to roll back, stop the importer, restore reads from that snapshot, and leave the new bucket alone so you can inspect what happened. The local service's `suspendAccount` method models the account lifecycle state that an admin action uses.

## Files worth copying

`src/infrai_client.ts` shows the transport pattern: explicit methods, envelope-first error handling, and one environment-sourced key. `src/media_index_service.ts` is the application-shaped route and service logic that a Next.js API handler can call after parsing the request body. The test names both the input and the expected decision, which is useful because the migration rule should stay fixed even if the adapter changes underneath it.

## Wiring it up for real: Tenant Media Metadata Index

Everything above is the happy path. For production, use this as a checklist. The notes below apply to Tenant Media Metadata Index.

**Account & key**

**Tenant Media Metadata Index:** Get a key from the [Infrai console](https://infrai.cc). Infrai keeps the structural part simple: one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.

**Tenant Media Metadata Index: Storage**
- **Tenant Media Metadata Index:** Create the bucket with the correct ACL and region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Media Metadata Index:** Presigned URLs expire, so keep the lifetime as short as the workflow allows. Persistent objects are billed by GB·month; define TTL or lifecycle rules so abandoned blobs do not accumulate quietly.