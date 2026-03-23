import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { ProjectProvider } from '../ProjectContext';
export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <ProjectProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack screenOptions={{ headerTitleAlign: 'center' }}>
                    <Stack.Screen
                        name="index"
                        options={{ title: 'הדוחות שלי' }}
                    />

                    <Stack.Screen
                        name="editor"
                        options={{ title: 'עריכת דוח' }}
                    />

                    <Stack.Screen
                        name="settings"
                        options={{ title: 'הגדרות', presentation: 'card' }}
                    />

                    <Stack.Screen
                        name="review"
                        options={{ title: 'סקירת ליקויים', headerShown: false }}
                    />

                    <Stack.Screen
                        name="camera"
                        options={{ headerShown: false, presentation: 'fullScreenModal' }}
                    />

                    <Stack.Screen
                        name="modal"
                        options={{ title: 'פרויקט חדש', presentation: 'modal' }}
                    />
                </Stack>
            </ThemeProvider>
        </ProjectProvider>
    );
}