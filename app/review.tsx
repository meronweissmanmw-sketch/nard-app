import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ScrollView, Platform, Image, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_ITEM_STATUS = 'open';
const DEFAULT_ITEM_PRIORITY = 'medium';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: 'פתוח', color: '#FF3B30', bg: '#FFE5E5' },
    in_progress: { label: 'בטיפול', color: '#FF9500', bg: '#FFF3E0' },
    fixed: { label: 'טופל', color: '#34C759', bg: '#E8F9EE' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    critical: { label: 'קריטי', color: '#CC0000', bg: '#FFE5E5' },
    high: { label: 'גבוה', color: '#FF3B30', bg: '#FFF0F0' },
    medium: { label: 'בינוני', color: '#FF9500', bg: '#FFF8E1' },
    low: { label: 'נמוך', color: '#34C759', bg: '#F0FFF4' },
};

export default function ReviewScreen() {
    const router = useRouter();
    const { projectId, reportId } = useLocalSearchParams();

    const [project, setProject] = useState<any>(null);
    const [report, setReport] = useState<any>(null);
    const [sections, setSections] = useState<any[]>([]);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const toggleExpand = (itemId: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [projectId, reportId])
    );

    const loadData = async () => {
        try {
            const [data, openingNote, closingNote, defaultSubject] = await Promise.all([
                AsyncStorage.getItem('projects'),
                AsyncStorage.getItem('openingNote'),
                AsyncStorage.getItem('closingNote'),
                AsyncStorage.getItem('defaultSubject')
            ]);

            if (data) {
                const projects = JSON.parse(data);
                const foundProject = projects.find((p: any) => p.id === projectId);
                const foundReport = foundProject?.reports?.find((r: any) => r.id === reportId);

                if (foundReport && !foundReport.subject) {
                    foundReport.subject = defaultSubject ?? 'דוח פיקוח הנדסי';
                }
                if (foundReport && foundReport.initialNotes == null) {
                    foundReport.initialNotes = openingNote ?? '';
                }
                if (foundReport && foundReport.finalNotes == null) {
                    foundReport.finalNotes = closingNote ?? '';
                }

                setProject(foundProject);
                setReport(foundReport);
                if (foundReport) {
                    buildReviewList(foundReport);
                }
            }
        } catch (e) {
            console.error('Failed to load data', e);
        }
    };

    const buildReviewList = (reportData: any) => {
        const list: any[] = [];

        list.push({
            type: 'comment',
            position: 'start',
            label: reportData.initialNotes ?? '',
            noteKey: 'initialNotes',
            id: `report-start-${reportData.id}`
        });

        (reportData.items || []).forEach((it: any, idx: number) => {
            list.push({
                type: 'commentWindow',
                label: it.notes || 'ליקוי',
                id: `item-${it.id}`,
                item: it,
                serial: idx + 1
            });
        });

        list.push({
            type: 'comment',
            position: 'end',
            label: reportData.finalNotes ?? '',
            noteKey: 'finalNotes',
            id: `report-end-${reportData.id}`
        });

        setSections(list);
    };

    const persistItemField = async (itemId: string, fields: Partial<{ notes: string; assignedTo: string; images: string[]; location: string; status: string; priority: string }>) => {
        try {
            const data = await AsyncStorage.getItem('projects');
            if (!data) return;
            const projects = JSON.parse(data);
            const updated = projects.map((p: any) => {
                if (p.id !== projectId) return p;
                return {
                    ...p,
                    reports: (p.reports || []).map((r: any) => {
                        if (r.id !== reportId) return r;
                        const newItems = (r.items || []).map((it: any) => it.id === itemId ? { ...it, ...fields } : it);
                        return { ...r, items: newItems };
                    })
                };
            });
            await AsyncStorage.setItem('projects', JSON.stringify(updated));
            setReport((prev: any) => ({ ...prev, items: (prev.items || []).map((it: any) => it.id === itemId ? { ...it, ...fields } : it) }));
        } catch (e) {
            console.error('Failed to persist item field', e);
        }
    };

    const persistReportField = async (field: 'initialNotes' | 'finalNotes' | 'subject', value: string) => {
        try {
            setReport((prev: any) => ({ ...prev, [field]: value }));
            const data = await AsyncStorage.getItem('projects');
            if (!data) return;
            const projects = JSON.parse(data);
            const updated = projects.map((p: any) => {
                if (p.id !== projectId) return p;
                return {
                    ...p,
                    reports: (p.reports || []).map((r: any) => r.id === reportId ? { ...r, [field]: value } : r)
                };
            });
            await AsyncStorage.setItem('projects', JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to persist report field', e);
        }
    };

    const deleteCommentWindow = async (itemId: string) => {
        try {
            const data = await AsyncStorage.getItem('projects');
            if (!data) return;
            const projects = JSON.parse(data);
            const updated = projects.map((p: any) => {
                if (p.id !== projectId) return p;
                return {
                    ...p,
                    reports: (p.reports || []).map((r: any) => {
                        if (r.id !== reportId) return r;
                        return { ...r, items: (r.items || []).filter((it: any) => it.id !== itemId) };
                    })
                };
            });
            await AsyncStorage.setItem('projects', JSON.stringify(updated));
            const newReport = { ...report, items: (report?.items || []).filter((it: any) => it.id !== itemId) };
            setReport(newReport);
            buildReviewList(newReport);
        } catch (e) {
            console.error('Failed to delete comment window', e);
        }
    };

    const reorderItem = async (itemId: string, direction: 'up' | 'down') => {
        try {
            const items = [...(report?.items || [])];
            const idx = items.findIndex((it: any) => it.id === itemId);
            if (idx === -1) return;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= items.length) return;
            [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];

            const data = await AsyncStorage.getItem('projects');
            if (!data) return;
            const projects = JSON.parse(data);
            const updated = projects.map((p: any) => {
                if (p.id !== projectId) return p;
                return {
                    ...p,
                    reports: (p.reports || []).map((r: any) => {
                        if (r.id !== reportId) return r;
                        return { ...r, items };
                    })
                };
            });
            await AsyncStorage.setItem('projects', JSON.stringify(updated));
            const newReport = { ...report, items };
            setReport(newReport);
            buildReviewList(newReport);
        } catch (e) {
            console.error('Failed to reorder item', e);
        }
    };

    const openCameraForItem = (it: any) => {
        if (!projectId || !reportId) {
            Alert.alert('שגיאה', 'פרויקט או דוח לא מוגדרים');
            return;
        }
        const url = `/camera?projectId=${encodeURIComponent(String(projectId))}&reportId=${encodeURIComponent(String(reportId))}&itemId=${encodeURIComponent(String(it.id))}&locationName=${encodeURIComponent(it.location || '')}`;
        router.push(url as any);
    };

    const itemCount = report?.items?.length || 0;

    const filteredSections = React.useMemo(() => {
        if (statusFilter === 'all') return sections;
        return sections.filter(s => {
            if (s.type === 'comment') return true;
            if (s.type === 'commentWindow') return (s.item?.status || DEFAULT_ITEM_STATUS) === statusFilter;
            return true;
        });
    }, [sections, statusFilter]);

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <View style={styles.topBarRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <View style={styles.topBarCenter}>
                        <Text style={styles.projectLabel}>{project?.name}</Text>
                        <Text style={styles.subjectText} numberOfLines={1}>{report?.subject || ''}</Text>
                    </View>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{itemCount} ליקויים</Text>
                    </View>
                </View>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE', gap: 8, justifyContent: 'flex-end' }}>
                {[
                    { key: 'all', label: 'הכל' },
                    { key: 'open', label: STATUS_CONFIG.open.label },
                    { key: 'in_progress', label: STATUS_CONFIG.in_progress.label },
                    { key: 'fixed', label: STATUS_CONFIG.fixed.label },
                ].map(f => (
                    <TouchableOpacity
                        key={f.key}
                        onPress={() => setStatusFilter(f.key)}
                        style={{
                            backgroundColor: statusFilter === f.key ? '#007AFF' : '#F2F2F7',
                            borderRadius: 14,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                        }}
                    >
                        <Text style={{ color: statusFilter === f.key ? '#FFF' : '#555', fontWeight: '600', fontSize: 13 }}>{f.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filteredSections}
                keyExtractor={(item) => item.id}
                removeClippedSubviews={false}
                initialNumToRender={15}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => {
                    if (item.type === 'comment') {
                        const noteKey = item.noteKey as 'initialNotes' | 'finalNotes';
                        return (
                            <View style={styles.commentSection}>
                                <Text style={styles.commentLabel}>{item.position === 'start' ? 'פתיחת דוח (הערת פתיחה)' : 'סיום דוח (הערת סיום)'}</Text>
                                <TextInput
                                    style={styles.commentInput}
                                    multiline
                                    value={report ? (report[noteKey] ?? '') : (item.label ?? '')}
                                    onChangeText={(txt) => setReport((prev: any) => ({ ...prev, [noteKey]: txt }))}
                                    onEndEditing={(e) => persistReportField(noteKey, e.nativeEvent.text)}
                                    placeholder={item.position === 'start' ? 'הערת פתיחה לדוח' : 'הערת סיום לדוח'}
                                    textAlign="right"
                                />
                            </View>
                        );
                    }

                    if (item.type === 'commentWindow') {
                        const it = item.item;
                        const liveItem = (report?.items || []).find((x: any) => x.id === it.id) || it;
                        const serial = item.serial;
                        const totalItems = report?.items?.length || 0;
                        const currentIndex = (serial ?? 1) - 1;
                        const isExpanded = expandedItems.has(liveItem.id);
                        const firstImage = liveItem.images && liveItem.images.length > 0 ? liveItem.images[0] : null;

                        return (
                            <View style={styles.commentWindow}>
                                {/* Collapsed row: serial, small photo, edit & delete buttons */}
                                <View style={styles.collapsedRow}>
                                    <View style={styles.collapsedLeft}>
                                        <TouchableOpacity
                                            onPress={() =>
                                                Alert.alert(
                                                    'מחיקת ליקוי',
                                                    'האם אתה בטוח שברצונך למחוק ליקוי זה?',
                                                    [
                                                        { text: 'ביטול', style: 'cancel' },
                                                        { text: 'מחק', style: 'destructive', onPress: () => deleteCommentWindow(liveItem.id) }
                                                    ]
                                                )
                                            }
                                            style={styles.deleteBtn}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                            <Text style={styles.deleteBtnText}>מחק</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => toggleExpand(liveItem.id)} style={styles.editBtn}>
                                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#FFF" />
                                            <Text style={styles.editBtnText}>{isExpanded ? 'סגור' : 'עריכה'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.collapsedCenter}>
                                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <Text style={styles.commentSerial}>ליקוי מס׳: {serial ?? liveItem.id}</Text>
                                            {(() => {
                                                const s = STATUS_CONFIG[liveItem.status || DEFAULT_ITEM_STATUS];
                                                return <View style={{ backgroundColor: s.bg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ color: s.color, fontSize: 11, fontWeight: '600' }}>{s.label}</Text></View>;
                                            })()}
                                            {liveItem.priority && liveItem.priority !== DEFAULT_ITEM_PRIORITY && PRIORITY_CONFIG[liveItem.priority] && (() => {
                                                const p = PRIORITY_CONFIG[liveItem.priority];
                                                return <View style={{ backgroundColor: p.bg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ color: p.color, fontSize: 11, fontWeight: '600' }}>{p.label}</Text></View>;
                                            })()}
                                        </View>
                                        {(liveItem.location || liveItem.notes) ? (
                                            <Text style={styles.collapsedSummary} numberOfLines={1} ellipsizeMode="tail">
                                                {[liveItem.location, liveItem.notes].filter(Boolean).join(' · ')}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.collapsedRight}>
                                        {firstImage ? (
                                            <Image source={{ uri: firstImage }} style={styles.collapsedThumb} />
                                        ) : (
                                            <View style={styles.collapsedThumbPlaceholder}>
                                                <Ionicons name="image-outline" size={22} color="#CCC" />
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <View style={styles.expandedContent}>
                                        <View style={styles.reorderRow}>
                                            <View style={styles.reorderButtons}>
                                                <TouchableOpacity
                                                    onPress={() => reorderItem(liveItem.id, 'up')}
                                                    disabled={currentIndex <= 0}
                                                    style={[styles.reorderBtn, currentIndex <= 0 && styles.reorderBtnDisabled]}
                                                >
                                                    <Ionicons name="chevron-up" size={18} color={currentIndex <= 0 ? '#CCC' : '#555'} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => reorderItem(liveItem.id, 'down')}
                                                    disabled={currentIndex >= totalItems - 1}
                                                    style={[styles.reorderBtn, currentIndex >= totalItems - 1 && styles.reorderBtnDisabled]}
                                                >
                                                    <Ionicons name="chevron-down" size={18} color={currentIndex >= totalItems - 1 ? '#CCC' : '#555'} />
                                                </TouchableOpacity>
                                            </View>
                                            <TouchableOpacity onPress={() => openCameraForItem(liveItem)} style={styles.cameraBtnSmall}>
                                                <Ionicons name="camera" size={18} color="white" />
                                                <Text style={styles.cameraBtnTextSmall}>הוסף צילום</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.commentRow}>
                                            <Text style={styles.commentFieldLabel}>מיקום:</Text>
                                            <TextInput
                                                style={[styles.commentFieldInput, { minHeight: 36 }]}
                                                value={liveItem.location}
                                                onChangeText={(txt) => setReport((prev: any) => ({ ...prev, items: (prev.items || []).map((x: any) => x.id === liveItem.id ? { ...x, location: txt } : x) }))}
                                                onEndEditing={(e) => persistItemField(liveItem.id, { location: e.nativeEvent.text })}
                                                placeholder="מיקום"
                                                textAlign="right"
                                            />
                                        </View>

                                        <View style={styles.commentRow}>
                                            <Text style={styles.commentFieldLabel}>הערות:</Text>
                                            <TextInput
                                                style={styles.commentFieldInput}
                                                multiline
                                                value={liveItem.notes}
                                                onChangeText={(txt) => setReport((prev: any) => ({ ...prev, items: (prev.items || []).map((x: any) => x.id === liveItem.id ? { ...x, notes: txt } : x) }))}
                                                onEndEditing={(e) => persistItemField(liveItem.id, { notes: e.nativeEvent.text })}
                                                placeholder="הערות"
                                                textAlign="right"
                                            />
                                        </View>

                                        <View style={styles.commentRow}>
                                            <Text style={styles.commentFieldLabel}>אחראי לתיקון:</Text>
                                            <TextInput
                                                style={[styles.commentFieldInput, { height: 36 }]}
                                                value={liveItem.assignedTo}
                                                onChangeText={(txt) => setReport((prev: any) => ({ ...prev, items: (prev.items || []).map((x: any) => x.id === liveItem.id ? { ...x, assignedTo: txt } : x) }))}
                                                onEndEditing={(e) => persistItemField(liveItem.id, { assignedTo: e.nativeEvent.text })}
                                                placeholder="אחראי"
                                                textAlign="right"
                                            />
                                        </View>

                                        <View style={styles.commentRow}>
                                            <Text style={styles.commentFieldLabel}>סטטוס:</Text>
                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                                    const current = liveItem.status || DEFAULT_ITEM_STATUS;
                                                    return (
                                                        <TouchableOpacity
                                                            key={key}
                                                            onPress={() => {
                                                                setReport((prev: any) => ({ ...prev, items: (prev.items || []).map((x: any) => x.id === liveItem.id ? { ...x, status: key } : x) }));
                                                                persistItemField(liveItem.id, { status: key });
                                                            }}
                                                            style={{
                                                                backgroundColor: current === key ? cfg.bg : '#F2F2F7',
                                                                borderRadius: 14,
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 6,
                                                                borderWidth: 2,
                                                                borderColor: current === key ? cfg.color : 'transparent',
                                                            }}
                                                        >
                                                            <Text style={{ color: current === key ? cfg.color : '#8E8E93', fontWeight: '600', fontSize: 13 }}>{cfg.label}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>

                                        <View style={styles.commentRowImage}>
                                            {liveItem.images && liveItem.images.length > 0 ? (
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    {liveItem.images.map((uri: string, i: number) => (
                                                        <View key={i} style={{ position: 'relative', marginLeft: 8 }}>
                                                            <Image source={{ uri }} style={styles.commentImageLarge} />
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    const newImages = liveItem.images.filter((_: string, idx: number) => idx !== i);
                                                                    setReport((prev: any) => ({ ...prev, items: (prev.items || []).map((x: any) => x.id === liveItem.id ? { ...x, images: newImages } : x) }));
                                                                    persistItemField(liveItem.id, { images: newImages });
                                                                }}
                                                                style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}
                                                            >
                                                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', lineHeight: 20 }}>✕</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            ) : (
                                                <View style={styles.commentImagePlaceholder}>
                                                    <Text style={{ color: '#999' }}>אין תמונה</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        );
                    }

                    return null;
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    topBar: {
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#DDD',
        paddingTop: Platform.OS === 'ios' ? 30 : 14
    },
    topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { padding: 4 },
    topBarCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
    projectLabel: { fontSize: 12, color: '#8E8E93', fontWeight: 'bold', textAlign: 'center' },
    subjectText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', textAlign: 'center' },
    badgeContainer: { backgroundColor: '#007AFF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    commentSection: { backgroundColor: '#FFF', padding: 12, marginHorizontal: 12, marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
    commentLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6, textAlign: 'right' },
    commentInput: { minHeight: 60, textAlignVertical: 'top', backgroundColor: '#F9F9F9', padding: 8, borderRadius: 6 },
    commentWindow: { backgroundColor: '#FFF', padding: 12, marginHorizontal: 12, marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
    commentWindowHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    commentSerial: { fontWeight: '700', fontSize: 15 },
    collapsedRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
    collapsedRight: { marginLeft: 8 },
    collapsedCenter: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 8 },
    collapsedLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    collapsedSummary: { fontSize: 12, color: '#8E8E93', marginTop: 2, textAlign: 'right' },
    collapsedThumb: { width: 56, height: 56, borderRadius: 6 },
    collapsedThumbPlaceholder: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' },
    editBtn: { backgroundColor: '#007AFF', flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center', gap: 4 },
    editBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#FF3B30' },
    deleteBtnText: { color: '#FF3B30', fontWeight: '600', fontSize: 13 },
    expandedContent: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 },
    reorderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    reorderButtons: { flexDirection: 'column', alignItems: 'center', marginLeft: 4 },
    reorderBtn: { padding: 2 },
    reorderBtnDisabled: { opacity: 0.3 },
    cameraBtnSmall: { backgroundColor: '#007AFF', flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
    cameraBtnTextSmall: { color: '#fff', marginLeft: 6, fontWeight: '600' },
    commentRow: { marginTop: 8 },
    commentFieldLabel: { textAlign: 'right', fontWeight: '600', marginBottom: 6 },
    commentFieldInput: { backgroundColor: '#F9F9F9', padding: 8, borderRadius: 6, minHeight: 40 },
    commentRowImage: { marginTop: 10, alignItems: 'flex-end' },
    commentImageSmall: { width: 90, height: 68, borderRadius: 6, marginLeft: 8 },
    commentImageLarge: { width: 200, height: 150, borderRadius: 8, marginLeft: 8 },
    commentImagePlaceholder: { width: 120, height: 90, borderRadius: 6, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' }
});
