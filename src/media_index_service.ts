import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const onboardingBody = z.object({ tenantId: z.string().min(1), bucket: z.string().min(3) });
export const uploadBody = z.object({ tenantId: z.string().min(1), filename: z.string().min(1), file: z.string().min(1) });
export type ImageRecord = { tenantId: string; filename: string; width: number; height: number; format: string; decision: "indexed" | "review" };

export function decideIndex(metadata: { width?: number; height?: number; format?: string }): ImageRecord["decision"] {
  return metadata.width && metadata.height && metadata.format ? "indexed" : "review";
}

export class MediaLibraryService {
  private client: InfraiClient;
  private lifecycle = new Map<string, "active" | "suspended">();
  constructor(client: InfraiClient) { this.client = client; }

  async onboard(input: unknown) {
    const body = onboardingBody.parse(input);
    await this.client.createBucket(body.bucket);
    this.lifecycle.set(body.tenantId, "active");
    return { tenantId: body.tenantId, bucket: body.bucket, status: "active" as const };
  }

  suspendAccount(tenantId: string) { this.lifecycle.set(tenantId, "suspended"); return { tenantId, status: "suspended" as const }; }

  async indexUpload(input: unknown): Promise<ImageRecord> {
    const body = uploadBody.parse(input);
    if (this.lifecycle.get(body.tenantId) !== "active") throw new Error("tenant must be active");
    const uploaded = await this.client.upload(body.file, body.filename);
    const metadata = await this.client.metadata({ image_id: uploaded.image_id });
    return { tenantId: body.tenantId, filename: body.filename, width: metadata.width ?? 0, height: metadata.height ?? 0, format: metadata.format ?? "unknown", decision: decideIndex(metadata) };
  }
}
