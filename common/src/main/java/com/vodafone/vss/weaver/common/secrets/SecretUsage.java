package com.vodafone.vss.weaver.common.secrets;

import java.util.UUID;

/**
 * A connection that references a secret, e.g. (DATASOURCE, id, "orders-db").
 */
public record SecretUsage(String type, UUID id, String name) {}

