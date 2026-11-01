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

import java.util.Collections;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Representation of an HTTP request payload for execution.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HttpRequest {

    private String nodeName;

    @NotBlank(message = "URL cannot be empty")
    private String url;

    @NotBlank(message = "HTTP method cannot be empty")
    private String method;

    @Builder.Default
    private Map<String, String> headers = Collections.emptyMap();

    private Object body;

    @Builder.Default
    private Integer timeout = 3000;

    @Builder.Default
    private String connection = "--NONE--";
}

