import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ScrollView, Platform, Image, Alert, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const HEADER_HEIGHT = 40;
const FLOOR_HEIGHT = 36;
const PARKING_SUB_HEIGHT = 28;
const MODAL_SAVE_CONFIRMATION_DURATION = 1200;

export default function ReviewScreen() {
    const router = useRouter();
    const { projectId, reportId } = useLocalSearchParams();

    const [project, setProject] = useState<any>(null);
    const [report, setReport] = useState<any>(null);
    const [sections, setSections] = useState<any[]>([]);

    const [defectModalVisible, setDefectModalVisible] = useState(false);
    const [modalItem, setModalItem] = useState<any>(null);
    const [modalNotes, setModalNotes] = useState('');
    const [modalAssignedTo, setModalAssignedTo] = useState('');
    const [modalSaved, setModalSaved] = useState(false);
    const [modalSerial, setModalSerial] = useState<number | null>(null);
    const [pendingModalItemId, setPendingModalItemId] = useState<string | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [projectId, reportId])
    );

    useEffect(() => {
        if (pendingModalItemId && report) {
            const item = (report.items || []).find((it: any) => it.id === pendingModalItemId);
            if (item) {
                openDefectModal(item);
                setPendingModalItemId(null);
            }
        }
    }, [pendingModalItemId, report]);

    const openDefectModal = (item: any) => {
        setModalItem(item);
        setModalNotes(item.notes || '');
        setModalAssignedTo(item.assignedTo || '');
        setModalSaved(false);
        const serial = report?.items
            ? report.items.findIndex((x: any) => x.id === item.id) + 1
            : null;
        setModalSerial(serial);
        setDefectModalVisible(true);
    };

    const saveDefectModal = async () => {
        if (!modalItem) return;
        await persistItemField(modalItem.id, { notes: modalNotes, assignedTo: modalAssignedTo });
        setModalItem((prev: any) => ({ ...prev, notes: modalNotes, assignedTo: modalAssignedTo }));
        setModalSaved(true);
        setTimeout(() => {
            setDefectModalVisible(false);
            setModalSaved(false);
        }, MODAL_SAVE_CONFIRMATION_DURATION);
    };

    const openCameraForExistingItem = (it: any) => {
        if (!projectId || !reportId) {
            Alert.alert('שגיאה', 'פרויקט או דוח לא מוגדרים');
            return;
        }
        const url = `/camera?projectId=${encodeURIComponent(String(projectId))}&reportId=${encodeURIComponent(String(reportId))}&itemId=${encodeURIComponent(String(it.id))}&locationName=${encodeURIComponent(it.location || '')}`;
        router.push(url as any);
    };

    const loadData = async () => {
        try {
            const [data, defaultSubject] = await Promise.all([
                AsyncStorage.getItem('projects'),
                AsyncStorage.getItem('defaultSubject')
            ]);

            if (data) {
                const projects = JSON.parse(data);
                const foundProject = projects.find((p: any) => p.id === projectId);
                const foundReport = foundProject?.reports?.find((r: any) => r.id === reportId);

                if (foundReport && !foundReport.subject) {
                    foundReport.subject = defaultSubject ?? 'דוח פיקוח הנדסי';
                }

                setProject(foundProject);
                setReport(foundReport);
                if (foundProject) {
                    buildLocationTree(foundProject.structure);
                    try {
                        const targetRaw = await AsyncStorage.getItem('cameraReturnTarget');
                        if (targetRaw) {
                            const target = JSON.parse(targetRaw);
                            if (target && target.reportId === reportId && target.itemId) {
                                setPendingModalItemId(target.itemId);
                            }
                            await AsyncStorage.removeItem('cameraReturnTarget');
                        }
                    } catch (e) {
                        console.warn('Error reading cameraReturnTarget', e);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load data', e);
        }
    };

    const buildLocationTree = (structure: any) => {
        const tree: any[] = [];

        (structure?.buildings || []).forEach((b: any, bIdx: number) => {
            const bKey = b.id ?? `b${bIdx}`;
            tree.push({ type: 'header', label: b.name || `בניין ${bIdx + 1}`, id: `header-${bKey}`, meta: { floors: b.floors || 0 } });
            for (let i = 1; i <= (b.floors || 0); i++) {
                const fullLoc = `${b.name || `בניין ${bIdx + 1}`} - קומה ${i}`;
                tree.push({ type: 'floor', label: `קומה ${i}`, fullLocation: fullLoc, id: `floor-${bKey}-${i}` });
            }
        });

        if (Array.isArray(structure?.parkings) && structure.parkings.length > 0) {
            structure.parkings.forEach((p: any, pIdx: number) => {
                const pKey = p.id ?? `p${pIdx}`;
                tree.push({ type: 'header', label: p.name || `חניון ${pIdx + 1}`, id: `parking-header-${pKey}`, meta: { floors: p.floors || 0 } });
                if (Array.isArray(p.areas) && p.areas.length > 0) {
                    for (let i = 1; i <= (p.floors || 0); i++) {
                        tree.push({ type: 'parkingFloor', label: `קומה ${i}`, fullLocation: `${p.name || `חניון ${pIdx + 1}`} - קומה ${i}`, id: `parking-${pKey}-floor-${i}-header` });
                        p.areas.forEach((a: any, aIdx: number) => {
                            const aKey = a.id ?? `a${aIdx}`;
                            const fullLoc = `${p.name || `חניון ${pIdx + 1}`} - קומה ${i} - ${a.name || `אזור ${aIdx + 1}`}`;
                            tree.push({ type: 'floor', label: a.name || `אזור ${aIdx + 1}`, fullLocation: fullLoc, id: `parking-${pKey}-floor-${i}-area-${aKey}` });
                        });
                    }
                } else {
                    for (let i = 1; i <= (p.floors || 0); i++) {
                        tree.push({ type: 'parkingFloor', label: `קומה ${i}`, fullLocation: `${p.name || `חניון ${pIdx + 1}`} - קומה ${i}`, id: `parking-floor-${pKey}-${i}` });
                    }
                }
            });
        } else if (typeof structure?.parkingFloors === 'number' && structure.parkingFloors > 0) {
            tree.push({ type: 'header', label: 'חניון', id: `parking-header` });
            for (let i = 1; i <= structure.parkingFloors; i++) {
                tree.push({ type: 'parkingFloor', label: `קומה ${i}`, fullLocation: `חניון - קומה ${i}`, id: `parking-floor-${i}` });
            }
        }

        if (Array.isArray(structure?.development?.areas) && structure.development.areas.length > 0) {
            tree.push({ type: 'header', label: 'פיתוח חוץ', id: `dev-header`, meta: { floors: 1 } });
            tree.push({ type: 'parkingFloor', label: 'קומה 1', fullLocation: 'פיתוח חוץ - קומה 1', id: `dev-floor-1` });
            structure.development.areas.forEach((a: any, aIdx: number) => {
                const aKey = a.id ?? `a${aIdx}`;
                const fullLoc = `פיתוח חוץ - קומה 1 - ${a.name || `אזור ${aIdx + 1}`}`;
                tree.push({ type: 'floor', label: a.name || `אזור ${aIdx + 1}`, fullLocation: fullLoc, id: `dev-area-${aKey}` });
            });
        } else if (structure?.hasDevelopment && Array.isArray(structure?.areas) && structure.areas.length > 0) {
            tree.push({ type: 'header', label: 'פיתוח חוץ', id: `dev-header`, meta: { floors: 1 } });
            tree.push({ type: 'parkingFloor', label: 'קומה 1', fullLocation: 'פיתוח חוץ - קומה 1', id: `dev-floor-1` });
            structure.areas.forEach((a: any, aIdx: number) => {
                const aKey = a.id ?? `a${aIdx}`;
                const fullLoc = `פיתוח חוץ - קומה 1 - ${a.name || `אזור ${aIdx + 1}`}`;
                tree.push({ type: 'floor', label: a.name || `אזור ${aIdx + 1}`, fullLocation: fullLoc, id: `dev-area-${aKey}` });
            });
        }

        setSections(tree);
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

    const openCameraForLocation = (locationName: string) => {
        if (!projectId || !reportId) {
            Alert.alert('שגיאה', 'פרויקט או דוח לא מוגדרים');
            return;
        }
        const url = `/camera?projectId=${encodeURIComponent(String(projectId))}&reportId=${encodeURIComponent(String(reportId))}&locationName=${encodeURIComponent(locationName)}`;
        router.push(url as any);
    };

    const itemCount = report?.items?.length || 0;

    const getItemLayout = (data: any, index: number) => {
        if (!data || index >= data.length) {
            return { length: FLOOR_HEIGHT, offset: FLOOR_HEIGHT * index, index };
        }
        let offset = 0;
        for (let i = 0; i < index; i++) {
            const t = data[i]?.type;
            offset += t === 'header' ? HEADER_HEIGHT : (t === 'parkingFloor' ? PARKING_SUB_HEIGHT : FLOOR_HEIGHT);
        }
        const tIndex = data[index]?.type;
        const length = tIndex === 'header' ? HEADER_HEIGHT : (tIndex === 'parkingFloor' ? PARKING_SUB_HEIGHT : FLOOR_HEIGHT);
        return { length, offset, index };
    };

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
                getItemLayout={getItemLayout}
                removeClippedSubviews={false}
                initialNumToRender={20}
                stickyHeaderIndices={sections
                    .map((obj, index) => obj?.type === 'header' ? index : -1)
                    .filter(idx => idx !== -1)
                }
                renderItem={({ item }) => {
                    if (item.type === 'header') {
                        const floors = item.meta?.floors;
                        return (
                            <View style={styles.headerSection}>
                                <View style={styles.headerRowInner}>
                                    <View style={{ alignItems: 'flex-end', flex: 1 }}>
                                        <Text style={styles.headerText}>{item.label}</Text>
                                        {typeof floors === 'number' && floors > 0 ? (
                                            <Text style={styles.headerSubText}>{`קומות: ${floors}`}</Text>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        );
                    }

                    if (item.type === 'parkingFloor') {
                        return (
                            <View style={styles.parkingFloorSection}>
                                <View style={styles.floorRowInner}>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={styles.parkingFloorText}>{item.label}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    }

                    if (item.type === 'floor') {
                        const pathLabel = item.fullLocation || item.label;
                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                style={styles.floorSection}
                                onPress={() => openCameraForLocation(pathLabel)}
                            >
                                <View style={styles.floorRowInner}>
                                    <View style={styles.floorCameraBtn}>
                                        <Ionicons name="camera" size={18} color="white" />
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={styles.floorText}>{pathLabel}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }

                    return null;
                }}
            />

            <Modal
                visible={defectModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setDefectModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setDefectModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>
                                {modalSerial != null ? `ליקוי מס׳ ${modalSerial}` : 'עריכת ליקוי'}
                            </Text>
                            <View style={{ width: 40 }} />
                        </View>

                        {modalItem && (
                            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                                <Text style={styles.modalFieldLabel}>מיקום:</Text>
                                <Text style={styles.modalLocationText}>{modalItem.location}</Text>

                                <Text style={styles.modalFieldLabel}>הערות:</Text>
                                <TextInput
                                    style={styles.modalTextArea}
                                    multiline
                                    value={modalNotes}
                                    onChangeText={setModalNotes}
                                    placeholder="הזן הערות על הליקוי"
                                    textAlign="right"
                                    textAlignVertical="top"
                                />

                                <Text style={styles.modalFieldLabel}>אחראי לתיקון:</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={modalAssignedTo}
                                    onChangeText={setModalAssignedTo}
                                    placeholder="שם האחראי לתיקון"
                                    textAlign="right"
                                />

                                {modalItem.images && modalItem.images.length > 0 && (
                                    <>
                                        <Text style={styles.modalFieldLabel}>תמונות ({modalItem.images.length}):</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                            {modalItem.images.map((uri: string, i: number) => (
                                                <Image key={i} source={{ uri }} style={styles.modalImage} />
                                            ))}
                                        </ScrollView>
                                    </>
                                )}

                                <TouchableOpacity
                                    style={styles.modalCameraBtn}
                                    onPress={() => {
                                        setDefectModalVisible(false);
                                        openCameraForExistingItem(modalItem);
                                    }}
                                >
                                    <Ionicons name="camera" size={18} color="white" />
                                    <Text style={styles.modalCameraBtnText}>הוסף / עדכן צילום</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}

                        {modalSaved ? (
                            <View style={styles.modalSavedMsg}>
                                <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                                <Text style={styles.modalSavedText}>הליקוי נשמר בהצלחה ✓</Text>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveDefectModal}>
                                <Text style={styles.modalSaveBtnText}>שמור ליקוי</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
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
    headerSection: {
        backgroundColor: '#E5E5EA',
        paddingHorizontal: 15,
        height: HEADER_HEIGHT,
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#D1D1D6'
    },
    headerText: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
    headerSubText: { fontSize: 12, color: '#6B6B6B', marginTop: 2, textAlign: 'right' },
    headerRowInner: { flexDirection: 'row-reverse', alignItems: 'center' },
    floorRowInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
    floorCameraBtn: { backgroundColor: '#007AFF', padding: 8, borderRadius: 6, marginLeft: 10 },
    floorSection: {
        backgroundColor: '#F7F7F9',
        paddingHorizontal: 20,
        height: FLOOR_HEIGHT,
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFF3'
    },
    parkingFloorSection: {
        backgroundColor: '#FAFAFC',
        paddingHorizontal: 20,
        height: PARKING_SUB_HEIGHT,
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F5'
    },
    parkingFloorText: { fontSize: 13, color: '#666', textAlign: 'right' },
    floorText: { fontSize: 15, fontWeight: '600', textAlign: 'right', color: '#444' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end'
    },
    modalContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '85%',
        paddingBottom: Platform.OS === 'ios' ? 30 : 16
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE'
    },
    modalCloseBtn: { padding: 4 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', flex: 1 },
    modalBody: { paddingHorizontal: 16, paddingTop: 12 },
    modalFieldLabel: { fontSize: 14, fontWeight: '600', color: '#555', textAlign: 'right', marginBottom: 6, marginTop: 10 },
    modalLocationText: {
        fontSize: 14,
        color: '#333',
        textAlign: 'right',
        backgroundColor: '#F2F2F7',
        padding: 10,
        borderRadius: 8
    },
    modalTextArea: {
        backgroundColor: '#F9F9F9',
        borderRadius: 8,
        padding: 10,
        minHeight: 90,
        textAlignVertical: 'top',
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#E5E5EA'
    },
    modalInput: {
        backgroundColor: '#F9F9F9',
        borderRadius: 8,
        padding: 10,
        height: 44,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#E5E5EA'
    },
    modalImage: { width: 100, height: 75, borderRadius: 8, marginRight: 8 },
    modalCameraBtn: {
        backgroundColor: '#555',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 12,
        marginBottom: 16
    },
    modalCameraBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15, marginLeft: 8 },
    modalSaveBtn: {
        backgroundColor: '#007AFF',
        margin: 16,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    modalSaveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    modalSavedMsg: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 16,
        paddingVertical: 14,
        backgroundColor: '#F0FFF4',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#34C759'
    },
    modalSavedText: { color: '#34C759', fontWeight: '700', fontSize: 16, marginLeft: 8 }
});
