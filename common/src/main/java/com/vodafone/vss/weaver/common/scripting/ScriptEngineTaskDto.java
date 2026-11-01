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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptEngineTaskDto {

    @JsonProperty("_nodeId")
    private String nodeId;

    @JsonProperty("_nodeName")
    private String nodeName;

    @JsonProperty("_taskReferenceName")
    private String taskReferenceName;

    @JsonProperty("_nodePosX")
    private String nodePosX;

    @JsonProperty("_nodePosY")
    private String nodePosY;

    @NotBlank(message = "Script cannot be empty")
    @JsonProperty("script")
    private String script;

    @ToString.Exclude
    @NotNull(message = "Variables map cannot be null")
    @JsonProperty("variables")
    private Map<String, Object> variables;

    @NotNull(message = "Language cannot be null")
    @JsonProperty("language")
    private Languages language;

    @Positive(message = "Timeout must be a positive number of ms")
    @Builder.Default
    @JsonProperty("timeout")
    private Integer timeout = 3000;
}

