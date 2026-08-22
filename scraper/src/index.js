import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scraperDir = path.resolve(__dirname, "..");
const cacheDir = path.join(scraperDir, "cache");
const outputDir = path.join(scraperDir, "output");

const startUrl = "https://books.toscrape.com/";

const USER_AGENT =
    "FlyRankInternshipA9/1.0 (+https://github.com/aman008711/Expresss_Api_Task)";

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------------------------------
   FETCH + CACHE
---------------------------------------- */

async function fetchPage(url, cacheFile) {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });

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

/* ---------------------------------------
   DISCOVER 3 CATALOGUE PAGES
---------------------------------------- */

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
                `Expected next page after catalogue page ${cataloguePages}`
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

/* ---------------------------------------
   EXTRACT ONE BOOK
---------------------------------------- */

async function extractBook(bookUrl, sourcePage, index) {
    const detailCacheFile = path.join(
        cacheDir,
        "books",
        `book-${String(index).padStart(2, "0")}.html`
    );

    const { html } = await fetchPage(bookUrl, detailCacheFile);

    const $ = cheerio.load(html);

    const title = $("div.product_main h1").text().trim();

    const priceText = $("div.product_main .price_color")
        .first()
        .text()
        .trim();

    const availabilityText = $("div.product_main .availability")
        .text()
        .replace(/\s+/g, " ")
        .trim();

    const ratingClass = $("div.product_main .star-rating")
        .attr("class");

    const ratingText = ratingClass
        ? ratingClass.replace("star-rating", "").trim()
        : "";

    const descriptionElement = $("#product_description").next("p");

    const description = descriptionElement.length
        ? descriptionElement.text().trim()
        : null;

    return {
        title,
        product_url: bookUrl,
        price_text: priceText,
        availability_text: availabilityText,
        rating_text: ratingText,
        description,
        source_page: sourcePage,
        fetched_at: new Date().toISOString(),
    };
}

/* ---------------------------------------
   EXTRACT ALL BOOKS
---------------------------------------- */

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

        await sleep(500);
    }

    return records;
}

/* ---------------------------------------
   STAGE 4 — NORMALIZE
---------------------------------------- */

function normalizePrice(priceText) {
    if (!priceText) {
        return NaN;
    }

    const cleanedPrice = priceText
        .replace("£", "")
        .trim();

    return Number.parseFloat(cleanedPrice);
}

function normalizeRecord(record) {
    return {
        ...record,
        price_gbp: normalizePrice(record.price_text),
    };
}

/* ---------------------------------------
   STAGE 4 — ZOD SCHEMA
---------------------------------------- */

const bookSchema = z.object({
    title: z.string().min(1),

    product_url: z.url(),

    price_text: z.string().min(1),

    price_gbp: z.number().finite().nonnegative(),

    availability_text: z.string().min(1),

    rating_text: z.string().min(1),

    description: z.string().nullable(),

    source_page: z.url(),

    fetched_at: z.string().datetime(),
});

/* ---------------------------------------
   STAGE 4 — VALIDATE
---------------------------------------- */

function validateRecords(records) {
    const validRecords = [];
    const invalidRecords = [];

    for (const record of records) {
        const normalizedRecord = normalizeRecord(record);

        const result = bookSchema.safeParse(normalizedRecord);

        if (result.success) {
            validRecords.push(result.data);
        } else {
            invalidRecords.push({
                record: normalizedRecord,
                errors: result.error.issues,
            });
        }
    }

    return {
        validRecords,
        invalidRecords,
    };
}

/* ---------------------------------------
   STAGE 4 — STORE
---------------------------------------- */

async function saveResults(validRecords, invalidRecords) {
    await fs.mkdir(outputDir, { recursive: true });

    const booksFile = path.join(outputDir, "books.json");
    const errorsFile = path.join(outputDir, "errors.json");

    await fs.writeFile(
        booksFile,
        JSON.stringify(validRecords, null, 2),
        "utf-8"
    );

    await fs.writeFile(
        errorsFile,
        JSON.stringify(invalidRecords, null, 2),
        "utf-8"
    );

    console.log(`\nSaved valid records: ${booksFile}`);
    console.log(`Saved invalid records: ${errorsFile}`);
}

/* ---------------------------------------
   MAIN
---------------------------------------- */

async function main() {
    const { bookUrls, sourcePages } = await discoverBooks();

    console.log("\nStarting book extraction...");

    const rawRecords = await extractAllBooks(
        bookUrls,
        sourcePages
    );

    console.log("\nEXTRACTION CHECKPOINT");
    console.log(`detail_pages=${rawRecords.length}`);

    console.log("\nNormalizing and validating records...");

    const {
        validRecords,
        invalidRecords,
    } = validateRecords(rawRecords);

    await saveResults(
        validRecords,
        invalidRecords
    );

    console.log("\nVALIDATION CHECKPOINT");
    console.log(`raw_records=${rawRecords.length}`);
    console.log(`valid_records=${validRecords.length}`);
    console.log(`invalid_records=${invalidRecords.length}`);

    if (validRecords.length > 0) {
        console.log("\nFIRST VALID RECORD:");
        console.log(
            JSON.stringify(validRecords[0], null, 2)
        );
    }
}

main().catch((error) => {
    console.error("\nSCRAPER ERROR:", error.message);
    process.exitCode = 1;
});