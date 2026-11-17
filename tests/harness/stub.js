// Stub of the artifact runtime (window.claude) for local testing of Lernpfad.
(function(){
  const now = Date.now(), DAY = 86400000, iso = t => new Date(t).toISOString();
  const store = {
    "lp/profile": {name:"Tester", updatedAt: iso(now)},
    "lp/settings": {vault:"Obsidian Vault", folder:"Learning", depth:"default", weekdayMin:15, weekendMin:40, mode:"system"},
    "topics/tA": {title:"German A2", why:"Move to Germany", fit:"any", status:"active", lastStudied: iso(now-DAY), level:"A2", plan:[{id:"p1",title:"Dativ",status:"done"},{id:"p2",title:"Perfekt",status:"doing"},{id:"p3",title:"Nebensätze",status:"todo"}], records:[], summaryMd:"## Why\nMove to Germany\n\n## Key ideas\n- **weil** sends the verb to the end.", nextUp:"Perfekt with sein"},
    "topics/tB": {title:"Inverse kinematics", why:"Robot arm", fit:"weekend", status:"active", plan:[], records:[], summaryMd:""},
    "cards/c1": {topicId:"tA", front:"weil or denn: which sends the verb to the end?", back:"**weil** — subordinating.", kind:"concept", type:"choose", createdAt: iso(now-3*DAY), due: iso(now-DAY), reps:0, lapses:0},
    "cards/c2": {topicId:"tA", front:"Fix: *Ich habe nach Berlin gefahren.*", back:"Ich **bin** nach Berlin gefahren — motion verbs take sein.", kind:"concept", type:"fix", createdAt: iso(now-3*DAY), due: iso(now-DAY), reps:0, lapses:0},
    "cards/c3": {topicId:"tB", front:"Why does a 2-link arm have two IK solutions?", back:"Elbow up / elbow down.", kind:"concept", type:"explain", createdAt: iso(now-3*DAY), due: iso(now-DAY), reps:0, lapses:0},
    "sessions/sB": {id:"sB", topicId:"tB", kind:"teach", startedAt: iso(now-3600000), updatedAt: iso(now-3600000), budgetMin:40, status:"open", turns:[{r:"t", text:"Let's start.", ctl:{phase:"teach", ask:{type:"short", prompt:"What is a joint angle?"}}, at: iso(now-3600000)}]},
  };
  const subs = []; // {kind:"doc"|"col", path, where, cb}
  const T = window.__stub = { failWrites:false, writes:[], store, sampleReplies:[] };
  const colDocs = (name, where) => Object.keys(store).filter(k => k.startsWith(name + "/") && k.split("/").length === 2)
    .map(k => ({id:k.split("/")[1], data:() => JSON.parse(JSON.stringify(store[k]))}))
    .filter(d => !where || d.data()[where[0]] === where[2]);
  const fire = () => subs.forEach(s => {
    if (s.kind === "doc") s.cb({exists: s.path in store, data:() => JSON.parse(JSON.stringify(store[s.path])), metadata:{fromCache:false}});
    else s.cb({docs: colDocs(s.path, s.where), metadata:{fromCache:false}});
  });
  const later = fn => setTimeout(fn, 30);
  const write = (path, fn) => new Promise((res, rej) => later(() => {
    T.writes.push(path);
    if (T.failWrites){ const e = new Error("offline"); e.code = "unavailable"; rej(e); return; }
    fn(); res(); fire();
  }));
  const db = {
    doc: path => ({
      onSnapshot(cb){ const s = {kind:"doc", path, cb}; subs.push(s); later(() => cb({exists: path in store, data:() => JSON.parse(JSON.stringify(store[path])), metadata:{fromCache:false}})); return () => subs.splice(subs.indexOf(s),1); },
      set: obj => write(path, () => { store[path] = JSON.parse(JSON.stringify(obj)); }),
      delete: () => write(path, () => { delete store[path]; }),
    }),
    collection: name => {
      const mk = where => ({
        where: (f, op, v) => mk([f, op, v]),
        onSnapshot(cb){ const s = {kind:"col", path:name, where, cb}; subs.push(s); later(() => cb({docs: colDocs(name, where), metadata:{fromCache:false}})); return () => subs.splice(subs.indexOf(s),1); },
      });
      return mk(null);
    },
  };
  const sample = async (msgs, opts) => {
    const r = T.sampleReplies.shift() || 'Here is a step.\n===CONTROL===\n{"phase":"teach","grade":{"result":"none","note":""},"ask":{"type":"mc","prompt":"Which pace suits you?","options":["Slow","Medium","Fast"],"correct":-1,"explain":""},"goal":null,"probe":null,"plan":null,"record":null,"speak":"Guten Tag","course":null}';
    if (opts && opts.onText) opts.onText({text:r});
    return {text:r};
  };
  sample.json = async () => ({summaryMd:"## Why\nTest", level:"A2", nextUp:"next", records:["did a thing"], cards:[], plan:null, resources:[]});
  const handlers = {};
  const dict = { onPartial:f => handlers.p = f, onFinal:f => handlers.f = f, onState:f => handlers.s = f,
    start: async () => { handlers.s && handlers.s({state:"listening"}); }, stop: async () => { handlers.s && handlers.s({state:"idle"}); } };
  const caps = { db, sample, downloads:{ save: async x => { T.lastDownload = x; } }, dictation: dict, tts:{ speak: async () => {} } };
  window.claude = { use: async n => { if (!(n in caps)) throw Object.assign(new Error("nope"), {code:"not_granted"}); return caps[n]; } };
})();
