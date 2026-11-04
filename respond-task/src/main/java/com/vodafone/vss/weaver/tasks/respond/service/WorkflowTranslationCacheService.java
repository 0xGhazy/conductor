/*
 * Copyright 2026 Weaver Contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.vodafone.vss.weaver.tasks.respond.service;

import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.respond.TranslationModel;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * Per-workflow-version cache of translations, shaped as message code to (language code to text).
 *
 * <p>Empty results are cached too, so workflows without translations don't query the database on
 * every lookup. Changes made through the API refresh this node's entry immediately; other nodes
 * see them when their entry expires ({@code weaver.translations.cache-ttl}).
 */
@Service
public class WorkflowTranslationCacheService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowTranslationCacheService.class);

    private final WorkflowTranslationDAO translationDAO;
    private final Cache<String, Map<String, Map<String, String>>> cache;

    @Autowired
    public WorkflowTranslationCacheService(
            WorkflowTranslationDAO translationDAO,
            @Value("${weaver.translations.cache-ttl:24h}") Duration ttl) {
        this.translationDAO = translationDAO;
        this.cache = Caffeine.newBuilder().expireAfterWrite(ttl).maximumSize(10_000).build();
    }

    /** Uses the default 24 hour expiry. */
    public WorkflowTranslationCacheService(WorkflowTranslationDAO translationDAO) {
        this(translationDAO, Duration.ofHours(24));
    }

    public static String computeKey(String workflowName, Integer version) {
        return String.format("%s:%d", workflowName, version != null ? version : 1);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Warming up workflow translations cache...");
        loadAllTranslationsToCache();
    }

    /**
     * Replaces the whole cache with the current table contents, so entries deleted from the
     * table don't survive a reload. Synchronized with {@link #updateWorkflowCache} so a reload
     * and an update can't interleave and leave older text behind.
     */
    public synchronized void loadAllTranslationsToCache() {
        try {
            Map<String, Map<String, Map<String, String>>> byWorkflow = new HashMap<>();
            for (TranslationModel row : translationDAO.findAll()) {
                byWorkflow
                        .computeIfAbsent(
                                computeKey(row.getWorkflowName(), row.getWorkflowVersion()),
                                k -> new LinkedHashMap<>())
                        .computeIfAbsent(row.getMessageCode(), k -> new LinkedHashMap<>())
                        .put(row.getLanguageCode(), row.getMessage());
            }
            cache.invalidateAll();
            byWorkflow.forEach((key, messages) -> cache.put(key, freeze(messages)));
            log.info("Loaded translations for {} workflow version(s) into cache", byWorkflow.size());
        } catch (Exception ex) {
            log.error("Failed to load workflow translations into cache", ex);
        }
    }

    /** Re-reads one workflow version from the database into this node's cache. */
    public synchronized void updateWorkflowCache(String workflowName, Integer version) {
        if (workflowName == null || version == null) {
            return;
        }
        cache.put(computeKey(workflowName, version), load(workflowName, version));
    }

    /** Message code to (language code to text) for one workflow version; empty if none. */
    public Map<String, Map<String, String>> getTranslations(String workflowName, Integer version) {
        if (workflowName == null || version == null) {
            return Collections.emptyMap();
        }
        return cache.get(computeKey(workflowName, version), k -> load(workflowName, version));
    }

    public void clear() {
        cache.invalidateAll();
    }

    private Map<String, Map<String, String>> load(String workflowName, int version) {
        List<TranslationModel> rows = translationDAO.findByWorkflow(workflowName, version);
        return freeze(group(rows));
    }

    static Map<String, Map<String, String>> group(List<TranslationModel> rows) {
        Map<String, Map<String, String>> messages = new LinkedHashMap<>();
        for (TranslationModel row : rows) {
            messages.computeIfAbsent(row.getMessageCode(), k -> new LinkedHashMap<>())
                    .put(row.getLanguageCode(), row.getMessage());
        }
        return messages;
    }

    /** Cached maps are shared between callers, so they are made read-only. */
    private static Map<String, Map<String, String>> freeze(Map<String, Map<String, String>> messages) {
        Map<String, Map<String, String>> frozen = new LinkedHashMap<>();
        messages.forEach((code, langs) -> frozen.put(code, Collections.unmodifiableMap(langs)));
        return Collections.unmodifiableMap(frozen);
    }
}
