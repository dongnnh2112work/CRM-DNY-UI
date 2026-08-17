import type { FormInstance } from "antd";

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
    title: "Hủy?",
    content: "Thay đổi sẽ không được lưu.",
    okText: "Hủy",
    cancelText: "Tiếp tục",
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
