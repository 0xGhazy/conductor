const NAME_REGEX = /^[A-Za-z0-9_-]+$/;

export const buildEmptyRedisDatasource = () => ({
  id: null,
  name: "",
  host: "",
  port: 6379,
  username: "",
  password: "",
  databaseIndex: 0,
  ssl: false,
  timeoutMs: 2000,
  active: true,
  createdAt: null,
  updatedAt: null,
});

export const normalizeRedisDatasource = (ds: any) => ({
  ...buildEmptyRedisDatasource(),
  ...ds,
  id: ds?.id ?? null,
  name: ds?.name ?? "",
  host: ds?.host ?? "",
  port: ds?.port ?? 6379,
  username: ds?.username ?? "",
  password: ds?.password ?? "",
  databaseIndex: ds?.databaseIndex ?? 0,
  ssl: ds?.ssl ?? false,
  timeoutMs: ds?.timeoutMs ?? 2000,
  active: ds?.active ?? true,
  createdAt: ds?.createdAt ?? null,
  updatedAt: ds?.updatedAt ?? null,
});

export const validateRedisDatasource = (ds: any) => {
  const errors: Record<string, string> = {};

  const name = String(ds.name || "").trim();
  if (!name) {
    errors.name = "Redis datasource name is required.";
  } else if (name.length < 3 || name.length > 100) {
    errors.name = "Name must be between 3 and 100 characters.";
  } else if (!NAME_REGEX.test(name)) {
    errors.name = "Name can contain only letters, numbers, underscores, and hyphens.";
  }

  const host = String(ds.host || "").trim();
  if (!host) {
    errors.host = "Redis host is required.";
  }

  const port = Number(ds.port);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.port = "Port must be a number between 1 and 65535.";
  }

  const databaseIndex = Number(ds.databaseIndex);
  if (isNaN(databaseIndex) || databaseIndex < 0 || databaseIndex > 15) {
    errors.databaseIndex = "Database index must be between 0 and 15.";
  }

  const timeoutMs = Number(ds.timeoutMs);
  if (isNaN(timeoutMs) || timeoutMs < 100) {
    errors.timeoutMs = "Timeout must be at least 100ms.";
  }

  return errors;
};

export const buildRedisDatasourcePayload = (form: any) => ({
  name: String(form.name || "").trim(),
  host: String(form.host || "").trim(),
  port: Number(form.port) || 6379,
  username: form.username ? String(form.username).trim() : null,
  password: form.password ? String(form.password) : null,
  databaseIndex: Number(form.databaseIndex) ?? 0,
  ssl: Boolean(form.ssl),
  timeoutMs: Number(form.timeoutMs) || 2000,
  active: Boolean(form.active),
});
