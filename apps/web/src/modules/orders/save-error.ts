import type { MessageKey } from "@/lib/i18n";
import { ApiError } from "@/lib/http/errors";
import { apiErrorMessage } from "@/lib/http/message";

const CODE_MESSAGE: Record<string, MessageKey> = {
  CONTRACT_CUSTOMER_CONFLICT: "order.contractCustomerConflict",
  SUBMITTER_IMMUTABLE: "order.submitterImmutable",
};

const MACHINE_CODE = /^[A-Z][A-Z0-9_]{2,}$/;

/** Backend sentence when present; otherwise a label for the known machine code. */
export function orderUpdateErrorMessage(
  err: unknown,
  translate: (key: MessageKey) => string,
): string {
  if (err instanceof ApiError) {
    const parts = err.messages.map((message) => message.trim()).filter(Boolean);
    const human = parts.filter((message) => !MACHINE_CODE.test(message));
    if (human.length) return human.join(" ");
    for (const part of parts) {
      const key = CODE_MESSAGE[part];
      if (key) return translate(key);
    }
  }
  return apiErrorMessage(err, translate("order.updateFailed"));
}
