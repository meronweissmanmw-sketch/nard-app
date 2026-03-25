import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// הגדרת המבנה של פרויקט כדי ש-TypeScript לא יציג שגיאות
interface Project {
    id: string;
    name: string;
    startDate: string;
    structure: any;
    reports: any[];
}

export default function HomeScreen() {
    const router = useRouter();
    // הגדרת ה-State עם הטיפוס הנכון
    const [projects, setProjects] = useState<Project[]>([]);

    useFocusEffect(
        React.useCallback(() => {
            loadProjects();
        }, [])
    );

    const loadProjects = async () => {
        try {
            const data = await AsyncStorage.getItem('projects');
            if (data) {
                setProjects(JSON.parse(data));
            }
        } catch (e) {
            console.error("שגיאה בטעינת פרויקטים", e);
        }
    };

    const confirmDelete = (projectId: string, projectName: string) => {
        Alert.alert(
            "מחיקת פרויקט",
            `האם אתה בטוח שברצונך למחוק את הפרויקט "${projectName}"? כל הנתונים והדוחות יימחקו לצמיתות.`,
            [
                { text: "ביטול", style: "cancel" },
                {
                    text: "מחק",
                    style: "destructive",
                    onPress: () => deleteProject(projectId)
                }
            ]
        );
    };

    const deleteProject = async (id: string) => {
        try {
            const data = await AsyncStorage.getItem('projects');
            if (data) {
                const currentProjects: Project[] = JSON.parse(data);
                const filtered = currentProjects.filter(p => p.id !== id);
                await AsyncStorage.setItem('projects', JSON.stringify(filtered));
                setProjects(filtered);
            }
        } catch (e) {
            Alert.alert("שגיאה", "לא ניתן היה למחוק את הפרויקט");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/settings')}>
                    <Ionicons name="settings-outline" size={28} color="#1C1C1E" />
                </TouchableOpacity>
                <Text style={styles.title}>הפרויקטים שלי</Text>
            </View>

            <FlatList
                data={projects}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }: { item: Project }) => (
                    <View style={styles.projectCardContainer}>
                        <TouchableOpacity
                            style={styles.projectCard}
                            onPress={() => router.push({
                                pathname: '/project-details',
                                params: { projectId: item.id }
                            })}
                        >
                            <Ionicons name="chevron-back" size={20} color="#C7C7CC" />
                            <View style={styles.projectInfo}>
                                <Text style={styles.projectName}>{item.name}</Text>
                                <Text style={styles.projectDate}>הוקם ב: {item.startDate}</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.deleteAction}
                            onPress={() => confirmDelete(item.id, item.name)}
                        >
                            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="construct-outline" size={60} color="#D1D1D6" />
                        <Text style={styles.emptyText}>אין פרויקטים פעילים</Text>
                        <Text style={styles.emptySubText}>לחץ על הפלוס כדי להתחיל</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/new-project')}
            >
                <Ionicons name="add" size={36} color="white" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
        paddingTop: Platform.OS === 'android' ? 40 : 20
    },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1C1C1E' },
    listContent: { padding: 15, paddingBottom: 100 },
    projectCardContainer: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginBottom: 12,
        paddingRight: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    projectCard: {
        flex: 1,
        padding: 20,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    projectInfo: { alignItems: 'flex-end' },
    projectName: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
    projectDate: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
    deleteAction: {
        padding: 10,
        marginLeft: 5,
    },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#8E8E93', marginTop: 10 },
    emptySubText: { fontSize: 14, color: '#AEAEB2', marginTop: 5 },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        backgroundColor: '#007AFF',
        width: 65,
        height: 65,
        borderRadius: 32.5,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    }
});