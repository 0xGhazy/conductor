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

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Data;

/**
 * Configuration properties for Conductor Keycloak and OAuth2 Resource Server integration.
 *
 * <p>Properties can be configured via environment variables or application.properties under the
 * {@code conductor.security} prefix.
 */
@Data
@ConfigurationProperties(prefix = "conductor.security")
public class ConductorSecurityProperties {

    /**
     * Whether Keycloak / OAuth2 Resource Server security is enabled.
     * When false (default), all HTTP requests are permitted without authentication.
     */
    private boolean enabled = false;

    /**
     * The primary client ID in Keycloak (e.g. "weaver").
     * Used to extract client-specific roles from {@code resource_access.<clientId>.roles}.
     */
    private String clientId = "weaver";

    /**
     * The Keycloak realm issuer URI (e.g. "http://localhost:8085/realms/weaver").
     */
    private String issuerUri;

    /**
     * The Keycloak JWK Set URI for token verification
     * (e.g. "http://localhost:8085/realms/weaver/protocol/openid-connect/certs").
     */
    private String jwkSetUri;

    /**
     * Role required for administrative actions (e.g. /api/admin/**).
     */
    private String adminRole = "conductor_admin";

    /**
     * Role required for operator actions (e.g. metadata creation, workflow management).
     */
    private String operatorRole = "conductor_operator";

    /**
     * Role for read-only / viewer actions.
     */
    private String viewerRole = "conductor_viewer";

    /**
     * Role for worker tasks (polling and acknowledging tasks).
     */
    private String workerRole = "conductor_worker";

    /**
     * Additional URL patterns that should be publicly accessible without authentication.
     */
    private List<String> publicEndpoints = new ArrayList<>();
}
