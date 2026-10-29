# Phase 1 summary — lead recon, 2026-10-24 (PT)

Input: Ryan's 48-lead list (attachment CSV). Cutoff for "review in last 90 days": on or after **2026-07-26**.
Files: `audit.csv` (one row per lead, with evidence URLs), `<slug>/dossier.json` + `dossier.md` for the top 3, `mapquest_reviews.json` (raw Yelp-feed reviews with links), `sitecheck/` (raw site/CSLB checks).

## Funnel
| Stage | Count | Notes |
|---|---|---|
| Leads in list | 48 | |
| Review within 90 days | 23 | 22 Warm + Ace GreenCare. Mona's (07/24) misses by 2 days; JMN (07/27) just makes it |
| Minus excluded | 20 | El Kiosco and Octavio's already have demos; Ace GreenCare is dead per Ryan |
| No own website | 15 | Fail: APG (apgproperties.com), JLE (jle1.com), Nease (neaseproperties.com → Buildium site), LS PM (lspropertymanagement.net), Calvo (calvogroup.com) |
| Valid license verified (final, all 3 criteria) | **5** | Croff Electric, Patchwork's Plastering, Peng's Smog Check, John's Electric, Pupuseria Salvadoreña (+ JMN Painting partial) |
| Top 3 | 3 | Croff Electric, Patchwork's Plastering, Peng's Smog Check |

## Top 3
1. **Croff Electric** (`croff-electric`). CSLB C-10 #1044752 active to 09/30/2028; Long Beach BL BU22104948 active. Yelp feed 5.0/113 with reviews 10/20, 09/30 and 09/04. Google 4.8/17, HomeAdvisor 4.4/37, Angi 5.0/8, Nextdoor Fave 2022. No website. Public email croffelectric@yahoo.com, so **forms: yes**. EN/ES: yes (Long Beach is 43.8% Hispanic). Tool: EV charger & panel readiness planner.
2. **Patchwork's Plastering** (`patchworks-plastering`). CSLB C-35 #737480 active to 06/30/2027, licensed since 1997. Yelp feed 5.0/166 with reviews 10/18, 09/26 and 09/24. Birdeye 4.7/50, Google 4.8/47, Nextdoor Fave 2022-24. Old Duda site is unpublished ("Site not found"). Public email aston.patchworks@yahoo.com, so **forms: yes**. EN/ES: optional (Garden Grove is 37.1% Hispanic; owner is English-born). Tool: stucco & plaster patch planner (photo-to-bid).
3. **Peng's Smog Check Station** (`pengs-smog-check`). BAR ARD #147631, a STAR smog station on the BAR locator; Long Beach BL BU21803792 active. Yelp feed 5.0/166 (newest 10/09), Google 4.9/213. No website. **No public email, so no forms.** EN/ES: yes (Long Beach). Tool: "Smog Check Ready?" eligibility, checklist and walk-in planner.

## Runners-up (pass all three)
- **John's Electric**: CSLB #1141372 plus LB BL. But the only in-window review (09/04) is 2★ ("hard to get a hold of, did not complete my job"), it's a second electrician, and the owner is Jesus Gonzalez in 90805, so it would take the ES toggle.
- **Pupuseria Salvadoreña**: LB BL BU22202785 active; reviews 10/15, 10/07, 10/01. Already in Ryan's pupuseria queue; restaurant template similar to El Kiosco.
- **JMN Painting** (partial): CSLB #779420 active, but no LB business license found and only one in-window review (07/27).

## Notable fails (cited in audit.csv)
- **SoCal Plumbing Service**: no CSLB license. The CSLB application list for 2026-10-13 shows it with license # 0 (exam pending). Domain is parked.
- **AD Auto Glass**: BAR ARD #301957 expired 03/31/2025 (delinquent); not on the BAR locator.
- **Walt's Tree Service**: no active CSLB or LB license found; its old domain is now a parked pay-per-call page.
- **Junk Buster Hauling**: strong reviews (5.0/310; 4 in the window) and a public email, but its LB license closed in 2023 and its Lakewood license can't be checked. Worth a call: if he's licensed in Lakewood, he's a strong pick (truck-load calculator).
- Unknown license (blocked or no public lookup): 2B1 Tint (BAR/Garden Grove), Kao's TV (BHGS, DCA search behind Turnstile), Nancy's Pupuseria (Buena Park/OC health), Lido PM (DRE not completed), Top Flight Mechanic (no BAR ARD found, so fail).

## Caveats
- Yelp ratings and counts come from Yelp's feed on MapQuest. Yelp.com blocks automated reads, so its live counts may differ slightly.
- BAR/DCA detail pages (expiry dates) sit behind Cloudflare Turnstile. The BAR Auto Shop Locator only lists current shops, which is what I used.
- City business-license checks were only possible for Long Beach (BizMap public data). Garden Grove, Lakewood and Buena Park have no public lookup that I found.
- Photos are Yelp/Google uploads with unconfirmed ownership. Fine for demos; get the owner's OK before going live.
- Every lead here already has a static demo folder in lead-demo-templates (from the original lead emails). The new builds supersede them.
