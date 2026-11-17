# Lernpfad v2, Phase 1 (Skill layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, this session). Steps use checkbox syntax.

**Goal:** Today's plan comes from a scheduler over cards and skills (KCs), with no manual topic picking.

**Architecture:** One page (`index.html`). New `kcs` and `revlog` collections beside the existing ones. A KC reuses the card FSRS fields and the existing `schedule(c, g, now)`. A pure `buildPlan()` decides what Today shows. The tutor reports which plan step each graded answer tested.

**Tech Stack:** Single HTML file, vanilla JS, `db` capability. No new capabilities.

**Spec:** Claude Docs "Lernpfad v2 — System Architecture" (https://claude.ai/artifact/SMjejyFQB2VXodzRP5jQmP), Phase 1 (C1, C2, revlog from C7).

## Global Constraints
- "Scheduling and grading run in the page, so they cost no Claude usage."
- KCs use "the same FSRS-4.5 code" as cards.
- "Existing documents keep working; new fields are optional."
- Grade map: "wrong → Again, partial → Hard, right → Good, right + 'Sure' + fast → Easy."
- Daily budget 15 / 40 / 10 minutes (existing `dayPlan().minutes`).
- Migration: "done → solo stage, due today; doing → completion stage; todo → new."
- "Cap new KCs per day." Keep the artifact private (no new capabilities declared).
- My calls (not in the spec): KC id = `topicId + "-" + stepId`; prerequisite = previous plan step; fast = under 20 s; a card costs 0.5 min, a skill 1.5 min, a new step needs 5 min; caps 20 cards, 5 skills, 2 new steps; practice is per topic, not mixed across topics.

## Review Focus
1. Topic with no plan yet: Today shows a "Start" item, no crash, no KCs.
2. KC whose plan step no longer exists (tutor replaced the plan): ignored, never due.
3. Migration run twice, or from two devices: no duplicates, no state reset.
4. `grade.kc` naming an unknown step: ignored.
5. A failed write: `queueWrite` already toasts; plan and grading must not throw.

---

### Task 1: KC data layer
**Files:** Modify `index.html`; Create `tests/phase1.test.js`, `tests/harness/stub.js`, `tests/harness/server.js` (copied from scratch harness).
**Interfaces:** Produces `S.kcs`, `saveKc(id, kc)`, `kcId(topicId, stepId)`, `syncKcs(topicId)`, `kcsDue(now): Array<[id, kc]>`.
- [ ] Test `syncKcs` in `tests/phase1.test.js`: topic with plan done/doing/todo yields 3 KCs; done has `s` and `due <= now`; doing/todo have no `s`; each `prereqs` = previous step's id; running twice leaves docs unchanged; deleting a topic's KCs on topic delete.
- [ ] Run it, see it fail.
- [ ] Implement: `S.kcs` + `db.collection("kcs").onSnapshot`; `saveKc`; `syncKcs` (set only when missing, update `title` if changed); call after topics+kcs first load, after `applyControl` plan changes, and after `finishSession` saves a plan; cascade KC delete in `#tDel`; add `kcs` to backup dump and restore.
- [ ] Run test, see pass. Commit.

### Task 2: Review log and grading
**Interfaces:** Produces `logRevlog(itemType, itemId, topicId, g, ms, confidence)`, `gradeFor(result, sure, fast): 1|2|3|4|null`, `gradeKc(topicId, stepId, g, ms, confidence)`.
- [ ] Test: `gradeFor("wrong")===1`, partial 2, right 3, right+sure+fast 4, `"none"` null; `gradeKc` on a new KC initialises `s`/`d` and sets `due` in the future; unknown step does nothing; `logRevlog` writes one `revlog/{id}` doc.
- [ ] Implement `logRevlog` (called from the card rate handler and `gradeKc`), `gradeKc` via `schedule()`, and in `applyControl` read `ctl.grade.kc` (+ learner turn text for `confidence: sure`, time between the two turns for fast).
- [ ] Target retention (spec C2: 90% default, editable in Settings): `DEFAULT_SETTINGS.retention = 0.9`, a Settings field, and in `schedule()` interval days = `s / FACTOR * (r ** (1 / DECAY) - 1)` (equals `s` at 0.9, so current behaviour is unchanged by default). Test: `intervalDays(10, 0.9) === 10`, higher retention gives a shorter interval.
- [ ] Prompt: add `"kc"` to the `grade` object in the output format, one METHOD line, and for practice sessions a "Skills due" list built from `sess.kcIds`.
- [ ] Run test, pass. Commit.

### Task 3: Today plan
**Interfaces:** Consumes Task 1 and 2. Produces `buildPlan(now, budgetMin): {cards:number, practice:Array<{topicId, stepIds}>, learn:Array<{topicId, stepId|null, title}>}`.
- [ ] Test `buildPlan`: 15-min budget with 40 due cards and 10 due skills yields 20 cards, then skills that fit; new steps only when ≥5 min left, max 2; a step whose prerequisite is due today is skipped; topic without plan yields `stepId:null`; Sunday (10 min) yields a smaller plan.
- [ ] Implement `buildPlan` (pure, reads `S`), `viewToday` renders "Today's plan" (review link, one Practice button per topic, Learn buttons) in place of the "Continue" grid; `startSession(topicId, "practice", stepIds)` stores `kcIds`.
- [ ] Run test, pass. Commit.

### Task 4: Verify and ship
- [ ] Syntax check, impeccable detector, harness walk-through (Today at 375 px and desktop, a practice session grading a KC, a teach session, restore, delete topic).
- [ ] Merge to `main`, republish to the same artifact URL, push to `claude` repo.
