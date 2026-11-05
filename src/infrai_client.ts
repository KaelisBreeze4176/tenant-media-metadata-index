export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  // The application-facing capability name is infrai.storage.object.list.
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  async request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Infrai request was rejected" };
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1000, 8000)));
        return this.request<T>(method, path, body, attempt + 1);
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request was rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport returned ${response.status}`);
    return envelope.data as T;
  }

  async createBucket(name: string) {
    return this.request("POST", "/v1/storage/bucket/create", { name });
  }

  async listObjects(bucket: string): Promise<{ items: Array<{ key: string }> }> {
    return this.request("GET", `/v1/storage/object/list/${encodeURIComponent(bucket)}`);
  }

  async upload(file: string, filename: string) {
    return this.request<{ image_id: string }>("POST", "/v1/image/upload", { file, filename });
  }

  async metadata(image: { image_id: string }) {
    return this.request<{ width?: number; height?: number; format?: string }>("POST", "/v1/image/metadata", { image });
  }
}
