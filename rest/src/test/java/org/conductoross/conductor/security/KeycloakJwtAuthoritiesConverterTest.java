/*
 * Copyright 2026 Conductor Authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package org.conductoross.conductor.security;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KeycloakJwtAuthoritiesConverterTest {

    private KeycloakJwtAuthoritiesConverter converter;

    @BeforeEach
    void setUp() {
        converter = new KeycloakJwtAuthoritiesConverter("weaver");
    }

    @Test
    void testExtractRealmRoles() {
        Jwt jwt = createJwt(
                Map.of("roles", List.of("conductor_admin", "offline_access")),
                null,
                "openid profile email"
        );

        Collection<GrantedAuthority> authorities = converter.convert(jwt);
        assertNotNull(authorities);

        Set<String> authStrings = authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());

        assertTrue(authStrings.contains("ROLE_conductor_admin"));
        assertTrue(authStrings.contains("ROLE_CONDUCTOR_ADMIN"));
        assertTrue(authStrings.contains("ROLE_offline_access"));
        assertTrue(authStrings.contains("SCOPE_openid"));
        assertTrue(authStrings.contains("SCOPE_profile"));
        assertTrue(authStrings.contains("SCOPE_email"));
    }

    @Test
    void testExtractClientRoles() {
        Map<String, Object> resourceAccess = Map.of(
                "weaver", Map.of("roles", List.of("conductor_operator")),
                "account", Map.of("roles", List.of("manage-account"))
        );

        Jwt jwt = createJwt(null, resourceAccess, null);

        Collection<GrantedAuthority> authorities = converter.convert(jwt);
        assertNotNull(authorities);

        Set<String> authStrings = authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());

        assertTrue(authStrings.contains("ROLE_conductor_operator"));
        assertTrue(authStrings.contains("ROLE_CONDUCTOR_OPERATOR"));
        assertTrue(authStrings.contains("ROLE_manage-account"));
    }

    @Test
    void testExtractBothRealmAndClientRoles() {
        Map<String, Object> realmAccess = Map.of("roles", List.of("conductor_viewer"));
        Map<String, Object> resourceAccess = Map.of(
                "weaver", Map.of("roles", List.of("conductor_worker"))
        );

        Jwt jwt = createJwt(realmAccess, resourceAccess, "read write");

        Collection<GrantedAuthority> authorities = converter.convert(jwt);
        Set<String> authStrings = authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());

        assertTrue(authStrings.contains("ROLE_conductor_viewer"));
        assertTrue(authStrings.contains("ROLE_conductor_worker"));
        assertTrue(authStrings.contains("SCOPE_read"));
        assertTrue(authStrings.contains("SCOPE_write"));
    }

    @Test
    void testNullOrEmptyClaims() {
        Jwt jwt = createJwt(null, null, null);
        Collection<GrantedAuthority> authorities = converter.convert(jwt);
        assertNotNull(authorities);
        assertEquals(0, authorities.size());
    }

    private Jwt createJwt(
            Map<String, Object> realmAccess,
            Map<String, Object> resourceAccess,
            String scope) {
        Jwt.Builder builder = Jwt.withTokenValue("mock-token")
                .header("alg", "RS256")
                .subject("test-user-uuid")
                .issuer("http://localhost:8085/realms/weaver")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600));

        if (realmAccess != null) {
            builder.claim("realm_access", realmAccess);
        }
        if (resourceAccess != null) {
            builder.claim("resource_access", resourceAccess);
        }
        if (scope != null) {
            builder.claim("scope", scope);
        }

        return builder.build();
    }
}
