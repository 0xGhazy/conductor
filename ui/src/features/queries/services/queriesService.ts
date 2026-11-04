import { formatSql } from "@/utils/sqlFormat";

export const buildEmptyDatasource = () => ({
  id: null,
  name: "",
  type: "POSTGRES",
  category: "",
  status: "",
  url: "",
  username: "",
  password: "",
  maximumPoolSize: 10,
  connectionTimeout: 30000,
  idleTimeout: 30000,
  schema: "",
});

export const normalizeDatasource = (datasource: any) => {
  const rawStatus = datasource?.status ?? datasource?.datasourceStatus ?? "";
  const normalizedStatus =
    rawStatus && typeof rawStatus === "object" ? rawStatus?.status ?? "" : rawStatus;

  return {
    ...buildEmptyDatasource(),
    ...datasource,
    id: datasource?.id ?? datasource?.datasourceId ?? datasource?.name ?? null,
    name: datasource?.name ?? datasource?.datasourceName ?? "",
    type: datasource?.type ?? datasource?.datasourceType ?? "POSTGRES",
    category: datasource?.category ?? datasource?.datasourceCategory ?? "",
    status: String(normalizedStatus || ""),
    url:
      datasource?.connectionDetails?.url ??
      datasource?.url ??
      datasource?.jdbcUrl ??
      "",
    username: datasource?.connectionDetails?.username ?? datasource?.username ?? "",
    password: datasource?.connectionDetails?.password ?? datasource?.password ?? "",
    maximumPoolSize:
      datasource?.connectionDetails?.maximumPoolSize ??
      datasource?.maximumPoolSize ??
      datasource?.maximum_pool_size ??
      10,
    connectionTimeout:
      datasource?.connectionDetails?.connectionTimeout ??
      datasource?.connectionTimeout ??
      datasource?.connection_timeout ??
      30000,
    idleTimeout:
      datasource?.connectionDetails?.idleTimeout ??
      datasource?.connectionDetails?.idealTimeout ??
      datasource?.idleTimeout ??
      datasource?.idealTimeout ??
      datasource?.idle_timeout ??
      datasource?.ideal_timeout ??
      30000,
    schema: datasource?.connectionDetails?.schema ?? datasource?.schema ?? "",
  };
};

export const buildEmptyQuery = () => ({
  id: null,
  name: "",
  description: "",
  sql: "",
  dataSource: "",
  dataSourceName: "",
  timeoutMs: 3000,
  parameters: {},
  relatedWorkflows: [],
  createdBy: "",
  updatedBy: "",
  createdAt: null,
  updatedAt: null,
});

export const parseParametersPayload = (value: any) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value;
  return {};
};

export const normalizeQuery = (query: any, index = 0) => {
  if (!query) return buildEmptyQuery();
  if (typeof query === "string") {
    return {
      ...buildEmptyQuery(),
      id: query,
      name: query,
    };
  }

  const id =
    query?.id ??
    query?.queryId ??
    query?.name ??
    query?.queryName ??
    `query-${index + 1}`;

  const name = query?.name ?? query?.queryName ?? `Query ${index + 1}`;
  const datasourceObject =
    query?.datasource && typeof query.datasource === "object" ? query.datasource : null;
  const datasourceString = typeof query?.datasource === "string" ? query.datasource : "";

  return {
    ...buildEmptyQuery(),
    ...query,
    id,
    name,
    description: query?.description ?? "",
    // Stored minified by the backend; formatted here for the editor.
    sql: formatSql(
      query?.sqlQuery ??
        query?.sql ??
        query?.query ??
        query?.statement ??
        query?.queryText ??
        ""
    ),
    dataSource:
      query?.dataSource ??
      query?.datasourceId ??
      datasourceObject?.id ??
      datasourceString ??
      "",
    dataSourceName:
      query?.dataSourceName ??
      query?.datasourceName ??
      datasourceObject?.name ??
      datasourceString ??
      "",
    timeoutMs:
      query?.timeout ??
      query?.timeoutMS ??
      query?.timeoutMs ??
      3000,
    parameters: parseParametersPayload(query?.parameters),
    relatedWorkflows:
      query?.relatedWorkflows ??
      query?.workflows ??
      query?.usedByWorkflows ??
      query?.workflowNames ??
      [],
    // { id, name, email } from the server (only the id when the user is unknown).
    createdBy: query?.createdBy ?? "",
    updatedBy: query?.updatedBy ?? "",
    createdAt: query?.createdAt ?? null,
    updatedAt: query?.updatedAt ?? null,
  };
};

export const extractQueryParams = (sql = "") => {
  if (!sql || typeof sql !== "string") {
    return { named: [], positional: [] };
  }

  // Strip line comments (-- ...), block comments (/* ... */), and single-quoted string literals ('...')
  const sanitized = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:''|[^'])*'/g, "");

  const named: string[] = [];
  const seen = new Set<string>();
  // Negative lookbehind ensures Postgres casts (col::type) are NOT extracted as parameters
  const regex = /(?<!:):([a-zA-Z_]\w*)/g;
  let match = regex.exec(sanitized);
  while (match) {
    const key = match[1];
    if (key && !seen.has(key)) {
      seen.add(key);
      named.push(key);
    }
    match = regex.exec(sanitized);
  }
  const positionalMatches = sanitized.match(/\?/g);
  const positionalCount = positionalMatches ? positionalMatches.length : 0;
  const positional = Array.from({ length: positionalCount }, (_, index) => `param${index + 1}`);
  return { named, positional };
};

