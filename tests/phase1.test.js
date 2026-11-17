/* Phase 1 self-checks. Loaded by tests/harness/server.js; run `await runTests()` in the page console.
   Each test uses its own topic ids and writes through the stub db, so they can run in any order. */
async function runTests(){
  const out = [];
  const ok = (name, cond, detail) => out.push({name, pass: !!cond, detail: cond ? undefined : detail});
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const run = async (name, fn) => { try{ await fn(); }catch(e){ ok(name + " (threw)", false, String(e && e.stack || e)); } };

  /* ---- Task 1: KC data layer ---- */
  await run("syncKcs", async () => {
    await saveTopic("tT", {title:"T", status:"active", plan:[{id:"p1",title:"A",status:"done"},{id:"p2",title:"B",status:"doing"},{id:"p3",title:"C",status:"todo"}]});
    await wait(80);
    await syncKcs("tT"); await wait(120);
    const k = id => S.kcs[kcId("tT", id)];
    ok("creates one KC per step", Object.keys(S.kcs).filter(x => x.startsWith("tT-")).length === 3);
    ok("done step is learned and due today", k("p1") && k("p1").s > 0 && Date.parse(k("p1").due) <= Date.now(), JSON.stringify(k("p1")));
    ok("doing/todo steps are new", k("p2") && k("p3") && !k("p2").s && !k("p3").s);
    ok("prerequisite is the previous step", JSON.stringify(k("p2").prereqs) === JSON.stringify([kcId("tT","p1")]) && k("p1").prereqs.length === 0);
    const snap = JSON.stringify(S.kcs); await syncKcs("tT"); await wait(120);
    ok("second run changes nothing", JSON.stringify(S.kcs) === snap);
    await saveTopic("tT", {plan:[{id:"p1",title:"A2",status:"done"},{id:"p2",title:"B",status:"done"},{id:"p3",title:"C",status:"todo"}]}); await wait(80);
    const s1 = k("p1").s; await syncKcs("tT"); await wait(120);
    ok("title updates, state kept; a step turning done does not reset it", k("p1").title === "A2" && k("p1").s === s1 && !k("p2").s);
    await saveTopic("tN", {title:"N", status:"active"}); await wait(60);
    await syncKcs("tN");
    ok("topic without a plan makes no KCs", !Object.keys(S.kcs).some(x => x.startsWith("tN-")));
    await saveTopic("tT", {plan:[{id:"p2",title:"B",status:"done"},{id:"p3",title:"C",status:"todo"}]}); await wait(80);
    ok("KC of a removed step is never due", !kcsDue(Date.now() + 9e9).some(([id]) => id === kcId("tT","p1")));
  });

  /* ---- Task 2: review log, grading, target retention ---- */
  const revlogs = () => Object.entries(window.__stub.store).filter(([k]) => k.startsWith("revlog/")).map(([, v]) => v);
  await run("intervalDays", async () => {
    ok("90% retention keeps interval = stability", Math.abs(intervalDays(10, 0.9) - 10) < 1e-9, intervalDays(10, 0.9));
    ok("higher retention shortens, lower lengthens", intervalDays(10, 0.95) < 10 && intervalDays(10, 0.8) > 10);
  });
  await run("gradeFor", async () => {
    ok("maps wrong/partial/right", gradeFor("wrong") === 1 && gradeFor("partial") === 2 && gradeFor("right") === 3);
    ok("right + sure + fast is Easy; sure alone is not", gradeFor("right", true, true) === 4 && gradeFor("right", true, false) === 3 && gradeFor("right", false, true) === 3);
    ok("none or junk grades nothing", gradeFor("none") === null && gradeFor(undefined) === null);
  });
  await run("gradeKc + revlog", async () => {
    await saveTopic("tG", {title:"G", status:"active", plan:[{id:"p1",title:"A",status:"todo"},{id:"p2",title:"B",status:"done"}]}); await wait(80);
    await syncKcs("tG"); await wait(120);
    const n0 = revlogs().length;
    gradeKc("tG", "p1", 3, 5000, "sure"); await wait(150);
    const k = S.kcs[kcId("tG", "p1")];
    ok("first Good starts FSRS state and schedules ahead", k.s > 0 && Date.parse(k.due) > Date.now(), JSON.stringify(k));
    const r = revlogs().filter(x => x.itemId === kcId("tG", "p1"));
    ok("one revlog doc with the fields", r.length === 1 && r[0].itemType === "kc" && r[0].grade === 3 && r[0].ms === 5000 && r[0].confidence === "sure" && r[0].topicId === "tG", JSON.stringify(r));
    gradeKc("tG", "nope", 3, 0, ""); await wait(100);
    ok("unknown step is ignored", revlogs().length === n0 + 1 && !S.kcs[kcId("tG", "nope")]);
  });
  await run("gradeFromControl", async () => {
    const t0 = Date.now() - 60000, T = (r, text, ms) => ({r, text, at: new Date(t0 + ms).toISOString()});
    const sessFast = {topicId:"tG", turns:[T("t","q",0), T("l","My answer: x (confidence: sure)",5000), T("t","next",5500)]};
    const sessSlow = {topicId:"tG", turns:[T("t","q",0), T("l","My answer: x (confidence: sure)",45000), T("t","next",45500)]};
    const before = revlogs().filter(x => x.itemId === kcId("tG","p2")).length;
    gradeFromControl(sessFast, {grade:{result:"right", kc:"p2"}}); await wait(120);
    gradeFromControl(sessSlow, {grade:{result:"right", kc:"p2"}}); await wait(120);
    gradeFromControl(sessFast, {grade:{result:"wrong", kc:"p2"}}); await wait(120);
    gradeFromControl(sessFast, {grade:{result:"none", kc:"p2"}}); gradeFromControl(sessFast, {grade:{result:"right"}}); gradeFromControl(sessFast, {grade:{result:"right", kc:"zzz"}}); await wait(120);
    const g = revlogs().filter(x => x.itemId === kcId("tG","p2")).sort((a, b) => a.at < b.at ? -1 : 1).map(x => x.grade);
    ok("fast+sure right=4, slow right=3, wrong=1, none/no-kc/unknown ignored", JSON.stringify(g.slice(before)) === "[4,3,1]", JSON.stringify(g));
  });
  await run("card review writes a revlog doc", async () => {
    const n = revlogs().length; logRevlog("card", "c1", "tA", 3, 1200, ""); await wait(120);
    ok("card revlog", revlogs().length === n + 1 && revlogs().some(x => x.itemType === "card" && x.itemId === "c1" && x.grade === 3));
  });

  /* ---- Task 3: today's plan (pure; reads S, so swap in synthetic state and restore it) ---- */
  await run("buildPlan", async () => {
    const keep = {t: S.topics, c: S.cards, k: S.kcs}, now = Date.now(), past = new Date(now - 3600000).toISOString(), future = new Date(now + 9 * 86400000).toISOString();
    const steps = (n, status) => Array.from({length: n}, (_, i) => ({id: "p" + (i + 1), title: "Step " + (i + 1), status: status || "done"}));
    const kcsFor = (tid, n, due) => Object.fromEntries(Array.from({length: n}, (_, i) => [kcId(tid, "p" + (i + 1)), {topicId: tid, stepId: "p" + (i + 1), title: "Step " + (i + 1), s: 3, d: 5, last: past, due, prereqs: i ? [kcId(tid, "p" + i)] : []}]));
    try{
      // 15 min, 40 due cards, 10 due skills: cards take 10 min, 3 skills fit in the rest, no room to learn
      S.topics = {A: {title: "A", status: "active", plan: steps(10)}};
      S.cards = Object.fromEntries(Array.from({length: 40}, (_, i) => ["c" + i, {topicId: "A", front: "f", back: "b"}]));
      S.kcs = kcsFor("A", 10, past);
      let p = buildPlan(now, 15);
      ok("15 min: 20 cards, 3 skills, nothing new", p.cards === 20 && p.practice.length === 1 && p.practice[0].stepIds.length === 3 && p.learn.length === 0, JSON.stringify(p));
      p = buildPlan(now, 10);
      ok("10 min (Sunday): 20 cards fill it", p.cards === 20 && p.practice.length === 0 && p.learn.length === 0, JSON.stringify(p));
      // 40 min, nothing due, three topics with a next step: cap of 2 new steps per day
      S.cards = {}; S.kcs = {};
      S.topics = {A: {title: "A", status: "active", plan: steps(2, "todo")}, B: {title: "B", status: "active", plan: steps(2, "todo")}, C: {title: "C", status: "active", plan: steps(2, "todo")}};
      p = buildPlan(now, 40);
      ok("at most 2 new steps", p.learn.length === 2 && p.cards === 0 && p.practice.length === 0, JSON.stringify(p));
      // prerequisite due today blocks the next step; the due skill goes to practice instead
      S.topics = {B: {title: "B", status: "active", plan: [{id: "p1", title: "One", status: "done"}, {id: "p2", title: "Two", status: "todo"}]}};
      S.kcs = kcsFor("B", 2, past); S.kcs["B-p2"].s = undefined;
      p = buildPlan(now, 40);
      ok("prerequisite due today blocks the new step", p.learn.length === 0 && p.practice.length === 1 && p.practice[0].stepIds[0] === "p1", JSON.stringify(p));
      S.kcs = kcsFor("B", 2, future); S.kcs["B-p2"].s = undefined;
      p = buildPlan(now, 40);
      ok("prerequisite due later allows it", p.learn.length === 1 && p.learn[0].stepId === "p2" && p.practice.length === 0, JSON.stringify(p));
      // no plan yet, paused topics and removed steps
      S.kcs = {}; S.topics = {N: {title: "New", status: "active"}, P: {title: "P", status: "paused", plan: steps(2, "todo")}};
      p = buildPlan(now, 40);
      ok("no plan -> Start item; paused topic ignored", p.learn.length === 1 && p.learn[0].topicId === "N" && p.learn[0].stepId === null, JSON.stringify(p));
      S.topics = {}; S.cards = {}; S.kcs = {};
      p = buildPlan(now, 40);
      ok("empty state is an empty plan", p.cards === 0 && !p.practice.length && !p.learn.length);
    } finally { S.topics = keep.t; S.cards = keep.c; S.kcs = keep.k; }
  });

  const fail = out.filter(o => !o.pass);
  return {passed: out.length - fail.length, failed: fail.length, failures: fail, all: out.map(o => (o.pass ? "ok   " : "FAIL ") + o.name)};
}
