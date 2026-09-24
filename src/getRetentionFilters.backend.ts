import { listRetentionFilters } from '@datadog/action-catalog/dd/retentionfilters';

export type RetentionFilterSummary = {
    id: string;
    name: string;
    eventType: string;
    query: string;
    sampleRate: number;
    enabled: boolean;
};

export async function getRetentionFilters(applicationId: string): Promise<RetentionFilterSummary[]> {
    const { data } = await listRetentionFilters({ inputs: { app_id: applicationId } });

    return (data ?? []).map((filter) => ({
        id: filter.id ?? '',
        name: filter.attributes?.name ?? 'Unnamed filter',
        eventType: filter.attributes?.event_type ?? 'session',
        query: filter.attributes?.query ?? '',
        sampleRate: filter.attributes?.sample_rate ?? 0,
        enabled: filter.attributes?.enabled ?? true,
    }));
}
