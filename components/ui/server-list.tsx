// components/generic/ServerList.tsx
import { useThemeColor } from '@/hooks/use-theme-color';
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
  filters: Record<string, string | number | boolean | RangeDate | null | undefined>;
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
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 720;
  const effectiveLayout: 'cards' | 'table' = layout === 'auto' ? (isWide ? 'table' : 'cards') : layout;
  const selectedCount = selectedKeys?.size ?? 0;

  // ===== Tokens de tema =====
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const fieldBg = useThemeColor({}, 'fieldBg');
  const fieldBorder = useThemeColor({}, 'fieldBorder'); // si no existe en tu hook, puedes mapear a 'border'

  // semánticos
  const success = '#16a34a';
  const danger = '#ef4444';

  // estilos dependientes de tema
  const styles = useMemo(
    () =>
      createStyles({
        text,
        tint,
        surface,
        border,
        muted,
        fieldBg,
        fieldBorder: fieldBorder || border,
      }),
    [text, tint, surface, border, muted, fieldBg, fieldBorder]
  );

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
  const mergeNextRef = useRef(false);

  const allSelected = useMemo(
    () => selectable && data.length > 0 && selectedKeys && selectedKeys.size === data.length,
    [selectable, data, selectedKeys]
  );

  const extraKey = useMemo(() => JSON.stringify(extraParams ?? {}), [extraParams]);

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
      const res = await axios.get<ServerResponse<T>>(endpoint, { params });
      const list = res.data?.data ?? [];
      const newMeta = res.data?.meta ?? { total: 0, perPage, currentPage: 1, lastPage: 1 };

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
      const msg = err?.response?.data?.message || err?.message || 'Error al cargar datos';
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
      <View style={[styles.searchBox, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={muted} />
        <TextInput
          placeholder="Buscar…"
          placeholderTextColor={muted}
          value={search}
          onChangeText={t => {
            setSearch(t);
            setPage(1);
            mergeNextRef.current = false;
          }}
          style={[styles.searchInput, { color: text }]}
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
            <MaterialCommunityIcons name="close" size={16} color={muted} />
          </Pressable>
        )}
      </View>

      {/* Filas por página */}
      <View style={styles.pickerWrap}>
        <Text style={[styles.pickerLabel, { color: muted }]}>Filas:</Text>
        <View style={[styles.picker, { borderColor: border, backgroundColor: surface }]}>
          <Picker
            selectedValue={perPage}
            onValueChange={v => {
              setPerPage(Number(v));
              setPage(1);
              mergeNextRef.current = false;
            }}
            dropdownIconColor={text}
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
          <Pressable onPress={() => setFiltersOpen(s => !s)} style={[styles.btn, { backgroundColor: fieldBg }]}>
            <MaterialCommunityIcons name="filter-variant" size={16} color={text} />
            <Text style={[styles.btnLightText, { color: text }]}>
              {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
            </Text>
          </Pressable>
        )}

        <Pressable onPress={clearAll} style={[styles.iconBtn, { backgroundColor: tint + '22' }]}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={tint} />
        </Pressable>
      </View>

      {renderBulkActions && (
        <View style={[styles.filterExtras, { borderTopColor: border }]}>
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
            style={[
              styles.chip,
              { backgroundColor: fieldBg },
              active && { backgroundColor: tint + '22' },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? tint : text },
                active && styles.chipTextActive,
              ]}
            >
              {c.header}
            </Text>
            {active && (
              <MaterialCommunityIcons
                name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
                size={14}
                color={tint}
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
      <View style={[styles.filtersPanel, { borderTopColor: border }]}>
        {columns.map(col => {
          if (!col.filter) return null;
          const k = String(col.key);
          const cfg = col.filter!;
          const val = filters[k];

          return (
            <View key={k} style={styles.filterItem}>
              <Text style={[styles.filterLabel, { color: muted }]}>{col.header}</Text>

              {cfg.type === 'text' && (
                <TextInput
                  placeholder={cfg.placeholder ?? 'Filtrar…'}
                  placeholderTextColor={muted}
                  value={typeof val === 'string' ? val : ''}
                  onChangeText={t => {
                    setFilters(f => ({ ...f, [k]: t }));
                    setPage(1);
                    mergeNextRef.current = false;
                  }}
                  style={[styles.input, { borderColor: fieldBorder, backgroundColor: surface, color: text }]}
                />
              )}

              {cfg.type === 'number' && (
                <TextInput
                  placeholder={cfg.placeholder ?? '0'}
                  placeholderTextColor={muted}
                  value={val === '' || val === null || val === undefined ? '' : String(val)}
                  onChangeText={t => {
                    const v = t === '' ? '' : Number(t);
                    setFilters(f => ({ ...f, [k]: v as any }));
                    setPage(1);
                    mergeNextRef.current = false;
                  }}
                  keyboardType="numeric"
                  style={[styles.input, { borderColor: fieldBorder, backgroundColor: surface, color: text }]}
                />
              )}

              {cfg.type === 'date' && (
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={muted}
                  value={typeof val === 'string' ? val : ''}
                  onChangeText={t => {
                    setFilters(f => ({ ...f, [k]: t }));
                    setPage(1);
                    mergeNextRef.current = false;
                  }}
                  style={[styles.input, { borderColor: fieldBorder, backgroundColor: surface, color: text }]}
                />
              )}

              {cfg.type === 'range-date' && (
                <View style={styles.rangeRow}>
                  <TextInput
                    placeholder="Desde (YYYY-MM-DD)"
                    placeholderTextColor={muted}
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
                    style={[styles.input, styles.inputHalf, { borderColor: fieldBorder, backgroundColor: surface, color: text }]}
                  />
                  <TextInput
                    placeholder="Hasta (YYYY-MM-DD)"
                    placeholderTextColor={muted}
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
                    style={[styles.input, styles.inputHalf, { borderColor: fieldBorder, backgroundColor: surface, color: text }]}
                  />
                </View>
              )}

              {cfg.type === 'boolean' && (
                <View style={[styles.picker, { borderColor: fieldBorder, backgroundColor: surface }]}>
                  <Picker
                    selectedValue={val === undefined || val === null ? '' : String(val)}
                    onValueChange={v => {
                      const parsed = v === '' ? '' : v === 'true';
                      setFilters(f => ({ ...f, [k]: parsed as any }));
                      setPage(1);
                      mergeNextRef.current = false;
                    }}
                    mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                    dropdownIconColor={text}
                  >
                    <Picker.Item label="Todos" value="" />
                    <Picker.Item label="Sí" value="true" />
                    <Picker.Item label="No" value="false" />
                  </Picker>
                </View>
              )}

              {cfg.type === 'select' && (
                <View style={[styles.picker, { borderColor: fieldBorder, backgroundColor: surface }]}>
                  <Picker
                    selectedValue={val === undefined || val === null ? '' : String(val)}
                    onValueChange={v => {
                      setFilters(f => ({ ...f, [k]: v as any }));
                      setPage(1);
                      mergeNextRef.current = false;
                    }}
                    mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                    dropdownIconColor={text}
                  >
                    {!!cfg.placeholder && <Picker.Item label={cfg.placeholder} value="" />}
                    {cfg.options.map(opt => (
                      <Picker.Item key={String(opt.value)} label={opt.label} value={String(opt.value)} />
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
      return Math.max(minColWidth, Math.floor(screenWidth * pct));
    }
    return minColWidth;
  };

  const baseColsWidth = useMemo(() => columns.map(getColPx), [columns, screenWidth, minColWidth]);
  const extraColsPx = (selectable ? 52 : 0) + (renderRowActions ? 120 : 0);
  const minTableWidth = baseColsWidth.reduce((a, b) => a + b, 0) + extraColsPx;

  /** ---------- RENDER FILA (CARDS) ---------- */
  const renderRowCards = ({ item, index }: { item: T; index: number }) => {
    const k = rowKey(item);
    const isChecked = !!selectedKeys?.has(k);

    return (
      <View style={[card ? styles.cardRow : styles.row, index % 2 === 1 && !card ? styles.rowAlt : undefined, { borderColor: border, backgroundColor: surface }]}>
        {/* Top bar */}
        <View style={styles.rowTopBar}>
          {selectable && (
            <Pressable onPress={() => toggleOne(k)} style={styles.checkbox} hitSlop={8}>
              <MaterialCommunityIcons
                name={isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                size={20}
                color={isChecked ? tint : muted}
              />
            </Pressable>
          )}
          <View style={styles.topBarCenter} />
          {renderRowActions && <View style={styles.topBarActions} pointerEvents="box-none">{renderRowActions(item)}</View>}
        </View>

        <View style={styles.cellsWrap}>
          {columns.map(col => (
            <View
              key={String(col.key)}
              style={[
                styles.cell,
                { backgroundColor: fieldBg },
                typeof col.width === 'number'
                  ? { width: col.width as DimensionValue }
                  : typeof col.width === 'string'
                  ? { width: col.width as DimensionValue }
                  : { flex: 1 },
              ]}
            >
              <Text style={[styles.cellLabel, { color: muted }]} numberOfLines={1}>
                {col.header}
              </Text>
              <View>
                {col.render ? (
                  col.render(item)
                ) : (
                  <Text
                    style={[
                      styles.cellText,
                      { color: text },
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
    <View style={[styles.tRow, styles.tHeader, { minWidth: minTableWidth, backgroundColor: fieldBg, borderTopColor: border, borderBottomColor: border }]}>
      {selectable && (
        <View style={[styles.tCell, { width: 52 }]}>
          <Pressable onPress={toggleAll} style={styles.checkbox} hitSlop={8}>
            <MaterialCommunityIcons
              name={allSelected ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
              size={20}
              color={allSelected ? tint : muted}
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
              style={[
                styles.tHeadText,
                { color: active ? text : muted },
                active && { fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {c.header}
            </Text>
            {c.sortable && active && (
              <MaterialCommunityIcons name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={14} color={tint} />
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
          {
            minWidth: minTableWidth,
            backgroundColor: index % 2 ? fieldBg : surface,
            borderBottomColor: border,
          },
        ]}
      >
        {selectable && (
          <View style={[styles.tCell, { width: 52 }]}>
            <Pressable onPress={() => toggleOne(k)} style={styles.checkbox} hitSlop={8}>
              <MaterialCommunityIcons
                name={isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                size={20}
                color={isChecked ? tint : muted}
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
                    { color: text },
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
      <View style={[styles.paginator, { borderTopColor: border }]}>
        <Pressable
          onPress={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          style={[
            styles.pagerBtn,
            { backgroundColor: surface, borderColor: border },
            page <= 1 || loading ? styles.btnDisabled : undefined,
          ]}
        >
          <Text style={[styles.pagerText, { color: text }]}>Anterior</Text>
        </Pressable>

        <Text style={[styles.pageInfo, { color: muted }]}>
          Página {meta.currentPage} de {meta.lastPage} · {meta.total} registros
        </Text>

        <Pressable
          onPress={() => setPage(p => Math.min(meta.lastPage, p + 1))}
          disabled={page >= meta.lastPage || loading}
          style={[
            styles.pagerBtn,
            { backgroundColor: surface, borderColor: border },
            page >= meta.lastPage || loading ? styles.btnDisabled : undefined,
          ]}
        >
          <Text style={[styles.pagerText, { color: text }]}>Siguiente</Text>
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
        <Text style={{ color: muted, marginTop: 6 }}>Cargando más…</Text>
      </View>
    ) : null;

  const keyExtractor = (item: T) => String(rowKey(item));

  /** ---------- RENDER PRINCIPAL ---------- */
  return (
    <View style={[styles.container, { borderColor: border, backgroundColor: surface }]}>
      {renderHeaderControls()}
      {renderSortChips()}
      {renderFiltersPanel()}

      {!!error && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: danger + '22', borderColor: danger + '44' },
          ]}
        >
          <MaterialCommunityIcons name="alert-circle" size={18} color={danger} />
          <Text style={[styles.errorText, { color: danger }]} numberOfLines={2}>
            {error}
          </Text>
        </View>
      )}

      {selectable && effectiveLayout === 'cards' && (
        <View style={styles.selectAllRow}>
          <Pressable onPress={toggleAll} style={styles.checkbox} hitSlop={8}>
            <MaterialCommunityIcons
              name={allSelected ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
              size={20}
              color={allSelected ? tint : muted}
            />
          </Pressable>
          <Text style={[styles.selectAllText, { color: muted }]}>Seleccionar página</Text>
        </View>
      )}

      {/* 👇 ZONA SCROLLEABLE CON ALTO COMPLETO */}
      <View style={styles.body}>
        {loading && data.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={[styles.loadingText, { color: muted }]}>Cargando…</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: muted }]}>{emptyText}</Text>
          </View>
        ) : effectiveLayout === 'cards' ? (
          <FlatList
            style={styles.fill}
            data={data}
            keyExtractor={keyExtractor}
            renderItem={renderRowCards}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingBottom: (paginationMode === 'pager' ? 56 : 24) + insets.bottom,
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
            style={styles.fill}
            bounces
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            contentContainerStyle={{ minWidth: minTableWidth, backgroundColor: surface }}
            scrollEventThrottle={16}
          >
            <View style={{ flex: 1, minHeight: 0 }}>
              {stickyHeader && (
                <View style={{ backgroundColor: surface }}>
                  <TableHeader />
                </View>
              )}

              <FlatList
                style={styles.fill}
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
                  paddingBottom: (paginationMode === 'pager' ? 56 : 24) + insets.bottom,
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

/** ------------ ESTILOS (theme-aware) ------------ */
function createStyles(c: {
  text: string;
  tint: string;
  surface: string;
  border: string;
  muted: string;
  fieldBg: string;
  fieldBorder: string;
}) {
  return StyleSheet.create({
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
    },
    pickerWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pickerLabel: { fontSize: 13 },
    picker: {
      minWidth: 90,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
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
    btnLightText: { fontSize: 13 },

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
    },
    chipActive: {},
    chipText: { fontSize: 13 },
    chipTextActive: { fontWeight: '600' },

    filtersPanel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 10,
    },
    filterItem: { gap: 6, paddingTop: 10 },
    filterLabel: { fontSize: 12 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
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
    selectAllText: { fontSize: 13 },
    checkbox: { padding: 6, borderRadius: 8 },

    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    errorText: { flex: 1, fontSize: 13 },

    loading: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 20,
    },
    loadingText: {},
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
    emptyText: {},

    // ---- CARDS ----
    cardRow: {
      borderRadius: 14,
      padding: 12,
      marginHorizontal: 12,
      marginTop: 10,
      borderWidth: StyleSheet.hairlineWidth,
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
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    cellLabel: { marginBottom: 4 },
    cellText: { fontSize: 14 },
    actionsCell: { marginTop: 8, flexDirection: 'row', gap: 8 },

    // ---- TABLA ----
    tRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tHeader: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tCell: { paddingHorizontal: 8, justifyContent: 'center' },
    tHeadCell: { paddingVertical: 10 },
    tHeadText: { fontSize: 12 },
    tCellText: { fontSize: 14 },

    // ---- PAGER ----
    paginator: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pagerBtn: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    btnDisabled: { opacity: 0.5 },
    pagerText: {},
    pageInfo: { fontSize: 12 },

    // Fila "tabla plana" (compat)
    row: { flexDirection: 'column', paddingVertical: 10, paddingHorizontal: 12 },
    rowAlt: {},
    container: {
      flex: 1,
      minHeight: 0,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    body: { flex: 1, minHeight: 0 },
    fill: { flex: 1, minHeight: 0 },

    rowTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 36,
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    topBarCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
    topBarTitle: { fontSize: 14, fontWeight: '700' },
    topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    filterExtras: { marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  });
}
