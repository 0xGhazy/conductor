package com.vodafone.vss.weaver.common.secrets;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses {@code ${weaver.secrets.<name>}} placeholders.
 */
public final class SecretPlaceholderParser {

    public static final String NAME_REGEX = "[A-Za-z][A-Za-z0-9_-]{0,99}";
    public static final Pattern NAME_PATTERN = Pattern.compile("^" + NAME_REGEX + "$");
    public static final Pattern PLACEHOLDER_PATTERN =
            Pattern.compile("\\$\\{weaver\\.secrets\\.(" + NAME_REGEX + ")}");

    private static final String PREFIX = "${weaver.secrets.";
    private static final String SUFFIX = "}";

    private SecretPlaceholderParser() {}

    public static String placeholderFor(String name) {
        return PREFIX + name + SUFFIX;
    }

    public static String likePatternFor(String name) {
        String escaped =
                placeholderFor(name)
                        .replace("\\", "\\\\")
                        .replace("%", "\\%")
                        .replace("_", "\\_");
        return "%" + escaped + "%";
    }

    public static boolean containsPlaceholder(String input) {
        return input != null && PLACEHOLDER_PATTERN.matcher(input).find();
    }

    public static boolean isPlaceholderOnly(String input) {
        return input != null && PLACEHOLDER_PATTERN.matcher(input.trim()).matches();
    }

    public static Set<String> extractNames(String input) {
        Set<String> names = new LinkedHashSet<>();
        collect(input, names);
        return names;
    }

    public static Set<String> extractNames(Map<String, ?> input) {
        Set<String> names = new LinkedHashSet<>();
        collect(input, names);
        return names;
    }

    public static String replace(String input, Function<String, String> lookup) {
        if (input == null || !containsPlaceholder(input)) {
            return input;
        }
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(input);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            matcher.appendReplacement(
                    result, Matcher.quoteReplacement(lookup.apply(matcher.group(1))));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private static void collect(Object value, Set<String> names) {
        if (value instanceof String str) {
            Matcher matcher = PLACEHOLDER_PATTERN.matcher(str);
            while (matcher.find()) {
                names.add(matcher.group(1));
            }
        } else if (value instanceof Map<?, ?> map) {
            map.values().forEach(v -> collect(v, names));
        } else if (value instanceof Collection<?> collection) {
            collection.forEach(v -> collect(v, names));
        }
    }
}

