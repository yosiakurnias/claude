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

  const fail = out.filter(o => !o.pass);
  return {passed: out.length - fail.length, failed: fail.length, failures: fail, all: out.map(o => (o.pass ? "ok   " : "FAIL ") + o.name)};
}
