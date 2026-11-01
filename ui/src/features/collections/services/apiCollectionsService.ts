export const buildEmptyCollection = () => ({
  id: null,
  name: "",
  description: "",
  connection: "",
  type: "POSTMAN",
  createdAt: "",
  createdBy: "",
  updatedAt: "",
  updatedBy: "",
});

export const normalizeCollection = (collection) => ({
  ...buildEmptyCollection(),
  ...collection,
  id: collection?.id ?? null,
  name: collection?.name ?? "",
  description: collection?.description ?? "",
  connection: collection?.connection ?? "",
  type: collection?.type ?? "POSTMAN",
  createdAt: collection?.createdAt ?? "",
  createdBy: collection?.createdBy ?? "",
  updatedAt: collection?.updatedAt ?? "",
  updatedBy: collection?.updatedBy ?? "",
});

export const validateCollection = (collection) => {
  const errors = {};
  const name = collection.name?.trim() ?? "";
  if (!name || name.length < 3) {
    errors.name = "Name must be at least 3 characters.";
  }
  return errors;
};

export const buildCollectionPayload = (form) => ({
  name: form.name?.trim() ?? "",
  description: form.description ?? "",
  connection: form.connection || null,
  type: form.type || "POSTMAN",
});

const buildUrlFromParts = (urlObj) => {
  if (!urlObj) return "";
  if (typeof urlObj === "string") return urlObj;
  if (urlObj.raw) return urlObj.raw;
  const protocol = urlObj.protocol ? `${urlObj.protocol}://` : "";
  const host = Array.isArray(urlObj.host)
    ? urlObj.host.join(".")
    : urlObj.host || "";
  const path = Array.isArray(urlObj.path)
    ? `/${urlObj.path.join("/")}`
    : urlObj.path
      ? `/${urlObj.path}`
      : "";
  const query =
    Array.isArray(urlObj.query) && urlObj.query.length
      ? `?${urlObj.query
          .filter((q) => q && q.key)
          .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value ?? "")}`)
          .join("&")}`
      : "";
  return `${protocol}${host}${path}${query}`;
};

const flattenItems = (items, parentFolders = [], acc = []) => {
  (items || []).forEach((item) => {
    if (item?.item && Array.isArray(item.item)) {
      const nextFolders = item.name ? [...parentFolders, item.name] : parentFolders;
      flattenItems(item.item, nextFolders, acc);
      return;
    }
    if (item?.request) {
      item.__tags = parentFolders.length ? parentFolders : (item.request?.tags || []);
      acc.push(item);
    }
  });
  return acc;
};

const headersToObject = (headers) => {
  const out = {};
  (headers || []).forEach((h) => {
    if (!h || h.disabled) return;
    if (!h.key) return;
    out[h.key] = h.value ?? "";
  });
  return out;
};

const queryToObject = (query) => {
  const out = {};
  (query || []).forEach((q) => {
    if (!q || q.disabled) return;
    if (!q.key) return;
    out[q.key] = q.value ?? "";
  });
  return out;
};

const parseBody = (body) => {
  if (!body) return {};
  if (body.mode === "raw") {
    const raw = body.raw || "";
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (body.mode === "urlencoded" || body.mode === "formdata") {
    const out = {};
    (body[body.mode] || []).forEach((field) => {
      if (!field || field.disabled) return;
      if (!field.key) return;
      out[field.key] = field.value ?? "";
    });
    return out;
  }
  return {};
};

const mapPostmanRequest = (item) => {
  const req = item.request || {};
  const urlObj = req.url || {};
  const tags = item.__tags || (Array.isArray(req.tags) ? req.tags : []);
  return {
    name: item.name || req.name || "HTTP",
    description: "",
    tags,
    config: {
      method: (req.method || "GET").toUpperCase(),
      url: buildUrlFromParts(urlObj),
      headers: headersToObject(req.header),
      query: queryToObject(urlObj.query),
      body: parseBody(req.body),
      tags,
    },
  };
};

const buildServerBase = (spec) => {
  const servers = spec?.servers;
  if (Array.isArray(servers) && servers.length && servers[0]?.url) {
    return servers[0].url;
  }
  const schemes = spec?.schemes;
  const host = spec?.host;
  const basePath = spec?.basePath || "";
  if (host && Array.isArray(schemes) && schemes.length) {
    return `${schemes[0]}://${host}${basePath}`;
  }
  if (host) return `https://${host}${basePath}`;
  return "";
};

