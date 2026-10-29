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
package com.vodafone.vss.weaver.actions.database.annotations.processor;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.actions.database.annotations.SupportedDatabaseType;
import com.vodafone.vss.weaver.actions.database.dialect.DialectRegistry;

@Component
public class SupportedDatabaseTypeValidator implements ConstraintValidator<SupportedDatabaseType, String> {

    private final DialectRegistry dialectRegistry;

    public SupportedDatabaseTypeValidator() {
        this(DialectRegistry.getDefault());
    }

    @Autowired
    public SupportedDatabaseTypeValidator(DialectRegistry dialectRegistry) {
        this.dialectRegistry = dialectRegistry != null ? dialectRegistry : DialectRegistry.getDefault();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true; // Let @NotNull handle empty checks
        }
        return dialectRegistry.supports(value);
    }
}

