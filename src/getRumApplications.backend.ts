import { listRUMApplications } from '@datadog/action-catalog/dd/rum';

export type RumApplicationSummary = {
    id: string;
    name: string;
    type: string;
};

export async function getRumApplications(): Promise<RumApplicationSummary[]> {
    const { applications } = await listRUMApplications({ inputs: {} });

    return applications
        .map((app) => ({ id: app.id, name: app.name, type: app.type }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
