import { useState } from "react";
import { IconButton, InputAdornment } from "@mui/material";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { WeaverTextField } from "@/components/common/fields";

interface SecretValueFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Masked input for a secret value with a show/hide toggle. Browsers are told not to autofill or save it. */
export default function SecretValueField({
  label = "Value",
  value,
  onChange,
  error,
  helperText,
  disabled,
  autoFocus,
  placeholder,
}: SecretValueFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <WeaverTextField
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      fullWidth
      required
      disabled={disabled}
      autoFocus={autoFocus}
      autoComplete="new-password"
      errorMessage={error}
      helperText={helperText}
      slotProps={{
        htmlInput: { spellCheck: false, "data-lpignore": "true", "data-1p-ignore": "true" },
        input: {
          sx: { fontFamily: "var(--font-mono, monospace)" },
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setVisible((prev) => !prev)}
                edge="end"
                size="small"
                aria-label={visible ? "Hide value" : "Show value"}
              >
                {visible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