const resolveRef = (ref, spec) => {
  if (!ref || typeof ref !== "string") return null;
  const parts = ref.replace(/^#\//, "").split("/");
  let current = spec;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
};

const generateExampleFromSchema = (schema, spec, visited = new Set()) => {
  if (!schema) return undefined;

  if (schema.$ref) {
    const refPath = schema.$ref;
    if (visited.has(refPath)) {
      return {};
    }
    const nextVisited = new Set(visited);
    nextVisited.add(refPath);
    const resolved = resolveRef(refPath, spec);
    return generateExampleFromSchema(resolved, spec, nextVisited);
  }

  if (schema.type === "object" || schema.properties) {
    const obj = {};
    const props = schema.properties || {};
    Object.entries(props).forEach(([key, propSchema]) => {
      obj[key] = generateExampleFromSchema(propSchema, spec, visited);
    });
    return obj;
  }

  if (schema.type === "array" || schema.items) {
    const itemSchema = schema.items || {};
    return [generateExampleFromSchema(itemSchema, spec, visited)];
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  switch (schema.type) {
    case "string":
      return schema.format === "date-time" ? new Date().toISOString() : "string";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
};

const parseParameters = (op, spec) => {
  const query = {};
  const headers = {};
  const params = op?.parameters || [];

  params.forEach((param) => {
    const resolvedParam = param.$ref ? resolveRef(param.$ref, spec) : param;
    if (!resolvedParam) return;

    const name = resolvedParam.name;
    if (!name) return;

    const paramSchema = resolvedParam.schema || resolvedParam;
    const exampleValue = generateExampleFromSchema(paramSchema, spec);

    if (resolvedParam.in === "query") {
      query[name] = exampleValue !== null && exampleValue !== undefined ? String(exampleValue) : "";
    } else if (resolvedParam.in === "header") {
      headers[name] = exampleValue !== null && exampleValue !== undefined ? String(exampleValue) : "";
    }
  });

  return { query, headers };
};

const getRequestBodyExample = (op, spec) => {
  const requestBody = op?.requestBody;
  if (requestBody) {
    const resolvedRequestBody = requestBody.$ref ? resolveRef(requestBody.$ref, spec) : requestBody;
    const content = resolvedRequestBody?.content || {};
    const jsonContent = content["application/json"] || content["*/*"];
    if (jsonContent?.schema) {
      return generateExampleFromSchema(jsonContent.schema, spec);
    }
  }

  const bodyParam = (op?.parameters || []).find((p) => {
    const resolved = p.$ref ? resolveRef(p.$ref, spec) : p;
    return resolved?.in === "body";
  });
  if (bodyParam) {
    const resolvedBody = bodyParam.$ref ? resolveRef(bodyParam.$ref, spec) : bodyParam;
    if (resolvedBody?.schema) {
      return generateExampleFromSchema(resolvedBody.schema, spec);
    }
  }

  return {};
};

const mapOpenApiSpec = (spec) => {
  const base = buildServerBase(spec);
  const paths = spec?.paths || {};
  const items = [];
  Object.entries(paths).forEach(([path, methods]) => {
    Object.entries(methods || {}).forEach(([method, op]) => {
      const lower = String(method || "").toLowerCase();
      if (!["get", "post", "put", "patch", "delete", "options", "head"].includes(lower)) {
        return;
      }
      const opId = op?.operationId;
      const name = op?.summary || opId || `${lower.toUpperCase()} ${path}`;
      const { query, headers } = parseParameters(op, spec);
      const body = getRequestBodyExample(op, spec);
      const opTags = Array.isArray(op?.tags)
        ? op.tags.filter(Boolean)
        : op?.tag
        ? [op.tag]
        : [];

      items.push({
        name,
        description: op?.description || "",
        tags: opTags,
        config: {
          method: lower.toUpperCase(),
          url: `${base}${path}`,
          headers,
          query,
          body,
          tags: opTags,
        },
      });
    });
  });
  return items;
};

export const parseCollectionFile = async (file) => {
  const text = await file.text();
  const json = JSON.parse(text);
  const isOpenApi = Boolean(json?.openapi || json?.swagger);

  const endpoints = isOpenApi
    ? mapOpenApiSpec(json)
    : flattenItems(json?.item || []).map(mapPostmanRequest);

  const validEndpoints = endpoints.filter((e) => e?.config?.url);

  const detectedTitle = isOpenApi
    ? (json?.info?.title || file.name.replace(/\.(json|yaml|yml)$/i, ""))
    : (json?.info?.name || file.name.replace(/\.(json|yaml|yml)$/i, ""));

  const detectedDescription = json?.info?.description || "";

  let detectedBaseUrl = "";
  if (isOpenApi) {
    detectedBaseUrl = buildServerBase(json);
  } else if (validEndpoints.length && validEndpoints[0]?.config?.url) {
    try {
      const u = validEndpoints[0].config.url;
      const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
      detectedBaseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      detectedBaseUrl = "";
    }
  }

  const methodCounts = validEndpoints.reduce((acc, ep) => {
    const m = String(ep?.config?.method || "GET").toUpperCase();
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  return {
    raw: json,
    name: detectedTitle,
    description: detectedDescription,
    baseUrl: detectedBaseUrl,
    endpoints: validEndpoints,
    type: isOpenApi ? "SWAGGER" : "POSTMAN",
    specVersion: json?.openapi ? `OpenAPI ${json.openapi}` : json?.swagger ? `Swagger ${json.swagger}` : "Postman v2.1",
    methodCounts,
  };
};

export const buildImportPayload = (form, parsed) => ({
  name: form.name?.trim() ?? "",
  description: form.description ?? "",
  connection: form.connection || null,
  type: parsed?.type || form.type || "POSTMAN",
  endpoints: (parsed?.endpoints || []).map((ep) => ({
    name: ep.name,
    description: ep.description || "",
    connection: form.connection || null,
    tags: ep.tags || ep.config?.tags || [],
    config: {
      ...(ep.config || {}),
      tags: ep.tags || ep.config?.tags || [],
    },
  })),
});
