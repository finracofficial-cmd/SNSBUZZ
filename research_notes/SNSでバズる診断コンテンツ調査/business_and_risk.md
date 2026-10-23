# Business model, costs, and legal/platform risks of a UGC-viral free web diagnosis/generator service in Japan (2025 – Oct 2026)

Research date: 2026-10-23. Not legal advice. Exchange-rate assumption used in all yen conversions of USD prices: **USD 1 = JPY 150** (my assumption, not sourced). Benchmark used throughout (supplied by the user, from an M&A listing, not independently verified): Japanese personality-diagnosis site, AdSense ¥1.99M at 19M PV/month (June), ¥1.49M (July), ~¥0.54–0.58M at ~0.85M PV/month later; infra (Vercel/Supabase/OpenAI API) ~¥70K/month at peak, later reduced via Cloudflare Workers/R2 caching; LINE stamps of the characters sold.

---

## Q1. Ad monetization: realistic RPM for Japanese entertainment/diagnosis sites, why the benchmark's RPM swung ~6x, and AdSense suspension risk

### Takeaway
No reliable, published RPM benchmark exists for Japanese diagnosis/entertainment sites. Available sources are anecdotal blogs. They point to entertainment traffic arriving from social media being the lowest-RPM combination, and to mobile RPM running well below desktop. The benchmark's ~¥105 per 1,000 PV at peak versus ~¥640–680 later is plausible, and it fits a pattern where a viral spike adds a lot of low-value traffic. It is still the seller's claim, so a buyer should verify it with AdSense screenshots broken down by month and by traffic source. AdSense's real risk during a spike is the "ad serving limit" and invalid-traffic enforcement, not the spike itself.

