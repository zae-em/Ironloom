'use client';

import * as React from 'react';
import { getSupabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api-client';
import { AuthUserContext, Organization, Project, OrgRole } from '@ironloom/shared';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AuthUserContext | null;
  isLoading: boolean;
  activeOrg: Organization | null;
  userRole: OrgRole | null;
  organizations: Organization[];
  activeProject: Project | null;
  projects: Project[];
  setActiveOrgId: (orgId: string) => void;
  setActiveProjectId: (projectId: string) => void;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUserContext | null>(null);
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const router = useRouter();
  const pathname = usePathname();

  const loadUserData = React.useCallback(async (token?: string) => {
    try {
      if (token) {
        localStorage.setItem('ironloom_jwt', token);
      }

      // 1. Fetch user profile and orgs
      const profile = await apiClient.get<AuthUserContext>('/users/me');
      setUser(profile);

      // 2. Fetch list of organizations
      const orgList = await apiClient.get<Organization[]>('/organizations');
      setOrganizations(orgList);

      // 3. Determine active organization
      const storedOrgId = localStorage.getItem('ironloom_active_org');
      const validActiveOrgId =
        (storedOrgId && orgList.some((o) => o.id === storedOrgId) ? storedOrgId : null) ||
        orgList[0]?.id ||
        null;

      if (validActiveOrgId) {
        setActiveOrgIdState(validActiveOrgId);
        localStorage.setItem('ironloom_active_org', validActiveOrgId);

        // 4. Fetch projects for active org
        try {
          const projList = await apiClient.get<Project[]>(
            `/organizations/${validActiveOrgId}/projects`,
            {
              orgId: validActiveOrgId,
            },
          );
          setProjects(projList);

          const storedProjId = localStorage.getItem('ironloom_active_project');
          const validActiveProjId =
            (storedProjId && projList.some((p) => p.id === storedProjId) ? storedProjId : null) ||
            projList[0]?.id ||
            null;

          if (validActiveProjId) {
            setActiveProjectIdState(validActiveProjId);
            localStorage.setItem('ironloom_active_project', validActiveProjId);
          }
        } catch {
          setProjects([]);
        }
      }
    } catch {
      // If unauthenticated or token expired
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const supabase = getSupabase();

    // Check existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadUserData(session.access_token);
      } else {
        // In local development mode, try fallback JWT
        const fallbackJwt = localStorage.getItem('ironloom_jwt');
        if (fallbackJwt) {
          loadUserData(fallbackJwt);
        } else {
          setIsLoading(false);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        loadUserData(session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setOrganizations([]);
        setProjects([]);
        localStorage.removeItem('ironloom_jwt');
        localStorage.removeItem('ironloom_active_org');
        localStorage.removeItem('ironloom_active_project');
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const setActiveOrgId = (orgId: string) => {
    setActiveOrgIdState(orgId);
    localStorage.setItem('ironloom_active_org', orgId);

    // Refresh projects for the new org
    apiClient
      .get<Project[]>(`/organizations/${orgId}/projects`, { orgId })
      .then((projList) => {
        setProjects(projList);
        if (projList.length > 0) {
          setActiveProjectIdState(projList[0].id);
          localStorage.setItem('ironloom_active_project', projList[0].id);
        } else {
          setActiveProjectIdState(null);
          localStorage.removeItem('ironloom_active_project');
        }
      })
      .catch(() => setProjects([]));
  };

  const setActiveProjectId = (projectId: string) => {
    setActiveProjectIdState(projectId);
    localStorage.setItem('ironloom_active_project', projectId);
  };

  const signOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('ironloom_jwt');
    localStorage.removeItem('ironloom_active_org');
    localStorage.removeItem('ironloom_active_project');
    router.push('/login');
  };

  const activeOrg = organizations.find((o) => o.id === activeOrgId) || null;
  const activeMembership = user?.orgMemberships?.find((m) => m.orgId === activeOrgId);
  const userRole = activeMembership?.role || user?.role || null;
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        activeOrg,
        userRole,
        organizations,
        activeProject,
        projects,
        setActiveOrgId,
        setActiveProjectId,
        refreshUserData: () => loadUserData(),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