export const filterQueries = (queries: any[], search: string) => {
  if (!search?.trim()) return queries;
  const q = search.toLowerCase();
  return queries.filter(
    (item) =>
      item.name?.toLowerCase().includes(q) ||
      item.dataSourceName?.toLowerCase().includes(q) ||
      item.dataSource?.toLowerCase().includes(q)
  );
};

export const buildParamStateFromParameters = (params: any) => {
  const nextParamTypes: Record<string, string> = {};
  const nextParamValues: Record<string, string> = {};
  Object.entries(params || {}).forEach(([key, value]: [string, any]) => {
    if (value && typeof value === "object") {
      nextParamTypes[key] = value.type ?? "STRING";
      nextParamValues[key] = "";
    } else if (typeof value === "string") {
      nextParamTypes[key] = value;
      nextParamValues[key] = "";
    } else {
      nextParamTypes[key] = "STRING";
      nextParamValues[key] = "";
    }
  });
  return { nextParamTypes, nextParamValues };
};

export const castTestParameters = (
  parameterKeys: string[] = [],
  testParams: Record<string, any> = {},
  paramTypes: Record<string, string> = {}
) => {
  const result: Record<string, any> = {};
  (parameterKeys || []).forEach((key) => {
    const raw = testParams?.[key];
    const type = (paramTypes?.[key] || "STRING").toUpperCase();

    if (raw == null || raw === "") {
      result[key] = null;
      return;
    }

    switch (type) {
      case "INTEGER":
      case "LONG": {
        const num = parseInt(raw, 10);
        result[key] = Number.isNaN(num) ? null : num;
        break;
      }
      case "DOUBLE":
      case "FLOAT":
      case "DECIMAL": {
        const num = parseFloat(raw);
        result[key] = Number.isNaN(num) ? null : num;
        break;
      }
      case "BOOLEAN": {
        const lower = String(raw).trim().toLowerCase();
        result[key] = lower === "true" || lower === "1";
        break;
      }
      case "LIST": {
        if (Array.isArray(raw)) {
          result[key] = raw;
        } else {
          const str = String(raw).trim();
          if (str.startsWith("[") && str.endsWith("]")) {
            try {
              result[key] = JSON.parse(str);
            } catch {
              result[key] = [str];
            }
          } else {
            result[key] = str.split(",").map((s) => s.trim());
          }
        }
        break;
      }
      case "JSON":
      case "JSONB": {
        try {
          result[key] = JSON.parse(raw);
        } catch {
          result[key] = raw;
        }
        break;
      }
      default:
        result[key] = raw;
        break;
    }
  });
  return result;
};

export const validateQueryForm = (
  queryForm: any,
  parameterKeys: string[],
  paramTypes: Record<string, string>,
  onNotify?: ((payload: any) => void) | null
) => {
  const name = queryForm.name?.trim();
  const errors: Record<string, string> = {};
  if (!name) {
    errors.name = "Query name is required.";
  } else if (name.length > 200) {
    errors.name = "Query name must be less than 200 characters.";
  }

  const sql = queryForm.sql?.trim();
  if (!sql) {
    errors.sql = "SQL query statement is required.";
  } else if (sql.length < 10) {
    errors.sql = "SQL query must be at least 10 characters.";
  } else if (sql.length > 5000) {
    errors.sql = "SQL query cannot exceed 5000 characters.";
  }

  if (!queryForm.dataSource) {
    errors.dataSource = "Datasource is required.";
  }

  const timeout = Number(queryForm.timeoutMs);
  if (!Number.isFinite(timeout)) {
    errors.timeoutMs = "Timeout is required.";
  } else if (timeout < 100 || timeout > 60000) {
    errors.timeoutMs = "Timeout must be between 100 and 60000 ms.";
  }

  if (Object.keys(errors).length) {
    if (onNotify && errors.sql && !name) {
      onNotify({ severity: "error", message: errors.sql });
    }
    return { isValid: false, errors };
  }

  const parameters = parameterKeys.reduce((acc: Record<string, string>, key) => {
    acc[key] = paramTypes[key] ?? "STRING";
    return acc;
  }, {});

  const payload = {
    id: queryForm.id ?? undefined,
    name,
    description: String(queryForm.description ?? "").trim() || null,
    sql: queryForm.sql,
    timeout,
    dataSource: queryForm.dataSource,
    parameters,
  };

  return { isValid: true, errors: {}, payload };
};

export const buildTestPayload = (
  queryForm: any,
  parameterKeys: string[],
  testParams: Record<string, any>,
  paramTypes: Record<string, string> = {}
) => {
  const datasource =
    (typeof queryForm?.dataSource === "object" && queryForm?.dataSource !== null
      ? queryForm.dataSource.id
      : queryForm?.dataSource) ||
    (typeof queryForm?.datasource === "object" && queryForm?.datasource !== null
      ? queryForm.datasource.id
      : queryForm?.datasource) ||
    "";

  return {
    query: queryForm?.id || "",
    datasource,
    sql: queryForm?.sql || "",
    timeout: Number(queryForm?.timeoutMs) || 5000,
    parameters: castTestParameters(parameterKeys, testParams, paramTypes),
  };
};
