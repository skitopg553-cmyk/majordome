// Lancer avec : node --experimental-strip-types src/lib/task-groups.test.ts
import assert from "node:assert/strict";
import { groupOf } from "./task-groups.ts";

const now = new Date("2026-10-15T20:00:00+02:00"); // jeudi 20 h à Paris

assert.equal(groupOf(null, now), "Sans date");
assert.equal(groupOf("2026-10-15T09:00:00+02:00", now), "En retard");
assert.equal(groupOf("2026-10-15T23:30:00+02:00", now), "Aujourd'hui");
assert.equal(groupOf("2026-10-16T00:30:00+02:00", now), "Demain"); // déjà demain à Paris, encore le 15 en UTC
assert.equal(groupOf("2026-10-16T22:00:00+02:00", now), "Demain");
assert.equal(groupOf("2026-10-17T09:00:00+02:00", now), "Plus tard");
// Passage à l'heure d'hiver (nuit du 24 au 25 octobre 2026)
assert.equal(groupOf("2026-10-25T09:00:00+01:00", new Date("2026-10-24T20:00:00+02:00")), "Demain");

console.log("task-groups : OK");
