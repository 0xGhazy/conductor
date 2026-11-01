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
package com.vodafone.vss.weaver.tasks.scripting.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptBulkDeleteResponse;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionRequest;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionResponse;
import com.vodafone.vss.weaver.common.scripting.ScriptModel;
import com.vodafone.vss.weaver.common.scripting.ScriptPageResponse;
import com.vodafone.vss.weaver.dao.ScriptDAO;

import static com.vodafone.vss.weaver.common.ExceptionUtils.throwBadInputs;

@Service
public class ScriptService {

    private static final Logger log = LoggerFactory.getLogger(ScriptService.class);
    private static final int DEFAULT_TIMEOUT_MS = 3000;

    private final ScriptDAO scriptDAO;

    public ScriptService(ScriptDAO scriptDAO) {
        this.scriptDAO = scriptDAO;
    }

    public ScriptPageResponse findAll(Languages language, String search, Pageable pageable) {
        String sortBy = "created_at";
        String sortOrder = "DESC";
        if (pageable.getSort().isSorted()) {
            Sort.Order order = pageable.getSort().iterator().next();
            sortBy = order.getProperty();
            sortOrder = order.getDirection().name();
        }

        PageResult<ScriptModel> pageResult = scriptDAO.search(
                normalizeSearch(search),
                pageable.getPageNumber(),
                pageable.getPageSize(),
                sortBy,
                sortOrder);

        if (language != null) {
            List<ScriptModel> filtered = pageResult.content().stream()
                    .filter(s -> s.getLanguage() == language)
                    .toList();
            pageResult = PageResult.of(
                    filtered,
                    filtered.size(),
                    pageable.getPageNumber(),
                    pageable.getPageSize());
        }

        log.debug("script_definitions_loaded count={} total={} language={} page={} size={} search={}",
                pageResult.content().size(),
                pageResult.pagination().getTotalElements(),
                language,
                pageable.getPageNumber(),
                pageable.getPageSize(),
                search);

        return ScriptPageResponse.from(pageResult);
    }

    public ScriptDefinitionResponse findById(UUID id) {
        return ScriptDefinitionResponse.fromModel(findEntityById(id));
    }

    public ScriptDefinitionResponse create(@Valid ScriptDefinitionRequest payload) {
        String name = normalizeUniqueName(payload.name());

        ScriptModel entity = ScriptModel.builder()
                .name(name)
                .description(payload.description())
                .script(payload.script())
                .language(payload.language())
                .variables(resolveVariables(payload.variables()))
                .timeout(resolveTimeout(payload.timeout()))
                .createdAt(Instant.now())
                .build();

        ScriptModel saved = scriptDAO.create(entity);
        log.info("script_definition_created id={} name={} language={}", saved.getId(), saved.getName(), saved.getLanguage());
        return ScriptDefinitionResponse.fromModel(saved);
    }

    public ScriptDefinitionResponse update(UUID id, @Valid ScriptDefinitionRequest payload) {
        ScriptModel existing = findEntityById(id);
        String name = normalizeName(payload.name());
        Optional<ScriptModel> nameOwner = scriptDAO.findByName(name);
        if (nameOwner.isPresent() && !nameOwner.get().getId().equals(id)) {
            throw ExceptionUtils.throwAlreadyExist("Script name already exists");
        }

        existing.setName(name);
        existing.setDescription(payload.description());
        existing.setScript(payload.script());
        existing.setLanguage(payload.language());
        existing.setVariables(resolveVariables(payload.variables()));
        existing.setTimeout(resolveTimeout(payload.timeout()));
        existing.setUpdatedAt(Instant.now());

        ScriptModel saved = scriptDAO.update(existing);
        log.info("script_definition_updated id={} name={} language={}", saved.getId(), saved.getName(), saved.getLanguage());
        return ScriptDefinitionResponse.fromModel(saved);
    }

    public void delete(UUID id) {
        findEntityById(id);
        scriptDAO.deleteById(id);
        log.info("script_definition_deleted id={}", id);
    }

    public ScriptBulkDeleteResponse deleteBulk(List<UUID> ids) {
        List<UUID> uniqueIds = ids == null ? List.of() : ids.stream()
                .filter(id -> id != null)
                .distinct()
                .toList();

        if (uniqueIds.isEmpty()) {
            throw throwBadInputs("Invalid script ids", "At least one script id is required");
        }

        int deletedCount = scriptDAO.deleteByIds(uniqueIds);
        log.info("script_definitions_bulk_deleted count={} ids={}", deletedCount, uniqueIds);
        return new ScriptBulkDeleteResponse(deletedCount, uniqueIds);
    }

    private ScriptModel findEntityById(UUID id) {
        if (id == null) {
            throw ExceptionUtils.throwNotFound("Script id cannot be null");
        }
        return scriptDAO.findById(id)
                .orElseThrow(() -> ExceptionUtils.throwNotFound("Script not found with id: " + id));
    }

    private String normalizeUniqueName(String name) {
        String normalizedName = normalizeName(name);
        if (scriptDAO.existsByName(normalizedName)) {
            throw ExceptionUtils.throwAlreadyExist("Script name already exists: " + normalizedName);
        }
        return normalizedName;
    }

    private String normalizeName(String name) {
        String normalizedName = name == null ? "" : name.trim().toLowerCase();
        if (normalizedName.isBlank()) {
            throw throwBadInputs("Invalid script name", "Script name can not be empty");
        }
        if (normalizedName.matches(".*\\s+.*")) {
            throw throwBadInputs("Invalid script name", "Script name contains whitespaces");
        }
        return normalizedName;
    }

    private Map<String, Object> resolveVariables(Map<String, Object> variables) {
        return variables == null ? Map.of() : variables;
    }

    private Integer resolveTimeout(Integer timeout) {
        return timeout == null ? DEFAULT_TIMEOUT_MS : timeout;
    }

    private String normalizeSearch(String search) {
        return search == null ? "" : search.trim();
    }
}

