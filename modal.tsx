import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useProject } from '../ProjectContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProjectModal() {
    const router = useRouter();
    const { createNewProject } = useProject();

    // הגדרות המבנה (סעיף 2)
    const [numBuildings, setNumBuildings] = useState(1);
    const [numParking, setNumParking] = useState(0);

    const handleCreate = async () => {
        try {
            // שליפת הגדרות אוטומטיות (סעיף 1.1)
            const savedSubject = await AsyncStorage.getItem('defaultSubject') || "פרויקט חדש";
            const savedInitial = await AsyncStorage.getItem('initialNote') || "";
            const savedFinal = await AsyncStorage.getItem('finalNote') || "";
            const currentDate = new Date().toLocaleDateString('he-IL');

            // יצירת המבנה ההנדסי
            const structure = {
                buildings: Array.from({ length: numBuildings }, (_, i) => ({ id: i + 1, floors: 1 })),
                parkingFloors: numParking,
                hasDevelopment: true
            };

            // יצירת הפרויקט ב-Context
            const id = createNewProject(savedSubject, savedInitial, savedFinal, currentDate, structure);

            // מעבר ישיר לעורך
            router.replace({ pathname: '/editor', params: { projectId: id } });
        } catch (e) {
            Alert.alert("שגיאה", "לא ניתן היה ליצור פרויקט חדש");
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'הגדרות פרויקט חדש', headerTitleAlign: 'center' }} />

            <Text style={styles.label}>כמה בניינים יש בפרויקט?</Text>
            <View style={styles.counterRow}>
                {/* הפלוס מימין */}
                <TouchableOpacity style={styles.btn} onPress={() => setNumBuildings(numBuildings + 1)}>
                    <Text style={styles.btnText}>+</Text>
                </TouchableOpacity>

                <Text style={styles.count}>{numBuildings}</Text>

                {/* המינוס משמאל */}
                <TouchableOpacity style={styles.btn} onPress={() => setNumBuildings(Math.max(1, numBuildings - 1))}>
                    <Text style={styles.btnText}>-</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.label}>מספר קומות חניון:</Text>
            <View style={styles.counterRow}>
                <TouchableOpacity style={styles.btn} onPress={() => setNumParking(Math.max(0, numParking - 1))}>
                    <Text style={styles.btnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.count}>{numParking}</Text>
                <TouchableOpacity style={styles.btn} onPress={() => setNumParking(numParking + 1)}>
                    <Text style={styles.btnText}>+</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>צור פרויקט והתחל דוח</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 25, justifyContent: 'center' },
    label: { fontSize: 18, textAlign: 'right', marginBottom: 15, fontWeight: '600' },
    counterRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40, gap: 30 },
    btn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
    btnText: { fontSize: 24, fontWeight: 'bold' },
    count: { fontSize: 28, fontWeight: 'bold', width: 40, textAlign: 'center' },
    createBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
    createBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
});