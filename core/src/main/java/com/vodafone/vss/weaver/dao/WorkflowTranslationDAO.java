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
package com.vodafone.vss.weaver.dao;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.vodafone.vss.weaver.common.respond.TranslationModel;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationModel;
import com.vodafone.vss.weaver.common.response.PageResult;

/**
 * Access to the {@code translations} table: one row per (workflow name, workflow version, message
 * code, language). A "message" is the set of rows sharing workflow name, version and message code.
 */
public interface WorkflowTranslationDAO {

    /** All rows of one workflow version, ordered by message code and language. */
    List<TranslationModel> findByWorkflow(String workflowName, int workflowVersion);

    /** All rows (languages) of one message, ordered by language. */
    List<TranslationModel> findByMessage(String workflowName, int workflowVersion, String messageCode);

    Optional<TranslationModel> findById(UUID id);

    boolean messageExists(String workflowName, int workflowVersion, String messageCode);

    /**
     * Makes the stored languages of one message exactly {@code messages} (language code to text),
     * in one transaction: languages not in the map are deleted, new ones inserted, changed ones
     * updated. Rows whose text is unchanged are left untouched.
     *
     * @param actorId the user making the change, or {@code null}
     */
    void saveMessage(
            String workflowName,
            int workflowVersion,
            String messageCode,
            Map<String, String> messages,
            UUID actorId);

    /** Deletes every language of one message. Returns the number of rows deleted. */
    int deleteMessage(String workflowName, int workflowVersion, String messageCode);

    /** Number of rows using the given language code. */
    long countByLanguage(String languageCode);

    List<TranslationModel> findAll();

    /** Page of messages (grouped rows), filtered and sorted. */
    PageResult<WorkflowTranslationModel> searchMessages(
            String workflowName,
            Integer workflowVersion,
            String search,
            int page,
            int size,
            String sortBy,
            String sortOrder);
}
