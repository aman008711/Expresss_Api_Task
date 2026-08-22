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

const stats = {
    pagesFetched: 0,
    cacheHits: 0,
    failedPages: 0,
    validRecords: 0,
    invalidRecords: 0,
};

const failedPages = [];

/* ---------------------------------------
   HELPERS
---------------------------------------- */

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------------------------------
   FETCH + CACHE
---------------------------------------- */

async function fetchPage(url, cacheFile) {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });

    // Check cache first
    try {
        const cachedHtml = await fs.readFile(cacheFile, "utf-8");

        stats.cacheHits++;

        console.log(`CACHE HIT: ${url}`);

        return {
            html: cachedHtml,
            fromCache: true,
            status: 200,
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
            const error = new Error(
                `HTTP ${response.status} for ${url}`
            );

            error.status = response.status;

            throw error;
        }

        const html = await response.text();

        await fs.writeFile(cacheFile, html, "utf-8");

        stats.pagesFetched++;

        console.log(`FETCH SUCCESS: ${url}`);

        return {
            html,
            fromCache: false,
            status: response.status,
        };
    } finally {
        clearTimeout(timeout);
    }
}

/* ---------------------------------------
   RETRY LOGIC
---------------------------------------- */

function shouldRetry(error) {
    // Retry network/timeout errors
    if (error.name === "AbortError") {
        return true;
    }

    // Retry server errors
    if (
        error.status &&
        error.status >= 500 &&
        error.status <= 599
    ) {
        return true;
    }

    // Do NOT retry 403 or 404
    if (error.status === 403 || error.status === 404) {
        return false;
    }

    return false;
}

async function fetchWithRetry(url, cacheFile) {
    try {
        return await fetchPage(url, cacheFile);
    } catch (error) {
        if (!shouldRetry(error)) {
            throw error;
        }

        console.log(`RETRYING: ${url}`);

        await sleep(1000);

        return await fetchPage(url, cacheFile);
    }
}

/* ---------------------------------------
   DISCOVER BOOKS
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

        const { html } = await fetchWithRetry(
            currentUrl,
            cacheFile
        );

        const $ = cheerio.load(html);

        $("article.product_pod h3 a").each((_, element) => {
            const href = $(element).attr("href");

            if (!href) {
                return;
            }

            const absoluteUrl = new URL(
                href,
                currentUrl
            ).href;

            bookUrls.add(absoluteUrl);

            if (!sourcePages.has(absoluteUrl)) {
                sourcePages.set(
                    absoluteUrl,
                    currentUrl
                );
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

        currentUrl = new URL(
            nextHref,
            currentUrl
        ).href;

        await sleep(500);
    }

    console.log("\nDISCOVERY CHECKPOINT");
    console.log(`catalogue_pages=${cataloguePages}`);
    console.log(`discovered=${bookUrls.size}`);
    console.log(`unique_urls=${bookUrls.size}`);

    if (
        cataloguePages !== 3 ||
        bookUrls.size !== 60
    ) {
        throw new Error(
            "Discovery checkpoint failed."
        );
    }

    return {
        bookUrls: [...bookUrls],
        sourcePages,
    };
}

/* ---------------------------------------
   EXTRACT ONE BOOK
---------------------------------------- */

