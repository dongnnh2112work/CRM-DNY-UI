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
  /** Machine code such as CONTRACT_CUSTOMER_CONFLICT, when sent beside `message`. */
  code?: string;
  timestamp?: string;
};

const MACHINE_CODE = /^[A-Z][A-Z0-9_]{2,}$/;

function asErrorList(value: string[] | string | undefined): string[] {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => String(item).trim()).filter(Boolean);
}

/**
 * Prefer a human `message` when `error` is only a machine code.
 * Human `error` text (the documented shape) is unchanged.
 */
function messagesFromBody(body: NestErrorBody, status: number, fallback?: string): string[] {
  const errors = asErrorList(body.error);
  const messages = asErrorList(body.message);
  const humanErrors = errors.filter((item) => !MACHINE_CODE.test(item));
  if (humanErrors.length) return errors;
  const humanMessages = messages.filter((item) => !MACHINE_CODE.test(item));
  if (errors.length && humanMessages.length) return humanMessages;
  if (errors.length) return errors;
  if (messages.length) return messages;
  if (body.code?.trim()) return [body.code.trim()];
  return [fallback || `HTTP ${status}`];
}

export function parseApiErrorText(status: number, text: string, fallbackStatusText?: string): ApiError {
  if (!text) return new ApiError(status, [fallbackStatusText || `HTTP ${status}`]);
  try {
    const body = JSON.parse(text) as NestErrorBody;
    return new ApiError(
      body.statusCode ?? status,
      messagesFromBody(body, status, fallbackStatusText),
      body.timestamp,
    );
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
