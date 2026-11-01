package com.vodafone.vss.weaver.secrets.service;

import java.util.*;

import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.secrets.SecretException;
import com.vodafone.vss.weaver.common.secrets.SecretModel;
import com.vodafone.vss.weaver.common.secrets.SecretPlaceholderParser;
import com.vodafone.vss.weaver.dao.SecretDAO;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

/**
 * Replaces ${weaver.secrets.<name>} placeholders with decrypted secret values.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SecretResolver {

    private final SecretDAO secretDAO;
    private final Encryption encryption;

    public String resolve(String input) {
        Set<String> names = SecretPlaceholderParser.extractNames(input);
        if (names.isEmpty()) {
            return input;
        }
        Map<String, String> values = loadValues(names);
        return SecretPlaceholderParser.replace(input, values::get);
    }

    public Map<String, Object> resolve(Map<String, Object> input) {
        if (input == null) {
            return null;
        }
        Set<String> names = SecretPlaceholderParser.extractNames(input);
        if (names.isEmpty()) {
            return input;
        }
        Map<String, String> values = loadValues(names);
        @SuppressWarnings("unchecked")
        Map<String, Object> resolved = (Map<String, Object>) replaceDeep(input, values);
        return resolved;
    }

    public void assertExists(Collection<String> names) {
        if (names == null || names.isEmpty()) {
            return;
        }
        Set<String> found = new HashSet<>();
        secretDAO.findAllByNameIn(names).forEach(s -> found.add(s.getName()));
        List<String> missing = names.stream().filter(n -> !found.contains(n)).distinct().toList();
        if (!missing.isEmpty()) {
            throw SecretException.unknownReferences(missing);
        }
    }

    private Map<String, String> loadValues(Set<String> names) {
        Map<String, String> values = new HashMap<>();
        for (SecretModel secret : secretDAO.findAllByNameIn(names)) {
            values.put(
                    secret.getName(),
                    encryption.decRaw(secret.getIv(), secret.getEncryptedValue()));
        }
        List<String> missing = names.stream().filter(n -> !values.containsKey(n)).toList();
        if (!missing.isEmpty()) {
            log.error("Secret resolution failed - missing secrets {}", missing);
            throw SecretException.unknownReferences(missing);
        }
        log.debug("Resolved {} secret reference(s)", names.size());
        return values;
    }

    private static Object replaceDeep(Object value, Map<String, String> values) {
        if (value instanceof String str) {
            return SecretPlaceholderParser.replace(str, values::get);
        }
        if (value instanceof Map<?, ?> map) {
            Map<Object, Object> copy = new LinkedHashMap<>();
            map.forEach((k, v) -> copy.put(k, replaceDeep(v, values)));
            return copy;
        }
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>(list.size());
            list.forEach(v -> copy.add(replaceDeep(v, values)));
            return copy;
        }
        return value;
    }
}

