import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scraperDir = path.resolve(__dirname, "..");
const cacheDir = path.join(scraperDir, "cache");

const startUrl = "https://books.toscrape.com/";

const USER_AGENT =
    "FlyRankInternshipA9/1.0 (+https://github.com/aman008711/Expresss_Api_Task)";

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url, cacheFile) {
    await fs.mkdir(cacheDir, { recursive: true });

    // Use cache if available
    try {
        const cachedHtml = await fs.readFile(cacheFile, "utf-8");

        console.log(`CACHE HIT: ${url}`);

        return cachedHtml;
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    console.log(`FETCH: ${url}`);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 10000);

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
            },
            signal: controller.signal,
        });

        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status} for ${url}`);
        }

        const html = await response.text();

        await fs.writeFile(cacheFile, html, "utf-8");

        console.log(`Saved: ${cacheFile}`);

        return html;
    } finally {
        clearTimeout(timeout);
    }
}

async function discoverBooks() {
    let currentUrl = startUrl;
    let cataloguePages = 0;

    const bookUrls = new Set();

    while (cataloguePages < 3) {
        cataloguePages++;

        const cacheFile = path.join(
            cacheDir,
            `catalogue-page-${cataloguePages}.html`
        );

        const html = await fetchPage(currentUrl, cacheFile);

        const $ = cheerio.load(html);

        // Find every book link on this catalogue page
        $("article.product_pod h3 a").each((_, element) => {
            const href = $(element).attr("href");

            if (!href) {
                return;
            }

            const absoluteUrl = new URL(href, currentUrl).href;

            bookUrls.add(absoluteUrl);
        });

        console.log(
            `Page ${cataloguePages}: total unique books = ${bookUrls.size}`
        );

        // Stop after page 3
        if (cataloguePages === 3) {
            break;
        }

        // Find the catalogue's "next" link
        const nextHref = $("li.next a").attr("href");

        if (!nextHref) {
            console.log("No next page found.");
            break;
        }

        currentUrl = new URL(nextHref, currentUrl).href;

        // Be polite: wait before making another real request
        await sleep(500);
    }

    console.log("\nCHECKPOINT");
    console.log(`catalogue_pages=${cataloguePages}`);
    console.log(`discovered=${bookUrls.size}`);
    console.log(`unique_urls=${bookUrls.size}`);

    return [...bookUrls];
}

discoverBooks().catch((error) => {
    console.error("SCRAPER ERROR:", error.message);
    process.exitCode = 1;
});