package com.vodafone.vss.weaver.common.secrets;

/**
 * Builds preview for secret values.
 */
public final class SecretMasker {

    static final String STARS = "**********";
    static final int MIN_REVEAL_LENGTH = 10;
    private static final int EDGE = 2;

    private SecretMasker() {}

    public static String mask(String value) {
        if (value == null || value.length() < MIN_REVEAL_LENGTH) {
            return STARS;
        }
        return value.substring(0, EDGE) + STARS + value.substring(value.length() - EDGE);
    }
}

