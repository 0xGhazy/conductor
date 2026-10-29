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

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import lombok.Getter;

/**
 * A validated Hikari pool plus its lease bookkeeping.
 */
@Getter
public class PoolHandle {

    private static final Logger log = LoggerFactory.getLogger(PoolHandle.class);

    // Far below zero so concurrent increments of backing-off acquirers can never bring it back to 0.
    private static final int CLOSED = Integer.MIN_VALUE / 2;

    private final UUID datasourceId;
    private final String name;
    private final long version;
    private final int maxPoolSize;
    private final HikariDataSource pool;
    private final NamedParameterJdbcTemplate template;
    private final Instant createdAt = Instant.now();

    private final AtomicInteger inUse = new AtomicInteger(0);
    private final AtomicBoolean retired = new AtomicBoolean(false);
    private final AtomicBoolean closed = new AtomicBoolean(false);

    private volatile long lastUsed = System.currentTimeMillis();
    private volatile long retiredAt = 0L;

    public PoolHandle(UUID datasourceId, String name, long version, int maxPoolSize, HikariDataSource pool) {
        this.datasourceId = datasourceId;
        this.name = name != null ? name : "unnamed";
        this.version = version;
        this.maxPoolSize = maxPoolSize;
        this.pool = pool;
        this.template = new NamedParameterJdbcTemplate(pool);
    }

    public void markUsed() {
        this.lastUsed = System.currentTimeMillis();
    }

    public int inUseCount() {
        return Math.max(inUse.get(), 0);
    }

    /**
     * Registers a lease on this pool. Returns false when the pool was retired or closed.
     */
    public boolean tryAcquire() {
        int count = inUse.incrementAndGet();
        if (count <= 0 || retired.get() || closed.get()) {
            release();
            return false;
        }
        markUsed();
        return true;
    }

    /**
     * Releases a lease taken with {@link #tryAcquire()}; closes the pool when it is the last lease on a retired pool.
     */
    public int release() {
        markUsed();
        int remaining = inUse.decrementAndGet();
        if (remaining == 0 && retired.get()) {
            closeIfUnused();
        }
        return Math.max(remaining, 0);
    }

    private void closeIfUnused() {
        if (inUse.compareAndSet(0, CLOSED)) {
            close();
        }
    }

    void incrementInUse() {
        inUse.incrementAndGet();
        markUsed();
    }

    public boolean isUsable() {
        return !retired.get() && !closed.get();
    }

    public boolean isRetired() {
        return retired.get();
    }

    public boolean isClosed() {
        return closed.get();
    }

    /**
     * Stops handing out this pool. Closes it right away when no lease holds it.
     */
    public void retire() {
        if (retired.compareAndSet(false, true)) {
            this.retiredAt = System.currentTimeMillis();
            log.info("Retiring Hikari pool '{}' (datasourceId={}, version={})", name, datasourceId, version);
            try {
                HikariPoolMXBean mxBean = pool.getHikariPoolMXBean();
                if (mxBean != null) {
                    mxBean.softEvictConnections();
                }
            } catch (Exception e) {
                log.debug("Soft evict connections for pool '{}' skipped: {}", name, e.getMessage());
            }
        }
        closeIfUnused();
    }

    public void close() {
        retired.set(true);
        if (closed.compareAndSet(false, true)) {
            log.info("Closing Hikari pool '{}' (datasourceId={}, version={})", name, datasourceId, version);
            try {
                pool.close();
            } catch (Exception e) {
                log.warn("Error closing Hikari pool '{}': {}", name, e.getMessage(), e);
            }
        }
    }
}