async function extractBook(
    bookUrl,
    sourcePage,
    index
) {
    const detailCacheFile = path.join(
        cacheDir,
        "books",
        `book-${String(index).padStart(2, "0")}.html`
    );

    const { html } = await fetchWithRetry(
        bookUrl,
        detailCacheFile
    );

    const $ = cheerio.load(html);

    const title = $(
        "div.product_main h1"
    )
        .text()
        .trim();

    const priceText = $(
        "div.product_main .price_color"
    )
        .first()
        .text()
        .trim();

    const availabilityText = $(
        "div.product_main .availability"
    )
        .text()
        .replace(/\s+/g, " ")
        .trim();

    const ratingClass = $(
        "div.product_main .star-rating"
    ).attr("class");

    const ratingText = ratingClass
        ? ratingClass
            .replace("star-rating", "")
            .trim()
        : "";

    const descriptionElement =
        $("#product_description").next("p");

    const description =
        descriptionElement.length
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
   EXTRACT ALL BOOKS SAFELY
---------------------------------------- */

async function extractAllBooks(
    bookUrls,
    sourcePages
) {
    const records = [];

    for (let i = 0; i < bookUrls.length; i++) {
        const bookUrl = bookUrls[i];

        console.log(
            `\n[${i + 1}/${bookUrls.length}] ${bookUrl}`
        );

        try {
            const sourcePage =
                sourcePages.get(bookUrl);

            const record = await extractBook(
                bookUrl,
                sourcePage,
                i + 1
            );

            records.push(record);

            console.log("SUCCESS");

        } catch (error) {
            console.error(
                `FAILED: ${error.message}`
            );

            stats.failedPages++;

            failedPages.push({
                url: bookUrl,
                error: error.message,
                status: error.status ?? null,
            });
        }

        // Polite delay between real requests.
        await sleep(500);
    }

    return records;
}

/* ---------------------------------------
   NORMALIZATION
---------------------------------------- */

function normalizePrice(priceText) {
    if (!priceText) {
        return NaN;
    }

    return Number.parseFloat(
        priceText.replace("£", "").trim()
    );
}

function normalizeRecord(record) {
    return {
        ...record,
        price_gbp: normalizePrice(
            record.price_text
        ),
    };
}

/* ---------------------------------------
   ZOD SCHEMA
---------------------------------------- */

const bookSchema = z.object({
    title: z.string().min(1),

    product_url: z.url(),

    price_text: z.string().min(1),

    price_gbp: z
        .number()
        .finite()
        .nonnegative(),

    availability_text: z
        .string()
        .min(1),

    rating_text: z
        .string()
        .min(1),

    description: z
        .string()
        .nullable(),

    source_page: z.url(),

    fetched_at: z.string().datetime(),
});

/* ---------------------------------------
   VALIDATION
---------------------------------------- */

function validateRecords(records) {
    const validRecords = [];
    const invalidRecords = [];

    for (const record of records) {
        const normalizedRecord =
            normalizeRecord(record);

        const result =
            bookSchema.safeParse(
                normalizedRecord
            );

        if (result.success) {
            validRecords.push(result.data);
        } else {
            invalidRecords.push({
                record: normalizedRecord,
                errors: result.error.issues,
            });
        }
    }

    stats.validRecords =
        validRecords.length;

    stats.invalidRecords =
        invalidRecords.length;

    return {
        validRecords,
        invalidRecords,
    };
}

/* ---------------------------------------
   SAVE BOOKS + ERRORS
---------------------------------------- */

async function saveResults(
    validRecords,
    invalidRecords
) {
    await fs.mkdir(outputDir, {
        recursive: true,
    });

    await fs.writeFile(
        path.join(outputDir, "books.json"),
        JSON.stringify(
            validRecords,
            null,
            2
        ),
        "utf-8"
    );

    await fs.writeFile(
        path.join(outputDir, "errors.json"),
        JSON.stringify(
            invalidRecords,
            null,
            2
        ),
        "utf-8"
    );
}

/* ---------------------------------------
   RUN REPORT
---------------------------------------- */

async function saveRunReport(
    startTime,
    duration
) {
    const report = {
        start_time: startTime,
        duration_ms: duration,

        catalogue_pages: 3,

        pages_fetched:
            stats.pagesFetched,

        cache_hits:
            stats.cacheHits,

        valid_records:
            stats.validRecords,

        invalid_records:
            stats.invalidRecords,

        failed_pages:
            stats.failedPages,

        failed_page_details:
            failedPages,
    };

    await fs.writeFile(
        path.join(
            outputDir,
            "run-report.json"
        ),
        JSON.stringify(
            report,
            null,
            2
        ),
        "utf-8"
    );

    console.log(
        "\nRun report saved:"
    );

    console.log(
        path.join(
            outputDir,
            "run-report.json"
        )
    );
}

/* ---------------------------------------
   MAIN
---------------------------------------- */

async function main() {
    const startTimestamp =
        new Date();

    const startTime =
        startTimestamp.toISOString();

    const startMilliseconds =
        Date.now();

    try {
        const {
            bookUrls,
            sourcePages,
        } = await discoverBooks();

        console.log(
            "\nStarting book extraction..."
        );

        const rawRecords =
            await extractAllBooks(
                bookUrls,
                sourcePages
            );

        console.log(
            "\nEXTRACTION CHECKPOINT"
        );

        console.log(
            `detail_pages=${rawRecords.length}`
        );

        console.log(
            "\nNormalizing and validating..."
        );

        const {
            validRecords,
            invalidRecords,
        } = validateRecords(
            rawRecords
        );

        await saveResults(
            validRecords,
            invalidRecords
        );

        const duration =
            Date.now() -
            startMilliseconds;

        await saveRunReport(
            startTime,
            duration
        );

        console.log(
            "\nFINAL CHECKPOINT"
        );

        console.log(
            `valid_records=${validRecords.length}`
        );

        console.log(
            `invalid_records=${invalidRecords.length}`
        );

        console.log(
            `failed_pages=${stats.failedPages}`
        );

        console.log(
            `cache_hits=${stats.cacheHits}`
        );

        console.log(
            `pages_fetched=${stats.pagesFetched}`
        );

    } catch (error) {
        console.error(
            "\nSCRAPER ERROR:",
            error.message
        );

        const duration =
            Date.now() -
            startMilliseconds;

        try {
            await saveRunReport(
                startTime,
                duration
            );
        } catch (reportError) {
            console.error(
                "Could not save run report:",
                reportError.message
            );
        }

        process.exitCode = 1;
    }
}

main();