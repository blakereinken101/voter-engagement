/**
 * Google Ads Campaign Setup Script
 *
 * Sets up the full Threshold ad campaign structure:
 *   - 3 campaigns (Search, Remarketing, Brand)
 *   - Ad groups with keywords and responsive search ads
 *   - Conversion tracking for demo bookings
 *
 * Prerequisites:
 *   1. Google Ads account created at ads.google.com
 *   2. Google Ads API developer token (Settings > API Center)
 *   3. Google Cloud project with Google Ads API enabled
 *   4. OAuth2 credentials (Client ID + Secret)
 *   5. Refresh token obtained via OAuth2 flow
 *
 * Usage:
 *   GOOGLE_ADS_CLIENT_ID=... \
 *   GOOGLE_ADS_CLIENT_SECRET=... \
 *   GOOGLE_ADS_REFRESH_TOKEN=... \
 *   GOOGLE_ADS_DEVELOPER_TOKEN=... \
 *   GOOGLE_ADS_CUSTOMER_ID=... \
 *   node scripts/google-ads/setup-campaigns.mjs
 *
 * Or set these in .env.local and run:
 *   node -e "require('dotenv').config({path:'.env.local'})" && node scripts/google-ads/setup-campaigns.mjs
 */

import { GoogleAdsApi, enums, ResourceNames } from 'google-ads-api';

// ─── Config ────────────────────────────────────────────────

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !DEVELOPER_TOKEN || !CUSTOMER_ID) {
  console.error('Missing required environment variables. See script header for details.');
  process.exit(1);
}

const client = new GoogleAdsApi({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  developer_token: DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: CUSTOMER_ID,
  refresh_token: REFRESH_TOKEN,
});

// ─── Budget Configs ────────────────────────────────────────

const DAILY_BUDGETS = {
  search: 47_00,       // $47/day (~$1,400/mo = 70% of $2K)
  remarketing: 13_00,  // $13/day (~$400/mo = 20% of $2K)
  brand: 7_00,         // $7/day (~$200/mo = 10% of $2K)
};

// ─── Campaign Data ─────────────────────────────────────────

