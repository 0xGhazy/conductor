/*
 * Copyright 2026 Weaver Contributors.
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
package com.vodafone.vss.weaver.core.messages;

import java.util.Map;

/**
 * Source of translated workflow messages. Implemented by the translations module; {@code core}
 * only depends on this interface, so tasks such as TERMINATE can resolve messages without
 * depending on where translations are stored.
 */
public interface MessageCatalog {

    /**
     * The templates of one message in every language that has one, keyed by language code (e.g.
     * {@code en-US}). Empty when the message has no translations for this workflow version.
     */
    Map<String, String> findMessage(String workflowName, int workflowVersion, String messageCode);
}
