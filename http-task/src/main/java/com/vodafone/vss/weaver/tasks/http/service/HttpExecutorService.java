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
package com.vodafone.vss.weaver.tasks.http.service;

import java.time.Duration;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import com.vodafone.vss.weaver.common.http.HttpRequest;
import com.vodafone.vss.weaver.common.http.HttpResponse;
import com.vodafone.vss.weaver.tasks.http.security.AuthStrategy;

import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class HttpExecutorService {

    private static final Logger log = LoggerFactory.getLogger(HttpExecutorService.class);
    private static final String EMPTY_CONNECTION_VALUE = "--NONE--";

    private final ObjectMapper mapper;
    private final WebClient webClient;
    private final HttpConnectionService httpConnectionService;

    @Autowired
    public HttpExecutorService(
            ObjectMapper mapper,
            HttpConnectionService httpConnectionService,
            @Autowired(required = false) WebClient webClient) {
        this.mapper = mapper;
        this.httpConnectionService = httpConnectionService;
        this.webClient = webClient != null ? webClient : WebClient.builder().build();
    }

    public HttpResponse execute(HttpRequest request) {
        log.debug("Executing HTTP request for node: {}", request.getNodeName());

        Map<String, String> headers = request.getHeaders() != null ? request.getHeaders() : Collections.emptyMap();
        Object body = request.getBody();
        String connection = request.getConnection();
        String url = request.getUrl();
        HttpMethod method = HttpMethod.valueOf(request.getMethod().toUpperCase());
        int timeoutMs = Optional.ofNullable(request.getTimeout()).filter(t -> t > 0).orElse(3000);
        Duration totalTimeout = Duration.ofMillis(timeoutMs);

        String acceptHeader = headers.getOrDefault(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        String contentTypeHeader = headers.getOrDefault(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);

        WebClient.RequestBodySpec spec =
                webClient
                        .method(method)
                        .uri(url)
                        .headers(
                                h -> {
                                    if (!headers.isEmpty()) {
                                        h.setAll(headers);
                                    }
                                    h.remove(HttpHeaders.ACCEPT);
                                    h.add(HttpHeaders.ACCEPT, acceptHeader);
                                })
                        .contentType(MediaType.parseMediaType(contentTypeHeader))
                        .accept(MediaType.parseMediaType(acceptHeader));

        WebClient.RequestHeadersSpec<?> req = (body == null) ? spec : spec.bodyValue(body);

        boolean applyAuth = connection != null && !connection.equalsIgnoreCase(EMPTY_CONNECTION_VALUE);
        if (applyAuth) {
            log.debug("Applying connection '{}' to request", connection);
            AuthStrategy strategy = httpConnectionService.getConnection(connection);
            req = strategy.apply(req);
        }

        return req.exchangeToMono(
                        resp ->
                                resp.bodyToMono(String.class)
                                        .defaultIfEmpty("")
                                        .map(
                                                bodyStr ->
                                                        new HttpResponse(
                                                                (HttpStatus) resp.statusCode(),
                                                                parseJsonOrReturnString(bodyStr),
                                                                resp.headers().asHttpHeaders())))
                .timeout(totalTimeout)
                .onErrorResume(
                        TimeoutException.class,
                        ex ->
                                Mono.just(
                                        new HttpResponse(
                                                HttpStatus.GATEWAY_TIMEOUT,
                                                Map.of(
                                                        "error",
                                                        "Timeout",
                                                        "message",
                                                        "Request exceeded timeout of " + timeoutMs + "ms"),
                                                null)))
                .onErrorResume(
                        WebClientResponseException.class,
                        ex ->
                                Mono.just(
                                        new HttpResponse(
                                                (HttpStatus) ex.getStatusCode(),
                                                parseJsonOrReturnString(ex.getResponseBodyAsString()),
                                                ex.getHeaders())))
                .onErrorResume(
                        Throwable.class,
                        t ->
                                Mono.just(
                                        new HttpResponse(
                                                HttpStatus.INTERNAL_SERVER_ERROR,
                                                Map.of(
                                                        "error",
                                                        t.getClass().getSimpleName(),
                                                        "message",
                                                        t.getMessage() != null ? t.getMessage() : ""),
                                                null)))
                .block();
    }

    public Object parseJsonOrReturnString(String s) {
        if (s == null || s.isBlank()) {
            return Map.of();
        }
        try {
            return mapper.readTree(s);
        } catch (Exception ignore) {
            return s;
        }
    }
}

