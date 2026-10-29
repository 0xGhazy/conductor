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

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import com.zaxxer.hikari.HikariDataSource;

/**
 * A ref-counted hold on a pool. Always use it with try-with-resources; the pool cannot be closed while it is open.
 */
public final class DataSourceLease implements AutoCloseable {

    private final PoolHandle handle;
    private final AtomicBoolean closed = new AtomicBoolean(false);

    public DataSourceLease(PoolHandle handle) {
        this(acquireOrThrow(handle), true);
    }

    private DataSourceLease(PoolHandle handle, boolean acquired) {
        this.handle = handle;
    }

    static DataSourceLease adopt(PoolHandle acquiredHandle) {
        return new DataSourceLease(acquiredHandle, true);
    }

    private static PoolHandle acquireOrThrow(PoolHandle handle) {
        if (handle == null) {
            throw new IllegalArgumentException("PoolHandle cannot be null");
        }
        if (!handle.tryAcquire()) {
            throw new IllegalStateException("Pool '" + handle.getName() + "' has been retired");
        }
        return handle;
    }

    public NamedParameterJdbcTemplate template() {
        ensureNotClosed();
        return handle.getTemplate();
    }

    public HikariDataSource dataSource() {
        ensureNotClosed();
        return handle.getPool();
    }

    public UUID datasourceId() {
        return handle.getDatasourceId();
    }

    public long version() {
        return handle.getVersion();
    }

    public String name() {
        return handle.getName();
    }

    public PoolHandle handle() {
        return handle;
    }

    @Override
    public void close() {
        if (closed.compareAndSet(false, true)) {
            handle.release();
        }
    }

    private void ensureNotClosed() {
        if (closed.get()) {
            throw new IllegalStateException("DataSourceLease has already been closed");
        }
    }
}

