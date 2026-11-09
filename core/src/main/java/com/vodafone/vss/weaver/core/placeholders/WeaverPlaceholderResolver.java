/*
 * Copyright 2026 Weaver Contributors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.core.placeholders;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.vodafone.vss.weaver.dao.SecretsDAO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.secrets.SecretPlaceholderParser;
import com.vodafone.vss.weaver.dao.EnvironmentDAO;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.jayway.jsonpath.JsonPath;

/**
 * The single owner of Weaver placeholder syntax.
 *
 * <ul>
 *   <li>{@code ${weaver.env.NAME[.json.path][:default]}} reads {@code WEAVER_ENV_NAME} through
 *       {@link EnvironmentDAO} (OS environment first, then JVM system property). With a JSON path
 *       the value is parsed as JSON and the path extracted. If the variable or the path is missing
 *       the default is returned, or {@code null} when there is no default.
 *   <li>{@code ${weaver.secrets.NAME}} reads a secret through {@link SecretsDAO}, behind a cache
 *       whose TTL is {@code conductor.secrets.cache-ttl} (default 30 minutes).
 *   <li>{@code $${...}} escapes a placeholder so it is kept as literal text.
 * </ul>
 *
 * <p>Two lifecycles use this class:
 *
 * <ol>
 *   <li><b>Workflow tasks.</b> {@code ParametersUtils} resolves {@code weaver.env} when the task is
 *       scheduled (the value is stored in task input) and leaves {@code weaver.secrets} literal.
 *       Secrets are resolved on an in-memory copy right before the task runs ({@link
 *       #resolveSecrets}); any resolved value that ends up in task output, the failure reason or
 *       workflow variables is masked before it is persisted ({@link #maskTask}, {@link
 *       #maskVariables}).
 *   <li><b>Admin configuration</b> (datasources, HTTP connections, saved queries): {@link
 *       #resolveConfig} resolves both namespaces immediately. These values are authored by
 *       administrators and are not persisted after resolution.
 * </ol>
 */
@Component
public class WeaverPlaceholderResolver {

    private static final Logger LOGGER = LoggerFactory.getLogger(WeaverPlaceholderResolver.class);

    public static final String ENV_PREFIX = "weaver.env.";
    public static final String SECRETS_PREFIX = "weaver.secrets.";

    /** Replacement used when a resolved secret value appears in data that is about to be stored. */
    public static final String MASK = "******";

    /**
     * Shorter secret values are not masked: replacing every occurrence of a 1-3 character string
     * would corrupt unrelated output. Such values are reported once per resolution as a warning.
     */
    public static final int MIN_MASKED_LENGTH = 4;

    /** An unescaped secret reference. The name rule is shared with the secrets API and UI. */
    private static final Pattern SECRET_REF =
            Pattern.compile(
                    "(?<!\\$)\\$\\{weaver\\.secrets\\.("
                            + SecretPlaceholderParser.NAME_REGEX
                            + ")}");

    /** An unescaped secret reference, used to escape secret text found inside data values. */
    private static final Pattern UNESCAPED_SECRET_START =
            Pattern.compile("(?<!\\$)\\$\\{weaver\\.secrets\\.");

    /** An unescaped env reference inside configuration text. Nested placeholders are rejected. */
    private static final Pattern ENV_REF = Pattern.compile("(?<!\\$)\\$\\{weaver\\.env\\.([^${}]+)}");

    private static final Pattern ENV_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private static final String ESCAPED_SECRET_START = "$${weaver.secrets.";
    private static final String SECRET_START = "${weaver.secrets.";

    @Nullable private final EnvironmentDAO environmentDAO;
    @Nullable private final SecretsDAO secretsDAO;
    @Nullable private final Cache<String, String> secretCache;

    @Autowired
    public WeaverPlaceholderResolver(
            @Nullable EnvironmentDAO environmentDAO,
            @Nullable SecretsDAO secretsDAO,
            @Value("${weaver.secrets.cache-ttl:30m}") Duration secretCacheTtl) {
        this.environmentDAO = environmentDAO;
        this.secretsDAO = secretsDAO;
        this.secretCache =
                secretCacheTtl == null || secretCacheTtl.isZero() || secretCacheTtl.isNegative()
                        ? null
                        : Caffeine.newBuilder()
                                .expireAfterWrite(secretCacheTtl)
                                .maximumSize(10_000)
                                .build();
    }

    // ---------------------------------------------------------------------------------------
    // weaver.env
    // ---------------------------------------------------------------------------------------

