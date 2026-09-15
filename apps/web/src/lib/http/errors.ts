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

export function parseApiErrorText(status: number, text: string, fallbackStatusText?: string): ApiError {
  if (!text) return new ApiError(status, [fallbackStatusText || `HTTP ${status}`]);
  try {
    const body = JSON.parse(text) as NestErrorBody;
    const raw = body.error ?? body.message ?? fallbackStatusText ?? `HTTP ${status}`;
    const messages = Array.isArray(raw) ? raw.map(String) : [String(raw || `HTTP ${status}`)];
    return new ApiError(body.statusCode ?? status, messages, body.timestamp);
  } catch {
    return new ApiError(status, [text.slice(0, 240) || fallbackStatusText || `HTTP ${status}`]);
  }
}

export async function parseApiError(res: Response): Promise<ApiError> {
  try {
    return parseApiErrorText(res.status, await res.text(), res.statusText);
  } catch {
    return new ApiError(res.status, [res.statusText || `HTTP ${res.status}`]);
  }
}
