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
package com.vodafone.vss.weaver.tasks.http.security;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.vodafone.vss.weaver.common.http.TokenResponse;

import lombok.Getter;

public class OAuth2 implements AuthStrategy {

    private static final Logger log = LoggerFactory.getLogger(OAuth2.class);

    @Getter
    private final OAuth2Config config;
    @Getter
    private volatile Instant expiresAt;
    private volatile String accessToken;
    private volatile String refreshToken;
    private final WebClient webClient;
    private final ScheduledExecutorService scheduler;
    private final AtomicReference<ScheduledFuture<?>> refreshTask = new AtomicReference<>();

    public OAuth2(OAuth2Config config) {
        this(config, WebClient.builder().build());
    }

    public OAuth2(OAuth2Config config, WebClient webClient) {
        this.config = config;
        this.webClient = webClient;
        this.scheduler =
                Executors.newSingleThreadScheduledExecutor(
                        r -> {
                            Thread t = new Thread(r, "oauth2-refresh-" + config.getName());
                            t.setDaemon(true);
                            return t;
                        });
    }

    public String getAccessToken() {
        if (accessToken == null || expiresAt == null || Instant.now().isAfter(expiresAt.minusSeconds(5))) {
            fetchToken(refreshToken != null);
        }
        return accessToken;
    }

    public String getRefreshToken() {
        if (refreshToken == null) {
            fetchToken(true);
        }
        return refreshToken;
    }

    @Override
    public WebClient.RequestHeadersSpec<?> apply(WebClient.RequestHeadersSpec<?> req) {
        String token = getAccessToken();
        return req.headers(h -> h.setBearerAuth(token));
    }

    @Override
    public boolean testAuthentication() {
        try {
            return fetchToken(false) != null;
        } catch (Exception ex) {
            log.warn("OAuth2 connection test failed for {}: {}", config.getName(), ex.getMessage());
            return false;
        }
    }

    public TokenResponse fetchToken(boolean isRefreshToken) {
        TokenResponse response;
        if (isRefreshToken) {
            response = fetchRefreshToken();
        } else {
            try {
                response = fetchAccessToken();
                log.debug("Access token fetched for connection {}: success", config.getName());
            } catch (Exception ex) {
                log.warn("OAuth2 connection test failed for {}: {}", config.getName(), ex.getMessage());
                throw new IllegalStateException("Failed to fetch access token from remote server: " + ex.getMessage(), ex);
            }
        }
        seed(response);
        return response;
    }

    private void seed(TokenResponse tokenResponse) {
        this.accessToken = tokenResponse.getAccessToken();
        this.refreshToken = tokenResponse.getRefreshToken();
        long expiresIn = Math.max(1, tokenResponse.getExpiresIn());
        this.expiresAt = Instant.now().plusSeconds(expiresIn);
        scheduleAutoRefresh(expiresIn);
    }

    private void scheduleAutoRefresh(long expiresInSec) {
        long delaySec = Math.max(0, expiresInSec - 5);
        ScheduledFuture<?> next = scheduler.schedule(this::autoRefreshTick, delaySec, TimeUnit.SECONDS);
        ScheduledFuture<?> prev = refreshTask.getAndSet(next);
        if (prev != null) {
            prev.cancel(false);
        }
    }

    private void autoRefreshTick() {
        try {
            TokenResponse token = (refreshToken != null) ? fetchToken(true) : fetchToken(false);
            if (token.getRefreshToken() != null && !token.getRefreshToken().isBlank()) {
                this.refreshToken = token.getRefreshToken();
            }
            long expiresIn = Math.max(1, token.getExpiresIn());
            this.expiresAt = Instant.now().plusSeconds(expiresIn);
            this.accessToken = token.getAccessToken();
            scheduleAutoRefresh(expiresIn);
            log.debug("Tokens for {} connection refreshed successfully", config.getName());
        } catch (Exception e) {
            log.error("Token auto-refresh failed for: {} - retrying in 10 seconds", config.getName(), e);
            ScheduledFuture<?> next = scheduler.schedule(this::autoRefreshTick, 10, TimeUnit.SECONDS);
            ScheduledFuture<?> prev = refreshTask.getAndSet(next);
            if (prev != null) {
                prev.cancel(false);
            }
        }
    }

