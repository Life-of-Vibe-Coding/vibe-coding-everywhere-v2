import { describe, expect, it } from "vitest";
import { formatPrice } from "./formatPrice";

describe("formatPrice", () => {
  it("formats cents to currency", () => {
    const result = formatPrice(1299);
    expect(result).toBe("$12.99");
  });

  it("handles zero", () => {
    const result = formatPrice(0);
    expect(result).toBe("$0.00");
  });

  it("throws on negative values", () => {
    expect(() => formatPrice(-1)).toThrow("non-negative");
  });
});
