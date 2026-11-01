import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FormatAlignLeftRoundedIcon from "@mui/icons-material/FormatAlignLeftRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import { useNavigate } from "react-router-dom";
import { WeaverCodeEditor, type WeaverCodeEditorProps } from "@/components/common/editors";
import { convertTopologyToWorkflow, createDefaultTopologyJson, formatJson } from "@/features/migration";

const editorOptions: WeaverCodeEditorProps["options"] = {
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: "on",
  renderLineHighlight: "line",
  scrollBeyondLastLine: false,
  tabSize: 2,
  wordWrap: "on",
};

const countTasks = (tasks: any[]): number =>
  tasks.reduce((total, task) => {
    const decisionCaseTasks = task?.decisionCases && typeof task.decisionCases === "object"
      ? Object.values(task.decisionCases).flatMap((branch) => (Array.isArray(branch) ? branch : []))
      : [];
    const defaultCaseTasks = Array.isArray(task?.defaultCase) ? task.defaultCase : [];
    return total + 1 + countTasks([...decisionCaseTasks, ...defaultCaseTasks]);
  }, 0);

const parseSourceJson = (value: string) => {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Source JSON root must be an object.");
  }
  return parsed;
};

export default function MigrationPage() {
  const navigate = useNavigate();
  const [sourceJson, setSourceJson] = useState(() => createDefaultTopologyJson());
  const [targetJson, setTargetJson] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => {
    if (!targetJson) return null;
    try {
      const workflow = JSON.parse(targetJson);
      return {
        name: String(workflow?.name || "Untitled"),
        version: workflow?.version ?? 1,
        tasks: countTasks(Array.isArray(workflow?.tasks) ? workflow.tasks : []),
        edges: Array.isArray(workflow?.edges) ? workflow.edges.length : 0,
      };
    } catch {
      return null;
    }
  }, [targetJson]);

  const handleConvert = () => {
    setCopied(false);
    try {
      const workflow = convertTopologyToWorkflow(parseSourceJson(sourceJson));
      setTargetJson(formatJson(workflow));
      setError("");
    } catch (conversionError) {
      setTargetJson("");
      setError(conversionError instanceof Error ? conversionError.message : "Failed to convert topology JSON.");
    }
  };

  const handleFormatSource = () => {
    try {
      setSourceJson(formatJson(parseSourceJson(sourceJson)));
      setError("");
    } catch (formatError) {
      setError(formatError instanceof Error ? formatError.message : "Source JSON is not valid.");
    }
  };

  const handleClear = () => {
    setSourceJson("");
    setTargetJson("");
    setError("");
    setCopied(false);
  };

  const handleCopyOutput = async () => {
    if (!targetJson) return;
    await navigator.clipboard.writeText(targetJson);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleImportConverted = () => {
    try {
      const workflow = parseSourceJson(targetJson);
      navigate("/designer", {
        state: {
          importedWorkflowJson: workflow,
          importSource: "migration",
        },
      });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Converted workflow JSON is not valid.");
    }
  };

  return (
    <Box
      sx={(theme) => ({
            minHeight: "calc(100vh - 64px)",
            p: { xs: 2, md: 3 },
            background: theme.palette.background.default,
          })}
        >
          <Stack spacing={2.2}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.4 },
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 850, mb: 0.5 }}>
                    Workflow Structure Migration
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 760 }}>
                    Convert old designer topology JSON into the new workflow DTO structure used by the Start node JSON.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {summary ? (
                    <>
                      <Chip label={`${summary.tasks} tasks`} size="small" color="primary" variant="outlined" />
                      <Chip label={`${summary.edges} edges`} size="small" color="success" variant="outlined" />
                      <Chip label={`v${summary.version}`} size="small" variant="outlined" />
                    </>
                  ) : (
                    <Chip label="Ready" size="small" variant="outlined" />
                  )}
                </Stack>
              </Stack>
            </Paper>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 64px minmax(0, 1fr)" },
                gap: 2,
                alignItems: "stretch",
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  minWidth: 0,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Stack spacing={1.4} sx={{ p: 1.6 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        Old Topology JSON
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Paste a topology object that contains `nodes` and `edges`.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={<FormatAlignLeftRoundedIcon />} onClick={handleFormatSource}>
                        Format
                      </Button>
                      <Button size="small" variant="text" color="inherit" startIcon={<DeleteOutlineRoundedIcon />} onClick={handleClear}>
                        Clear
                      </Button>
                    </Stack>
                  </Stack>
                  <Divider />
                  <WeaverCodeEditor
                    language="json"
                    value={sourceJson}
                    onChange={setSourceJson}
                    height="620px"
                    options={editorOptions}
                    path="migration-old-topology.json"
                  />
                </Stack>
              </Paper>

              <Stack
                alignItems="center"
                justifyContent="center"
                spacing={1}
                sx={{ display: { xs: "none", xl: "flex" } }}
              >
                <Button
                  variant="contained"
                  onClick={handleConvert}
                  sx={{ minWidth: 48, width: 48, height: 48, borderRadius: "50%", p: 0 }}
                  aria-label="Convert topology to workflow JSON"
                >
                  <ArrowForwardRoundedIcon />
                </Button>
              </Stack>

              <Paper
                elevation={0}
                sx={{
                  minWidth: 0,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Stack spacing={1.4} sx={{ p: 1.6 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        New Workflow JSON
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                        {summary ? `${summary.name} converted to the new nested task structure.` : "Converted output appears here."}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" startIcon={<AutoFixHighRoundedIcon />} onClick={handleConvert}>
                        Convert
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentCopyRoundedIcon />}
                        onClick={handleCopyOutput}
                        disabled={!targetJson}
                      >
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<FileUploadRoundedIcon />}
                        onClick={handleImportConverted}
                        disabled={!targetJson}
                      >
                        Import
                      </Button>
                    </Stack>
                  </Stack>
                  <Divider />
                  <WeaverCodeEditor
                    language="json"
                    value={targetJson}
                    onChange={setTargetJson}
                    height="620px"
                    options={editorOptions}
                    path="migration-new-workflow.json"
                  />
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Box>
  );
}
