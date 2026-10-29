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

import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.event.DatasourceChangedEvent;
import com.vodafone.vss.weaver.actions.database.registry.DataSourceLease;
import com.vodafone.vss.weaver.actions.database.util.PasswordEncryptionUtil;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.database.*;
import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.exceptions.BusinessExceptionBuilder;
import com.vodafone.vss.weaver.common.response.PaginatedResult;
import com.vodafone.vss.weaver.dao.DatasourceDAO;
import com.vodafone.vss.weaver.dao.QueryDAO;

@Service
public class DatasourceService {

    private static final Logger log = LoggerFactory.getLogger(DatasourceService.class);

    private final QueryDAO queryDAO;
    private final DatasourceDAO datasourceDAO;
    private final DynamicDataSourceManager dynamicDataSourceManager;
    private final ApplicationEventPublisher eventPublisher;

    @Autowired(required = false)
    private AuditSecurityHelper auditSecurityHelper;

    @Value("${datasource.connection.strict-validation:false}")
    private boolean strictValidation;

    @Autowired
    public DatasourceService(
            QueryDAO queryDAO,
            DatasourceDAO datasourceDAO,
            DynamicDataSourceManager dynamicDataSourceManager,
            @Autowired(required = false) ApplicationEventPublisher eventPublisher
    ) {
        this.queryDAO = queryDAO;
        this.datasourceDAO = datasourceDAO;
        this.dynamicDataSourceManager = dynamicDataSourceManager;
        this.eventPublisher = eventPublisher != null ? eventPublisher : event -> {};
    }

    public Boolean existsById(UUID id) {
        if (id == null) {
            return false;
        }
        return datasourceDAO.existsById(id);
    }

    public Optional<DatasourceModel> findById(@NotNull UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        return datasourceDAO.findById(id);
    }

    public List<DatasourceModel> findAll() {
        return datasourceDAO.findAll(0, 1000, null, true);
    }

    public DatasourceStatus getStatus(@NotNull UUID id) {
        if (!existsById(id)) {
            throw new NoSuchElementException("Datasource not found with ID: " + id);
        }
        return dynamicDataSourceManager.getStatus(id);
    }

    public DataSourceLease lease(@NotNull UUID id) {
        return dynamicDataSourceManager.lease(id);
    }

    public void delete(@NotNull UUID id) {
        DatasourceModel datasource = datasourceDAO.findById(id).orElse(null);
        if (datasource == null) {
            throw new NoSuchElementException("Datasource not found with ID: " + id);
        }

        long relatedQueries = queryDAO.countByDatasourceId(id);
        if (relatedQueries > 0) {
            String message = String.format("[%s] related queries found for Datasource with ID: %s Delete them first",
                    relatedQueries, id);
            throw new IllegalStateException(message);
        }

        datasourceDAO.deleteById(id);
        eventPublisher.publishEvent(DatasourceChangedEvent.deleted(id, datasource.getVersion()));
        log.info("Datasource {} deleted from Database; change event published for eviction.", id);
    }

    public Boolean existsByNameIgnoreCase(String name) {
        return datasourceDAO.existsByNameIgnoreCase(name);
    }

    public List<DatasourceModel> findAllByIds(@NotNull @NotEmpty Set<UUID> ids) {
        List<DatasourceModel> list = new ArrayList<>();
        for (UUID id : ids) {
            datasourceDAO.findById(id).ifPresent(ds -> {
                dynamicDataSourceManager.putDatasourceConfig(toResolvedConfig(ds));
                list.add(ds);
            });
        }
        return list;
    }

    public PingResult isReachableDatasource(@NotNull UUID id) {
        return dynamicDataSourceManager.ping(id);
    }

