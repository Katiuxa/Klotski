"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const dist = path.join(ROOT, "dist");
const zip = path.join(ROOT, "huarongdao-netlify.zip");

if (fs.existsSync(zip)) fs.unlinkSync(zip);
const r = spawnSync("tar", ["-a", "-c", "-f", zip, "*"], { cwd: dist, stdio: "inherit", shell: true });
if (r.status) process.exit(r.status || 1);
console.log("zip:", zip);
