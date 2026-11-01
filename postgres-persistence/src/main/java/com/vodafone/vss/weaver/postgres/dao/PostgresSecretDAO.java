package com.vodafone.vss.weaver.postgres.dao;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.secrets.SecretMinimal;
import com.vodafone.vss.weaver.common.secrets.SecretModel;
import com.vodafone.vss.weaver.common.secrets.SecretPlaceholderParser;
import com.vodafone.vss.weaver.dao.SecretDAO;

import com.fasterxml.jackson.databind.ObjectMapper;

public class PostgresSecretDAO extends PostgresBaseDAO implements SecretDAO {

    public PostgresSecretDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public SecretModel create(SecretModel model) {
        if (model.getId() == null) {
            model.setId(UUID.randomUUID());
        }
        if (model.getCreatedAt() == null) {
            model.setCreatedAt(Instant.now());
        }
        model.setUpdatedAt(Instant.now());
        if (model.getVersion() == null) {
            model.setVersion(0L);
        }

        String sql =
                "INSERT INTO secrets ("
                        + "id, name, encrypted_value, iv, displayed_text, description, version, created_by, created_at, updated_at"
                        + ") VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?::uuid, ?, ?)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(model.getId().toString());
                    q.addParameter(model.getName());
                    q.addParameter(model.getEncryptedValue());
                    q.addParameter(model.getIv());
                    q.addParameter(model.getDisplayedText());
                    q.addParameter(model.getDescription());
                    q.addParameter(model.getVersion());
                    q.addParameter(model.getCreatedBy() != null ? model.getCreatedBy().toString() : null);
                    q.addTimestampParameter(toTimestamp(model.getCreatedAt()));
                    q.addTimestampParameter(toTimestamp(model.getUpdatedAt()));
                });
        return model;
    }

    @Override
    public SecretModel update(SecretModel model) {
        model.setUpdatedAt(Instant.now());
        long newVersion = (model.getVersion() != null ? model.getVersion() : 0L) + 1L;

        boolean hasNewValue = model.getEncryptedValue() != null && model.getIv() != null;
        String sql;
        if (hasNewValue) {
            sql =
                    "UPDATE secrets SET "
                            + "encrypted_value = ?, iv = ?, displayed_text = ?, description = ?, version = ?, updated_at = ? "
                            + "WHERE id = ?::uuid";
        } else {
            sql =
                    "UPDATE secrets SET "
                            + "description = ?, version = ?, updated_at = ? "
                            + "WHERE id = ?::uuid";
        }

        executeWithTransaction(
                sql,
                q -> {
                    if (hasNewValue) {
                        q.addParameter(model.getEncryptedValue());
                        q.addParameter(model.getIv());
                        q.addParameter(model.getDisplayedText());
                        q.addParameter(model.getDescription());
                        q.addParameter(newVersion);
                        q.addTimestampParameter(toTimestamp(model.getUpdatedAt()));
                        q.addParameter(model.getId().toString());
                    } else {
                        q.addParameter(model.getDescription());
                        q.addParameter(newVersion);
                        q.addTimestampParameter(toTimestamp(model.getUpdatedAt()));
                        q.addParameter(model.getId().toString());
                    }
                });
        model.setVersion(newVersion);
        return model;
    }

    @Override
    public boolean deleteById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "DELETE FROM secrets WHERE id = ?::uuid";
        executeWithTransaction(sql, q -> q.addParameter(id.toString()));
        return true;
    }

    @Override
    public boolean deleteByName(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String sql = "DELETE FROM secrets WHERE name = ?";
        executeWithTransaction(sql, q -> q.addParameter(name));
        return true;
    }

    @Override
    public Optional<SecretModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, name, encrypted_value, iv, displayed_text, description, version, created_by, created_at, updated_at "
                        + "FROM secrets WHERE id = ?::uuid";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public Optional<SecretModel> findByName(String name) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, name, encrypted_value, iv, displayed_text, description, version, created_by, created_at, updated_at "
                        + "FROM secrets WHERE name = ?";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name);
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public boolean existsByName(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String sql = "SELECT 1 FROM secrets WHERE name = ? LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name);
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public List<SecretModel> findAll(String search, int offset, int limit) {
        StringBuilder sql =
                new StringBuilder(
                        "SELECT id, name, encrypted_value, iv, displayed_text, description, version, created_by, created_at, updated_at FROM secrets ");
        boolean hasSearch = search != null && !search.isBlank();
        if (hasSearch) {
            sql.append("WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? ");
        }
        sql.append("ORDER BY created_at DESC LIMIT ? OFFSET ?");

        return queryWithTransaction(
                sql.toString(),
                q -> {
                    if (hasSearch) {
                        String pattern = "%" + search.toLowerCase().trim() + "%";
                        q.addParameter(pattern);
                        q.addParameter(pattern);
                    }
                    q.addParameter(limit > 0 ? limit : 20);
                    q.addParameter(Math.max(offset, 0));
                    return q.executeAndFetch(
                            rs -> {
                                List<SecretModel> list = new ArrayList<>();
                                while (rs.next()) {
                                    list.add(mapRow(rs));
                                }
                                return list;
                            });
                });
    }

    @Override
    public List<SecretMinimal> findAllMinimal(String search, int offset, int limit) {
        StringBuilder sql =
                new StringBuilder(
                        "SELECT id, name, displayed_text FROM secrets ");
        boolean hasSearch = search != null && !search.isBlank();
        if (hasSearch) {
            sql.append("WHERE LOWER(name) LIKE ? ");
        }
        sql.append("ORDER BY name ASC LIMIT ? OFFSET ?");

        return queryWithTransaction(
                sql.toString(),
                q -> {
                    if (hasSearch) {
                        String pattern = "%" + search.toLowerCase().trim() + "%";
                        q.addParameter(pattern);
                    }
                    q.addParameter(limit > 0 ? limit : 50);
                    q.addParameter(Math.max(offset, 0));
                    return q.executeAndFetch(
                            rs -> {
                                List<SecretMinimal> list = new ArrayList<>();
                                while (rs.next()) {
                                    String n = rs.getString("name");
                                    list.add(
                                            new SecretMinimal(
                                                    UUID.fromString(rs.getString("id")),
                                                    n,
                                                    rs.getString("displayed_text"),
                                                    SecretPlaceholderParser.placeholderFor(n)));
                                }
                                return list;
                            });
                });
    }

    @Override
    public List<SecretModel> findAllByNameIn(Collection<String> names) {
        if (names == null || names.isEmpty()) {
            return List.of();
        }
        String placeholders = names.stream().map(n -> "?").collect(Collectors.joining(", "));
        String sql =
                "SELECT id, name, encrypted_value, iv, displayed_text, description, version, created_by, created_at, updated_at "
                        + "FROM secrets WHERE name IN ("
                        + placeholders
                        + ")";

        return queryWithTransaction(
                sql,
                q -> {
                    for (String name : names) {
                        q.addParameter(name);
                    }
                    return q.executeAndFetch(
                            rs -> {
                                List<SecretModel> list = new ArrayList<>();
                                while (rs.next()) {
                                    list.add(mapRow(rs));
                                }
                                return list;
                            });
                });
    }

    @Override
    public long count(String search) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM secrets ");
        boolean hasSearch = search != null && !search.isBlank();
        if (hasSearch) {
            sql.append("WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?");
        }

        return queryWithTransaction(
                sql.toString(),
                q -> {
                    if (hasSearch) {
                        String pattern = "%" + search.toLowerCase().trim() + "%";
                        q.addParameter(pattern);
                        q.addParameter(pattern);
                    }
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return rs.getLong(1);
                                }
                                return 0L;
                            });
                });
    }

    @Override
    public List<String> listSecretNames() {
        String sql = "SELECT name FROM secrets ORDER BY name ASC";
        return queryWithTransaction(
                sql,
                q ->
                        q.executeAndFetch(
                                rs -> {
                                    List<String> list = new ArrayList<>();
                                    while (rs.next()) {
                                        list.add(rs.getString("name"));
                                    }
                                    return list;
                                }));
    }

    private SecretModel mapRow(ResultSet rs) throws SQLException {
        Timestamp createdTs = rs.getTimestamp("created_at");
        Timestamp updatedTs = rs.getTimestamp("updated_at");
        String createdByStr = rs.getString("created_by");

        return SecretModel.builder()
                .id(UUID.fromString(rs.getString("id")))
                .name(rs.getString("name"))
                .encryptedValue(rs.getBytes("encrypted_value"))
                .iv(rs.getBytes("iv"))
                .displayedText(rs.getString("displayed_text"))
                .description(rs.getString("description"))
                .version(rs.getLong("version"))
                .createdBy(createdByStr != null ? UUID.fromString(createdByStr) : null)
                .createdAt(createdTs != null ? createdTs.toInstant() : null)
                .updatedAt(updatedTs != null ? updatedTs.toInstant() : null)
                .build();
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant != null ? Timestamp.from(instant) : null;
    }
}
