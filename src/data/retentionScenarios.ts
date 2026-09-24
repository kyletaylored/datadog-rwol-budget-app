/**
 * Contextual retention-filter scenario library.
 *
 * Grounded in the "RUM Retention Filters" course content (tail-based
 * sampling, filter order/priority, retention rate) — see
 * `_reference/rum_retention_filters.md`. These are starting points a TSE
 * tunes with the customer, not prescriptive defaults.
 */

export type RumAppType = 'browser' | 'ios' | 'andriod' | 'react-native' | 'flutter';

export type Industry = 'ecommerce' | 'fintech' | 'media' | 'saas' | 'generic';

export type RetentionScenario = {
    id: string;
    label: string;
    description: string;
    rationale: string;
    eventType: 'session' | 'view' | 'action' | 'error' | 'resource' | 'long_task' | 'vital';
    suggestedQuery: string;
    /** Suggested starting sample rate, 0-100. */
    suggestedSampleRate: number;
    /** Rough estimate of the % of ingested sessions this query matches, 0-100. TSE should adjust with real data. */
    suggestedPctOfSessions: number;
    /** Whether this filter would typically also retain Session Replay recordings by default. */
    defaultReplayEnabled: boolean;
    appTypes: RumAppType[];
    industries: Industry[];
};

export const RETENTION_SCENARIOS: RetentionScenario[] = [
    {
        id: 'errors-any',
        label: 'Sessions with any error',
        description: 'Retain sessions containing at least one RUM error, regardless of app.',
        rationale:
            'Errors are the single highest-signal event for support and debugging. Under head-based sampling these were lost whenever a session was sampled out before an error occurred; tail-based retention keeps them every time.',
        eventType: 'session',
        suggestedQuery: '@type:session @session.error.count:>0',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 5,
        defaultReplayEnabled: true,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'crash-sessions',
        label: 'Crash sessions',
        description: 'Retain any mobile session that ends in a native crash.',
        rationale:
            'Crash sessions are rare but critical for stability triage; losing them to head-based sampling directly hides reliability regressions from the team responsible for fixing them.',
        eventType: 'session',
        suggestedQuery: '@type:session @error.is_crash:true',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 1,
        defaultReplayEnabled: true,
        appTypes: ['ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'poor-core-web-vitals',
        label: 'Poor Core Web Vitals',
        description: 'Retain sessions where LCP, CLS, or INP breach a "poor" threshold on any view.',
        rationale:
            'Performance-outlier sessions are exactly the ones a performance team wants to investigate, but they are the ones most likely to be discarded by a flat sample rate since they are a minority of total traffic.',
        eventType: 'session',
        suggestedQuery: '@type:session @view.largest_contentful_paint:>2500 OR @view.cumulative_layout_shift:>0.25',
        suggestedSampleRate: 50,
        suggestedPctOfSessions: 10,
        defaultReplayEnabled: false,
        appTypes: ['browser'],
        industries: ['generic', 'ecommerce', 'media', 'saas'],
    },
    {
        id: 'checkout-funnel',
        label: 'Checkout / purchase funnel sessions',
        description: 'Retain sessions that reach a checkout, cart, or purchase-confirmation view.',
        rationale:
            'Revenue-critical funnel steps justify a higher retention rate than average traffic, since a UX or performance issue here has a direct dollar impact.',
        eventType: 'session',
        suggestedQuery: '@type:session @view.url_path:*checkout* OR @view.url_path:*cart*',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 8,
        defaultReplayEnabled: true,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['ecommerce'],
    },
    {
        id: 'payment-transaction',
        label: 'Payment / transaction sessions',
        description: 'Retain sessions that include a payment submission or transaction-confirmation action.',
        rationale:
            'In fintech, payment flows carry the highest compliance and support value per session, and failures here are the most costly to miss.',
        eventType: 'session',
        suggestedQuery: '@type:session @action.target.name:"Submit Payment" OR @view.url_path:*transaction*',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 6,
        defaultReplayEnabled: true,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['fintech'],
    },
    {
        id: 'playback-errors',
        label: 'Playback / buffering errors',
        description: 'Retain sessions with video/audio playback errors or excessive buffering resources.',
        rationale:
            'Playback quality is the core product experience for media and streaming; sessions with playback issues are disproportionately valuable for root-causing churn.',
        eventType: 'session',
        suggestedQuery: '@type:session @session.error.count:>0 @view.url_path:*watch*',
        suggestedSampleRate: 75,
        suggestedPctOfSessions: 4,
        defaultReplayEnabled: true,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['media'],
    },
    {
        id: 'trial-onboarding',
        label: 'Trial / onboarding sessions',
        description: 'Retain sessions from users in their first 14 days, tagged via a custom attribute.',
        rationale:
            'Onboarding friction is a leading churn indicator for SaaS; retaining these sessions lets product teams see exactly where new users get stuck, even if overall traffic is heavily sampled.',
        eventType: 'session',
        suggestedQuery: '@type:session @usr.trial_days_remaining:>0',
        suggestedSampleRate: 60,
        suggestedPctOfSessions: 12,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['saas'],
    },
    {
        id: 'high-value-customer',
        label: 'High-value / VIP customer sessions',
        description: 'Retain sessions from users flagged as high ARR, enterprise tier, or VIP via a custom attribute.',
        rationale:
            'Not all sessions carry equal business weight. Tagging and retaining sessions from your most valuable accounts trades an even lower average sample rate elsewhere for near-total visibility where it matters most.',
        eventType: 'session',
        suggestedQuery: '@type:session @usr.plan:enterprise',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 7,
        defaultReplayEnabled: true,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'app-hang-frozen-frames',
        label: 'App hangs / frozen frames (mobile)',
        description: 'Retain mobile sessions with a frozen frame, ANR, or app-hang event, even without a full crash.',
        rationale:
            'Hangs and freezes drive uninstalls and bad reviews just like crashes do, but are far more common — a mobile-specific filter catches this responsiveness signal that a web-only ruleset would miss entirely.',
        eventType: 'session',
        suggestedQuery: '@type:session @view.frozen_frame.count:>0 OR @view.hitches.count:>0',
        suggestedSampleRate: 40,
        suggestedPctOfSessions: 6,
        defaultReplayEnabled: true,
        appTypes: ['ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'checkout-page-errors',
        label: "Errors on the '/checkout' view",
        description: 'Retain individual view events on the checkout page that recorded at least one error.',
        rationale:
            'A view-level filter targets the exact page where errors are most expensive, independent of anything else that happened in the rest of the session.',
        eventType: 'view',
        suggestedQuery: '@type:view @view.url_path:*checkout* @view.error.count:>0',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 3,
        defaultReplayEnabled: true,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['ecommerce'],
    },
    {
        id: 'slow-key-page-views',
        label: 'Slow-loading views on key pages',
        description: 'Retain views on business-critical pages whose load time exceeds an acceptable threshold.',
        rationale:
            'Duration outliers on the pages that matter most (checkout, dashboard, key screens) are more actionable than a flat sample of every view, and cost far less to retain than every session.',
        eventType: 'view',
        suggestedQuery: '@type:view @view.url_path:(*checkout* OR *dashboard*) @view.loading_time:>3000000000',
        suggestedSampleRate: 50,
        suggestedPctOfSessions: 4,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'high-error-views',
        label: 'Views with repeated errors',
        description: 'Retain any single view that accumulated 3 or more errors, regardless of which page it was.',
        rationale:
            "A view throwing multiple errors is a stronger signal than a view with just one — it's more likely a broken page than a one-off flake, and worth prioritizing for debugging.",
        eventType: 'view',
        suggestedQuery: '@type:view @view.error.count:>=3',
        suggestedSampleRate: 75,
        suggestedPctOfSessions: 2,
        defaultReplayEnabled: true,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'network-api-errors',
        label: 'Network / API errors',
        description: 'Retain error events whose source is a network or XHR/fetch failure.',
        rationale:
            'Network errors point at backend or third-party dependency problems rather than frontend bugs, and are worth routing to a different owner — retaining them separately from generic JS errors keeps that distinction queryable.',
        eventType: 'error',
        suggestedQuery: '@type:error @error.source:network',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 2,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'high-volume-error-signature',
        label: 'Known high-volume error signature',
        description: 'Retain errors matching a specific message or fingerprint you are actively tracking (edit the query to match).',
        rationale:
            "A named, high-volume error is worth its own filter so its retention rate can be tuned independently — you may want every occurrence of a regression you're actively fixing, but only a trickle of everything else.",
        eventType: 'error',
        suggestedQuery: '@type:error @error.message:"ChunkLoadError"',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 1,
        defaultReplayEnabled: false,
        appTypes: ['browser'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'mfe-errors',
        label: 'Micro-frontend / module federation errors',
        description: 'Retain errors originating from a specific micro-frontend or federated module.',
        rationale:
            'In a micro-frontend architecture, errors from one team\'s module can get lost in the noise of the shell app; a dedicated filter keeps that team\'s errors visible regardless of overall sample rate.',
        eventType: 'error',
        suggestedQuery: '@type:error @error.source_type:federated-module',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 1,
        defaultReplayEnabled: false,
        appTypes: ['browser'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'cart-abandonment',
        label: 'Added to cart but never checked out',
        description: 'Retain sessions containing an "Add to Cart" action that never reach a "Checkout" action.',
        rationale:
            'This is a session-level exclude query, not a single-event filter — it targets the specific abandonment moment product teams care about, which a plain "sessions with an Add to Cart action" filter would over-retain (it would also keep sessions that completed checkout).',
        eventType: 'session',
        suggestedQuery: '@type:session @action.target.name:"Add to Cart" -@action.target.name:"Checkout"',
        suggestedSampleRate: 50,
        suggestedPctOfSessions: 5,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['ecommerce'],
    },
    {
        id: 'trial-started-action',
        label: '"Start trial" action',
        description: 'Retain the specific action event that fires when a user starts a free trial.',
        rationale:
            'An action-level filter on a single high-intent CTA is cheap to retain at a high rate and gives product a precise, low-noise conversion signal without paying to index every session it happens in.',
        eventType: 'action',
        suggestedQuery: '@type:action @action.target.name:"Start Trial"',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 2,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['saas'],
    },
    {
        id: 'failing-api-calls',
        label: 'Failing API calls (5xx)',
        description: 'Retain resource events for API calls that returned a server error status code.',
        rationale:
            'A resource-level filter isolates backend failures precisely, independent of whether the session around them looked otherwise healthy — useful for handing straight to a backend on-call rotation.',
        eventType: 'resource',
        suggestedQuery: '@type:resource @resource.type:xhr @resource.status_code:>=500',
        suggestedSampleRate: 100,
        suggestedPctOfSessions: 2,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'slow-api-calls',
        label: 'Slow API calls',
        description: 'Retain resource events for API calls that took longer than 3 seconds to complete.',
        rationale:
            'Latency outliers on API calls are often the root cause behind poor Core Web Vitals; retaining the resource events directly is more actionable than only seeing the downstream slow page load.',
        eventType: 'resource',
        suggestedQuery: '@type:resource @resource.type:xhr @resource.duration:>3000000000',
        suggestedSampleRate: 50,
        suggestedPctOfSessions: 3,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'non-us-low-sample',
        label: 'Non-US sessions (low sample)',
        description: 'Sample non-US sessions at a much lower rate than US traffic, instead of excluding them entirely.',
        rationale:
            'When most support/product priority is US-based, a low (not zero) sample rate for other geos keeps a cost lever without going fully blind to international issues — set to 0% if you want a hard exclude instead.',
        eventType: 'session',
        suggestedQuery: '@type:session -@geo.country:USA',
        suggestedSampleRate: 5,
        suggestedPctOfSessions: 30,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'authenticated-users',
        label: 'Authenticated (logged-in) sessions',
        description: 'Retain a higher share of sessions from identified, logged-in users.',
        rationale:
            'Authenticated users are usually existing customers, so their sessions carry more support and retention value per session than anonymous traffic — worth a materially higher sample rate.',
        eventType: 'session',
        suggestedQuery: '@type:session @usr.id:*',
        suggestedSampleRate: 40,
        suggestedPctOfSessions: 45,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'anonymous-users',
        label: 'Anonymous (logged-out) sessions',
        description: 'Retain a small share of sessions from unidentified, anonymous visitors.',
        rationale:
            'Anonymous traffic (marketing pages, pre-signup browsing) is usually high-volume and lower-value per session; a low sample rate here is often where the biggest cost savings come from.',
        eventType: 'session',
        suggestedQuery: '@type:session -@usr.id:*',
        suggestedSampleRate: 5,
        suggestedPctOfSessions: 55,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
    {
        id: 'long-session-baseline',
        label: 'Baseline sample of all other sessions',
        description: 'A flat, low sample rate across everything not already covered, to preserve general visibility.',
        rationale:
            "Filters are evaluated independently and in order; without a low-rate catch-all, you lose the ability to see broad UX trends that don't trip any specific rule.",
        eventType: 'session',
        suggestedQuery: '@type:session',
        suggestedSampleRate: 5,
        suggestedPctOfSessions: 100,
        defaultReplayEnabled: false,
        appTypes: ['browser', 'ios', 'andriod', 'react-native', 'flutter'],
        industries: ['generic', 'ecommerce', 'fintech', 'media', 'saas'],
    },
];

export function scenariosFor(appType: RumAppType, industry: Industry): RetentionScenario[] {
    return RETENTION_SCENARIOS.filter(
        (scenario) => scenario.appTypes.includes(appType) && scenario.industries.includes(industry),
    );
}
