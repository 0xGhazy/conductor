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

import java.util.Map;

import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.core.messages.MessageCatalog;

/**
 * Serves workflow messages to core tasks (TERMINATE) from the translations cache.
 *
 * <p>Lives here with the translation services for now; it moves with them when translations get
 * their own module (task list, Task 12).
 */
@Component
public class TranslationMessageCatalog implements MessageCatalog {

    private final WorkflowTranslationCacheService cache;

    public TranslationMessageCatalog(WorkflowTranslationCacheService cache) {
        this.cache = cache;
    }

    @Override
    public Map<String, String> findMessage(String workflowName, int workflowVersion, String messageCode) {
        Map<String, String> languages = cache.getTranslations(workflowName, workflowVersion).get(messageCode);
        return languages != null ? languages : Map.of();
    }
}
