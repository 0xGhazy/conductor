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

import java.util.Collections;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Utility helper methods to retrieve details of the currently authenticated user
 * from the Spring SecurityContext.
 */
public final class SecurityUtils {

    private static final String PREFERRED_USERNAME_CLAIM = "preferred_username";
    private static final String EMAIL_CLAIM = "email";
    private static final String ROLE_PREFIX = "ROLE_";

    private SecurityUtils() {
        // Utility class
    }

    /**
     * Returns the current Authentication object, if present and authenticated.
     */
    public static Optional<Authentication> getAuthentication() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return Optional.of(auth);
        }
        return Optional.empty();
    }

    /**
     * Returns whether the current request is from an authenticated user.
     */
    public static boolean isAuthenticated() {
        return getAuthentication().isPresent();
    }

    /**
     * Returns the current JWT token, if the authentication token is a {@link JwtAuthenticationToken}.
     */
    public static Optional<Jwt> getJwt() {
        return getAuthentication()
                .filter(auth -> auth instanceof JwtAuthenticationToken)
                .map(auth -> ((JwtAuthenticationToken) auth).getToken());
    }

    /**
     * Returns the username of the currently authenticated user.
     * Prefers {@code preferred_username} from JWT claims, falling back to {@code getSubject()} or {@code getName()}.
     */
    public static Optional<String> getCurrentUsername() {
        return getAuthentication().map(auth -> {
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                Jwt jwt = jwtAuth.getToken();
                String preferredUsername = jwt.getClaimAsString(PREFERRED_USERNAME_CLAIM);
                if (StringUtils.isNotBlank(preferredUsername)) {
                    return preferredUsername;
                }
                if (StringUtils.isNotBlank(jwt.getSubject())) {
                    return jwt.getSubject();
                }
            }
            return auth.getName();
        });
    }

    /**
     * Returns the email address of the currently authenticated user, if present in the JWT.
     */
    public static Optional<String> getCurrentUserEmail() {
        return getJwt().map(jwt -> jwt.getClaimAsString(EMAIL_CLAIM)).filter(StringUtils::isNotBlank);
    }

    /**
     * Returns the set of granted roles for the current user (with {@code ROLE_} prefix stripped).
     */
    public static Set<String> getCurrentUserRoles() {
        return getAuthentication()
                .map(auth -> auth.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .filter(a -> a.startsWith(ROLE_PREFIX))
                        .map(a -> a.substring(ROLE_PREFIX.length()))
                        .collect(Collectors.toSet()))
                .orElse(Collections.emptySet());
    }
}
