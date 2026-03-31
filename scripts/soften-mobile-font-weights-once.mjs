/**
 * One-shot: lower React Native fontWeight literals (600→500, 700→600, 800→700).
 * Order matters: replace from lightest threshold first.
 */
import fs from "fs";
import path from "path";

function walk(dir, acc = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.name === "node_modules" || e.name === ".expo" || e.name === "dist") continue;
        if (e.isDirectory()) walk(p, acc);
        else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p);
    }
    return acc;
}

const root = path.join(process.cwd(), "mobile");
let n = 0;
for (const f of walk(root)) {
    let s = fs.readFileSync(f, "utf8");
    const orig = s;
    s = s.replace(/fontWeight:\s*"600"/g, 'fontWeight: "__W6__"');
    s = s.replace(/fontWeight:\s*'600'/g, "fontWeight: '__W6__'");
    s = s.replace(/fontWeight:\s*"700"/g, 'fontWeight: "__W7__"');
    s = s.replace(/fontWeight:\s*'700'/g, "fontWeight: '__W7__'");
    s = s.replace(/fontWeight:\s*"800"/g, 'fontWeight: "__W8__"');
    s = s.replace(/fontWeight:\s*'800'/g, "fontWeight: '__W8__'");
    s = s.replace(/__W6__/g, "500");
    s = s.replace(/__W7__/g, "600");
    s = s.replace(/__W8__/g, "700");
    if (s !== orig) {
        fs.writeFileSync(f, s);
        n++;
    }
}
console.log("soften-mobile-font-weights-once:", n, "files");
