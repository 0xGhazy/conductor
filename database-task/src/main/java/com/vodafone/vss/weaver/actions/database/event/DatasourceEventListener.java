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
package com.vodafone.vss.weaver.actions.database.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.vodafone.vss.weaver.actions.database.service.DynamicDataSourceManager;

/**
 * Listens for {@link DatasourceChangedEvent} domain events.
 */
@Component
public class DatasourceEventListener {

    private static final Logger log = LoggerFactory.getLogger(DatasourceEventListener.class);

    private final DynamicDataSourceManager dynamicDataSourceManager;

    public DatasourceEventListener(DynamicDataSourceManager dynamicDataSourceManager) {
        this.dynamicDataSourceManager = dynamicDataSourceManager;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDatasourceChangedAfterCommit(DatasourceChangedEvent event) {
        log.info("Processing DatasourceChangedEvent after commit: id={}, version={}, action={}",
                event.id(), event.version(), event.action());
        if (event.action() == DatasourceChangedEvent.Action.DELETED) {
            dynamicDataSourceManager.invalidate(event.id());
        } else if (event.action() == DatasourceChangedEvent.Action.CHANGED) {
            dynamicDataSourceManager.onDatasourceChanged(event.id(), event.version());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void onDatasourceRollback(DatasourceChangedEvent event) {
        log.warn("Datasource transaction rolled back for id={}. Evicting any transient pool/cache state.", event.id());
        dynamicDataSourceManager.invalidate(event.id());
    }
}

