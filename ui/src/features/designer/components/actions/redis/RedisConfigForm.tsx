import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Stack,
  IconButton,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Braces as BracesIcon,
  RefreshCcw,
} from "lucide-react";
import { config } from "@/config/appConfig";
import { WeaverTextField, WeaverSelectField } from "@/components/common/fields";
import type { RedisNodeData, RedisActionConfig } from "@/features/designer/components/actions/redis/model/redisDto";

export interface RedisConfigFormProps {
  data: RedisNodeData;
  onChange: (nextData: Partial<RedisNodeData>) => void;
  validationErrors?: Record<string, string>;
}

interface RedisDatasourceOption {
  id: string;
  name: string;
  host: string;
  port: number;
  active: boolean;
}

const REDIS_ACTIONS = [
  { value: "GET", label: "GET - Retrieve Key Value", fields: ["key"] },
  { value: "SET", label: "SET - Store Key Value", fields: ["key", "value", "ttlSeconds"] },
  { value: "DEL", label: "DEL - Delete Key", fields: ["key"] },
  { value: "EXISTS", label: "EXISTS - Check Key Existence", fields: ["key"] },
  { value: "EXPIRE", label: "EXPIRE - Set Key TTL (Seconds)", fields: ["key", "ttlSeconds"] },
  { value: "KEYS", label: "KEYS - List Keys Matching Pattern", fields: ["key"] },
  { value: "INCR", label: "INCR - Increment Key by 1", fields: ["key"] },
  { value: "INCRBY", label: "INCRBY - Increment Key by Step", fields: ["key", "delta"] },
  { value: "DECR", label: "DECR - Decrement Key by 1", fields: ["key"] },
  { value: "DECRBY", label: "DECRBY - Decrement Key by Step", fields: ["key", "delta"] },
  { value: "HSET", label: "HSET - Set Hash Field Value", fields: ["key", "field", "value"] },
  { value: "HGET", label: "HGET - Get Hash Field Value", fields: ["key", "field"] },
  { value: "HDEL", label: "HDEL - Delete Hash Field", fields: ["key", "field"] },
  { value: "HGETALL", label: "HGETALL - Get All Hash Fields & Values", fields: ["key"] },
  { value: "HINCRBY", label: "HINCRBY - Increment Hash Field by Step", fields: ["key", "field", "delta"] },
  { value: "PING", label: "PING - Test Redis Server Latency", fields: [] },
];

