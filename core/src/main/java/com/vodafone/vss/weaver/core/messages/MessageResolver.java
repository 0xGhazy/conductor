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
package com.vodafone.vss.weaver.core.messages;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.core.placeholders.WeaverPlaceholderResolver;
import com.vodafone.vss.weaver.model.WorkflowModel;

/**
 * Resolves a workflow message code to text in the caller's language.
 *
 * <p><b>Language</b>, first match wins:
 *
 * <ol>
 *   <li>the explicit language given to {@link #resolve} (e.g. a task's {@code languageCode});
 *   <li>the workflow input {@code _language} (filled from the {@code Accept-Language} header);
 *   <li>the workflow definition's {@code metadata.defaultLanguage};
 *   <li>the system default, {@code weaver.translations.default-language} (default {@code en-US}).
 * </ol>
 *
 * Each candidate matches a stored language ignoring case, then by primary language (a request for
 * {@code ar} or {@code ar-SA} finds {@code ar-EG}). If no candidate matches, a {@code "default"}
 * entry is used, then the first language in alphabetical order. A message with no translations at
 * all resolves to its code.
 *
 * <p><b>Template</b>: {@code ${weaver.env...}} is resolved first (never secrets: messages are
 * returned to clients). Then {@code ${path}} placeholders are filled from {@code workflow.input},
 * {@code input} (same as {@code workflow.input}), {@code variables}, and the top-level keys of the
 * variables map; unknown placeholders are left as written. Values are inserted as text and never
 * scanned again.
 */
@Component
public class MessageResolver {

    private static final Logger LOGGER = LoggerFactory.getLogger(MessageResolver.class);

