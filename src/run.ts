import { InfraiClient } from "./infrai_client.ts";
import { MediaLibraryService } from "./media_index_service.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running the example");
const tenantId = process.env.TENANT_ID ?? "acme-demo";
const bucket = process.env.MEDIA_BUCKET ?? `media-${tenantId}`;
const service = new MediaLibraryService(new InfraiClient(key));
await service.onboard({ tenantId, bucket });
const result = await service.indexUpload({ tenantId, filename: "hero.png", file: process.env.IMAGE_BASE64 ?? "base64-image-data" });
console.log(JSON.stringify(result, null, 2));
