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

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import lombok.extern.slf4j.Slf4j;

/**
 * Extracts and maps Keycloak realm roles, client roles, and OAuth2 scopes into Spring Security
 * {@link GrantedAuthority} objects.
 *
 * <p>Design and Algorithm:
 * <ul>
 *   <li>Reads the {@code realm_access.roles} JSON array from the decoded Keycloak JWT.
 *   <li>Reads the {@code resource_access.<clientId>.roles} JSON array for the target client ID.
 *   <li>Maps each role to {@code ROLE_<role_name>} (preserving original casing and adding upper-case
 *       variant for ease of matching in {@code hasRole(...)} expressions).
 *   <li>Preserves OAuth2 standard scopes (claim {@code scope} or {@code scp}) with prefix {@code SCOPE_}.
 * </ul>
 */
@Slf4j
public class KeycloakJwtAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    private static final String REALM_ACCESS_CLAIM = "realm_access";
    private static final String RESOURCE_ACCESS_CLAIM = "resource_access";
    private static final String ROLES_CLAIM = "roles";
    private static final String SCOPE_CLAIM = "scope";
    private static final String SCP_CLAIM = "scp";
    private static final String ROLE_PREFIX = "ROLE_";
    private static final String SCOPE_PREFIX = "SCOPE_";

    private final String clientId;

    public KeycloakJwtAuthoritiesConverter(String clientId) {
        this.clientId = clientId;
    }

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        Set<GrantedAuthority> authorities = new HashSet<>();

        // 1. Extract Realm Roles (e.g. realm_access.roles: ["conductor_admin", "offline_access"])
        extractRealmRoles(jwt, authorities);

        // 2. Extract Client / Resource Roles (e.g. resource_access.weaver.roles: ["conductor_admin"])
        extractClientRoles(jwt, authorities);

        // 3. Extract OAuth2 Scopes
        extractScopes(jwt, authorities);

        log.debug("Converted authorities for subject {}: {}", jwt.getSubject(), authorities);
        return Collections.unmodifiableSet(authorities);
    }

    @SuppressWarnings("unchecked")
    private void extractRealmRoles(Jwt jwt, Set<GrantedAuthority> authorities) {
        Map<String, Object> realmAccess = jwt.getClaim(REALM_ACCESS_CLAIM);
        if (realmAccess != null && realmAccess.containsKey(ROLES_CLAIM)) {
            Object rolesObj = realmAccess.get(ROLES_CLAIM);
            if (rolesObj instanceof List<?> roleList) {
                for (Object role : roleList) {
                    if (role instanceof String roleStr && StringUtils.isNotBlank(roleStr)) {
                        addRoleAuthorities(authorities, roleStr);
                    }
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void extractClientRoles(Jwt jwt, Set<GrantedAuthority> authorities) {
        Map<String, Object> resourceAccess = jwt.getClaim(RESOURCE_ACCESS_CLAIM);
        if (resourceAccess == null || resourceAccess.isEmpty()) {
            return;
        }

        // Check target clientId first
        if (StringUtils.isNotBlank(clientId) && resourceAccess.containsKey(clientId)) {
            extractRolesFromResourceMap(resourceAccess.get(clientId), authorities);
        }

        // Also check any other client entries present in resource_access
        for (Map.Entry<String, Object> entry : resourceAccess.entrySet()) {
            if (!entry.getKey().equalsIgnoreCase(clientId)) {
                extractRolesFromResourceMap(entry.getValue(), authorities);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void extractRolesFromResourceMap(Object clientResourceObj, Set<GrantedAuthority> authorities) {
        if (clientResourceObj instanceof Map<?, ?> clientResourceMap) {
            Object rolesObj = clientResourceMap.get(ROLES_CLAIM);
            if (rolesObj instanceof List<?> roleList) {
                for (Object role : roleList) {
                    if (role instanceof String roleStr && StringUtils.isNotBlank(roleStr)) {
                        addRoleAuthorities(authorities, roleStr);
                    }
                }
            }
        }
    }

    private void addRoleAuthorities(Set<GrantedAuthority> authorities, String roleName) {
        authorities.add(new SimpleGrantedAuthority(ROLE_PREFIX + roleName));
        String upper = roleName.toUpperCase();
        if (!upper.equals(roleName)) {
            authorities.add(new SimpleGrantedAuthority(ROLE_PREFIX + upper));
        }
    }

    @SuppressWarnings("unchecked")
    private void extractScopes(Jwt jwt, Set<GrantedAuthority> authorities) {
        Object scopeClaim = jwt.getClaim(SCOPE_CLAIM);
        if (scopeClaim == null) {
            scopeClaim = jwt.getClaim(SCP_CLAIM);
        }

        if (scopeClaim instanceof String scopeStr && StringUtils.isNotBlank(scopeStr)) {
            for (String scope : scopeStr.split("\\s+")) {
                if (StringUtils.isNotBlank(scope)) {
                    authorities.add(new SimpleGrantedAuthority(SCOPE_PREFIX + scope));
                }
            }
        } else if (scopeClaim instanceof List<?> scopeList) {
            for (Object scope : scopeList) {
                if (scope instanceof String scopeStr && StringUtils.isNotBlank(scopeStr)) {
                    authorities.add(new SimpleGrantedAuthority(SCOPE_PREFIX + scopeStr));
                }
            }
        }
    }
}
