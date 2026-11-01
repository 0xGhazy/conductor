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
package com.vodafone.vss.weaver.tasks.scripting.polyglot;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;

public final class PreparedContext {

    private final Context context;
    private final Value parseJson;
    private final Value reset;
    private int runs;

    public PreparedContext(Context context, Value parseJson, Value reset) {
        this.context = context;
        this.parseJson = parseJson;
        this.reset = reset;
    }

    public Context context() {
        return context;
    }

    public Value parseJson() {
        return parseJson;
    }

    public Value reset() {
        return reset;
    }

    public int countRun() {
        return ++runs;
    }
}

