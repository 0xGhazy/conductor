import { useState, type MouseEvent } from "react";
import { Tooltip } from "@mui/material";
import { FiCheck, FiCopy } from "react-icons/fi";
import { useWeaverNotification } from "@/components/common/notifications";
import styles from "./SecretViewContent.module.css";

interface CopyReferenceButtonProps {
  placeholder: string;
  variant?: "icon" | "button";
  label?: string;
}

/** Copies a secret's ${weaver.secrets.<name>} reference to the clipboard with visual confirmation. */
export default function CopyReferenceButton({
  placeholder,
  variant = "icon",
  label = "Copy reference",
}: CopyReferenceButtonProps) {
  const notify = useWeaverNotification();
  const [copied, setCopied] = useState(false);

  const copy = async (event: MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(placeholder);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      notify.success(`Copied ${placeholder}`);
    } catch {
      notify.error("Couldn't copy to the clipboard.");
    }
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ""}`}
        onClick={copy}
        aria-label={`Copy ${placeholder}`}
      >
        {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
        <span>{copied ? "Copied" : label}</span>
      </button>
    );
  }

  return (
    <Tooltip title={copied ? "Copied!" : "Copy reference"}>
      <button
        type="button"
        className={`${styles.copyIconBtn} ${copied ? styles.copyBtnSuccess : ""}`}
        onClick={copy}
        aria-label={`Copy ${placeholder}`}
      >
        {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
      </button>
    </Tooltip>
  );
}
