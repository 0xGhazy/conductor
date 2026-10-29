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
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.actions.database.dialect.DatabaseDialect;
import com.vodafone.vss.weaver.actions.database.dialect.DialectRegistry;
import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.exception.DatasourceUnavailableException;
import com.vodafone.vss.weaver.actions.database.util.DatabaseErrorClassifier;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.PoolSettings;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.metrics.micrometer.MicrometerMetricsTrackerFactory;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

@Component
public class DataSourceRegistry {

    private static final Logger log = LoggerFactory.getLogger(DataSourceRegistry.class);

    private static final int MAX_LEASE_ATTEMPTS = 3;
    private static final long CREATION_WAIT_MARGIN_MS = 5_000L;

    private final DatasourceConfigProvider configProvider;
    private final DialectRegistry dialectRegistry;
    private final MeterRegistry meterRegistry;

    private final int maxCachedPools;
    private final long idleTimeoutMs;
    private final int maxTotalConnections;
    private final long gracePeriodMs;

    private final ConcurrentHashMap<UUID, PoolHandle> activePools = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, CompletableFuture<PoolHandle>> creatingInFlight = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, FailedState> failedStates = new ConcurrentHashMap<>();
    private final List<PoolHandle> retiredPools = new CopyOnWriteArrayList<>();

    private final Object capacityLock = new Object();
    private int reservedConnections = 0;
    private int reservedPools = 0;

    private final AtomicBoolean running = new AtomicBoolean(true);
    private final ScheduledExecutorService sweeper;
    private final ThreadPoolExecutor creationExecutor;

    @Autowired
    public DataSourceRegistry(
            DatasourceConfigProvider configProvider,
            DialectRegistry dialectRegistry,
            @Autowired(required = false) MeterRegistry meterRegistry,
            @Value("${conductor.datasource.pool.max-cached-pools:100}") int maxCachedPools,
            @Value("${conductor.datasource.pool.idle-timeout-minutes:30}") int idleTimeoutMinutes,
            @Value("${conductor.datasource.pool.max-total-connections:200}") int maxTotalConnections,
            @Value("${conductor.datasource.pool.grace-period-seconds:60}") int gracePeriodSeconds
    ) {
        this.configProvider = configProvider;
        this.dialectRegistry = dialectRegistry != null ? dialectRegistry : DialectRegistry.getDefault();
        this.meterRegistry = meterRegistry;
        this.maxCachedPools = maxCachedPools;
        this.idleTimeoutMs = TimeUnit.MINUTES.toMillis(idleTimeoutMinutes);
        this.maxTotalConnections = maxTotalConnections;
        this.gracePeriodMs = TimeUnit.SECONDS.toMillis(gracePeriodSeconds);

        this.sweeper = Executors.newSingleThreadScheduledExecutor(daemonThreads("weaver-pool-sweeper"));
        this.sweeper.scheduleWithFixedDelay(this::sweepPools, 30, 30, TimeUnit.SECONDS);

        this.creationExecutor = new ThreadPoolExecutor(
                8, 8, 60L, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(256),
                daemonThreads("weaver-pool-creator"),
                new ThreadPoolExecutor.AbortPolicy()
        );
        this.creationExecutor.allowCoreThreadTimeOut(true);

        registerMetrics();
        log.info("DataSourceRegistry initialized (maxPools={}, maxTotalConnections={}, idleTimeout={}m)",
                maxCachedPools, maxTotalConnections, idleTimeoutMinutes);
    }

    public DataSourceLease lease(UUID datasourceId) {
        if (!running.get()) {
            throw new IllegalStateException("DataSourceRegistry is shutting down; rejecting new leases");
        }
        if (datasourceId == null) {
            throw new IllegalStateException("Datasource ID cannot be null");
        }
        throwIfInBackoff(datasourceId);

        for (int attempt = 0; attempt < MAX_LEASE_ATTEMPTS; attempt++) {
            PoolHandle handle = activePools.get(datasourceId);
            if (handle != null && handle.isUsable()) {
                handle = refreshIfStale(datasourceId, handle);
            } else {
                DatasourceConfig config = configProvider.getConfig(datasourceId).orElseThrow(() ->
                        new IllegalStateException("Unregistered datasource with ID: " + datasourceId));
                handle = getOrCreatePool(config);
            }
            if (handle.tryAcquire()) {
                return DataSourceLease.adopt(handle);
            }
            log.debug("Pool for datasource {} was retired while acquiring a lease; retrying ({}/{})",
                    datasourceId, attempt + 1, MAX_LEASE_ATTEMPTS);
        }
        throw new DatasourceUnavailableException(
                "Could not acquire a lease: pool was replaced concurrently for datasource " + datasourceId,
                DatabaseErrorCode.CONNECTION_FAILED,
                true
        );
    }

