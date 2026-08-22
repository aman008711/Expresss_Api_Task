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

/**
 * Fetch a page or use its cached copy.
 */
async function fetchPage(url, cacheFile) {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });

    // Try cache first
    try {
        const cachedHtml = await fs.readFile(cacheFile, "utf-8");

        console.log(`CACHE HIT: ${url}`);

        return {
            html: cachedHtml,
            fromCache: true,
        };
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

        return {
            html,
            fromCache: false,
        };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Discover the first three catalogue pages
 * and collect 60 unique book URLs.
 */
async function discoverBooks() {
    let currentUrl = startUrl;
    let cataloguePages = 0;

    const bookUrls = new Set();

    const sourcePages = new Map();

    while (cataloguePages < 3) {
        cataloguePages++;

        const cacheFile = path.join(
            cacheDir,
            `catalogue-page-${cataloguePages}.html`
        );

        const { html } = await fetchPage(currentUrl, cacheFile);

        const $ = cheerio.load(html);

        $("article.product_pod h3 a").each((_, element) => {
            const href = $(element).attr("href");

            if (!href) {
                return;
            }

            const absoluteUrl = new URL(href, currentUrl).href;

            bookUrls.add(absoluteUrl);

            if (!sourcePages.has(absoluteUrl)) {
                sourcePages.set(absoluteUrl, currentUrl);
            }
        });

        console.log(
            `Page ${cataloguePages}: total unique books = ${bookUrls.size}`
        );

        if (cataloguePages === 3) {
            break;
        }

        const nextHref = $("li.next a").attr("href");

        if (!nextHref) {
            throw new Error(
                `Expected a next page after catalogue page ${cataloguePages}`
            );
        }

        currentUrl = new URL(nextHref, currentUrl).href;

        await sleep(500);
    }

    console.log("\nDISCOVERY CHECKPOINT");
    console.log(`catalogue_pages=${cataloguePages}`);
    console.log(`discovered=${bookUrls.size}`);
    console.log(`unique_urls=${bookUrls.size}`);

    if (cataloguePages !== 3 || bookUrls.size !== 60) {
        throw new Error("Discovery checkpoint failed.");
    }

    return {
        bookUrls: [...bookUrls],
        sourcePages,
    };
}

/**
 * Extract one book's raw information.
 */
async function extractBook(bookUrl, sourcePage, index) {
    const detailCacheFile = path.join(
        cacheDir,
        "books",
        `book-${String(index).padStart(2, "0")}.html`
    );

    const { html } = await fetchPage(bookUrl, detailCacheFile);

    const $ = cheerio.load(html);

    const title = $("div.product_main h1").text().trim();

    const priceText = $("div.product_main .price_color").first().text().trim();

    const availabilityText = $(
        "div.product_main .availability"
    )
        .text()
        .replace(/\s+/g, " ")
        .trim();

    const ratingText =
        $("div.product_main .star-rating").attr("class")?.replace("star-rating", "").trim() ||
        "";

    const descriptionElement = $("#product_description").next("p");

    const description = descriptionElement.length
        ? descriptionElement.text().trim()
        : null;

    const fetchedAt = new Date().toISOString();

    return {
        title,
        product_url: bookUrl,
        price_text: priceText,
        availability_text: availabilityText,
        rating_text: ratingText,
        description,
        source_page: sourcePage,
        fetched_at: fetchedAt,
    };
}

/**
 * Extract all 60 book records.
 */
async function extractAllBooks(bookUrls, sourcePages) {
    const records = [];

    for (let i = 0; i < bookUrls.length; i++) {
        const bookUrl = bookUrls[i];

        console.log(`\n[${i + 1}/${bookUrls.length}] ${bookUrl}`);

        const sourcePage = sourcePages.get(bookUrl);

        const record = await extractBook(
            bookUrl,
            sourcePage,
            i + 1
        );

        records.push(record);

        // Wait only after real requests.
        // Cached requests don't hit the website.
        await sleep(500);
    }

    return records;
}

async function main() {
    const { bookUrls, sourcePages } = await discoverBooks();

    console.log("\nStarting book extraction...");

    const records = await extractAllBooks(
        bookUrls,
        sourcePages
    );

    console.log("\nEXTRACTION CHECKPOINT");
    console.log(`detail_pages=${records.length}`);

    console.log("\nFIRST RAW RECORD:");
    console.log(JSON.stringify(records[0], null, 2));
}

main().catch((error) => {
    console.error("\nSCRAPER ERROR:", error.message);
    process.exitCode = 1;
});