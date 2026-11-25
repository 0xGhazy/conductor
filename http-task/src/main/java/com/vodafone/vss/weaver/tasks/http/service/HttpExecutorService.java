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

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import jakarta.annotation.PreDestroy;
import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.protocol.HttpClientContext;
import org.apache.hc.core5.http.protocol.HttpContext;
import org.apache.hc.core5.util.TimeValue;
import org.apache.hc.core5.util.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import com.vodafone.vss.weaver.common.http.HttpRequest;
import com.vodafone.vss.weaver.common.http.HttpResponse;
import com.vodafone.vss.weaver.tasks.http.security.AuthStrategy;

import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class HttpExecutorService {

    private static final Logger log = LoggerFactory.getLogger(HttpExecutorService.class);
    private static final String EMPTY_CONNECTION_VALUE = "--NONE--";

    private final ObjectMapper mapper;
    private final HttpConnectionService httpConnectionService;
    private final CloseableHttpClient httpClient;
    private final RestClient customRestClient;

    @Autowired
    public HttpExecutorService(
            ObjectMapper mapper,
            HttpConnectionService httpConnectionService) {
        this(mapper, httpConnectionService, (RestClient) null);
    }

    public HttpExecutorService(
            ObjectMapper mapper,
            HttpConnectionService httpConnectionService,
            RestClient customRestClient) {
        this.mapper = mapper;
        this.httpConnectionService = httpConnectionService;
        this.httpClient = createPoolingHttpClient();
        this.customRestClient = customRestClient;
    }

    public HttpResponse execute(HttpRequest request) {
        log.debug("Executing HTTP request for node: {}", request.getNodeName());

        Map<String, String> inputHeaders =
                request.getHeaders() != null ? request.getHeaders() : Collections.emptyMap();
        Object body = request.getBody();
        String connection = request.getConnection();
        String url = request.getUrl();
        HttpMethod method = HttpMethod.valueOf(request.getMethod().toUpperCase());
        int timeoutMs = Optional.ofNullable(request.getTimeout()).filter(t -> t > 0).orElse(3000);

        HttpHeaders headers = new HttpHeaders();
        inputHeaders.forEach(headers::add);
        if (!headers.containsKey(HttpHeaders.ACCEPT)) {
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        }

        boolean applyAuth = connection != null && !connection.equalsIgnoreCase(EMPTY_CONNECTION_VALUE);
        if (applyAuth) {
            log.debug("Applying connection '{}' to request", connection);
            AuthStrategy strategy = httpConnectionService.getConnection(connection);
            strategy.apply(headers);
        }

        RestClient client = getRestClient(timeoutMs);

        try {
            RestClient.RequestBodySpec requestSpec =
                    client.method(method)
                            .uri(url)
                            .headers(h -> h.addAll(headers));

            if (supportsRequestBody(method) && body != null) {
                if (!headers.containsKey(HttpHeaders.CONTENT_TYPE)) {
                    requestSpec.contentType(MediaType.APPLICATION_JSON);
                }
                requestSpec.body(body);
            }

            return requestSpec.exchange((clientRequest, clientResponse) -> {
                HttpStatusCode status = clientResponse.getStatusCode();
                HttpHeaders responseHeaders = clientResponse.getHeaders();
                byte[] bodyBytes = StreamUtils.copyToByteArray(clientResponse.getBody());
                Object parsed = parseBody(bodyBytes, responseHeaders);
                return new HttpResponse(status, parsed, responseHeaders);
            });
        } catch (ResourceAccessException ex) {
            boolean isTimeout = isTimeoutException(ex);
            HttpStatusCode status = isTimeout ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE;
            log.warn("HTTP call to {} failed (isTimeout={}): {}", url, isTimeout, ex.getMessage());
            return new HttpResponse(
                    status,
                    Map.of(
                            "error", isTimeout ? "Timeout" : "ConnectionError",
                            "message", isTimeout ? "Request exceeded timeout of " + timeoutMs + "ms" : (ex.getMessage() != null ? ex.getMessage() : "")
                    ),
                    new HttpHeaders()
            );
        } catch (Exception ex) {
            log.error("HTTP call to {} encountered unexpected error: {}", url, ex.getMessage(), ex);
            return new HttpResponse(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    Map.of(
                            "error", ex.getClass().getSimpleName(),
                            "message", ex.getMessage() != null ? ex.getMessage() : ""
                    ),
                    new HttpHeaders()
            );
        }
    }

    public Object parseBody(byte[] bodyBytes, HttpHeaders headers) {
        if (bodyBytes == null || bodyBytes.length == 0) {
            return Collections.emptyMap();
        }
        String bodyStr = new String(bodyBytes, StandardCharsets.UTF_8).trim();
        if (bodyStr.isEmpty()) {
            return Collections.emptyMap();
        }

        MediaType contentType = headers != null ? headers.getContentType() : null;
        boolean likelyJson = (contentType != null && contentType.includes(MediaType.APPLICATION_JSON))
                || bodyStr.startsWith("{")
                || bodyStr.startsWith("[");

        if (likelyJson) {
            try {
                return mapper.readTree(bodyStr);
            } catch (Exception ignore) {
                return bodyStr;
            }
        }
        return bodyStr;
    }

    public Object parseJsonOrReturnString(String s) {
        if (s == null || s.isBlank()) {
            return Collections.emptyMap();
        }
        String trimmed = s.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                return mapper.readTree(trimmed);
            } catch (Exception ignore) {
                return s;
            }
        }
        return s;
    }

    @PreDestroy
    public void destroy() {
        try {
            httpClient.close();
            log.info("HttpExecutorService pooling HttpClient closed successfully");
        } catch (IOException e) {
            log.warn("Error closing pooling HttpClient: {}", e.getMessage());
        }
    }

    private RestClient getRestClient(int timeoutMs) {
        if (customRestClient != null) {
            return customRestClient;
        }
        TimeoutClientHttpRequestFactory factory =
                new TimeoutClientHttpRequestFactory(httpClient, timeoutMs);
        return RestClient.builder().requestFactory(factory).build();
    }

    private static boolean supportsRequestBody(HttpMethod method) {
        return method == HttpMethod.POST
                || method == HttpMethod.PUT
                || method == HttpMethod.PATCH;
    }

    private static boolean isTimeoutException(ResourceAccessException ex) {
        Throwable cause = ex.getCause();
        while (cause != null) {
            if (cause instanceof java.net.SocketTimeoutException
                    || cause instanceof org.apache.hc.core5.http.ConnectionRequestTimeoutException
                    || cause instanceof java.util.concurrent.TimeoutException) {
                return true;
            }
            cause = cause.getCause();
        }
        return ex.getMessage() != null && ex.getMessage().toLowerCase(Locale.ROOT).contains("timeout");
    }

    private static CloseableHttpClient createPoolingHttpClient() {
        PoolingHttpClientConnectionManager connectionManager =
                PoolingHttpClientConnectionManagerBuilder.create()
                        .setMaxConnTotal(200)
                        .setMaxConnPerRoute(50)
                        .build();

        return HttpClients.custom()
                .setConnectionManager(connectionManager)
                .evictExpiredConnections()
                .evictIdleConnections(TimeValue.ofSeconds(30))
                .build();
    }

    static class TimeoutClientHttpRequestFactory extends HttpComponentsClientHttpRequestFactory {
        private final int timeoutMs;

        public TimeoutClientHttpRequestFactory(HttpClient httpClient, int timeoutMs) {
            super(httpClient);
            this.timeoutMs = timeoutMs;
        }

        @Override
        protected HttpContext createHttpContext(HttpMethod httpMethod, URI uri) {
            HttpClientContext context = HttpClientContext.create();
            RequestConfig requestConfig =
                    RequestConfig.custom()
                            .setConnectTimeout(Timeout.ofMilliseconds(timeoutMs))
                            .setResponseTimeout(Timeout.ofMilliseconds(timeoutMs))
                            .setConnectionRequestTimeout(Timeout.ofMilliseconds(timeoutMs))
                            .build();
            context.setRequestConfig(requestConfig);
            return context;
        }
    }
}