    /**
     * Resolves the part of an env placeholder after {@code weaver.env.}, i.e. {@code
     * NAME[.json.path][:default]}. The default is everything after the first {@code :}, so it may
     * itself contain colons (for example a URL).
     *
     * @return the value, the extracted JSON value, the default, or {@code null}
     */
    @Nullable
    public Object resolveEnv(String expression) {
        String body = expression == null ? "" : expression;
        String defaultValue = null;
        int colon = body.indexOf(':');
        if (colon >= 0) {
            defaultValue = body.substring(colon + 1);
            body = body.substring(0, colon);
        }
        int dot = body.indexOf('.');
        String name = dot < 0 ? body : body.substring(0, dot);
        String jsonPath = dot < 0 ? null : body.substring(dot + 1);

        if (!ENV_NAME.matcher(name).matches()) {
            LOGGER.warn("Invalid weaver.env variable name '{}'", name);
            return defaultValue;
        }
        String raw = environmentDAO == null ? null : environmentDAO.getEnvVariable(name);
        if (raw == null || raw.isEmpty()) {
            return defaultValue;
        }
        if (jsonPath == null || jsonPath.isBlank()) {
            return raw;
        }
        try {
            Object extracted = JsonPath.parse(raw).read(jsonPath);
            return extracted != null ? extracted : defaultValue;
        } catch (Exception e) {
            // Not JSON, or the path does not exist: both fall back to the default.
            LOGGER.debug("weaver.env.{}: JSON path '{}' not resolved: {}", name, jsonPath, e.toString());
            return defaultValue;
        }
    }

    // ---------------------------------------------------------------------------------------
    // weaver.secrets
    // ---------------------------------------------------------------------------------------

    /** Returns the secret value, served from the cache when present. Misses are not cached. */
    @Nullable
    public String getSecret(String name) {
        if (secretsDAO == null || name == null) {
            return null;
        }
        if (secretCache == null) {
            return secretsDAO.getSecret(name);
        }
        String cached = secretCache.getIfPresent(name);
        if (cached != null) {
            return cached;
        }
        String value = secretsDAO.getSecret(name);
        if (value != null) {
            secretCache.put(name, value);
        }
        return value;
    }

    /** Drops one secret from this node's cache. Other nodes refresh when their TTL expires. */
    public void invalidateSecret(String name) {
        if (secretCache != null && name != null) {
            secretCache.invalidate(name);
        }
    }

    public void invalidateAllSecrets() {
        if (secretCache != null) {
            secretCache.invalidateAll();
        }
    }

    /** Input with secrets resolved, plus the values that were used (for masking afterwards). */
    public record SecretResolution(Map<String, Object> input, Set<String> secretValues) {
        public static SecretResolution unchanged(Map<String, Object> input) {
            return new SecretResolution(input, Collections.emptySet());
        }
    }

    /**
     * Resolves {@code ${weaver.secrets.NAME}} in every string of the input and returns a new
     * structure; the input is never mutated, and is returned as-is when it holds no reference.
     * Escaped references ({@code $${weaver.secrets.NAME}}, produced when data containing secret
     * text was inserted at schedule time) are not resolved; they are unescaped back to their
     * literal text.
     */
    public SecretResolution resolveSecrets(Map<String, Object> input) {
        if (input == null || secretsDAO == null) {
            return SecretResolution.unchanged(input);
        }
        Set<String> used = new LinkedHashSet<>();
        @SuppressWarnings("unchecked")
        Map<String, Object> resolved = (Map<String, Object>) resolveSecretsValue(input, used);
        warnUnmaskable(used);
        return new SecretResolution(resolved, used);
    }

    /**
     * Looks up the values of the unescaped secret references in a literal (unresolved) input. Used
     * to mask results that external workers report back, since those workers received the
     * resolved input.
     */
    public Set<String> referencedSecretValues(Map<String, Object> literalInput) {
        if (literalInput == null || secretsDAO == null) {
            return Collections.emptySet();
        }
        Set<String> names = new LinkedHashSet<>();
        collectSecretNames(literalInput, names);
        Set<String> values = new LinkedHashSet<>();
        for (String name : names) {
            String value = getSecret(name);
            if (value != null) {
                values.add(value);
            }
        }
        return values;
    }

    private Object resolveSecretsValue(Object value, Set<String> used) {
        if (value instanceof String str) {
            return resolveSecretString(str, used);
        }
        if (value instanceof Map<?, ?> map) {
            Map<Object, Object> copy = null;
            for (Map.Entry<?, ?> e : map.entrySet()) {
                Object original = e.getValue();
                Object substituted = resolveSecretsValue(original, used);
                if (substituted != original) {
                    if (copy == null) {
                        copy = new HashMap<>(map);
                    }
                    copy.put(e.getKey(), substituted);
                }
            }
            return copy == null ? map : copy;
        }
        if (value instanceof List<?> list) {
            List<Object> copy = null;
            for (int i = 0; i < list.size(); i++) {
                Object original = list.get(i);
                Object substituted = resolveSecretsValue(original, used);
                if (substituted != original) {
                    if (copy == null) {
                        copy = new ArrayList<>(list);
                    }
                    copy.set(i, substituted);
                }
            }
            return copy == null ? list : copy;
        }
        return value;
    }

