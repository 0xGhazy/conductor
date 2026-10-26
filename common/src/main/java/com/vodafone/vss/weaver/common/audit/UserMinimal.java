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
package com.vodafone.vss.weaver.common.audit;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Minimal representation of an identity provider user for auditing and display.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserMinimal implements Serializable {

    private String id;
    private String username;
    private String name;
    private String email;

    public UserMinimal(String id, String username, String firstName, String lastName, String email) {
        this.id = id;
        this.username = username;
        this.email = email;
        String fn = firstName == null ? "" : firstName.trim();
        String ln = lastName == null ? "" : lastName.trim();
        String full = (fn + " " + ln).trim();
        if (full.isEmpty()) {
            full = username != null ? username.trim() : "";
        }
        this.name = full.isEmpty() ? null : full;
    }
}
