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
package com.vodafone.vss.weaver.tasks.redis.controller;

import java.util.UUID;
import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.redis.RedisCommandRequestDto;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceRequestDto;
import com.vodafone.vss.weaver.common.redis.RedisKeyRequestDto;
import com.vodafone.vss.weaver.tasks.redis.service.RedisService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Validated
@RestController
@Tag(name = "Redis Instances Resource", description = "Managing Redis dynamic datasources")
@RequestMapping(value = "/api/redis", produces = MediaType.APPLICATION_JSON_VALUE)
public class RedisController {

    private static final Logger log = LoggerFactory.getLogger(RedisController.class);

    private final RedisService redisService;

    public RedisController(RedisService redisService) {
        this.redisService = redisService;
    }

    @PostMapping
    @Operation(summary = "Create Redis Datasource", description = "Registers a new Redis data source and initializes connection pool")
    public ResponseEntity<AppResponse> create(@Valid @RequestBody RedisDatasourceRequestDto payload) {
        log.info("Create Redis datasource request received: name={}", payload.getName());
        return redisService.createRest(payload);
    }

    @GetMapping
    @Operation(summary = "List Redis Instances", description = "Retrieves a list of all registered Redis instances")
    public ResponseEntity<AppResponse> findAll() {
        log.info("Fetching all Redis instances request received");
        return redisService.findAllRest();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get Redis Instance by ID", description = "Retrieves Redis instance details by ID")
    public ResponseEntity<AppResponse> findById(@PathVariable("id") UUID id) {
        log.info("Fetching Redis datasource by ID: {}", id);
        return redisService.findByIdRest(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update Redis Instance", description = "Updates an existing Redis instance configuration")
    public ResponseEntity<AppResponse> update(
            @PathVariable("id") UUID id, @Valid @RequestBody RedisDatasourceRequestDto payload) {
        log.info("Update Redis datasource request received for ID: {}", id);
        return redisService.updateRest(id, payload);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Redis Datasource", description = "Deletes a Redis data source and closes its connection pool")
    public ResponseEntity<AppResponse> delete(@PathVariable("id") UUID id) {
        log.info("Delete Redis datasource request received for ID: {}", id);
        return redisService.deleteRest(id);
    }

    @PostMapping("/test")
    @Operation(summary = "Test Redis Connection", description = "Tests connectivity to a Redis host via PING without saving")
    public ResponseEntity<AppResponse> testConnection(@Valid @RequestBody RedisDatasourceRequestDto payload) {
        log.info("Test Redis connection request received: host={}:{}", payload.getHost(), payload.getPort());
        return redisService.testConnectionRest(payload);
    }

    @GetMapping("/{id}/status")
    @Operation(summary = "Get Real-time Redis Status", description = "PINGS the registered Redis datasource to return latency and health status")
    public ResponseEntity<AppResponse> getStatus(@PathVariable("id") UUID id) {
        log.info("Get Redis datasource status request received for ID: {}", id);
        return redisService.getStatusRest(id);
    }

    @PostMapping("/{id}/keys")
    @Operation(summary = "Set Key Value in Redis Datasource", description = "Stores a String key-value pair in the specified Redis datasource")
    public ResponseEntity<AppResponse> setKey(
            @PathVariable("id") UUID id, @Valid @RequestBody RedisKeyRequestDto payload) {
        log.info("Set Redis key request received for DS ID: {}, key: {}", id, payload.getKey());
        return redisService.setKeyRest(id, payload);
    }

    @GetMapping("/{id}/keys/{key}")
    @Operation(summary = "Get Key Value from Redis Datasource", description = "Retrieves the value of a String key from the specified Redis datasource")
    public ResponseEntity<AppResponse> getKey(@PathVariable("id") UUID id, @PathVariable("key") String key) {
        log.info("Get Redis key request received for DS ID: {}, key: {}", id, key);
        return redisService.getKeyRest(id, key);
    }

    @DeleteMapping("/{id}/keys/{key}")
    @Operation(summary = "Delete Key from Redis Datasource", description = "Deletes a key from the specified Redis datasource")
    public ResponseEntity<AppResponse> deleteKey(@PathVariable("id") UUID id, @PathVariable("key") String key) {
        log.info("Delete Redis key request received for DS ID: {}, key: {}", id, key);
        return redisService.deleteKeyRest(id, key);
    }

    @PostMapping("/{id}/execute")
    @Operation(summary = "Execute Redis Action", description = "Executes a specified Redis command (SET, GET, DEL, EXISTS, EXPIRE, KEYS, HSET, HGET, HDEL, HGETALL, PING) on the Redis datasource")
    public ResponseEntity<AppResponse> executeCommand(
            @PathVariable("id") UUID id, @Valid @RequestBody RedisCommandRequestDto payload) {
        log.info("Execute Redis action '{}' request received for DS ID: {}", payload.getAction(), id);
        return redisService.executeCommandRest(id, payload);
    }
}

