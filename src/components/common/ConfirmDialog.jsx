// Replaces window.alert / window.confirm, which App.js used for the
// "at least one active admin" guard.
//
// Now a thin wrapper over ui/Modal, so it inherits the focus trap, Escape
// handling, scroll lock and focus restoration it never had of its own — which
// matters here more than anywhere else, since this dialog guards destructive
// actions and was previously dismissible only by clicking exactly the right
// pixels.

import { neutral, text } from "../../styles/tokens";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, color: neutral.saddle, ...text.body }}>{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;
