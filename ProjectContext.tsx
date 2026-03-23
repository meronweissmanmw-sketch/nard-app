import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- הגדרות ה-Types ---
export interface ReportItem {
    id: string;
    location: string;
    notes: string;
    images: string[];
    assignedTo: string;
}

export interface Project {
    id: string;
    project: string;
    subject: string;
    date: string;
    initialNotes: string;
    finalNotes: string;
    structure?: {
        buildings: { id: number; floors: number }[];
        parkingFloors: number;
        hasDevelopment: boolean;
    };
    items: ReportItem[];
}

interface ProjectContextType {
    projects: Project[];
    createNewProject: (title: string, init: string, final: string, date: string, struct?: Project['structure']) => string;
    addProjectItem: (projectId: string, uri: string, selection: string, itemId?: string) => void;
    updateItemFields: (projectId: string, itemId: string, fields: Partial<ReportItem>) => void;
    updateProjectHeader: (projectId: string, fields: Partial<Pick<Project, 'project' | 'subject'>>) => void;
    deleteItem: (projectId: string, itemId: string) => void;
    deleteProject: (projectId: string) => void;
    undoProjects: () => void;
    redoProjects: () => void;
    canUndoProjects: boolean;
    canRedoProjects: boolean;
    undoItems: () => void;
    redoItems: () => void;
    canUndoItems: boolean;
    canRedoItems: boolean;
    clearItemsHistory: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = 'projects_storage_v1';

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([]);

    // היסטוריה
    const [projectsHistory, setProjectsHistory] = useState<Project[][]>([]);
    const [projectsFuture, setProjectsFuture] = useState<Project[][]>([]);
    const [itemsHistory, setItemsHistory] = useState<Project[][]>([]);
    const [itemsFuture, setItemsFuture] = useState<Project[][]>([]);

    // --- טעינה בטוחה מהדיסק ---
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) setProjects(parsed);
                }
            } catch (e) {
                console.error("Failed to load data", e);
            }
        };
        loadInitialData();
    }, []);

    // --- שמירה אוטומטית בכל שינוי ---
    const saveAndPersist = async (newProjects: Project[]) => {
        setProjects(newProjects);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
        } catch (e) {
            console.error("Failed to save data", e);
        }
    };

    const saveProjectsState = (current: Project[]) => {
        setProjectsHistory(prev => [...prev, JSON.parse(JSON.stringify(current))]);
        setProjectsFuture([]);
    };

    const saveItemsState = (current: Project[]) => {
        setItemsHistory(prev => [...prev, JSON.parse(JSON.stringify(current))]);
        setItemsFuture([]);
    };

    const createNewProject = (title: string, init: string, final: string, date: string, struct?: Project['structure']) => {
        saveProjectsState(projects);
        const newId = Date.now().toString();
        const newProject: Project = {
            id: newId,
            project: title || "פרויקט חדש",
            subject: title,
            date: date,
            initialNotes: init,
            finalNotes: final,
            structure: struct,
            items: []
        };
        saveAndPersist([newProject, ...projects]);
        return newId;
    };

    const addProjectItem = (projectId: string, uri: string, selection: string, itemId?: string) => {
        saveItemsState(projects);
        const updated = projects.map(p => {
            if (p.id !== projectId) return p;
            if (itemId) {
                return {
                    ...p,
                    items: p.items.map(i => i.id === itemId ? { ...i, images: [...i.images, uri] } : i)
                };
            }
            const newItem: ReportItem = {
                id: Date.now().toString(),
                location: selection,
                notes: "",
                assignedTo: "",
                images: [uri]
            };
            return { ...p, items: [newItem, ...p.items] };
        });
        saveAndPersist(updated);
    };

    const updateItemFields = (projectId: string, itemId: string, fields: Partial<ReportItem>) => {
        setProjects(prev => {
            const next = prev.map(p => {
                if (p.id !== projectId) return p;
                return {
                    ...p,
                    items: p.items.map(i => i.id === itemId ? { ...i, ...fields } : i)
                };
            });
            // כאן אנחנו שומרים לדיסק ללא הוספה להיסטוריה (כדי לא להכביד בזמן הקלדה)
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const updateProjectHeader = (projectId: string, fields: Partial<Pick<Project, 'project' | 'subject'>>) => {
        const updated = projects.map(p => p.id === projectId ? { ...p, ...fields } : p);
        saveAndPersist(updated);
    };

    const deleteProject = (projectId: string) => {
        saveProjectsState(projects);
        saveAndPersist(projects.filter(p => p.id !== projectId));
    };

    const deleteItem = (projectId: string, itemId: string) => {
        saveItemsState(projects);
        const updated = projects.map(p => {
            if (p.id !== projectId) return p;
            return { ...p, items: p.items.filter(i => i.id !== itemId) };
        });
        saveAndPersist(updated);
    };

    // --- Undo/Redo (מבוסס על saveAndPersist) ---
    const undoProjects = () => {
        if (projectsHistory.length === 0) return;
        const previous = projectsHistory[projectsHistory.length - 1];
        setProjectsFuture(prev => [JSON.parse(JSON.stringify(projects)), ...prev]);
        setProjectsHistory(prev => prev.slice(0, -1));
        saveAndPersist(previous);
    };

    const redoProjects = () => {
        if (projectsFuture.length === 0) return;
        const next = projectsFuture[0];
        setProjectsHistory(prev => [...prev, JSON.parse(JSON.stringify(projects))]);
        setProjectsFuture(prev => prev.slice(1));
        saveAndPersist(next);
    };

    const undoItems = () => {
        if (itemsHistory.length === 0) return;
        const previous = itemsHistory[itemsHistory.length - 1];
        setItemsFuture(prev => [JSON.parse(JSON.stringify(projects)), ...prev]);
        setItemsHistory(prev => prev.slice(0, -1));
        saveAndPersist(previous);
    };

    const redoItems = () => {
        if (itemsFuture.length === 0) return;
        const next = itemsFuture[0];
        setItemsHistory(prev => [...prev, JSON.parse(JSON.stringify(projects))]);
        setItemsFuture(prev => prev.slice(1));
        saveAndPersist(next);
    };

    const clearItemsHistory = () => {
        setItemsHistory([]);
        setItemsFuture([]);
    };

    return (
        <ProjectContext.Provider value={{
            projects, createNewProject, addProjectItem, updateItemFields,
            updateProjectHeader, deleteItem, deleteProject,
            undoProjects, redoProjects, canUndoProjects: projectsHistory.length > 0,
            canRedoProjects: projectsFuture.length > 0,
            undoItems, redoItems, canUndoItems: itemsHistory.length > 0,
            canRedoItems: itemsFuture.length > 0,
            clearItemsHistory
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) throw new Error('useProject must be used within a ProjectProvider');
    return context;
};