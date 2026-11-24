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
package com.vodafone.vss.weaver.health;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Health indicator for Keycloak identity provider.
 * Probes Keycloak's OpenID Connect configuration endpoint or JWKS certs endpoint.
 */
@Component("keycloak")
@ConditionalOnProperty(name = "management.health.keycloak.enabled", havingValue = "true", matchIfMissing = true)
@Slf4j
public class KeycloakHealthIndicator implements HealthIndicator {

    @Value("${weaver.security.enabled:false}")
    private boolean securityEnabled;

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:${WEAVER_IDENTITY_JWK_SET_URI:${WEAVER_KEYCLOAK_JWK_SET_URI:}}}")
    private String jwkSetUri;

    @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:${WEAVER_IDENTITY_ISSUER_URI:${WEAVER_KEYCLOAK_ISSUER_URI:}}}")
    private String issuerUri;

    private final HttpClient httpClient =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    @Override
    public Health health() {
        if (!securityEnabled && StringUtils.isBlank(jwkSetUri) && StringUtils.isBlank(issuerUri)) {
            return Health.up().withDetail("status", "DISABLED (weaver.security.enabled=false)").build();
        }

        String targetUrl =
                StringUtils.isNotBlank(jwkSetUri)
                        ? jwkSetUri
                        : (StringUtils.isNotBlank(issuerUri)
                                ? issuerUri + "/protocol/openid-connect/certs"
                                : null);

        if (StringUtils.isBlank(targetUrl)) {
            return Health.unknown()
                    .withDetail("reason", "Neither jwk-set-uri nor issuer-uri is configured")
                    .build();
        }

        try {
            HttpRequest request =
                    HttpRequest.newBuilder()
                            .uri(URI.create(targetUrl))
                            .timeout(Duration.ofSeconds(3))
                            .GET()
                            .build();

            HttpResponse<Void> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() >= 200 && response.statusCode() < 400) {
                return Health.up()
                        .withDetail("url", targetUrl)
                        .withDetail("statusCode", response.statusCode())
                        .build();
            } else {
                return Health.down()
                        .withDetail("url", targetUrl)
                        .withDetail("statusCode", response.statusCode())
                        .build();
            }
        } catch (Exception e) {
            log.warn("Keycloak health check failed against {}: {}", targetUrl, e.getMessage());
            return Health.down(e)
                    .withDetail("url", targetUrl)
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }
}
