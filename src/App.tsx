import { useQuery } from '@tanstack/react-query';
import { Button } from '@datadog/druids/form/Button';
import { InputNumber } from '@datadog/druids/form/InputNumber';
import { Select } from '@datadog/druids/form/Select';
import { ToggleSwitch } from '@datadog/druids/form/ToggleSwitch';
import { ApiIcon } from '@datadog/druids/icons/Api';
import { CheckIcon } from '@datadog/druids/icons/Check';
import { ClickIcon } from '@datadog/druids/icons/Click';
import { ErrorTrackingIcon } from '@datadog/druids/icons/ErrorTracking';
import { EyeIcon } from '@datadog/druids/icons/Eye';
import { InfoIcon } from '@datadog/druids/icons/Info';
import { PencilIcon } from '@datadog/druids/icons/Pencil';
import { SessionReplayIcon } from '@datadog/druids/icons/SessionReplay';
import { Grid } from '@datadog/druids/layout/Grid';
import { GridItem } from '@datadog/druids/layout/GridItem';
import { HorizontalSeparator } from '@datadog/druids/layout/HorizontalSeparator';
import { Spacing } from '@datadog/druids/layout/Spacing';
import { CalloutValue } from '@datadog/druids/measures/CalloutValue';
import { MessageBox } from '@datadog/druids/misc/MessageBox';
import { Badge } from '@datadog/druids/pills/Badge';
import { StatusPill } from '@datadog/druids/pills/StatusPill';
import { Table, type TableColumn } from '@datadog/druids/table/Table';
import { DateRangePicker } from '@datadog/druids/time/DateRangePicker';
import { Text } from '@datadog/druids/typography/Text';
import { useCallback, useMemo, useState } from 'react';

import { estimateCost, estimateRetention, reverseSolveBudget, type CandidateFilter, type PricingConfig } from './lib/budgetModel';
import { scenariosFor, type Industry, type RetentionScenario, type RumAppType } from './data/retentionScenarios';
import { getRumApplications } from './getRumApplications.backend';
import { getRumUsage } from './getRumUsage.backend';
import { getRetentionFilters, type RetentionFilterSummary } from './getRetentionFilters.backend';

const INDUSTRY_OPTIONS: Array<{ label: string; value: Industry }> = [
    { label: 'Generic / other', value: 'generic' },
    { label: 'E-commerce', value: 'ecommerce' },
    { label: 'Fintech', value: 'fintech' },
    { label: 'Media / streaming', value: 'media' },
    { label: 'SaaS', value: 'saas' },
];

const SCENARIO_GLOBAL_FILTER = { placeholder: 'Search scenarios by name or query' };
const SCENARIO_PAGINATION = { hasPageSizeSelector: true, pageSizeOptions: [10, 15, 20, 50] };
const FILTERS_TABLE_PERFORMANCE = { hasVirtualization: false };
const SCENARIOS_TABLE_PERFORMANCE = { hasVirtualization: false, getCellDeps: null };
const FILTERS_EMPTY_STATE = { title: 'No retention filters configured yet' };
const SCENARIOS_EMPTY_STATE = { title: 'No scenario templates match this app type and industry yet' };

function getFilterRowId(filter: RetentionFilterSummary): string {
    return filter.id;
}

function getScenarioRowId(scenario: RetentionScenario): string {
    return scenario.id;
}

const DEFAULT_PRICING: PricingConfig = {
    legacyPerThousand: 1.5,
    measurePerThousand: 0.15,
    investigatePerThousand: 3.0,
    replayPerThousand: 1.5,
};

function formatMoney(value: number): string {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function formatSessions(value: number): string {
    return Math.round(value).toLocaleString('en-US');
}

function sampleRateLevel(sampleRate: number): 'default' | 'warning' | 'danger' {
    if (sampleRate >= 75) return 'default';
    if (sampleRate >= 25) return 'warning';
    return 'danger';
}

function InfoHint({ text }: { text: string }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <span
            style={{ position: 'relative', display: 'inline-flex', width: 'fit-content', justifySelf: 'start', cursor: 'help' }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onClick={() => setIsOpen((open) => !open)}
        >
            <InfoIcon size="sm" title="" hasInlineCentering ariaLabel={text} />
            {isOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 280, zIndex: 20 }}>
                    <MessageBox>
                        <Text as="p" size="sm">
                            {text}
                        </Text>
                    </MessageBox>
                </div>
            )}
        </span>
    );
}

