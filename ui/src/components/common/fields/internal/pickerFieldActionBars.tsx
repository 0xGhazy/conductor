import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import { styled } from "@mui/material/styles";
import { usePickerContext } from "@mui/x-date-pickers/hooks";
import dayjs from "dayjs";

const ActionBarRoot = styled(DialogActions)(({ theme }) => ({
  padding: "10px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

export interface WeaverActionBarProps {
  className?: string;
  showToday?: boolean;
  showNow?: boolean;
}

export function WeaverDateActionBar(props: WeaverActionBarProps) {
  const { clearValue, setValueToToday, acceptValueChanges } = usePickerContext();
  const showToday = props.showToday !== false;

  return (
    <ActionBarRoot className={props.className}>
      <div>
        {showToday && (
          <Button
            size="small"
            onClick={setValueToToday}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Today
          </Button>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button
          size="small"
          color="inherit"
          onClick={clearValue}
          sx={{ textTransform: "none" }}
        >
          Clear
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={acceptValueChanges}
          sx={{ textTransform: "none" }}
        >
          OK
        </Button>
      </div>
    </ActionBarRoot>
  );
}

export function WeaverTimeActionBar(props: WeaverActionBarProps) {
  const { clearValue, setValueToToday, acceptValueChanges } = usePickerContext();
  const showNow = props.showNow !== false;

  return (
    <ActionBarRoot className={props.className}>
      <div>
        {showNow && (
          <Button
            size="small"
            onClick={setValueToToday}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Now
          </Button>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button
          size="small"
          color="inherit"
          onClick={clearValue}
          sx={{ textTransform: "none" }}
        >
          Clear
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={acceptValueChanges}
          sx={{ textTransform: "none" }}
        >
          OK
        </Button>
      </div>
    </ActionBarRoot>
  );
}

export function WeaverDateTimeActionBar(props: WeaverActionBarProps) {
  const { clearValue, setValue, acceptValueChanges } = usePickerContext();
  const showToday = props.showToday !== false;
  const showNow = props.showNow !== false;

  const handleToday = () => {
    setValue(dayjs().startOf("day"));
  };

  const handleNow = () => {
    setValue(dayjs());
  };

  return (
    <ActionBarRoot className={props.className}>
      <div style={{ display: "flex", gap: "8px" }}>
        {showToday && (
          <Button
            size="small"
            onClick={handleToday}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Today
          </Button>
        )}
        {showNow && (
          <Button
            size="small"
            onClick={handleNow}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Now
          </Button>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button
          size="small"
          color="inherit"
          onClick={clearValue}
          sx={{ textTransform: "none" }}
        >
          Clear
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={acceptValueChanges}
          sx={{ textTransform: "none" }}
        >
          OK
        </Button>
      </div>
    </ActionBarRoot>
  );
}
