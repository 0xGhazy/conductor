class Validators {
    isEmpty(value) {
        if (value == null) {
            return true;
        }
        if (typeof value === "string" || Array.isArray(value)) {
            return value.length === 0;
        }
        if (value instanceof Map || value instanceof Set) {
            return value.size === 0;
        }
        try {
            if (value.isEmpty != null) {
                return Boolean(value.isEmpty());
            }
        } catch (error) {
        }
        try {
            if (typeof value.size === "function") {
                return value.size() === 0;
            }
            if (typeof value.size === "number") {
                return value.size === 0;
            }
        } catch (error) {
        }
        if (typeof value === "object") {
            return Object.keys(value).length === 0;
        }
        return false;
    }

    isNotEmpty(value) {
        return !this.isEmpty(value);
    }

    isNull(value) {
        return value == null;
    }

    isNotNull(value) {
        return value != null;
    }

    isBlank(value) {
        return value == null || String(value).trim() === "";
    }

    isNotBlank(value) {
        return !this.isBlank(value);
    }

    minLength(value, minimum) {
        return value != null && String(value).length >= minimum;
    }

    maxLength(value, maximum) {
        return value != null && String(value).length <= maximum;
    }

    lengthBetween(value, minimum, maximum) {
        if (value == null) {
            return false;
        }
        const length = String(value).length;
        return length >= minimum && length <= maximum;
    }

    matches(value, regex) {
        return value != null && new RegExp(regex).test(String(value));
    }

    notMatches(value, regex) {
        return !this.matches(value, regex);
    }

    equals(value, expected) {
        return value === expected;
    }

    notEquals(value, expected) {
        return !this.equals(value, expected);
    }

    inList(value, allowedValues) {
        if (allowedValues == null) {
            return false;
        }
        if (Array.isArray(allowedValues)) {
            return allowedValues.includes(value);
        }
        if (allowedValues instanceof Set) {
            return allowedValues.has(value);
        }
        if (typeof allowedValues.contains === "function") {
            return allowedValues.contains(value);
        }
        return false;
    }

    notInList(value, blockedValues) {
        return blockedValues == null || !this.inList(value, blockedValues);
    }

    isNumber(value) {
        if (value == null || value === "") {
            return false;
        }
        return Number.isFinite(Number(value));
    }

    isInteger(value) {
        if (typeof value === "boolean" || value == null || value === "") {
            return false;
        }
        return Number.isInteger(Number(value));
    }

    isPositive(value) {
        return this.isNumber(value) && Number(value) > 0;
    }

    isNegative(value) {
        return this.isNumber(value) && Number(value) < 0;
    }

    min(value, minValue) {
        return this.isNumber(value) && Number(value) >= minValue;
    }

    max(value, maxValue) {
        return this.isNumber(value) && Number(value) <= maxValue;
    }

    between(value, minValue, maxValue) {
        return this.isNumber(value) && Number(value) >= minValue && Number(value) <= maxValue;
    }

    greaterThan(value, target) {
        return this.isNumber(value) && Number(value) > target;
    }

    greaterThanOrEqual(value, target) {
        return this.isNumber(value) && Number(value) >= target;
    }

    lessThan(value, target) {
        return this.isNumber(value) && Number(value) < target;
    }

    lessThanOrEqual(value, target) {
        return this.isNumber(value) && Number(value) <= target;
    }

    isDate(value) {
        return this._parseDate(value) !== null;
    }

    before(value, dateValue) {
        const parsedValue = this._parseDate(value);
        const parsedDate = this._parseDate(dateValue);
        return parsedValue !== null && parsedDate !== null && parsedValue < parsedDate;
    }

    after(value, dateValue) {
        const parsedValue = this._parseDate(value);
        const parsedDate = this._parseDate(dateValue);
        return parsedValue !== null && parsedDate !== null && parsedValue > parsedDate;
    }

    betweenDates(value, startDate, endDate) {
        const parsedValue = this._parseDate(value);
        const parsedStart = this._parseDate(startDate);
        const parsedEnd = this._parseDate(endDate);
        return parsedValue !== null && parsedStart !== null && parsedEnd !== null
            && parsedValue >= parsedStart && parsedValue <= parsedEnd;
    }

    isPast(value) {
        const parsedValue = this._parseDate(value);
        return parsedValue !== null && parsedValue < new Date();
    }

    isFuture(value) {
        const parsedValue = this._parseDate(value);
        return parsedValue !== null && parsedValue > new Date();
    }

    isEmail(value) {
        return this.matches(value, "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    isPhone(value) {
        return this.matches(value, "^\\+?[0-9\\s\\-()]{7,20}$");
    }

    isUrl(value) {
        return this.matches(value, "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$");
    }

    isUuid(value) {
        return this.matches(value, "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    }

    isAlpha(value) {
        return this.matches(value, "^[A-Za-z]+$");
    }

    isNumeric(value) {
        return this.matches(value, "^[0-9]+$");
    }

    isAlphaNumeric(value) {
        return this.matches(value, "^[A-Za-z0-9]+$");
    }

    isJson(value) {
        if (value == null) {
            return false;
        }
        try {
            JSON.parse(String(value).trim());
            return true;
        } catch (error) {
            return false;
        }
    }

    _parseDate(value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value;
        }
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
}

globalThis.validators = new Validators();