function QueryCode({ query }: { query: string }) {
    return (
        <Text as="code" size="sm" isMonospace variant="secondary" hasEllipsis title={query}>
            {query || '—'}
        </Text>
    );
}

const EVENT_TYPE_META: Record<string, { label: string; level: 'default' | 'success' | 'warning' | 'danger'; icon: typeof EyeIcon }> = {
    session: { label: 'Session', level: 'default', icon: SessionReplayIcon },
    view: { label: 'View', level: 'success', icon: EyeIcon },
    action: { label: 'Action', level: 'warning', icon: ClickIcon },
    error: { label: 'Error', level: 'danger', icon: ErrorTrackingIcon },
    resource: { label: 'Resource', level: 'default', icon: ApiIcon },
    long_task: { label: 'Long task', level: 'warning', icon: ClickIcon },
    vital: { label: 'Vital', level: 'success', icon: EyeIcon },
};

function EventTypeBadge({ eventType }: { eventType: string }) {
    const meta = EVENT_TYPE_META[eventType] ?? { label: eventType, level: 'default' as const, icon: EyeIcon };
    return (
        <StatusPill level={meta.level} icon={meta.icon} size="md" isSoft>
            {meta.label}
        </StatusPill>
    );
}

const filterTableColumns = [
    {
        Header: 'Filter',
        accessor: 'name',
        width: 200,
        Cell: ({ value }: { value: unknown }) => (
            <Text as="span" size="sm" weight="bold" hasEllipsis title={String(value ?? '')}>
                {String(value ?? '')}
            </Text>
        ),
    },
    {
        Header: 'Event type',
        accessor: 'eventType',
        width: 140,
        Cell: ({ value }: { value: unknown }) => <EventTypeBadge eventType={String(value)} />,
    },
    {
        Header: 'Query',
        accessor: 'query',
        minWidth: 240,
        Cell: ({ value }: { value: unknown }) => <QueryCode query={String(value ?? '')} />,
    },
    {
        Header: 'Sample rate',
        accessor: 'sampleRate',
        Cell: ({ value }: { value: unknown }) => (
            <Badge label={`${value}%`} level={sampleRateLevel(Number(value))} isBorderless size="sm" />
        ),
    },
    {
        Header: 'Status',
        accessor: 'enabled',
        Cell: ({ value }: { value: unknown }) => (
            <StatusPill level={value ? 'success' : 'default'} isSoft size="sm">
                {value ? 'Enabled' : 'Disabled'}
            </StatusPill>
        ),
    },
    // react-table's column generics can't express per-column value narrowing cleanly here;
    // the runtime shape matches TableColumn<RetentionFilterSummary>.
] as unknown as TableColumn<RetentionFilterSummary>[];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function App() {
    const [selectedAppId, setSelectedAppId] = useState<string | undefined>();
    const [timeFrame, setTimeFrame] = useState(() => {
        const end = Date.now();
        return { start: end - THIRTY_DAYS_MS, end, paused: true };
    });
    const [industry, setIndustry] = useState<Industry>('generic');
    const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());
    const [editingScenarioIds, setEditingScenarioIds] = useState<Set<string>>(new Set());
    const [scenarioOverrides, setScenarioOverrides] = useState<
        Record<string, { sampleRate: number; pctOfSessions: number; isReplayEnabled: boolean }>
    >({});
    const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
    const [legacySampleRatePct, setLegacySampleRatePct] = useState(80);

    const appsQuery = useQuery({ queryKey: ['rum-applications'], queryFn: () => getRumApplications() });

    const selectedApp = appsQuery.data?.find((app) => app.id === selectedAppId);

    const rangeFromIso = new Date(timeFrame.start).toISOString();
    const rangeToIso = new Date(timeFrame.end).toISOString();

    const usageQuery = useQuery({
        queryKey: ['rum-usage', selectedAppId, rangeFromIso, rangeToIso],
        queryFn: () => getRumUsage(selectedAppId as string, rangeFromIso, rangeToIso),
        enabled: Boolean(selectedAppId),
    });

    const filtersQuery = useQuery({
        queryKey: ['retention-filters', selectedAppId],
        queryFn: () => getRetentionFilters(selectedAppId as string),
        enabled: Boolean(selectedAppId),
    });

    const scenarios = useMemo(
        () => scenariosFor((selectedApp?.type as RumAppType) ?? 'browser', industry),
        [selectedApp?.type, industry],
    );

    const candidateFilters: CandidateFilter[] = useMemo(
        () =>
            scenarios
                .filter((scenario) => selectedScenarioIds.has(scenario.id))
                .map((scenario) => ({
                    id: scenario.id,
                    sampleRate: scenarioOverrides[scenario.id]?.sampleRate ?? scenario.suggestedSampleRate,
                    pctOfSessions: scenarioOverrides[scenario.id]?.pctOfSessions ?? scenario.suggestedPctOfSessions,
                    isReplayEnabled: scenarioOverrides[scenario.id]?.isReplayEnabled ?? scenario.defaultReplayEnabled,
                })),
        [scenarios, selectedScenarioIds, scenarioOverrides],
    );

    const ingestedSessions = usageQuery.data?.ingestedSessions ?? 0;

    const retention = useMemo(() => estimateRetention(candidateFilters, ingestedSessions), [candidateFilters, ingestedSessions]);

    const legacySessions = ingestedSessions * (legacySampleRatePct / 100);

    const cost = useMemo(
        () => estimateCost(ingestedSessions, retention.retainedSessions, retention.replayRetainedSessions, legacySessions, pricing),
        [ingestedSessions, retention, legacySessions, pricing],
    );

    const reverseBudget = useMemo(
        () => reverseSolveBudget(cost.legacyCost, ingestedSessions, pricing),
        [cost.legacyCost, ingestedSessions, pricing],
    );

    const [previousScenarios, setPreviousScenarios] = useState(scenarios);
    if (scenarios !== previousScenarios) {
        setPreviousScenarios(scenarios);
        setSelectedScenarioIds(new Set());
        setEditingScenarioIds(new Set());
        setScenarioOverrides({});
    }

    const updateOverride = useCallback(
        (scenarioId: string, field: 'sampleRate' | 'pctOfSessions', value: number) => {
            setScenarioOverrides((current) => {
                const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
                const existing = current[scenarioId] ?? {
                    sampleRate: scenario?.suggestedSampleRate ?? 0,
                    pctOfSessions: scenario?.suggestedPctOfSessions ?? 0,
                    isReplayEnabled: scenario?.defaultReplayEnabled ?? false,
                };
                return { ...current, [scenarioId]: { ...existing, [field]: value } };
            });
        },
        [scenarios],
    );

    const toggleReplay = useCallback(
        (scenarioId: string) => {
            setScenarioOverrides((current) => {
                const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
                const existing = current[scenarioId] ?? {
                    sampleRate: scenario?.suggestedSampleRate ?? 0,
                    pctOfSessions: scenario?.suggestedPctOfSessions ?? 0,
                    isReplayEnabled: scenario?.defaultReplayEnabled ?? false,
                };
                return { ...current, [scenarioId]: { ...existing, isReplayEnabled: !existing.isReplayEnabled } };
            });
        },
        [scenarios],
    );

    const toggleEditingScenario = useCallback((scenarioId: string) => {
        setEditingScenarioIds((current) => {
            const next = new Set(current);
            if (next.has(scenarioId)) {
                next.delete(scenarioId);
            } else {
                next.add(scenarioId);
            }
            return next;
        });
    }, []);

    const scenarioSelectableRows = useMemo(
        () => ({
            isEnabled: true,
            onChange: (selectedFlatRows: Array<{ original: RetentionScenario }>) => {
                const nextSelected = new Set(selectedFlatRows.map((row) => row.original.id));
                setSelectedScenarioIds(nextSelected);
                setEditingScenarioIds((current) => new Set([...current].filter((id) => nextSelected.has(id))));
            },
        }),
        [],
    );

    // Kept separate from `columns` below: the columns array must stay referentially
    // stable (Table resets row selection whenever it changes), so anything that
    // changes on ordinary interaction (edit toggling, overridden values, usage data)
    // is threaded through `getExtraRowData`/`row.extraData` instead of closures.
    type ScenarioRowExtraData = {
        isEditing: boolean;
        sampleRate: number;
        pctOfSessions: number;
        isReplayEnabled: boolean;
        ingestedSessions: number;
    };

    const getScenarioRowExtraData = useCallback(
        (row: { original: RetentionScenario }): ScenarioRowExtraData => {
            const scenario = row.original;
            const override = scenarioOverrides[scenario.id];
            return {
                isEditing: editingScenarioIds.has(scenario.id),
                sampleRate: override?.sampleRate ?? scenario.suggestedSampleRate,
                pctOfSessions: override?.pctOfSessions ?? scenario.suggestedPctOfSessions,
                isReplayEnabled: override?.isReplayEnabled ?? scenario.defaultReplayEnabled,
                ingestedSessions,
            };
        },
        [editingScenarioIds, scenarioOverrides, ingestedSessions],
    );

    const scenarioTableColumns = useMemo(
        () =>
            [
                {
                    id: 'filter',
                    Header: 'Filter',
                    width: 240,
                    Cell: ({ row }: { row: { original: RetentionScenario } }) => (
                        <Text
                            as="span"
                            size="sm"
                            weight="bold"
                            hasEllipsis
                            title={`${row.original.description} ${row.original.rationale}`}
                        >
                            {row.original.label}
                        </Text>
                    ),
                },
                {
                    id: 'query',
                    Header: 'Query',
                    minWidth: 220,
                    Cell: ({ row }: { row: { original: RetentionScenario } }) => <QueryCode query={row.original.suggestedQuery} />,
                },
                {
                    id: 'sampleRate',
                    Header: 'Sample %',
                    width: 90,
                    Cell: ({ row }: { row: { original: RetentionScenario; extraData: ScenarioRowExtraData } }) => {
                        const { isEditing, sampleRate } = row.extraData;
                        if (!isEditing) return <Text size="sm">{sampleRate}%</Text>;
                        return (
                            <InputNumber
                                size="sm"
                                value={sampleRate}
                                onChange={(event) => updateOverride(row.original.id, 'sampleRate', Number(event.target.value))}
                            />
                        );
                    },
                },
                {
                    id: 'pctOfSessions',
                    Header: 'Match %',
                    width: 90,
                    Cell: ({ row }: { row: { original: RetentionScenario; extraData: ScenarioRowExtraData } }) => {
                        const { isEditing, pctOfSessions } = row.extraData;
                        if (!isEditing) return <Text size="sm">{pctOfSessions}%</Text>;
                        return (
                            <InputNumber
                                size="sm"
                                value={pctOfSessions}
                                onChange={(event) => updateOverride(row.original.id, 'pctOfSessions', Number(event.target.value))}
                            />
                        );
                    },
                },
                {
                    id: 'retained',
                    Header: 'Retained/mo',
                    width: 100,
                    Cell: ({ row }: { row: { extraData: ScenarioRowExtraData } }) => {
                        const { sampleRate, pctOfSessions, ingestedSessions: rowIngestedSessions } = row.extraData;
                        const retainedSessions = rowIngestedSessions * (pctOfSessions / 100) * (sampleRate / 100);
                        return <Text size="sm">{formatSessions(retainedSessions)}</Text>;
                    },
                },
                {
                    id: 'replay',
                    Header: 'Replay',
                    width: 80,
                    Cell: ({ row }: { row: { original: RetentionScenario; extraData: ScenarioRowExtraData } }) => (
                        <ToggleSwitch
                            isChecked={row.extraData.isReplayEnabled}
                            onChange={() => toggleReplay(row.original.id)}
                            ariaLabel={`Include Session Replay for ${row.original.label}`}
                        />
                    ),
                },
                {
                    id: 'edit',
                    Header: '',
                    width: 80,
                    Cell: ({ row }: { row: { original: RetentionScenario; extraData: ScenarioRowExtraData } }) => {
                        const isEditing = row.extraData.isEditing;
                        return (
                            <Button
                                size="sm"
                                isBorderless
                                isSoft={isEditing}
                                icon={isEditing ? CheckIcon : PencilIcon}
                                label={isEditing ? 'Save' : 'Edit'}
                                onClick={() => toggleEditingScenario(row.original.id)}
                            />
                        );
                    },
                },
                // react-table's column generics can't express per-column value narrowing cleanly here;
                // the runtime shape matches TableColumn<RetentionScenario>.
            ] as unknown as TableColumn<RetentionScenario>[],
        [updateOverride, toggleReplay, toggleEditingScenario],
    );

    return (
        <Spacing as="main" padding="lg">
            <Grid columns={1} gap="lg" isFullWidth>
                <GridItem>
                    <Text as="h1" size="xl" weight="bold" marginBottom="sm">
                        RUM Without Limits Budget Copilot
                    </Text>
                    <Text as="p" size="md" variant="secondary" marginBottom="md">
                        Use this with a customer (or on your own) to plan their migration from legacy RUM to RUM
                        Without Limits: see what they actually ingest and retain today, model which retention
                        filters make sense for their app, and see the projected Measure + Investigate cost before
                        anything changes in their org.
                    </Text>
                    <MessageBox title="How to use this">
                        <Text as="p" size="sm">
                            1. Pick the RUM application and time window to model — everything below reflects that
                            app's real usage over the selected range.
                        </Text>
                        <Text as="p" size="sm" marginTop="xs">
                            2. Review what it's ingesting/retaining today, and which retention filters (if any)
                            are already configured.
                        </Text>
                        <Text as="p" size="sm" marginTop="xs">
                            3. Check the retention filter templates relevant to this customer's business, tune
                            their sample rate and estimated match rate, and decide whether each should also retain
                            Session Replay.
                        </Text>
                        <Text as="p" size="sm" marginTop="xs">
                            4. Compare the resulting Measure + Investigate cost against their current legacy
                            spend, and see the retention rate they can afford if the goal is to stay within that
                            budget.
                        </Text>
                    </MessageBox>
                </GridItem>

                <GridItem>
                    <Grid columns="2fr 1fr" gap="md" alignItems="start">
                        <div>
                            <Text as="h2" size="lg" weight="bold" marginBottom="sm">
                                1. Choose a RUM application
                            </Text>
                            <Text as="p" size="sm" variant="secondary" marginBottom="md">
                                Every step below is scoped to this application and date range.
                            </Text>
                            <Select
                                placeholder={appsQuery.isLoading ? 'Loading applications…' : 'Select a RUM application'}
                                isLoading={appsQuery.isLoading}
                                options={(appsQuery.data ?? []).map((app) => ({ label: `${app.name} (${app.type})`, value: app.id }))}
                                value={selectedAppId ? { label: selectedApp?.name ?? '', value: selectedAppId } : undefined}
                                onChange={(option) => setSelectedAppId((option as { value: string } | null)?.value)}
                            />
                        </div>
                        <div>
                            <Text as="h2" size="lg" weight="bold" marginBottom="sm">
                                Date range
                            </Text>
                            <DateRangePicker
                                timeFrame={timeFrame}
                                setTimeFrame={(nextTimeFrame) =>
                                    setTimeFrame({ start: nextTimeFrame.start, end: nextTimeFrame.end, paused: true })
                                }
                                hasCalendar
                                dateTimeFormat="date-only"
                            />
                        </div>
                    </Grid>
                    {appsQuery.isError && (
                        <MessageBox level="danger" title="Unable to load RUM applications" marginTop="sm">
                            Check that this app has permission to read RUM application data.
                        </MessageBox>
                    )}
                    {!selectedAppId && !appsQuery.isLoading && !appsQuery.isError && (
                        <MessageBox marginTop="sm">
                            Select a RUM application above to see its usage, existing retention filters, and the
                            budget model.
                        </MessageBox>
                    )}
                </GridItem>

                {selectedAppId && (
                    <>
                        <GridItem>
                            <Grid columns="auto 1fr" gap="xs" alignItems="center" marginBottom="sm">
                                <Text as="h2" size="lg" weight="bold">
                                    2. Current usage
                                </Text>
                                <InfoHint text="Ingested, indexed, and replay counts come from the datadog.estimated_usage.rum.* metrics, scoped to this application and the date range above." />
                            </Grid>
                            <Text as="p" size="sm" variant="secondary" marginBottom="md">
                                This is what the app actually did during the selected window — nothing here
                                changes until you create or edit retention filters in RUM Settings.
                            </Text>
                            <Grid columns={4} gap="md">
                                <CalloutValue
                                    label="Ingested sessions (Measure)"
                                    value={usageQuery.isLoading ? '…' : formatSessions(ingestedSessions)}
                                    isLoading={usageQuery.isLoading}
                                />
                                <CalloutValue
                                    label="Indexed sessions (Investigate)"
                                    value={usageQuery.isLoading ? '…' : formatSessions(usageQuery.data?.indexedSessions ?? 0)}
                                    isLoading={usageQuery.isLoading}
                                />
                                <CalloutValue
                                    label="Replay sessions"
                                    value={usageQuery.isLoading ? '…' : formatSessions(usageQuery.data?.replaySessions ?? 0)}
                                    isLoading={usageQuery.isLoading}
                                    icon={SessionReplayIcon}
                                />
                                <CalloutValue
                                    label="Current retention rate"
                                    value={
                                        usageQuery.isLoading || ingestedSessions === 0
                                            ? '…'
                                            : `${((usageQuery.data!.indexedSessions / ingestedSessions) * 100).toFixed(1)}%`
                                    }
                                    isLoading={usageQuery.isLoading}
                                />
                            </Grid>

                            <Spacing as="div" marginTop="md">
                                <Text as="h3" size="md" weight="bold" marginBottom="xs">
                                    Existing retention filters
                                </Text>
                                <Text as="p" size="sm" variant="secondary" marginBottom="md">
                                    Filters already configured on this application today, shown read-only for
                                    reference. They are <strong>not</strong> included in the budget model below —
                                    that model is driven only by what you check in step 3, so you can compare a
                                    proposed scenario against what's live today.
                                </Text>
                                <Table
                                    data={filtersQuery.data ?? []}
                                    columns={filterTableColumns}
                                    isLoading={filtersQuery.isLoading}
                                    getRowId={getFilterRowId}
                                    emptyState={FILTERS_EMPTY_STATE}
                                    performance={FILTERS_TABLE_PERFORMANCE}
                                />
                            </Spacing>
                        </GridItem>

                        <GridItem>
                            <HorizontalSeparator marginBottom="md" />
                            <Text as="h2" size="lg" weight="bold" marginBottom="sm">
                                3. Build a retention filter scenario
                            </Text>
                            <Text as="p" size="sm" variant="secondary" marginBottom="md">
                                Pick an industry to narrow the list to common patterns for that vertical, then
                                check the filters worth discussing with this customer. For each checked filter,
                                click <strong>Edit</strong> to tune its Sample % (the retention filter's own
                                sample rate) and Match % (your estimate of what share of sessions the query
                                matches) — the defaults are rough starting points, not real numbers for this app.
                                Toggle <strong>Replay</strong> if that filter should also retain Session Replay
                                recordings.
                            </Text>
                            <Select
                                floatingLabel="Industry"
                                options={INDUSTRY_OPTIONS}
                                value={INDUSTRY_OPTIONS.find((option) => option.value === industry)}
                                onChange={(option) => setIndustry((option as { value: Industry }).value)}
                            />
                            <Spacing as="div" marginTop="md">
                                <Table
                                    data={scenarios}
                                    columns={scenarioTableColumns}
                                    getRowId={getScenarioRowId}
                                    sorting
                                    globalFilter={SCENARIO_GLOBAL_FILTER}
                                    pagination={SCENARIO_PAGINATION}
                                    selectableRows={scenarioSelectableRows}
                                    getExtraRowData={getScenarioRowExtraData}
                                    summary
                                    emptyState={SCENARIOS_EMPTY_STATE}
                                    performance={SCENARIOS_TABLE_PERFORMANCE}
                                />
                            </Spacing>
                        </GridItem>

                        <GridItem>
                            <HorizontalSeparator marginBottom="md" />
                            <Grid columns="auto 1fr" gap="xs" alignItems="center" marginBottom="sm">
                                <Text as="h2" size="lg" weight="bold">
                                    4. Budget model
                                </Text>
                                <InfoHint text="Measure is billed on every ingested session from step 2 above. Investigate (and Replay) are billed on the estimated retained sessions shown below, computed from the included filters' Sample % and Match % in step 3." />
                            </Grid>
                            <Text as="p" size="sm" variant="secondary" marginBottom="md">
                                Enter this customer's actual (or list) pricing below, then compare their current
                                legacy cost against the scenario built in step 3 — and see the retention rate
                                they could afford if the goal is to match their current budget.
                            </Text>
                            <Grid columns={4} gap="sm" marginBottom="md">
                                <InputNumber
                                    floatingLabel="Legacy $ / 1k sessions"
                                    value={pricing.legacyPerThousand}
                                    onChange={(event) => setPricing((p) => ({ ...p, legacyPerThousand: Number(event.target.value) }))}
                                />
                                <InputNumber
                                    floatingLabel="Legacy sample rate %"
                                    value={legacySampleRatePct}
                                    onChange={(event) => setLegacySampleRatePct(Number(event.target.value))}
                                />
                                <InputNumber
                                    floatingLabel="Measure $ / 1k sessions"
                                    value={pricing.measurePerThousand}
                                    onChange={(event) => setPricing((p) => ({ ...p, measurePerThousand: Number(event.target.value) }))}
                                />
                                <InputNumber
                                    floatingLabel="Investigate $ / 1k sessions"
                                    value={pricing.investigatePerThousand}
                                    onChange={(event) => setPricing((p) => ({ ...p, investigatePerThousand: Number(event.target.value) }))}
                                />
                            </Grid>

                            <Grid columns="auto 1fr" gap="xs" alignItems="center" marginTop="md">
                                <Text as="h3" size="md" weight="bold">
                                    Session counts used in this calculation
                                </Text>
                                <InfoHint text="These are the exact inputs feeding the cost numbers below: Measure cost = ingested sessions × Measure $/1k. Investigate cost = retained sessions × Investigate $/1k. Replay cost = replay-retained sessions × Replay $/1k." />
                            </Grid>
                            <Grid columns={3} gap="md" marginBottom="md">
                                <CalloutValue
                                    size="sm"
                                    label="Ingested sessions (from step 2)"
                                    value={formatSessions(ingestedSessions)}
                                />
                                <CalloutValue
                                    size="sm"
                                    label="Retained sessions (est., from step 3)"
                                    value={formatSessions(retention.retainedSessions)}
                                />
                                <CalloutValue
                                    size="sm"
                                    label="Replay-retained sessions (est.)"
                                    value={formatSessions(retention.replayRetainedSessions)}
                                />
                            </Grid>

                            <Grid columns={3} gap="md">
                                <CalloutValue label="Current legacy cost" value={formatMoney(cost.legacyCost)} />
                                <CalloutValue
                                    label="Projected RWoL cost (this scenario)"
                                    value={formatMoney(cost.totalRwolCost)}
                                    level={cost.totalRwolCost > cost.legacyCost ? 'danger' : 'success'}
                                />
                                <CalloutValue label="Estimated retention rate" value={`${retention.retentionRatePct.toFixed(1)}%`} />
                            </Grid>

                            <Grid columns={3} gap="md" marginTop="md">
                                <CalloutValue size="sm" label="Measure cost" value={formatMoney(cost.measureCost)} />
                                <CalloutValue size="sm" label="Investigate cost" value={formatMoney(cost.investigateCost)} />
                                <CalloutValue size="sm" label="Replay cost" value={formatMoney(cost.replayCost)} />
                            </Grid>

                            <Spacing as="div" marginTop="md">
                                <Grid columns="auto 1fr" gap="xs" alignItems="center" marginBottom="sm">
                                    <Text as="h3" size="md" weight="bold">
                                        Budget-matched retention
                                    </Text>
                                    <InfoHint text="Reverse-solved: if you want to stay within the current legacy budget while sampling 100% of sessions into Measure, this is the retention rate/session volume Investigate can afford with the budget left over after Measure." />
                                </Grid>
                                <Grid columns={2} gap="md">
                                    <CalloutValue
                                        label={`Affordable retention rate to match ${formatMoney(cost.legacyCost)}/mo`}
                                        value={`${reverseBudget.affordableRetentionRatePct.toFixed(1)}%`}
                                        level="success"
                                    />
                                    <CalloutValue
                                        label="Affordable retained sessions/mo"
                                        value={formatSessions(reverseBudget.affordableRetainedSessions)}
                                        level="success"
                                    />
                                </Grid>
                            </Spacing>

                            <MessageBox marginTop="md" title="This is a planning estimate">
                                Retention is estimated assuming selected filters match independent, non-overlapping
                                slices of sessions. Real filters can overlap — a session matching two filters is only
                                billed once. Validate the actual retention rate in the RWoL usage dashboard after
                                filters are configured.
                            </MessageBox>
                        </GridItem>
                    </>
                )}
            </Grid>
        </Spacing>
    );
}

export default App;
