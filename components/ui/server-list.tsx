// components/generic/ServerList.tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import type { AxiosInstance } from 'axios';
import React, {
    ForwardedRef,
    ReactNode,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    DimensionValue,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** ------------ TIPOS ------------- */

export type FilterConfig =
    | { type: 'text'; placeholder?: string }
    | { type: 'number'; placeholder?: string }
    | { type: 'date' } // usa "YYYY-MM-DD" por defecto
    | { type: 'range-date'; placeholder?: string } // { from, to } en "YYYY-MM-DD"
    | { type: 'boolean' }
    | {
        type: 'select';
        options: { label: string; value: string | number | boolean }[];
        placeholder?: string;
    };

type RangeDate = { from: string; to: string };

export type Column<T> = {
    key: keyof T | string;
    header: string;
    sortable?: boolean;
    /** ancho opcional por columna (ej. 120 o '30%') */
    width?: number | string;
    /** render personalizado de celda */
    render?: (row: T) => ReactNode;
    /** filtro por columna (renderiza input en el panel de filtros) */
    filter?: FilterConfig;
    /** alineación opcional */
    align?: 'left' | 'center' | 'right';
};

export type ServerResponse<T> = {
    data: T[];
    meta: {
        total: number;
        perPage: number;
        currentPage: number;
        lastPage: number;
    };
};

export type QueryState = {
    page: number;
    perPage: number;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    search: string;
    filters: Record<
        string,
        string | number | boolean | RangeDate | null | undefined
    >;
};

export type ServerListHandle = {
    reload: () => void;
    getQuery: () => QueryState;
};

export type ServerListProps<T> = {
    axios: AxiosInstance;
    endpoint: string;
    columns: Column<T>[];
    rowKey: (row: T) => string | number;

    initialPerPage?: number;
    initialSortBy?: string;
    initialSortDir?: 'asc' | 'desc';

    selectable?: boolean;
    selectedKeys?: Set<string | number>;
    onSelectionChange?: (keys: Set<string | number>) => void;
    // en export type ServerListProps<T> = { ... }
    renderBulkActions?: (ctx: { selectedCount: number; clearSelection: () => void }) => React.ReactNode;
    renderRowActions?: (row: T) => ReactNode;
    extraParams?: Record<string, string | number | boolean | undefined>;
    /** (legacy) */
    filter?: FilterConfig;
    onQueryChange?: (q: QueryState) => void;

    /** Estilos / UX */
    card?: boolean; // compat (solo aplica si layout='cards')
    emptyText?: string;

    /** NUEVO: control de diseño */
    layout?: 'auto' | 'cards' | 'table';
    /** NUEVO: ancho mínimo por columna en modo 'table' */
    minColWidth?: number; // default 140
    /** NUEVO: header pegajoso en tabla */
    stickyHeader?: boolean; // default true en table
    /** NUEVO: paginación */
    paginationMode?: 'pager' | 'infinite'; // default 'pager'
};

function ServerListInner<T>(
    {
        axios,
        endpoint,
        columns,
        rowKey,
        initialPerPage = 10,
        initialSortBy = '',
        initialSortDir = 'asc',
        selectable = false,
        selectedKeys,
        onSelectionChange,
        renderBulkActions,
        renderRowActions,
        extraParams = {},
        onQueryChange,
        card = true,
        emptyText = 'Sin resultados',

        // NUEVO
        layout = 'auto',
        minColWidth = 140,
        stickyHeader = true,
        paginationMode = 'pager',
    }: ServerListProps<T>,
    ref: ForwardedRef<ServerListHandle>
) {
    const insets = useSafeAreaInsets(); // 👈 NUEVO
    const { width: screenWidth } = useWindowDimensions();
    const isWide = screenWidth >= 720;
    const effectiveLayout: 'cards' | 'table' = layout === 'auto' ? (isWide ? 'table' : 'cards') : layout;
    const selectedCount = selectedKeys?.size ?? 0;


    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(initialPerPage);
    const [sortBy, setSortBy] = useState(initialSortBy);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<QueryState['filters']>({});

    const [meta, setMeta] = useState({
        total: 0,
        perPage: initialPerPage,
        currentPage: 1,
        lastPage: 1,
    });

    const [filtersOpen, setFiltersOpen] = useState(false);

    // Para "infinite" decidir si mezclamos resultados
    const mergeNextRef = useRef(false);

    const allSelected = useMemo(
        () =>
            selectable &&
            data.length > 0 &&
            selectedKeys &&
            selectedKeys.size === data.length,
        [selectable, data, selectedKeys]
    );

    const extraKey = useMemo(
        () => JSON.stringify(extraParams ?? {}),
        [extraParams]
    );

    const isRangeDate = (v: unknown): v is RangeDate =>
        !!v && typeof v === 'object' && 'from' in (v as any) && 'to' in (v as any);

    const buildParams = (): Record<string, unknown> => {
        const params: Record<string, unknown> = {
            page,
            perPage,
            sortBy: sortBy || undefined,
            sortDir,
            search: search || undefined,
            ...extraParams,
        };
        Object.entries(filters ?? {}).forEach(([k, v]) => {
            if (v !== '' && v !== null && v !== undefined) {
                // Para range-date enviamos como filters[k][from]/[to]
                if (isRangeDate(v)) {
                    if (v.from) params[`filters[${k}][from]`] = v.from;
                    if (v.to) params[`filters[${k}][to]`] = v.to;
                } else {
                    params[`filters[${k}]`] = v;
                }
            }
        });
        return params;
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = buildParams();
            const res = await axios.get<ServerResponse<T>>(endpoint, {
                params: params,
            });

            const list = res.data?.data ?? [];
            const newMeta =
                res.data?.meta ?? { total: 0, perPage, currentPage: 1, lastPage: 1 };
            console.log(list);
            console.log(meta);
            if (mergeNextRef.current) {
                setData(prev => {
                    const set = new Set(prev.map(r => String(rowKey(r))));
                    const merged = [...prev];
                    for (const r of list) {
                        const k = String(rowKey(r));
                        if (!set.has(k)) merged.push(r);
                    }
                    return merged;
                });
            } else {
                setData(list);
            }
            setMeta(newMeta);
        } catch (err: any) {
            const msg =
                err?.response?.data?.message || err?.message || 'Error al cargar datos';
            setError(msg);
            if (!mergeNextRef.current) setData([]);
            setMeta({ total: 0, perPage, currentPage: 1, lastPage: 1 });
            console.warn('ServerList error:', err?.response ?? err);
        } finally {
            setLoading(false);
            mergeNextRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endpoint, page, perPage, sortBy, sortDir, search, extraKey, filters]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        mergeNextRef.current = false;
        try {
            await fetchData();
        } finally {
            setRefreshing(false);
        }
    }, [fetchData]);

    useImperativeHandle(
        ref,
        () => ({
            reload: () => {
                mergeNextRef.current = false;
                fetchData();
            },
            getQuery: () => ({ page, perPage, sortBy, sortDir, search, filters }),
        }),
        [fetchData, page, perPage, sortBy, sortDir, search, filters]
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Notificar cambios de query
    const onQueryChangeRef = useRef(onQueryChange);
    useEffect(() => {
        onQueryChangeRef.current = onQueryChange;
    }, [onQueryChange]);

    const prevQueryRef = useRef<QueryState | null>(null);
    const sameQuery = (a: QueryState | null, b: QueryState) =>
        !!a &&
        a.page === b.page &&
        a.perPage === b.perPage &&
        a.sortBy === b.sortBy &&
        a.sortDir === b.sortDir &&
        a.search === b.search &&
        JSON.stringify(a.filters ?? {}) === JSON.stringify(b.filters ?? {});

    useEffect(() => {
        const q: QueryState = { page, perPage, sortBy, sortDir, search, filters };
        if (!sameQuery(prevQueryRef.current, q)) {
            onQueryChangeRef.current?.(q);
            prevQueryRef.current = q;
        }
    }, [page, perPage, sortBy, sortDir, search, filters]);

    const toggleAll = () => {
        if (!selectable || !onSelectionChange) return;
        if (allSelected) onSelectionChange(new Set());
        else onSelectionChange(new Set(data.map(row => rowKey(row))));
    };

    const toggleOne = (key: string | number) => {
        if (!selectable || !onSelectionChange) return;
        const prev = new Set(selectedKeys ?? []);
        if (prev.has(key)) prev.delete(key);
        else prev.add(key);
        onSelectionChange(prev);
    };

    const requestSort = (col: Column<T>) => {
        if (!col.sortable) return;
        const key = String(col.key);
        if (sortBy === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
        else {
            setSortBy(key);
            setSortDir('asc');
        }
        setPage(1);
        // si está en infinite, resetea lista
        mergeNextRef.current = false;
    };

    const clearAll = () => {
        setSearch('');
        setSortBy(initialSortBy || '');
        setSortDir(initialSortDir || 'asc');
        setPage(1);
        setPerPage(initialPerPage || 10);
        setFilters({});
        mergeNextRef.current = false;
    };

    /** ---------- HEADER (BÚSQUEDA + CONTROLES) ---------- */
    const renderHeaderControls = () => (
        <View style={styles.toolbar}>
            {/* Búsqueda */}
            <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={18} color="#6b7280" />
                <TextInput
                    placeholder="Buscar…"
                    value={search}
                    onChangeText={t => {
                        setSearch(t);
                        setPage(1);
                        mergeNextRef.current = false;
                    }}
                    style={styles.searchInput}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                        setPage(1);
                        mergeNextRef.current = false;
                    }}
                />
                {!!search && (
                    <Pressable
                        onPress={() => {
                            setSearch('');
                            setPage(1);
                            mergeNextRef.current = false;
                        }}
                        hitSlop={8}
                    >
                        <MaterialCommunityIcons name="close" size={16} color="#6b7280" />
                    </Pressable>
                )}
            </View>

            {/* Filas por página */}
            <View style={styles.pickerWrap}>
                <Text style={styles.pickerLabel}>Filas:</Text>
                <View style={styles.picker}>
                    <Picker
                        selectedValue={perPage}
                        onValueChange={v => {
                            setPerPage(Number(v));
                            setPage(1);
                            mergeNextRef.current = false;
                        }}
                        dropdownIconColor="#111827"
                        mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                    >
                        {[5, 10, 20, 50, 100].map(n => (
                            <Picker.Item key={n} label={String(n)} value={n} />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* Botones */}
            <View style={styles.actionsRow}>
                {columns.some(c => c.filter) && (
                    <Pressable
                        onPress={() => setFiltersOpen(s => !s)}
                        style={[styles.btn, styles.btnLight]}
                    >
                        <MaterialCommunityIcons
                            name="filter-variant"
                            size={16}
                            color="#374151"
                        />
                        <Text style={styles.btnLightText}>
                            {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
                        </Text>
                    </Pressable>
                )}

                <Pressable onPress={clearAll} style={[styles.iconBtn, { backgroundColor: '#fee2e2' }]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#dc2626" />
                </Pressable>
            </View>

            {renderBulkActions && (
                <View style={styles.filterExtras}>
                    {renderBulkActions({
                        selectedCount,
                        clearSelection: () => onSelectionChange?.(new Set()),
                    })}
                </View>
            )}
        </View>
    );

    /** ---------- SORT CHIPS ---------- */
    const renderSortChips = () => (
        <View style={styles.sortChips}>
            {columns.map(c => {
                if (!c.sortable) return null;
                const active = sortBy === String(c.key);
                return (
                    <Pressable
                        key={String(c.key)}
                        onPress={() => requestSort(c)}
                        style={[styles.chip, active ? styles.chipActive : undefined]}
                    >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {c.header}
                        </Text>
                        {active && (
                            <MaterialCommunityIcons
                                name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
                                size={14}
                                color="#2563eb"
                            />
                        )}
                    </Pressable>
                );
            })}
        </View>
    );

    /** ---------- FILTROS ---------- */
    const renderFiltersPanel = () => {
        if (!filtersOpen) return null;
        return (
            <View style={styles.filtersPanel}>
                {columns.map(col => {
                    if (!col.filter) return null;
                    const k = String(col.key);
                    const cfg = col.filter!;
                    const val = filters[k];

                    return (
                        <View key={k} style={styles.filterItem}>
                            <Text style={styles.filterLabel}>{col.header}</Text>

                            {cfg.type === 'text' && (
                                <TextInput
                                    placeholder={cfg.placeholder ?? 'Filtrar…'}
                                    value={typeof val === 'string' ? val : ''}
                                    onChangeText={t => {
                                        setFilters(f => ({ ...f, [k]: t }));
                                        setPage(1);
                                        mergeNextRef.current = false;
                                    }}
                                    style={styles.input}
                                />
                            )}

                            {cfg.type === 'number' && (
                                <TextInput
                                    placeholder={cfg.placeholder ?? '0'}
                                    value={
                                        val === '' || val === null || val === undefined ? '' : String(val)
                                    }
                                    onChangeText={t => {
                                        const v = t === '' ? '' : Number(t);
                                        setFilters(f => ({ ...f, [k]: v as any }));
                                        setPage(1);
                                        mergeNextRef.current = false;
                                    }}
                                    keyboardType="numeric"
                                    style={styles.input}
                                />
                            )}

                            {cfg.type === 'date' && (
                                <TextInput
                                    placeholder="YYYY-MM-DD"
                                    value={typeof val === 'string' ? val : ''}
                                    onChangeText={t => {
                                        setFilters(f => ({ ...f, [k]: t }));
                                        setPage(1);
                                        mergeNextRef.current = false;
                                    }}
                                    style={styles.input}
                                />
                            )}

                            {cfg.type === 'range-date' && (
                                <View style={styles.rangeRow}>
                                    <TextInput
                                        placeholder="Desde (YYYY-MM-DD)"
                                        value={isRangeDate(val) ? val.from : ''}
                                        onChangeText={t => {
                                            setFilters(f => ({
                                                ...f,
                                                [k]: {
                                                    ...(isRangeDate(f[k]) ? (f[k] as RangeDate) : { from: '', to: '' }),
                                                    from: t,
                                                },
                                            }));
                                            setPage(1);
                                            mergeNextRef.current = false;
                                        }}
                                        style={[styles.input, styles.inputHalf]}
                                    />
                                    <TextInput
                                        placeholder="Hasta (YYYY-MM-DD)"
                                        value={isRangeDate(val) ? val.to : ''}
                                        onChangeText={t => {
                                            setFilters(f => ({
                                                ...f,
                                                [k]: {
                                                    ...(isRangeDate(f[k]) ? (f[k] as RangeDate) : { from: '', to: '' }),
                                                    to: t,
                                                },
                                            }));
                                            setPage(1);
                                            mergeNextRef.current = false;
                                        }}
                                        style={[styles.input, styles.inputHalf]}
                                    />
                                </View>
                            )}

                            {cfg.type === 'boolean' && (
                                <View style={styles.picker}>
                                    <Picker
                                        selectedValue={val === undefined || val === null ? '' : String(val)}
                                        onValueChange={v => {
                                            const parsed = v === '' ? '' : v === 'true';
                                            setFilters(f => ({ ...f, [k]: parsed as any }));
                                            setPage(1);
                                            mergeNextRef.current = false;
                                        }}
                                        mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                                    >
                                        <Picker.Item label="Todos" value="" />
                                        <Picker.Item label="Sí" value="true" />
                                        <Picker.Item label="No" value="false" />
                                    </Picker>
                                </View>
                            )}

                            {cfg.type === 'select' && (
                                <View style={styles.picker}>
                                    <Picker
                                        selectedValue={val === undefined || val === null ? '' : String(val)}
                                        onValueChange={v => {
                                            setFilters(f => ({ ...f, [k]: v as any }));
                                            setPage(1);
                                            mergeNextRef.current = false;
                                        }}
                                        mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                                    >
                                        {!!cfg.placeholder && (
                                            <Picker.Item label={cfg.placeholder} value="" />
                                        )}
                                        {cfg.options.map(opt => (
                                            <Picker.Item
                                                key={String(opt.value)}
                                                label={opt.label}
                                                value={String(opt.value)}
                                            />
                                        ))}
                                    </Picker>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        );
    };

    /** ---------- CÁLCULO DE ANCHOS (TABLA) ---------- */
    const getColPx = (col: Column<T>): number => {
        if (typeof col.width === 'number') return Math.max(col.width, minColWidth);
        if (typeof col.width === 'string' && col.width.endsWith('%')) {
            const pct = Math.max(0, parseFloat(col.width)) / 100;
            return Math.max(minColWidth, Math.floor(screenWidth * pct)); // aprox al ancho visible
        }
        return minColWidth;
    };

    const baseColsWidth = useMemo(
        () => columns.map(getColPx),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [columns, screenWidth, minColWidth]
    );

    const extraColsPx =
        (selectable ? 52 : 0) + (renderRowActions ? 120 : 0); // checkbox + acciones aprox
    const minTableWidth = baseColsWidth.reduce((a, b) => a + b, 0) + extraColsPx;

    /** ---------- RENDER FILA (CARDS) ---------- */
    const renderRowCards = ({ item, index }: { item: T; index: number }) => {
        const k = rowKey(item);
        const isChecked = !!selectedKeys?.has(k);

        return (
            <View
                style={[
                    card ? styles.cardRow : styles.row,
                    index % 2 === 1 && !card ? styles.rowAlt : undefined,
                ]}
            >
                {/* Top bar de la tarjeta/fila */}
                <View style={styles.rowTopBar}>
                    {/* Izquierda: checkbox (opcional) */}
                    {selectable && (
                        <Pressable onPress={() => toggleOne(k)} style={styles.checkbox} hitSlop={8}>
                            <MaterialCommunityIcons
                                name={isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                                size={20}
                                color={isChecked ? '#2563eb' : '#6b7280'}
                            />
                        </Pressable>
                    )}

                    {/* Centro: lo que quieras mostrar centrado (opcional) */}
                    <View style={styles.topBarCenter}>
                        {/* Ejemplo: título/ID; cámbialo por lo que quieras */}
                        {/* <Text style={styles.topBarTitle} numberOfLines={1}>{String(item.name ?? item.id)}</Text> */}
                    </View>

                    {/* Derecha: acciones */}
                    {renderRowActions && (
                        <View style={styles.topBarActions} pointerEvents="box-none">
                            {renderRowActions(item)}
                        </View>
                    )}
                </View>

                <View style={styles.cellsWrap}>
                    {columns.map(col => (
                        <View
                            key={String(col.key)}
                            style={[
                                styles.cell,
                                typeof col.width === 'number'
                                    ? { width: col.width as DimensionValue }
                                    : typeof col.width === 'string'
                                        ? { width: col.width as DimensionValue }
                                        : { flex: 1 },
                            ]}
                        >
                            <Text style={styles.cellLabel} numberOfLines={1}>
                                {col.header}
                            </Text>
                            <View>
                                {col.render ? (
                                    col.render(item)
                                ) : (
                                    <Text
                                        style={[
                                            styles.cellText,
                                            col.align === 'center' && { textAlign: 'center' },
                                            col.align === 'right' && { textAlign: 'right' },
                                        ]}
                                        numberOfLines={2}
                                        ellipsizeMode="tail"
                                    >
                                        {String(item[col.key as keyof T] ?? '')}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    /** ---------- RENDER HEADER + FILA (TABLA) ---------- */
    const TableHeader = () => (
        <View style={[styles.tRow, styles.tHeader, { minWidth: minTableWidth }]}>
            {selectable && (
                <View style={[styles.tCell, { width: 52 }]}>
                    <Pressable onPress={toggleAll} style={styles.checkbox} hitSlop={8}>
                        <MaterialCommunityIcons
                            name={allSelected ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                            size={20}
                            color={allSelected ? '#2563eb' : '#6b7280'}
                        />
                    </Pressable>
                </View>
            )}
            {columns.map((c, i) => {
                const w = baseColsWidth[i];
                const active = sortBy === String(c.key);
                return (
                    <Pressable
                        key={String(c.key)}
                        onPress={() => requestSort(c)}
                        disabled={!c.sortable}
                        style={[styles.tCell, styles.tHeadCell, { width: w }]}
                    >
                        <Text
                            style={[styles.tHeadText, active && { color: '#111827', fontWeight: '700' }]}
                            numberOfLines={1}
                        >
                            {c.header}
                        </Text>
                        {c.sortable && active && (
                            <MaterialCommunityIcons
                                name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
                                size={14}
                                color="#2563eb"
                            />
                        )}
                    </Pressable>
                );
            })}
            {renderRowActions && <View style={[styles.tCell, styles.tHeadCell, { width: 120 }]} />}
        </View>
    );

    const renderRowTable = ({ item, index }: { item: T; index: number }) => {
        const k = rowKey(item);
        const isChecked = !!selectedKeys?.has(k);

        return (
            <View
                style={[
                    styles.tRow,
                    { minWidth: minTableWidth, backgroundColor: index % 2 ? '#fafafa' : '#fff' },
                ]}
            >
                {selectable && (
                    <View style={[styles.tCell, { width: 52 }]}>
                        <Pressable onPress={() => toggleOne(k)} style={styles.checkbox} hitSlop={8}>
                            <MaterialCommunityIcons
                                name={isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                                size={20}
                                color={isChecked ? '#2563eb' : '#6b7280'}
                            />
                        </Pressable>
                    </View>
                )}
                {columns.map((col, i) => {
                    const w = baseColsWidth[i];
                    return (
                        <View key={String(col.key)} style={[styles.tCell, { width: w }]}>
                            {col.render ? (
                                col.render(item)
                            ) : (
                                <Text
                                    style={[
                                        styles.tCellText,
                                        col.align === 'center' && { textAlign: 'center' },
                                        col.align === 'right' && { textAlign: 'right' },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {String(item[col.key as keyof T] ?? '')}
                                </Text>
                            )}
                        </View>
                    );
                })}
                {renderRowActions && <View style={[styles.tCell, { width: 120 }]}>{renderRowActions(item)}</View>}
            </View>
        );
    };

    /** ---------- FOOTER (PAGINACIÓN) ---------- */
    const Paginator = () =>
        paginationMode === 'pager' ? (
            <View style={styles.paginator}>
                <Pressable
                    onPress={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    style={[styles.pagerBtn, page <= 1 || loading ? styles.btnDisabled : undefined]}
                >
                    <Text style={styles.pagerText}>Anterior</Text>
                </Pressable>

                <Text style={styles.pageInfo}>
                    Página {meta.currentPage} de {meta.lastPage} · {meta.total} registros
                </Text>

                <Pressable
                    onPress={() => setPage(p => Math.min(meta.lastPage, p + 1))}
                    disabled={page >= meta.lastPage || loading}
                    style={[
                        styles.pagerBtn,
                        page >= meta.lastPage || loading ? styles.btnDisabled : undefined,
                    ]}
                >
                    <Text style={styles.pagerText}>Siguiente</Text>
                </Pressable>
            </View>
        ) : null;

    const handleEndReached = () => {
        if (paginationMode !== 'infinite') return;
        if (loading) return;
        if (page >= meta.lastPage) return;
        mergeNextRef.current = true;
        setPage(p => p + 1);
    };

    const ListFooter = () =>
        paginationMode === 'infinite' && page < meta.lastPage ? (
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <ActivityIndicator />
                <Text style={{ color: '#6b7280', marginTop: 6 }}>Cargando más…</Text>
            </View>
        ) : null;

    const keyExtractor = (item: T) => String(rowKey(item));

    /** ---------- RENDER PRINCIPAL ---------- */
    return (
        <View style={styles.container}>
            {renderHeaderControls()}
            {renderSortChips()}
            {renderFiltersPanel()}

            {!!error && (
                <View style={styles.errorBanner}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#b91c1c" />
                    <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
                </View>
            )}

            {selectable && effectiveLayout === 'cards' && (
                <View style={styles.selectAllRow}>
                    <Pressable onPress={toggleAll} style={styles.checkbox} hitSlop={8}>
                        <MaterialCommunityIcons
                            name={allSelected ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                            size={20}
                            color={allSelected ? '#2563eb' : '#6b7280'}
                        />
                    </Pressable>
                    <Text style={styles.selectAllText}>Seleccionar página</Text>
                </View>
            )}

            {/* 👇 ZONA SCROLLEABLE CON ALTO COMPLETO */}
            <View style={styles.body}>
                {loading && data.length === 0 ? (
                    <View style={styles.loading}>
                        <ActivityIndicator />
                        <Text style={styles.loadingText}>Cargando…</Text>
                    </View>
                ) : data.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>{emptyText}</Text>
                    </View>
                ) : effectiveLayout === 'cards' ? (
                    <FlatList
                        style={styles.fill}                   // 👈 ocupa todo el alto
                        data={data}
                        keyExtractor={keyExtractor}
                        renderItem={renderRowCards}
                        contentContainerStyle={{
                            paddingHorizontal: 12,
                            paddingBottom: (paginationMode === 'pager' ? 56 : 24) + insets.bottom, // 👈 safe-area
                        }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        onEndReachedThreshold={paginationMode === 'infinite' ? 0.2 : undefined}
                        onEndReached={paginationMode === 'infinite' ? handleEndReached : undefined}
                        ListFooterComponent={ListFooter}
                        nestedScrollEnabled
                        keyboardDismissMode="on-drag"
                        keyboardShouldPersistTaps="handled"
                        removeClippedSubviews={false}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    // TABLE (scroll horizontal)
                    <ScrollView
                        horizontal
                        style={styles.fill}                  // 👈 asegura alto completo del viewport
                        bounces
                        nestedScrollEnabled
                        showsHorizontalScrollIndicator
                        contentContainerStyle={{ minWidth: minTableWidth }}
                        scrollEventThrottle={16}
                    >
                        <View style={{ flex: 1, minHeight: 0 }}>  {/* 👈 permite que FlatList mida alto completo */}
                            {stickyHeader && (
                                <View style={{ backgroundColor: '#f3f4f6' }}>
                                    <TableHeader />
                                </View>
                            )}

                            <FlatList
                                style={styles.fill}             // 👈 usa todo el alto
                                data={data}
                                keyExtractor={keyExtractor}
                                renderItem={renderRowTable}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                                ListHeaderComponent={!stickyHeader ? <TableHeader /> : undefined}
                                onEndReachedThreshold={paginationMode === 'infinite' ? 0.2 : undefined}
                                onEndReached={paginationMode === 'infinite' ? handleEndReached : undefined}
                                ListFooterComponent={ListFooter}
                                nestedScrollEnabled
                                keyboardDismissMode="on-drag"
                                keyboardShouldPersistTaps="handled"
                                removeClippedSubviews={false}
                                scrollEventThrottle={16}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{
                                    paddingBottom: (paginationMode === 'pager' ? 56 : 24) + insets.bottom, // 👈 safe-area
                                }}
                            />
                        </View>
                    </ScrollView>
                )}
            </View>

            <Paginator />
        </View>
    );
}

export const ServerList = forwardRef(ServerListInner) as <T>(
    p: ServerListProps<T> & { ref?: React.Ref<ServerListHandle> }
) => React.ReactElement;

/** ------------ ESTILOS ------------ */
const styles = StyleSheet.create({
    // container: {
    //     borderRadius: 16,
    //     borderWidth: StyleSheet.hairlineWidth,
    //     borderColor: '#e5e7eb',
    //     backgroundColor: '#ffffff',
    //     overflow: 'hidden',
    // },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        flexWrap: 'wrap',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f9fafb',
        borderColor: '#e5e7eb',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        minWidth: 160,
        flex: 1,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 0,
        fontSize: 14,
        color: '#111827',
    },
    pickerWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pickerLabel: { color: '#4b5563', fontSize: 13 },
    picker: {
        minWidth: 90,
        borderRadius: 8,
        borderColor: '#e5e7eb',
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
    },
    btnLight: { backgroundColor: '#f3f4f6' },
    btnLightText: { color: '#374151', fontSize: 13 },
    iconBtn: { padding: 8, borderRadius: 999 },

    sortChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#f3f4f6',
    },
    chipActive: { backgroundColor: '#dbeafe' },
    chipText: { color: '#374151', fontSize: 13 },
    chipTextActive: { color: '#2563eb', fontWeight: '600' },

    filtersPanel: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
        paddingHorizontal: 12,
        paddingBottom: 12,
        gap: 10,
    },
    filterItem: { gap: 6, paddingTop: 10 },
    filterLabel: { color: '#6b7280', fontSize: 12 },
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#fff',
        fontSize: 14,
        color: '#111827',
    },
    rangeRow: { flexDirection: 'row', gap: 8 },
    inputHalf: { flex: 1 },

    selectAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    selectAllText: { color: '#374151', fontSize: 13 },
    checkbox: { padding: 6, borderRadius: 8 },

    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fee2e2',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: '#fecaca',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    errorText: { color: '#b91c1c', flex: 1, fontSize: 13 },

    loading: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 20,
    },
    loadingText: { color: '#6b7280' },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
    emptyText: { color: '#6b7280' },

    // ---- CARDS ----
    cardRow: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        marginHorizontal: 12,
        marginTop: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        justifyContent: 'space-between',
    },
    cellsWrap: { gap: 10 },
    cell: {
        backgroundColor: '#f9fafb',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    cellLabel: { color: '#6b7280', fontSize: 12, marginBottom: 4 },
    cellText: { color: '#111827', fontSize: 14 },
    actionsCell: { marginTop: 8, flexDirection: 'row', gap: 8 },

    // ---- TABLA ----
    tRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
    },
    tHeader: {
        backgroundColor: '#f3f4f6',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
    },
    tCell: { paddingHorizontal: 8, justifyContent: 'center' },
    tHeadCell: { paddingVertical: 10 },
    tHeadText: { color: '#374151', fontSize: 12 },
    tCellText: { color: '#111827', fontSize: 14 },

    // ---- PAGER ----
    paginator: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pagerBtn: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#fff',
    },
    btnDisabled: { opacity: 0.5 },
    pagerText: { color: '#111827' },
    pageInfo: { color: '#374151', fontSize: 12 },

    // Fila "tabla plana" (compat)
    row: { flexDirection: 'column', paddingVertical: 10, paddingHorizontal: 12 },
    rowAlt: { backgroundColor: '#f9fafb' },
    container: {
        flex: 1,            // 👈 ahora ocupa todo el alto disponible
        minHeight: 0,       // 👈 habilita scroll interno correcto
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#e5e7eb',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
    },
    body: {
        flex: 1,            // 👈 el área que scrollea
        minHeight: 0,
    },
    fill: {
        flex: 1,            // 👈 Scroll/FlatList toman todo el alto del body
        minHeight: 0,
    },

    rowTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 36,
        paddingHorizontal: 4,
        marginBottom: 6,
    },

    topBarCenter: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },

    topBarTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },

    topBarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    filterExtras: {
        marginTop: 8,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
    },
});
