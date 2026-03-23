import React, { useState, useEffect } from 'react'; import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, Switch, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';


interface Building { id: string; name: string; floors: number; }
interface Area { id: string; name: string; }
interface Parking { id: string; name: string; floors: number; areas: Area[]; }

export default function NewProjectScreen() {
    const router = useRouter();

    const [projectName, setProjectName] = useState('');
    const [projectStartDate, setProjectStartDate] = useState(new Date().toLocaleDateString('he-IL'));

    const [buildings, setBuildings] = useState<Building[]>([{ id: '1', name: 'בניין 1', floors: 1 }]);
    const [hasParking, setHasParking] = useState(false);
    const [parkings, setParkings] = useState<Parking[]>([]);
    const [hasDevelopment, setHasDevelopment] = useState(false);
    const [devAreas, setDevAreas] = useState<Area[]>([]);

    // פונקציית עזר לסידור (Move Up/Down)
    const moveItem = (list: any[], index: number, direction: 'up' | 'down', setList: Function) => {
        const newList = [...list];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newList.length) return;
        [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
        setList(newList);
    };

    const generateInitialAreas = () => [
        { id: 'gen-' + Date.now() + Math.random(), name: 'אזור כללי' },
        ...buildings.map(b => ({
            id: `auto-${b.id}-${Date.now()}-${Math.random()}`,
            name: `אזור ${b.name}`
        }))
    ];

    const toggleParking = (value: boolean) => {
        setHasParking(value);
        if (value && parkings.length === 0) {
            setParkings([{ id: Date.now().toString(), name: 'חניון 1', floors: 1, areas: generateInitialAreas() }]);
        }
    };

    const toggleDevelopment = (value: boolean) => {
        setHasDevelopment(value);
        if (value && devAreas.length === 0) {
            setDevAreas(generateInitialAreas());
        }
    };

    const handleCreate = async () => {
        if (!projectName) return Alert.alert("חסר נתונים", "אנא הזן שם לפרויקט");

        const newProject = {
            id: Date.now().toString(),
            name: projectName,
            startDate: projectStartDate,
            structure: {
                // מבטיח שהנתונים נקיים וייחודיים
                buildings: buildings.map(b => ({ ...b, floors: Number(b.floors) })),
                parkings: hasParking ? parkings.map(p => ({ ...p, floors: Number(p.floors) })) : [],
                development: hasDevelopment ? { areas: devAreas } : null
            },
            reports: []
        };
        // ... שאר הקוד לשמירה
        const existing = await AsyncStorage.getItem('projects');
        const projects = existing ? JSON.parse(existing) : [];
        await AsyncStorage.setItem('projects', JSON.stringify([...projects, newProject]));
        router.replace({ pathname: '/project-details', params: { projectId: newProject.id } });
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
            style={styles.container}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 120 }}
        >
            <Text style={styles.title}>הקמת פרויקט חדש</Text>

            {/* פרטי זיהוי */}
            <View style={styles.section}>
                <TextInput style={styles.mainInput} value={projectName} onChangeText={setProjectName} placeholder="שם הפרויקט / כתובת" textAlign="right" />
                <TextInput style={[styles.mainInput, { marginTop: 10 }]} value={projectStartDate} onChangeText={setProjectStartDate} placeholder="תאריך התחלה" textAlign="right" />
            </View>

            {/* בניינים */}
            <View style={styles.section}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => setBuildings([
                        ...buildings,
                        {
                            // ID משופר: זמן + מספר רנדומלי
                            id: `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            name: `בניין ${buildings.length + 1}`,
                            floors: 1
                        }
                    ])}>
                        <Ionicons name="add-circle" size={30} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.header}>בניינים</Text>
                </View>
                {buildings.map((b, index) => (
                    <View key={b.id} style={styles.buildingCard}>
                        <View style={styles.orderButtons}>
                            <TouchableOpacity onPress={() => moveItem(buildings, index, 'up', setBuildings)}><Ionicons name="chevron-up" size={22} color={index === 0 ? "#CCC" : "#007AFF"} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => moveItem(buildings, index, 'down', setBuildings)}><Ionicons name="chevron-down" size={22} color={index === buildings.length - 1 ? "#CCC" : "#007AFF"} /></TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={() => buildings.length > 1 ? setBuildings(buildings.filter(x => x.id !== b.id)) : null}
                            style={styles.deleteBtn}
                        >
                            <Ionicons name="close-circle" size={22} color="#FF3B30" />
                        </TouchableOpacity>
                        <Picker selectedValue={b.floors} onValueChange={(v) => setBuildings(buildings.map(x => x.id === b.id ? { ...x, floors: v } : x))} style={{ width: 140 }}>
                            {Array.from({ length: 51 }, (_, i) => i + 1).map(n => (
                                <Picker.Item
                                    key={n}
                                    label={`קומה ${n}`}
                                    value={n}
                                />
                            ))}
                        </Picker>
                        <TextInput style={styles.nameInput} value={b.name} onChangeText={(val) => setBuildings(buildings.map(x => x.id === b.id ? { ...x, name: val } : x))} textAlign="right" />
                    </View>
                ))}
            </View>

            {/* חניונים */}
            <View style={styles.section}>
                <View style={styles.switchRow}>
                    <Switch value={hasParking} onValueChange={toggleParking} />
                    <Text style={styles.header}>חניונים</Text>
                </View>
                {hasParking && parkings.map((p, pIndex) => (
                    <View key={p.id} style={styles.subCard}>
                        <View style={styles.headerRow}>
                            <TouchableOpacity onPress={() => setParkings(parkings.filter(x => x.id !== p.id))}><Ionicons name="close-circle" size={22} color="#FF3B30" /></TouchableOpacity>
                            <TextInput style={styles.subNameInput} value={p.name} onChangeText={(v) => setParkings(parkings.map(x => x.id === p.id ? { ...x, name: v } : x))} textAlign="right" />
                        </View>
                        <Picker selectedValue={p.floors} onValueChange={(v) => setParkings(parkings.map(x => x.id === p.id ? { ...x, floors: v } : x))} style={{ width: 160, alignSelf: 'flex-end' }}>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <Picker.Item key={n} label={`${n} קומות חניון`} value={n} />)}
                        </Picker>
                        <Text style={styles.subLabel}>אזורים:</Text>
                        {p.areas.map((a, aIndex) => (
                            <View key={a.id} style={styles.areaRow}>
                                <TouchableOpacity onPress={() => {
                                    const newAreas = [...p.areas];
                                    if (aIndex > 0) {
                                        [newAreas[aIndex], newAreas[aIndex - 1]] = [newAreas[aIndex - 1], newAreas[aIndex]];
                                        setParkings(parkings.map(pk => pk.id === p.id ? { ...pk, areas: newAreas } : pk));
                                    }
                                }}><Ionicons name="chevron-up" size={18} color="#007AFF" /></TouchableOpacity>
                                <TouchableOpacity onPress={() => setParkings(parkings.map(pk => pk.id === p.id ? { ...pk, areas: pk.areas.filter(ar => ar.id !== a.id) } : pk))}><Ionicons name="close-circle" size={18} color="#999" style={{ marginLeft: 5 }} /></TouchableOpacity>
                                <TextInput style={styles.areaInput} value={a.name} onChangeText={(v) => setParkings(parkings.map(pk => pk.id === p.id ? { ...pk, areas: pk.areas.map(ar => ar.id === a.id ? { ...ar, name: v } : ar) } : pk))} textAlign="right" />
                            </View>
                        ))}
                        <TouchableOpacity onPress={() => setParkings(parkings.map(pk => pk.id === p.id ? { ...pk, areas: [...pk.areas, { id: Date.now().toString(), name: 'אזור חדש' }] } : pk))}><Text style={styles.addText}>+ הוסף אזור ידני</Text></TouchableOpacity>
                    </View>
                ))}
                {hasParking && <TouchableOpacity onPress={() => setParkings([...parkings, { id: Date.now().toString(), name: `חניון ${parkings.length + 1}`, floors: 1, areas: generateInitialAreas() }])} style={styles.dashedBtn}><Text style={{ color: '#007AFF' }}>+ חניון נוסף</Text></TouchableOpacity>}
            </View>

            {/* פיתוח חוץ - הוחזר ועודכן */}
            <View style={styles.section}>
                <View style={styles.switchRow}>
                    <Switch value={hasDevelopment} onValueChange={toggleDevelopment} />
                    <Text style={styles.header}>פיתוח חוץ</Text>
                </View>
                {hasDevelopment && (
                    <View style={{ marginTop: 10 }}>
                        {devAreas.map((a, index) => (
                            <View key={a.id} style={styles.areaRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={() => moveItem(devAreas, index, 'up', setDevAreas)}><Ionicons name="chevron-up" size={18} color="#007AFF" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => setDevAreas(devAreas.filter(ar => ar.id !== a.id))} style={{ marginLeft: 8 }}><Ionicons name="close-circle" size={18} color="#999" /></TouchableOpacity>
                                </View>
                                <TextInput style={styles.areaInput} value={a.name} onChangeText={(v) => setDevAreas(devAreas.map(ar => ar.id === a.id ? { ...ar, name: v } : ar))} textAlign="right" />
                            </View>
                        ))}
                        <TouchableOpacity onPress={() => setDevAreas([...devAreas, { id: Date.now().toString(), name: 'אזור חדש' }])}><Text style={styles.addText}>+ הוסף אזור פיתוח</Text></TouchableOpacity>
                    </View>
                )}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate}><Text style={styles.submitBtnText}>צור פרויקט</Text></TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7', padding: 15 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 20 },
    section: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2 },
    header: { fontSize: 18, fontWeight: 'bold' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    mainInput: { backgroundColor: '#F9F9F9', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
    buildingCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
    orderButtons: { flexDirection: 'column', marginRight: 10 },
    deleteBtn: { marginRight: 8 },
    nameInput: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'right' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    subCard: { backgroundColor: '#F9F9F9', padding: 10, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#EEE' },
    subNameInput: { fontWeight: 'bold', fontSize: 16, textAlign: 'right', flex: 1, marginLeft: 10 },
    subLabel: { textAlign: 'right', fontSize: 12, color: '#8E8E93', marginVertical: 5 },
    areaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    areaInput: { backgroundColor: '#FFF', padding: 8, borderRadius: 5, flex: 1, marginLeft: 10, borderWidth: 1, borderColor: '#EEE' },
    addText: { color: '#007AFF', textAlign: 'right', fontWeight: 'bold', marginTop: 8 },
    dashedBtn: { alignItems: 'center', padding: 12, marginTop: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#007AFF', borderRadius: 8 },
    submitBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 15 },
    submitBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});