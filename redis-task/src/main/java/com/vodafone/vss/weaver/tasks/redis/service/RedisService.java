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
package com.vodafone.vss.weaver.tasks.redis.service;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.redis.RedisCommandRequestDto;
import com.vodafone.vss.weaver.common.redis.RedisCommandResponseDto;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceModel;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceNotFoundException;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceRequestDto;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceResponseDto;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceStatus;
import com.vodafone.vss.weaver.common.redis.RedisKeyRequestDto;
import com.vodafone.vss.weaver.dao.RedisDatasourceDAO;

@Service
public class RedisService {

    private static final Logger log = LoggerFactory.getLogger(RedisService.class);

    private final RedisDatasourceDAO redisDatasourceDAO;
    private final ConcurrentMap<UUID, LettuceConnectionFactory> factories = new ConcurrentHashMap<>();
    private final ConcurrentMap<UUID, StringRedisTemplate> stringTemplates = new ConcurrentHashMap<>();
    private final ConcurrentMap<UUID, RedisTemplate<String, Object>> genericTemplates =
            new ConcurrentHashMap<>();

    public RedisService(RedisDatasourceDAO redisDatasourceDAO) {
        this.redisDatasourceDAO = redisDatasourceDAO;
    }

    @PostConstruct
    public void init() {
        log.info("Initializing Redis dynamic connection pool from database");
        try {
            List<RedisDatasourceModel> datasources = redisDatasourceDAO.findAll();
            if (datasources.isEmpty()) {
                log.info("No Redis datasources registered in database");
                return;
            }

            for (RedisDatasourceModel ds : datasources) {
                if (Boolean.TRUE.equals(ds.getActive())) {
                    try {
                        registerConnectionFactory(ds);
                        log.info("Registered Redis connection pool for datasource: {}", ds.getName());
                    } catch (Exception e) {
                        log.warn("Failed to register Redis connection pool for datasource [{}] (id={}): {}",
                                ds.getName(), ds.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Could not query Redis datasources during startup: {}", ex.getMessage());
        }
    }

    @PreDestroy
    public void destroyAll() {
        log.info("Closing all dynamic Redis connection factories");
        for (Map.Entry<UUID, LettuceConnectionFactory> entry : factories.entrySet()) {
            try {
                entry.getValue().destroy();
            } catch (Exception e) {
                log.warn("Error closing LettuceConnectionFactory for datasource {}: {}",
                        entry.getKey(), e.getMessage());
            }
        }
        factories.clear();
        stringTemplates.clear();
        genericTemplates.clear();
    }

    public List<RedisDatasourceModel> findAll() {
        return redisDatasourceDAO.findAll();
    }

    public RedisDatasourceModel findById(UUID id) {
        if (id == null) {
            throw new RedisDatasourceNotFoundException("Redis Datasource ID cannot be null");
        }
        return redisDatasourceDAO.findById(id)
                .orElseThrow(() -> new RedisDatasourceNotFoundException(
                        "Redis Datasource not found with ID: " + id));
    }

    public RedisDatasourceModel findByName(String name) {
        if (name == null || name.isBlank()) {
            throw new RedisDatasourceNotFoundException("Redis Datasource name cannot be blank");
        }
        return redisDatasourceDAO.findByName(name)
                .orElseThrow(() -> new RedisDatasourceNotFoundException(
                        "Redis Datasource not found with name: " + name));
    }

    public StringRedisTemplate getStringRedisTemplate(UUID id) {
        StringRedisTemplate template = stringTemplates.get(id);
        if (template != null) {
            return template;
        }

        RedisDatasourceModel ds = findById(id);
        if (!Boolean.TRUE.equals(ds.getActive())) {
            throw ExceptionUtils.throwBadInputs("Redis Datasource inactive",
                    "Redis Datasource '" + ds.getName() + "' is inactive");
        }
        registerConnectionFactory(ds);
        template = stringTemplates.get(id);
        if (template == null) {
            throw new IllegalStateException("Failed to obtain StringRedisTemplate for datasource: " + id);
        }
        return template;
    }

    public RedisTemplate<String, Object> getRedisTemplate(UUID id) {
        RedisTemplate<String, Object> template = genericTemplates.get(id);
        if (template != null) {
            return template;
        }

        RedisDatasourceModel ds = findById(id);
        if (!Boolean.TRUE.equals(ds.getActive())) {
            throw ExceptionUtils.throwBadInputs("Redis Datasource inactive",
                    "Redis Datasource '" + ds.getName() + "' is inactive");
        }
        registerConnectionFactory(ds);
        template = genericTemplates.get(id);
        if (template == null) {
            throw new IllegalStateException("Failed to obtain RedisTemplate for datasource: " + id);
        }
        return template;
    }

    public void setKey(UUID datasourceId, String key, String value, Long ttlSeconds) {
        StringRedisTemplate template = getStringRedisTemplate(datasourceId);
        if (ttlSeconds != null && ttlSeconds > 0) {
            template.opsForValue().set(key, value != null ? value : "", Duration.ofSeconds(ttlSeconds));
        } else {
            template.opsForValue().set(key, value != null ? value : "");
        }
    }

    public String getKey(UUID datasourceId, String key) {
        StringRedisTemplate template = getStringRedisTemplate(datasourceId);
        return template.opsForValue().get(key);
    }

    public Boolean deleteKey(UUID datasourceId, String key) {
        StringRedisTemplate template = getStringRedisTemplate(datasourceId);
        return template.delete(key);
    }

    public RedisCommandResponseDto executeCommand(UUID id, RedisCommandRequestDto req) {
        StringRedisTemplate template = getStringRedisTemplate(id);
        String action = req.getAction() != null ? req.getAction().toUpperCase().trim() : "";

        Object result;

        switch (action) {
            case "SET":
                if (req.getTtlSeconds() != null && req.getTtlSeconds() > 0) {
                    template.opsForValue().set(
                            req.getKey(),
                            req.getValue() != null ? req.getValue() : "",
                            Duration.ofSeconds(req.getTtlSeconds()));
                } else {
                    template.opsForValue().set(
                            req.getKey(),
                            req.getValue() != null ? req.getValue() : "");
                }
                result = "OK";
                break;

            case "GET":
                result = template.opsForValue().get(req.getKey());
                break;

            case "DEL":
            case "DELETE":
                if (req.getKeys() != null && !req.getKeys().isEmpty()) {
                    result = template.delete(req.getKeys());
                } else if (req.getKey() != null) {
                    result = template.delete(req.getKey());
                } else {
                    result = 0L;
                }
                break;

            case "EXISTS":
                result = Boolean.TRUE.equals(template.hasKey(req.getKey()));
                break;

            case "EXPIRE":
                result = template.expire(
                        req.getKey(),
                        Duration.ofSeconds(req.getTtlSeconds() != null ? req.getTtlSeconds() : 0));
                break;

            case "KEYS":
                String pattern = (req.getKey() != null && !req.getKey().isBlank()) ? req.getKey() : "*";
                result = template.keys(pattern);
                break;

            case "INCR":
            case "INCRBY":
                long incrDelta = (req.getDelta() != null)
                        ? req.getDelta()
                        : (req.getValue() != null ? Long.parseLong(req.getValue()) : 1L);
                result = template.opsForValue().increment(req.getKey(), incrDelta);
                break;

            case "DECR":
            case "DECRBY":
                long decrDelta = (req.getDelta() != null)
                        ? req.getDelta()
                        : (req.getValue() != null ? Long.parseLong(req.getValue()) : 1L);
                result = template.opsForValue().decrement(req.getKey(), decrDelta);
                break;

            case "HSET":
                template.opsForHash().put(
                        req.getKey(),
                        req.getField(),
                        req.getValue() != null ? req.getValue() : "");
                result = "OK";
                break;

            case "HGET":
                result = template.opsForHash().get(req.getKey(), req.getField());
                break;

            case "HDEL":
                result = template.opsForHash().delete(req.getKey(), req.getField());
                break;

            case "HGETALL":
                result = template.opsForHash().entries(req.getKey());
                break;

            case "HINCRBY":
                long hincrDelta = (req.getDelta() != null)
                        ? req.getDelta()
                        : (req.getValue() != null ? Long.parseLong(req.getValue()) : 1L);
                result = template.opsForHash().increment(req.getKey(), req.getField(), hincrDelta);
                break;

            case "PING":
                if (template.getConnectionFactory() != null) {
                    result = template.getConnectionFactory().getConnection().ping();
                } else {
                    result = "PONG";
                }
                break;

            default:
                throw ExceptionUtils.throwBadInputs(
                        "Unsupported Redis action",
                        "Supported actions: SET, GET, DEL, EXISTS, EXPIRE, KEYS, INCR, DECR, INCRBY, DECRBY, HSET, HGET, HDEL, HGETALL, HINCRBY, PING");
        }

        return RedisCommandResponseDto.builder()
                .action(action)
                .success(true)
                .result(result)
                .build();
    }

    public RedisDatasourceModel save(RedisDatasourceModel ds) {
        log.info("Saving Redis datasource: name={}, host={}:{}", ds.getName(), ds.getHost(), ds.getPort());
        ds.setUpdatedAt(Instant.now());
        RedisDatasourceModel saved;
        if (ds.getId() != null && redisDatasourceDAO.existsById(ds.getId())) {
            saved = redisDatasourceDAO.update(ds);
        } else {
            saved = redisDatasourceDAO.create(ds);
        }
        if (Boolean.TRUE.equals(saved.getActive())) {
            registerConnectionFactory(saved);
        } else {
            closeConnectionFactory(saved.getId());
        }
        return saved;
    }

    public void delete(UUID id) {
        log.info("Deleting Redis datasource with ID: {}", id);
        findById(id);
        closeConnectionFactory(id);
        redisDatasourceDAO.deleteById(id);
    }

    public RedisDatasourceStatus testConnection(RedisDatasourceRequestDto req) {
        long start = System.currentTimeMillis();
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName(req.getHost());
        config.setPort(req.getPort() != null ? req.getPort() : 6379);
        config.setDatabase(req.getDatabaseIndex() != null ? req.getDatabaseIndex() : 0);

        if (req.getUsername() != null && !req.getUsername().isBlank()) {
            config.setUsername(req.getUsername());
        }
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            config.setPassword(req.getPassword());
        }

        LettuceClientConfiguration.LettuceClientConfigurationBuilder builder =
                LettuceClientConfiguration.builder();
        if (req.getTimeoutMs() != null) {
            builder.commandTimeout(Duration.ofMillis(req.getTimeoutMs()));
        }
        if (Boolean.TRUE.equals(req.getSsl())) {
            builder.useSsl();
        }

        LettuceConnectionFactory factory = new LettuceConnectionFactory(config, builder.build());
        factory.afterPropertiesSet();
        factory.start();

        try {
            String pingResult = factory.getConnection().ping();
            long elapsed = System.currentTimeMillis() - start;
            return RedisDatasourceStatus.builder()
                    .name(req.getName())
                    .host(req.getHost())
                    .port(req.getPort())
                    .active(req.getActive())
                    .reachable(true)
                    .pingResult(pingResult)
                    .responseTimeMs(elapsed)
                    .lastCheckedAt(Instant.now())
                    .build();
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("Redis test connection failed to {}:{}: {}", req.getHost(), req.getPort(), e.getMessage());
            return RedisDatasourceStatus.builder()
                    .name(req.getName())
                    .host(req.getHost())
                    .port(req.getPort())
                    .active(req.getActive())
                    .reachable(false)
                    .pingResult("FAILED: " + e.getMessage())
                    .responseTimeMs(elapsed)
                    .lastCheckedAt(Instant.now())
                    .build();
        } finally {
            try {
                factory.destroy();
            } catch (Exception ignore) {
            }
        }
    }

    public RedisDatasourceStatus getStatus(UUID id) {
        RedisDatasourceModel ds = findById(id);
        long start = System.currentTimeMillis();
        try {
            LettuceConnectionFactory factory = factories.get(id);
            if (factory == null) {
                return testConnection(toRequestDto(ds));
            }
            String ping = factory.getConnection().ping();
            long elapsed = System.currentTimeMillis() - start;
            return RedisDatasourceStatus.builder()
                    .datasourceId(ds.getId())
                    .name(ds.getName())
                    .host(ds.getHost())
                    .port(ds.getPort())
                    .active(ds.getActive())
                    .reachable(true)
                    .pingResult(ping)
                    .responseTimeMs(elapsed)
                    .lastCheckedAt(Instant.now())
                    .build();
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            return RedisDatasourceStatus.builder()
                    .datasourceId(ds.getId())
                    .name(ds.getName())
                    .host(ds.getHost())
                    .port(ds.getPort())
                    .active(ds.getActive())
                    .reachable(false)
                    .pingResult("ERROR: " + e.getMessage())
                    .responseTimeMs(elapsed)
                    .lastCheckedAt(Instant.now())
                    .build();
        }
    }

    public synchronized void registerConnectionFactory(RedisDatasourceModel ds) {
        closeConnectionFactory(ds.getId());

        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName(ds.getHost());
        config.setPort(ds.getPort() != null ? ds.getPort() : 6379);
        config.setDatabase(ds.getDatabaseIndex() != null ? ds.getDatabaseIndex() : 0);

        if (ds.getUsername() != null && !ds.getUsername().isBlank()) {
            config.setUsername(ds.getUsername());
        }
        if (ds.getPassword() != null && !ds.getPassword().isBlank()) {
            config.setPassword(ds.getPassword());
        }

        LettuceClientConfiguration.LettuceClientConfigurationBuilder builder =
                LettuceClientConfiguration.builder();
        if (ds.getTimeoutMs() != null) {
            builder.commandTimeout(Duration.ofMillis(ds.getTimeoutMs()));
        }
        if (Boolean.TRUE.equals(ds.getSsl())) {
            builder.useSsl();
        }

        LettuceConnectionFactory factory = new LettuceConnectionFactory(config, builder.build());
        factory.afterPropertiesSet();
        factory.start();

        StringRedisTemplate stringTemplate = new StringRedisTemplate(factory);

        RedisTemplate<String, Object> genericTemplate = new RedisTemplate<>();
        genericTemplate.setConnectionFactory(factory);
        genericTemplate.setKeySerializer(new StringRedisSerializer());
        genericTemplate.setHashKeySerializer(new StringRedisSerializer());
        genericTemplate.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        genericTemplate.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        genericTemplate.afterPropertiesSet();

        factories.put(ds.getId(), factory);
        stringTemplates.put(ds.getId(), stringTemplate);
        genericTemplates.put(ds.getId(), genericTemplate);
    }

    public synchronized void closeConnectionFactory(UUID id) {
        if (id == null) {
            return;
        }
        LettuceConnectionFactory factory = factories.remove(id);
        stringTemplates.remove(id);
        genericTemplates.remove(id);
        if (factory != null) {
            try {
                factory.destroy();
                log.info("Closed Redis connection pool for datasource ID: {}", id);
            } catch (Exception e) {
                log.warn("Error destroying connection factory for datasource ID {}: {}", id, e.getMessage());
            }
        }
    }

    public ResponseEntity<AppResponse> createRest(@Valid RedisDatasourceRequestDto payload) {
        log.info("Creating Redis datasource: name={}, host={}:{}", payload.getName(), payload.getHost(), payload.getPort());
        RedisDatasourceModel entity = toModel(payload);
        RedisDatasourceModel saved = this.save(entity);

        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(saved.getId())
                .toUri();

        AppResponse body = AppResponse.builder()
                .status(HttpStatus.CREATED)
                .message("Redis datasource registered successfully")
                .path(location.getPath())
                .data(toResponseDto(saved))
                .build();

        return ResponseEntity.created(location).body(body);
    }

    public ResponseEntity<AppResponse> updateRest(UUID id, @Valid RedisDatasourceRequestDto payload) {
        log.info("Updating Redis datasource with ID {}: name={}", id, payload.getName());
        RedisDatasourceModel existing = this.findById(id);

        existing.setName(payload.getName());
        existing.setHost(payload.getHost());
        existing.setPort(payload.getPort() != null ? payload.getPort() : 6379);
        existing.setUsername(payload.getUsername());
        if (payload.getPassword() != null && !payload.getPassword().isBlank()) {
            existing.setPassword(payload.getPassword());
        }
        existing.setDatabaseIndex(payload.getDatabaseIndex() != null ? payload.getDatabaseIndex() : 0);
        existing.setSsl(Boolean.TRUE.equals(payload.getSsl()));
        existing.setTimeoutMs(payload.getTimeoutMs() != null ? payload.getTimeoutMs() : 2000);
        existing.setActive(payload.getActive() == null || payload.getActive());

        RedisDatasourceModel updated = this.save(existing);

        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message("Redis datasource updated successfully")
                .data(toResponseDto(updated))
                .build();

        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> findByIdRest(UUID id) {
        log.info("Fetching Redis datasource by ID: {}", id);
        RedisDatasourceModel ds = this.findById(id);
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message("Redis datasource retrieved successfully")
                .data(toResponseDto(ds))
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> findAllRest() {
        log.info("Fetching all Redis datasources");
        List<RedisDatasourceResponseDto> result = this.findAll().stream()
                .map(this::toResponseDto)
                .collect(Collectors.toList());

        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message("Redis datasources list retrieved successfully")
                .data(result)
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> deleteRest(UUID id) {
        log.info("Deleting Redis datasource with ID: {}", id);
        this.delete(id);
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message("Redis datasource deleted successfully")
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> testConnectionRest(RedisDatasourceRequestDto payload) {
        log.info("Testing connection to Redis host {}:{}", payload.getHost(), payload.getPort());
        RedisDatasourceStatus status = this.testConnection(payload);
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message(Boolean.TRUE.equals(status.getReachable())
                        ? "Redis connection successful"
                        : "Redis connection failed")
                .data(status)
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> getStatusRest(UUID id) {
        log.info("Getting real-time status for Redis datasource ID: {}", id);
        RedisDatasourceStatus status = this.getStatus(id);
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message("Redis datasource status retrieved")
                .data(status)
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> setKeyRest(UUID id, @Valid RedisKeyRequestDto payload) {
        log.info("Setting key '{}' in Redis datasource ID: {}", payload.getKey(), id);
        this.setKey(id, payload.getKey(), payload.getValue(), payload.getTtlSeconds());
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message("Redis key set successfully")
                .data(Map.of("key", payload.getKey(), "value", payload.getValue() != null ? payload.getValue() : ""))
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> getKeyRest(UUID id, String key) {
        log.info("Getting key '{}' from Redis datasource ID: {}", key, id);
        String value = this.getKey(id, key);
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message(value != null ? "Redis key retrieved successfully" : "Redis key does not exist")
                .data(Map.of("key", key, "value", value != null ? value : "", "exists", value != null))
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> deleteKeyRest(UUID id, String key) {
        log.info("Deleting key '{}' from Redis datasource ID: {}", key, id);
        Boolean deleted = this.deleteKey(id, key);
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message(Boolean.TRUE.equals(deleted)
                        ? "Redis key deleted successfully"
                        : "Redis key was not found or already deleted")
                .data(Map.of("key", key, "deleted", Boolean.TRUE.equals(deleted)))
                .build();
        return ResponseEntity.ok(body);
    }

    public ResponseEntity<AppResponse> executeCommandRest(UUID id, @Valid RedisCommandRequestDto payload) {
        log.info("Executing Redis action '{}' on datasource ID: {}", payload.getAction(), id);
        RedisCommandResponseDto result = this.executeCommand(id, payload);
        AppResponse body = AppResponse.builder()
                .status(HttpStatus.OK)
                .message("Redis action '" + result.getAction() + "' executed successfully")
                .data(result)
                .build();
        return ResponseEntity.ok(body);
    }

    private RedisDatasourceModel toModel(RedisDatasourceRequestDto dto) {
        return RedisDatasourceModel.builder()
                .name(dto.getName())
                .host(dto.getHost())
                .port(dto.getPort() != null ? dto.getPort() : 6379)
                .username(dto.getUsername())
                .password(dto.getPassword())
                .databaseIndex(dto.getDatabaseIndex() != null ? dto.getDatabaseIndex() : 0)
                .ssl(Boolean.TRUE.equals(dto.getSsl()))
                .timeoutMs(dto.getTimeoutMs() != null ? dto.getTimeoutMs() : 2000)
                .active(dto.getActive() == null || dto.getActive())
                .createdAt(Instant.now())
                .build();
    }

    public RedisDatasourceResponseDto toResponseDto(RedisDatasourceModel ds) {
        return RedisDatasourceResponseDto.fromModel(ds);
    }

    private RedisDatasourceRequestDto toRequestDto(RedisDatasourceModel ds) {
        return RedisDatasourceRequestDto.builder()
                .name(ds.getName())
                .host(ds.getHost())
                .port(ds.getPort())
                .username(ds.getUsername())
                .password(ds.getPassword())
                .databaseIndex(ds.getDatabaseIndex())
                .ssl(ds.getSsl())
                .timeoutMs(ds.getTimeoutMs())
                .active(ds.getActive())
                .build();
    }
}
