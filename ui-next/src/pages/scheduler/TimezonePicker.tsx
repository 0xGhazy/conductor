import { WeaverAutoComplete } from "components/ui/inputs/WeaverAutoComplete";
import timezones from "./timezones.json";

type TimezonePickerProps = {
  timezone: string;
  onChange: (newValue: any) => void;
  error: boolean;
  helperText: string;
};

export const TimezonePicker = ({
  timezone,
  onChange,
  error,
  helperText,
}: TimezonePickerProps) => {
  return (
    <WeaverAutoComplete
      id="scheduler-timezone-picker"
      label="Select Timezone"
      required
      fullWidth
      error={error}
      helperText={helperText}
      value={timezone}
      options={timezones || []}
      placeholder="Select which timezone to use for this schedule."
      onChange={(_, value) => onChange(value)}
    />
  );
};
