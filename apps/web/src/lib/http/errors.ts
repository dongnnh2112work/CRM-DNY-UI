export class ApiError extends Error {
  readonly statusCode: number;
  readonly messages: string[];
  readonly timestamp?: string;

  constructor(statusCode: number, messages: string[], timestamp?: string) {
    super(messages[0] ?? `HTTP ${statusCode}`);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.messages = messages;
    this.timestamp = timestamp;
  }

  get isUnauthorized() {
    return this.statusCode === 401;
  }

  get isForbidden() {
    return this.statusCode === 403;
  }
}

type NestErrorBody = {
  success?: boolean;
  statusCode?: number;
  error?: string[] | string;
  message?: string | string[];
  timestamp?: string;
};

export async function parseApiError(res: Response): Promise<ApiError> {
  let body: NestErrorBody | null = null;
  try {
    body = (await res.json()) as NestErrorBody;
  } catch {
    return new ApiError(res.status, [res.statusText || `HTTP ${res.status}`]);
  }
  const raw = body.error ?? body.message ?? res.statusText;
  const messages = Array.isArray(raw) ? raw.map(String) : [String(raw || `HTTP ${res.status}`)];
  return new ApiError(body.statusCode ?? res.status, messages, body.timestamp);
}
