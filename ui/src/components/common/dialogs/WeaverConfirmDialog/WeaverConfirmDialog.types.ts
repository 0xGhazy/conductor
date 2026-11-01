import type { ReactNode } from "react";
import type { DialogProps } from "@mui/material";

export type WeaverConfirmIntent = "default" | "info" | "warning" | "danger";

export interface WeaverConfirmDetail {
  label: ReactNode;
  value: ReactNode;
}

export interface WeaverRelatedRecord {
  id?: string | number;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  status?: ReactNode;
  details?: WeaverConfirmDetail[];
}

export interface WeaverTextConfirmation {
  expectedText: string;
  label?: ReactNode;
  placeholder?: string;
  helperText?: ReactNode;
  caseSensitive?: boolean;
  trim?: boolean;
}

export interface WeaverConfirmDialogProps {
  /** Controls dialog open visibility */
  open: boolean;

  /** Header title */
  title: ReactNode;

  /** Primary confirmation message */
  message?: ReactNode;

  /** Secondary explanatory text or description */
  description?: ReactNode;

  /** Confirmation intent styling */
  intent?: WeaverConfirmIntent;

  /** Custom header icon override */
  icon?: ReactNode;

  /** Title for the key-value details section */
  detailsTitle?: ReactNode;

  /** Key-value details list (rendered if no relatedContent or relatedRecords) */
  details?: WeaverConfirmDetail[];

  /** Title for the related records list section */
  relatedRecordsTitle?: ReactNode;

  /** List of affected or related records */
  relatedRecords?: WeaverRelatedRecord[];

  /** Custom related content escape hatch (highest rendering priority) */
  relatedContent?: ReactNode;

  /** Optional typed-text requirement to enable the confirm button */
  textConfirmation?: WeaverTextConfirmation;

  /** Label for confirm button (default: "Confirm" or intent-based) */
  confirmLabel?: string;

  /** Label for cancel button (default: "Cancel") */
  cancelLabel?: string;

  /** Explicitly disables the confirm button */
  confirmDisabled?: boolean;

  /** Indicates an async action is in flight */
  loading?: boolean;

  /** Whether clicking the backdrop dismisses the dialog (default: false) */
  closeOnBackdropClick?: boolean;

  /** Whether pressing Escape dismisses the dialog (default: true) */
  closeOnEscape?: boolean;

  /** Dialog max width constraint (default: 'sm') */
  maxWidth?: DialogProps["maxWidth"];

  /** Whether the dialog stretches to maxWidth (default: true) */
  fullWidth?: boolean;

  /** Optional arbitrary children rendered within dialog body */
  children?: ReactNode;

  /** Callback when confirmation action is triggered */
  onConfirm: () => void | Promise<void>;

  /** Callback when dialog is closed or cancelled */
  onCancel: () => void;

  /** Extensible MUI Dialog properties passthrough */
  dialogProps?: Omit<DialogProps, "open" | "onClose">;
}
