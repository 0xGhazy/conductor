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
package com.vodafone.vss.weaver.dao;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.common.scripting.ScriptModel;

public interface ScriptDAO {

    ScriptModel create(ScriptModel script);

    ScriptModel update(ScriptModel script);

    Optional<ScriptModel> findById(UUID id);

    Optional<ScriptModel> findByName(String name);

    boolean existsByName(String name);

    boolean existsById(UUID id);

    List<ScriptModel> findAll();

    PageResult<ScriptModel> search(
            String search, int page, int size, String sortBy, String sortOrder);

    boolean deleteById(UUID id);

    int deleteByIds(List<UUID> ids);
}

