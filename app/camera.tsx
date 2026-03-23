// nard-app/app/camera.tsx

import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useProject } from '../ProjectContext';

export default function CameraScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<any>(null);
    const router = useRouter();
    const { projectId, reportId, itemId, locationName } = useLocalSearchParams(); // itemId עשוי להיות undefined
    const { addProjectItem } = useProject();
    const [isCapturing, setIsCapturing] = useState(false);

    if (!permission) return <View />;
    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>אנחנו זקוקים לאישור גישה למצלמה</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                    <Text style={styles.permissionButtonText}>אשר גישה</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        // אם כבר התחלנו לצלם, אל תעשה כלום
        if (isCapturing || !cameraRef.current) return;

        try {
            setIsCapturing(true); // חוסם לחיצות נוספות מיד

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                skipProcessing: false,
            });

            // Save photo to device gallery for backup/recovery
            try {
                const permResult = await MediaLibrary.requestPermissionsAsync();
                if (permResult.granted) {
                    await MediaLibrary.saveToLibraryAsync(photo.uri);
                }
            } catch (e) {
                console.warn('Failed to save photo to device gallery', e);
            }

            if (reportId) {
                try {
                    const stored = await AsyncStorage.getItem('projects');
                    if (stored) {
                        const projects = JSON.parse(stored);
                        const pIdx = projects.findIndex((p: any) => p.id === (projectId as string));
                        if (pIdx >= 0) {
                            const proj = projects[pIdx];
                            const rIdx = (proj.reports || []).findIndex((r: any) => r.id === (reportId as string));
                            if (rIdx >= 0) {
                                const rep = proj.reports[rIdx];
                                rep.items = rep.items || [];
                                let createdItemId: string | null = null;
                                if (itemId) {
                                    const itIdx = rep.items.findIndex((it: any) => it.id === (itemId as string));
                                    if (itIdx >= 0) {
                                        rep.items[itIdx].images = rep.items[itIdx].images ? [...rep.items[itIdx].images, photo.uri] : [photo.uri];
                                        createdItemId = rep.items[itIdx].id;
                                    } else {
                                        // itemId provided but not found: create it
                                        const newIt = { id: itemId as string, location: locationName || '', notes: '', images: [photo.uri], assignedTo: '' };
                                        rep.items.push(newIt);
                                        createdItemId = newIt.id;
                                    }
                                } else {
                                    // create new item in report
                                    const newItem = { id: Date.now().toString(), location: locationName || '', notes: '', images: [photo.uri], assignedTo: '' };
                                    rep.items.push(newItem);
                                    createdItemId = newItem.id;
                                }
                                projects[pIdx].reports[rIdx] = rep;
                                await AsyncStorage.setItem('projects', JSON.stringify(projects));
                                // save target so editor can scroll to the created/updated item on return
                                try {
                                    await AsyncStorage.setItem('cameraReturnTarget', JSON.stringify({ projectId: projectId as string, reportId: reportId as string, itemId: createdItemId }));
                                } catch (e) {
                                    console.warn('Failed to set cameraReturnTarget', e);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to save photo to report item', e);
                }
            } else {
                // Default: call addProjectItem to keep existing behavior (adds to project.items)
                addProjectItem(projectId as string, photo.uri, String(locationName || itemId || ''));
            }

            // חזרה למסך העורך
            router.back();
        } catch (e) {
            setIsCapturing(false); // במקרה של שגיאה, נאפשר לנסות שוב
            Alert.alert("שגיאה", "לא הצלחנו לצלם את התמונה");
        }
    };

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                ref={cameraRef}
                facing="back"
            >
                <View style={styles.overlay}>
                    {/* כפתור חזרה */}
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>✕</Text>
                    </TouchableOpacity>

                    {/* חיווי אם מוסיפים לתמונה קיימת או יוצרים חדשה */}
                    <View style={styles.infoBadge}>
                        <Text style={styles.infoText}>
                            {itemId ? "הוספת תמונה לליקוי קיים" : "צילום ליקוי חדש"}
                        </Text>
                    </View>

                    {/* כפתור צילום */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.captureButton, isCapturing && { opacity: 0.5 }]}
                            onPress={takePicture}
                            disabled={isCapturing} // מנטרל את הלחיצה ברמת הרכיב
                        >
                            <View style={styles.captureButtonInner} />
                        </TouchableOpacity>
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    message: { textAlign: 'center', color: '#fff', marginBottom: 20, fontSize: 16 },
    camera: { flex: 1 },
    overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between', padding: 30 },
    permissionButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignSelf: 'center' },
    permissionButtonText: { color: '#fff', fontWeight: 'bold' },
    backButton: { width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    backButtonText: { color: '#fff', fontSize: 20 },
    infoBadge: { alignSelf: 'center', backgroundColor: 'rgba(0,122,255,0.7)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    infoText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    buttonContainer: { width: '100%', alignItems: 'center', marginBottom: 20 },
    captureButton: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    captureButtonInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
});