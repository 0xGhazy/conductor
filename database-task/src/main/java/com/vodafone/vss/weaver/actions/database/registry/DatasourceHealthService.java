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

import java.sql.Connection;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.vodafone.vss.weaver.actions.database.dialect.DialectRegistry;
import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.util.DatabaseErrorClassifier;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.DatasourceStatus;
import com.vodafone.vss.weaver.common.database.PingResult;

@Service
public class DatasourceHealthService {

    private static final Logger log = LoggerFactory.getLogger(DatasourceHealthService.class);

    public record PingObservation(boolean reachable, String reason, String errorCode, Instant timestamp) {}

    private final DataSourceRegistry dataSourceRegistry;
    private final DatasourceConfigProvider configProvider;
    private final Cache<UUID, PingObservation> lastPingCache;
    private final ExecutorService pingExecutor;

    @Autowired
    public DatasourceHealthService(
            DataSourceRegistry dataSourceRegistry,
            DatasourceConfigProvider configProvider
    ) {
        this.dataSourceRegistry = dataSourceRegistry;
        this.configProvider = configProvider;
        this.lastPingCache = Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(1, TimeUnit.HOURS)
                .build();
        int threads = Math.min(10, Math.max(2, Runtime.getRuntime().availableProcessors()));
        this.pingExecutor = new ThreadPoolExecutor(
                threads, threads,
                60L, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(500),
                r -> {
                    Thread t = new Thread(r, "weaver-ping-worker");
                    t.setDaemon(true);
                    return t;
                },
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }

    public DatasourceStatus getStatus(UUID datasourceId) {
        if (datasourceId == null) {
            return DatasourceStatus.inactive("Invalid ID", "Datasource ID cannot be null", DatabaseErrorCode.INVALID_CONFIGURATION.name(), Instant.now());
        }

        // 1. Failure backoff check
        Optional<FailedState> failed = dataSourceRegistry.getFailedState(datasourceId);
        if (failed.isPresent()) {
            FailedState state = failed.get();
            return DatasourceStatus.inactive("Connection in backoff", state.reason(), state.errorCode().name(), state.until());
        }

        PingObservation obs = lastPingCache.getIfPresent(datasourceId);

        // 2. Active pool in registry
        Optional<PoolHandle> poolOpt = dataSourceRegistry.getActivePool(datasourceId);
        if (poolOpt.isPresent() && poolOpt.get().isUsable()) {
            PoolHandle handle = poolOpt.get();
            if (obs != null && obs.timestamp().isAfter(handle.getCreatedAt())) {
                return obs.reachable()
                        ? DatasourceStatus.active(obs.timestamp())
                        : DatasourceStatus.inactive("Ping check failed", obs.reason(), obs.errorCode(), obs.timestamp());
            }
            return DatasourceStatus.active(handle.getCreatedAt());
        }

        // 3. Recent ping observation
        if (obs != null) {
            if (obs.reachable()) {
                return DatasourceStatus.active(obs.timestamp());
            } else {
                return DatasourceStatus.inactive("Ping check failed", obs.reason(), obs.errorCode(), obs.timestamp());
            }
        }

        // 4. DB existence check
        Optional<DatasourceConfig> configOpt = configProvider.getConfig(datasourceId);
        if (configOpt.isEmpty()) {
            return DatasourceStatus.inactive("Datasource not found", "Datasource does not exist in the database", DatabaseErrorCode.DATABASE_NOT_FOUND.name(), Instant.now());
        }

        return DatasourceStatus.unknown("No active connection pool or ping observation", Instant.now());
    }

    public PingResult ping(UUID datasourceId) {
        if (datasourceId == null) {
            return new PingResult(false, "Datasource ID cannot be null", DatabaseErrorCode.INVALID_CONFIGURATION.name());
        }

        Optional<PoolHandle> poolOpt = dataSourceRegistry.getActivePool(datasourceId);
        if (poolOpt.isPresent()) {
            PoolHandle handle = poolOpt.get();
            if (handle.tryAcquire()) {
                try (Connection conn = handle.getPool().getConnection()) {
                    if (conn.isValid(3)) {
                        PingResult result = new PingResult(true, "", null);
                        recordPingObservation(datasourceId, result);
                        return result;
                    }
                    PingResult result = new PingResult(false, "Connection test failed (isValid returned false)", DatabaseErrorCode.CONNECTION_FAILED.name());
                    recordPingObservation(datasourceId, result);
                    return result;
                } catch (Exception ex) {
                    log.warn("Pool connection ping failed for datasource id={}: {}", datasourceId, ex.getMessage());
                    DatabaseErrorClassifier.Result classified = DatabaseErrorClassifier.classify(ex);
                    PingResult result = new PingResult(false, classified.safeMessage(), classified.code().name());
                    recordPingObservation(datasourceId, result);
                    return result;
                } finally {
                    handle.release();
                }
            }
        }

        Optional<DatasourceConfig> configOpt = configProvider.getConfig(datasourceId);
        if (configOpt.isEmpty()) {
            PingResult result = new PingResult(false, "Datasource not found in database", DatabaseErrorCode.DATABASE_NOT_FOUND.name());
            recordPingObservation(datasourceId, result);
            return result;
        }

        DatasourceConfig config = configOpt.get();
        return pingDirect(datasourceId, config);
    }

    public PingResult pingDirect(UUID datasourceId, DatasourceConfig config) {
        PingResult result = testConnection(config);
        recordPingObservation(datasourceId, result);
        return result;
    }

    public PingResult testConnection(DatasourceConfig config) {
        if (config == null || config.url() == null) {
            return new PingResult(false, DatabaseErrorCode.INVALID_CONFIGURATION.getDefaultMessage(), DatabaseErrorCode.INVALID_CONFIGURATION.name());
        }
        try {
            DriverManager.setLoginTimeout(3);
            try (Connection conn = DriverManager.getConnection(config.url(), connectionProperties(config))) {
                if (conn.isValid(3)) {
                    return new PingResult(true, "", null);
                }
                return new PingResult(false, "Connection test failed (isValid returned false)", DatabaseErrorCode.CONNECTION_FAILED.name());
            }
        } catch (Exception ex) {
            log.warn("Direct connection test failed for datasource id={}: {}", config.id(), ex.getMessage());
            DatabaseErrorClassifier.Result classified = DatabaseErrorClassifier.classify(ex);
            return new PingResult(false, classified.safeMessage(), classified.code().name());
        }
    }

    private Properties connectionProperties(DatasourceConfig config) {
        Properties props = new Properties();
        DialectRegistry dialects = dataSourceRegistry.getDialectRegistry() != null
                ? dataSourceRegistry.getDialectRegistry() : DialectRegistry.getDefault();
        if (config.type() != null && dialects.supports(config.type())) {
            props.putAll(dialects.getDialect(config.type()).defaultDataSourceProperties());
        }
        if (config.pool() != null && config.pool().dataSourceProperties() != null) {
            props.putAll(config.pool().dataSourceProperties());
        }
        if (config.properties() != null) {
            props.putAll(config.properties());
        }
        if (config.username() != null) props.put("user", config.username());
        if (config.password() != null) props.put("password", config.password());
        return props;
    }

    public Map<UUID, PingResult> bulkPing(Collection<UUID> ids, long timeoutSeconds) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<UUID, CompletableFuture<PingResult>> futures = new LinkedHashMap<>();
        for (UUID id : ids) {
            futures.put(id, CompletableFuture.supplyAsync(() -> ping(id), pingExecutor));
        }

        Map<UUID, PingResult> results = new LinkedHashMap<>();
        long deadlineMillis = TimeUnit.SECONDS.toMillis(timeoutSeconds > 0 ? timeoutSeconds : 30);
        long startTime = System.currentTimeMillis();

        for (Map.Entry<UUID, CompletableFuture<PingResult>> entry : futures.entrySet()) {
            UUID id = entry.getKey();
            CompletableFuture<PingResult> future = entry.getValue();
            long remaining = Math.max(1, deadlineMillis - (System.currentTimeMillis() - startTime));
            try {
                PingResult res = future.get(remaining, TimeUnit.MILLISECONDS);
                results.put(id, res);
            } catch (TimeoutException te) {
                future.cancel(true);
                PingResult timeoutRes = new PingResult(false, "Ping timed out", DatabaseErrorCode.CONNECTION_FAILED.name());
                results.put(id, timeoutRes);
                recordPingObservation(id, timeoutRes);
            } catch (Exception e) {
                Throwable cause = e.getCause() != null ? e.getCause() : e;
                DatabaseErrorClassifier.Result classified = DatabaseErrorClassifier.classify(cause);
                PingResult errRes = new PingResult(false, classified.safeMessage(), classified.code().name());
                results.put(id, errRes);
                recordPingObservation(id, errRes);
            }
        }

        return results;
    }

    public void recordPingObservation(UUID id, PingResult result) {
        if (id != null && result != null) {
            lastPingCache.put(id, new PingObservation(
                    result.reachable(),
                    result.reason(),
                    result.errorCode(),
                    Instant.now()
            ));
        }
    }

    public void invalidateObservation(UUID id) {
        if (id != null) {
            lastPingCache.invalidate(id);
        }
    }

    @PreDestroy
    public void shutdown() {
        pingExecutor.shutdown();
        try {
            if (!pingExecutor.awaitTermination(2, TimeUnit.SECONDS)) {
                pingExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            pingExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}

