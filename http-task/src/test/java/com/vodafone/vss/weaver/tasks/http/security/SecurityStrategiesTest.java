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

        ApiKey emptyKey = new ApiKey(HttpConnectionModel.builder().authConfig(Map.of()).build());
        assertFalse(emptyKey.testAuthentication());
    }

    @Test
    void basicAuthStrategy_validates_and_tests_auth() {
        BasicAuthentication auth =
                new BasicAuthentication(Map.of("username", "user1", "password", "secret"));
        assertTrue(auth.testAuthentication());
        assertEquals("user1", auth.getUsername());

        BasicAuthentication emptyAuth = new BasicAuthentication(Map.of());
        assertFalse(emptyAuth.testAuthentication());
    }

    @Test
    void cookieAuthStrategy_validates_and_tests_auth() {
        CookieAuth auth = new CookieAuth(Map.of("cookie", "JSESSIONID=12345", "cookieHeader", "Cookie"));
        assertTrue(auth.testAuthentication());
        assertEquals("JSESSIONID=12345", auth.getCookie());

        CookieAuth emptyAuth = new CookieAuth(Map.of());
        assertFalse(emptyAuth.testAuthentication());
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
}

