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
package com.vodafone.vss.weaver.common.respond;

import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RespondWorkerTaskDto {

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

    @NotBlank(message = "Message code is required")
    @JsonProperty("messageCode")
    private String messageCode;

    @Builder.Default
    @JsonProperty("languageCode")
    private String languageCode = "${workflow.input._language}";

    @Builder.Default
    @JsonProperty("variables")
    private Map<String, Object> variables = new HashMap<>();
}