    public PoolHandle registerOrValidate(DatasourceConfig config) {
        if (config == null || config.id() == null) {
            throw new IllegalArgumentException("DatasourceConfig and ID cannot be null");
        }
        UUID id = config.id();
        log.info("Registering datasource '{}' (id={}, version={}) in registry", config.name(), id, config.version());

        int reserved = reserveCapacity(config);
        PoolHandle installed;
        try {
            PoolHandle handle = buildAndValidatePool(config);
            installed = installPool(handle, null, true);
            if (installed == null) {
                throw new IllegalStateException("Registry is shutting down");
            }
        } finally {
            releaseCapacity(reserved);
        }

        configProvider.putConfig(config);
        configProvider.recordVersionCheck(id);
        failedStates.remove(id);
        log.info("Datasource '{}' (id={}, version={}) registered and active", config.name(), id, installed.getVersion());
        return installed;
    }

    public void evict(UUID datasourceId) {
        if (datasourceId == null) return;
        log.debug("Evicting datasource pool for ID: {}", datasourceId);
        CompletableFuture<PoolHandle> inFlight = creatingInFlight.remove(datasourceId);
        if (inFlight != null) {
            inFlight.completeExceptionally(new IllegalStateException("Datasource evicted: " + datasourceId));
        }
        PoolHandle handle = activePools.remove(datasourceId);
        if (handle != null) {
            retire(handle);
        }
        configProvider.invalidate(datasourceId);
        failedStates.remove(datasourceId);
    }

    public void onDatasourceChanged(UUID datasourceId, Long version) {
        if (datasourceId == null) return;
        PoolHandle existing = activePools.get(datasourceId);
        if (existing != null && (version == null || existing.getVersion() < version)) {
            log.info("Evicting and retiring outdated pool for datasource {} (existing version={}, new version={})",
                    datasourceId, existing.getVersion(), version);
            evict(datasourceId);
        } else {
            CompletableFuture<PoolHandle> inFlight = creatingInFlight.remove(datasourceId);
            if (inFlight != null) {
                inFlight.completeExceptionally(new IllegalStateException("Datasource changed: " + datasourceId));
            }
            failedStates.remove(datasourceId);
        }
    }

    public Optional<PoolHandle> getActivePool(UUID datasourceId) {
        if (datasourceId == null) return Optional.empty();
        return Optional.ofNullable(activePools.get(datasourceId));
    }

    public DialectRegistry getDialectRegistry() {
        return dialectRegistry;
    }

    public boolean isFailedInBackoff(UUID datasourceId) {
        if (datasourceId == null) return false;
        FailedState state = failedStates.get(datasourceId);
        if (state != null) {
            if (state.isActive(Instant.now())) {
                return true;
            }
            failedStates.remove(datasourceId, state);
        }
        return false;
    }

    public Optional<FailedState> getFailedState(UUID datasourceId) {
        if (datasourceId == null) return Optional.empty();
        FailedState state = failedStates.get(datasourceId);
        if (state != null && state.isActive(Instant.now())) {
            return Optional.of(state);
        }
        return Optional.empty();
    }

    public long getActivePoolCount() {
        return activePools.size();
    }

    public long getInUsePoolCount() {
        return activePools.values().stream().filter(h -> h.inUseCount() > 0).count();
    }

    public int getAllocatedConnectionBudget() {
        int active = activePools.values().stream().mapToInt(PoolHandle::getMaxPoolSize).sum();
        int draining = retiredPools.stream().filter(h -> !h.isClosed()).mapToInt(PoolHandle::getMaxPoolSize).sum();
        return active + draining;
    }

    public long getFailedPoolCount() {
        Instant now = Instant.now();
        return failedStates.values().stream().filter(s -> s.isActive(now)).count();
    }

