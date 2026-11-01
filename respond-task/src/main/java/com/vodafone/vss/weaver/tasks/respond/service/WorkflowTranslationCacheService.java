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
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.respond.WorkflowTranslationModel;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

@Service
public class WorkflowTranslationCacheService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowTranslationCacheService.class);
    private static final Duration DEFAULT_TTL = Duration.ofHours(24);

    private final WorkflowTranslationDAO translationDAO;
    private final Cache<String, Map<String, Map<String, String>>> cache;

    public WorkflowTranslationCacheService(WorkflowTranslationDAO translationDAO) {
        this.translationDAO = translationDAO;
        this.cache =
                Caffeine.newBuilder()
                        .expireAfterWrite(DEFAULT_TTL)
                        .maximumSize(10_000)
                        .build();
    }

    public static String computeKey(String workflowName, Integer version) {
        return String.format("%s:%d", workflowName, version != null ? version : 1);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Warming up workflow translations cache...");
        loadAllTranslationsToCache();
    }

    public synchronized void loadAllTranslationsToCache() {
        try {
            List<WorkflowTranslationModel> all = translationDAO.findAll();
            if (all.isEmpty()) {
                log.info("No workflow translations found in database to cache");
                return;
            }

            Map<String, List<WorkflowTranslationModel>> grouped =
                    all.stream()
                            .collect(
                                    Collectors.groupingBy(
                                            t -> computeKey(t.getWorkflowName(), t.getWorkflowVersion())));

            for (Map.Entry<String, List<WorkflowTranslationModel>> entry : grouped.entrySet()) {
                String cacheKey = entry.getKey();
                Map<String, Map<String, String>> translationMap = new HashMap<>();

                for (WorkflowTranslationModel wt : entry.getValue()) {
                    if (wt.getMessageCode() != null && wt.getTranslations() != null) {
                        translationMap.put(wt.getMessageCode(), wt.getTranslations());
                    }
                }

                if (!translationMap.isEmpty()) {
                    cache.put(cacheKey, translationMap);
                }
            }

            log.info("Successfully loaded {} translation groups into cache", grouped.size());
        } catch (Exception ex) {
            log.error("Failed to load workflow translations to cache during startup", ex);
        }
    }

    public void updateWorkflowCache(String workflowName, Integer version) {
        if (workflowName == null || version == null) {
            return;
        }
        String cacheKey = computeKey(workflowName, version);
        List<WorkflowTranslationModel> list =
                translationDAO.findByWorkflowNameAndVersion(workflowName, version);

        if (list.isEmpty()) {
            cache.invalidate(cacheKey);
            log.debug("Evicted cache for key: {}", cacheKey);
            return;
        }

        Map<String, Map<String, String>> translationMap = new HashMap<>();
        for (WorkflowTranslationModel wt : list) {
            if (wt.getMessageCode() != null && wt.getTranslations() != null) {
                translationMap.put(wt.getMessageCode(), wt.getTranslations());
            }
        }

        cache.put(cacheKey, translationMap);
        log.debug("Updated cache for key: {}", cacheKey);
    }

    public Map<String, Map<String, String>> getTranslations(String workflowName, Integer version) {
        if (workflowName == null || version == null) {
            return Collections.emptyMap();
        }
        String cacheKey = computeKey(workflowName, version);
        Map<String, Map<String, String>> cached = cache.getIfPresent(cacheKey);
        if (cached != null) {
            return cached;
        }

        List<WorkflowTranslationModel> list =
                translationDAO.findByWorkflowNameAndVersion(workflowName, version);
        if (list.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, Map<String, String>> translationMap = new HashMap<>();
        for (WorkflowTranslationModel wt : list) {
            if (wt.getMessageCode() != null && wt.getTranslations() != null) {
                translationMap.put(wt.getMessageCode(), wt.getTranslations());
            }
        }

        cache.put(cacheKey, translationMap);
        return translationMap;
    }

    public void clear() {
        cache.invalidateAll();
    }
}

