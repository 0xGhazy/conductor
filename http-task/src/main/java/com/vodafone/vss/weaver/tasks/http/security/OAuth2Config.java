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

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.web.reactive.function.BodyInserters;

import com.vodafone.vss.weaver.common.StringUtils;
import com.vodafone.vss.weaver.common.http.HttpConnectionModel;
import com.vodafone.vss.weaver.common.http.XGrantType;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Setter
@Getter
@ToString
@Builder
@AllArgsConstructor
public class OAuth2Config {

    private final String name;
    private final XGrantType grantType;
    private final String tokenEndpoint;
    private final String clientId;
    private final String clientSecret;
    private final String scope;
    private final String username;
    private final String password;
    private final String resource;
    private final String code;
    private final String redirectUri;
    private final String codeVerifier;

    public static OAuth2Config from(HttpConnectionModel c) {
        String grantTypeRaw = StringUtils.getStringOrNull(c.getAuthConfig(), "grantType");
        XGrantType grantType = grantTypeRaw != null ? XGrantType.valueOf(grantTypeRaw) : null;
        return OAuth2Config.builder()
                .name(c.getName())
                .grantType(grantType)
                .tokenEndpoint(StringUtils.getStringOrNull(c.getAuthConfig(), "tokenEndpoint"))
                .clientId(StringUtils.getStringOrNull(c.getAuthConfig(), "clientId"))
                .clientSecret(StringUtils.getStringOrNull(c.getAuthConfig(), "clientSecret"))
                .scope(StringUtils.getStringOrNull(c.getAuthConfig(), "scope"))
                .username(StringUtils.getStringOrNull(c.getAuthConfig(), "username"))
                .password(StringUtils.getStringOrNull(c.getAuthConfig(), "password"))
                .code(StringUtils.getStringOrNull(c.getAuthConfig(), "code"))
                .resource(StringUtils.getStringOrNull(c.getAuthConfig(), "resource"))
                .redirectUri(StringUtils.getStringOrNull(c.getAuthConfig(), "redirectUri"))
                .codeVerifier(StringUtils.getStringOrNull(c.getAuthConfig(), "codeVerifier"))
                .build();
    }

    public BodyInserters.FormInserter<String> buildStrategy() {
        validateRequiredGrantTypeParameters();
        BodyInserters.FormInserter<String> form;
        switch (Objects.requireNonNull(grantType)) {
            case PASSWORD: {
                form = BodyInserters
                        .fromFormData("grant_type", "password")
                        .with("client_id", clientId)
                        .with("username", username)
                        .with("password", password);
                FormUtils.addIfPresent(form, "client_secret", clientSecret);
                FormUtils.addIfPresent(form, "scope", scope);
                return form;
            }
            case CLIENT_CREDENTIALS: {
                form = BodyInserters
                        .fromFormData("grant_type", "client_credentials")
                        .with("client_id", clientId)
                        .with("client_secret", clientSecret);
                FormUtils.addIfPresent(form, "resource", resource);
                FormUtils.addIfPresent(form, "scope", scope);
                return form;
            }
            case AUTHORIZATION_CODE: {
                form = BodyInserters
                        .fromFormData("grant_type", "authorization_code")
                        .with("client_id", clientId)
                        .with("code", code)
                        .with("redirect_uri", redirectUri);
                FormUtils.addIfPresent(form, "client_secret", clientSecret);
                FormUtils.addIfPresent(form, "code_verifier", codeVerifier);
                return form;
            }
        }
        return null;
    }

    public void validateRequiredGrantTypeParameters() {
        List<String> missing = new ArrayList<>();
        if (StringUtils.isBlank(tokenEndpoint)) missing.add("tokenEndpoint");
        if (grantType == null) missing.add("grantType");

        if (grantType != null) {
            switch (grantType) {
                case CLIENT_CREDENTIALS -> {
                    if (StringUtils.isBlank(clientId)) missing.add("clientId");
                    if (StringUtils.isBlank(clientSecret)) missing.add("clientSecret");
                }
                case PASSWORD -> {
                    if (StringUtils.isBlank(clientId)) missing.add("clientId");
                    if (StringUtils.isBlank(username)) missing.add("username");
                    if (StringUtils.isBlank(password)) missing.add("password");
                }
                case AUTHORIZATION_CODE -> {
                    if (StringUtils.isBlank(clientId)) missing.add("clientId");
                    if (StringUtils.isBlank(code)) missing.add("code");
                    if (StringUtils.isBlank(redirectUri)) missing.add("redirectUri");
                }
            }
        }

        if (!missing.isEmpty()) {
            throw new IllegalArgumentException(
                    "Missing required OAuth2 parameter(s) for " + grantType + ": " + String.join(", ", missing));
        }
    }
}

