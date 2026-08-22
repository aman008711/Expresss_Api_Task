import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scraperDir = path.resolve(__dirname, "..");
const cacheDir = path.join(scraperDir, "cache");

const catalogueUrl = "https://books.toscrape.com/";
const cacheFile = path.join(cacheDir, "catalogue-page-1.html");

const USER_AGENT =
    "FlyRankInternshipA9/1.0 (+https://github.com/aman008711/Expresss_Api_Task)";

async function fetchAndCache() {
    await fs.mkdir(cacheDir, { recursive: true });

    // Check whether cached HTML already exists
    try {
        const cachedHtml = await fs.readFile(cacheFile, "utf-8");

        console.log("CACHE HIT");
        console.log(`Response size: ${Buffer.byteLength(cachedHtml)} bytes`);

        return cachedHtml;
    } catch (error) {
        // File doesn't exist, so we need to fetch it.
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    console.log(`FETCH ${catalogueUrl}`);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 10000);

    try {
        const response = await fetch(catalogueUrl, {
            headers: {
                "User-Agent": USER_AGENT,
            },
            signal: controller.signal,
        });

        if (response.status !== 200) {
            throw new Error(`Fetch failed with status ${response.status}`);
        }

        const html = await response.text();

        await fs.writeFile(cacheFile, html, "utf-8");

        console.log(`Status: ${response.status}`);
        console.log(`Response size: ${Buffer.byteLength(html)} bytes`);
        console.log(`Saved: ${cacheFile}`);

        return html;
    } finally {
        clearTimeout(timeout);
    }
}

fetchAndCache().catch((error) => {
    console.error("SCRAPER ERROR:", error.message);
    process.exitCode = 1;
});