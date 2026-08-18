import {createHash, sign} from "node:crypto";
import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const operation = String(process.env.OPERATION || "").trim();
const githubUserId = String(process.env.LICENSE_GITHUB_USER_ID || "").trim();
const githubLogin = String(process.env.LICENSE_GITHUB_LOGIN || "").trim();
const deviceId = String(process.env.LICENSE_DEVICE_ID || "").trim();
const expiresInput = String(process.env.LICENSE_EXPIRES_AT || "").trim();
const offlineGraceHours = Number(process.env.LICENSE_OFFLINE_GRACE_HOURS || "24");
const privateKey = process.env.LICENSE_PRIVATE_KEY;

function fail(message) {
  throw new Error(message);
}

if (!privateKey) fail("缺少GitHub Actions Secret LICENSE_PRIVATE_KEY");
if (!new Set(["issue", "revoke"]).has(operation)) fail("operation必须是issue或revoke");
if (!/^\d{1,20}$/.test(githubUserId)) fail("GitHub用户ID格式错误");
if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(githubLogin)) fail("GitHub用户名格式错误");
if (!Number.isInteger(offlineGraceHours) || offlineGraceHours < 1 || offlineGraceHours > 24) {
  fail("离线授权时间必须是1到24小时");
}

let expiresAt;
let deviceHash;
if (operation === "issue") {
  if (!/^[A-Za-z0-9-]{20,80}$/.test(deviceId)) fail("浏览器安装码格式错误");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresInput)) fail("到期日期必须使用YYYY-MM-DD格式");
  expiresAt = `${expiresInput}T23:59:59.999Z`;
  if (!Number.isFinite(Date.parse(expiresAt))) fail("到期日期无效");
  if (Date.parse(expiresAt) <= Date.now()) fail("到期日期必须晚于今天");
  deviceHash = createHash("sha256").update(deviceId, "utf8").digest("hex");
} else {
  expiresAt = new Date().toISOString();
  deviceHash = createHash("sha256").update(deviceId || "revoked", "utf8").digest("hex");
}

const payload = {
  version: 1,
  product: "temu-edge-extension",
  github_user_id: githubUserId,
  github_login: githubLogin,
  device_hash: deviceHash,
  status: operation === "issue" ? "active" : "revoked",
  issued_at: new Date().toISOString(),
  expires_at: expiresAt,
  offline_grace_hours: offlineGraceHours
};

const payloadText = JSON.stringify(payload);
const payloadBase64Url = Buffer.from(payloadText, "utf8").toString("base64url");
const signature = sign("sha256", Buffer.from(payloadBase64Url, "utf8"), {
  key: privateKey,
  dsaEncoding: "ieee-p1363"
}).toString("base64url");

const envelope = {
  algorithm: "ECDSA_P256_SHA256",
  key_id: "temu-owner-2026-08",
  payload: payloadBase64Url,
  signature
};

const fileName = `${createHash("sha256").update(githubUserId, "utf8").digest("hex")}.json`;
mkdirSync("licenses", {recursive: true});
writeFileSync(join("licenses", fileName), `${JSON.stringify(envelope)}\n`, "utf8");
console.log(`${operation === "issue" ? "授权已签发" : "授权已撤销"}: ${githubLogin} (${githubUserId})`);
