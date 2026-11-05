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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.actions.database.dialect.DatabaseDialect;
import com.vodafone.vss.weaver.actions.database.dialect.DialectRegistry;
import com.vodafone.vss.weaver.actions.database.dto.DatabaseConnectionTestRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatabaseRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.event.DatasourceChangedEvent;
import com.vodafone.vss.weaver.actions.database.registry.DataSourceLease;
import com.vodafone.vss.weaver.actions.database.util.PasswordEncryptionUtil;
import com.vodafone.vss.weaver.annotations.Audit;
import com.vodafone.vss.weaver.annotations.AuditContext;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.audit.service.UserService;
import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.common.database.*;
import com.vodafone.vss.weaver.common.exceptions.BusinessExceptionBuilder;
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

    @Autowired(required = false)
    private UserService userService;

    @Autowired(required = false)
    private DialectRegistry dialectRegistry = DialectRegistry.getDefault();

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

    // ----- REST operations: return models; the REST layer decides the HTTP status ----- //

    @Audit(action = "createDatabase", resourceType = "DATABASE", captureArguments = false)
    public DatasourceModel create(@NotNull DatabaseRequest request) {
        AuditContext.put("name", request.getName());
        DatasourceModel payload = request.toModel();
        validate(payload, true);
        String normalizedName = payload.getName().trim();
        DatabaseType databaseType = payload.getType();
        log.info("Creating database [{}] of type {}", normalizedName, databaseType);

        if (existsByNameIgnoreCase(normalizedName)) {
            throw duplicateName(normalizedName);
        }

        JdbcConnectionDetails conn = withPoolDefaults(payload.getConnection());
        conn.setPassword(PasswordEncryptionUtil.encrypt(conn.getPassword()));

        UserMinimal currentUserId = currentUser();
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
            log.warn("Connection test failed for new database [{}]: {}", normalizedName, probe.errorCode());
            if (strictValidation) {
                handleConnectionFailure(probe, "creation");
            }
        }

        DatasourceModel saved = datasourceDAO.create(datasource);
        eventPublisher.publishEvent(DatasourceChangedEvent.changed(saved.getId(), saved.getVersion()));
        log.info("Database [{}] created with id {}", normalizedName, saved.getId());
        Map<String, Object> created = auditFields(saved);
        created.put("connection.password", MASK);
        AuditContext.recordChanges(Map.of(), created);

        // The password stays in the entity; JSON never includes it (see JdbcConnectionDetails).
        saved.setStatus(recordProbe(saved.getId(), probe));
        return withUsers(saved);
    }

    @Audit(action = "updateDatabase", resourceType = "DATABASE", captureArguments = false)
    public DatasourceModel update(@NotNull UUID id, @NotNull DatabaseRequest request) {
        AuditContext.put("name", request.getName());
        DatasourceModel payload = request.toModel();
        validate(payload, false);
        String normalizedName = payload.getName().trim();
        DatabaseType databaseType = payload.getType();

        DatasourceModel current = datasourceDAO.findById(id).orElseThrow(() -> datasourceNotFound(id));
        if (!normalizedName.equalsIgnoreCase(current.getName()) && existsByNameIgnoreCase(normalizedName)) {
            throw duplicateName(normalizedName);
        }

        JdbcConnectionDetails newConnection = withPoolDefaults(payload.getConnection());
        newConnection.setPassword(passwordToStore(payload, current));

        DatasourceModel candidate = DatasourceModel.builder()
                .id(id)
                .name(normalizedName)
                .type(databaseType)
                .version(current.getVersion())
                .connection(newConnection)
                // Unchanged by an update; kept so the response shows the real creator and time.
                .createdAt(current.getCreatedAt())
                .createdBy(current.getCreatedBy())
                .build();

        PingResult probe = dynamicDataSourceManager.testConnection(toResolvedConfig(candidate));
        if (probe != null && !probe.reachable()) {
            log.warn("Connection test failed for database {} update: {}", id, probe.errorCode());
            if (strictValidation) {
                handleConnectionFailure(probe, "update");
            }
        }

        candidate.setUpdatedBy(currentUser());
        DatasourceModel updated = datasourceDAO.update(candidate);
        eventPublisher.publishEvent(DatasourceChangedEvent.changed(updated.getId(), updated.getVersion()));
        log.info("Database {} updated", id);
        Map<String, Object> before = auditFields(current);
        Map<String, Object> after = auditFields(updated);
        // Encryption is randomised, so a change is "a new password was given"; never the value.
        if (!isPasswordBlankOrMasked(payload.getConnection().getPassword())) {
            before.put("connection.password", MASK);
            after.put("connection.password", MASK + " (changed)");
        }
        // Property values are never shown; a value change with the same names is still noted.
        Map<String, String> oldProperties = current.getConnection() != null ? current.getConnection().getProperties() : null;
        Map<String, String> newProperties = updated.getConnection() != null ? updated.getConnection().getProperties() : null;
        if (!java.util.Objects.equals(emptyIfNull(oldProperties), emptyIfNull(newProperties))
                && java.util.Objects.equals(before.get("connection.properties"), after.get("connection.properties"))) {
            after.put("connection.properties",
                    String.join(", ", new java.util.TreeSet<>(emptyIfNull(newProperties).keySet())) + " (values changed)");
        }
        AuditContext.recordChanges(before, after);

        updated.setStatus(recordProbe(id, probe));
        return withUsers(updated);
    }

    /** The database with its connection status, or a 404 error. */
    public DatasourceModel get(@NotNull UUID id) {
        DatasourceModel datasource = findById(id).orElseThrow(() -> datasourceNotFound(id));
        datasource.setStatus(statusOf(id));
        return withUsers(datasource);
    }

    /** One page of databases, newest first, with their connection status. */
    public Page<DatasourceModel> list(String search, int page, int size) {
        String normalizedSearch = normalizeSearch(search);
        List<DatasourceModel> items = datasourceDAO.findAll(page * size, size, normalizedSearch, false);
        for (DatasourceModel ds : items) {
            ds.setStatus(statusOf(ds.getId()));
            withUsers(ds);
        }
        long total = datasourceDAO.count(normalizedSearch);
        return new PageImpl<>(items, PageRequest.of(page, size), total);
    }

    /** Deletes the database; 404 when missing, 409 while saved queries still use it. */
    public void deleteDatabase(@NotNull UUID id) {
        try {
            delete(id);
        } catch (NoSuchElementException e) {
            throw datasourceNotFound(id);
        } catch (IllegalStateException e) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Failed to delete database")
                            .reason(e.getMessage())
                            .code("RELATED_QUERIES_FOUND")
                            .retryable(false)
                            .success(false)
                            .status(HttpStatus.CONFLICT)
                            .build()
            );
        }
    }

    /** Pings one saved database and returns it with the fresh status. */
    public DatasourceModel ping(@NotNull UUID id) {
        return ping(Set.of(id)).get(0);
    }

    /** Pings saved databases; 404 (listing the missing ids) when any id is unknown. */
    public List<DatasourceModel> ping(@NotNull @NotEmpty Set<UUID> requestedIds) {
        List<DatasourceModel> existingDataSources = findAllByIds(requestedIds);
        Set<UUID> foundIds = existingDataSources.stream().map(DatasourceModel::getId).collect(Collectors.toSet());
        List<UUID> missingIds = requestedIds.stream().filter(id -> !foundIds.contains(id)).toList();
        if (!missingIds.isEmpty()) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Failed to ping databases")
                            .reason("Some database ids were not found")
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

        return requestedIds.stream().map(id -> {
            PingResult pingResult = pingResults.getOrDefault(id,
                    new PingResult(false, "Ping failed", DatabaseErrorCode.CONNECTION_FAILED.name()));
            DatasourceModel datasource = datasourceMap.get(id);
            datasource.setStatus(toStatus(pingResult, "Ping failed"));
            return withUsers(datasource);
        }).toList();
    }

    /**
     * Tests a connection without saving anything. The password is required, except when the
     * payload carries the id of a saved database: then a blank or masked password means
     * "use the stored one", so an edit form can test without retyping it.
     */
    public DatasourceStatus testConnection(@NotNull DatabaseConnectionTestRequest request) {
        DatasourceModel payload = request.toModel();
        UUID savedId = request.getId();
        DatasourceModel current = savedId != null
                ? datasourceDAO.findById(savedId).orElseThrow(() -> datasourceNotFound(savedId))
                : null;
        validate(payload, current == null);

        JdbcConnectionDetails conn = withPoolDefaults(payload.getConnection());
        conn.setPassword(passwordToStore(payload, current));
        DatasourceModel candidate = DatasourceModel.builder()
                .name(payload.getName().trim())
                .type(payload.getType())
                .connection(conn)
                .build();

        PingResult probe = dynamicDataSourceManager.testConnection(toResolvedConfig(candidate));
        log.info("Connection test for [{}]: reachable={}", candidate.getName(), probe != null && probe.reachable());
        return probe == null
                ? DatasourceStatus.unknown("Connection test unavailable")
                : toStatus(probe, "Connection test failed");
    }

    /** Adds the users behind createdBy / updatedBy (when user lookup is configured). */
    private DatasourceModel withUsers(DatasourceModel datasource) {
        if (userService != null) {
            userService.fillUsers(datasource);
        }
        return datasource;
    }

    private static DatasourceStatus toStatus(PingResult result, String failureMessage) {
        return result.reachable()
                ? DatasourceStatus.active()
                : DatasourceStatus.inactive(failureMessage, result.reason(), result.errorCode());
    }

    /** Encrypted password to use: the new one when given, otherwise the stored one. */
    private static String passwordToStore(DatasourceModel payload, DatasourceModel current) {
        String raw = payload.getConnection() != null ? payload.getConnection().getPassword() : null;
        if (!isPasswordBlankOrMasked(raw)) {
            return PasswordEncryptionUtil.encrypt(raw);
        }
        return current != null && current.getConnection() != null ? current.getConnection().getPassword() : null;
    }

    /** Checks required fields and the JDBC URL format; 400 with every problem found. */
    private void validate(DatasourceModel payload, boolean passwordRequired) {
        List<String> errors = new ArrayList<>();
        if (payload.getName() == null || payload.getName().isBlank()) {
            errors.add("name is required");
        }
        if (payload.getType() == null) {
            errors.add("type is required");
        }
        JdbcConnectionDetails conn = payload.getConnection();
        if (conn == null) {
            errors.add("connection is required");
        } else {
            if (conn.getUrl() == null || conn.getUrl().isBlank()) {
                errors.add("connection.url is required");
            } else if (payload.getType() != null && !conn.getUrl().contains("${")
                    && dialectRegistry.supports(payload.getType())) {
                // URLs with placeholders are checked by the connection probe after resolving.
                DatabaseDialect dialect = dialectRegistry.getDialect(payload.getType());
                if (!dialect.isValidUrl(conn.getUrl().trim())) {
                    errors.add("connection.url is not a valid " + payload.getType()
                            + " JDBC URL; expected " + dialect.urlFormatHint());
                }
            }
            if (conn.getUsername() == null || conn.getUsername().isBlank()) {
                errors.add("connection.username is required");
            }
            if (passwordRequired && isPasswordBlankOrMasked(conn.getPassword())) {
                errors.add("connection.password is required");
            }
        }
        if (!errors.isEmpty()) {
            throw ExceptionUtils.throwBusinessException(
                    BusinessExceptionBuilder.builder()
                            .message("Invalid database definition")
                            .reason(String.join("; ", errors))
                            .code("INVALID_DATABASE")
                            .withDetail("errors", errors)
                            .retryable(false)
                            .success(false)
                            .status(HttpStatus.BAD_REQUEST)
                            .build());
        }
    }

    private static RuntimeException duplicateName(String name) {
        return ExceptionUtils.throwBusinessException(
                BusinessExceptionBuilder.builder()
                        .message("Database name already in use")
                        .reason("A database named '" + name + "' already exists")
                        .code("DUPLICATE_NAME")
                        .status(HttpStatus.CONFLICT)
                        .retryable(false)
                        .success(false)
                        .build());
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

    private static final String MASK = "******";

    /**
     * The fields of a database shown in audit changes. No secrets: the password is handled by
     * the caller, and for JDBC properties (which may hold credentials) only the names are kept.
     */
    private static Map<String, Object> auditFields(DatasourceModel datasource) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", datasource.getName());
        fields.put("type", datasource.getType());
        JdbcConnectionDetails connection = datasource.getConnection();
        if (connection != null) {
            fields.put("connection.url", connection.getUrl());
            fields.put("connection.username", connection.getUsername());
            fields.put("connection.schema", connection.getSchema());
            fields.put("connection.minimumIdle", connection.getMinimumIdle());
            fields.put("connection.maxPoolSize", connection.getMaxPoolSize());
            fields.put("connection.idleTimeout", connection.getIdleTimeout());
            fields.put("connection.maxLifetime", connection.getMaxLifetime());
            fields.put("connection.connectionTimeout", connection.getConnectionTimeout());
            if (connection.getProperties() != null && !connection.getProperties().isEmpty()) {
                fields.put("connection.properties", new java.util.TreeSet<>(connection.getProperties().keySet()));
            }
        }
        return fields;
    }

    private static Map<String, String> emptyIfNull(Map<String, String> map) {
        return map != null ? map : Map.of();
    }

    private static boolean isPasswordBlankOrMasked(String password) {
        return password == null || password.isBlank() || password.startsWith("****");
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

    /**
     * The caller as an id-only user: the token's subject is the Keycloak user id (user_entity.id).
     * Null when nobody is signed in (security disabled) or the subject is not a user id.
     */
    private UserMinimal currentUser() {
        if (auditSecurityHelper == null) {
            return null;
        }
        String actorId;
        try {
            var actor = auditSecurityHelper.resolveCurrentActor();
            actorId = actor != null ? actor.getActorId() : null;
        } catch (Exception e) {
            return null;
        }
        if (actorId == null || actorId.isBlank()) {
            return null;
        }
        try {
            return UserMinimal.ofId(UUID.fromString(actorId.trim()).toString());
        } catch (IllegalArgumentException e) {
            log.debug("Caller '{}' is not a Keycloak user id; createdBy/updatedBy left empty", actorId);
            return null;
        }
    }

    private static String normalizeSearch(String search) {
        return (search == null || search.isBlank()) ? null : search.trim();
    }
}