    private Object resolveSecretString(String str, Set<String> used) {
        if (!str.contains("{weaver.secrets.")) {
            return str; // fast path: no reference, same instance, no allocation
        }
        Matcher whole = SECRET_REF.matcher(str);
        if (whole.matches()) {
            String value = lookupSecretForTask(whole.group(1));
            if (value != null) {
                used.add(value);
            }
            return value;
        }
        Matcher m = SECRET_REF.matcher(str);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String value = lookupSecretForTask(m.group(1));
            if (value != null) {
                used.add(value);
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(value == null ? "" : value));
        }
        m.appendTail(sb);
        return sb.toString().replace(ESCAPED_SECRET_START, SECRET_START);
    }

    private String lookupSecretForTask(String name) {
        String value = getSecret(name);
        if (value == null) {
            LOGGER.warn("Secret '{}' referenced by a task was not found", name);
        }
        return value;
    }

    private static void collectSecretNames(Object value, Set<String> names) {
        if (value instanceof String str) {
            if (str.contains("{weaver.secrets.")) {
                Matcher m = SECRET_REF.matcher(str);
                while (m.find()) {
                    names.add(m.group(1));
                }
            }
        } else if (value instanceof Map<?, ?> map) {
            map.values().forEach(v -> collectSecretNames(v, names));
        } else if (value instanceof Collection<?> collection) {
            collection.forEach(v -> collectSecretNames(v, names));
        }
    }

    // ---------------------------------------------------------------------------------------
    // Escaping data that is inserted at schedule time
    // ---------------------------------------------------------------------------------------

    /**
     * Escapes secret references inside a data value (workflow input, task output, variables, env
     * values) as it is inserted into task input at schedule time. Only text written in the workflow
     * definition may reference secrets; data that happens to contain {@code
     * ${weaver.secrets.NAME}} is kept as literal text and never resolved. Returns the same
     * instance when nothing needs escaping.
     */
    public static Object escapeSecretReferences(Object value) {
        if (value instanceof String str) {
            if (!str.contains(SECRET_START)) {
                return str;
            }
            return UNESCAPED_SECRET_START.matcher(str).replaceAll(Matcher.quoteReplacement(ESCAPED_SECRET_START));
        }
        if (value instanceof Map<?, ?> map) {
            Map<Object, Object> copy = null;
            for (Map.Entry<?, ?> e : map.entrySet()) {
                Object original = e.getValue();
                Object escaped = escapeSecretReferences(original);
                if (escaped != original) {
                    if (copy == null) {
                        copy = new HashMap<>(map);
                    }
                    copy.put(e.getKey(), escaped);
                }
            }
            return copy == null ? map : copy;
        }
        if (value instanceof List<?> list) {
            List<Object> copy = null;
            for (int i = 0; i < list.size(); i++) {
                Object original = list.get(i);
                Object escaped = escapeSecretReferences(original);
                if (escaped != original) {
                    if (copy == null) {
                        copy = new ArrayList<>(list);
                    }
                    copy.set(i, escaped);
                }
            }
            return copy == null ? list : copy;
        }
        return value;
    }

    // ---------------------------------------------------------------------------------------
    // Masking
    // ---------------------------------------------------------------------------------------

    /**
     * Masks resolved secret values in the parts of a task that are persisted and shown to users:
     * output data and the failure reason. No-op when there are no values.
     */
    @SuppressWarnings("unchecked")
    public void maskTask(TaskModel task, Set<String> secretValues) {
        List<String> values = maskableValues(secretValues);
        if (task == null || values.isEmpty()) {
            return;
        }
        Map<String, Object> output = task.getOutputData();
        if (output != null && !output.isEmpty()) {
            Object masked = maskValue(output, values);
            if (masked != output) {
                task.setOutputData((Map<String, Object>) masked);
            }
        }
        String reason = task.getReasonForIncompletion();
        if (reason != null) {
            task.setReasonForIncompletion(maskString(reason, values));
        }
    }

    /** Masks resolved secret values in workflow variables. No-op when there are no values. */
    @SuppressWarnings("unchecked")
    public void maskVariables(WorkflowModel workflow, Set<String> secretValues) {
        List<String> values = maskableValues(secretValues);
        if (workflow == null || values.isEmpty() || workflow.getVariables() == null) {
            return;
        }
        Object masked = maskValue(workflow.getVariables(), values);
        if (masked != workflow.getVariables()) {
            workflow.setVariables((Map<String, Object>) masked);
        }
    }

    /** Values long enough to mask, longest first so overlapping secrets are fully covered. */
    private static List<String> maskableValues(Set<String> secretValues) {
        if (secretValues == null || secretValues.isEmpty()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (String v : secretValues) {
            if (v != null && v.length() >= MIN_MASKED_LENGTH) {
                values.add(v);
            }
        }
        values.sort(Comparator.comparingInt(String::length).reversed());
        return values;
    }

    private static Object maskValue(Object value, List<String> secrets) {
        if (value instanceof String str) {
            return maskString(str, secrets);
        }
        if (value instanceof Map<?, ?> map) {
            Map<Object, Object> copy = null;
            for (Map.Entry<?, ?> e : map.entrySet()) {
                Object original = e.getValue();
                Object masked = maskValue(original, secrets);
                if (masked != original) {
                    if (copy == null) {
                        copy = new HashMap<>(map);
                    }
                    copy.put(e.getKey(), masked);
                }
            }
            return copy == null ? map : copy;
        }
        if (value instanceof List<?> list) {
            List<Object> copy = null;
            for (int i = 0; i < list.size(); i++) {
                Object original = list.get(i);
                Object masked = maskValue(original, secrets);
                if (masked != original) {
                    if (copy == null) {
                        copy = new ArrayList<>(list);
                    }
                    copy.set(i, masked);
                }
            }
            return copy == null ? list : copy;
        }
        return value;
    }

    private static String maskString(String str, List<String> secrets) {
        String result = str;
        for (String secret : secrets) {
            if (result.contains(secret)) {
                result = result.replace(secret, MASK);
            }
        }
        // Return the original instance when nothing changed so callers can detect no-ops.
        return result.equals(str) ? str : result;
    }

    private static void warnUnmaskable(Set<String> used) {
        for (String v : used) {
            if (v != null && v.length() < MIN_MASKED_LENGTH) {
                LOGGER.warn(
                        "A resolved secret is shorter than {} characters and will not be masked in task output",
                        MIN_MASKED_LENGTH);
                return;
            }
        }
    }

    // ---------------------------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------------------------

    /**
     * Resolves {@code ${weaver.env...}} and {@code ${weaver.secrets...}} in administrator-authored
     * configuration text (datasource settings, HTTP connection settings, saved-query SQL). Missing
     * values become empty text. Escaped {@code $${weaver...}} placeholders are kept as literal
     * text.
     */
    @Nullable
    public String resolveConfig(@Nullable String value) {
        if (value == null || !value.contains("{weaver.")) {
            return value;
        }
        String withEnv = resolveEnvReferences(value);
        Matcher m = SECRET_REF.matcher(withEnv);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String secret = getSecret(m.group(1));
            if (secret == null) {
                LOGGER.warn("Secret '{}' referenced by configuration was not found", m.group(1));
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(secret == null ? "" : secret));
        }
        m.appendTail(sb);
        return unescapeWeaver(sb.toString());
    }

    /** {@link #resolveConfig(String)} applied to every string in a map or list (values only). */
    public Object resolveConfigDeep(Object value) {
        if (value instanceof String str) {
            return resolveConfig(str);
        }
        if (value instanceof Map<?, ?> map) {
            Map<Object, Object> copy = new java.util.LinkedHashMap<>();
            map.forEach((k, v) -> copy.put(k, resolveConfigDeep(v)));
            return copy;
        }
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>(list.size());
            list.forEach(v -> copy.add(resolveConfigDeep(v)));
            return copy;
        }
        return value;
    }

    /**
     * Resolves only {@code ${weaver.env...}} in administrator-authored text that is returned to
     * clients (for example message templates), where secrets must not be expanded.
     */
    @Nullable
    public String resolveEnvOnly(@Nullable String value) {
        if (value == null || !value.contains("{weaver.env.")) {
            return value;
        }
        return resolveEnvReferences(value).replace("$${weaver.env.", "${weaver.env.");
    }

    private String resolveEnvReferences(String value) {
        if (!value.contains("{weaver.env.")) {
            return value;
        }
        Matcher m = ENV_REF.matcher(value);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            Object resolved = resolveEnv(m.group(1));
            m.appendReplacement(sb, Matcher.quoteReplacement(resolved == null ? "" : String.valueOf(resolved)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String unescapeWeaver(String value) {
        return value.replace("$${weaver.", "${weaver.");
    }
}
