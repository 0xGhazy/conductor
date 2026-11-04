/*
 * Copyright 2023 Conductor Authors.
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
package com.vodafone.vss.weaver.postgres.config;

import org.springframework.beans.factory.annotation.Value;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariConfig;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;

import javax.sql.DataSource;

import org.conductoross.conductor.postgres.dao.PostgresFileMetadataDAO;
import org.conductoross.conductor.postgres.dao.PostgresSkillMetadataDAO;
import org.conductoross.conductor.postgres.dao.PostgresSkillPackageDAO;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.retry.RetryContext;
import org.springframework.retry.backoff.NoBackOffPolicy;
import org.springframework.retry.policy.SimpleRetryPolicy;
import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.dao.QueueDAO;
import com.vodafone.vss.weaver.postgres.dao.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.*;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PostgresProperties.class)
@ConditionalOnProperty(name = "conductor.db.type", havingValue = "postgres")
// Import the DataSourceAutoConfiguration when postgres database is selected.
// By default, the datasource configuration is excluded in the main module.
@Import(DataSourceAutoConfiguration.class)
public class PostgresConfiguration {

    DataSource dataSource;

    private final PostgresProperties properties;

    public PostgresConfiguration(DataSource dataSource, PostgresProperties properties) {
        this.dataSource = dataSource;
        this.properties = properties;
    }

    @Bean(initMethod = "migrate")
    @PostConstruct
    public Flyway flywayForPrimaryDb() {
        FluentConfiguration config = Flyway.configure();

        var locations = new ArrayList<String>();
        locations.add("classpath:db/migration_postgres");

        if (properties.getExperimentalQueueNotify()) {
            locations.add("classpath:db/migration_postgres_notify");
        }

        if (properties.isApplyDataMigrations()) {
            locations.add("classpath:db/migration_postgres_data");
        }

        config.locations(locations.toArray(new String[0]));

        return config.configuration(Map.of("flyway.postgresql.transactional.lock", "false"))
                .schemas(properties.getSchema())
                .dataSource(dataSource)
                .outOfOrder(true)
                .baselineOnMigrate(true)
                // default baseline version 1 would skip V1 when the scheduler flyway
                // (same schema, own history table) migrates first
                .baselineVersion("0")
                .load();
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public PostgresMetadataDAO postgresMetadataDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper,
            PostgresProperties properties) {
        return new PostgresMetadataDAO(retryTemplate, objectMapper, dataSource, properties);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public PostgresExecutionDAO postgresExecutionDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper,
            QueueDAO queueDAO) {
        return new PostgresExecutionDAO(retryTemplate, objectMapper, dataSource, queueDAO);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public PostgresPollDataDAO postgresPollDataDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper,
            PostgresProperties properties) {
        return new PostgresPollDataDAO(retryTemplate, objectMapper, dataSource, properties);
    }

    /**
     * Only when queues are kept in Postgres. With a Redis queue type the Redis QueueDAO is used,
     * and this DAO would otherwise still run its background unack/flush jobs against the queue
     * tables.
     */
    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    @ConditionalOnProperty(name = "conductor.queue.type", havingValue = "postgres", matchIfMissing = true)
    public QueueDAO postgresQueueDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper,
            PostgresProperties properties) {
        return new PostgresQueueDAO(retryTemplate, objectMapper, dataSource, properties);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    @ConditionalOnProperty(name = "conductor.indexing.type", havingValue = "postgres")
    public PostgresIndexDAO postgresIndexDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper,
            PostgresProperties properties) {
        return new PostgresIndexDAO(retryTemplate, objectMapper, dataSource, properties);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    @ConditionalOnProperty(
            name = "conductor.workflow-execution-lock.type",
            havingValue = "postgres")
    public PostgresLockDAO postgresLockDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new PostgresLockDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    @ConditionalOnProperty(name = "conductor.file-storage.enabled", havingValue = "true")
    public PostgresFileMetadataDAO postgresFileMetadataDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new PostgresFileMetadataDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    @ConditionalOnProperty(name = "conductor.integrations.ai.enabled", havingValue = "true")
    public PostgresSkillMetadataDAO postgresSkillMetadataDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new PostgresSkillMetadataDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    @ConditionalOnProperty(name = "conductor.integrations.ai.enabled", havingValue = "true")
    public PostgresSkillPackageDAO postgresSkillPackageDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new PostgresSkillPackageDAO(retryTemplate, objectMapper, dataSource);
    }

    /** True when conductor.audit.user-lookup.url is set and not blank. */
    static final String USER_LOOKUP_ENABLED = "!'${conductor.audit.user-lookup.url:}'.isBlank()";

    /**
     * Reads users from Keycloak's own database (conductor.audit.user-lookup.*) to show who created
     * or updated a record. Uses a small read-only pool; when the URL is not set, users are not
     * resolved. The server starts even if that database is unreachable.
     */
    @Bean(destroyMethod = "close")
    @ConditionalOnExpression(USER_LOOKUP_ENABLED)
    public PostgresUserLookupDAO postgresUserLookupDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper,
            @Value("${conductor.audit.user-lookup.url}") String url,
            @Value("${conductor.audit.user-lookup.username:}") String username,
            @Value("${conductor.audit.user-lookup.password:}") String password,
            @Value("${conductor.audit.user-lookup.schema:public}") String schema) {
        HikariConfig config = new HikariConfig();
        config.setPoolName("keycloak-user-lookup");
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setSchema(schema);
        config.setReadOnly(true);
        config.setMinimumIdle(0);
        config.setMaximumPoolSize(2);
        config.setConnectionTimeout(3000);
        config.setInitializationFailTimeout(-1);
        return new PostgresUserLookupDAO(retryTemplate, objectMapper, new HikariDataSource(config));
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public PostgresAuditDAO postgresAuditDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new PostgresAuditDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public PostgresDatasourceDAO postgresDatasourceDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new PostgresDatasourceDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public PostgresQueryDAO postgresQueryDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new PostgresQueryDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public com.vodafone.vss.weaver.postgres.dao.PostgresHttpConnectionDAO postgresHttpConnectionDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new com.vodafone.vss.weaver.postgres.dao.PostgresHttpConnectionDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public com.vodafone.vss.weaver.postgres.dao.PostgresApiCollectionDAO postgresApiCollectionDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new com.vodafone.vss.weaver.postgres.dao.PostgresApiCollectionDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public com.vodafone.vss.weaver.postgres.dao.PostgresWorkflowTranslationDAO postgresWorkflowTranslationDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new com.vodafone.vss.weaver.postgres.dao.PostgresWorkflowTranslationDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public com.vodafone.vss.weaver.postgres.dao.PostgresRedisDatasourceDAO postgresRedisDatasourceDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new com.vodafone.vss.weaver.postgres.dao.PostgresRedisDatasourceDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public com.vodafone.vss.weaver.postgres.dao.PostgresScriptDAO postgresScriptDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new com.vodafone.vss.weaver.postgres.dao.PostgresScriptDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public com.vodafone.vss.weaver.postgres.dao.PostgresSecretDAO postgresSecretDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new com.vodafone.vss.weaver.postgres.dao.PostgresSecretDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    @DependsOn({"flywayForPrimaryDb"})
    public com.vodafone.vss.weaver.postgres.dao.PostgresSupportedLanguageDAO postgresSupportedLanguageDAO(
            @Qualifier("postgresRetryTemplate") RetryTemplate retryTemplate,
            ObjectMapper objectMapper) {
        return new com.vodafone.vss.weaver.postgres.dao.PostgresSupportedLanguageDAO(retryTemplate, objectMapper, dataSource);
    }

    @Bean
    public RetryTemplate postgresRetryTemplate(PostgresProperties properties) {
        SimpleRetryPolicy retryPolicy = new CustomRetryPolicy();
        retryPolicy.setMaxAttempts(3);

        RetryTemplate retryTemplate = new RetryTemplate();
        retryTemplate.setRetryPolicy(retryPolicy);
        retryTemplate.setBackOffPolicy(new NoBackOffPolicy());
        return retryTemplate;
    }

    public static class CustomRetryPolicy extends SimpleRetryPolicy {

        private static final String ER_LOCK_DEADLOCK = "40P01";
        private static final String ER_SERIALIZATION_FAILURE = "40001";

        @Override
        public boolean canRetry(final RetryContext context) {
            final Optional<Throwable> lastThrowable =
                    Optional.ofNullable(context.getLastThrowable());
            return lastThrowable
                    .map(throwable -> super.canRetry(context) && isDeadLockError(throwable))
                    .orElseGet(() -> super.canRetry(context));
        }

        private boolean isDeadLockError(Throwable throwable) {
            SQLException sqlException = findCauseSQLException(throwable);
            if (sqlException == null) {
                return false;
            }
            return ER_LOCK_DEADLOCK.equals(sqlException.getSQLState())
                    || ER_SERIALIZATION_FAILURE.equals(sqlException.getSQLState());
        }

        private SQLException findCauseSQLException(Throwable throwable) {
            Throwable causeException = throwable;
            while (null != causeException && !(causeException instanceof SQLException)) {
                causeException = causeException.getCause();
            }
            return (SQLException) causeException;
        }
    }
}
