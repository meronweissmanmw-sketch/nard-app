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

                    {/* רישום מסך ההגדרות - זה מה שהיה חסר */}
                    <Stack.Screen
                        name="settingsScreen"
                        options={{ title: 'הגדרות', presentation: 'card' }}
                    />

                    <Stack.Screen
                        name="camera"
                        options={{ headerShown: false, presentation: 'fullScreenModal' }}
                    />

                    {/* אם יש לך מסך מודאל להוספת פרויקט, ודא שהוא רשום גם כן */}
                    <Stack.Screen
                        name="modal"
                        options={{ title: 'פרויקט חדש', presentation: 'modal' }}
                    />
                </Stack>
            </ThemeProvider>
        </ProjectProvider>
    );
}