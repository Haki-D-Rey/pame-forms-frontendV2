import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Platform,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    View,
    ViewStyle,
} from 'react-native';

export type PermissionOption = {
    id: number | string;
    name: string;
    code?: string;
    description?: string;
};

type Props = {
    options: PermissionOption[];
    value: Set<number | string>;
    onChange: (next: Set<number | string>) => void;
    searchable?: boolean;
    maxHeight?: number;
    minItemWidth?: number;
    /** Si true, el componente usa FlatList (scroll interno).  
     *  Si false, NO usa VirtualizedList y deja el scroll al contenedor padre. */
    internalScroll?: boolean;
    style?: StyleProp<ViewStyle>;
};

export default function PermissionsPicker({
    options,
    value,
    onChange,
    searchable = true,
    maxHeight = 260,
    minItemWidth = 170,
    internalScroll = true,
    style,
}: Props) {
    const text = useThemeColor({}, 'text');
    const tint = useThemeColor({}, 'tint');
    const muted = useThemeColor({}, 'muted');
    const border = useThemeColor({}, 'border');
    const fieldBg = useThemeColor({}, 'fieldBg');
    const surface = useThemeColor({}, 'surface');

    const ripple = (c: string) => (Platform.OS === 'android' ? { android_ripple: { color: c } } : {});

    const [query, setQuery] = useState('');
    const [containerW, setContainerW] = useState(0);

    const gap = 8, padH = 12;

    const { columns, itemW } = useMemo(() => {
        const innerW = Math.max(0, containerW - padH * 2);
        const cols = Math.max(1, Math.floor((innerW + gap) / (minItemWidth + gap)));
        const cardW = cols > 1 ? Math.floor((innerW - gap * (cols - 1)) / cols) : innerW;
        return { columns: cols, itemW: Math.max(120, cardW) };
    }, [containerW, minItemWidth]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(p =>
            [p.name, p.code, p.description].some(v => (v ?? '').toLowerCase().includes(q)),
        );
    }, [options, query]);

    const toggle = (id: number | string) => {
        const next = new Set(value);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange(next);
    };

    const selectAll = () => {
        const next = new Set<number | string>();
        for (const p of filtered) next.add(p.id);
        onChange(next);
    };

    const clearAll = () => onChange(new Set());

    const keyExtractor = (item: PermissionOption) => String(item.id);

    const Item = ({ item }: { item: PermissionOption }) => {
        const active = value.has(item.id);
        console.log(active);
        console.log(item);
        return (
            <Pressable
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [
                    styles.item,
                    {
                        width: itemW,
                        backgroundColor: active ? `${tint}14` : fieldBg,
                        borderColor: active ? `${tint}66` : border,
                    },
                    pressed && { opacity: 0.9 },
                ]}
                {...ripple('#00000012')}
            >
                <View style={styles.itemRow}>
                    <MaterialCommunityIcons
                        name={active ? 'check-circle' : 'checkbox-blank-circle-outline'}
                        size={18}
                        color={active ? tint : muted}
                    />
                    <Text style={[styles.itemTitle, { color: active ? tint : text }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                </View>
                {!!item.code && <Text style={[styles.itemCode, { color: muted }]} numberOfLines={1}>{item.code}</Text>}
                {!!item.description && <Text style={[styles.itemDesc, { color: muted }]} numberOfLines={2}>{item.description}</Text>}
            </Pressable>
        );
    };

    return (
        <View style={[styles.wrap, style]}>
            <View style={[styles.headerRow, { borderColor: border }]}>
                <Text style={[styles.headerTitle, { color: text }]}>Permisos</Text>
                <View style={styles.actionsRow}>
                    <Pressable
                        onPress={selectAll}
                        style={({ pressed }) => [styles.pill, { backgroundColor: surface, borderColor: border }, pressed && { opacity: 0.9 }]}
                        {...ripple('#00000012')}
                    >
                        <MaterialCommunityIcons name="checkbox-multiple-marked-outline" size={16} color={text} />
                        <Text style={[styles.pillText, { color: text }]}>Seleccionar todo</Text>
                    </Pressable>
                    <Pressable
                        onPress={clearAll}
                        style={({ pressed }) => [styles.pill, { backgroundColor: surface, borderColor: border }, pressed && { opacity: 0.9 }]}
                        {...ripple('#00000012')}
                    >
                        <MaterialCommunityIcons name="selection-off" size={16} color={text} />
                        <Text style={[styles.pillText, { color: text }]}>Limpiar</Text>
                    </Pressable>
                    <View style={[styles.counter, { backgroundColor: `${tint}16`, borderColor: `${tint}66` }]}>
                        <MaterialCommunityIcons name="counter" size={14} color={tint} />
                        <Text style={{ color: tint, fontWeight: '700', fontSize: 12 }}>
                            {value.size}/{options.length}
                        </Text>
                    </View>
                </View>
            </View>

            {searchable && (
                <View style={[styles.searchBox, { backgroundColor: fieldBg, borderColor: border }]}>
                    <MaterialCommunityIcons name="magnify" size={18} color={muted} />
                    <TextInput
                        placeholder="Buscar permiso…"
                        placeholderTextColor={muted}
                        value={query}
                        onChangeText={setQuery}
                        style={[styles.searchInput, { color: text }]}
                        returnKeyType="search"
                    />
                    {!!query && (
                        <Pressable onPress={() => setQuery('')}>
                            <MaterialCommunityIcons name="close" size={16} color={muted} />
                        </Pressable>
                    )}
                </View>
            )}

            <View
                style={[
                    styles.listWrap,
                    { borderColor: border, backgroundColor: surface, maxHeight: internalScroll ? maxHeight : undefined },
                ]}
                onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
            >
                {internalScroll ? (
                    <FlatList
                        key={columns}
                        data={filtered}
                        keyExtractor={keyExtractor}
                        renderItem={({ item }) => <Item item={item} />}
                        numColumns={columns}
                        columnWrapperStyle={columns > 1 ? { gap, justifyContent: 'flex-start' } : undefined}
                        ItemSeparatorComponent={columns === 1 ? () => <View style={{ height: gap }} /> : undefined}
                        contentContainerStyle={{ paddingHorizontal: padH, paddingVertical: 10, gap: columns > 1 ? gap : 0 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                        removeClippedSubviews={Platform.OS !== 'web'}
                        extraData={{ columns, itemW, value }}
                    />
                ) : (
                    <View style={{ paddingHorizontal: padH, paddingVertical: 10, rowGap: gap, columnGap: gap, flexDirection: 'row', flexWrap: 'wrap' }}>
                        {filtered.map((it) => <Item key={String(it.id)} item={it} />)}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 10 },
    headerRow: {
        paddingHorizontal: 2,
        paddingBottom: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    pillText: { fontSize: 12, fontWeight: '700' },
    counter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        marginTop: 2,
    },
    searchInput: { flex: 1, paddingVertical: 0, fontSize: 14 },
    listWrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
    item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, gap: 6 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemTitle: { fontSize: 14, fontWeight: '700' },
    itemCode: { fontSize: 11, opacity: 0.9 },
    itemDesc: { fontSize: 11, lineHeight: 14 },
});
