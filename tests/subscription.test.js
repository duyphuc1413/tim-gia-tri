"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const Core = require("../assets/js/data.js");
const Billing = require("../assets/js/billing-core.js");

async function loadShared(file) {
  const full = path.resolve(__dirname, "..", "supabase", "functions", "_shared", file);
  return import(pathToFileURL(full).href);
}

describe("PayOS signatures & server-side plans", () => {
  it("verifies official PayOS webhook test vector", async () => {
    const payos = await loadShared("payos.js");
    const checksumKey = "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675";
    const data = {
      orderCode: 123,
      amount: 3000,
      description: "VQRIO123",
      accountNumber: "12345678",
      reference: "TF230204212323",
      transactionDateTime: "2023-02-04 18:25:00",
      currency: "VND",
      paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
      code: "00",
      desc: "Thành công",
      counterAccountBankId: "",
      counterAccountBankName: "",
      counterAccountName: "",
      counterAccountNumber: "",
      virtualAccountName: "",
      virtualAccountNumber: ""
    };
    const officialSig = "412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03";

    assert.equal(await payos.verifyWebhookSignature(data, officialSig, checksumKey), true);
    assert.equal(
      await payos.verifyWebhookSignature({ ...data, amount: 99000 }, officialSig, checksumKey),
      false
    );
    assert.equal(await payos.verifyWebhookSignature(data, "deadbeef", checksumKey), false);
  });

  it("creates deterministic payment link signature and safe integer orderCode", async () => {
    const payos = await loadShared("payos.js");
    const sig1 = await payos.createPaymentSignature(
      {
        amount: 99000,
        cancelUrl: "https://example.com/cancel",
        description: "TGT PRO 1T",
        orderCode: 1700000000123,
        returnUrl: "https://example.com/return"
      },
      "secret-key"
    );
    const sig2 = await payos.createPaymentSignature(
      {
        amount: 99000,
        cancelUrl: "https://example.com/cancel",
        description: "TGT PRO 1T",
        orderCode: 1700000000123,
        returnUrl: "https://example.com/return"
      },
      "secret-key"
    );
    assert.equal(sig1.length, 64);
    assert.equal(sig1, sig2);

    const code = payos.generateOrderCode(1795000000000, 0.456);
    assert.equal(Number.isSafeInteger(code), true);
    assert.equal(code, 1795000000000456);
  });

  it("enforces fixed monthly/yearly server prices", async () => {
    const payos = await loadShared("payos.js");
    assert.equal(payos.getPlan("monthly").amount, 99000);
    assert.equal(payos.getPlan("yearly").amount, 790000);
    assert.equal(payos.getPlan("free"), null);
  });
});

describe("Vietnamese phone normalization (Zalo ZNS & Supabase Auth)", () => {
  it("normalizes valid VN mobile numbers", async () => {
    const phone = await loadShared("phone.js");
    assert.equal(phone.normalizeVnPhoneTo84("0901234567"), "84901234567");
    assert.equal(phone.normalizeVnPhoneTo84("+84 901-234-567"), "84901234567");
    assert.equal(phone.normalizeVnPhoneTo84("84381234567"), "84381234567");
    assert.equal(phone.normalizeVnPhoneToE164("0987654321"), "+84987654321");
    assert.equal(Billing.normalizeVnPhoneClient("0901 234 567"), "+84901234567");
  });

  it("rejects invalid or non-VN numbers", async () => {
    const phone = await loadShared("phone.js");
    assert.equal(phone.normalizeVnPhoneTo84("12345"), null);
    assert.equal(phone.normalizeVnPhoneTo84("+14155552671"), null);
    assert.equal(phone.normalizeVnPhoneTo84("0123456789"), null);
    assert.equal(Billing.normalizeVnPhoneClient("abc"), null);
  });
});

describe("Billing core & entitlement calculations", () => {
  it("formats VND and computes yearly savings", () => {
    assert.equal(Billing.formatVnd(99000), "99.000đ");
    assert.equal(Billing.formatVnd(790000), "790.000đ");
    assert.equal(Billing.yearlySavingsPercent(), 33);
  });

  it("computes trial, paid, expired, and anonymous states accurately", () => {
    const now = new Date("2026-11-24T00:00:00Z");

    const anon = Billing.computeEntitlement(null, now);
    assert.equal(anon.status, "anonymous");
    assert.equal(anon.isPro, false);

    const trial = Billing.computeEntitlement(
      { trial_ends_at: "2026-11-26T12:00:00Z", paid_until: null },
      now
    );
    assert.equal(trial.status, "trial");
    assert.equal(trial.isPro, true);
    assert.equal(trial.daysLeft, 3);

    const paid = Billing.computeEntitlement(
      { trial_ends_at: "2026-11-26T00:00:00Z", paid_until: "2026-12-24T00:00:00Z" },
      now
    );
    assert.equal(paid.status, "paid");
    assert.equal(paid.isPro, true);
    assert.equal(paid.daysLeft, 30);

    const expired = Billing.computeEntitlement(
      { trial_ends_at: "2026-11-20T00:00:00Z", paid_until: "2026-11-23T00:00:00Z" },
      now
    );
    assert.equal(expired.status, "expired");
    assert.equal(expired.isPro, false);
  });

  it("preserves sanitized extras.goals inside sanitizeSavedState", () => {
    const clean = Core.sanitizeSavedState({
      version: 2,
      selected: ["Gia đình", "Tự do"],
      extras: {
        goals: [
          {
            domain: "health",
            be: "Người khỏe mạnh",
            doText: "Đi bộ 30 phút",
            have: "Ngủ ngon",
            linkedValue: "Sức khỏe",
            reverseCheck: "Không ảnh hưởng gia đình"
          },
          null
        ]
      }
    });
    assert.equal(clean.extras.goals.length, 1);
    assert.equal(clean.extras.goals[0].domain, "health");
    assert.equal(clean.extras.goals[0].be, "Người khỏe mạnh");
  });
});
