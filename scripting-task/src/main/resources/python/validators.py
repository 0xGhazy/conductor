import json
import math
import re
import uuid
from datetime import datetime, date, timezone
from urllib.parse import urlparse


class Validators:
    def isEmpty(self, value):
        if value is None:
            return True
        if isinstance(value, (str, list, tuple, set, dict)):
            return len(value) == 0
        return False

    def isNotEmpty(self, value):
        return not self.isEmpty(value)

    def isNull(self, value):
        return value is None

    def isNotNull(self, value):
        return value is not None

    def isBlank(self, value):
        return value is None or str(value).strip() == ""

    def isNotBlank(self, value):
        return not self.isBlank(value)

    def minLength(self, value, minimum):
        return value is not None and len(str(value)) >= minimum

    def maxLength(self, value, maximum):
        return value is not None and len(str(value)) <= maximum

    def lengthBetween(self, value, minimum, maximum):
        if value is None:
            return False
        length = len(str(value))
        return minimum <= length <= maximum

    def matches(self, value, regex):
        return value is not None and re.fullmatch(regex, str(value)) is not None

    def notMatches(self, value, regex):
        return not self.matches(value, regex)

    def equals(self, value, expected):
        return value == expected

    def notEquals(self, value, expected):
        return value != expected

    def inList(self, value, allowedValues):
        return allowedValues is not None and value in allowedValues

    def notInList(self, value, blockedValues):
        return blockedValues is None or value not in blockedValues

    def isNumber(self, value):
        try:
            number = float(value)
            return math.isfinite(number)
        except (TypeError, ValueError):
            return False

    def isInteger(self, value):
        if isinstance(value, bool):
            return False
        if isinstance(value, int):
            return True
        try:
            return float(value).is_integer()
        except (TypeError, ValueError):
            return False

    def isPositive(self, value):
        return self.isNumber(value) and float(value) > 0

    def isNegative(self, value):
        return self.isNumber(value) and float(value) < 0

    def min(self, value, minValue):
        return self.isNumber(value) and float(value) >= minValue

    def max(self, value, maxValue):
        return self.isNumber(value) and float(value) <= maxValue

    def between(self, value, minValue, maxValue):
        return self.isNumber(value) and minValue <= float(value) <= maxValue

    def greaterThan(self, value, target):
        return self.isNumber(value) and float(value) > target

    def greaterThanOrEqual(self, value, target):
        return self.isNumber(value) and float(value) >= target

    def lessThan(self, value, target):
        return self.isNumber(value) and float(value) < target

    def lessThanOrEqual(self, value, target):
        return self.isNumber(value) and float(value) <= target

    def isDate(self, value):
        return self._parseDate(value) is not None

    def before(self, value, dateValue):
        parsed_value = self._parseDate(value)
        parsed_date = self._parseDate(dateValue)
        return parsed_value is not None and parsed_date is not None and parsed_value < parsed_date

    def after(self, value, dateValue):
        parsed_value = self._parseDate(value)
        parsed_date = self._parseDate(dateValue)
        return parsed_value is not None and parsed_date is not None and parsed_value > parsed_date

    def betweenDates(self, value, startDate, endDate):
        parsed_value = self._parseDate(value)
        parsed_start = self._parseDate(startDate)
        parsed_end = self._parseDate(endDate)
        return (
            parsed_value is not None
            and parsed_start is not None
            and parsed_end is not None
            and parsed_start <= parsed_value <= parsed_end
        )

    def isPast(self, value):
        parsed_value = self._parseDate(value)
        return parsed_value is not None and parsed_value < datetime.now()

    def isFuture(self, value):
        parsed_value = self._parseDate(value)
        return parsed_value is not None and parsed_value > datetime.now()

    def isEmail(self, value):
        return self.matches(value, r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

    def isPhone(self, value):
        return self.matches(value, r"^\+?[0-9\s\-()]{7,20}$")

    def isUrl(self, value):
        if value is None:
            return False
        parsed = urlparse(str(value))
        return parsed.scheme.lower() in ("http", "https") and bool(parsed.netloc)

    def isUuid(self, value):
        if value is None:
            return False
        try:
            uuid.UUID(str(value))
            return True
        except ValueError:
            return False

    def isAlpha(self, value):
        return self.matches(value, r"^[A-Za-z]+$")

    def isNumeric(self, value):
        return self.matches(value, r"^[0-9]+$")

    def isAlphaNumeric(self, value):
        return self.matches(value, r"^[A-Za-z0-9]+$")

    def isJson(self, value):
        if value is None:
            return False
        try:
            json.loads(str(value).strip())
            return True
        except ValueError:
            return False

    def _parseDate(self, value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.replace(tzinfo=None)
        if isinstance(value, date):
            return datetime.combine(value, datetime.min.time())

        text = str(value)
        candidates = [text, text.replace("Z", "+00:00")]
        for candidate in candidates:
            try:
                parsed = datetime.fromisoformat(candidate)
                if parsed.tzinfo is not None:
                    parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
                return parsed
            except ValueError:
                pass

            try:
                return datetime.combine(date.fromisoformat(candidate), datetime.min.time())
            except ValueError:
                pass

        return None


validators = Validators()

