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
package com.vodafone.vss.weaver.tasks.redis;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceModel;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceNotFoundException;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceRequestDto;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceStatus;
import com.vodafone.vss.weaver.dao.RedisDatasourceDAO;
import com.vodafone.vss.weaver.tasks.redis.service.RedisService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisServiceTest {

    @Mock
    private RedisDatasourceDAO redisDatasourceDAO;

    private RedisService redisService;

    private final UUID datasourceId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        redisService = new RedisService(redisDatasourceDAO);
    }

    @Test
    void findById_returnsModelWhenFound() {
        RedisDatasourceModel model = RedisDatasourceModel.builder()
                .id(datasourceId)
                .name("test-redis")
                .host("localhost")
                .port(6379)
                .active(true)
                .build();

        when(redisDatasourceDAO.findById(datasourceId)).thenReturn(Optional.of(model));

        RedisDatasourceModel found = redisService.findById(datasourceId);
        assertNotNull(found);
        assertEquals("test-redis", found.getName());
    }

    @Test
    void findById_throwsNotFoundWhenMissing() {
        when(redisDatasourceDAO.findById(datasourceId)).thenReturn(Optional.empty());

        assertThrows(RedisDatasourceNotFoundException.class, () -> redisService.findById(datasourceId));
    }

    @Test
    void findAll_returnsAllDatasources() {
        RedisDatasourceModel model1 = RedisDatasourceModel.builder().id(UUID.randomUUID()).name("ds1").build();
        RedisDatasourceModel model2 = RedisDatasourceModel.builder().id(UUID.randomUUID()).name("ds2").build();

        when(redisDatasourceDAO.findAll()).thenReturn(List.of(model1, model2));

        List<RedisDatasourceModel> all = redisService.findAll();
        assertEquals(2, all.size());
    }

    @Test
    void testConnection_returnsReachableFalseWhenCannotConnect() {
        RedisDatasourceRequestDto req = RedisDatasourceRequestDto.builder()
                .name("invalid-redis")
                .host("invalid.host.nonexistent.local")
                .port(6379)
                .timeoutMs(500)
                .active(true)
                .build();

        RedisDatasourceStatus status = redisService.testConnection(req);
        assertNotNull(status);
        assertFalse(status.getReachable());
    }

    @Test
    void delete_removesDatasource() {
        RedisDatasourceModel model = RedisDatasourceModel.builder()
                .id(datasourceId)
                .name("ds-delete")
                .active(false)
                .build();

        when(redisDatasourceDAO.findById(datasourceId)).thenReturn(Optional.of(model));

        redisService.delete(datasourceId);

        verify(redisDatasourceDAO).deleteById(datasourceId);
    }
}
