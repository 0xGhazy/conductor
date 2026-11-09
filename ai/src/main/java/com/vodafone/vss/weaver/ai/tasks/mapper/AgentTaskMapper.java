/*
 * Copyright 2026 Conductor Authors.
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
package com.vodafone.vss.weaver.ai.tasks.mapper;

import com.vodafone.vss.weaver.ai.model.A2ACallRequest;
import com.vodafone.vss.weaver.ai.config.AIIntegrationEnabledCondition;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

/**
 * Task mapper for the {@code AGENT} task type.
 *
 * <p>Produces the SCHEDULED task (with retry defaults) that the {@code AGENT} {@link
 * com.vodafone.vss.weaver.ai.tasks.worker.A2AWorkers} worker then executes asynchronously.
 */
@Component
@Conditional(AIIntegrationEnabledCondition.class)
public class AgentTaskMapper extends AIModelTaskMapper<A2ACallRequest> {

    public static final String TASK_TYPE = "AGENT";

    public AgentTaskMapper() {
        super(TASK_TYPE);
    }
}
