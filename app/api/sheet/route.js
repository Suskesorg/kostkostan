// Server-side route — fetches Google Sheets CSV (no CORS issues)
// To change the sheet URL, edit the SHEET_URL below and push to GitHub

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOhXgjnCnbY9QfAgFbgdzTpd_DSZR_o2l3043YZxAS0iMoVa080woT2wwEHE7rDRz9CuDnW2CJw5yC/pub?gid=1505344747&single=true&output=csv";

export const dynamic = "force-dynamic"; // Never cache this route
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch(SHEET_URL, {
      headers: { "User-Agent": "KostAkata/1.0" },
      cache: "no-store",
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Sheet fetch failed", status: res.status }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const csv = await res.text();

    // Verify it's actually CSV, not an HTML error page
    if (csv.includes("<!DOCTYPE") || csv.includes("<html")) {
      return new Response(
        JSON.stringify({ error: "Sheet returned HTML — may not be published" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
