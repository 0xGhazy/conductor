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
package com.vodafone.vss.weaver.tasks.http.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.http.AuthenticationStrategy;
import com.vodafone.vss.weaver.common.http.CreateConnectionRequest;
import com.vodafone.vss.weaver.common.http.HttpConnectionModel;
import com.vodafone.vss.weaver.common.http.ShortDetailedHttpConnection;
import com.vodafone.vss.weaver.core.exception.NotFoundException;
import com.vodafone.vss.weaver.core.placeholders.WeaverPlaceholderResolver;
import com.vodafone.vss.weaver.dao.HttpConnectionDAO;
import com.vodafone.vss.weaver.tasks.http.security.ApiKey;
import com.vodafone.vss.weaver.tasks.http.security.AuthStrategy;
import com.vodafone.vss.weaver.tasks.http.security.BasicAuthentication;
import com.vodafone.vss.weaver.tasks.http.security.CookieAuth;
import com.vodafone.vss.weaver.tasks.http.security.OAuth2;
import com.vodafone.vss.weaver.tasks.http.security.OAuth2Config;

@Service
public class HttpConnectionService {

    private static final Logger log = LoggerFactory.getLogger(HttpConnectionService.class);

    private final HttpConnectionDAO repository;
    private final ConcurrentHashMap<String, AuthStrategy> connectionsPool = new ConcurrentHashMap<>();

    @Autowired(required = false)
    private WeaverPlaceholderResolver placeholders;

    public HttpConnectionService(HttpConnectionDAO repository) {
        this.repository = repository;
    }

    @PostConstruct
    public void init() {
        List<HttpConnectionModel> connections = repository.findAll();
        if (connections.isEmpty()) {
            log.info("No stored HTTP connections found during initialization");
            return;
        }

        int index = 0;
        for (HttpConnectionModel stored : connections) {
            try {
                registerToConnectionsPool(stored);
                log.debug("#{}/{} Registered connection '{}' to pool", ++index, connections.size(), stored.getName());
            } catch (Exception e) {
                log.error("#{}/{} Failed to pool connection '{}': {}", ++index, connections.size(), stored.getName(), e.getMessage());
            }
        }
        log.info("HTTP Connection pool initialized successfully with {} active connections", connectionsPool.size());
    }

    public List<ShortDetailedHttpConnection> listConnectionsWithStates() {
        List<HttpConnectionModel> connections = repository.findAll();
        List<ShortDetailedHttpConnection> result = new ArrayList<>();
        for (HttpConnectionModel conn : connections) {
            AuthStrategy strategy = connectionsPool.get(conn.getName());
            boolean isActive = strategy != null && strategy.testAuthentication();
            result.add(
                    ShortDetailedHttpConnection.builder()
                            .id(conn.getId())
                            .name(conn.getName())
                            .strategy(conn.getStrategy())
                            .status(isActive)
                            .build());
        }
        return result;
    }

    public ShortDetailedHttpConnection registerConnection(CreateConnectionRequest dto) {
        String name = normalizeName(dto.name());
        if (repository.existsByName(name) || connectionsPool.containsKey(name)) {
            throw new IllegalArgumentException("Connection '" + name + "' already exists");
        }

        HttpConnectionModel model =
                HttpConnectionModel.builder()
                        .name(name)
                        .strategy(dto.strategy())
                        .authConfig(dto.authConfig())
                        .build();

        HttpConnectionModel saved = repository.create(model);
        registerToConnectionsPool(saved);

        return ShortDetailedHttpConnection.builder()
                .id(saved.getId())
                .name(saved.getName())
                .strategy(saved.getStrategy())
                .status(getConnectionStatus(saved))
                .build();
    }

    public HttpConnectionModel fetchConnectionById(UUID id) {
        HttpConnectionModel connection =
                repository.findById(id)
                        .orElseThrow(() -> new NotFoundException("Connection " + id + " not found"));
        connection.setActive(getConnectionStatus(connection));
        return connection;
    }

