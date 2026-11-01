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
package com.vodafone.vss.weaver.common.redis;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RedisWorkerTaskDto {

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

    private UUID datasourceId;
    private String datasourceName;
    private String action;
    private String key;
    private String value;
    private String field;
    private Long ttlSeconds;
    private Long delta;
    private List<String> keys;
    private Map<String, String> hashValues;
    private String failureReason;
}

