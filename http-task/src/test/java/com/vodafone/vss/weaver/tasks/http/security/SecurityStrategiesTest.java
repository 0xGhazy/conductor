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

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.util.MultiValueMap;

import com.vodafone.vss.weaver.common.http.AuthenticationStrategy;
import com.vodafone.vss.weaver.common.http.HttpConnectionModel;
import com.vodafone.vss.weaver.common.http.XGrantType;

import static org.junit.jupiter.api.Assertions.*;

class SecurityStrategiesTest {

    @Test
    void apiKeyStrategy_validates_and_tests_auth() {
        HttpConnectionModel conn =
                HttpConnectionModel.builder()
                        .name("TEST-KEY")
                        .strategy(AuthenticationStrategy.API_KEY)
                        .authConfig(Map.of("apiKey", "abc-123", "apiKeyHeader", "X-Custom-Key"))
                        .build();

        ApiKey apiKey = new ApiKey(conn);
        assertEquals("abc-123", apiKey.getApiKey());
        assertEquals("X-Custom-Key", apiKey.getHeader());
        assertTrue(apiKey.testAuthentication());

        HttpHeaders headers = new HttpHeaders();
        apiKey.apply(headers);
        assertEquals("abc-123", headers.getFirst("X-Custom-Key"));

        ApiKey emptyKey = new ApiKey(HttpConnectionModel.builder().authConfig(Map.of()).build());
        assertFalse(emptyKey.testAuthentication());
        assertThrows(IllegalStateException.class, () -> emptyKey.apply(new HttpHeaders()));
    }

    @Test
    void basicAuthStrategy_validates_and_tests_auth() {
        BasicAuthentication auth =
                new BasicAuthentication(Map.of("username", "user1", "password", "secret"));
        assertTrue(auth.testAuthentication());
        assertEquals("user1", auth.getUsername());

        HttpHeaders headers = new HttpHeaders();
        auth.apply(headers);
        assertNotNull(headers.getFirst(HttpHeaders.AUTHORIZATION));
        assertTrue(headers.getFirst(HttpHeaders.AUTHORIZATION).startsWith("Basic "));

        BasicAuthentication emptyAuth = new BasicAuthentication(Map.of());
        assertFalse(emptyAuth.testAuthentication());
        assertThrows(IllegalStateException.class, () -> emptyAuth.apply(new HttpHeaders()));
    }

    @Test
    void cookieAuthStrategy_validates_and_tests_auth() {
        CookieAuth auth = new CookieAuth(Map.of("cookie", "JSESSIONID=12345", "cookieHeader", "Cookie"));
        assertTrue(auth.testAuthentication());
        assertEquals("JSESSIONID=12345", auth.getCookie());

        HttpHeaders headers = new HttpHeaders();
        auth.apply(headers);
        assertEquals("JSESSIONID=12345", headers.getFirst("Cookie"));

        CookieAuth emptyAuth = new CookieAuth(Map.of());
        assertFalse(emptyAuth.testAuthentication());
        assertThrows(IllegalStateException.class, () -> emptyAuth.apply(new HttpHeaders()));
    }

    @Test
    void oauth2Config_validation_for_client_credentials() {
        OAuth2Config config =
                OAuth2Config.builder()
                        .name("OAUTH-CC")
                        .grantType(XGrantType.CLIENT_CREDENTIALS)
                        .tokenEndpoint("https://auth.vodafone.com/token")
                        .clientId("client-id-1")
                        .clientSecret("client-sec-1")
                        .build();

        assertDoesNotThrow(config::validateRequiredGrantTypeParameters);
        assertNotNull(config.buildStrategy());

        MultiValueMap<String, String> formData = config.buildFormData();
        assertEquals("client_credentials", formData.getFirst("grant_type"));
        assertEquals("client-id-1", formData.getFirst("client_id"));
        assertEquals("client-sec-1", formData.getFirst("client_secret"));
    }

    @Test
    void oauth2Config_validation_fails_when_missing_required_params() {
        OAuth2Config invalid =
                OAuth2Config.builder()
                        .name("OAUTH-INVALID")
                        .grantType(XGrantType.CLIENT_CREDENTIALS)
                        .tokenEndpoint("https://auth.vodafone.com/token")
                        .clientId("client-id-1")
                        // missing clientSecret
                        .build();

        assertThrows(IllegalArgumentException.class, invalid::validateRequiredGrantTypeParameters);
    }

    @Test
    void oauth2_shutdown_terminates_cleanly() {
        OAuth2Config config =
                OAuth2Config.builder()
                        .name("OAUTH-SHUTDOWN")
                        .grantType(XGrantType.CLIENT_CREDENTIALS)
                        .tokenEndpoint("https://auth.vodafone.com/token")
                        .clientId("client-id-1")
                        .clientSecret("client-sec-1")
                        .build();

        OAuth2 oauth2 = new OAuth2(config);
        assertDoesNotThrow(oauth2::shutdown);
    }
}

