#!/usr/bin/env node
/**
 * i18n 번역 스크립트
 * - ko/translation.json 기준으로 en/ja/zh에 누락된 키만 번역
 * - DeepL API 사용 (DEEPL_AUTH_KEY 환경변수)
 * - API 키 없으면 ko 값으로 채우고 콘솔에 안내
 */

const fs = require("fs");
const path = require("path");

const LOCALES = ["en", "ja", "zh"];
const BASE_DIR = path.join(__dirname, "../src/i18n/messages");
const KO_PATH = path.join(BASE_DIR, "ko/translation.json");

const DEEPL_TARGET = { en: "EN", ja: "JA", zh: "ZH" };

function loadJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return {};
    }
}

function saveJson(filePath, obj) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function isTranslatable(val) {
    return typeof val === "string" && val.length > 0 && !/^[\{\}a-zA-Z0-9\s\-_\.]+$/.test(val);
}

function needsTranslation(koVal, targetVal) {
    if (typeof koVal !== "string") return false;
    if (koVal.includes("{") && koVal.includes("}")) return false; // 보간 키
    return !targetVal || (typeof targetVal === "string" && !targetVal.trim());
}

async function translateText(text, targetLang) {
    const authKey = process.env.DEEPL_AUTH_KEY;
    if (!authKey) return null;
    try {
        const form = new URLSearchParams({
            text,
            target_lang: DEEPL_TARGET[targetLang],
            source_lang: "KO",
        });
        const res = await fetch("https://api-free.deepl.com/v2/translate", {
            method: "POST",
            headers: {
                Authorization: `DeepL-Auth-Key ${authKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.translations?.[0]?.text || null;
    } catch {
        return null;
    }
}

async function deepTranslate(koNode, targetNode, targetLang, path = "") {
    let changed = false;
    for (const key in koNode) {
        const koVal = koNode[key];
        const targetVal = targetNode[key];
        const currentPath = path ? `${path}.${key}` : key;

        if (Array.isArray(koVal)) {
            if (!Array.isArray(targetNode[key])) targetNode[key] = [];
            for (let i = 0; i < koVal.length; i++) {
                const item = koVal[i];
                if (typeof item === "string") {
                    if (needsTranslation(item, targetNode[key][i])) {
                        const tr = await translateText(item, targetLang);
                        targetNode[key][i] = tr || item;
                        changed = true;
                        console.log(`[${targetLang}] ${currentPath}.${i}`);
                    }
                }
            }
        } else if (koVal !== null && typeof koVal === "object") {
            if (!targetNode[key] || typeof targetNode[key] !== "object") targetNode[key] = {};
            const subChanged = await deepTranslate(koVal, targetNode[key], targetLang, currentPath);
            if (subChanged) changed = true;
        } else if (typeof koVal === "string" && needsTranslation(koVal, targetVal)) {
            const tr = await translateText(koVal, targetLang);
            targetNode[key] = tr || koVal;
            changed = true;
            console.log(`[${targetLang}] ${currentPath}`);
        } else if (targetVal === undefined) {
            targetNode[key] = koVal;
            changed = true;
        }
    }
    return changed;
}

async function main() {
    const ko = loadJson(KO_PATH);
    if (!ko || Object.keys(ko).length === 0) {
        console.error("ko/translation.json을 찾을 수 없습니다.");
        process.exit(1);
    }

    if (!process.env.DEEPL_AUTH_KEY) {
        console.log("DEEPL_AUTH_KEY가 없습니다. 누락된 키에 ko 값을 채웁니다.");
    }

    for (const locale of LOCALES) {
        const localePath = path.join(BASE_DIR, `${locale}/translation.json`);
        const target = loadJson(localePath);
        const changed = await deepTranslate(ko, target, locale);
        if (changed) {
            saveJson(localePath, target);
            console.log(`[완료] ${locale}/translation.json 업데이트`);
        }
    }
}

main().catch(console.error);