export function RedisConfigForm({ data, onChange, validationErrors = {} }: RedisConfigFormProps) {
  const [datasources, setDatasources] = useState<RedisDatasourceOption[]>([]);
  const [loadingDs, setLoadingDs] = useState(false);
  const [dataSourceMenuOpen, setDataSourceMenuOpen] = useState(false);
  const dataSourceFieldAnchorRef = useRef<HTMLDivElement | null>(null);

  const actionConfig: RedisActionConfig = data?.config ?? {
    name: "redis_1",
    action: "GET",
  };

  const currentActionObj = REDIS_ACTIONS.find((a) => a.value === (actionConfig.action || "GET")) || REDIS_ACTIONS[0];
  const activeFields = currentActionObj.fields;

  const handleConfigChange = (fields: Partial<RedisActionConfig>) => {
    const updatedConfig = { ...actionConfig, ...fields };

    // Keep name / referenceName / reference in sync
    if (fields.name !== undefined) {
      updatedConfig.referenceName = fields.name;
      updatedConfig.reference = fields.name;
    }

    onChange({
      ...data,
      config: updatedConfig,
    });
  };

  const fetchDataSources = useCallback(async () => {
    setLoadingDs(true);
    const url = `${config.apiBaseUrl}/api/redis`;
    try {
      const res = await fetch(url);
      const body = await res.json();
      const list = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body)
          ? body
          : [];
      setDatasources(list);


    } catch (err) {
      console.warn("Could not fetch Redis datasources:", err);
    } finally {
      setLoadingDs(false);
    }
  }, [actionConfig.datasourceId, actionConfig.datasourceName]);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const openDataSourceMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    setDataSourceMenuOpen(true);
  };

  const closeDataSourceMenu = () => {
    setDataSourceMenuOpen(false);
  };

  const handleDataSourceSelect = (source: RedisDatasourceOption) => {
    handleConfigChange({
      datasourceId: source.id,
      datasourceName: source.name,
    });
    setDataSourceMenuOpen(false);
  };

  const handleReloadDataSources = (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    fetchDataSources();
  };

  const selectedDsName = actionConfig.datasourceName || "";
  const selectedDsId = actionConfig.datasourceId || "";
  const selectedDataSourceLabel = selectedDsName || (selectedDsId ? `ID: ${selectedDsId}` : "--None--");

  return (
    <Box className="database-config-grid">
      {/* Node Name */}
      <Box>
        <WeaverTextField
          label="Node Name *"
          value={data.name || "Redis"}
          onChange={(value) => onChange({ ...data, name: value })}
          placeholder="e.g. Redis"
        />
      </Box>

      {/* Reference Name */}
      <Box>
        <WeaverTextField
          label="Reference Name *"
          value={actionConfig.name || actionConfig.referenceName || ""}
          onChange={(value) => handleConfigChange({ name: value })}
          placeholder="e.g. redis_get_user_cache"
          errorMessage={validationErrors.referenceName || undefined}
        />
      </Box>

      {/* Redis Instance (Datasource Selection) */}
      <Box ref={dataSourceFieldAnchorRef}>
        <WeaverTextField
          label="Redis Instance *"
          value={selectedDataSourceLabel}
          placeholder="--None--"
          readOnly
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Reload Redis instances">
                    <span>
                      <IconButton
                        edge="end"
                        size="large"
                        onClick={handleReloadDataSources}
                        disabled={loadingDs}
                        sx={{ color: "var(--color-fg-default, #111827)" }}
                      >
                        {loadingDs ? (
                          <CircularProgress size={16} />
                        ) : (
                          <RefreshCcw size={16} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Select Redis instance">
                    <IconButton
                      edge="end"
                      size="large"
                      onClick={openDataSourceMenu}
                      disableRipple={false}
                      sx={{ color: "var(--color-fg-default, #111827)" }}
                    >
                      <BracesIcon size={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Action Selection */}
      <Box>
        <WeaverSelectField
          label="Action *"
          value={actionConfig.action || "GET"}
          onChange={(val: any) => handleConfigChange({ action: val })}
          options={REDIS_ACTIONS.map((act) => ({ label: act.label, value: act.value }))}
        />
      </Box>

      {/* Dynamic Action Parameters */}
      {activeFields.length > 0 && (
        <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" }, mt: 1 }}>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {activeFields.includes("key") && (
              <Box>
                <WeaverTextField
                  label={actionConfig.action === "KEYS" ? "Pattern *" : "Key *"}
                  value={actionConfig.key || ""}
                  onChange={(value) => handleConfigChange({ key: value })}
                  placeholder={actionConfig.action === "KEYS" ? "e.g. user:* or *" : "e.g. user:session:1001 or ${workflow.input.userId}"}
                />
              </Box>
            )}

            {activeFields.includes("field") && (
              <Box>
                <WeaverTextField
                  label="Hash Field *"
                  value={actionConfig.field || ""}
                  onChange={(value) => handleConfigChange({ field: value })}
                  placeholder="e.g. email, status, or ${workflow.input.field}"
                />
              </Box>
            )}

            {activeFields.includes("value") && (
              <Box>
                <WeaverTextField
                  label="Value"
                  multiline
                  rows={3}
                  value={actionConfig.value || ""}
                  onChange={(value) => handleConfigChange({ value })}
                  placeholder="Key value string, JSON object, or expression"
                />
              </Box>
            )}

            <Box className="database-config-grid" sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
              {activeFields.includes("ttlSeconds") && (
                <Box>
                  <WeaverTextField
                    label="TTL (Seconds)"
                    type="number"
                    value={actionConfig.ttlSeconds != null ? String(actionConfig.ttlSeconds) : ""}
                    onChange={(value) => handleConfigChange({ ttlSeconds: value ? Number(value) : undefined })}
                    placeholder="e.g. 3600 (Optional)"
                  />
                </Box>
              )}

              {activeFields.includes("delta") && (
                <Box>
                  <WeaverTextField
                    label="Increment/Decrement Delta"
                    type="number"
                    value={actionConfig.delta != null ? String(actionConfig.delta) : ""}
                    onChange={(value) => handleConfigChange({ delta: value ? Number(value) : undefined })}
                    placeholder="Default: 1"
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Redis Instance Selection Menu */}
      <Menu
        id="redis-instance-menu"
        anchorEl={dataSourceFieldAnchorRef.current}
        open={dataSourceMenuOpen}
        onClose={closeDataSourceMenu}
        PaperProps={{
          sx: {
            width: dataSourceFieldAnchorRef.current
              ? dataSourceFieldAnchorRef.current.offsetWidth
              : undefined,
          },
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {loadingDs && (
          <MenuItem disabled>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={16} />
              <span>Loading Redis instances...</span>
            </Stack>
          </MenuItem>
        )}
        {!loadingDs && datasources.length === 0 && (
          <MenuItem disabled>No Redis instances available</MenuItem>
        )}
        {datasources.map((ds) => (
          <MenuItem key={ds.id} onClick={() => handleDataSourceSelect(ds)}>
            {ds.name}{!ds.active ? " [INACTIVE]" : ""}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