    public ResponseEntity<AppResponse> createDatabase(@NotNull DatasourceModel payload) {
        String normalizedName = payload.getName().trim();
        DatabaseType databaseType = payload.getType();
        log.info("Start defining new datasource instance [{}] of engine type {}", normalizedName, databaseType);

        if (payload.getConnection() == null || payload.getConnection().getPassword() == null || payload.getConnection().getPassword().isBlank()) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Datasource creation failed")
                            .reason("Database password is required")
                            .code("MISSING_PASSWORD")
                            .withDetail("field", "connection.password")
                            .withDetail("error", "Database password is required")
                            .retryable(false)
                            .success(false)
                            .status(HttpStatus.BAD_REQUEST)
                            .build());
        }

        if (existsByNameIgnoreCase(normalizedName)) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Datasource creation failed")
                            .reason("Datasource with the same name already exists")
                            .code("DUPLICATE_NAME")
                            .status(HttpStatus.CONFLICT)
                            .retryable(false)
                            .success(false)
                            .build());
        }

        JdbcConnectionDetails conn = withPoolDefaults(payload.getConnection());
        String rawPassword = conn.getPassword();
        String encryptedPassword = PasswordEncryptionUtil.encrypt(rawPassword);
        conn.setPassword(encryptedPassword);

        String currentUserId = getCurrentUserId();

        DatasourceModel datasource = DatasourceModel.builder()
                .name(normalizedName)
                .type(databaseType)
                .connection(conn)
                .createdBy(currentUserId)
                .updatedBy(currentUserId)
                .build();

        // Probe before persisting
        PingResult probe = dynamicDataSourceManager.testConnection(toResolvedConfig(datasource));
        if (probe != null && !probe.reachable()) {
            log.warn("Connection test failed for new datasource [{}]: {}", normalizedName, probe.errorCode());
            if (strictValidation) {
                handleConnectionFailure(probe, "creation");
            }
        }

        DatasourceModel saved = datasourceDAO.create(datasource);
        UUID datasourceId = saved.getId();
        eventPublisher.publishEvent(DatasourceChangedEvent.changed(saved.getId(), saved.getVersion()));
        log.info("Datasource created in database successfully with id {}", datasourceId);

        DatasourceStatus status = recordProbe(datasourceId, probe);

        DatasourceModel responseData = copyForResponse(saved);
        responseData.setStatus(status);

        AppResponse response = AppResponse.builder()
                .message("Datasource created successfully")
                .data(responseData)
                .status(HttpStatus.CREATED)
                .retryable(false)
                .success(true)
                .build();

        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(datasourceId)
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    public ResponseEntity<AppResponse> updateRest(@NotNull UUID id, @NotNull DatasourceModel payload) {
        String normalizedName = payload.getName().trim();
        DatabaseType databaseType = payload.getType();
        log.debug("Start updating database instance of id {} engine type {} ", normalizedName, databaseType);

        DatasourceModel current = datasourceDAO.findById(id).orElseThrow(() -> datasourceNotFound(id));
        Long expectedVersion = current.getVersion();

        JdbcConnectionDetails newConnection = withPoolDefaults(payload.getConnection());
        String rawPassword = payload.getConnection() != null ? payload.getConnection().getPassword() : null;
        if (isPasswordBlankOrMasked(rawPassword)) {
            newConnection.setPassword(current.getConnection() != null ? current.getConnection().getPassword() : null);
        } else {
            newConnection.setPassword(PasswordEncryptionUtil.encrypt(rawPassword));
        }

        DatasourceModel candidate = DatasourceModel.builder()
                .id(id)
                .name(normalizedName)
                .type(databaseType)
                .version(expectedVersion)
                .connection(newConnection)
                .build();

        PingResult probe = dynamicDataSourceManager.testConnection(toResolvedConfig(candidate));
        if (probe != null && !probe.reachable()) {
            log.warn("Connection test failed for datasource {} update: {}", id, probe.errorCode());
            if (strictValidation) {
                handleConnectionFailure(probe, "update");
            }
        }

        String currentUserId = getCurrentUserId();
        candidate.setUpdatedBy(currentUserId);

        DatasourceModel updated = datasourceDAO.update(candidate);
        eventPublisher.publishEvent(DatasourceChangedEvent.changed(updated.getId(), updated.getVersion()));

        DatasourceStatus status = recordProbe(id, probe);
        DatasourceModel responseData = copyForResponse(updated);
        responseData.setStatus(status);

        AppResponse response = AppResponse.builder()
                .message("Datasource updated successfully")
                .data(responseData)
                .status(HttpStatus.OK)
                .retryable(true)
                .success(true)
                .build();

        return new ResponseEntity<>(response, response.getStatus());
    }

    public ResponseEntity<AppResponse> findByIdRest(@NotNull UUID id) {
        log.debug("Fetching a datasource with id {}", id);

        DatasourceModel datasource = findById(id).orElseThrow(() -> {
            log.error("Datasource with id {} not found in database", id);
            return ExceptionUtils.throwNotFound("Datasource not found");
        });

        DatasourceModel responseData = copyForResponse(datasource);
        responseData.setStatus(statusOf(id));

        AppResponse response = AppResponse.builder()
                .message("Datasource fetched successfully")
                .data(responseData)
                .status(HttpStatus.OK)
                .retryable(false)
                .success(true)
                .build();

        return new ResponseEntity<>(response, response.getStatus());
    }

    public ResponseEntity<AppResponse> findAllPaginatedRest(@NotNull Pageable pageable, String search) {
        String normalizedSearch = normalizeSearch(search);
        int offset = (int) pageable.getOffset();
        int limit = pageable.getPageSize();

        List<DatasourceModel> list = datasourceDAO.findAll(offset, limit, normalizedSearch, false);
        long total = datasourceDAO.count(normalizedSearch);

        List<DatasourceModel> responseList = list.stream().map(ds -> {
            DatasourceModel clean = copyForResponse(ds);
            clean.setStatus(statusOf(ds.getId()));
            return clean;
        }).toList();

        PaginatedResult details = new PaginatedResult(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                total,
                (int) Math.ceil((double) total / pageable.getPageSize()),
                responseList.size()
        );

        AppResponse response = AppResponse.builder()
                .message("Data sources fetched successfully")
                .data(responseList)
                .details(details)
                .status(HttpStatus.OK)
                .retryable(true)
                .success(true)
                .build();

        return new ResponseEntity<>(response, response.getStatus());
    }

    public ResponseEntity<AppResponse> deleteByIdRest(UUID id) {
        log.debug("Deleting datasource with id {}", id);
        try {
            delete(id);
        } catch (NoSuchElementException e) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Failed to delete datasource")
                            .reason("Datasource with id " + id + " not found")
                            .code("DATASOURCE_NOT_FOUND")
                            .retryable(false)
                            .success(false)
                            .status(HttpStatus.NOT_FOUND)
                            .build()
            );
        } catch (IllegalStateException e) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Failed to delete datasource")
                            .reason("Related queries found with datasource id " + id)
                            .code("RELATED_QUERIES_FOUND")
                            .retryable(false)
                            .success(false)
                            .status(HttpStatus.CONFLICT)
                            .build()
            );
        }

        return ResponseEntity.noContent().build();
    }

    public ResponseEntity<AppResponse> bulkPingRest(@NotNull @NotEmpty Set<UUID> requestedIds) {
        log.debug("Fetching bulk datasources for ping with ids {}", requestedIds);

        List<DatasourceModel> existingDataSources = findAllByIds(requestedIds);
        Set<UUID> foundIds = existingDataSources.stream().map(DatasourceModel::getId).collect(Collectors.toSet());
        List<UUID> missingIds = requestedIds.stream().filter(id -> !foundIds.contains(id)).toList();
        if (!missingIds.isEmpty()) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Failed to bulk ping datasources")
                            .reason("Some provided datasources IDs not found")
                            .code("DATASOURCE_NOT_FOUND")
                            .withDetail("missing", missingIds)
                            .retryable(false)
                            .success(false)
                            .status(HttpStatus.NOT_FOUND)
                            .build()
            );
        }

        Map<UUID, DatasourceModel> datasourceMap = existingDataSources.stream()
                .collect(Collectors.toMap(DatasourceModel::getId, Function.identity()));

        Map<UUID, PingResult> pingResults = dynamicDataSourceManager.getHealthService().bulkPing(requestedIds, 30);

        List<DatasourceModel> results = requestedIds.stream().map(id -> {
            DatasourceModel datasource = datasourceMap.get(id);
            PingResult pingResult = pingResults.getOrDefault(id, new PingResult(false, "Ping failed", DatabaseErrorCode.CONNECTION_FAILED.name()));
            DatasourceStatus status = pingResult.reachable()
                    ? DatasourceStatus.active()
                    : DatasourceStatus.inactive("Ping failed", pingResult.reason(), pingResult.errorCode());

            DatasourceModel clean = copyForResponse(datasource);
            clean.setStatus(status);
            return clean;
        }).toList();

        AppResponse response = AppResponse.builder()
                .message("Bulk ping completed successfully")
                .data(results)
                .status(HttpStatus.OK)
                .retryable(true)
                .success(true)
                .build();

        return new ResponseEntity<>(response, response.getStatus());
    }

    private DatasourceStatus statusOf(UUID id) {
        try {
            return getStatus(id);
        } catch (NoSuchElementException e) {
            log.error("Datasource with id {} not found in connection pool", id, e);
            return DatasourceStatus.inactive("Status unavailable", "Datasource is not registered in connection pool", DatabaseErrorCode.UNKNOWN.name());
        }
    }

    private DatasourceStatus recordProbe(UUID id, PingResult probe) {
        if (probe == null) {
            return DatasourceStatus.unknown("No observation recorded", Instant.now());
        }
        dynamicDataSourceManager.recordObservation(id, probe);
        return probe.reachable()
                ? DatasourceStatus.active()
                : DatasourceStatus.inactive("Connection test failed", probe.reason(), probe.errorCode());
    }

    private void handleConnectionFailure(PingResult probe, String action) {
        throw ExceptionUtils.throwBusinessException(
                BusinessExceptionBuilder.builder()
                        .message("Datasource " + action + " failed")
                        .reason("Strict validation: " + probe.reason())
                        .code(probe.errorCode() != null ? probe.errorCode() : "CONNECTION_FAILED")
                        .retryable(false)
                        .success(false)
                        .status(HttpStatus.BAD_REQUEST)
                        .build()
        );
    }

    private DatasourceConfig toResolvedConfig(DatasourceModel model) {
        return dynamicDataSourceManager.getConfigProvider().toResolvedConfig(model);
    }

    private JdbcConnectionDetails withPoolDefaults(JdbcConnectionDetails conn) {
        if (conn == null) {
            return new JdbcConnectionDetails();
        }
        return JdbcConnectionDetails.builder()
                .url(conn.getUrl())
                .username(conn.getUsername())
                .password(conn.getPassword())
                .schema(conn.getSchema() != null ? conn.getSchema() : "")
                .minimumIdle(conn.getMinimumIdle() != null ? conn.getMinimumIdle() : 0)
                .maxPoolSize(conn.getMaxPoolSize() != null ? conn.getMaxPoolSize() : 5)
                .idleTimeout(conn.getIdleTimeout() != null ? conn.getIdleTimeout() : 60000)
                .maxLifetime(conn.getMaxLifetime() != null ? conn.getMaxLifetime() : 1800000L)
                .connectionTimeout(conn.getConnectionTimeout() != null ? conn.getConnectionTimeout() : 10000)
                .properties(conn.getProperties())
                .build();
    }

    private boolean isPasswordBlankOrMasked(String password) {
        return password == null || password.isBlank() || password.startsWith("****");
    }

    private DatasourceModel copyForResponse(DatasourceModel ds) {
        if (ds == null) return null;
        JdbcConnectionDetails cleanConn = null;
        if (ds.getConnection() != null) {
            cleanConn = JdbcConnectionDetails.builder()
                    .url(ds.getConnection().getUrl())
                    .username(ds.getConnection().getUsername())
                    .password(null) // never expose password
                    .schema(ds.getConnection().getSchema())
                    .maxPoolSize(ds.getConnection().getMaxPoolSize())
                    .minimumIdle(ds.getConnection().getMinimumIdle())
                    .idleTimeout(ds.getConnection().getIdleTimeout())
                    .maxLifetime(ds.getConnection().getMaxLifetime())
                    .connectionTimeout(ds.getConnection().getConnectionTimeout())
                    .properties(ds.getConnection().getProperties())
                    .build();
        }
        return DatasourceModel.builder()
                .id(ds.getId())
                .name(ds.getName())
                .version(ds.getVersion())
                .type(ds.getType())
                .connection(cleanConn)
                .createdAt(ds.getCreatedAt())
                .updatedAt(ds.getUpdatedAt())
                .createdBy(ds.getCreatedBy())
                .updatedBy(ds.getUpdatedBy())
                .build();
    }

    private RuntimeException datasourceNotFound(UUID id) {
        return ExceptionUtils.throwBusinessException(
                BusinessExceptionBuilder.builder()
                        .message("Datasource not found with id " + id)
                        .reason("No datasource found matching the provided id")
                        .code("DATASOURCE_NOT_FOUND")
                        .status(HttpStatus.NOT_FOUND)
                        .retryable(false)
                        .success(false)
                        .build()
        );
    }

    private String getCurrentUserId() {
        if (auditSecurityHelper != null) {
            try {
                var actor = auditSecurityHelper.resolveCurrentActor();
                if (actor != null && actor.getActorId() != null) {
                    return actor.getActorId();
                }
            } catch (Exception e) {
                // fallback to default
            }
        }
        return "system";
    }

    private static String normalizeSearch(String search) {
        return (search == null || search.isBlank()) ? null : search.trim();
    }
}
