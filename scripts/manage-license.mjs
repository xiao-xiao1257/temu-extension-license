import {createHash, randomBytes, sign} from "node:crypto";
import {appendFileSync, mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const operation = String(process.env.OPERATION || "").trim();
const deviceId = String(process.env.LICENSE_DEVICE_ID || "").trim();
const activationInput = String(process.env.LICENSE_ACTIVATION_CODE || "").trim();
const expiresInput = String(process.env.LICENSE_EXPIRES_AT || "").trim();
const offlineGraceHours = Number(process.env.LICENSE_OFFLINE_GRACE_HOURS || "24");
const privateKey = process.env.LICENSE_PRIVATE_KEY;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function fail(message) {
  throw new Error(message);
}

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatCode(value) {
  const normalized = normalizeCode(value);
  return [normalized.slice(0, 3), normalized.slice(3, 7), normalized.slice(7, 11), normalized.slice(11, 15)].filter(Boolean).join("-");
}

function generateCode() {
  const bytes = randomBytes(12);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `TMU${suffix}`;
}

if (!privateKey) fail("缺少GitHub Actions Secret LICENSE_PRIVATE_KEY");
if (!new Set(["issue", "revoke"]).has(operation)) fail("operation必须是issue或revoke");
if (!Number.isInteger(offlineGraceHours) || offlineGraceHours < 1 || offlineGraceHours > 24) {
  fail("离线授权时间必须是1到24小时");
}

let activationCode = normalizeCode(activationInput);
if (!activationCode && operation === "issue") activationCode = generateCode();
if (!/^TMU[A-HJ-NP-Z2-9]{12}$/.test(activationCode)) {
  fail(operation === "revoke" ? "撤销时必须填写原授权码" : "授权码格式错误 请留空自动生成或填写原授权码续期");
}

let expiresAt;
let deviceHash;
if (operation === "issue") {
  if (!/^[A-Za-z0-9-]{20,80}$/.test(deviceId)) fail("设备码格式错误");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresInput)) fail("到期日期必须使用YYYY-MM-DD格式");
  expiresAt = `${expiresInput}T23:59:59.999Z`;
  if (!Number.isFinite(Date.parse(expiresAt))) fail("到期日期无效");
  if (Date.parse(expiresAt) <= Date.now()) fail("到期日期必须晚于今天");
  deviceHash = createHash("sha256").update(deviceId, "utf8").digest("hex");
} else {
  expiresAt = new Date().toISOString();
  deviceHash = createHash("sha256").update(deviceId || "revoked", "utf8").digest("hex");
}

const activationHash = createHash("sha256").update(activationCode, "utf8").digest("hex");
const payload = {
  version: 2,
  product: "temu-edge-extension",
  activation_hash: activationHash,
  device_hash: deviceHash,
  status: operation === "issue" ? "active" : "revoked",
  issued_at: new Date().toISOString(),
  expires_at: expiresAt,
  offline_grace_hours: offlineGraceHours
};

const payloadBase64Url = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
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

mkdirSync("licenses", {recursive: true});
writeFileSync(join("licenses", `${activationHash}.json`), `${JSON.stringify(envelope)}\n`, "utf8");

const formattedCode = formatCode(activationCode);
const actionText = operation === "issue" ? "授权已签发" : "授权已撤销";
console.log(`${actionText}: ${formattedCode}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `activation_code=${formattedCode}\n`, "utf8");
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = operation === "issue"
    ? `## 授权签发成功\n\n把下面的授权码发给该设备的使用者：\n\n**${formattedCode}**\n\n到期时间：${expiresAt}\n`
    : `## 授权撤销成功\n\n已撤销授权码：**${formattedCode}**\n`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}
