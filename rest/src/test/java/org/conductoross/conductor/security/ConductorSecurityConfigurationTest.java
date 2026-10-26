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
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ConductorSecurityConfigurationTest {

    @RestController
    static class SecurityTestController {
        @GetMapping("/health")
        public Map<String, String> health() {
            return Map.of("status", "UP");
        }

        @GetMapping("/api-docs")
        public Map<String, String> apiDocs() {
            return Map.of("openapi", "3.0.1");
        }

        @GetMapping("/api/admin/users")
        public Map<String, String> adminUsers() {
            return Map.of("role", "admin");
        }

        @PostMapping("/api/metadata/workflow")
        public Map<String, String> createMetadata() {
            return Map.of("result", "created");
        }

        @DeleteMapping("/api/metadata/workflow/test")
        public Map<String, String> deleteMetadata() {
            return Map.of("result", "deleted");
        }

        @GetMapping("/api/workflow/12345")
        public Map<String, String> getWorkflow() {
            return Map.of("id", "12345");
        }
    }

    @Nested
    @WebMvcTest(controllers = SecurityTestController.class)
    @Import({ConductorSecurityConfiguration.class, SecurityTestController.class})
    @TestPropertySource(properties = {
        "conductor.security.enabled=true",
        "conductor.security.client-id=weaver",
        "conductor.security.jwk-set-uri=http://localhost:8085/realms/weaver/protocol/openid-connect/certs",
        "spring.main.allow-bean-definition-overriding=true"
    })
    class SecurityEnabledTests {

        @Autowired
        private MockMvc mockMvc;

        @MockBean
        private JwtDecoder jwtDecoder;

        @BeforeEach
        void setUp() {
            when(jwtDecoder.decode("admin-token"))
                    .thenReturn(createJwt("admin-user", "conductor_admin"));
            when(jwtDecoder.decode("operator-token"))
                    .thenReturn(createJwt("operator-user", "conductor_operator"));
            when(jwtDecoder.decode("viewer-token"))
                    .thenReturn(createJwt("viewer-user", "conductor_viewer"));
        }

        private Jwt createJwt(String username, String role) {
            return Jwt.withTokenValue("mock-" + role + "-token")
                    .header("alg", "RS256")
                    .subject(username)
                    .claim("preferred_username", username)
                    .claim("realm_access", Map.of("roles", List.of(role)))
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();
        }

        @Test
        void publicEndpointsAccessibleWithoutAuth() throws Exception {
            mockMvc.perform(get("/health"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("UP"));

            mockMvc.perform(get("/api-docs"))
                    .andExpect(status().isOk());
        }

        @Test
        void protectedEndpointReturns401WhenUnauthenticated() throws Exception {
            mockMvc.perform(get("/api/workflow/12345"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401))
                    .andExpect(jsonPath("$.error").value("Unauthorized"));
        }

        @Test
        void protectedEndpointReturns200WithValidJwt() throws Exception {
            mockMvc.perform(get("/api/workflow/12345")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer viewer-token"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value("12345"));
        }

        @Test
        void adminEndpointAccessibleWithAdminRole() throws Exception {
            mockMvc.perform(get("/api/admin/users")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer admin-token"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role").value("admin"));
        }

        @Test
        void adminEndpointReturns403WithInsufficientRole() throws Exception {
            mockMvc.perform(get("/api/admin/users")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer viewer-token"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.error").value("Forbidden"));
        }

        @Test
        void metadataWriteRequiresOperatorOrAdmin() throws Exception {
            // Operator can create metadata
            mockMvc.perform(post("/api/metadata/workflow")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer operator-token"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.result").value("created"));

            // Viewer cannot create metadata
            mockMvc.perform(post("/api/metadata/workflow")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer viewer-token"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.error").value("Forbidden"));
        }
    }

    @Nested
    @WebMvcTest(controllers = SecurityTestController.class)
    @Import({ConductorSecurityConfiguration.class, SecurityTestController.class})
    @TestPropertySource(properties = {
        "conductor.security.enabled=false"
    })
    class SecurityDisabledTests {

        @Autowired
        private MockMvc mockMvc;

        @Test
        void allEndpointsPermittedWhenSecurityDisabled() throws Exception {
            mockMvc.perform(get("/api/workflow/12345"))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/admin/users"))
                    .andExpect(status().isOk());

            mockMvc.perform(delete("/api/metadata/workflow/test"))
                    .andExpect(status().isOk());
        }
    }
}
