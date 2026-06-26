# Matterfull Client Requirements — Supply Chain Verification

## Source Files
- `Apps_and_websites_for_training.xlsx` — 5,298 domains/apps to process
- `Sample_data_for_AI_companion_-_Scenario_1_for_websites__iOS_and_Android.xlsx` — Expected workflow + output format

---

## Core Workflow (Scenario 1)

### Input
User uploads a list of:
- **Android app bundles** (e.g., `com.game.space.shooter2`)
- **iOS app IDs** (numeric, e.g., `6740568271`)
- **Website domains** (e.g., `sportskeeda.com`)

### Search Parameters
- **Ads.txt lines to find**: Domain (e.g., `bematterfull.com`), ID (ANY or specific), Role (ANY, DIRECT, RESELLER)
- **Sellers.json domains to verify**: e.g., `pubnative.net`, `smaato.com`
- **Specific sellers.json IDs**: e.g., pubnative.net=85470298878, smaato.com=92331746142

### Processing Logic (per item)

1. **Classify input**: Determine if Android app, iOS app, or website domain
2. **For apps**: 
   - Android: `https://play.google.com/store/apps/details?id={bundle}` → scrape publisher name + website
   - iOS: `https://apps.apple.com/app/id{numeric_id}` → scrape publisher name + website
3. **Extract root domain**: URL like `https://ark.fandom.com/wiki/...` → `fandom.com`
4. **Generate ads.txt URL**: `https://{publisher_website}/ads.txt` (or `/app-ads.txt` for apps)
5. **Crawl ads.txt**: Fetch and parse all entries
6. **Find matching entries**: All lines where domain = `bematterfull.com` (any ID, any role)
7. **Check schain IDs**: Look for specific seller IDs (e.g., 85470298878 for pubnative.net)
8. **Cross-verify sellers.json**: 
   - Go to `pubnative.net/sellers.json`
   - Find entry where publisher domain matches the publisher's website
   - If found → schain is valid for that seller
9. **Reverse verify**: Check publisher's ads.txt has the intermediary as DIRECT
10. **Determine Status**: OK if at least 1 sellers.json has a match, NO otherwise

### Expected Output Columns
| Column | Description |
|--------|-------------|
| Bundle/Domain | The input app bundle or website domain |
| Publisher Name | Name from app store or domain registrant |
| Ads.txt page | Full URL to the ads.txt/app-ads.txt |
| Ads.txt {domain}, any ID, any role | All matching ads.txt entries (newline-separated) |
| Ads.txt line corresponding to schain | The specific line with the seller ID |
| Schain {seller1} | sellers.json entry for seller 1 (JSON snippet) |
| Schain {seller2} | sellers.json entry for seller 2 (JSON snippet) |
| Status | OK / NO |
| Type | Android app / iOS app / Website |
| Comment for developers | Explanation of why OK/NO |

### Edge Cases
- `APP NOT FOUND` — app doesn't exist in store
- `WEBSITE NOT FOUND` — publisher website not found or no ads.txt
- `ADS.TXT PAGE NOT FOUND` — 404 on ads.txt URL
- `NONE` — entry not found in that column
- Some ads.txt pages are at non-standard URLs (e.g., `http://adstxt.pubguru.net/publisher/rolloid.net/ads.txt`)

---

## Technical Requirements

### Crawling
- Must bypass Cloudflare and bot protection (many publisher sites use it)
- Must support proxy rotation (Google proxies, SOCKS5)
- Must handle redirects, non-standard ads.txt locations
- Must handle rate limiting gracefully
- Must support concurrent batch processing (5000+ items)

### App Store Scraping
- Google Play: Extract developer name, website URL from app page
- Apple App Store: Extract developer name, website URL from app page
- Handle "APP NOT FOUND" gracefully

### Parsing
- ads.txt format: `{domain}, {seller_id}, {relationship}[, {certification_authority_id}]`
- sellers.json format: Standard IAB sellers.json with `sellers[]` array
- Handle case-insensitive matching
- Handle whitespace variations

### Output
- Structured table matching the 10-column format above
- Support for bulk results (5000+ rows)
- Exportable (the agent should be able to generate downloadable reports)

---

## What Matterfull Needs the AI Agent To Do

The AI agent is the CORE PRODUCT. It must be able to:
1. Accept a list of domains/apps (upload xlsx or paste)
2. Auto-classify each input (Android/iOS/Website)
3. Crawl app stores to find publisher info
4. Fetch and parse ads.txt/app-ads.txt with Cloudflare bypass
5. Search for specific domain entries in the ads.txt
6. Cross-reference with sellers.json 
7. Perform full supply chain (schain) verification
8. Output structured results in the exact table format
9. Handle bulk (5000+ items) with progress tracking
10. Learn from patterns (personalization) to improve accuracy

This is NOT a general-purpose AI assistant — it's a specialized AdTech supply chain verification machine.
