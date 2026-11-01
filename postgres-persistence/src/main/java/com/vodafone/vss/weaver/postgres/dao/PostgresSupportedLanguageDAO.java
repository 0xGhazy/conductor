package com.vodafone.vss.weaver.postgres.dao;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.language.SupportedLanguageModel;
import com.vodafone.vss.weaver.dao.SupportedLanguageDAO;

import com.fasterxml.jackson.databind.ObjectMapper;

public class PostgresSupportedLanguageDAO extends PostgresBaseDAO implements SupportedLanguageDAO {

    public PostgresSupportedLanguageDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public SupportedLanguageModel create(SupportedLanguageModel model) {
        if (model.getId() == null) {
            model.setId(UUID.randomUUID());
        }
        if (model.getCreatedAt() == null) {
            model.setCreatedAt(Instant.now());
        }
        model.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO supported_languages ("
                        + "id, code, name, native_name, is_rtl, is_default, created_at, updated_at"
                        + ") VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(model.getId().toString());
                    q.addParameter(model.getCode());
                    q.addParameter(model.getName());
                    q.addParameter(model.getNativeName());
                    q.addParameter(model.isRtl());
                    q.addParameter(model.isDefault());
                    q.addTimestampParameter(toTimestamp(model.getCreatedAt()));
                    q.addTimestampParameter(toTimestamp(model.getUpdatedAt()));
                });
        return model;
    }

    @Override
    public SupportedLanguageModel update(SupportedLanguageModel model) {
        model.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE supported_languages SET "
                        + "name = ?, native_name = ?, is_rtl = ?, is_default = ?, updated_at = ? "
                        + "WHERE id = ?::uuid";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(model.getName());
                    q.addParameter(model.getNativeName());
                    q.addParameter(model.isRtl());
                    q.addParameter(model.isDefault());
                    q.addTimestampParameter(toTimestamp(model.getUpdatedAt()));
                    q.addParameter(model.getId().toString());
                });
        return model;
    }

    @Override
    public boolean deleteById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "DELETE FROM supported_languages WHERE id = ?::uuid";
        executeWithTransaction(sql, q -> q.addParameter(id.toString()));
        return true;
    }

    @Override
    public Optional<SupportedLanguageModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, code, name, native_name, is_rtl, is_default, created_at, updated_at "
                        + "FROM supported_languages WHERE id = ?::uuid";

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
    public Optional<SupportedLanguageModel> findByCode(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, code, name, native_name, is_rtl, is_default, created_at, updated_at "
                        + "FROM supported_languages WHERE LOWER(code) = LOWER(?)";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(code.trim());
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
    public List<SupportedLanguageModel> findAll() {
        String sql =
                "SELECT id, code, name, native_name, is_rtl, is_default, created_at, updated_at "
                        + "FROM supported_languages ORDER BY is_default DESC, name ASC";

        return queryWithTransaction(
                sql,
                q ->
                        q.executeAndFetch(
                                rs -> {
                                    List<SupportedLanguageModel> list = new ArrayList<>();
                                    while (rs.next()) {
                                        list.add(mapRow(rs));
                                    }
                                    return list;
                                }));
    }

    @Override
    public long count() {
        String sql = "SELECT COUNT(1) FROM supported_languages";
        return queryWithTransaction(
                sql,
                q ->
                        q.executeAndFetch(
                                rs -> {
                                    if (rs.next()) {
                                        return rs.getLong(1);
                                    }
                                    return 0L;
                                }));
    }

    @Override
    public void clearDefaultFlagExcept(UUID id) {
        String sql =
                id != null
                        ? "UPDATE supported_languages SET is_default = false WHERE id != ?::uuid"
                        : "UPDATE supported_languages SET is_default = false";

        executeWithTransaction(
                sql,
                q -> {
                    if (id != null) {
                        q.addParameter(id.toString());
                    }
                });
    }

    private SupportedLanguageModel mapRow(ResultSet rs) throws SQLException {
        Timestamp createdTs = rs.getTimestamp("created_at");
        Timestamp updatedTs = rs.getTimestamp("updated_at");

        return SupportedLanguageModel.builder()
                .id(UUID.fromString(rs.getString("id")))
                .code(rs.getString("code"))
                .name(rs.getString("name"))
                .nativeName(rs.getString("native_name"))
                .rtl(rs.getBoolean("is_rtl"))
                .isDefault(rs.getBoolean("is_default"))
                .createdAt(createdTs != null ? createdTs.toInstant() : null)
                .updatedAt(updatedTs != null ? updatedTs.toInstant() : null)
                .build();
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant != null ? Timestamp.from(instant) : null;
    }
}