    public ShortDetailedHttpConnection updateConnectionById(UUID id, CreateConnectionRequest dto) {
        HttpConnectionModel existing =
                repository.findById(id)
                        .orElseThrow(() -> new NotFoundException("Connection " + id + " not found"));

        String name = normalizeName(dto.name());
        Optional<HttpConnectionModel> nameOwner = repository.findByName(name);
        if (nameOwner.isPresent() && !nameOwner.get().getId().equals(id)) {
            throw new IllegalArgumentException("Connection '" + name + "' already exists");
        }

        String oldName = existing.getName();
        existing.setName(name);
        existing.setStrategy(dto.strategy());
        existing.setAuthConfig(dto.authConfig());

        HttpConnectionModel saved = repository.update(existing);
        if (oldName != null && !oldName.equalsIgnoreCase(name)) {
            connectionsPool.remove(oldName);
        }
        registerToConnectionsPool(saved);

        return ShortDetailedHttpConnection.builder()
                .id(saved.getId())
                .name(saved.getName())
                .strategy(saved.getStrategy())
                .status(getConnectionStatus(saved))
                .build();
    }

    public void deleteConnectionById(UUID id) {
        HttpConnectionModel existing =
                repository.findById(id)
                        .orElseThrow(() -> new NotFoundException("Connection " + id + " not found"));
        repository.deleteById(id);
        if (existing.getName() != null) {
            connectionsPool.remove(existing.getName());
        }
    }

    public AuthStrategy getConnection(String name) {
        if (name == null) {
            throw new NotFoundException("Connection name cannot be null");
        }
        String normalized = name.toUpperCase().trim().replace(" ", "-");
        AuthStrategy strategy = connectionsPool.get(normalized);
        if (strategy == null) {
            // Check fallback by raw name
            strategy = connectionsPool.get(name);
        }
        if (strategy == null) {
            throw new NotFoundException("HTTP Connection '" + name + "' not found in pool");
        }
        return strategy;
    }

    public void refreshConnection(UUID id) {
        repository.findById(id).ifPresent(this::registerToConnectionsPool);
    }

    private void registerToConnectionsPool(HttpConnectionModel stored) {
        HttpConnectionModel connection = withResolvedSecrets(stored);
        String name = connection.getName();
        AuthenticationStrategy strategy = connection.getStrategy();

        AuthStrategy authStrategy = null;
        if (AuthenticationStrategy.OAUTH2.equals(strategy)) {
            OAuth2Config config = OAuth2Config.from(connection);
            authStrategy = new OAuth2(config);
        } else if (AuthenticationStrategy.API_KEY.equals(strategy)) {
            authStrategy = new ApiKey(connection);
        } else if (AuthenticationStrategy.BASIC_AUTHENTICATION.equals(strategy)) {
            authStrategy = new BasicAuthentication(connection.getAuthConfig());
        } else if (AuthenticationStrategy.COOKIE.equals(strategy)) {
            authStrategy = new CookieAuth(connection.getAuthConfig());
        }

        if (authStrategy == null) {
            throw new IllegalStateException("Unknown or unsupported authentication strategy: " + strategy);
        }

        connectionsPool.put(name, authStrategy);
    }

    private boolean getConnectionStatus(HttpConnectionModel connection) {
        if (connection == null || connection.getName() == null) return false;
        AuthStrategy authStrategy = connectionsPool.get(connection.getName());
        if (authStrategy == null) return false;
        try {
            return authStrategy.testAuthentication();
        } catch (Exception e) {
            log.warn("Health test failed for connection {}: {}", connection.getName(), e.getMessage());
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private HttpConnectionModel withResolvedSecrets(HttpConnectionModel connection) {
        if (placeholders == null || connection.getAuthConfig() == null) {
            return connection;
        }
        // Connection settings are admin configuration: ${weaver.env...} and ${weaver.secrets...}
        // are resolved here, once, and kept only in memory.
        Object resolved = placeholders.resolveConfigDeep(connection.getAuthConfig());
        return HttpConnectionModel.builder()
                .id(connection.getId())
                .name(connection.getName())
                .strategy(connection.getStrategy())
                .authConfig(resolved instanceof Map ? (Map<String, Object>) resolved : connection.getAuthConfig())
                .createdAt(connection.getCreatedAt())
                .updatedAt(connection.getUpdatedAt())
                .lastCheck(connection.getLastCheck())
                .error(connection.getError())
                .build();
    }

    private String normalizeName(String name) {
        return name == null ? "" : name.toUpperCase().trim().replace(" ", "-");
    }
}

