/*
 * Copyright 2023 Conductor authors
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.test.base

import com.vodafone.vss.weaver.WeaverTestApp
import com.vodafone.vss.weaver.service.WorkflowService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.TestPropertySource

import com.vodafone.vss.weaver.core.execution.AsyncSystemTaskExecutor
import com.vodafone.vss.weaver.core.execution.WorkflowExecutor
import com.vodafone.vss.weaver.service.ExecutionService
import com.vodafone.vss.weaver.service.MetadataService
import com.vodafone.vss.weaver.test.util.WorkflowTestUtil
import com.vodafone.vss.weaver.core.execution.WorkflowSweeper
import org.testcontainers.containers.GenericContainer
import org.testcontainers.utility.DockerImageName
import spock.lang.Specification

@SpringBootTest(classes = WeaverTestApp.class)
@TestPropertySource(locations = "classpath:application-integrationtest.properties",properties = [
        "weaver.db.type=redis_standalone",
        "weaver.app.sweeperThreadCount=1",
        "weaver.app.sweeper.sweepBatchSize=10",
        "weaver.queue.type=redis_standalone"
])
abstract class AbstractSpecification extends Specification {

    private static redis

    static {
        redis = new GenericContainer<>(DockerImageName.parse("redis:6.2-alpine"))
                .withExposedPorts(6379)
        redis.start()
    }

    @Autowired
    ExecutionService workflowExecutionService

    @Autowired
    MetadataService metadataService

    @Autowired
    WorkflowExecutor workflowExecutor

    @Autowired
    WorkflowService workflowService

    @Autowired
    WorkflowTestUtil workflowTestUtil

    @Autowired
    AsyncSystemTaskExecutor asyncSystemTaskExecutor

    @DynamicPropertySource
    static void dynamicProperties(DynamicPropertyRegistry registry) {
        registry.add("weaver.db.type", () -> "redis_standalone")
        registry.add("weaver.redis.availability-zone", () -> "us-east-1c")
        registry.add("weaver.redis.data-center-region", () -> "us-east-1")
        registry.add("weaver.redis.workflow-namespace-prefix", () -> "integration-test")
        registry.add("weaver.redis.availability-zone", () -> "us-east-1c")
        registry.add("weaver.redis.queue-namespace-prefix", () -> "integtest");
        registry.add("weaver.redis.hosts", () -> "localhost:${redis.getFirstMappedPort()}:us-east-1c")
        registry.add("weaver.redis-lock.serverAddress", () -> String.format("redis://localhost:${redis.getFirstMappedPort()}"))
        registry.add("weaver.queue.type", () -> "redis_standalone")
        registry.add("weaver.db.type", () -> "redis_standalone")
    }

    def cleanup() {
        workflowTestUtil.clearWorkflows()
    }

    void sweep(String workflowId) {
        workflowExecutor.decide(workflowId)
    }
}
