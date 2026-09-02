import type { FormInstance } from "antd";
import { tt } from "@/lib/i18n";

type ConfirmFn = (config: {
  title: string;
  content?: string;
  okText?: string;
  cancelText?: string;
  onOk?: () => void;
}) => void;

/** Shared copy when leaving a dirty form. */
export function confirmDiscard(modal: { confirm: ConfirmFn }, onDiscard: () => void) {
  modal.confirm({
    title: tt("common.discardTitle"),
    content: tt("common.discardBody"),
    okText: tt("common.cancel"),
    cancelText: tt("common.continue"),
    onOk: onDiscard,
  });
}

export function confirmDiscardIfDirty(
  modal: { confirm: ConfirmFn },
  form: FormInstance,
  onDiscard: () => void,
) {
  if (!form.isFieldsTouched()) {
    onDiscard();
    return;
  }
  confirmDiscard(modal, onDiscard);
}
