---
globs: '["**/*opening*hours*", "**/*schedule*", "**/*time*parser*"]'
description: Ensures comprehensive OpenStreetMap opening_hours specification
  compliance for robust time schedule parsing
alwaysApply: false
---

When working with opening hours parsing, ensure comprehensive support for OpenStreetMap opening_hours specification including: 1) Basic day/time patterns (Mo-Fr 08:00-17:00), 2) Special cases (24/7, closed, unknown, off), 3) Holiday handling (PH, SH), 4) Date-specific exceptions (Jan 1 off, Dec 24 09:00-14:00), 5) Seasonal patterns (Apr-Oct), 6) Comments in quotes, 7) Single and double-digit hours (8:00 and 08:00), 8) Open-end times (08:00+), 9) Midnight times (24:00), 10) Time range variations, 11) Nth weekday patterns [1], 12) Year ranges, 13) Week ranges, 14) Astronomical times (sunrise/sunset), 15) Multiple rule separators (; , ||). Always add warnings/notes for complex patterns that require special handling and preserve original text for reference.
