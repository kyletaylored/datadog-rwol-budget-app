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

async function sumSessions(metricName: string, applicationId: string, extraTags: string, days: number): Promise<number> {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const response = await queryScalarData({
        inputs: {
            range: { from: from.toISOString(), to: to.toISOString() },
            queries: [
                {
                    name: 'sessions',
                    data_source: 'metrics',
                    aggregator: 'sum',
                    query: `sum:${metricName}{application_id:${applicationId}${extraTags}}.as_count()`,
                },
            ],
            formulas: [{ formula: 'sessions' }],
        },
    });

    return firstNumericValue(response.data?.attributes?.columns);
}

export async function getRumUsage(applicationId: string, days = 30): Promise<RumUsage> {
    const [ingestedSessions, indexedSessions, replaySessions] = await Promise.all([
        sumSessions('datadog.estimated_usage.rum.ingested_sessions', applicationId, '', days),
        sumSessions('datadog.estimated_usage.rum.indexed_sessions', applicationId, '', days),
        sumSessions('datadog.estimated_usage.rum.indexed_sessions', applicationId, ',sku:replay', days),
    ]);

    return { ingestedSessions, indexedSessions, replaySessions };
}