    private PoolHandle refreshIfStale(UUID datasourceId, PoolHandle existing) {
        if (!configProvider.isVersionCheckDue(datasourceId)) {
            return existing;
        }
        configProvider.recordVersionCheck(datasourceId);
        Optional<Long> dbVersion = configProvider.getVersionFromDb(datasourceId);
        if (dbVersion.isEmpty()) {
            log.info("Datasource {} no longer exists in DB on lease check. Evicting pool.", datasourceId);
            evict(datasourceId);
            throw new IllegalStateException("Datasource no longer exists: " + datasourceId);
        }
        if (dbVersion.get() <= existing.getVersion()) {
            return existing;
        }
        log.info("Datasource {} version bump detected in DB (pool={}, DB={}). Replacing pool.",
                datasourceId, existing.getVersion(), dbVersion.get());
        DatasourceConfig fresh = configProvider.getFreshConfig(datasourceId)
                .orElseThrow(() -> new IllegalStateException("Datasource no longer exists: " + datasourceId));
        return getOrCreatePool(fresh);
    }

    private PoolHandle getOrCreatePool(DatasourceConfig config) {
        UUID id = config.id();
        throwIfInBackoff(id);

        CompletableFuture<PoolHandle> mine = new CompletableFuture<>();
        CompletableFuture<PoolHandle> future = creatingInFlight.putIfAbsent(id, mine);
        if (future == null) {
            future = mine;
            submitCreation(config, mine);
        }

        PoolSettings pool = config.pool() != null ? config.pool() : PoolSettings.defaultSettings();
        long connectionTimeoutMs = pool.connectionTimeoutMs() != null ? pool.connectionTimeoutMs() : PoolSettings.DEFAULT_CONNECTION_TIMEOUT_MS;
        long validationTimeoutMs = pool.validationTimeoutMs() != null ? pool.validationTimeoutMs() : PoolSettings.DEFAULT_VALIDATION_TIMEOUT_MS;
        long waitMs = connectionTimeoutMs + validationTimeoutMs + CREATION_WAIT_MARGIN_MS;

        try {
            return future.get(waitMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException te) {
            if (creatingInFlight.remove(id, future)) {
                recordFailure(id, te);
            }
            throw new DatasourceUnavailableException(
                    "Connection pool initialization timed out for datasource: " + id,
                    DatabaseErrorCode.TIMEOUT,
                    true,
                    te
            );
        } catch (ExecutionException ee) {
            Throwable cause = ee.getCause() != null ? ee.getCause() : ee;
            if (cause instanceof IllegalStateException unavailable) {
                throw unavailable;
            }
            DatabaseErrorClassifier.Result classified = DatabaseErrorClassifier.classify(cause);
            throw new DatasourceUnavailableException(
                    "Failed to initialize pool for datasource " + id + ": " + classified.safeMessage(),
                    classified.code(),
                    classified.retryable(),
                    cause
            );
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new DatasourceUnavailableException(
                    "Pool initialization interrupted for datasource: " + id,
                    DatabaseErrorCode.CONNECTION_FAILED,
                    true,
                    ie
            );
        }
    }

    private void submitCreation(DatasourceConfig config, CompletableFuture<PoolHandle> token) {
        UUID id = config.id();
        try {
            creationExecutor.execute(() -> {
                try {
                    token.complete(createAndInstall(config, token));
                } catch (Throwable t) {
                    token.completeExceptionally(t);
                } finally {
                    creatingInFlight.remove(id, token);
                }
            });
        } catch (RejectedExecutionException e) {
            creatingInFlight.remove(id, token);
            token.completeExceptionally(new DatasourceUnavailableException(
                    "Too many connection pools are being created; try again shortly",
                    DatabaseErrorCode.CONNECTION_FAILED,
                    true,
                    e
            ));
        }
    }

    private PoolHandle createAndInstall(DatasourceConfig config, CompletableFuture<PoolHandle> token) throws Exception {
        UUID id = config.id();

        Optional<Long> dbVersion = configProvider.getVersionFromDb(id);
        if (dbVersion.isEmpty()) {
            configProvider.invalidate(id);
            throw new IllegalStateException("Datasource has been deleted from database: " + id);
        }
        DatasourceConfig effective = config;
        if (dbVersion.get() > config.version()) {
            log.info("Datasource {} version updated in DB before pool creation (config={}, DB={})",
                    id, config.version(), dbVersion.get());
            effective = configProvider.getFreshConfig(id).orElse(config);
        }

        int reserved = reserveCapacity(effective);
        try {
            PoolHandle handle;
            try {
                handle = buildAndValidatePool(effective);
            } catch (DatasourceUnavailableException e) {
                recordFailure(id, e);
                throw e;
            }

            if (!configProvider.existsInDb(id)) {
                handle.close();
                throw new IllegalStateException("Datasource was deleted during pool build: " + id);
            }

            PoolHandle installed = installPool(handle, token, false);
            if (installed == null) {
                throw new IllegalStateException("Pool creation was abandoned: " + id);
            }
            failedStates.remove(id);
            configProvider.recordVersionCheck(id);
            return installed;
        } finally {
            releaseCapacity(reserved);
        }
    }

    private PoolHandle installPool(PoolHandle candidate, CompletableFuture<PoolHandle> token, boolean replaceSameVersion) {
        UUID id = candidate.getDatasourceId();
        PoolHandle[] displaced = new PoolHandle[1];
        PoolHandle[] kept = new PoolHandle[1];
        boolean[] abandoned = new boolean[1];

        activePools.compute(id, (key, current) -> {
            if (!running.get() || (token != null && creatingInFlight.get(key) != token)) {
                abandoned[0] = true;
                return current;
            }
            if (current != null && current.isUsable()
                    && (current.getVersion() > candidate.getVersion()
                    || (current.getVersion() == candidate.getVersion() && !replaceSameVersion))) {
                kept[0] = current;
                return current;
            }
            displaced[0] = current;
            return candidate;
        });

        if (abandoned[0]) {
            log.info("Discarding pool for datasource {} (version={}): creation was abandoned", id, candidate.getVersion());
            candidate.close();
            return null;
        }
        if (kept[0] != null) {
            log.info("Discarding pool for datasource {} (version={}): version {} is already active",
                    id, candidate.getVersion(), kept[0].getVersion());
            candidate.close();
            return kept[0];
        }
        if (displaced[0] != null) {
            retire(displaced[0]);
        }
        return candidate;
    }

    private PoolHandle buildAndValidatePool(DatasourceConfig config) {
        HikariConfig hc = createHikariConfig(config);
        HikariDataSource pool;
        try {
            pool = newPool(hc);
        } catch (Exception e) {
            throw poolInitializationFailure(config, e);
        }

        long validationTimeoutMs = (config.pool() != null && config.pool().validationTimeoutMs() != null)
                ? config.pool().validationTimeoutMs() : PoolSettings.DEFAULT_VALIDATION_TIMEOUT_MS;
        int timeoutSec = (int) Math.max(1, validationTimeoutMs / 1000);

        try {
            try (Connection conn = pool.getConnection()) {
                if (!conn.isValid(timeoutSec)) {
                    throw new IllegalStateException("Datasource connection test failed (isValid returned false)");
                }
            }
        } catch (Throwable t) {
            log.warn("Validation failed for pool '{}' (id={}). Closing pool immediately.", config.name(), config.id());
            try {
                pool.close();
            } catch (Exception closeEx) {
                log.debug("Error while closing failed pool: {}", closeEx.getMessage());
            }
            throw poolInitializationFailure(config, t);
        }

        return new PoolHandle(config.id(), config.name(), config.version(), hc.getMaximumPoolSize(), pool);
    }

    private static DatasourceUnavailableException poolInitializationFailure(DatasourceConfig config, Throwable cause) {
        DatabaseErrorClassifier.Result classified = DatabaseErrorClassifier.classify(cause);
        return new DatasourceUnavailableException(
                "Failed to initialize pool for datasource " + config.id() + ": " + classified.safeMessage(),
                classified.code(),
                classified.retryable(),
                cause
        );
    }

    protected HikariDataSource newPool(HikariConfig hc) {
        return new HikariDataSource(hc);
    }

    private int reserveCapacity(DatasourceConfig config) {
        int requested = (config.pool() != null && config.pool().maximumPoolSize() != null)
                ? config.pool().maximumPoolSize() : PoolSettings.DEFAULT_MAXIMUM_POOL_SIZE;
        UUID id = config.id();

        synchronized (capacityLock) {
            PoolHandle existing = activePools.get(id);
            boolean replacing = existing != null && existing.isUsable();

            if (!replacing) {
                while (activePools.size() + reservedPools >= maxCachedPools) {
                    if (!evictLeastRecentlyUsedIdlePool(id)) {
                        throw new DatasourceUnavailableException(
                                "Capacity limit reached: all connection pools are currently in use ("
                                        + activePools.size() + "/" + maxCachedPools + ")",
                                DatabaseErrorCode.CONNECTION_FAILED, true);
                    }
                }
            }

            int replacedSize = replacing ? existing.getMaxPoolSize() : 0;
            while (getAllocatedConnectionBudget() + reservedConnections - replacedSize + requested > maxTotalConnections) {
                if (!evictLeastRecentlyUsedIdlePool(id)) {
                    throw new DatasourceUnavailableException(
                            "Global connection budget exceeded (" + (getAllocatedConnectionBudget() + reservedConnections + requested)
                                    + " > " + maxTotalConnections + ") and no idle pools can be evicted.",
                            DatabaseErrorCode.CONNECTION_FAILED, true);
                }
            }

            reservedConnections += requested;
            reservedPools += 1;
            return requested;
        }
    }

    private void releaseCapacity(int reserved) {
        synchronized (capacityLock) {
            reservedConnections -= reserved;
            reservedPools -= 1;
        }
    }

    private boolean evictLeastRecentlyUsedIdlePool(UUID exclude) {
        PoolHandle oldestIdle = activePools.values().stream()
                .filter(h -> h.inUseCount() == 0 && !h.getDatasourceId().equals(exclude))
                .min(Comparator.comparingLong(PoolHandle::getLastUsed))
                .orElse(null);

        if (oldestIdle != null && activePools.remove(oldestIdle.getDatasourceId(), oldestIdle)) {
            log.info("Evicting least recently used idle pool '{}' (id={}, lastUsed={}) to free capacity",
                    oldestIdle.getName(), oldestIdle.getDatasourceId(), oldestIdle.getLastUsed());
            retire(oldestIdle);
            return true;
        }
        return false;
    }

    public HikariConfig createHikariConfig(DatasourceConfig config) {
        HikariConfig hc = new HikariConfig();

        hc.setJdbcUrl(config.url());
        hc.setUsername(config.username());
        hc.setPassword(config.password());
        hc.setPoolName("ds-" + config.id());

        PoolSettings pool = config.pool() != null ? config.pool() : PoolSettings.defaultSettings();
        hc.setMinimumIdle(pool.minimumIdle() != null ? pool.minimumIdle() : PoolSettings.DEFAULT_MINIMUM_IDLE);
        hc.setMaximumPoolSize(pool.maximumPoolSize() != null ? pool.maximumPoolSize() : PoolSettings.DEFAULT_MAXIMUM_POOL_SIZE);
        hc.setIdleTimeout(pool.idleTimeoutMs() != null ? pool.idleTimeoutMs() : PoolSettings.DEFAULT_IDLE_TIMEOUT_MS);
        hc.setMaxLifetime(pool.maxLifetimeMs() != null ? pool.maxLifetimeMs() : PoolSettings.DEFAULT_MAX_LIFETIME_MS);
        hc.setKeepaliveTime(pool.keepaliveTimeMs() != null ? pool.keepaliveTimeMs() : PoolSettings.DEFAULT_KEEPALIVE_TIME_MS);
        hc.setConnectionTimeout(pool.connectionTimeoutMs() != null ? pool.connectionTimeoutMs() : PoolSettings.DEFAULT_CONNECTION_TIMEOUT_MS);
        hc.setValidationTimeout(pool.validationTimeoutMs() != null ? pool.validationTimeoutMs() : PoolSettings.DEFAULT_VALIDATION_TIMEOUT_MS);
        hc.setInitializationFailTimeout(pool.initializationFailTimeoutMs() != null ? pool.initializationFailTimeoutMs() : PoolSettings.DEFAULT_INITIALIZATION_FAIL_TIMEOUT_MS);

        if (pool.leakDetectionThresholdMs() != null && pool.leakDetectionThresholdMs() > 0) {
            hc.setLeakDetectionThreshold(pool.leakDetectionThresholdMs());
        }

        DatabaseType type = config.type();
        if (type != null) {
            DatabaseDialect dialect = dialectRegistry.getDialect(type);
            hc.setDriverClassName(dialect.driverClassName());
            dialect.defaultDataSourceProperties().forEach(hc::addDataSourceProperty);
            if (config.schema() != null && !config.schema().isBlank()) {
                dialect.applySchema(hc, config.schema().trim());
            }
        }

        if (pool.dataSourceProperties() != null) {
            pool.dataSourceProperties().forEach(hc::addDataSourceProperty);
        }
        if (config.properties() != null) {
            config.properties().forEach(hc::addDataSourceProperty);
        }

        if (meterRegistry != null) {
            hc.setMetricsTrackerFactory(new MicrometerMetricsTrackerFactory(meterRegistry));
            if (config.name() != null) {
                hc.addDataSourceProperty("applicationName", config.name());
            }
        }

        return hc;
    }

    private void throwIfInBackoff(UUID datasourceId) {
        FailedState failed = failedStates.get(datasourceId);
        if (failed != null && failed.isActive(Instant.now())) {
            log.warn("Datasource {} is in failure backoff until {}. Reason: {}", datasourceId, failed.until(), failed.reason());
            throw new DatasourceUnavailableException(
                    "Datasource connection failed (backoff active): " + failed.reason(),
                    failed.errorCode(),
                    failed.errorCode().isRetryable()
            );
        }
    }

    private void recordFailure(UUID datasourceId, Throwable t) {
        DatabaseErrorClassifier.Result classified = DatabaseErrorClassifier.classify(t);
        failedStates.compute(datasourceId, (id, prev) -> {
            int consecutive = (prev != null) ? prev.consecutiveFailures() + 1 : 1;
            long backoffSeconds = Math.min(60, 5L * (1L << Math.min(4, consecutive - 1)));
            Instant until = Instant.now().plus(Duration.ofSeconds(backoffSeconds));
            log.warn("Datasource {} failed (attempt {}). Backoff for {}s until {}. Reason: {}",
                    id, consecutive, backoffSeconds, until, classified.safeMessage());
            return new FailedState(until, consecutive, classified.code(), classified.safeMessage());
        });
    }

    private void retire(PoolHandle handle) {
        if (handle == null) return;
        handle.retire();
        if (!handle.isClosed()) {
            retiredPools.add(handle);
        }
    }

    void sweepPools() {
        if (!running.get()) return;
        long now = System.currentTimeMillis();

        for (Map.Entry<UUID, PoolHandle> entry : activePools.entrySet()) {
            PoolHandle handle = entry.getValue();
            if (handle.inUseCount() == 0 && (now - handle.getLastUsed()) > idleTimeoutMs) {
                log.info("Idle timeout reached for pool '{}' (id={}). Sweeping from active pools.",
                        handle.getName(), handle.getDatasourceId());
                if (activePools.remove(entry.getKey(), handle)) {
                    retire(handle);
                }
            }
        }

        retiredPools.removeIf(handle -> {
            if (handle.isClosed()) {
                return true;
            }
            if (handle.inUseCount() <= 0 || (now - handle.getRetiredAt()) > gracePeriodMs) {
                log.info("Closing swept retired pool '{}' (inUse={}, retiredAgo={}ms)",
                        handle.getName(), handle.inUseCount(), (now - handle.getRetiredAt()));
                handle.close();
                return true;
            }
            return false;
        });
    }

    private void registerMetrics() {
        if (meterRegistry == null) return;
        Gauge.builder("weaver.datasource.pools.active", this, DataSourceRegistry::getActivePoolCount)
                .description("Number of currently active datasource connection pools")
                .register(meterRegistry);

        Gauge.builder("weaver.datasource.pools.in-use", this, DataSourceRegistry::getInUsePoolCount)
                .description("Number of connection pools with active leases")
                .register(meterRegistry);

        Gauge.builder("weaver.datasource.pools.failed", this, DataSourceRegistry::getFailedPoolCount)
                .description("Number of datasources currently in failure backoff state")
                .register(meterRegistry);

        Gauge.builder("weaver.datasource.connections.allocated-budget", this, DataSourceRegistry::getAllocatedConnectionBudget)
                .description("Total connection capacity allocated across active and draining pools")
                .register(meterRegistry);
    }

    private static ThreadFactory daemonThreads(String name) {
        return r -> {
            Thread t = new Thread(r, name);
            t.setDaemon(true);
            return t;
        };
    }

    @PreDestroy
    public void closeAll() {
        if (!running.compareAndSet(true, false)) {
            return;
        }
        log.info("DataSourceRegistry shutting down; closing all pools...");

        sweeper.shutdownNow();
        creationExecutor.shutdownNow();
        creatingInFlight.values().forEach(f ->
                f.completeExceptionally(new IllegalStateException("DataSourceRegistry is shutting down")));
        creatingInFlight.clear();

        for (PoolHandle handle : activePools.values()) {
            retire(handle);
        }
        activePools.clear();

        long deadline = System.currentTimeMillis() + 5000L;
        for (PoolHandle handle : retiredPools) {
            while (handle.inUseCount() > 0 && System.currentTimeMillis() < deadline) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            handle.close();
        }
        retiredPools.clear();
        failedStates.clear();
        log.info("DataSourceRegistry shutdown complete; all pools closed.");
    }
}

