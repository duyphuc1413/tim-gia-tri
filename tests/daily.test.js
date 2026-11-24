"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const Daily = require("../assets/js/daily-core.js");

describe("TimGiaTriDaily: 30-day prompts, streak & daily .ics reminder", () => {
  it("contains 30 daily prompts and personalizes placeholders with Top 5 and antis", () => {
    assert.equal(Daily.DAILY_PROMPTS.length, 30);
    const p = Daily.getDailyPrompt(
      new Date("2026-01-01T10:00:00"),
      ["Tự do", "Gia đình", "Chính trực"],
      ["Giả dối"]
    );
    assert.equal(p.cycleDay, 1);
    assert.equal(p.totalCycle, 30);
    assert.ok(p.question.includes("Tự do"));
    assert.ok(!p.question.includes("{top1}"));
  });

  it("computes current streak, longest streak, and 14-day history accurately", () => {
    const today = new Date("2026-11-24T20:00:00");
    const logs = [
      { dateKey: "2026-11-24" },
      { dateKey: "2026-11-23" },
      { dateKey: "2026-11-22" },
      { dateKey: "2026-11-15" },
      { dateKey: "2026-11-14" },
      { dateKey: "2026-11-13" },
      { dateKey: "2026-11-12" }
    ];
    const st = Daily.computeStreak(logs, today);
    assert.equal(st.doneToday, true);
    assert.equal(st.currentStreak, 3);
    assert.equal(st.longestStreak, 4);
    assert.equal(st.totalDays, 7);
    assert.equal(st.last14Days.length, 14);
    assert.equal(st.last14Days[13].isToday, true);
    assert.equal(st.last14Days[13].done, true);
  });

  it("generates a valid daily recurring RFC 5545 .ics calendar reminder", () => {
    const ics = Daily.buildDailyReminderIcs({
      hour: 20,
      minute: 30,
      topValues: ["Tự do", "Gia đình"],
      siteUrl: "https://duyphuc1413.github.io/tim-gia-tri",
      startDate: new Date("2026-11-24T10:00:00Z")
    });
    assert.ok(ics.includes("BEGIN:VCALENDAR"));
    assert.ok(ics.includes("RRULE:FREQ=DAILY"));
    assert.ok(ics.includes("T203000"));
    assert.ok(ics.includes("daily.html"));
    assert.ok(ics.includes("Tự do"));
  });
});
