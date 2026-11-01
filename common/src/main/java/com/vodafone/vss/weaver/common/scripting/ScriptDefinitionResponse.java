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
package com.vodafone.vss.weaver.common.scripting;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptDefinitionResponse {

    private UUID id;
    private String name;
    private String description;
    private String script;
    private Languages language;
    private Map<String, Object> variables;
    private Integer timeout;
    private Instant createdAt;
    private Instant updatedAt;

    public UUID id() {
        return id;
    }

    public String name() {
        return name;
    }

    public String description() {
        return description;
    }

    public String script() {
        return script;
    }

    public Languages language() {
        return language;
    }

    public Map<String, Object> variables() {
        return variables;
    }

    public Integer timeout() {
        return timeout;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public static ScriptDefinitionResponse fromModel(ScriptModel model) {
        if (model == null) {
            return null;
        }
        return ScriptDefinitionResponse.builder()
                .id(model.getId())
                .name(model.getName())
                .description(model.getDescription())
                .script(model.getScript())
                .language(model.getLanguage())
                .variables(model.getVariables())
                .timeout(model.getTimeout())
                .createdAt(model.getCreatedAt())
                .updatedAt(model.getUpdatedAt())
                .build();
    }

    public static ScriptDefinitionResponse from(ScriptModel model) {
        return fromModel(model);
    }
}
