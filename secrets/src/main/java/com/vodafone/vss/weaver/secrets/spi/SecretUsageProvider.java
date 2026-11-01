package com.vodafone.vss.weaver.secrets.spi;

import java.util.List;

import com.vodafone.vss.weaver.common.secrets.SecretUsage;

/**
 * Implemented by modules that store ${weaver.secrets.<name>} references.
 */
public interface SecretUsageProvider {

    List<SecretUsage> findUsages(String secretName);

    default void onSecretValueChanged(String secretName) {}
}

