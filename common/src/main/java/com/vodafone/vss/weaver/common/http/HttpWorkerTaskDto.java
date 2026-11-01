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
package com.vodafone.vss.weaver.common.http;

import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Setter
@Getter
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class HttpWorkerTaskDto {

    @JsonProperty("_nodeId")
    private String nodeId;

    @JsonProperty("_nodeName")
    private String nodeName;

    @JsonProperty("_taskReferenceName")
    private String taskReferenceName;

    @NotBlank(message = "HTTP method cannot be empty")
    @Pattern(
            regexp = "GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|TRACE",
            flags = Pattern.Flag.CASE_INSENSITIVE,
            message = "Unsupported HTTP method"
    )
    private String method;

    @NotBlank(message = "URL cannot be empty")
    private String url;

    @Positive(message = "Timeout must be a positive number")
    @Builder.Default
    private Integer timeout = 3000;

    @Builder.Default
    private String connection = "--NONE--";

    @Builder.Default
    private Map<String, String> headers = new HashMap<>();

    @Builder.Default
    private Object body = new HashMap<>();

    @JsonProperty("timeoutMs")
    public void setTimeoutMs(Integer timeoutMs) {
        if (timeoutMs != null) {
            this.timeout = timeoutMs;
        }
    }

    public void setConnection(String connection) {
        if (connection == null || connection.isBlank()) {
            this.connection = "--NONE--";
        } else {
            this.connection = connection;
        }
    }

    public void setHeaders(Object rawHeaders) {
        this.headers = toSafeStringMap(rawHeaders);
    }

    public void setBody(Object rawBody) {
        if (rawBody == null) {
            this.body = new HashMap<>();
        } else {
            this.body = rawBody;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> toSafeStringMap(Object raw) {
        if (raw == null) return new HashMap<>();
        if (raw instanceof Map<?, ?> map) {
            Map<String, String> converted = new HashMap<>();
            map.forEach((k, v) -> {
                if (k != null) {
                    converted.put(k.toString(), v == null ? null : v.toString());
                }
            });
            return converted;
        }
        return new HashMap<>();
    }
}

