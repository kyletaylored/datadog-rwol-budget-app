import { queryScalarData, type DataScalarColumn, type ScalarColumn } from '@datadog/action-catalog/dd/metrics';

export type RumUsage = {
    ingestedSessions: number;
    indexedSessions: number;
    replaySessions: number;
};

function firstNumericValue(columns: ScalarColumn[] | undefined): number {
    const numberColumn = columns?.find((column): column is DataScalarColumn => column.type === 'number');
    return numberColumn?.values?.[0] ?? 0;
}

async function sumSessions(
    metricName: string,
    applicationId: string,
    extraTags: string,
    from: string,
    to: string,
): Promise<number> {
    const response = await queryScalarData({
        inputs: {
            range: { from, to },
            queries: [
                {
                    name: 'sessions',
                    data_source: 'metrics',
                    aggregator: 'sum',
                    // Tag is `application.id` (with a dot), not `application_id` — confirmed against
                    // the `application_id` template variable's `prefix` in the RWoL usage dashboard.
                    query: `sum:${metricName}{application.id:${applicationId}${extraTags}}.as_count()`,
                },
            ],
            formulas: [{ formula: 'sessions' }],
        },
    });

    return firstNumericValue(response.data?.attributes?.columns);
}

export async function getRumUsage(applicationId: string, from: string, to: string): Promise<RumUsage> {
    const [ingestedSessions, indexedSessions, replaySessions] = await Promise.all([
        sumSessions('datadog.estimated_usage.rum.ingested_sessions', applicationId, '', from, to),
        sumSessions('datadog.estimated_usage.rum.indexed_sessions', applicationId, '', from, to),
        sumSessions('datadog.estimated_usage.rum.indexed_sessions', applicationId, ',sku:replay', from, to),
    ]);

    return { ingestedSessions, indexedSessions, replaySessions };
}