const CAMPAIGN_CONFIG = {
  search: {
    name: 'Threshold - Search - Demo Bookings',
    budget: DAILY_BUDGETS.search,
    adGroups: [
      {
        name: 'Campaign Tools',
        cpcBid: 5_00, // $5.00
        keywords: [
          { text: 'campaign management software', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'political campaign tools', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'campaign organizing software', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'voter engagement platform', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'campaign volunteer management', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'field organizing tools', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'campaign technology solutions', matchType: enums.KeywordMatchType.BROAD },
        ],
        ads: [
          {
            headlines: [
              'AI-Powered Campaign Tools',
              'Automate Data Entry & Coaching',
              'Book a Free Demo Today',
              'Built for How Campaigns Run',
              'VoteBuilder-Ready Exports',
            ],
            descriptions: [
              "Threshold's AI coach helps volunteers work their networks, match voters, and know exactly who to call and what to say.",
              'Replace manual data entry with AI. Volunteers talk, Threshold logs everything. See it in action — book a free demo.',
            ],
            finalUrl: 'https://thresholdvote.com/demo',
            path1: 'demo',
            path2: 'campaign-tools',
          },
          {
            headlines: [
              'Stop Losing Volunteer Data',
              'AI Handles the Busywork',
              'Free Demo — No Contracts',
              'Purpose-Built for Campaigns',
              'Relational Organizing + AI',
            ],
            descriptions: [
              "Volunteers hate filling out forms. Threshold's AI listens to conversation recaps and logs contacts, outcomes, and surveys.",
              'Built by organizers, for organizers. Turn messy real-world input into clean, structured campaign data.',
            ],
            finalUrl: 'https://thresholdvote.com/demo',
            path1: 'demo',
            path2: 'free',
          },
        ],
      },
      {
        name: 'Relational Organizing',
        cpcBid: 4_50, // $4.50
        keywords: [
          { text: 'relational organizing tools', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'relational organizing software', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'relational organizing app', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'friend to friend organizing', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'personal network voter outreach', matchType: enums.KeywordMatchType.BROAD },
          { text: 'volunteer network mapping', matchType: enums.KeywordMatchType.BROAD },
        ],
        ads: [
          {
            headlines: [
              'Relational Organizing, Supercharged',
              "AI Maps Volunteers' Networks",
              '10x More Effective Than Mailers',
              'Book Your Free Demo',
              'Uncover Hidden Connections',
            ],
            descriptions: [
              'A personal ask from someone you trust is 10x more effective than a mailer. Give volunteers voter data and personalized coaching.',
              "AI-guided rolodexing discovers connections volunteers forgot they had. Friends, family, coworkers — matched to the voter file.",
            ],
            finalUrl: 'https://thresholdvote.com/demo',
            path1: 'demo',
            path2: 'relational',
          },
        ],
      },
      {
        name: 'VAN Alternative',
        cpcBid: 5_50, // $5.50 — higher intent
        keywords: [
          { text: 'votebuilder alternative', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'van alternative campaign', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'campaign data entry solution', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'voter file management tool', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'everyaction alternative organizing', matchType: enums.KeywordMatchType.BROAD },
        ],
        ads: [
          {
            headlines: [
              'Love VAN? Hate the Data Entry?',
              'AI Fills It In For You',
              'VoteBuilder-Ready Exports',
              'Works Alongside VAN',
              'Book a Free Demo',
            ],
            descriptions: [
              "Threshold works alongside VAN. Volunteers talk to the AI coach, clean data flows straight into VoteBuilder-ready exports.",
              'No more chasing volunteers for canvass results. AI captures contacts, outcomes, and survey responses automatically.',
            ],
            finalUrl: 'https://thresholdvote.com/demo',
            path1: 'demo',
            path2: 'van-ready',
          },
        ],
      },
      {
        name: 'Competitor Comparison',
        cpcBid: 4_00, // $4.00
        keywords: [
          { text: 'mobilize alternative', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'mobilize events cheaper', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'campaign event platform affordable', matchType: enums.KeywordMatchType.BROAD },
          { text: 'hustle alternative texting', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'reach alternative campaign', matchType: enums.KeywordMatchType.BROAD },
        ],
        ads: [
          {
            headlines: [
              'Events — 50-75% Less Than Mobilize',
              'No Per-Event Fees. No Contracts.',
              'Start Free Today',
              'Built for Progressive Campaigns',
              'AI-Powered Event Management',
            ],
            descriptions: [
              'Shareable event pages, RSVPs, email reminders, and team coordination. Purpose-built for campaigns at a fraction of the cost.',
              'Free tier includes 2 events with AI writing. No annual contracts, no hidden fees. Upgrade when ready.',
            ],
            finalUrl: 'https://thresholdvote.com/events/pricing',
            path1: 'events',
            path2: 'pricing',
          },
        ],
      },
    ],
  },
  brand: {
    name: 'Threshold - Brand',
    budget: DAILY_BUDGETS.brand,
    adGroups: [
      {
        name: 'Brand Terms',
        cpcBid: 2_00, // $2.00 — cheap brand defense
        keywords: [
          { text: 'threshold vote', matchType: enums.KeywordMatchType.EXACT },
          { text: 'thresholdvote', matchType: enums.KeywordMatchType.EXACT },
          { text: 'threshold campaign tools', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'threshold organizing', matchType: enums.KeywordMatchType.PHRASE },
          { text: 'threshold voter engagement', matchType: enums.KeywordMatchType.PHRASE },
        ],
        ads: [
          {
            headlines: [
              'Threshold — Official Site',
              'AI-Powered Campaign Tools',
              'Book a Free Demo',
              'Relational Organizing Platform',
              'Built for Campaigns',
            ],
            descriptions: [
              "Threshold is the AI-powered organizing platform built for how campaigns actually run. Book your free 15-minute demo.",
              'AI coach, voter file matching, automated data entry, VoteBuilder exports. Purpose-built for progressive campaigns.',
            ],
            finalUrl: 'https://thresholdvote.com',
            path1: '',
            path2: '',
          },
        ],
      },
    ],
  },
};

// ─── Negative Keywords ─────────────────────────────────────

const NEGATIVE_KEYWORDS = [
  'free campaign templates',
  'campaign finance',
  'campaign contribution',
  'political donation',
  'voter registration card',
  'how to vote',
  'election results',
  'campaign yard signs',
  'campaign merchandise',
  'republican campaign',
  'conservative campaign',
  'trump campaign',
  'campaign internship',
  'campaign job',
  'political science',
  'campaign definition',
  'marketing campaign',
  'ad campaign',
  'email campaign',
];

// ─── Main Setup ────────────────────────────────────────────

async function createBudget(name, amountMicros) {
  const budget = await customer.campaignBudgets.create([
    {
      name: `${name} Budget`,
      amount_micros: amountMicros * 10000, // Convert cents to micros
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
    },
  ]);
  console.log(`  Created budget: ${name} ($${amountMicros / 100}/day)`);
  return budget.results[0].resource_name;
}

async function createCampaign(name, budgetResourceName, type = 'SEARCH') {
  const campaignData = {
    name,
    campaign_budget: budgetResourceName,
    advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
    status: enums.CampaignStatus.PAUSED, // Start paused for review
    manual_cpc: { enhanced_cpc_enabled: true },
    network_settings: {
      target_google_search: true,
      target_search_network: true,
      target_content_network: type === 'DISPLAY',
    },
    // Target United States
    geo_target_type_setting: {
      positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
    },
  };

  const campaign = await customer.campaigns.create([campaignData]);
  const resourceName = campaign.results[0].resource_name;
  console.log(`  Created campaign: ${name} (PAUSED)`);
  return resourceName;
}

