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

import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

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
    private final RestClient restClient;
    private final ScheduledExecutorService scheduler;
    private final AtomicReference<ScheduledFuture<?>> refreshTask = new AtomicReference<>();
    private final ReentrantLock tokenLock = new ReentrantLock();

    public OAuth2(OAuth2Config config) {
        this(config, RestClient.builder().build());
    }

    public OAuth2(OAuth2Config config, RestClient restClient) {
        this.config = config;
        this.restClient = restClient != null ? restClient : RestClient.builder().build();
        this.scheduler =
                Executors.newSingleThreadScheduledExecutor(
                        r -> {
                            Thread t = new Thread(r, "oauth2-refresh-" + config.getName());
                            t.setDaemon(true);
                            return t;
                        });
    }

    public String getAccessToken() {
        if (isTokenExpired()) {
            tokenLock.lock();
            try {
                if (isTokenExpired()) {
                    fetchToken(refreshToken != null);
                }
            } finally {
                tokenLock.unlock();
            }
        }
        return accessToken;
    }

    public String getRefreshToken() {
        if (refreshToken == null) {
            tokenLock.lock();
            try {
                if (refreshToken == null) {
                    fetchToken(true);
                }
            } finally {
                tokenLock.unlock();
            }
        }
        return refreshToken;
    }

    @Override
    public void apply(HttpHeaders headers) {
        String token = getAccessToken();
        headers.setBearerAuth(token);
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

    @Override
    public void shutdown() {
        ScheduledFuture<?> current = refreshTask.getAndSet(null);
        if (current != null) {
            current.cancel(true);
        }
        scheduler.shutdownNow();
        try {
            if (!scheduler.awaitTermination(2, TimeUnit.SECONDS)) {
                log.warn("OAuth2 refresh scheduler for {} did not terminate cleanly", config.getName());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
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
        if (scheduler.isShutdown()) {
            return;
        }
        long delaySec = Math.max(0, expiresInSec - 5);
        ScheduledFuture<?> next = scheduler.schedule(this::autoRefreshTick, delaySec, TimeUnit.SECONDS);
        ScheduledFuture<?> prev = refreshTask.getAndSet(next);
        if (prev != null) {
            prev.cancel(false);
        }
    }

    private void autoRefreshTick() {
        if (scheduler.isShutdown()) {
            return;
        }
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
            if (scheduler.isShutdown()) {
                return;
            }
            log.error("Token auto-refresh failed for: {} - retrying in 10 seconds", config.getName(), e);
            ScheduledFuture<?> next = scheduler.schedule(this::autoRefreshTick, 10, TimeUnit.SECONDS);
            ScheduledFuture<?> prev = refreshTask.getAndSet(next);
            if (prev != null) {
                prev.cancel(false);
            }
        }
    }

    private boolean isTokenExpired() {
        return accessToken == null || expiresAt == null || Instant.now().isAfter(expiresAt.minusSeconds(5));
    }

    private TokenResponse fetchAccessToken() {
        MultiValueMap<String, String> form = config.buildFormData();
        try {
            TokenResponse response =
                    restClient.post()
                            .uri(config.getTokenEndpoint())
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(form)
                            .retrieve()
                            .body(TokenResponse.class);

            if (response == null || response.getAccessToken() == null || response.getAccessToken().isBlank()) {
                throw new IllegalStateException("Token response is null or missing access_token");
            }
            return response;
        } catch (RestClientResponseException e) {
            log.error("HTTP error while fetching access token for {}: status={}, body={}",
                    config.getName(), e.getStatusCode().value(), e.getResponseBodyAsString(), e);
            throw new IllegalStateException("HTTP error while fetching access token: " + e.getStatusCode().value(), e);
        } catch (ResourceAccessException e) {
            log.error("Network error while fetching access token for {}: {}", config.getName(), e.getMessage(), e);
            throw new IllegalStateException("Network error while fetching access token", e);
        } catch (Exception e) {
            log.error("Unexpected error while fetching access token for {}", config.getName(), e);
            throw new IllegalStateException("Unexpected error while fetching access token: " + e.getMessage(), e);
        }
    }

    private TokenResponse fetchRefreshToken() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", config.getClientId());
        form.add("refresh_token", getRefreshToken());
        form.add("grant_type", "refresh_token");
        if (config.getClientSecret() != null && !config.getClientSecret().isBlank()) {
            form.add("client_secret", config.getClientSecret());
        }

        try {
            TokenResponse response =
                    restClient.post()
                            .uri(config.getTokenEndpoint())
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(form)
                            .retrieve()
                            .body(TokenResponse.class);

            if (response == null || response.getAccessToken() == null || response.getAccessToken().isBlank()) {
                throw new IllegalStateException("Refresh token response is null or missing access_token");
            }
            return response;
        } catch (RestClientResponseException e) {
            log.error("HTTP error while refreshing access token for {}: status={}, body={}",
                    config.getName(), e.getStatusCode().value(), e.getResponseBodyAsString(), e);
            throw new IllegalStateException("HTTP error while refreshing access token: " + e.getStatusCode().value(), e);
        } catch (ResourceAccessException e) {
            log.error("Network error while refreshing access token for {}: {}", config.getName(), e.getMessage(), e);
            throw new IllegalStateException("Network error while refreshing access token", e);
        } catch (Exception e) {
            log.error("Unexpected error while refreshing access token for {}", config.getName(), e);
            throw new IllegalStateException("Unexpected error while refreshing access token: " + e.getMessage(), e);
        }
    }
}
