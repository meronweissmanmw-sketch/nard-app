import React, { createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProjectContextValue {
    createNewProject: (
        subject: string,
        initialNote: string,
        finalNote: string,
        date: string,
        structure: any
    ) => string;
    addProjectItem: (projectId: string, photoUri: string, locationName: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    /**
     * Creates a new project, persists it to AsyncStorage, and returns its ID.
     */
    const createNewProject = (
        subject: string,
        initialNote: string,
        finalNote: string,
        date: string,
        structure: any
    ): string => {
        const id = Date.now().toString();
        const newProject = {
            id,
            name: subject,
            startDate: date,
            initialNotes: initialNote,
            finalNotes: finalNote,
            structure,
            reports: [],
        };
        AsyncStorage.getItem('projects').then((data) => {
            const existing = data ? JSON.parse(data) : [];
            AsyncStorage.setItem('projects', JSON.stringify([...existing, newProject]));
        });
        return id;
    };

    /**
     * Adds a photo item to an existing project's top-level items list.
     * Used by camera.tsx when no reportId is provided (legacy path).
     */
    const addProjectItem = (projectId: string, photoUri: string, locationName: string) => {
        AsyncStorage.getItem('projects').then((data) => {
            if (!data) return;
            const projects = JSON.parse(data);
            const idx = projects.findIndex((p: any) => p.id === projectId);
            if (idx < 0) return;
            if (!projects[idx].items) projects[idx].items = [];
            projects[idx].items.push({
                id: Date.now().toString(),
                location: locationName,
                notes: '',
                images: [photoUri],
                assignedTo: '',
            });
            AsyncStorage.setItem('projects', JSON.stringify(projects));
        });
    };

    return (
        <ProjectContext.Provider value={{ createNewProject, addProjectItem }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject(): ProjectContextValue {
    const ctx = useContext(ProjectContext);
    if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
    return ctx;
}