async function createAdGroup(campaignResourceName, name, cpcBidMicros) {
  const adGroup = await customer.adGroups.create([
    {
      campaign: campaignResourceName,
      name,
      cpc_bid_micros: cpcBidMicros * 10000,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  ]);
  const resourceName = adGroup.results[0].resource_name;
  console.log(`    Created ad group: ${name}`);
  return resourceName;
}

async function createKeywords(adGroupResourceName, keywords) {
  const criterionOps = keywords.map((kw) => ({
    ad_group: adGroupResourceName,
    keyword: {
      text: kw.text,
      match_type: kw.matchType,
    },
    status: enums.AdGroupCriterionStatus.ENABLED,
  }));

  await customer.adGroupCriteria.create(criterionOps);
  console.log(`      Added ${keywords.length} keywords`);
}

async function createResponsiveSearchAd(adGroupResourceName, adConfig) {
  const ad = {
    ad_group: adGroupResourceName,
    ad: {
      responsive_search_ad: {
        headlines: adConfig.headlines.map((text, i) => ({
          text,
          pinned_field: i === 0 ? enums.ServedAssetFieldType.HEADLINE_1 : undefined,
        })),
        descriptions: adConfig.descriptions.map((text) => ({ text })),
        path1: adConfig.path1 || undefined,
        path2: adConfig.path2 || undefined,
      },
      final_urls: [adConfig.finalUrl],
    },
    status: enums.AdGroupAdStatus.ENABLED,
  };

  await customer.adGroupAds.create([ad]);
  console.log(`      Created responsive search ad`);
}

async function addNegativeKeywords(campaignResourceName) {
  const negativeOps = NEGATIVE_KEYWORDS.map((text) => ({
    campaign: campaignResourceName,
    keyword: {
      text,
      match_type: enums.KeywordMatchType.PHRASE,
    },
    negative: true,
  }));

  await customer.campaignCriteria.create(negativeOps);
  console.log(`    Added ${NEGATIVE_KEYWORDS.length} negative keywords`);
}

async function addLocationTargeting(campaignResourceName) {
  // Target United States (geo target constant ID: 2840)
  await customer.campaignCriteria.create([
    {
      campaign: campaignResourceName,
      location: {
        geo_target_constant: ResourceNames.geoTargetConstant(2840),
      },
      negative: false,
    },
  ]);
  console.log(`    Targeting: United States`);
}

async function main() {
  console.log('=== Threshold Google Ads Campaign Setup ===\n');

  try {
    // ─── Search Campaign ───────────────────────────────────
    console.log('1. Setting up Search campaign...');
    const searchBudget = await createBudget('Search', CAMPAIGN_CONFIG.search.budget);
    const searchCampaign = await createCampaign(CAMPAIGN_CONFIG.search.name, searchBudget);
    await addLocationTargeting(searchCampaign);
    await addNegativeKeywords(searchCampaign);

    for (const group of CAMPAIGN_CONFIG.search.adGroups) {
      const adGroupResource = await createAdGroup(searchCampaign, group.name, group.cpcBid);
      await createKeywords(adGroupResource, group.keywords);
      for (const ad of group.ads) {
        await createResponsiveSearchAd(adGroupResource, ad);
      }
    }

    // ─── Brand Campaign ────────────────────────────────────
    console.log('\n2. Setting up Brand campaign...');
    const brandBudget = await createBudget('Brand', CAMPAIGN_CONFIG.brand.budget);
    const brandCampaign = await createCampaign(CAMPAIGN_CONFIG.brand.name, brandBudget);
    await addLocationTargeting(brandCampaign);

    for (const group of CAMPAIGN_CONFIG.brand.adGroups) {
      const adGroupResource = await createAdGroup(brandCampaign, group.name, group.cpcBid);
      await createKeywords(adGroupResource, group.keywords);
      for (const ad of group.ads) {
        await createResponsiveSearchAd(adGroupResource, ad);
      }
    }

    // ─── Remarketing Campaign (manual setup needed) ────────
    console.log('\n3. Remarketing campaign...');
    console.log('   Note: Remarketing requires audience lists which need the Google Ads tag');
    console.log('   installed on thresholdvote.com first. Set up manually in Google Ads UI after');
    console.log('   the tag collects ~100 visitors (usually 1-2 weeks).');

    console.log('\n=== Setup Complete ===');
    console.log('\nNext steps:');
    console.log('  1. Review campaigns in Google Ads UI (they are PAUSED)');
    console.log('  2. Install Google Ads tag on thresholdvote.com (see scripts/google-ads/install-tag.mjs)');
    console.log('  3. Set up conversion tracking for demo bookings');
    console.log('  4. Enable campaigns when ready to go live');
    console.log('  5. Set up remarketing after tag collects 100+ visitors');
  } catch (err) {
    console.error('Setup failed:', err.message);
    if (err.errors) {
      for (const e of err.errors) {
        console.error('  -', e.message || JSON.stringify(e));
      }
    }
    process.exit(1);
  }
}

main();
