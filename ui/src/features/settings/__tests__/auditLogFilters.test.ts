import { describe, it, expect } from "vitest";
import {
  EMPTY_ADVANCED,
  activeFilterCount,
  customRangeError,
  parseAuditLogState,
  toApiFilters,
  toSearchParams,
  validateAdvanced,
} from "@/pages/Settings/auditLogFilters";

const parse = (query: string) => parseAuditLogState(new URLSearchParams(query));
const ANCHOR = Date.parse("2026-11-05T12:00:00.000Z");

describe("audit log filter state", () => {
  it("defaults to the last 24 hours, newest first, page 1 of 20", () => {
    const state = parse("");
    expect(state).toMatchObject({ range: "24h", sort: null, page: 0, size: 20, statuses: [] });
    expect(toSearchParams(state).toString()).toBe("");
    expect(toApiFilters(state, ANCHOR)).toMatchObject({
      from: "2026-11-04T12:00:00.000Z",
      to: "2026-11-05T12:00:00.000Z",
    });
  });

  it("round-trips through the URL, leaving defaults out", () => {
    const query =
      "search=order&range=7d&status=FAILED%2CSUCCESS&resourceType=QUERY&action=createQuery%2CupdateQuery" +
      "&actorId=u-1&actorLabel=Admin&clientIp=10.0.0.1&minDurationMs=5&sort=durationMs%2Casc&page=2&size=50";
    expect(toSearchParams(parse(query)).toString()).toBe(query);
  });

  it("ignores unknown ranges, sorts and page sizes from a hand-edited URL", () => {
    expect(parse("range=1y&sort=secret,asc&size=7&page=-1")).toMatchObject({
      range: "24h",
      sort: null,
      size: 20,
      page: 0,
    });
  });

  it("keeps custom from/to only for a custom range", () => {
    expect(parse("from=2026-01-01T00:00:00Z").from).toBe("");
    const custom = parse("range=custom&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z");
    expect(toApiFilters(custom, ANCHOR)).toMatchObject({ from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" });
  });

  it("maps the table's columns to the server's sort names", () => {
    expect(toApiFilters(parse("sort=resource,desc"), ANCHOR).sort).toBe("resourceType,desc");
  });

  it("validates exact identifiers and the duration range", () => {
    expect(validateAdvanced({ ...EMPTY_ADVANCED, eventId: "e-1" }).eventId).toBeDefined();
    expect(validateAdvanced({ ...EMPTY_ADVANCED, eventId: "6f1c2a7e-0d2b-4b8e-9c1a-0000000000a2" })).toEqual({});
    expect(validateAdvanced({ ...EMPTY_ADVANCED, clientIp: "300.1.1.1" }).clientIp).toBeDefined();
    expect(validateAdvanced({ ...EMPTY_ADVANCED, clientIp: "0:0:0:0:0:0:0:1" })).toEqual({});
    expect(validateAdvanced({ ...EMPTY_ADVANCED, minDurationMs: "-1" }).minDurationMs).toBeDefined();
    expect(validateAdvanced({ ...EMPTY_ADVANCED, minDurationMs: "10", maxDurationMs: "5" }).maxDurationMs).toBe(
      "Must be at least the minimum."
    );
    expect(validateAdvanced({ ...EMPTY_ADVANCED, minDurationMs: "5", maxDurationMs: "5" })).toEqual({});
  });

  it("checks a custom range", () => {
    expect(customRangeError("", "")).toBe("Choose a start and an end.");
    expect(customRangeError("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBe("The end must be after the start.");
    expect(customRangeError("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBeNull();
  });

  it("counts active filters, not the time range", () => {
    expect(activeFilterCount(parse("range=7d"))).toBe(0);
    expect(activeFilterCount(parse("status=FAILED&clientIp=10.0.0.1&search=x"))).toBe(3);
  });
});
