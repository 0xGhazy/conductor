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
package com.vodafone.vss.weaver.actions.database.registry;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.util.PasswordEncryptionUtil;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.JdbcConnectionDetails;
import com.vodafone.vss.weaver.common.database.PoolSettings;
import com.vodafone.vss.weaver.core.placeholders.WeaverPlaceholderResolver;
import com.vodafone.vss.weaver.dao.DatasourceDAO;

@Component
public class DatasourceConfigProvider {

    private static final Logger log = LoggerFactory.getLogger(DatasourceConfigProvider.class);

    private final DatasourceDAO datasourceDAO;
    private final Cache<UUID, DatasourceConfig> configCache;
    private final ConcurrentHashMap<UUID, Long> lastVersionCheckTime = new ConcurrentHashMap<>();
    private final long versionCheckIntervalMs;

    @Autowired(required = false)
    private WeaverPlaceholderResolver placeholders;

    @Autowired
    public DatasourceConfigProvider(
            DatasourceDAO datasourceDAO,
            @Value("${weaver.datasource.metadata.cache-ttl-hours:1}") int metadataTtlHours,
            @Value("${weaver.datasource.metadata.max-cached:1000}") int maxCached,
            @Value("${weaver.datasource.version-check-interval-seconds:30}") int versionCheckIntervalSeconds
    ) {
        this.datasourceDAO = datasourceDAO;
        this.configCache = Caffeine.newBuilder()
                .maximumSize(maxCached)
                .expireAfterWrite(metadataTtlHours, TimeUnit.HOURS)
                .build();
        this.versionCheckIntervalMs = TimeUnit.SECONDS.toMillis(versionCheckIntervalSeconds);
    }

    public DatasourceConfigProvider(
            DatasourceDAO datasourceDAO,
            int metadataTtlHours,
            int maxCached
    ) {
        this(datasourceDAO, metadataTtlHours, maxCached, 30);
    }

    public Optional<DatasourceConfig> getConfig(UUID id) {
        if (id == null) return Optional.empty();
        DatasourceConfig cached = configCache.get(id, key ->
                datasourceDAO.findById(key)
                        .map(this::toResolvedConfig)
                        .orElse(null)
        );
        return Optional.ofNullable(cached);
    }

    public Optional<DatasourceConfig> getFreshConfig(UUID id) {
        if (id == null) return Optional.empty();
        invalidate(id);
        return datasourceDAO.findById(id).map(ds -> {
            DatasourceConfig config = toResolvedConfig(ds);
            putConfig(config);
            recordVersionCheck(id);
            return config;
        });
    }

    public Optional<Long> getVersionFromDb(UUID id) {
        if (id == null) return Optional.empty();
        return datasourceDAO.findVersionById(id);
    }

    public boolean existsInDb(UUID id) {
        if (id == null) return false;
        return datasourceDAO.existsById(id);
    }

    public boolean isVersionCheckDue(UUID id) {
        if (id == null) return false;
        Long last = lastVersionCheckTime.get(id);
        return last == null || (System.currentTimeMillis() - last) >= versionCheckIntervalMs;
    }

    public void recordVersionCheck(UUID id) {
        if (id != null) {
            lastVersionCheckTime.put(id, System.currentTimeMillis());
        }
    }

    public void resetVersionCheck(UUID id) {
        if (id != null) {
            lastVersionCheckTime.remove(id);
        }
    }

    public void putConfig(DatasourceConfig config) {
        if (config != null && config.id() != null) {
            configCache.put(config.id(), config);
        }
    }

    public void invalidate(UUID id) {
        if (id != null) {
            configCache.invalidate(id);
            lastVersionCheckTime.remove(id);
        }
    }

    public void invalidateAll() {
        configCache.invalidateAll();
        lastVersionCheckTime.clear();
    }

    public long getCachedCount() {
        return configCache.estimatedSize();
    }

    public DatasourceConfig toResolvedConfig(DatasourceModel ds) {
        if (ds == null) return null;
        JdbcConnectionDetails conn = ds.getConnection() != null ? ds.getConnection() : new JdbcConnectionDetails();

        String rawUrl = conn.getUrl();
        String rawUser = conn.getUsername();
        String rawPass = conn.getPassword();
        String schema = conn.getSchema();

        // 1. Decrypt password if encrypted
        String decryptedPass = PasswordEncryptionUtil.decrypt(rawPass);

        // 2. Resolve variables / secrets in url, username, password, schema
        String resolvedUrl = resolve(rawUrl);
        String resolvedUser = resolve(rawUser);
        String resolvedPass = resolve(decryptedPass);
        String resolvedSchema = resolve(schema);

        PoolSettings poolSettings = PoolSettings.builder()
                .maximumPoolSize(conn.getMaxPoolSize() != null ? conn.getMaxPoolSize() : 5)
                .minimumIdle(conn.getMinimumIdle() != null ? conn.getMinimumIdle() : 0)
                .connectionTimeoutMs(conn.getConnectionTimeout() != null ? conn.getConnectionTimeout().longValue() : 10000L)
                .idleTimeoutMs(conn.getIdleTimeout() != null ? conn.getIdleTimeout().longValue() : 60000L)
                .maxLifetimeMs(conn.getMaxLifetime() != null ? conn.getMaxLifetime() : 1800000L)
                .build();

        return new DatasourceConfig(
                ds.getId(),
                ds.getName(),
                ds.getVersion() != null ? ds.getVersion() : 0L,
                ds.getType(),
                resolvedUrl,
                resolvedUser,
                resolvedPass,
                poolSettings,
                resolvedSchema,
                conn.getProperties() != null ? conn.getProperties() : Collections.emptyMap()
        );
    }

    /**
     * Datasource settings are admin configuration: ${weaver.env.NAME[:default]} and
     * ${weaver.secrets.NAME} are resolved here and kept only in the in-memory config cache.
     */
    private String resolve(String text) {
        if (text == null || text.isBlank() || placeholders == null) {
            return text;
        }
        return placeholders.resolveConfig(text);
    }
}