    public static final String LANGUAGE_INPUT_KEY = "_language";
    public static final String DEFAULT_LANGUAGE_METADATA_KEY = "defaultLanguage";
    private static final String DEFAULT_KEY = "default";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{([^}]+)\\}");

    @Nullable private final MessageCatalog catalog;
    @Nullable private final WeaverPlaceholderResolver placeholders;
    private final String systemDefaultLanguage;

    @Autowired
    public MessageResolver(
            @Nullable MessageCatalog catalog,
            @Nullable WeaverPlaceholderResolver placeholders,
            @Value("${weaver.translations.default-language:en-US}") String systemDefaultLanguage) {
        this.catalog = catalog;
        this.placeholders = placeholders;
        this.systemDefaultLanguage = systemDefaultLanguage;
    }

    /** Result of resolving a message: the code, the language actually used, and the text. */
    public record ResolvedMessage(String messageCode, String languageCode, String message, boolean translated) {}

    /**
     * @param workflow the running workflow (name, version, input and definition metadata are used)
     * @param messageCode the message to resolve
     * @param requestedLanguage explicit language, or {@code null}/blank to use the workflow's
     * @param variables values available to the template as {@code ${variables.x}} and {@code ${x}}
     */
    public ResolvedMessage resolve(
            WorkflowModel workflow,
            String messageCode,
            @Nullable String requestedLanguage,
            @Nullable Map<String, Object> variables) {
        List<String> candidates = languageCandidates(workflow, requestedLanguage);
        Map<String, String> templates = findTemplates(workflow, messageCode);

        if (templates.isEmpty()) {
            LOGGER.debug(
                    "No translation for message '{}' in workflow {} v{}",
                    messageCode,
                    workflow.getWorkflowName(),
                    workflow.getWorkflowVersion());
            return new ResolvedMessage(messageCode, candidates.get(0), messageCode, false);
        }

        Map.Entry<String, String> chosen = choose(templates, candidates);
        String template = chosen.getValue();
        if (placeholders != null) {
            template = placeholders.resolveEnvOnly(template);
        }
        String message = fill(template, context(workflow, variables));
        return new ResolvedMessage(messageCode, chosen.getKey(), message, true);
    }

    private Map<String, String> findTemplates(WorkflowModel workflow, String messageCode) {
        if (catalog == null || messageCode == null || workflow.getWorkflowName() == null) {
            return Map.of();
        }
        Map<String, String> templates =
                catalog.findMessage(workflow.getWorkflowName(), workflow.getWorkflowVersion(), messageCode);
        if (templates == null) {
            return Map.of();
        }
        Map<String, String> usable = new HashMap<>();
        templates.forEach(
                (language, text) -> {
                    if (language != null && text != null && !text.isBlank()) {
                        usable.put(language, text);
                    }
                });
        return usable;
    }

    /** Requested language, workflow input, workflow default, system default; blanks skipped. */
    private List<String> languageCandidates(WorkflowModel workflow, @Nullable String requestedLanguage) {
        List<String> candidates = new ArrayList<>();
        addCandidate(candidates, requestedLanguage);
        if (workflow.getInput() != null) {
            addCandidate(candidates, workflow.getInput().get(LANGUAGE_INPUT_KEY));
        }
        if (workflow.getWorkflowDefinition() != null
                && workflow.getWorkflowDefinition().getMetadata() != null) {
            addCandidate(
                    candidates,
                    workflow.getWorkflowDefinition().getMetadata().get(DEFAULT_LANGUAGE_METADATA_KEY));
        }
        addCandidate(candidates, systemDefaultLanguage);
        if (candidates.isEmpty()) {
            candidates.add("en-US");
        }
        return candidates;
    }

    private static void addCandidate(List<String> candidates, @Nullable Object value) {
        if (value == null) {
            return;
        }
        String language = String.valueOf(value).trim();
        // An unresolved "${...}" means the workflow didn't provide it.
        if (!language.isEmpty() && !language.startsWith("${") && !candidates.contains(language)) {
            candidates.add(language);
        }
    }

    private static Map.Entry<String, String> choose(Map<String, String> templates, List<String> candidates) {
        for (String candidate : candidates) {
            Map.Entry<String, String> match = match(templates, candidate);
            if (match != null) {
                return match;
            }
        }
        if (templates.containsKey(DEFAULT_KEY)) {
            return Map.entry(DEFAULT_KEY, templates.get(DEFAULT_KEY));
        }
        // Deterministic last resort: the first language alphabetically.
        return new TreeMap<>(templates).firstEntry();
    }

    /** Exact match ignoring case, then same primary language (ar-SA -> ar-EG, ar -> ar-EG). */
    private static Map.Entry<String, String> match(Map<String, String> templates, String candidate) {
        for (Map.Entry<String, String> entry : templates.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(candidate)) {
                return entry;
            }
        }
        String primary = primaryLanguage(candidate);
        return new TreeMap<>(templates)
                .entrySet().stream()
                        .filter(e -> primaryLanguage(e.getKey()).equals(primary))
                        .findFirst()
                        .orElse(null);
    }

    private static String primaryLanguage(String tag) {
        String language = Locale.forLanguageTag(tag.replace('_', '-')).getLanguage();
        return language.isEmpty() ? tag.toLowerCase(Locale.ROOT) : language;
    }

    private static Map<String, Object> context(WorkflowModel workflow, @Nullable Map<String, Object> variables) {
        Map<String, Object> context = new HashMap<>();
        Map<String, Object> input = workflow.getInput() != null ? workflow.getInput() : Map.of();
        context.put("workflow", Map.of("input", input));
        context.put("input", input);
        if (variables != null) {
            context.putAll(variables);
            context.put("variables", variables);
        }
        return context;
    }

    private static String fill(String template, Map<String, Object> context) {
        if (template == null || !template.contains("${")) {
            return template;
        }
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            Object value = lookup(matcher.group(1).trim(), context);
            String replacement = value != null ? String.valueOf(value) : matcher.group(0);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private static Object lookup(String path, Map<String, Object> context) {
        if (context.containsKey(path)) {
            return context.get(path);
        }
        Object current = context;
        for (String part : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> map)) {
                return null;
            }
            current = map.get(part);
        }
        return current;
    }
}
