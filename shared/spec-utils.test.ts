import { describe, expect, it } from "vitest";

import {
  formatReferenceLabel,
  resolveNamedReference,
  shortReferenceId,
} from "./spec-utils.js";

describe("reference labels", () => {
  it("resolves a name while keeping its stable ID", () => {
    const items = [{ id: "product", title: "商品" }];

    expect(resolveNamedReference(items, "product")).toEqual({
      id: "product",
      title: "商品",
    });
  });

  it("shows a short ID and expands it when another ID shares its prefix", () => {
    expect(shortReferenceId("product-checkout")).toBe("product-…");
    expect(
      shortReferenceId("product-checkout", [
        "product-checkout",
        "product-catalog",
      ]),
    ).toBe("product-ch…");
    expect(
      shortReferenceId("product-catalog", [
        "product-checkout",
        "product-catalog",
      ]),
    ).toBe("product-ca…");
  });

  it("distinguishes same-name references with their IDs", () => {
    const ids = ["order-checkout", "order-catalog"];

    expect(formatReferenceLabel({ id: ids[0], title: "注文" }, ids)).toBe(
      "注文 (order-ch…)",
    );
    expect(formatReferenceLabel({ id: ids[1], title: "注文" }, ids)).toBe(
      "注文 (order-ca…)",
    );
  });

  it("marks unresolved references and retains their IDs", () => {
    const items = [{ id: "product", title: "商品" }];
    const reference = resolveNamedReference(items, "missing-product");

    expect(reference).toEqual({ id: "missing-product", title: undefined });
    expect(
      formatReferenceLabel(reference, ["product", "missing-product"]),
    ).toBe("未解決 (missing-…)");
  });
});
