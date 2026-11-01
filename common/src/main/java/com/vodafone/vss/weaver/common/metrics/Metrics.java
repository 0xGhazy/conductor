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
package com.vodafone.vss.weaver.common.metrics;

public enum Metrics {
    WORKFLOW_UPSERTION,
    WORKFLOW_UPSERTION_LATENCY,

    WORKFLOW_PARSING,

    WORKFLOW_EXECUTION,
    WORKFLOW_EXECUTION_LATENCY,

    HTTP_WORKER_REQUESTS,
    DATABASE_WORKER_REQUESTS,
    DATABASE_WORKER_LATENCY,
    SCRIPT_WORKER_REQUESTS,
    REDIS_WORKER_REQUESTS,
    RESPOND_WORKER_REQUESTS,
    VALIDATION_WORKER_REQUESTS,

    HTTP_WORKER_EXECUTION_DURATION,
    REDIS_WORKER_EXECUTION_DURATION,
    RESPOND_WORKER_EXECUTION_DURATION,

    SCRIPT_EXECUTION_REQUESTS,
    SCRIPT_EXECUTION_DURATION,
    SCRIPT_ENGINE_EVAL_DURATION,
    SCRIPT_EXECUTION_TIMEOUTS,
    SCRIPT_EXECUTION_IN_FLIGHT,
    SCRIPT_ENGINE_LOCK_WAIT_DURATION,
    SCRIPT_JEXL_EXECUTOR_ACTIVE_THREADS,
    SCRIPT_JEXL_EXECUTOR_POOL_SIZE,
    SCRIPT_JEXL_EXECUTOR_QUEUE_SIZE,
    SCRIPT_JEXL_EXECUTOR_REJECTED,
    SCRIPT_PAYLOAD_SIZE_BYTES,
    SCRIPT_VARIABLES_COUNT,
    SCRIPT_RESULT_SIZE_BYTES,
    SCRIPT_CRUD_REQUESTS,
    SCRIPT_CRUD_DURATION
}

