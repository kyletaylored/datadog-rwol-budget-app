/**
 * Pure calculation helpers for the RUM Without Limits budget model.
 *
 * The retention estimate assumes each selected filter matches an
 * independent, non-overlapping slice of sessions. Real filters can overlap
 * (a session can match more than one), so this is a directional planning
 * estimate, not a substitute for observing actual retention in the RWoL
 * usage dashboard after rollout.
 */

export type CandidateFilter = {
    id: string;
    /** 0-100 */
    pctOfSessions: number;
    /** 0-100 */
    sampleRate: number;
    isReplayEnabled?: boolean;
};

export type PricingConfig = {
    legacyPerThousand: number;
    measurePerThousand: number;
    investigatePerThousand: number;
    replayPerThousand: number;
};

export type RetentionEstimate = {
    retainedSessions: number;
    replayRetainedSessions: number;
    retentionRatePct: number;
};

export function estimateRetention(filters: CandidateFilter[], ingestedSessions: number): RetentionEstimate {
    if (ingestedSessions <= 0) {
        return { retainedSessions: 0, replayRetainedSessions: 0, retentionRatePct: 0 };
    }

    let retainedSessions = 0;
    let replayRetainedSessions = 0;

    for (const filter of filters) {
        const matched = ingestedSessions * (filter.pctOfSessions / 100) * (filter.sampleRate / 100);
        retainedSessions += matched;
        if (filter.isReplayEnabled) {
            replayRetainedSessions += matched;
        }
    }

    retainedSessions = Math.min(retainedSessions, ingestedSessions);
    replayRetainedSessions = Math.min(replayRetainedSessions, retainedSessions);

    return {
        retainedSessions,
        replayRetainedSessions,
        retentionRatePct: (retainedSessions / ingestedSessions) * 100,
    };
}

export type CostBreakdown = {
    legacyCost: number;
    measureCost: number;
    investigateCost: number;
    replayCost: number;
    totalRwolCost: number;
};

export function estimateCost(
    ingestedSessions: number,
    retainedSessions: number,
    replayRetainedSessions: number,
    legacySessions: number,
    pricing: PricingConfig,
): CostBreakdown {
    const perThousand = (sessions: number, price: number) => (sessions / 1000) * price;

    const measureCost = perThousand(ingestedSessions, pricing.measurePerThousand);
    const investigateCost = perThousand(retainedSessions, pricing.investigatePerThousand);
    const replayCost = perThousand(replayRetainedSessions, pricing.replayPerThousand);

    return {
        legacyCost: perThousand(legacySessions, pricing.legacyPerThousand),
        measureCost,
        investigateCost,
        replayCost,
        totalRwolCost: measureCost + investigateCost + replayCost,
    };
}

export type ReverseBudgetResult = {
    /** Budget left for Investigate after Measure is paid for on 100% of ingested sessions. */
    investigateBudget: number;
    /** Max sessions Investigate can retain within that budget. */
    affordableRetainedSessions: number;
    /** affordableRetainedSessions as a % of ingestedSessions. */
    affordableRetentionRatePct: number;
};

export function reverseSolveBudget(
    targetTotalBudget: number,
    ingestedSessions: number,
    pricing: PricingConfig,
): ReverseBudgetResult {
    const measureCost = (ingestedSessions / 1000) * pricing.measurePerThousand;
    const investigateBudget = Math.max(targetTotalBudget - measureCost, 0);
    const affordableRetainedSessions =
        pricing.investigatePerThousand > 0 ? (investigateBudget / pricing.investigatePerThousand) * 1000 : 0;
    const cappedRetainedSessions = Math.min(affordableRetainedSessions, ingestedSessions);

    return {
        investigateBudget,
        affordableRetainedSessions: cappedRetainedSessions,
        affordableRetentionRatePct: ingestedSessions > 0 ? (cappedRetainedSessions / ingestedSessions) * 100 : 0,
    };
}
