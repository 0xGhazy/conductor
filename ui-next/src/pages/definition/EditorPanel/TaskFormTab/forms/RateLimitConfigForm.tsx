import { Box, Grid } from "@mui/material";
import WeaverInput from "components/ui/inputs/WeaverInput";
import { WeaverAutocompleteVariables } from "components/FlatMapForm/WeaverAutocompleteVariables";
import WeaverTooltip from "components/ui/WeaverTooltip";

type RateLimitConfigValue = {
  rateLimitKey: string;
  concurrentExecLimit: number;
};
interface RateLimitConfigFormProps {
  onChange: (value: RateLimitConfigValue) => void;
  value: RateLimitConfigValue;
}
export default function RateLimitConfigForm({
  onChange,
  value,
}: RateLimitConfigFormProps) {
  const handleRateLimitKeyChange = (val: string) => {
    onChange({ ...value, rateLimitKey: val });
  };
  const handleConcurrentExecLimitChange = (val: number) => {
    onChange({ ...value, concurrentExecLimit: val });
  };
  return (
    <>
      <Box mb={4}>
        <Box pt={3} sx={{ fontWeight: 600, color: "#767676" }}>
          Rate Limit
        </Box>
        <Box style={{ opacity: 0.5 }}>
          Limits the number of workflow executions at any given time.
        </Box>
      </Box>
      <Grid container sx={{ width: "100%" }} gap={3} size={12}>
        <Grid
          size={{
            lg: 8,
            md: 12,
          }}
        >
          <WeaverAutocompleteVariables
            onChange={handleRateLimitKeyChange}
            value={value?.rateLimitKey ?? ""}
            label={
              <>
                <>Rate limit key</>
                <WeaverTooltip
                  title="Rate limit key"
                  content="A unique identifier to group workflow executions for rate limiting."
                  placement="top"
                  children={
                    <img
                      alt="info"
                      src="/icons/info-icon.svg"
                      style={{ paddingLeft: "3px" }}
                    />
                  }
                />
              </>
            }
          />
        </Grid>
        <Grid flexGrow={1}>
          <WeaverInput
            tooltip={{
              title: "Concurrent execution limit",
              content:
                "The number of workflow executions that can run concurrently for a given key.",
            }}
            label="Concurrent execution limit"
            type="number"
            fullWidth
            value={value?.concurrentExecLimit}
            onTextInputChange={(val) =>
              handleConcurrentExecLimitChange(parseInt(val))
            }
          />
        </Grid>
      </Grid>
    </>
  );
}