    private TokenResponse fetchAccessToken() {
        BodyInserters.FormInserter<String> form = config.buildStrategy();
        try {
            return webClient.post()
                    .uri(config.getTokenEndpoint())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .onStatus(
                            HttpStatusCode::is4xxClientError,
                            response ->
                                    response.bodyToMono(String.class)
                                            .defaultIfEmpty("")
                                            .map(
                                                    body ->
                                                            new IllegalStateException(
                                                                    "Failed to fetch access token: client error "
                                                                            + response.statusCode().value()
                                                                            + ", body="
                                                                            + body)))
                    .onStatus(
                            HttpStatusCode::is5xxServerError,
                            response ->
                                    response.bodyToMono(String.class)
                                            .defaultIfEmpty("")
                                            .map(
                                                    body ->
                                                            new IllegalStateException(
                                                                    "Failed to fetch access token: server error "
                                                                            + response.statusCode().value()
                                                                            + ", body="
                                                                            + body)))
                    .bodyToMono(TokenResponse.class)
                    .timeout(Duration.ofSeconds(10))
                    .blockOptional()
                    .filter(token -> token.getAccessToken() != null && !token.getAccessToken().isBlank())
                    .orElseThrow(() -> new IllegalStateException("Token response is null or missing access_token"));
        } catch (WebClientResponseException e) {
            log.error("HTTP error while fetching access token: status={}, body={}", e.getStatusCode().value(), e.getResponseBodyAsString(), e);
            throw new IllegalStateException("HTTP error while fetching access token", e);
        } catch (WebClientRequestException e) {
            log.error("Network error while fetching access token: {}", e.getMessage(), e);
            throw new IllegalStateException("Network error while fetching access token", e);
        } catch (Exception e) {
            log.error("Unexpected error while fetching access token", e);
            throw new IllegalStateException("Unexpected error while fetching access token", e);
        }
    }

    private TokenResponse fetchRefreshToken() {
        BodyInserters.FormInserter<String> form =
                BodyInserters.fromFormData("client_id", config.getClientId())
                        .with("refresh_token", getRefreshToken())
                        .with("grant_type", "refresh_token");
        FormUtils.addIfPresent(form, "client_secret", config.getClientSecret());

        try {
            return webClient.post()
                    .uri(config.getTokenEndpoint())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .onStatus(
                            HttpStatusCode::is4xxClientError,
                            response ->
                                    response.bodyToMono(String.class)
                                            .defaultIfEmpty("")
                                            .map(
                                                    body ->
                                                            new IllegalStateException(
                                                                    "Failed to refresh access token: client error "
                                                                            + response.statusCode().value()
                                                                            + ", body="
                                                                            + body)))
                    .onStatus(
                            HttpStatusCode::is5xxServerError,
                            response ->
                                    response.bodyToMono(String.class)
                                            .defaultIfEmpty("")
                                            .map(
                                                    body ->
                                                            new IllegalStateException(
                                                                    "Failed to refresh access token: server error "
                                                                            + response.statusCode().value()
                                                                            + ", body="
                                                                            + body)))
                    .bodyToMono(TokenResponse.class)
                    .timeout(Duration.ofSeconds(10))
                    .blockOptional()
                    .filter(token -> token.getAccessToken() != null && !token.getAccessToken().isBlank())
                    .orElseThrow(() -> new IllegalStateException("Refresh token response is null or missing access_token"));
        } catch (WebClientResponseException e) {
            log.error("HTTP error while refreshing access token: status={}, body={}", e.getStatusCode().value(), e.getResponseBodyAsString(), e);
            throw new IllegalStateException("HTTP error while refreshing access token", e);
        } catch (WebClientRequestException e) {
            log.error("Network error while refreshing access token: {}", e.getMessage(), e);
            throw new IllegalStateException("Network error while refreshing access token", e);
        } catch (Exception e) {
            log.error("Unexpected error while refreshing access token", e);
            throw new IllegalStateException("Unexpected error while refreshing access token", e);
        }
    }
}

