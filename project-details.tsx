import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform, Modal, ScrollView, Switch, TextInput } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, Header, AlignmentType, WidthType, BorderStyle } from 'docx';
import { Buffer } from 'buffer';
import { Picker } from '@react-native-picker/picker';

export default function ProjectDetailsScreen() {
    const { projectId } = useLocalSearchParams();
    const router = useRouter();
    const [project, setProject] = useState<any>(null);

    useFocusEffect(
        React.useCallback(() => {
            loadProject();
        }, [projectId])
    );

    const loadProject = async () => {
        const data = await AsyncStorage.getItem('projects');
        if (data) {
            const projects = JSON.parse(data);
            const found = projects.find((p: any) => p.id === projectId);
            setProject(found);
        }
    };

    // Structure editor modal state
    const [structureModalVisible, setStructureModalVisible] = useState(false);
    const [editBuildings, setEditBuildings] = useState<any[]>([]);
    const [editHasParking, setEditHasParking] = useState(false);
    const [editParkings, setEditParkings] = useState<any[]>([]);
    const [editHasDevelopment, setEditHasDevelopment] = useState(false);
    const [editDevAreas, setEditDevAreas] = useState<any[]>([]);

    const openStructureEditor = () => {
        if (!project?.structure) return;
        const s = project.structure;
        setEditBuildings(s.buildings ? s.buildings.map((b: any) => ({ ...b })) : [{ id: `b-${Date.now()}`, name: 'בניין 1', floors: 1 }]);
        setEditHasParking(!!(s.parkings && s.parkings.length > 0));
        setEditParkings(s.parkings ? s.parkings.map((p: any) => ({ ...p, areas: p.areas ? p.areas.map((a: any) => ({ ...a })) : [] })) : []);
        setEditHasDevelopment(!!(s.development));
        setEditDevAreas(s.development?.areas ? s.development.areas.map((a: any) => ({ ...a })) : []);
        setStructureModalVisible(true);
    };

    // Save structure — only project.structure is updated; all reports (and their defects) are preserved untouched.
    const saveStructure = async () => {
        try {
            const newStructure = {
                buildings: editBuildings.map((b: any) => ({ ...b, floors: Number(b.floors) })),
                parkings: editHasParking ? editParkings.map((p: any) => ({ ...p, floors: Number(p.floors) })) : [],
                development: editHasDevelopment ? { areas: editDevAreas } : null
            };
            const data = await AsyncStorage.getItem('projects');
            if (!data) return;
            const projects = JSON.parse(data);
            const updated = projects.map((p: any) => {
                if (p.id !== projectId) return p;
                // Only update structure; reports are not touched so all defects are preserved
                return { ...p, structure: newStructure };
            });
            await AsyncStorage.setItem('projects', JSON.stringify(updated));
            setProject((prev: any) => ({ ...prev, structure: newStructure }));
            setStructureModalVisible(false);
        } catch (e) {
            console.error('Failed to save structure', e);
            Alert.alert('שגיאה', 'לא ניתן לשמור את המבנה');
        }
    };

    const confirmDeleteReport = (reportId: string) => {
        Alert.alert(
            'מחק דוח',
            'האם אתה בטוח שברצונך למחוק דוח זה? פעולה זו בלתי הפיכה.',
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: () => deleteReport(reportId)
                }
            ]
        );
    };

    const deleteReport = async (reportId: string) => {
        try {
            const data = await AsyncStorage.getItem('projects');
            const projects = JSON.parse(data || '[]');
            const updated = projects.map((p: any) => {
                if (p.id !== projectId) return p;
                return { ...p, reports: (p.reports || []).filter((r: any) => r.id !== reportId) };
            });
            await AsyncStorage.setItem('projects', JSON.stringify(updated));

            // update local state
            const newProject = { ...project, reports: (project.reports || []).filter((r: any) => r.id !== reportId) };
            setProject(newProject);
        } catch (e) {
            console.error('Failed to delete report', e);
            Alert.alert('שגיאה', 'בעיה במחיקת הדוח');
        }
    };

    const readImageForDocx = async (uri: string): Promise<{ base64: string; width: number; height: number }> => {
        if (uri.startsWith('ph://')) {
            const ext = 'jpg';
            const tmp = `${(LegacyFileSystem as any).cacheDirectory}asset-${Date.now()}.${ext}`;
            await (LegacyFileSystem as any).copyAsync({ from: uri, to: tmp });
            uri = tmp;
        }
        const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 400 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        const base64 = await LegacyFileSystem.readAsStringAsync(manipulated.uri, {
            encoding: (LegacyFileSystem as any).EncodingType?.Base64 ?? 'base64',
        });
        return { base64, width: manipulated.width, height: manipulated.height };
    };

    const getLogoBase64 = async (uriOrData: string): Promise<string> => {
        if (!uriOrData) return '';
        if (uriOrData.startsWith('data:image/')) {
            return uriOrData.split(',')[1] || '';
        }
        const result = await readImageForDocx(uriOrData);
        return result.base64;
    };

    const exportReportToWord = async (r: any) => {
        if (!project) return;
        try {
            const safeNamePart = (v: string) => (v || '')
                .replace(/[\\/:*?"<>|]/g, '-')
                .replace(/\s+/g, ' ')
                .trim();

            const savedLogoRaw = await AsyncStorage.getItem('reportLogo');
            let logoBase64 = '';
            if (savedLogoRaw) {
                logoBase64 = await getLogoBase64(savedLogoRaw);
            }

            const title = r.subject || `דוח ${r.reportNumber}`;
            const isRtl = true;
            const docAlignment = isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
            const rtlPara = (text: string, bold = false) =>
                new Paragraph({
                    alignment: AlignmentType.RIGHT,   // ✅ text sticks to right of cell
                    bidirectional: true,               // ✅ paragraph direction is RTL
                    children: [new TextRun({ text, rightToLeft: true, bold })],
                });

            const rtlCellPara = (text: string, bold = false) =>
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    bidirectional: true,
                    children: [new TextRun({ text, rightToLeft: true, bold })],
                });

            // Header: logo anchored at top-left, spacer in middle, report meta anchored at top-right
            const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
            const headerTextPara = (text: string, bold = false) =>
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    bidirectional: true,
                    children: [new TextRun({ text, rightToLeft: true, bold })],
                });
            const headerChildren: (Paragraph | Table)[] = [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 15, type: WidthType.PERCENTAGE },
                                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.LEFT,
                                            children: logoBase64 ? [
                                                new ImageRun({
                                                    type: 'jpg',
                                                    data: Buffer.from(logoBase64, 'base64'),
                                                    transformation: { width: 60, height: 60 },
                                                }),
                                            ] : [],
                                        }),
                                    ],
                                }),
                                new TableCell({
                                    width: { size: 55, type: WidthType.PERCENTAGE },
                                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                                    children: [new Paragraph({ text: '' })],
                                }),
                                new TableCell({
                                    width: { size: 30, type: WidthType.PERCENTAGE },
                                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                                    children: [
                                        headerTextPara(`פרויקט: ${project.name || ''}`, true),
                                        headerTextPara(`נושא: ${title}`),
                                        headerTextPara(`תאריך: ${r.date || ''}`),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),
                new Paragraph({ text: '' }),
            ];

            // Document body
            const children: (Paragraph | Table)[] = [];

            children.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                children: [new TextRun({ text: title, rightToLeft: true, bold: true })],
            }));
            children.push(rtlPara(`פרויקט: ${project.name || ''}`));
            children.push(rtlPara(`תאריך: ${r.date || ''}`));
            children.push(new Paragraph({ text: '' }));

            if (r.initialNotes) {
                children.push(new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    alignment: AlignmentType.RIGHT,
                    bidirectional: true,
                    children: [new TextRun({ text: 'הערת פתיחה', rightToLeft: true, bold: true })],
                }));
                children.push(rtlPara(r.initialNotes));
                children.push(new Paragraph({ text: '' }));
            }

            const borderDef = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
            const borders = { top: borderDef, bottom: borderDef, left: borderDef, right: borderDef };

            for (let idx = 0; idx < (r.items || []).length; idx++) {
                const it = r.items[idx];

                children.push(new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    alignment: AlignmentType.RIGHT,
                    bidirectional: true,
                    children: [new TextRun({ text: `ליקוי ${idx + 1}`, rightToLeft: true, bold: true })],
                }));

                const makeRow = (label: string, value: string, shaded: boolean) => new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 2000, type: WidthType.DXA },
                            borders,
                            shading: shaded ? { fill: 'F5F5F5' } : undefined,
                            children: [rtlCellPara(label, true)],
                        }),
                        new TableCell({
                            borders,
                            shading: shaded ? { fill: 'F5F5F5' } : undefined,
                            children: [rtlCellPara(value || '')],
                        }),
                    ],
                });

                children.push(new Table({
                    visuallyRightToLeft: isRtl,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        makeRow('מיקום:', it.location || '', true),
                        makeRow('אחראי:', it.assignedTo || '', false),
                        makeRow('הערות:', it.notes || '', true),
                    ],
                }));

                if (Array.isArray(it.images) && it.images.length > 0) {
                    for (const imgUri of it.images) {
                        try {
                            const img = await readImageForDocx(imgUri);
                            const maxW = 300;
                            const scale = maxW / img.width;
                            const w = maxW;
                            const h = Math.round(img.height * scale);
                            children.push(new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 200, after: 200 },
                                children: [
                                    new ImageRun({
                                        type: 'jpg',
                                        data: Buffer.from(img.base64, 'base64'),
                                        transformation: { width: w, height: h },
                                    }),
                                ],
                            }));
                            children.push(new Paragraph({ text: '' }));
                        } catch (imgErr) {
                            console.warn('Failed to read image for export', imgUri, imgErr);
                        }
                    }
                }

                children.push(new Paragraph({ text: '' }));
            }

            if (r.finalNotes) {
                children.push(new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    alignment: AlignmentType.RIGHT,
                    bidirectional: true,
                    children: [new TextRun({ text: 'הערת סיום', rightToLeft: true, bold: true })],
                }));
                children.push(rtlPara(r.finalNotes));
            }

            const doc = new Document({
                styles: {
                    default: {
                        document: {
                            paragraph: {
                                alignment: docAlignment,
                            },
                            run: {
                                rightToLeft: isRtl,
                            },
                        },
                    },
                },
                sections: [{
                    properties: {
                        page: {
                            size: { width: 11906, height: 16838 },
                            margin: { top: 1134, right: 794, bottom: 794, left: 794 },
                        },
                    },
                    headers: {
                        default: new Header({ children: headerChildren }),
                    },
                    children,
                }],
            });

            const safeProjectName = safeNamePart(project.name || 'project') || 'project';
            const safeReportNumber = safeNamePart(String(r.reportNumber ?? r.id)) || String(r.id);
            const fileName = `${safeProjectName}-דוח-${safeReportNumber}.docx`;

            if (Platform.OS === 'web') {
                try {
                    const blob = await Packer.toBlob(doc);
                    const url = (window as any).URL.createObjectURL(blob);
                    const a = (window as any).document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    (window as any).document.body.appendChild(a);
                    a.click();
                    a.remove();
                    (window as any).URL.revokeObjectURL(url);
                    Alert.alert('ייצוא', 'הקובץ הורד בהצלחה');
                    return;
                } catch (we) {
                    console.error('Web export failed', we);
                    Alert.alert('שגיאה', 'בעיה בהורדת הקובץ בדפדפן');
                    return;
                }
            }

            const baseDir = (LegacyFileSystem as any).documentDirectory || (LegacyFileSystem as any).cacheDirectory || null;
            if (!baseDir) {
                Alert.alert('שגיאה', 'אין נתיב לשמירת הקובץ בסביבת הריצה');
                return;
            }
            const fileUri = baseDir + fileName;

            const base64Doc = await Packer.toBase64String(doc);
            await LegacyFileSystem.writeAsStringAsync(fileUri, base64Doc, {
                encoding: (LegacyFileSystem as any).EncodingType?.Base64 ?? 'base64',
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            } else {
                Alert.alert('ייצוא', 'הקובץ נשמר בנתיב: ' + fileUri);
            }
        } catch (e) {
            console.error('Failed to export report', e);
            Alert.alert('שגיאה', 'בעיה ביצוא ל-Word');
        }
    };

    const createNewReport = async () => {
        const defaultSubject = await AsyncStorage.getItem('defaultSubject') || "דוח פיקוח הנדסי";
        const openingNote = await AsyncStorage.getItem('openingNote') || "";
        const closingNote = await AsyncStorage.getItem('closingNote') || "";

        const newReport = {
            id: Date.now().toString(),
            reportNumber: (project.reports?.length || 0) + 1,
            subject: defaultSubject,
            date: new Date().toLocaleDateString('he-IL'),
            initialNotes: openingNote,
            finalNotes: closingNote,
            items: []
        };

        const data = await AsyncStorage.getItem('projects');
        const projects = JSON.parse(data || '[]');
        const updatedProjects = projects.map((p: any) => {
            if (p.id === projectId) {
                return { ...p, reports: [...(p.reports || []), newReport] };
            }
            return p;
        });

        await AsyncStorage.setItem('projects', JSON.stringify(updatedProjects));
        router.push({ pathname: '/editor', params: { projectId: project.id, reportId: newReport.id } });
    };

    if (!project) return <View style={styles.container}><Text>טוען פרויקט...</Text></View>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    <TouchableOpacity style={styles.editStructureBtn} onPress={openStructureEditor}>
                        <Ionicons name="construct-outline" size={16} color="#007AFF" />
                        <Text style={styles.editStructureBtnText}>עריכת מבנה</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.projectTitle}>{project.name}</Text>
                <Text style={styles.projectSubTitle}>תאריך התחלה: {project.startDate}</Text>
            </View>

            <Text style={styles.sectionTitle}>דוחות בפרויקט:</Text>

            <FlatList
                data={project.reports || []}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.reportCard}
                        onPress={() => router.push({ pathname: '/editor', params: { projectId: project.id, reportId: item.id } })}
                    >
                        <View>
                            <Text style={styles.reportName}>דוח מס {item.reportNumber}</Text>
                            <Text style={styles.reportInfo}>{item.subject} | {item.date}</Text>
                        </View>
                        <View style={styles.reportActions}>
                            <TouchableOpacity onPress={() => exportReportToWord(item)} style={styles.actionBtn}>
                                <Ionicons name="document-text" size={24} color="#007AFF" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmDeleteReport(item.id)} style={styles.actionBtn}>
                                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>עדיין לא נוצרו דוחות</Text>}
            />

            <TouchableOpacity style={styles.fab} onPress={createNewReport}>
                <Ionicons name="document-text" size={30} color="white" />
                <Text style={styles.fabText}>דוח חדש</Text>
            </TouchableOpacity>

            {/* Structure editor modal */}
            <Modal
                visible={structureModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setStructureModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setStructureModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>עריכת מבנה הפרויקט</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                            {/* Buildings */}
                            <View style={styles.structSection}>
                                <View style={styles.structHeaderRow}>
                                    <TouchableOpacity onPress={() => setEditBuildings([
                                        ...editBuildings,
                                        { id: `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`, name: `בניין ${editBuildings.length + 1}`, floors: 1 }
                                    ])}>
                                        <Ionicons name="add-circle" size={26} color="#007AFF" />
                                    </TouchableOpacity>
                                    <Text style={styles.structHeader}>בניינים</Text>
                                </View>
                                {editBuildings.map((b: any) => (
                                    <View key={b.id} style={styles.structBuildingCard}>
                                        <TouchableOpacity
                                            onPress={() => editBuildings.length > 1 ? setEditBuildings(editBuildings.filter((x: any) => x.id !== b.id)) : null}
                                            style={{ marginRight: 8 }}
                                        >
                                            <Ionicons name="close-circle" size={20} color="#FF3B30" />
                                        </TouchableOpacity>
                                        <Picker
                                            selectedValue={b.floors}
                                            onValueChange={(v) => setEditBuildings(editBuildings.map((x: any) => x.id === b.id ? { ...x, floors: v } : x))}
                                            style={{ width: 130 }}
                                        >
                                            {Array.from({ length: 51 }, (_, i) => i + 1).map(n => (
                                                <Picker.Item key={n} label={`קומה ${n}`} value={n} />
                                            ))}
                                        </Picker>
                                        <TextInput
                                            style={styles.structNameInput}
                                            value={b.name}
                                            onChangeText={(val) => setEditBuildings(editBuildings.map((x: any) => x.id === b.id ? { ...x, name: val } : x))}
                                            textAlign="right"
                                        />
                                    </View>
                                ))}
                            </View>

                            {/* Parkings */}
                            <View style={styles.structSection}>
                                <View style={styles.structSwitchRow}>
                                    <Switch
                                        value={editHasParking}
                                        onValueChange={(val) => {
                                            setEditHasParking(val);
                                            if (val && editParkings.length === 0) {
                                                setEditParkings([{ id: Date.now().toString(), name: 'חניון 1', floors: 1, areas: [] }]);
                                            }
                                        }}
                                    />
                                    <Text style={styles.structHeader}>חניונים</Text>
                                </View>
                                {editHasParking && editParkings.map((p: any) => (
                                    <View key={p.id} style={styles.structSubCard}>
                                        <View style={styles.structHeaderRow}>
                                            <TouchableOpacity onPress={() => setEditParkings(editParkings.filter((x: any) => x.id !== p.id))}>
                                                <Ionicons name="close-circle" size={20} color="#FF3B30" />
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.structSubNameInput}
                                                value={p.name}
                                                onChangeText={(v) => setEditParkings(editParkings.map((x: any) => x.id === p.id ? { ...x, name: v } : x))}
                                                textAlign="right"
                                            />
                                        </View>
                                        <Picker
                                            selectedValue={p.floors}
                                            onValueChange={(v) => setEditParkings(editParkings.map((x: any) => x.id === p.id ? { ...x, floors: v } : x))}
                                            style={{ width: 160, alignSelf: 'flex-end' }}
                                        >
                                            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                                <Picker.Item key={n} label={`${n} קומות חניון`} value={n} />
                                            ))}
                                        </Picker>
                                        <Text style={styles.structSubLabel}>אזורים:</Text>
                                        {p.areas.map((a: any) => (
                                            <View key={a.id} style={styles.structAreaRow}>
                                                <TouchableOpacity onPress={() => setEditParkings(editParkings.map((pk: any) => pk.id === p.id ? { ...pk, areas: pk.areas.filter((ar: any) => ar.id !== a.id) } : pk))}>
                                                    <Ionicons name="close-circle" size={16} color="#999" style={{ marginRight: 5 }} />
                                                </TouchableOpacity>
                                                <TextInput
                                                    style={styles.structAreaInput}
                                                    value={a.name}
                                                    onChangeText={(v) => setEditParkings(editParkings.map((pk: any) => pk.id === p.id ? { ...pk, areas: pk.areas.map((ar: any) => ar.id === a.id ? { ...ar, name: v } : ar) } : pk))}
                                                    textAlign="right"
                                                />
                                            </View>
                                        ))}
                                        <TouchableOpacity onPress={() => setEditParkings(editParkings.map((pk: any) => pk.id === p.id ? { ...pk, areas: [...pk.areas, { id: Date.now().toString(), name: 'אזור חדש' }] } : pk))}>
                                            <Text style={styles.structAddText}>+ הוסף אזור</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {editHasParking && (
                                    <TouchableOpacity
                                        onPress={() => setEditParkings([...editParkings, { id: Date.now().toString(), name: `חניון ${editParkings.length + 1}`, floors: 1, areas: [] }])}
                                        style={styles.structDashedBtn}
                                    >
                                        <Text style={{ color: '#007AFF' }}>+ חניון נוסף</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Development */}
                            <View style={styles.structSection}>
                                <View style={styles.structSwitchRow}>
                                    <Switch
                                        value={editHasDevelopment}
                                        onValueChange={(val) => {
                                            setEditHasDevelopment(val);
                                            if (val && editDevAreas.length === 0) {
                                                setEditDevAreas([{ id: Date.now().toString(), name: 'אזור כללי' }]);
                                            }
                                        }}
                                    />
                                    <Text style={styles.structHeader}>פיתוח חוץ</Text>
                                </View>
                                {editHasDevelopment && (
                                    <View style={{ marginTop: 8 }}>
                                        {editDevAreas.map((a: any) => (
                                            <View key={a.id} style={styles.structAreaRow}>
                                                <TouchableOpacity onPress={() => setEditDevAreas(editDevAreas.filter((ar: any) => ar.id !== a.id))}>
                                                    <Ionicons name="close-circle" size={16} color="#999" style={{ marginRight: 5 }} />
                                                </TouchableOpacity>
                                                <TextInput
                                                    style={styles.structAreaInput}
                                                    value={a.name}
                                                    onChangeText={(v) => setEditDevAreas(editDevAreas.map((ar: any) => ar.id === a.id ? { ...ar, name: v } : ar))}
                                                    textAlign="right"
                                                />
                                            </View>
                                        ))}
                                        <TouchableOpacity onPress={() => setEditDevAreas([...editDevAreas, { id: Date.now().toString(), name: 'אזור חדש' }])}>
                                            <Text style={styles.structAddText}>+ הוסף אזור פיתוח</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        <TouchableOpacity style={styles.modalSaveBtn} onPress={saveStructure}>
                            <Text style={styles.modalSaveBtnText}>שמור מבנה</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7', padding: 20 },
    header: { marginBottom: 30, marginTop: 20 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 8 },
    settingsBtn: { padding: 5 },
    editStructureBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F0FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    editStructureBtnText: { color: '#007AFF', fontWeight: '600', fontSize: 14, marginLeft: 6 },
    projectTitle: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', textAlign: 'right' },
    projectSubTitle: { fontSize: 16, color: '#8E8E93', marginTop: 5, textAlign: 'right' },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15, textAlign: 'right' },
    reportCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    reportName: { fontSize: 17, fontWeight: 'bold', textAlign: 'right' },
    reportInfo: { fontSize: 14, color: '#636366', textAlign: 'right', marginTop: 4 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#8E8E93' },
    fab: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#34C759', flexDirection: 'row-reverse', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 30, alignItems: 'center', elevation: 4 },
    fabText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginRight: 10 },
    reportActions: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', width: 88 },
    actionBtn: { padding: 7 },
    // Structure editor modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '92%',
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
    modalSaveBtn: { backgroundColor: '#007AFF', margin: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalSaveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    structSection: { backgroundColor: '#F9F9F9', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
    structHeader: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
    structHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    structSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    structBuildingCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    structNameInput: { fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#DDD', paddingVertical: 4 },
    structSubCard: { backgroundColor: '#FFF', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#EEE' },
    structSubNameInput: { fontWeight: 'bold', fontSize: 15, textAlign: 'right', flex: 1, marginLeft: 10 },
    structSubLabel: { textAlign: 'right', fontSize: 12, color: '#8E8E93', marginVertical: 4 },
    structAreaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    structAreaInput: { backgroundColor: '#F9F9F9', padding: 6, borderRadius: 5, flex: 1, marginLeft: 8, borderWidth: 1, borderColor: '#EEE' },
    structAddText: { color: '#007AFF', textAlign: 'right', fontWeight: 'bold', marginTop: 6 },
    structDashedBtn: { alignItems: 'center', padding: 10, marginTop: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#007AFF', borderRadius: 8 },
});