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
package com.vodafone.vss.weaver.actions.database.util;

import com.vodafone.vss.weaver.common.Encryption;

/**
 * Encrypts datasource passwords at rest as {@code ENC(<base64 iv+ciphertext>)} tokens (AES-GCM).
 */
public final class PasswordEncryptionUtil {

    private static final String PREFIX = "ENC(";
    private static final String SUFFIX = ")";

    private static volatile Encryption encryption;

    private PasswordEncryptionUtil() {}

    public static void configure(Encryption configured) {
        encryption = configured;
    }

    public static String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank() || isEncrypted(plaintext)
                || isPlaceholder(plaintext)) {
            return plaintext;
        }
        return PREFIX + requireEncryption().enc(plaintext) + SUFFIX;
    }

    public static String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isBlank() || !isEncrypted(encryptedText)) {
            return encryptedText;
        }
        String token = encryptedText.substring(PREFIX.length(), encryptedText.length() - SUFFIX.length()).trim();
        try {
            return requireEncryption().dec(token);
        } catch (IllegalStateException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new IllegalStateException("Password decryption failed", e);
        }
    }

    public static boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX) && value.endsWith(SUFFIX);
    }

    public static boolean isPlaceholder(String value) {
        return value != null && ((value.startsWith("#{") && value.endsWith("}"))
                || (value.startsWith("${") && value.endsWith("}")));
    }

    private static Encryption requireEncryption() {
        Encryption current = encryption;
        if (current == null) {
            throw new IllegalStateException(
                    "Datasource password encryption is not configured: set security.crypto.key-b64");
        }
        return current;
    }
}
