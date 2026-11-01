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

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptDefinitionRequest {

    @NotBlank(message = "Script name cannot be empty")
    private String name;

    private String description;

    @NotBlank(message = "Script body cannot be empty")
    private String script;

    @NotNull(message = "Language cannot be null")
    private Languages language;

    private Map<String, Object> variables;

    @Positive(message = "Timeout must be a positive number of ms")
    @Builder.Default
    private Integer timeout = 3000;

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
}
