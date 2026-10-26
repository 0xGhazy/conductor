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

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Spring Security configuration for Conductor / Keycloak OAuth2 Resource Server integration.
 *
 * <p>Design & Architecture:
 * <ul>
 *   <li>When {@code conductor.security.enabled=false} (default), a permit-all filter chain is registered.
 *       Existing automated tests and non-secured deployments run without any behavioral change.
 *   <li>When {@code conductor.security.enabled=true}, a stateless OAuth2 Resource Server filter chain is
 *       registered to validate Keycloak JWT bearer tokens against Keycloak's JWKS.
 *   <li>Converts Keycloak realm roles ({@code realm_access.roles}) and client roles
 *       ({@code resource_access.<clientId>.roles}) into Spring Security {@code ROLE_*} authorities via
 *       {@link KeycloakJwtAuthoritiesConverter}.
 *   <li>Enforces role-based endpoint protection (e.g. {@code /api/admin/**} requires administrator role,
 *       and metadata definition modifications require admin or operator roles).
 *   <li>Keeps health checks, Prometheus metrics, Swagger/OpenAPI UI, and frontend SPA static assets public.
 *   <li>Returns structured JSON errors on 401 Unauthorized and 403 Forbidden via
 *       {@link ConductorAuthenticationEntryPoint} and {@link ConductorAccessDeniedHandler}.
 * </ul>
 */
@AutoConfiguration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@EnableConfigurationProperties(ConductorSecurityProperties.class)
@Slf4j
public class ConductorSecurityConfiguration {

    private static final String[] PUBLIC_SWAGGER_ENDPOINTS = {
        "/api-docs",
        "/api-docs/**",
        "/v3/api-docs",
        "/v3/api-docs/**",
        "/swagger-ui",
        "/swagger-ui/**",
        "/swagger-ui.html"
    };

    private static final String[] PUBLIC_HEALTH_ACTUATOR_ENDPOINTS = {
        "/health",
        "/health/**",
        "/api/health",
        "/api/health/**",
        "/actuator/health",
        "/actuator/health/**",
        "/actuator/prometheus",
        "/actuator/info"
    };

    private static final String[] PUBLIC_STATIC_UI_ENDPOINTS = {
        "/",
        "/index.html",
        "/static/**",
        "/assets/**",
        "/*.ico",
        "/*.png",
        "/*.svg",
        "/*.js",
        "/*.css",
        "/error"
    };

    /**
     * Fallback security filter chain when security is disabled.
     * All requests are permitted without requiring authentication.
     */
    @Bean
    @ConditionalOnProperty(name = "conductor.security.enabled", havingValue = "false", matchIfMissing = true)
    public SecurityFilterChain permitAllSecurityFilterChain(HttpSecurity http) throws Exception {
        log.info("Conductor security is DISABLED (conductor.security.enabled=false). All requests permitted.");
        http.csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    /**
     * Active OAuth2 Resource Server filter chain when security is enabled.
     */
    @Bean
    @ConditionalOnProperty(name = "conductor.security.enabled", havingValue = "true")
    public SecurityFilterChain keycloakSecurityFilterChain(
            HttpSecurity http,
            ConductorSecurityProperties properties,
            ObjectMapper objectMapper)
            throws Exception {
        log.info("Conductor security is ENABLED. Configuring Keycloak OAuth2 Resource Server for client ID: {}",
                properties.getClientId());

        ConductorAuthenticationEntryPoint authEntryPoint = new ConductorAuthenticationEntryPoint(objectMapper);
        ConductorAccessDeniedHandler accessDeniedHandler = new ConductorAccessDeniedHandler(objectMapper);

        List<String> allPublicEndpoints = new ArrayList<>();
        allPublicEndpoints.addAll(List.of(PUBLIC_HEALTH_ACTUATOR_ENDPOINTS));
        allPublicEndpoints.addAll(List.of(PUBLIC_SWAGGER_ENDPOINTS));
        allPublicEndpoints.addAll(List.of(PUBLIC_STATIC_UI_ENDPOINTS));
        if (properties.getPublicEndpoints() != null) {
            allPublicEndpoints.addAll(properties.getPublicEndpoints());
        }

        String adminRole = properties.getAdminRole();
        String operatorRole = properties.getOperatorRole();

        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers(allPublicEndpoints.toArray(new String[0])).permitAll()
                        // Admin endpoints restricted to administrator role
                        .requestMatchers("/api/admin/**").hasAnyRole(adminRole, adminRole.toUpperCase(), "ADMIN")
                        // Metadata definition write operations restricted to admin or operator
                        .requestMatchers(HttpMethod.POST, "/api/metadata/**").hasAnyRole(
                                adminRole, operatorRole, adminRole.toUpperCase(), operatorRole.toUpperCase(), "ADMIN", "OPERATOR")
                        .requestMatchers(HttpMethod.PUT, "/api/metadata/**").hasAnyRole(
                                adminRole, operatorRole, adminRole.toUpperCase(), operatorRole.toUpperCase(), "ADMIN", "OPERATOR")
                        .requestMatchers(HttpMethod.DELETE, "/api/metadata/**").hasAnyRole(
                                adminRole, operatorRole, adminRole.toUpperCase(), operatorRole.toUpperCase(), "ADMIN", "OPERATOR")
                        // All other REST APIs require authentication
                        .requestMatchers("/api/**").authenticated()
                        // SPA and client-side routes (non-API GET requests rewritten by SpaInterceptor)
                        .anyRequest().permitAll()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter(properties)))
                        .authenticationEntryPoint(authEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                );

        return http.build();
    }

    /**
     * Configures the JWT authentication converter using KeycloakJwtAuthoritiesConverter.
     */
    @Bean
    public Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter(
            ConductorSecurityProperties properties) {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakJwtAuthoritiesConverter(properties.getClientId()));
        return converter;
    }

    /**
     * Fallback JwtDecoder bean when spring-boot auto-configuration does not supply one directly.
     */
    @Bean
    @ConditionalOnProperty(name = "conductor.security.enabled", havingValue = "true")
    @ConditionalOnMissingBean(JwtDecoder.class)
    public JwtDecoder jwtDecoder(
            ConductorSecurityProperties securityProperties,
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:#{null}}") String springJwkSetUri,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:#{null}}") String springIssuerUri) {
        String jwkSetUri = StringUtils.isNotBlank(securityProperties.getJwkSetUri())
                ? securityProperties.getJwkSetUri()
                : springJwkSetUri;
        if (StringUtils.isNotBlank(jwkSetUri)) {
            log.info("Initializing NimbusJwtDecoder with JWK Set URI: {}", jwkSetUri);
            return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        }

        String issuerUri = StringUtils.isNotBlank(securityProperties.getIssuerUri())
                ? securityProperties.getIssuerUri()
                : springIssuerUri;
        if (StringUtils.isNotBlank(issuerUri)) {
            log.info("Initializing JwtDecoder from Issuer URI: {}", issuerUri);
            return JwtDecoders.fromIssuerLocation(issuerUri);
        }

        throw new IllegalStateException(
                "Conductor Keycloak security is enabled (conductor.security.enabled=true), but neither "
                        + "'spring.security.oauth2.resourceserver.jwt.jwk-set-uri' nor "
                        + "'spring.security.oauth2.resourceserver.jwt.issuer-uri' is configured.");
    }
}
