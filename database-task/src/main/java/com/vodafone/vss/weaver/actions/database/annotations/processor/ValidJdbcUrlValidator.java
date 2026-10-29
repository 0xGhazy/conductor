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
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.actions.database.annotations.ValidJdbcUrl;
import com.vodafone.vss.weaver.actions.database.dialect.DatabaseDialect;
import com.vodafone.vss.weaver.actions.database.dialect.DialectRegistry;
import com.vodafone.vss.weaver.common.VariableResolver;

@Component
public class ValidJdbcUrlValidator implements ConstraintValidator<ValidJdbcUrl, Object> {

    private final DialectRegistry dialectRegistry;
    private String typeField;
    private String urlField;

    public ValidJdbcUrlValidator() {
        this(DialectRegistry.getDefault());
    }

    @Autowired
    public ValidJdbcUrlValidator(DialectRegistry dialectRegistry) {
        this.dialectRegistry = dialectRegistry != null ? dialectRegistry : DialectRegistry.getDefault();
    }

    @Override
    public void initialize(ValidJdbcUrl constraintAnnotation) {
        this.typeField = constraintAnnotation.typeField();
        this.urlField = constraintAnnotation.urlField();
    }

    @Override
    public boolean isValid(Object target, ConstraintValidatorContext context) {
        if (target == null) {
            return true;
        }

        BeanWrapperImpl beanWrapper = new BeanWrapperImpl(target);
        Object typeObj = null;
        Object urlObj = null;

        try {
            if (beanWrapper.isReadableProperty(typeField)) {
                typeObj = beanWrapper.getPropertyValue(typeField);
            }
            if (beanWrapper.isReadableProperty(urlField)) {
                urlObj = beanWrapper.getPropertyValue(urlField);
            }
        } catch (Exception ex) {
            return true;
        }

        if (typeObj == null || urlObj == null) {
            // Let @NotNull / @NotBlank handle presence checks on individual fields
            return true;
        }

        String type = typeObj.toString().trim();
        String url = urlObj.toString().trim();

        if (type.isEmpty() || url.isEmpty()) {
            return true;
        }

        // The format can only be checked once placeholders are resolved; the connection probe covers that.
        if (url.contains("#{S:") || url.contains("#{P:") || url.contains("${")) {
            return true;
        }

        if (!dialectRegistry.supports(type)) {
            return true; // Let @SupportedDatabaseType handle invalid type
        }

        DatabaseDialect dialect = dialectRegistry.getDialect(type);
        if (!dialect.isValidUrl(url)) {
            context.disableDefaultConstraintViolation();
            String expectedFormat = dialect.urlFormatHint();
            String message = String.format("Invalid JDBC URL [%s] for engine '%s'. Expected format: %s", url, type, expectedFormat);

            context.buildConstraintViolationWithTemplate(message)
                    .addPropertyNode(urlField)
                    .addConstraintViolation();

            return false;
        }

        return true;
    }
}

