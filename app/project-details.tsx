import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, Header, AlignmentType, WidthType, BorderStyle } from 'docx';
import { Buffer } from 'buffer';

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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7', padding: 20 },
    header: { marginBottom: 30, marginTop: 20 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingsBtn: { padding: 5 },
    projectTitle: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', textAlign: 'right' },
    projectSubTitle: { fontSize: 16, color: '#8E8E93', marginTop: 5, textAlign: 'right' },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15, textAlign: 'right' },
    reportCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    reportName: { fontSize: 17, fontWeight: 'bold', textAlign: 'right' },
    reportInfo: { fontSize: 14, color: '#636366', textAlign: 'right', marginTop: 4 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#8E8E93' },
    fab: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#34C759', flexDirection: 'row-reverse', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 30, alignItems: 'center', elevation: 4 },
    fabText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginRight: 10 }
    ,
    reportActions: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', width: 88 },
    actionBtn: { padding: 7 }
});