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
package com.vodafone.vss.weaver.rest.controllers;

import java.util.UUID;

import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.vodafone.vss.weaver.common.http.DetailedHttpResponse;
import com.vodafone.vss.weaver.common.http.HttpRequest;
import com.vodafone.vss.weaver.common.http.HttpResponse;
import com.vodafone.vss.weaver.tasks.http.service.HttpExecutorService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping(value = "/api/actions/http", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "HTTP Executor API", description = "Ad-hoc HTTP requests processing API")
public class HttpExecutorResource {

    private static final Logger log = LoggerFactory.getLogger(HttpExecutorResource.class);

    private final HttpExecutorService service;

    public HttpExecutorResource(HttpExecutorService service) {
        this.service = service;
    }

    @PostMapping(value = "/execute", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Execute HTTP Request", description = "Execute HTTP request ad-hoc via HTTP action engine")
    public DetailedHttpResponse execute(@Valid @RequestBody HttpRequest request) {
        long startedAt = System.currentTimeMillis();
        HttpResponse response = service.execute(request);
        long elapsedMs = System.currentTimeMillis() - startedAt;

        String executionStatus = (response.status() != null && response.status().is2xxSuccessful()) ? "SUCCESS" : "FAILED";
        UUID requestId = UUID.randomUUID();

        log.info(
                "Ad-hoc HTTP execute completed: nodeName={}, status={}, statusCode={}, durationMs={}, requestId={}",
                request.getNodeName(),
                executionStatus,
                response.statusCode(),
                elapsedMs,
                requestId);

        return new DetailedHttpResponse(
                executionStatus,
                elapsedMs,
                response.status(),
                requestId,
                response.headers(),
                response.response());
    }
}

