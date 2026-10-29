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
package com.vodafone.vss.weaver.common;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AES-GCM encryption component for securing sensitive credentials like database passwords.
 */
@Component
public class Encryption {

    private static final String DEFAULT_DEV_KEY = "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY="; // 32-byte fallback
    private static final String ALG = "AES";
    private static final String TRANS = "AES/GCM/NoPadding";
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;
    private final SecretKey key;
    private final SecureRandom rnd = new SecureRandom();

    public Encryption(
            @Value("${security.crypto.key-b64:" + DEFAULT_DEV_KEY + "}") String base64) {
        if (base64 == null || base64.isBlank()) {
            base64 = DEFAULT_DEV_KEY;
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid base64 for encryption key", ex);
        }
        int n = raw.length;
        if (n != 16 && n != 24 && n != 32) {
            throw new IllegalArgumentException("Invalid AES key length: " + n + " bytes");
        }
        this.key = new SecretKeySpec(raw, ALG);

        // Startup self-test to validate encryption/decryption with active key
        String probe = "encryption-self-test";
        String enc = enc(probe);
        String dec = dec(enc);
        if (!probe.equals(dec)) {
            throw new IllegalStateException("Encryption self-test failed");
        }
    }

    public SecretKey key() {
        return key;
    }

    public String enc(String plain) {
        if (plain == null) return null;
        byte[] iv = new byte[IV_LEN];
        rnd.nextBytes(iv);
        try {
            Cipher c = Cipher.getInstance(TRANS);
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("encrypt failed", e);
        }
    }

    public String dec(String encoded) {
        if (encoded == null) return null;
        byte[] in;
        try {
            in = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid encrypted payload base64", ex);
        }
        if (in.length < IV_LEN) {
            throw new IllegalArgumentException("Encrypted payload too short");
        }
        byte[] iv = Arrays.copyOfRange(in, 0, IV_LEN);
        byte[] ct = Arrays.copyOfRange(in, IV_LEN, in.length);
        try {
            Cipher c = Cipher.getInstance(TRANS);
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] pt = c.doFinal(ct);
            return new String(pt, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("decrypt failed", e);
        }
    }

    public record Encrypted(byte[] iv, byte[] ciphertext) {}

    public Encrypted encRaw(String plain) {
        if (plain == null) return null;
        byte[] iv = new byte[IV_LEN];
        rnd.nextBytes(iv);
        try {
            Cipher c = Cipher.getInstance(TRANS);
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            return new Encrypted(iv, c.doFinal(plain.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("encrypt failed", e);
        }
    }

    public String decRaw(byte[] iv, byte[] ciphertext) {
        if (iv == null || ciphertext == null) return null;
        try {
            Cipher c = Cipher.getInstance(TRANS);
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            return new String(c.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("decrypt failed", e);
        }
    }
}