### Cited Findings
**Revenue share and mechanics**
- AdSense pays publishers 80% of display revenue on content after the buy-side platform fee is deducted. When the advertiser buys through Google Ads, the publisher receives about 68% of revenue: "収益から広告プラットフォーム…の手数料を差し引いた金額の 80% がパブリッシャー様の収益" / "収益の約 68% がパブリッシャー様に支払われます" — [Google AdSense Help: 収益分配](https://support.google.com/adsense/answer/180195?hl=ja)
- Page RPM = estimated earnings ÷ page views × 1000 — [Google AdSense Help (RPM)](https://support.google.com/adsense/answer/190515?hl=ja)

**Benchmark RPM arithmetic** (from the user-supplied figures)
- June: ¥1,990,000 / 19,000,000 PV × 1000 = **≈¥105 per 1,000 PV**.
- Later: ¥540,000–580,000 / 850,000 PV × 1000 = **≈¥635–682 per 1,000 PV** (roughly 6x higher).
- July: ¥1.49M, but the July PV figure was not supplied, so its RPM cannot be computed.

**Published RPM ranges (all low-reliability, anecdotal; no Japan-specific diagnosis data found)**
- A 2026 Japanese blog guide says an average personal blog earns RPM ¥200–400 ("日記やトレンド系が中心"), a specialized site ¥600–1,200, and a top site ¥1,500+. This came from a search snippet; direct fetch returned 403. The source looks like a generic content site, so treat it as rough — [atsoho.com AdSense RPM guide 2026](https://atsoho.com/blog/adsense-rpm-improvement-2026)
- A 2026 blog (eastondev, figures in USD and apparently not Japan-specific) gives:
  - By genre: entertainment/gossip RPM $1–3 with CPC ~$0.05–0.15.
  - By traffic source: SEO ~$4–10, direct ~$3–6, SNS lowest at ~$0.8–2. In a friend's case, Facebook traffic was $0.8 versus $3.8 from SEO.
  - Spike case: daily IPs rose 2,000→5,000 and impressions rose 150%, but revenue rose only 22% and RPM fell 51%, because the new traffic was low-value Facebook visits.
  - Device: mobile RPM is typically 50–70% of desktop.
  - The basis is the author's and friends' own data, with no statistical backing — [eastondev AdSense data analysis guide (2026-01-08)](https://eastondev.com/blog/ja/posts/media/20260108-adsense-data-analysis-guide/)
- A Japanese indie developer's 20-month AdSense disclosure: PV jumped to ~190K in June 2025 and revenue did not rise. Adding reward-type ads raised revenue ~10% — [Qiita: 個人開発WEBサービスのAdSense収益20ヶ月分を公開](https://qiita.com/pikachu0203/items/8241585e0b3114891615)
- Another indie developer reports a peak of ~4.5M PV/month and peak monthly income above ¥1M from ads. It is not clear that these were the same month. The same author notes buzz-driven traffic "settles down in about 2 days" — [note: 14年かかった！個人開発で月収100万達成した話](https://note.com/codemesi/n/n122513c4a453) (search summary attribution)

**AdSense spike / invalid-traffic risk (official)**
- Ad serving limit: "トラフィックの品質を評価する間、アカウントでの広告配信は一時的に制限されています". Limits are applied while Google evaluates traffic quality, or when invalid traffic is found. They usually last under 30 days but can be longer, and "永久的に閉鎖される可能性があります" if invalid activity is found — [Google AdSense Help: 広告配信の制限](https://support.google.com/adsense/answer/9437976?hl=ja)
- Invalid traffic includes "広告主様の費用やパブリッシャー様の収益を作為的に増やす可能性のあるクリックやインプレッション", including accidental clicks. Publishers are ultimately responsible even for third-party-caused invalid traffic — [Google AdSense Help: 無効なトラフィック](https://support.google.com/adsense/answer/16737); [Google AdSense Help (invalid activity)](https://support.google.com/adsense/answer/1348729). These quotes came from search snippets; which of the two pages each quote is from was not confirmed.
- The program policies prohibit:
  - clicking your own ads;
  - encouraging clicks with phrases like 「広告をクリック」「ご協力ください」, or using arrows/images to draw attention to ads;
  - paid-to-click, auto-surf, or click-exchange traffic;
  - placing ads where they look like navigation;
  - ad designs indistinguishable from content.

  Source: [Google AdSense プログラム ポリシー](https://support.google.com/adsense/answer/48182?hl=ja)
- AdSense Offerwall, which lets visitors unlock content by watching a rewarded ad and is configured in "Privacy & messaging", was reported generally available on AdSense in 2026 — [Search Engine Roundtable](https://www.seroundtable.com/google-adsense-offerwall-generally-available-41164.html); [Google AdSense Help: Offerwall](https://support.google.com/adsense/answer/13865318)

**Other networks (Ad Manager / Japanese SSPs)**
- Geniee is described as operating one of Japan's largest SSPs, with header bidding and PMP. fluct and i-mobile are Japanese programmatic/ad networks. No public CPM comparison was found — [wmtips Geniee vs GAM](https://www.wmtips.com/technologies/compare/geniee-vs-google-ad-manager); [Google AdMob ad sources list (includes i-mobile, fluct)](https://developers.google.com/admob/ios/ad-sources?hl=ja)
- A third-party (German) site, checked June 2026, says the Google Ad Exchange split is roughly 69% publisher / 31% Google. Unverified against Google — [ki-syndikat.de](https://www.ki-syndikat.de/tools/google-ad-manager/)

### Inferences
- **Why the benchmark's RPM rose ~6x as PV fell 95%.** These are likely explanations; none can be confirmed without the account data.
  1. **Traffic mix.** Peak traffic was almost certainly social and viral: X, TikTok, and Instagram in-app browsers, one-shot visits, low dwell time and viewability, and young users with low purchase intent. The residual 0.85M PV is more likely search, bookmark, and repeat traffic. The anecdotal 2–5x SNS-versus-SEO gap above lines up with this.
  2. **Ad serving limit or traffic evaluation during the spike.** Google explicitly limits serving "while traffic quality is evaluated". A sudden 20x surge is a plausible trigger, which would cut June revenue per PV.
  3. **Invalid-traffic deductions or clawbacks** on spike traffic. Mis-taps near "次へ/結果を見る" buttons on mobile quiz flows are a classic source.
  4. **Demand saturation.** A sudden large volume of the same low-value inventory clears at lower CPMs.
  5. **Seasonality**, if "later" means Q4, when ad budgets are higher (general claim, not verified for Japan).
  6. **Measurement mismatch.** If PV comes from GA4 page_view events on a single-page app while ads refresh per route, or the reverse, "PV" and AdSense page views can diverge. A buyer should compare AdSense's own page-view count.
- **Planning RPM for a new viral diagnosis site:** use roughly **¥80–200 per 1,000 PV** during viral spikes and **¥300–700** for steady-state, search-heavy residual traffic. These are my estimates from the benchmark plus the anecdotal ranges, not published data.
- Since buzz traffic decays in days to weeks (see the codemesi note), the cumulative revenue from one buzz is bounded. At the benchmark's peak RPM, 10M PV ≈ ¥1M.
- **Design implications for diagnosis UX:**
  - Never put ad units adjacent to answer buttons.
  - Avoid "結果は広告の下" phrasing that could read as encouraging clicks.
  - If gating detailed results behind ads, use the official AdSense Offerwall or rewarded format rather than a custom "please click" pattern.

### Gaps
- No published Japan-specific RPM data for diagnosis or entertainment sites on AdSense, Ad Manager, i-mobile, geniee, or fluct (2025–2026) was found. Network CPMs are only available from media kits or one's own A/B testing.
- No official Google statement says a natural viral spike by itself triggers limits. The help page only says limits can apply during traffic evaluation.
- The benchmark's July PV and the traffic-source breakdown are unknown, so the explanations above cannot be confirmed.

---

## Q2. Non-ad monetization for diagnosis/character content

### Takeaway
The best-documented non-ad revenue is **B2B: commissioned/tie-up diagnosis production**, which Japanese vendors publicly price from ¥150K–400K per diagnosis, and **HR/assessment SaaS**, priced around ¥500–1,500 per person plus base fees. **LINE stamps** pay creators ~35% of gross under the long-standing formula, but recent individual reports show tiny sales unless the characters already have a fan base. Reliable numbers for paid detailed reports, goods, and app sales of viral diagnosis sites were not found.

### Cited Findings
**Commissioned / tie-up diagnosis production (Japan)**
- ギミックプラス, a 2026-05-12 release (tax-excluded, no monthly fee):
  - **タイアッププラン ¥150,000〜**: production plus post-launch traffic support.
  - **フルスクラッチプラン ¥400,000〜**: multi-axis logic, gacha/omikuji, image generation such as license- or card-style result images, and compatibility diagnosis.
  - Published on the Makko portal. Cases include a promotional quiz for the film 『えんとつ町のプペル』 and Tsuchiura City's food-compatibility diagnosis.

  Source: [PR TIMES (Gimmick Plus, 2026-05-12)](https://prtimes.jp/main/html/rd/p/000000007.000143217.html)
- The Makko 診断ポータル was reported to exceed **30M PV/month and 15M total participations within 8 months** of launch, with traffic largely from SNS and smartphones — [Web担当者Forum / PR TIMES (Gimmick Plus)](https://webtan.impress.co.jp/r/prtimes/items/000000004.000143217)
- YONDE relaunched its diagnosis-content production service on 2025-09-01 with "制作負担ゼロ・最短1ヶ月から・**23万円〜**". It expanded to omikuji, fortune-telling, and brain-training content in July 2026 — [Web担当者Forum / PR TIMES (YONDE)](https://webtan.impress.co.jp/r/prtimes/items/000000043.000055663); [bestcalendar.jp (YONDE expansion)](https://www.bestcalendar.jp/press/143737)

**B2B HR / team assessment pricing** (recruiting-oriented; comparable to a B2B "team diagnosis" pivot)
- ミキワメAI: base fee ¥44,000〜 plus ¥550 per person — [imitsu SaaS: ミキワメAI 料金](https://saas.imitsu.jp/cate-aptitude-test/service/5646/price)
- HRベース: standard pack for up to 16 people, base ¥120,000 plus initial fee ¥120,000; personality-only plan ¥117,600 — [imitsu SaaS: HRベース 料金](https://saas.imitsu.jp/cate-aptitude-test/service/5424/price)
- One guide puts basic personality screening at ~¥500–1,500 per person and detailed leadership analysis at ¥5,000+ per person — [CREX aptitude test cost comparison](https://crexgroup.com/ja/shukatsu/test/aptitude-test-tool-cost-comparison/) (attribution from search summary)

**LINE stamps**
- Revenue share: after App Store/Google Play fees (30%) are deducted, creators receive 50% of the remainder, i.e. **35% of total sales**. This applies to submissions from 2015-02-01; it was previously 50%. The sources are 2015–2016, and no current official help page was retrieved — [gori.me (2015)](https://gori.me/line/line-news/67901); [LINE Plus press release (2016)](https://linepluscorp.com/pr/news/en/2016/1391)
- The 2018 LINE Creators emoji launch used the same 35% share — [Appllio (2018)](https://appllio.com/20181011-10437-line-creators-emoji)
- The official sticker guideline says "有料で提供されるスタンプは、宣伝を目的として販売できません", i.e. paid stickers cannot be sold for promotional purposes — [LINE Creators Market 制作ガイドライン](https://creator.line.me/ja/guideline/sticker/)
- Early official data (May–June 2014, first month): the top 10 averaged ¥4.7M in sales, the top 30 ¥2.6M, and the top 100 ¥1.2M — [Appllio (2014)](https://appllio.com/20140611-5341-line-creators-market-stamp-revenue)
- Recent individual reports (self-reported):
  - 548 sets on sale earned **¥565 in 2 months**, with only 9 sets sold — [libecity (2026-10-06)](https://library.libecity.com/articles/01M44ZXE5K9RT42PEBV23TF452)
  - Another creator's first set made ¥120 in 3 months. A later set exceeded ¥30K/month after the creator built recognition on SNS — [atsoho character LINE stamp](https://atsoho.com/blog/character-line-stamp) (low-reliability source)
- LINEスタンプ プレミアム is a subscription from ¥240/month covering 15M+ stamps. Its per-use creator payout formula was not found — [Impress Watch](https://www.watch.impress.co.jp/docs/news/1613449.html) (search summary attribution)

**Goods (SUZURI)**
- Secondary sources say SUZURI charges creators no fees. Creators set their own margin (トリブン), which is added on top of the base price; a 2014 review showed a ¥500 トリブン raising the item price by ¥500. The current cap and base prices were not verified — [GIGAZINE (2014)](https://gigazine.net/news/20140429-suzuri/); [AppBank (2024)](https://www.appbank.net/2024/10/28/iphone-application/2747350.php)
- SUZURI passed 1M registered creators — [CommercePick](https://www.commercepick.com/archives/88747)

### Inferences
- **Most dependable path for a viral diagnosis creator:** use the viral hit as a portfolio, then sell sponsored or co-branded diagnoses to brands, municipalities, and media. Vendor list prices of ¥150K–400K+ per diagnosis set a market anchor, and an indie site with demonstrated reach could plausibly charge comparable or higher fees, since its own audience is included. The tie-up must carry 「PR」/「広告」 labels; see Q4 on ステマ.
- **LINE stamps work only once the characters are recognized.** At a 35% share, a ¥120 stamp set yields ~¥42 per sale, so ¥100K/month needs ~2,400 set sales/month. Treat stamps as brand extension rather than core revenue, and avoid putting the site URL or name in stamps in a way that reads as promotion, given the guideline.
- **Paid detailed or compatibility reports at ¥100–500 can work technically**, but trigger 特商法 display obligations (Q4). Japanese social audiences skew young, so conversion is likely low (no data found). The AdSense Offerwall or rewarded ads may be a lower-friction substitute for gating "詳細結果".
- **A B2B pivot to team-building or HR diagnosis** competes with established ¥500–1,500/person tools. It only makes sense if the diagnosis has a credible framework, not a 16Personalities clone.

### Gaps
- No verified sales numbers were found for paid detailed reports or compatibility reports from Japanese viral diagnosis sites, or for 16Personalities' premium products.
- No current (2025–2026) official LINE Creators Market revenue-share page or LINEスタンプ プレミアム payout formula was retrieved; the Q&A pages were not fetched.
- The SUZURI official トリブン cap, base prices, and payout fees were not retrieved (the help page fetch lacked the details).
- No published pricing was found for sponsored diagnoses placed on an indie creator's site, as distinct from vendor production fees.
- No data was found on app-store versions of diagnosis apps.

---

## Q3. Cost structure at viral scale and how to avoid bill shock

### Takeaway
At ~19M PV/month, **static and edge-cached hosting on Cloudflare costs single-digit USD**, while Vercel Pro can reach hundreds to thousands of USD depending on page weight. The bigger risk is **per-user generation**:
- **Text:** cheap LLMs (gpt-5-nano, gemini-2.5-flash-lite, Claude Haiku 5.5) cost about ¥70–100 per 1M diagnoses at modest token counts. Mid-tier models cost ¥350K–2M per 1M diagnoses, which can exceed peak ad revenue.
- **Images:** per-user AI image generation costs ¥5–10+ per image, i.e. ¥5–10M per 1M users. That is far above per-user ad revenue (~¥0.3–6).

So results should be precomputed and cached per type, and AI generation should be capped or paid.

### Cited Findings
**Vercel** (USD)
- Hobby is free and "for personal, non-commercial use". Hobby has usage caps and cannot buy additional usage.
- Pro is $20/mo with $20 of usage credit included:
  - CDN requests: 10M/month included, then from $2 per 1M.
  - Fast Data Transfer: 1 TB/month included, then from $0.15/GB.
  - Function invocations from $0.60 per 1M; Fluid Active CPU from $0.128/hr.
  - Image Optimization transformations from $0.05 per 1K; ISR writes from $4 per 1M.
- Spend management: Pro is uncapped pay-as-you-go by default. Each new team gets a default on-demand budget of $200 with email/web/SMS alerts, and can optionally auto-pause all projects at 100% of budget (hard limit). Attack Challenge Mode is also available.

Source: [Vercel Pricing](https://vercel.com/pricing)

**Cloudflare Workers** (USD)
- Free plan: 100K requests/day.
- Paid plan:
  - Base: $5/month minimum.
  - Requests: 10M/month included, then $0.30 per additional million.
  - CPU: 30M CPU-ms included, then $0.02 per million CPU-ms.
- **Static asset requests are free and unlimited** on both plans.

Source: [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

**Cloudflare R2 and Workers KV** (USD)
- R2: storage $0.015/GB-month; Class A operations $4.50/M; Class B operations $0.36/M; free tier of 10 GB, 1M Class A, and 10M Class B; **egress free**.
- Workers KV paid: 10M reads included, then $0.50/M; writes $5/M.
- Pages Functions are billed as Workers.

Source: [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

**Supabase** (USD)
- Free plan: 500 MB DB, 5 GB egress, 50K MAU, paused after 1 week of inactivity.
- Pro plan:
  - Price: from $25 with $10 of compute credit.
  - Included: 8 GB disk, 250 GB egress, 100K MAU.
  - Overage: egress $0.09/GB, MAU $0.00325 each.
  - **Spend caps are on by default.**

Source: [Supabase Pricing](https://supabase.com/pricing)

**LLM text prices (USD per 1M tokens, standard tier, as of Oct 2026)**
- OpenAI: gpt-5-nano $0.05 in / $0.40 out; gpt-6-luna $0.10 / $0.50; gpt-4o-mini $0.15 / $0.60; gpt-5.6-luna $0.20 / $1.20; gpt-5-mini $0.25 / $2.00; gpt-4.1-mini $0.40 / $1.60 — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- Google:
  - gemini-2.5-flash-lite $0.10 / $0.40; gemini-3.1-flash-lite $0.25 / $1.50; gemini-3.5-flash-lite $0.30 / $2.50; gemini-2.5-flash $0.30 / $2.50.
  - gemini-3.6-flash and gemini-3.8-flash are $0.75 / $3.75 through 2026-12-31, rising to $1.50 / $7.50 from 2027-01-01.
  - A free tier exists for these text models, but **free-tier content is used to improve Google's products**; paid-tier content is not.
  - Batch/Flex tiers cost about half of Standard.

  Source: [Gemini API pricing (page updated 2026-10-22)](https://ai.google.dev/gemini-api/docs/pricing)
- Anthropic:
  - Claude Haiku 5.5 $0.10 in / $0.50 out for prompts ≤100K tokens, with cache hits at $0.01/MTok.
  - Claude Haiku 4.5 $1 / $5; Claude Sonnet 5.5 $2 / $10; Claude Opus 5.5 $4 / $20.
  - The Batch API gives 50% off.
  - Claude 4.7 and later models use a newer tokenizer producing ~30% more tokens for the same text.

  Source: [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing)

**Image generation prices (USD)**
- Google, per image:
  - gemini-3.1-flash-lite-image $0.0336 (1K).
  - gemini-3.1-flash-image (Nano Banana 2) $0.045 (0.5K), $0.067 (1K), $0.101 (2K).
  - gemini-3-pro-image $0.134 (1K/2K).
  - gemini-2.5-flash-image $0.039, deprecated with shutdown scheduled for 2026-10-02.

  Source: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- OpenAI, token-based: gpt-image-1-mini image output $8.00/1M tokens; gpt-image-1 $40.00/1M; gpt-image-2 $30.00/1M. Per-image prices are not listed; OpenAI points to its calculator — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

**Practitioner note**
- Calling an LLM on every keystroke or interaction exhausts free tiers and multiplies cost. Debouncing or limiting calls is the standard fix — [GitHub vercel/examples discussion #856](https://github.com/vercel/examples/discussions/856)

### Inferences (cost model — my calculations from the prices above; USD 1 = JPY 150)
**LLM text cost per 1M diagnoses**, assuming 1,500 input + 1,000 output tokens per diagnosis. Japanese token counts vary by tokenizer.

| Model | Cost per diagnosis | Per 1M diagnoses (USD) | Per 1M diagnoses (JPY) |
|---|---|---|---|
| gpt-5-nano | ~$0.000475 | $475 | ≈¥71K |
| gemini-2.5-flash-lite | | $550 | ≈¥83K |
| Claude Haiku 5.5 | | $650 | ≈¥98K (more if the ~30% tokenizer inflation applies) |
| gpt-5-mini | | $2,375 | ≈¥356K |
| gemini-3.6-flash (2026 pricing) | | $4,875 | ≈¥731K (doubles in 2027) |
| Claude Sonnet 5.5 | | $13,000 | ≈¥1.95M |

- Compare ad revenue per diagnosis. If one diagnosis is ~3 PV at the benchmark's peak RPM of ¥105, it earns ≈¥0.32. A nano or flash-lite model then costs ≈¥0.07–0.08 per diagnosis, about 20–25% of ad revenue. A Sonnet-class model costs ≈¥2, about 6x revenue, which is a loss.
- **So the default should be precomputed result texts per type**, for example 16–64 types written once and cached at the edge. LLMs should be used only for optional personalized flourishes with caching, rate limits, and a cheap model, or behind a paid or rewarded gate.

**Image generation:** at $0.0336–0.067 per image, 1M users cost $33.6K–67K ≈ **¥5–10M**, which is 2.5–5x the benchmark's best month of AdSense revenue. Per-user AI images (for example "AIであなたをキャラ化") are only viable as a paid feature (a ¥300 image yields a positive margin) or tightly rate-limited. Alternatives are composited templates (pre-drawn parts plus text) or client-side canvas.

**Hosting at 19M PV/month:**
- **Vercel Pro**, illustrative, assuming 15 CDN requests and 0.5 MB transferred per PV:
  - CDN requests: (285M − 10M) × $2 = $550.
  - Transfer: (9,500 GB − 1,000 GB) × $0.15 = $1,275.
  - Total ≈ $1,850 + $20 base ≈ **¥280K/month**.
  - The "from" rates are minimums, so the real bill could be higher.
  - The benchmark's reported ~¥70K/month total suggests much lighter pages or offloaded assets.
- **Cloudflare Workers Paid**, with static assets free and one Worker request plus ~5 ms CPU per PV:
  - Requests: (19M − 10M) × $0.30 ≈ $2.7.
  - CPU: (95M − 30M CPU-ms) × $0.02/M ≈ $1.3.
  - Plus the $5 base, total ≈ **$9 ≈ ¥1,400/month**.
  - This explains the benchmark seller's move to Workers and R2: R2 has free egress, and the R2 read free tier covers 10M reads.

**OGP images at scale:**
- Generate one OGP image **per result type**, pre-rendered and stored in R2 or static assets, rather than one per user. Social crawlers fetch OGP per URL, so per-user dynamic OGP multiplies renders and cache misses.
- If per-user OGP is needed (with the user's name on the card), render it once in a Worker (satori/resvg-style) and cache it in R2. At ~100 CPU-ms per render, 1M renders ≈ 100M CPU-ms ≈ $2 on Workers, which is negligible compared with LLM or image-model calls.
- Note that the Workers Free plan allows only 10 ms CPU per invocation.

**Bill-shock checklist:**
1. Use Vercel's on-demand budget with the auto-pause hard limit, or avoid Vercel for spike-prone traffic.
2. Keep Supabase's default spend cap on.
3. Set provider-side budgets/limits on LLM API keys (not verified for each provider in this research) and a server-side daily cap on generation calls with graceful fallback to precomputed text.
4. Avoid DB writes per page view. Write only aggregated counters, or use Workers Analytics or KV with batching.
5. Do not use Vercel Image Optimization for user-uploaded images at scale.
6. Do not send personal data to Gemini's free tier, since it is used for product improvement.

### Gaps
- Whether Cloudflare offers a hard spend cap on Workers Paid was not verified.
- OpenAI per-image cost for gpt-image-1-mini / gpt-image-2 needs the calculator, since tokens per image were not retrieved.
- The provider-side budget/hard-limit features for OpenAI, Anthropic, and Google projects were not verified in this research.
- Real-world bytes/requests per PV for a typical diagnosis SPA were not measured, so the Vercel estimate is illustrative only.

---

## Q4. Legal / IP / policy risks in Japan

### Takeaway
The highest-risk choices are:
1. using **"MBTI"** in the product or brand name, or implying an official MBTI test;
2. copying **16Personalities' type nicknames, descriptions, or illustrations**;
3. using **anime/celebrity images or likenesses** in results or goods;
4. **paid influencer seeding without 「PR」 labeling** — Japan's 2023 stealth-marketing rules now have a direct app precedent, the SNOW measure order of 2026-08-06;
5. collecting **face photos, names, or birthdays (including minors')** without a proper purpose specification and privacy policy.

Original frameworks and original characters, a "for entertainment" disclaimer, 特商法 compliance for any paid tier, and data minimization address most of these. Trademark and privacy design should be reviewed by counsel (弁理士/弁護士).

### Cited Findings
**MBTI**
- The Myers-Briggs Company's trademark page: "Myers-Briggs Type Indicator, Myers-Briggs, … MBTI, … the MBTI logo" are "trademarks or registered trademarks of Myers & Briggs Foundation, Inc. in the United States and other countries" — [The Myers-Briggs Company: Trademarks](https://themyersbriggs.com/en-US/Support/Trademarks)
- The Myers-Briggs Company's website guidelines ask customers to apply trademark symbols, use trademarked names as adjectives, include acknowledgments, and not post product logos — [The Myers-Briggs Company: Website guidelines](https://themyersbriggs.com/en-US/Support/Website-Guidelines) (from search summary)
- Japan's licensee and steward, 一般社団法人日本MBTI協会:
  - Its footer states MBTI and Myers-Briggs Type Indicator are registered trademarks of the Myers & Briggs Foundation in the US and other countries, adds "無断の転載は一切認められません", and says some illustrations have trademark applications pending.
  - It states that country-specific administration guidelines apply and that Japanese MBTI feedback must take at least 2 hours (under 2 hours is an ethical violation, acknowledged by CPP).

  Source: [日本MBTI協会: for users](http://www.mbti.or.jp/about/for-users/)
- On 2023-03-23 the 協会 published 「16Personalities性格診断テストを『MBTI®』だと思って受けられた方へ」: "16Personalities性格診断テストは、MBTIとは全く別のもので、質問も結果の出し方も、正式なMBTIとは全く異なります". J-CAST reports that "MBTI" is a registered trademark in Japan — [J-CAST (2023-07-03)](https://www.j-cast.com/2023/07/03464452.html?p=all)
- 16Personalities is operated by NERIS Analytics Limited (UK). Its official AI-reference page lists "Official 16Personalities terminology, individual personality type names and descriptions, personality type nicknames" as its own content. The terms page returned 403, so the IP clauses were not read — [16Personalities: for AI](https://www.16personalities.com/for-ai) (search snippet)

**Publicity rights and character copyright**
- The Supreme Court's ピンク・レディー judgment (2012-02-02) recognized publicity rights as the exclusive right to the customer-attracting power of one's name or likeness. Infringement requires use "専ら" (solely) to exploit that power, for example (1) likeness used as an independently appreciated item such as character goods (T-shirts, mugs), (2) attached to goods for differentiation, or (3) used in advertising. The search confirmed type (1) explicitly; types (2)–(3) are from my knowledge of the judgment and should be verified — [MC Law article](https://www.mc-law.jp/kigyohomu/15900/); [Hokkaido Univ. paper](https://eprints.lib.hokudai.ac.jp/repo/huscap/all/52427/42_08.pdf)

**AI-generated images**
- The Agency for Cultural Affairs published 「AIと著作権に関する考え方について」 (2024-03-15) and a checklist and guidance (2024-07-31) — [文化庁: AIと著作権](https://www.bunka.go.jp/seisaku/chosakuken/aiandcopyright.html)
- Press summaries of that position:
  - Output generated autonomously by AI is not a copyrighted work. Human creative contribution can make output a work, and human edits are protected.
  - Infringement by AI output is judged by the usual 依拠性 (reliance) and 類似性 (similarity), with character or style resemblance a grey zone.

  Source: [GameBusiness.jp (2024-04-19)](https://www.gamebusiness.jp/article/2024/04/19/22981.html)

**Stealth-marketing rules (ステマ規制, 景品表示法)**
- In force since 2023-10-01: "広告であるにもかかわらず、広告であることを隠すこと".
- **Only the business operator (advertiser) is regulated.** "企業から広告・宣伝の依頼を受けたインフルエンサー等の第三者は規制の対象とはなりません".
- Content that a company asks or instructs a third party to post counts as the company's advertising. This covers SNS posts and reviews.

Source: [消費者庁: ステルスマーケティング](https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/)

- Merely providing free products is not automatically covered. The key test is whether the business was involved in the content, judged from communications, compensation, and the relationship — [data-max (2023)](https://data-max.co.jp/article/62920); [Monolith Law](https://monolith.law/corporate/stealth-marketing-regulations-r5)
- **SNOW case (2026-08-06):**
  - The Consumer Affairs Agency issued a 措置命令 against Snow Corporation and SNOW Japan.
  - Around April 2025 they paid influencers to post 「SNOWでやってみた」-style posts with app-processed images, without ad disclosure — [熊本日日新聞 (Kyodo)](https://kumanichi.com/articles/2022748)
  - A commentary says 70+ X posts were involved, some still displayed until June 2026, and that the company scripting the text was central to the finding — [hashout.jp](https://hashout.jp/sns/8510/)
- An earlier precedent: chocoZAP (2024) received an order over influencer posts — [AdverTimes (2024-12-09)](https://www.advertimes.com/20241209/article482069/2/)

**Fortune and diagnosis claims and paid tiers**
- Japan's National Consumer Affairs Center (国民生活センター) warns about "free reading" fortune sites that funnel users into paid point-based chats and large payments — [国民生活センター](https://www.kokusen.go.jp/t_box/data/t_box-faq_qa2021_15.html)
- A blog summary says that under 景表法, assertive or guaranteeing claims ("必ず当たる", effect guarantees) risk 優良誤認, and testimonial-style fortune ads are under ステマ scrutiny — [atsoho (2026)](https://atsoho.com/blog/fortune-telling-ad-expression-rules) (low-reliability source)
- 特定商取引法 (online sales) requires displaying:
  - price, payment timing and method, delivery timing, cancellation/return terms, and business name, address, and phone;
  - for corporations, the responsible person's name;
  - software operating environment where applicable.

  The **final confirmation screen** must show quantity, price, payment, delivery, application period, and cancellation terms, and must not be misleading — [消費者庁 特商法ガイド: 通信販売](https://www.no-trouble.caa.go.jp/what/mailorder/)

**Personal data (個人情報保護法)**
- Personal information is "not limited to" names, addresses, sex, birth dates, and **facial images (顔画像)** — any information identifying a person.
- Facial features extracted for authentication by devices or software are a 個人識別符号 (Guideline 2-2).
- The purpose of use must be specified "できる限り" (Art. 17) and notified or published upon acquisition (Art. 21).
- Third-party provision needs prior consent (Art. 27), with separate rules for foreign third parties (Art. 28).

Source: [個人情報保護委員会 ガイドライン(通則編)](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)

- Minors: "一般的には12歳から15歳までの年齢以下の子どもについて、法定代理人等から同意を得る必要がある" — [PPC Q&A 1-62](https://www.ppc.go.jp/all_faq_index/faq1-q1-62/)
- Gemini API free-tier content is used to improve Google's products, so sending user inputs there is a data-handling issue — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

**Platform rules**
- AdSense: no encouraged clicks, no paid-to-click traffic, no navigation-like ad placement (see Q1) — [AdSense プログラム ポリシー](https://support.google.com/adsense/answer/48182?hl=ja)
- LINE: paid stickers cannot be for promotional purposes — [LINE sticker guideline](https://creator.line.me/ja/guideline/sticker/)
- TikTok:
  - A clickable profile link reportedly requires 1,000+ followers on a personal account, or a free switch to a business account.
  - Business accounts are limited to commercially licensed music.
  - These are secondary sources, not TikTok's official help — [CKB](https://www.theckb.com/archive/how-to-add-a-tiktok-link/); [Smash Balloon JP](https://smashballoon.com/ja/how-to-add-a-link-in-tiktok-bio/)
- X:
  - In November 2024 Musk suggested putting links in replies, implying lower priority for link posts — [J-CAST (2024-11-26)](https://www.j-cast.com/2024/11/26498813.html?p=all)
  - In October 2025, X product head Nikita Bier denied that link posts are deboosted. He attributed lower reach to the in-app browser covering the post, which reduces engagement, and X tested keeping the post visible while a link is open — [roboin.io (2025-10-20)](https://roboin.io/article/2025/10/20/x-product-chief-denies-rumor-that-link-posts-are-deboosted)

### Inferences
- **MBTI:**
  - Avoid "MBTI" in the service name, domain, app name, LINE stamp titles, or goods, and do not claim "MBTI診断" or official status.
  - The risks are trademark use in trade, a 協会 complaint, and platform takedowns (app stores and LINE review commonly reject third-party trademarks).
  - Describing a result as "16タイプ風" or using an original typology is safer. Whether the four-letter codes (INTJ, etc.) are themselves registered in Japan is unverified, so goods printed with them need a J-PlatPat check.
  - Japan's 商標法 26条 descriptive-use defense might cover some mentions, but that is for counsel.
- **16Personalities:** do not copy their nicknames (e.g., 建築家/仲介者), descriptions, or illustration style. Write original type names and art. The risk is copyright, plus unfair-competition claims if the trade dress is confusing.
- **Celebrity/anime:**
  - "芸能人/キャラに例えると" results using photos or official art are high-risk, both as copyright and as publicity rights under the advertising category.
  - Text-only references are lower risk but still need care when monetized.
  - **Original characters are the safest and the only base that supports LINE stamps and goods.**
- **AI-generated character art:** may be weakly protected. Purely AI-generated images may not be copyrighted works, so copycats can reuse them. Human redrawing and editing strengthens protection, and avoiding prompts that name existing characters or artists reduces infringement risk.
- **Influencer seeding:**
  - If you pay or provide benefits **and** brief or script posts, the posts are your advertising and must carry 「PR」/「広告」.
  - SNOW is a near-identical fact pattern (an app, "やってみた" posts, scripted copy).
  - Organic UGC that users create without your involvement is not ステマ.
  - Encouraging sharing with prizes may also trigger 景品規制; not researched here.
- **Data minimization design:**
  - Compute results client-side and don't store names, birthdays, or photos.
  - If a face photo is processed, publish the purpose, say it is not stored or used for training, and avoid free-tier APIs that train on inputs.
  - Add an age gate or parental-consent language, given the 12–15 guidance.
  - Publish a privacy policy that names any overseas API providers; Art. 28 applicability needs counsel.
- **Disclaimers:** add 「本診断はエンターテインメントであり、医学的・心理学的診断ではありません」. Avoid "当たる" guarantees in ads. For any paid report, add a 特商法表記 page and a compliant final confirmation screen.

### Gaps
- The Japan registration numbers, classes, and holder for "MBTI" and the four-letter codes were not retrieved from J-PlatPat. J-CAST says it is registered in Japan; J-PlatPat needs a direct check.
- No known Japanese litigation or takedown against a free "MBTI診断" site was found.
- 16Personalities' terms of service (IP clauses) could not be read (403).
- The Consumer Affairs Agency's own press release on the SNOW order was not retrieved; the case details come from Kyodo and commentary.
- PPC Art. 28 (foreign third-party provision) applicability to sending inputs to US AI APIs — consignment (委託) versus provision — was not researched; counsel needed.
- 景品表示法 premium (景品) limits for share-to-win campaigns, and the official Instagram link-sticker and TikTok link rules, were not verified.

---

## Q5. M&A valuations of such sites and why buyers discount them

### Takeaway
On ラッコM&A, profitable ad-revenue sites historically sold for about **17–18x monthly profit**, with about 80% under 24x (data from 2020–2022, published 2023). A viral diagnosis site with steep traffic decay and pure AdSense dependence would likely be valued on post-decay profit, at a lower multiple. It may also fall outside the "ad site" statistics if it is classed as a "Webサービス".

### Cited Findings
- ラッコM&A analysis, published 2023-02-17, of 1,050 ad-revenue site deals closed 2020-01-07 to 2022-12-06 (excluding EC, accounts, and **Webサービス**):
  - Sites with ≥¥10K monthly profit (434 deals) sold at an average of **~17.8x monthly profit**.
  - Distribution: 40.8% at 12–24x, 28.8% at 6–12x, 21.9% at 24x+, 8.5% under 6x.
  - Sites with ¥1–10K profit averaged ~¥196K. Loss-making or zero-profit sites averaged ~¥140K, mostly ¥50K–300K.

  Source: [value-press (ラッコ, 2023-02-17)](https://www.value-press.com/pressrelease/313280)
- ラッコM&A seller fees have been free since 2020-03-06 — [kyodonewsprwire (2021)](https://kyodonewsprwire.jp/release/202102020516) (search summary)
- Listings with attached evidence files and Google Analytics integration correlated with higher closing rates. Cumulative deal value was ¥3.06B and cumulative listings 10,110 as of October 2024 — [ラッコ press releases via value-press / kyodonews](https://kyodonewsprwire.jp/release/202104213979) (search summary; exact figures not re-verified)

### Inferences
- **Benchmark valuation sketch:**
  - Current revenue is ~¥0.55M/month. If post-Cloudflare costs are ~¥20–50K (my assumption), monthly profit is ~¥0.5M.
  - At the historical 17.8x average, that gives ~¥9M.
  - Given a ~95% PV decline within months, buyers would likely apply 6–12x and use the last 3 months' average or the trend, giving ~¥3–6M. They may also request an earn-out.
- **What makes buyers discount:**
  1. Traffic decay: viral, single-spike traffic with no search or repeat base.
  2. AdSense dependence and account risk: limits, invalid-traffic history, non-transferability of the AdSense account.
  3. Infrastructure tied to the seller's accounts (Vercel, Supabase, API keys) and variable AI costs.
  4. IP risk: MBTI wording, copied 16Personalities content, celebrity or anime imagery.
  5. Unclear ownership of character art (AI-generated art may not be protected) and of LINE stamp accounts, which may not be transferable.
  6. Seasonality and short history.
  7. Personal data held without a privacy policy.
- **What supports value:** original characters with stamp and goods sales history, a B2B or tie-up pipeline, owned channels (SNS accounts, LINE official account), search traffic, and low fixed costs.

### Gaps
- No 2025–2026 official ラッコ multiple data was retrieved. A third-party summary cites 2025 deals of 1,578 totaling ~¥1.15B, and 2024 official figures of 1,678 deals totaling ~¥1.19B, but the source URL was not confirmed, so these figures are excluded from findings.
- No disclosed sale prices of Japanese diagnosis sites specifically were found.
- Whether ラッコ classifies diagnosis sites as "サイト" or "Webサービス", which affects which statistics apply, is unknown.
- Transferability of AdSense accounts and LINE Creators Market accounts on sale was not researched.
