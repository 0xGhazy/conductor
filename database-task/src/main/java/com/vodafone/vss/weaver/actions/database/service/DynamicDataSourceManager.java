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
package com.vodafone.vss.weaver.actions.database.service;

import java.util.UUID;
import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.registry.DataSourceLease;
import com.vodafone.vss.weaver.actions.database.registry.DataSourceRegistry;
import com.vodafone.vss.weaver.actions.database.registry.DatasourceConfigProvider;
import com.vodafone.vss.weaver.actions.database.registry.DatasourceHealthService;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.DatasourceStatus;
import com.vodafone.vss.weaver.common.database.PingResult;

/**
 * Facade over the registry, config provider, and health service.
 */
@Component
public class DynamicDataSourceManager {

    private static final Logger log = LoggerFactory.getLogger(DynamicDataSourceManager.class);

    private final DataSourceRegistry dataSourceRegistry;
    private final DatasourceConfigProvider configProvider;
    private final DatasourceHealthService healthService;

    @Autowired
    public DynamicDataSourceManager(
            DataSourceRegistry dataSourceRegistry,
            DatasourceConfigProvider configProvider,
            DatasourceHealthService healthService
    ) {
        this.dataSourceRegistry = dataSourceRegistry;
        this.configProvider = configProvider;
        this.healthService = healthService;
    }

    public DataSourceLease lease(UUID datasourceId) {
        return dataSourceRegistry.lease(datasourceId);
    }

    public DatasourceConfig getDatasourceConfig(UUID datasourceId) {
        return configProvider.getConfig(datasourceId).orElse(null);
    }

    public void putDatasourceConfig(DatasourceConfig config) {
        configProvider.putConfig(config);
    }

    public DatasourceStatus getStatus(UUID datasourceId) {
        if (datasourceId == null || healthService == null) return null;
        DatasourceStatus status = healthService.getStatus(datasourceId);
        if (status != null && DatabaseErrorCode.DATABASE_NOT_FOUND.name().equals(status.errorCode())) {
            return null;
        }
        return status;
    }

    public PingResult ping(UUID datasourceId) {
        if (healthService != null) {
            return healthService.ping(datasourceId);
        }
        return new PingResult(false, "Health service unavailable", DatabaseErrorCode.UNKNOWN.name());
    }

    public PingResult testConnection(DatasourceConfig config) {
        if (healthService != null) {
            return healthService.testConnection(config);
        }
        return new PingResult(false, "Health service unavailable", DatabaseErrorCode.UNKNOWN.name());
    }

    public void recordObservation(UUID datasourceId, PingResult result) {
        if (healthService != null) {
            healthService.recordPingObservation(datasourceId, result);
        }
    }

    public DatasourceHealthService getHealthService() {
        return healthService;
    }

    public void invalidate(UUID datasourceId) {
        if (datasourceId != null) {
            dataSourceRegistry.evict(datasourceId);
            configProvider.invalidate(datasourceId);
            if (healthService != null) {
                healthService.invalidateObservation(datasourceId);
            }
        }
    }

    public void onDatasourceChanged(UUID datasourceId, Long version) {
        if (datasourceId != null) {
            configProvider.invalidate(datasourceId);
            dataSourceRegistry.onDatasourceChanged(datasourceId, version);
            if (healthService != null) {
                healthService.invalidateObservation(datasourceId);
            }
        }
    }

    public long getActivePoolCount() {
        return dataSourceRegistry.getActivePoolCount();
    }

    public DataSourceRegistry getDataSourceRegistry() {
        return dataSourceRegistry;
    }

    public DatasourceConfigProvider getConfigProvider() {
        return configProvider;
    }

    @PreDestroy
    public void closeAll() {
        dataSourceRegistry.closeAll();
    }
}

