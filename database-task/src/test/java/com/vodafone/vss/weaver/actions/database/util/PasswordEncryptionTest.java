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

import java.security.SecureRandom;
import java.util.Base64;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.database.JdbcConnectionDetails;

import static org.junit.jupiter.api.Assertions.*;

class PasswordEncryptionTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    static Encryption testEncryption() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return new Encryption(Base64.getEncoder().encodeToString(key));
    }

    @BeforeAll
    static void configureKey() {
        PasswordEncryptionUtil.configure(testEncryption());
    }

    @Test
    @DisplayName("Encryption fails loudly when no key is configured (no built-in fallback key)")
    void encryptFailsWithoutConfiguredKey() {
        PasswordEncryptionUtil.configure(null);
        try {
            IllegalStateException ex =
                    assertThrows(
                            IllegalStateException.class,
                            () -> PasswordEncryptionUtil.encrypt("secret"));
            assertTrue(ex.getMessage().contains("security.crypto.key-b64"));
            // Legacy plaintext stays readable without a key
            assertEquals("legacy", PasswordEncryptionUtil.decrypt("legacy"));
        } finally {
            configureKey();
        }
    }

    @Test
    @DisplayName("A token encrypted with one key cannot be decrypted with another")
    void tokenIsBoundToKey() {
        String token = PasswordEncryptionUtil.encrypt("secret");
        PasswordEncryptionUtil.configure(testEncryption());
        try {
            assertThrows(IllegalStateException.class, () -> PasswordEncryptionUtil.decrypt(token));
        } finally {
            configureKey();
        }
    }

    @Test
    @DisplayName("PasswordEncryptionUtil encrypts plaintext into ENC(...) token and decrypts back")
    void encryptAndDecryptRoundTrip() {
        String plain = "MyP@ssw0rd!#123_with_special_chars-and-utf8-€";

        String encrypted = PasswordEncryptionUtil.encrypt(plain);
        assertNotNull(encrypted);
        assertTrue(encrypted.startsWith("ENC("));
        assertTrue(encrypted.endsWith(")"));
        assertNotEquals(plain, encrypted);

        String decrypted = PasswordEncryptionUtil.decrypt(encrypted);
        assertEquals(plain, decrypted);
    }

    @Test
    @DisplayName("PasswordEncryptionUtil produces random IV so ciphertexts differ for same plaintext")
    void randomIvProducesDifferentCiphertext() {
        String plain = "super-secret-password";
        String enc1 = PasswordEncryptionUtil.encrypt(plain);
        String enc2 = PasswordEncryptionUtil.encrypt(plain);

        assertNotEquals(enc1, enc2);
        assertEquals(plain, PasswordEncryptionUtil.decrypt(enc1));
        assertEquals(plain, PasswordEncryptionUtil.decrypt(enc2));
    }

    @Test
    @DisplayName("PasswordEncryptionUtil handles null, blank, and already-encrypted inputs gracefully")
    void handlesNullAndBlankGracefully() {
        assertNull(PasswordEncryptionUtil.encrypt(null));
        assertEquals("", PasswordEncryptionUtil.encrypt(""));
        assertEquals("   ", PasswordEncryptionUtil.encrypt("   "));

        assertNull(PasswordEncryptionUtil.decrypt(null));
        assertEquals("", PasswordEncryptionUtil.decrypt(""));

        String token = "ENC(dummytoken)";
        assertEquals(token, PasswordEncryptionUtil.encrypt(token)); // idempotent
    }

    @Test
    @DisplayName("PasswordEncryptionUtil transparently returns unencrypted legacy password on decrypt")
    void decryptHandlesLegacyPlaintext() {
        String legacyPlaintext = "unencrypted_legacy_password";
        String result = PasswordEncryptionUtil.decrypt(legacyPlaintext);
        assertEquals(legacyPlaintext, result);
    }

    @Test
    @DisplayName("Jackson serialization and deserialization works with JdbcConnectionDetails")
    void jacksonSerializationRoundTrip() throws Exception {
        String rawPassword = "DbMasterPassword!2026";
        JdbcConnectionDetails details =
                JdbcConnectionDetails.builder()
                        .url("jdbc:postgresql://postgres.internal:5432/weaver")
                        .username("weaver_user")
                        .password(rawPassword)
                        .maxPoolSize(10)
                        .build();

        String json = objectMapper.writeValueAsString(details);
        JdbcConnectionDetails restored = objectMapper.readValue(json, JdbcConnectionDetails.class);
        assertEquals(rawPassword, restored.getPassword());
        assertEquals("weaver_user", restored.getUsername());
        assertEquals(10, restored.getMaxPoolSize());
    }
}

