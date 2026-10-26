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

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConductorSecurityComponentsTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testAuthenticationEntryPointReturns401Json() throws IOException {
        ConductorAuthenticationEntryPoint entryPoint = new ConductorAuthenticationEntryPoint(objectMapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/workflow");
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response, new BadCredentialsException("Invalid token signature"));

        assertEquals(401, response.getStatus());
        assertEquals("application/json", response.getContentType());
        assertTrue(response.getHeader("WWW-Authenticate").contains("Bearer error=\"invalid_token\""));

        @SuppressWarnings("unchecked")
        Map<String, Object> body = objectMapper.readValue(response.getContentAsString(), Map.class);
        assertEquals(401, body.get("status"));
        assertEquals("Unauthorized", body.get("error"));
        assertEquals("Invalid token signature", body.get("message"));
        assertEquals("/api/workflow", body.get("path"));
        assertNotNull(body.get("timestamp"));
    }

    @Test
    void testAccessDeniedHandlerReturns403Json() throws IOException {
        ConductorAccessDeniedHandler handler = new ConductorAccessDeniedHandler(objectMapper);
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/admin/config");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(request, response, new AccessDeniedException("Insufficient role"));

        assertEquals(403, response.getStatus());
        assertEquals("application/json", response.getContentType());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = objectMapper.readValue(response.getContentAsString(), Map.class);
        assertEquals(403, body.get("status"));
        assertEquals("Forbidden", body.get("error"));
        assertEquals("Insufficient role", body.get("message"));
        assertEquals("/api/admin/config", body.get("path"));
        assertNotNull(body.get("timestamp"));
    }

    @Test
    void testSecurityUtilsWithJwtAuthentication() {
        assertFalse(SecurityUtils.isAuthenticated());
        assertTrue(SecurityUtils.getCurrentUsername().isEmpty());

        Jwt jwt = Jwt.withTokenValue("mock-access-token")
                .header("alg", "RS256")
                .subject("usr-12345")
                .claim("preferred_username", "alice")
                .claim("email", "alice@example.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                jwt,
                List.of(
                        new SimpleGrantedAuthority("ROLE_conductor_admin"),
                        new SimpleGrantedAuthority("ROLE_conductor_operator"),
                        new SimpleGrantedAuthority("SCOPE_read")
                ),
                "alice"
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        assertTrue(SecurityUtils.isAuthenticated());
        assertEquals("alice", SecurityUtils.getCurrentUsername().orElse(null));
        assertEquals("alice@example.com", SecurityUtils.getCurrentUserEmail().orElse(null));

        Set<String> roles = SecurityUtils.getCurrentUserRoles();
        assertTrue(roles.contains("conductor_admin"));
        assertTrue(roles.contains("conductor_operator"));
        assertFalse(roles.contains("read")); // Scopes are not roles
    }
}
