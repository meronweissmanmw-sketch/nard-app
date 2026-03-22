import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ScrollView, Platform, Image, Alert, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

// קבועים עבור חישובי גובה - קריטי למניעת קריסות באנדרואיד
const HEADER_HEIGHT = 40; // reduced header height to save space
const FLOOR_HEIGHT = 36; // sticky floor / region height
const PARKING_SUB_HEIGHT = 28; // small divider for parking floors
const LOCATION_HEIGHT = 65; // regular clickable rows (building floors / areas)
const COMMENT_HEIGHT = 120; // start/end comment item
const COMMENT_WINDOW_HEIGHT = 180; // comment window (likiu) height
const COMPACT_DEFECT_HEIGHT = 92; // compact defect card shown in walk mode
const MODAL_SAVE_CONFIRMATION_DURATION = 1200; // ms to show "saved" confirmation before closing modal

export default function EditorScreen() {
    const router = useRouter();
    const { projectId, reportId } = useLocalSearchParams();
    const flatListRef = useRef<FlatList>(null);

    const [project, setProject] = useState<any>(null);
    const [report, setReport] = useState<any>(null);
    const [sections, setSections] = useState<any[]>([]);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [highlightOn, setHighlightOn] = useState<boolean>(true);
    const flashIntervalRef = useRef<number | null>(null);
    const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 10 });

    // Modal state for editing defect details inline
    const [defectModalVisible, setDefectModalVisible] = useState(false);
    const [modalItem, setModalItem] = useState<any>(null);
    const [modalNotes, setModalNotes] = useState('');
    const [modalAssignedTo, setModalAssignedTo] = useState('');
    const [modalSaved, setModalSaved] = useState(false);
    const [modalSerial, setModalSerial] = useState<number | null>(null);
    const [pendingModalItemId, setPendingModalItemId] = useState<string | null>(null);

    const formatFloorPath = (path: string) => {
        return path
            .replace(/בניין/g, 'ב')
            .replace(/חניון/g, 'ח')
            .replace(/אזור/g, 'א')
            .replace(/פיתוח חוץ/g, 'פח')
            .replace(/קומה/g, 'ק');
    };

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [projectId, reportId])
    );

    // Open the defect modal when a pending item id is set (e.g. after returning from camera)
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
        // Compute serial once so it doesn't re-run findIndex on every render
        const serial = report?.items
            ? report.items.findIndex((x: any) => x.id === item.id) + 1
            : null;
        setModalSerial(serial);
        setDefectModalVisible(true);
    };

    const saveDefectModal = async () => {
        if (!modalItem) return;
        await persistItemField(modalItem.id, { notes: modalNotes, assignedTo: modalAssignedTo });
        // refresh modal item with updated data
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
            const data = await AsyncStorage.getItem('projects');
            const openingNote = await AsyncStorage.getItem('openingNote') || '';
            const closingNote = await AsyncStorage.getItem('closingNote') || '';
            const defaultSubject = await AsyncStorage.getItem('defaultSubject') || "דוח פיקוח הנדסי";

            if (data) {
                const projects = JSON.parse(data);
                const foundProject = projects.find((p: any) => p.id === projectId);
                const foundReport = foundProject?.reports?.find((r: any) => r.id === reportId);

                if (foundReport && !foundReport.subject) {
                    foundReport.subject = defaultSubject;
                }
                // Ensure report has initial and final notes (taken from settings if missing)
                if (foundReport && foundReport.initialNotes == null) {
                    foundReport.initialNotes = openingNote;
                }
                if (foundReport && foundReport.finalNotes == null) {
                    foundReport.finalNotes = closingNote;
                }
                setProject(foundProject);
                setReport(foundReport);
                if (foundProject) {
                    const tree = buildLocationTree(foundProject.structure, foundReport);
                    // check if camera created/updated an item and scroll to it
                    try {
                        const targetRaw = await AsyncStorage.getItem('cameraReturnTarget');
                        if (targetRaw) {
                            const target = JSON.parse(targetRaw);
                            if (target && target.reportId === reportId && target.itemId) {
                                const idx = tree.findIndex((s: any) => s.id === `item-${target.itemId}`);
                                if (idx >= 0 && flatListRef.current) {
                                    setTimeout(() => {
                                        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
                                        const targetId = `item-${target.itemId}`;
                                        startFlash(targetId);
                                    }, 400);
                                }
                                // Auto-open the modal so the user can fill in defect details
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
            console.error("Failed to load data", e);
        }
    };

    // computeOffsetForIndex and dynamic measurement removed to simplify navigator scrolling

    const startFlash = (id: string) => {
        // clear any existing interval
        if (flashIntervalRef.current) {
            clearInterval(flashIntervalRef.current as any);
            flashIntervalRef.current = null;
        }
        setHighlightedId(id);
        setHighlightOn(true);
        let count = 0;
        flashIntervalRef.current = setInterval(() => {
            setHighlightOn(prev => !prev);
            count++;
            if (count >= 6) {
                if (flashIntervalRef.current) {
                    clearInterval(flashIntervalRef.current as any);
                    flashIntervalRef.current = null;
                }
                setHighlightedId(null);
                setHighlightOn(true);
            }
        }, 180) as unknown as number;
    };

    useEffect(() => {
        return () => {
            if (flashIntervalRef.current) {
                clearInterval(flashIntervalRef.current as any);
                flashIntervalRef.current = null;
            }
        };
    }, []);

    const openReviewPage = () => {
        router.push(`/review?projectId=${encodeURIComponent(String(projectId))}&reportId=${encodeURIComponent(String(reportId))}` as any);
    };

    const openCameraForLocation = (locationName: string) => {
        if (!projectId || !reportId) {
            Alert.alert('שגיאה', 'פרויקט או דוח לא מוגדרים');
            return;
        }
        const url = `/camera?projectId=${encodeURIComponent(String(projectId))}&reportId=${encodeURIComponent(String(reportId))}&locationName=${encodeURIComponent(locationName)}`;
        router.push(url as any);
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

            // update local state
            setReport((prev: any) => ({ ...prev, items: (prev.items || []).map((it: any) => it.id === itemId ? { ...it, ...fields } : it) }));
        } catch (e) {
            console.error('Failed to persist item field', e);
        }
    };

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

    const persistReportField = async (field: 'initialNotes' | 'finalNotes' | 'subject', value: string) => {
        try {
            // update local state
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

    const buildLocationTree = (structure: any, reportData?: any) => {
        const tree: any[] = [];

        // prepare items map so we can insert comment windows under their matching location
        const remainingItems = reportData && Array.isArray(reportData.items) ? [...reportData.items] : [];

        // Insert report initial comment as first item
        if (reportData) {
            tree.push({
                type: 'comment',
                position: 'start',
                label: reportData.initialNotes ?? '',
                noteKey: 'initialNotes',
                id: `report-start-${reportData.id}`
            });
        }

        // Buildings (main floors)
        (structure?.buildings || []).forEach((b: any, bIdx: number) => {
            const bKey = b.id ?? `b${bIdx}`;
            tree.push({ type: 'header', label: b.name || `בניין ${bIdx + 1}`, id: `header-${bKey}`, meta: { floors: b.floors || 0 } });
            for (let i = 1; i <= (b.floors || 0); i++) {
                const fullLoc = `${b.name || `בניין ${bIdx + 1}`} - קומה ${i}`;
                // use 'floor' type so the floor subtitle behaves like the parking floors (sticky at bottom of header)
                tree.push({
                    type: 'floor',
                    label: `קומה ${i}`,
                    fullLocation: fullLoc,
                    id: `floor-${bKey}-${i}`
                });

                // Insert any comment windows that belong to this location
                if (remainingItems.length) {
                    const matches = remainingItems.filter((it: any) => it.location === fullLoc);
                    matches.forEach((it: any) => {
                        tree.push({ type: 'commentWindow', label: it.notes || `ליקוי`, id: `item-${it.id}`, item: it });
                    });
                    // remove matched items from remainingItems
                    matches.forEach((m: any) => {
                        const idx = remainingItems.findIndex((x: any) => x.id === m.id);
                        if (idx >= 0) remainingItems.splice(idx, 1);
                    });
                }
            }
        });

        // Parkings: support both array form (structure.parkings) and shorthand (parkingFloors)
        if (Array.isArray(structure?.parkings) && structure.parkings.length > 0) {
            structure.parkings.forEach((p: any, pIdx: number) => {
                const pKey = p.id ?? `p${pIdx}`;
                tree.push({ type: 'header', label: p.name || `חניון ${pIdx + 1}`, id: `parking-header-${pKey}`, meta: { floors: p.floors || 0 } });

                // If the parking defines areas, show each parking floor as a small divider
                // and treat each area as a sticky 'floor' (region) where comments can be added.
                if (Array.isArray(p.areas) && p.areas.length > 0) {
                    for (let i = 1; i <= (p.floors || 0); i++) {
                        // small parking floor divider (not sticky)
                        tree.push({ type: 'parkingFloor', label: `קומה ${i}`, fullLocation: `${p.name || `חניון ${pIdx + 1}`} - קומה ${i}`, id: `parking-${pKey}-floor-${i}-header` });

                        // areas per floor: treat as sticky 'floor' entries (regions)
                        p.areas.forEach((a: any, aIdx: number) => {
                            const aKey = a.id ?? `a${aIdx}`;
                            const fullLoc = `${p.name || `חניון ${pIdx + 1}`} - קומה ${i} - ${a.name || `אזור ${aIdx + 1}`}`;
                            tree.push({
                                type: 'floor',
                                label: a.name || `אזור ${aIdx + 1}`,
                                fullLocation: fullLoc,
                                id: `parking-${pKey}-floor-${i}-area-${aKey}`
                            });

                            // insert comment windows for this area/region
                            if (remainingItems.length) {
                                const matches = remainingItems.filter((it: any) => it.location === fullLoc);
                                matches.forEach((it: any) => tree.push({ type: 'commentWindow', label: it.notes || `ליקוי`, id: `item-${it.id}`, item: it }));
                                matches.forEach((m: any) => {
                                    const idx = remainingItems.findIndex((x: any) => x.id === m.id);
                                    if (idx >= 0) remainingItems.splice(idx, 1);
                                });
                            }
                        });
                    }
                } else {
                    // no areas defined: represent parking floors as small dividers (no comment regions)
                    for (let i = 1; i <= (p.floors || 0); i++) {
                        tree.push({ type: 'parkingFloor', label: `קומה ${i}`, fullLocation: `${p.name || `חניון ${pIdx + 1}`} - קומה ${i}`, id: `parking-floor-${pKey}-${i}` });
                    }
                }
            });
        } else if (typeof structure?.parkingFloors === 'number' && structure.parkingFloors > 0) {
            // single parking block with N floors (no areas) - show as parkingFloor dividers
            const pf = structure.parkingFloors;
            tree.push({ type: 'header', label: 'חניון', id: `parking-header` });
            for (let i = 1; i <= pf; i++) {
                const fullLoc = `חניון - קומה ${i}`;
                tree.push({ type: 'parkingFloor', label: `קומה ${i}`, fullLocation: fullLoc, id: `parking-floor-${i}` });
            }
        }

        // Development / external areas (modeled like parking with one floor)
        if (Array.isArray(structure?.development?.areas) && structure.development.areas.length > 0) {
            tree.push({ type: 'header', label: 'פיתוח חוץ', id: `dev-header`, meta: { floors: 1 } });
            tree.push({ type: 'parkingFloor', label: 'קומה 1', fullLocation: 'פיתוח חוץ - קומה 1', id: `dev-floor-1` });
            structure.development.areas.forEach((a: any, aIdx: number) => {
                const aKey = a.id ?? `a${aIdx}`;
                const fullLoc = `פיתוח חוץ - קומה 1 - ${a.name || `אזור ${aIdx + 1}`}`;
                tree.push({
                    type: 'floor',
                    label: a.name || `אזור ${aIdx + 1}`,
                    fullLocation: fullLoc,
                    id: `dev-area-${aKey}`
                });

                if (remainingItems.length) {
                    const matches = remainingItems.filter((it: any) => it.location === fullLoc);
                    matches.forEach((it: any) => tree.push({ type: 'commentWindow', label: it.notes || `ליקוי`, id: `item-${it.id}`, item: it }));
                    matches.forEach((m: any) => {
                        const idx = remainingItems.findIndex((x: any) => x.id === m.id);
                        if (idx >= 0) remainingItems.splice(idx, 1);
                    });
                }
            });
        } else if (structure?.hasDevelopment && Array.isArray(structure?.areas) && structure.areas.length > 0) {
            // older shape: hasDevelopment + areas (treat as one-floor parking)
            tree.push({ type: 'header', label: 'פיתוח חוץ', id: `dev-header`, meta: { floors: 1 } });
            tree.push({ type: 'parkingFloor', label: 'קומה 1', fullLocation: 'פיתוח חוץ - קומה 1', id: `dev-floor-1` });
            structure.areas.forEach((a: any, aIdx: number) => {
                const aKey = a.id ?? `a${aIdx}`;
                const fullLoc = `פיתוח חוץ - קומה 1 - ${a.name || `אזור ${aIdx + 1}`}`;
                tree.push({
                    type: 'floor',
                    label: a.name || `אזור ${aIdx + 1}`,
                    fullLocation: fullLoc,
                    id: `dev-area-${aKey}`
                });

                if (remainingItems.length) {
                    const matches = remainingItems.filter((it: any) => it.location === fullLoc);
                    matches.forEach((it: any) => tree.push({ type: 'commentWindow', label: it.notes || `ליקוי`, id: `item-${it.id}`, item: it }));
                    matches.forEach((m: any) => {
                        const idx = remainingItems.findIndex((x: any) => x.id === m.id);
                        if (idx >= 0) remainingItems.splice(idx, 1);
                    });
                }
            });
        }
        // Append any remaining items that did not match a location
        if (remainingItems.length) {
            remainingItems.forEach((it: any, idx: number) => {
                tree.push({ type: 'commentWindow', label: it.notes || `ליקוי`, id: `item-${it.id}`, item: it });
            });
        }

        // Insert report final comment as last item
        if (reportData) {
            tree.push({
                type: 'comment',
                position: 'end',
                label: reportData.finalNotes ?? '',
                noteKey: 'finalNotes',
                id: `report-end-${reportData.id}`
            });
        }

        // Walk mode: show only structural items (headers, floors, parking floors) - no defect cards or notes
        const walkTree = tree.filter((it: any) => it.type !== 'comment' && it.type !== 'commentWindow');
        setSections(walkTree);
        return walkTree;
    };

    const deleteCommentWindow = async (itemId: string) => {
        try {
            // update storage
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

            // update local state
            const newReport = { ...report, items: (report?.items || []).filter((it: any) => it.id !== itemId) };
            setReport(newReport);
            // rebuild sections with updated report
            if (project) buildLocationTree(project.structure, newReport);
        } catch (e) {
            console.error('Failed to delete comment window', e);
        }
    };

    const getItemLayout = (data: any, index: number) => {
        if (!data || index >= data.length) {
            return { length: LOCATION_HEIGHT, offset: LOCATION_HEIGHT * index, index };
        }

        let offset = 0;
        for (let i = 0; i < index; i++) {
            const t = data[i]?.type;
            offset += t === 'header' ? HEADER_HEIGHT : (t === 'floor' ? FLOOR_HEIGHT : (t === 'parkingFloor' ? PARKING_SUB_HEIGHT : (t === 'comment' ? COMMENT_HEIGHT : (t === 'commentWindow' ? COMPACT_DEFECT_HEIGHT : LOCATION_HEIGHT))));
        }

        const tIndex = data[index]?.type;
        const length = tIndex === 'header' ? HEADER_HEIGHT : (tIndex === 'floor' ? FLOOR_HEIGHT : (tIndex === 'parkingFloor' ? PARKING_SUB_HEIGHT : (tIndex === 'comment' ? COMMENT_HEIGHT : (tIndex === 'commentWindow' ? COMPACT_DEFECT_HEIGHT : LOCATION_HEIGHT))));
        return { length, offset, index };
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <View style={styles.topBarMain}>
                    <View style={styles.topBarActionArea}>
                        <TouchableOpacity style={styles.reviewBtn} onPress={openReviewPage}>
                            <Text style={styles.reviewBtnText}>סקירת ליקויים</Text>
                            {(report?.items?.length || 0) > 0 && (
                                <View style={styles.reviewBadge}>
                                    <Text style={styles.reviewBadgeText}>{report.items.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerInfo}>
                        <View style={styles.headerRow}>
                            <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 15 }}>
                                <Text style={styles.projectLabel}>{project?.name}</Text>
                                <TextInput
                                    style={styles.subjectInput}
                                    value={report?.subject}
                                    onChangeText={(txt) => setReport({ ...report, subject: txt })}
                                    onEndEditing={(e) => persistReportField('subject', e.nativeEvent.text)}
                                    placeholder="נושא הדוח"
                                    textAlign="right"
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                            <Text style={styles.dateText}>{report?.date || 'בחר תאריך'}</Text>
                            <Ionicons name="calendar-outline" size={18} color="#007AFF" style={{ marginLeft: 5 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) setReport({ ...report, date: date.toLocaleDateString('he-IL') });
                    }}

                />
            )}

            {/* initial comment moved into the list as a comment item */}

            <FlatList
                ref={flatListRef}
                data={sections}
                keyExtractor={(item) => item.id}
                getItemLayout={getItemLayout}
                viewabilityConfig={viewabilityConfigRef.current}
                removeClippedSubviews={false} // עדיף false באנדרואיד למניעת בעיות רינדור
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={10}
                stickyHeaderIndices={sections
                    .map((obj, index) => (obj?.type === 'header' || obj?.type === 'floor') ? index : -1)
                    .filter(idx => idx !== -1)
                }
                renderItem={({ item }) => {
                    if (item.type === 'commentWindow') {
                        const it = item.item;
                        // use live data from report.items when available so edits are reflected immediately
                        const liveItem = (report?.items || []).find((x: any) => x.id === it.id) || it;
                        // compute serial based on current report items order
                        const serial = report?.items ? (report.items.findIndex((x: any) => x.id === it.id) + 1) : undefined;
                        const isHighlighted = highlightedId === item.id;
                        return (
                            <View style={[styles.compactDefectCard, (isHighlighted && highlightOn) ? styles.highlightedItem : null]}>
                                <View style={styles.compactDefectHeader}>
                                    <Text style={styles.commentSerial}>ליקוי מס׳ {serial ?? liveItem.id}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={() => deleteCommentWindow(liveItem.id)} style={{ marginLeft: 8 }}>
                                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.editBtn} onPress={() => openDefectModal(liveItem)}>
                                            <Ionicons name="create-outline" size={14} color="white" />
                                            <Text style={styles.editBtnText}>עריכה</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <Text style={styles.compactDefectLocation} numberOfLines={1}>{liveItem.location}</Text>
                                {liveItem.notes
                                    ? <Text style={styles.compactDefectNotes} numberOfLines={1}>{liveItem.notes}</Text>
                                    : <Text style={styles.compactDefectNoNotes}>לחץ עריכה להוספת פרטים</Text>
                                }
                            </View>
                        );
                    }
                    if (item.type === 'comment') {
                        const noteKey = item.noteKey as 'initialNotes' | 'finalNotes';
                        return (
                            <View style={[styles.commentSection, { marginHorizontal: 0 }]}>
                                <Text style={styles.commentLabel}>{item.position === 'start' ? 'פתיחת דוח (הערת פתיחה)' : 'סיום דוח (הערת סיום)'}</Text>
                                <TextInput
                                    style={styles.commentInput}
                                    multiline
                                    value={report ? (report[noteKey] ?? '') : (item.label ?? '')}
                                    onChangeText={(txt) => setReport((prev: any) => ({ ...prev, [noteKey]: txt }))}
                                    onEndEditing={(e) => persistReportField(noteKey, e.nativeEvent.text)}
                                    placeholder={item.position === 'start' ? 'הערת פתיחה לדוח' : 'הערת סיום לדוח'}
                                    textAlign='right'
                                />
                            </View>
                        );
                    }
                    if (item.type === 'header') {
                        const isHighlighted = highlightedId === item.id && highlightOn;
                        const floors = item.meta?.floors;
                        return (
                            <View style={[styles.headerSection, isHighlighted ? styles.highlightedItem : null]}>
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
                        // small parking floor divider (not sticky)
                        return (
                            <View style={[styles.parkingFloorSection]}>
                                <View style={styles.floorRowInner}>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={styles.parkingFloorText}>{item.label}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    }

                    if (item.type === 'floor') {
                        // sticky region (building floor or parking region)
                        const isHighlighted = highlightedId === item.id && highlightOn;
                        const pathLabel = item.fullLocation || item.label;
                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                style={[styles.floorSection, isHighlighted ? styles.highlightedItem : null]}
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

                    // location or area (clickable)
                    const isHighlighted = highlightedId === item.id && highlightOn;
                    return (
                        <View style={[styles.locationRow, item.type === 'area' && styles.areaRow, isHighlighted ? styles.highlightedItem : null]}>
                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={styles.locationLabelMain}>{item.label}</Text>
                                {item.fullLocation ? <Text style={styles.locationLabelSub}>{item.fullLocation}</Text> : null}
                            </View>
                        </View>
                    );
                }}
            />

            {/* Defect detail modal - opens automatically after camera capture or when tapping Edit */}
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
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#DDD',
        // reduced vertical padding to make header more compact
        paddingTop: Platform.OS === 'ios' ? 30 : 14
    },
    topBarMain: { flexDirection: 'row', alignItems: 'center' },
    topBarActionArea: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingRight: 8 },
    headerInfo: { flex: 2, alignItems: 'flex-end' },
    headerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    projectLabel: { fontSize: 12, color: '#8E8E93', fontWeight: 'bold' },
    subjectInput: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginTop: 0 },
    dateRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 },
    dateText: { fontSize: 14, color: '#007AFF' },
    stickyActionRow: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        paddingVertical: 11,
        paddingHorizontal: 12,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'flex-start',
        maxWidth: '100%',
        minHeight: 48
    },
    stickyActionText: {
        color: 'white',
        fontWeight: '700',
        marginRight: 10,
        flex: 1,
        textAlign: 'right',
        fontSize: 13,
        lineHeight: 16
    },
    headerSection: {
        backgroundColor: '#E5E5EA',
        paddingHorizontal: 15,
        height: HEADER_HEIGHT, // תואם ל-getItemLayout
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#D1D1D6'
    },
    headerText: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
    headerSubText: { fontSize: 12, color: '#6B6B6B', marginTop: 2, textAlign: 'right' },
    // removed floating floor label styles (using sticky floor headers instead)
    headerRowInner: { flexDirection: 'row-reverse', alignItems: 'center' },
    headerCameraBtn: { backgroundColor: '#007AFF', padding: 8, borderRadius: 6, marginLeft: 10 },
    headerFloorCamera: { backgroundColor: '#007AFF', padding: 6, borderRadius: 6, marginLeft: 8 },
    floorQuickBtn: { backgroundColor: '#007AFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
    floorQuickBtnText: { color: '#fff', fontSize: 12 },
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
    locationRow: {
        backgroundColor: '#FFF',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: LOCATION_HEIGHT // תואם ל-getItemLayout
    },
    areaRow: {
        paddingHorizontal: 25
    },
    locationLabel: { fontSize: 16, textAlign: 'right' },
    locationLabelMain: { fontSize: 16, textAlign: 'right' },
    locationLabelSub: { fontSize: 12, color: '#6B6B6B', marginTop: 2, textAlign: 'right' },
    cameraBtn: {
        backgroundColor: '#007AFF',
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center'
    },
    cameraBtnText: { color: 'white', marginLeft: 5, fontWeight: '600' },
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
    commentImage: { width: 120, height: 90, borderRadius: 6 },
    commentImageSmall: { width: 90, height: 68, borderRadius: 6, marginLeft: 8 },
    commentImagePlaceholder: { width: 120, height: 90, borderRadius: 6, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' },
    highlightedItem: { backgroundColor: '#DFF4FF' },
    reviewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F0FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
    reviewBtnText: { color: '#007AFF', fontWeight: '600', fontSize: 13 },
    reviewBadge: { backgroundColor: '#007AFF', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 4, paddingHorizontal: 4 },
    reviewBadgeText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    // Compact defect card (shown in walk mode list)
    compactDefectCard: {
        height: COMPACT_DEFECT_HEIGHT,
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8ED',
        overflow: 'hidden'
    },
    compactDefectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    compactDefectLocation: { fontSize: 12, color: '#666', textAlign: 'right', marginBottom: 2 },
    compactDefectNotes: { fontSize: 13, color: '#333', textAlign: 'right' },
    compactDefectNoNotes: { fontSize: 12, color: '#999', fontStyle: 'italic', textAlign: 'right' },
    editBtn: {
        backgroundColor: '#007AFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 6
    },
    editBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600', marginLeft: 4 },
    // Modal styles
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
    modalSaveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
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
    modalSavedText: { color: '#34C759', fontSize: 16, fontWeight: '700', marginLeft: 8 }
});


