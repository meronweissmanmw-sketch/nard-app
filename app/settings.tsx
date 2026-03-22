import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

export default function SettingsScreen() {
    const [defaultSubject, setDefaultSubject] = useState('');
    const [openingNote, setOpeningNote] = useState('');
    const [closingNote, setClosingNote] = useState('');
    const [reportLogo, setReportLogo] = useState('');

    // טעינת נתונים שמורים בפתיחת הדף
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const savedSubject = await AsyncStorage.getItem('defaultSubject');
            const savedOpening = await AsyncStorage.getItem('openingNote');
            const savedClosing = await AsyncStorage.getItem('closingNote');
            const savedLogo = await AsyncStorage.getItem('reportLogo');

            if (savedSubject) setDefaultSubject(savedSubject);
            if (savedOpening) setOpeningNote(savedOpening);
            if (savedClosing) setClosingNote(savedClosing);
            if (savedLogo) setReportLogo(savedLogo);
        } catch (e) {
            console.error("טעות בטעינת הנתונים", e);
        }
    };

    const saveSettings = async () => {
        try {
            await AsyncStorage.setItem('defaultSubject', defaultSubject);
            await AsyncStorage.setItem('openingNote', openingNote);
            await AsyncStorage.setItem('closingNote', closingNote);
            await AsyncStorage.setItem('reportLogo', reportLogo);
            Alert.alert("הצלחה", "ההעדפות נשמרו בהצלחה!");
        } catch (e) {
            Alert.alert("שגיאה", "לא ניתן היה לשמור את הנתונים");
        }
    };

    const pickLogo = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('שגיאה', 'נדרשת הרשאה לגישה לגלריה');
                return;
            }

            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
            });

            if (res.canceled || !res.assets?.[0]?.uri) return;

            const manipulated = await ImageManipulator.manipulateAsync(
                res.assets[0].uri,
                [{ resize: { width: 500 } }],
                { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
            );

            const base64 = await LegacyFileSystem.readAsStringAsync(manipulated.uri, {
                encoding: (LegacyFileSystem as any).EncodingType?.Base64 ?? 'base64',
            });

            setReportLogo(`data:image/jpeg;base64,${base64}`);
        } catch (e) {
            console.error('Failed picking logo', e);
            Alert.alert('שגיאה', 'נכשל בבחירת הלוגו');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.header}>העדפות אישיות</Text>

            <Text style={styles.label}>נושא קבוע לדוח:</Text>
            <TextInput
                style={styles.input}
                value={defaultSubject}
                onChangeText={setDefaultSubject}
                placeholder="לדוגמה: ביקורת הנדסית תקופתית"
                textAlign="right"
            />

            <Text style={styles.label}>הערת פתיחה אוטומטית:</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={openingNote}
                onChangeText={setOpeningNote}
                multiline
                placeholder="טקסט שיופיע בתחילת כל דוח..."
                textAlign="right"
            />

            <Text style={styles.label}>הערת סיום אוטומטית:</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={closingNote}
                onChangeText={setClosingNote}
                multiline
                placeholder="טקסט שיופיע בסוף כל דוח..."
                textAlign="right"
            />

            <Text style={styles.label}>לוגו למסמך:</Text>
            {reportLogo ? (
                <View style={styles.logoBox}>
                    <Image source={{ uri: reportLogo }} style={styles.logoPreview} resizeMode="contain" />
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setReportLogo('')}>
                        <Text style={styles.secondaryButtonText}>הסר לוגו</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={pickLogo}>
                <Text style={styles.secondaryButtonText}>{reportLogo ? 'החלף לוגו' : 'בחר לוגו'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
                <Text style={styles.saveButtonText}>שמור הגדרות</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9f9f9', padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', marginTop: 10 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'right' },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20 },
    textArea: { height: 100, textAlignVertical: 'top' },
    logoBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, alignItems: 'center' },
    logoPreview: { width: 180, height: 70 },
    secondaryButton: { backgroundColor: '#E8F1FF', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 14 },
    secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
    saveButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});