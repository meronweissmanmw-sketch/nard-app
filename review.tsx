import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ScrollView, Platform, Image, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function ReviewScreen() {
    const router = useRouter();
    const { projectId, reportId } = useLocalSearchParams();

    const [project, setProject] = useState<any>(null);
    const [report, setReport] = useState<any>(null);
    const [sections, setSections] = useState<any[]>([]);

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

    const persistItemField = async (itemId: string, fields: Partial<{ notes: string; assignedTo: string; images: string[]; location: string }>) => {
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

    const openCameraForItem = (it: any) => {
        if (!projectId || !reportId) {
            Alert.alert('שגיאה', 'פרויקט או דוח לא מוגדרים');
            return;
        }
        const url = `/camera?projectId=${encodeURIComponent(String(projectId))}&reportId=${encodeURIComponent(String(reportId))}&itemId=${encodeURIComponent(String(it.id))}&locationName=${encodeURIComponent(it.location || '')}`;
        router.push(url as any);
    };

    const itemCount = report?.items?.length || 0;

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

            <FlatList
                data={sections}
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
                        return (
                            <View style={styles.commentWindow}>
                                <View style={styles.commentWindowHeader}>
                                    <Text style={styles.commentSerial}>ליקוי מס׳: {serial ?? liveItem.id}</Text>
                                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={() => deleteCommentWindow(liveItem.id)} style={{ marginLeft: 8 }}>
                                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => openCameraForItem(liveItem)} style={styles.cameraBtnSmall}>
                                            <Ionicons name="camera" size={18} color="white" />
                                            <Text style={styles.cameraBtnTextSmall}>הוסף צילום</Text>
                                        </TouchableOpacity>
                                    </View>
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

                                <View style={styles.commentRowImage}>
                                    {liveItem.images && liveItem.images.length > 0 ? (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {liveItem.images.map((uri: string, i: number) => (
                                                <Image key={i} source={{ uri }} style={styles.commentImageSmall} />
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        <View style={styles.commentImagePlaceholder}>
                                            <Text style={{ color: '#999' }}>אין תמונה</Text>
                                        </View>
                                    )}
                                </View>
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
    commentSerial: { fontWeight: '700', fontSize: 16 },
    cameraBtnSmall: { backgroundColor: '#007AFF', flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
    cameraBtnTextSmall: { color: '#fff', marginLeft: 6, fontWeight: '600' },
    commentRow: { marginTop: 8 },
    commentFieldLabel: { textAlign: 'right', fontWeight: '600', marginBottom: 6 },
    commentFieldInput: { backgroundColor: '#F9F9F9', padding: 8, borderRadius: 6, minHeight: 40 },
    commentRowImage: { marginTop: 10, alignItems: 'flex-end' },
    commentImageSmall: { width: 90, height: 68, borderRadius: 6, marginLeft: 8 },
    commentImagePlaceholder: { width: 120, height: 90, borderRadius: 6, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' }
});
