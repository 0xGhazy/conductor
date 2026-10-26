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
package com.vodafone.vss.weaver.audit.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.vodafone.vss.weaver.common.audit.UserMinimal;

import jakarta.servlet.http.HttpServletRequest;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

/**
 * Helper component extracting actor context from Spring Security and HTTP servlet requests.
 */
@Slf4j
@Component
public class AuditSecurityHelper {

    private static final String ANONYMOUS_USER = "anonymousUser";
    private static final String CLAIM_PREFERRED_USERNAME = "preferred_username";
    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_NAME = "name";

    private final UserService userService;

    @Autowired
    public AuditSecurityHelper(UserService userService) {
        this.userService = userService;
    }

    @Data
    @Builder
    public static class ActorContext {
        private String actorId;
        private String actorUsername;
        private String actorName;
        private String actorEmail;
        private String clientIp;
    }

    /**
     * Resolves the current actor context from SecurityContextHolder and HTTP request attributes.
     */
    public ActorContext resolveCurrentActor() {
        String actorId = null;
        String username = null;
        String name = null;
        String email = null;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !ANONYMOUS_USER.equals(auth.getPrincipal())) {
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                Jwt jwt = jwtAuth.getToken();
                actorId = jwt.getSubject();
                username = jwt.getClaimAsString(CLAIM_PREFERRED_USERNAME);
                if (username == null || username.isBlank()) {
                    username = actorId;
                }
                name = jwt.getClaimAsString(CLAIM_NAME);
                email = jwt.getClaimAsString(CLAIM_EMAIL);
            } else {
                actorId = auth.getName();
                username = auth.getName();
            }

            // Enrich user info via UserService (Caffeine cache + UserLookupDAO)
            if (actorId != null && userService != null) {
                try {
                    UserMinimal user = userService.getUserMinimalById(actorId);
                    if (user != null) {
                        if (user.getName() != null && !user.getName().isBlank()) {
                            name = user.getName();
                        }
                        if (user.getEmail() != null && !user.getEmail().isBlank()) {
                            email = user.getEmail();
                        }
                        if (user.getUsername() != null && !user.getUsername().isBlank()) {
                            username = user.getUsername();
                        }
                    }
                } catch (Exception ex) {
                    log.debug("User resolution failed for actorId '{}': {}", actorId, ex.getMessage());
                }
            }
        }

        String clientIp = resolveClientIp();

        return ActorContext.builder()
                .actorId(actorId)
                .actorUsername(username != null ? username : "system")
                .actorName(name != null ? name : username)
                .actorEmail(email)
                .clientIp(clientIp)
                .build();
    }

    /**
     * Extracts client IP address handling standard proxy/load-balancer headers.
     */
    private String resolveClientIp() {
        try {
            RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
            if (attributes instanceof ServletRequestAttributes servletAttrs) {
                HttpServletRequest request = servletAttrs.getRequest();
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                    return xForwardedFor.split(",")[0].trim();
                }
                String xRealIp = request.getHeader("X-Real-IP");
                if (xRealIp != null && !xRealIp.isBlank()) {
                    return xRealIp.trim();
                }
                return request.getRemoteAddr();
            }
        } catch (Exception ex) {
            log.trace("Could not resolve client IP: {}", ex.getMessage());
        }
        return null;
    }
}
