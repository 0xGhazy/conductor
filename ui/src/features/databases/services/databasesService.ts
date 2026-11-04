const DATASOURCE_TYPES = [
  "POSTGRES",
  "MYSQL",
  "ORACLE",
];

const NAME_REGEX = /^[A-Za-z0-9_-]+$/;
const DB_URL_REGEX = /^jdbc:[a-z0-9_:-]+/i;

const toInteger = (value: any) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

export const buildEmptyDatasource = () => ({
  id: null,
  name: "",
  type: "POSTGRES",
  category: "",
  status: "",
  createdBy: "",
  updatedBy: "",
  createdAt: null,
  updatedAt: null,
  url: "",
  username: "",
  password: "",
  maximumPoolSize: 10,
  connectionTimeout: 30000,
  idleTimeout: 30000,
  schema: "",
});

export const normalizeDatasource = (datasource: any) => {
  const connection = datasource?.connection ?? datasource?.connectionDetails ?? {};
  const rawStatus = datasource?.status ?? datasource?.datasourceStatus ?? "";
  const normalizedStatus =
    rawStatus && typeof rawStatus === "object" ? rawStatus?.status ?? "" : rawStatus;

  const rawType = String(datasource?.type ?? datasource?.datasourceType ?? "POSTGRES").toUpperCase();
  const normalizedType = rawType === "POSTGRESQL" ? "POSTGRES" : rawType;

  return {
    ...buildEmptyDatasource(),
    ...datasource,
    id: datasource?.id ?? null,
    name: datasource?.name ?? datasource?.datasourceName ?? "",
    type: normalizedType || "POSTGRES",
    category: datasource?.category ?? datasource?.datasourceCategory ?? "",
    status: String(normalizedStatus || ""),
    createdAt: datasource?.createdAt ?? datasource?.created_at ?? null,
    updatedAt: datasource?.updatedAt ?? datasource?.updated_at ?? null,
    // { id, name, email } from the server (only the id when the user is unknown).
    createdBy: datasource?.createdBy ?? datasource?.created_by ?? "",
    updatedBy: datasource?.updatedBy ?? datasource?.updated_by ?? "",
    url:
      connection?.url ??
      datasource?.url ??
      datasource?.jdbcUrl ??
      "",
    username: connection?.username ?? datasource?.username ?? "",
    password: "", // Never populate password from backend response
    maximumPoolSize:
      connection?.maximumPoolSize ??
      connection?.maxPoolSize ??
      datasource?.maxPoolSize ??
      datasource?.maximumPoolSize ??
      datasource?.maximum_pool_size ??
      10,
    connectionTimeout:
      connection?.connectionTimeout ??
      datasource?.connectionTimeout ??
      datasource?.connection_timeout ??
      30000,
    idleTimeout:
      connection?.idleTimeout ??
      connection?.idealTimeout ??
      datasource?.idleTimeout ??
      datasource?.idealTimeout ??
      datasource?.idle_timeout ??
      datasource?.ideal_timeout ??
      30000,
    schema: connection?.schema ?? datasource?.schema ?? "",
  };
};

export const validateDatasource = (datasource: any, isCreate?: boolean) => {
  const errors: Record<string, string> = {};
  const isNew = isCreate !== undefined ? isCreate : !datasource?.id;
  const name = datasource.name?.trim() ?? "";
  if (!name) errors.name = "Datasource name is required for identification.";
  else if (name.length < 3 || name.length > 100) {
    errors.name = "Datasource name must be between 3 and 100 characters.";
  } else if (!NAME_REGEX.test(name)) {
    errors.name =
      "Datasource name can contain only letters, numbers, underscores, and hyphens.";
  }

  const normalizedType = String(datasource.type || "").toUpperCase();
  if (!normalizedType) errors.type = "Datasource type is required.";
  else if (!DATASOURCE_TYPES.includes(normalizedType)) {
    errors.type = `Datasource type must be one of: ${DATASOURCE_TYPES.join(", ")}.`;
  }

  const url = datasource.url?.trim() ?? "";
  if (DATASOURCE_TYPES.includes(normalizedType)) {
    if (!url) errors.url = "JDBC URL or connection URI is required.";
    else if (!DB_URL_REGEX.test(url)) {
      errors.url = "URL must be a valid JDBC URL (e.g. jdbc:postgresql://...).";
    }
    if (!datasource.username?.trim()) errors.username = "Database username is required.";
    if (isNew && !datasource.password?.trim()) errors.password = "Database password is required.";

    const maxPoolSize = toInteger(datasource.maximumPoolSize);
    if (maxPoolSize == null) errors.maximumPoolSize = "Maximum pool size is required.";
    else if (maxPoolSize < 1 || maxPoolSize > 100) {
      errors.maximumPoolSize = "Maximum pool size must be between 1 and 100.";
    }

    const idleTimeout = toInteger(datasource.idleTimeout);
    if (idleTimeout == null) errors.idleTimeout = "Idle timeout is required.";
    else if (idleTimeout < 10000) {
      errors.idleTimeout = "Idle timeout must be at least 10000 milliseconds.";
    }

    const connectionTimeout = toInteger(datasource.connectionTimeout);
    if (connectionTimeout == null) errors.connectionTimeout = "Connection timeout is required.";
    else if (connectionTimeout < 250) {
      errors.connectionTimeout = "Connection timeout must be at least 250 milliseconds.";
    }
  }
  return errors;
};

export const buildDatasourcePayload = (form: any) => {
  const connectionDetails: any = {
    url: form.url?.trim() ?? "",
    username: form.username,
    maxPoolSize: toInteger(form.maximumPoolSize) ?? 10,
    connectionTimeout: toInteger(form.connectionTimeout) ?? 30000,
    idleTimeout: toInteger(form.idleTimeout) ?? 30000,
    schema: form.schema?.trim() ?? undefined,
  };
  if (form.password?.trim()) {
    connectionDetails.password = form.password.trim();
  }
  return {
    name: form.name?.trim() ?? "",
    type: form.type,
    connectionDetails,
  };
};

export const filterDatasources = (datasources: any[], search: string) => {
  if (!search?.trim()) return datasources;
  const q = search.toLowerCase();
  return datasources.filter(
    (item) =>
      item.name?.toLowerCase().includes(q) ||
      item.type?.toLowerCase().includes(q) ||
      item.url?.toLowerCase().includes(q)
  );
};

export const getDatasourceTypes = () => DATASOURCE_TYPES.slice();

export {
  buildEmptyDatasource as buildEmptyDatabase,
  buildDatasourcePayload as buildDatabasePayload,
  getDatasourceTypes as getDatabaseTypes,
  normalizeDatasource as normalizeDatabase,
  validateDatasource as validateDatabase,
  filterDatasources as filterDatabases,
};
