import { useState, useEffect } from 'react';
import { repository } from '../services/repository';

export function useRepository() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  return {
    repository,
    currentOrg: repository.getCurrentOrg(),
    currentOrgId: repository.getCurrentOrgId(),
    organizations: repository.getOrganizations(),
    currentUser: repository.getCurrentUser(),
    tours: repository.getTours(),
    scans: repository.getScans(),
    links: repository.getLinks(),
    contentItems: repository.getContentItems(),
    leads: repository.getLeads(),
    jobs: repository.getJobs(),
    floorPlans: repository.getFloorPlans(),
    notifications: repository.getNotifications(),
    customDomains: repository.getCustomDomains(),
    currentPlan: repository.getPlanForCurrentOrg()
  };
}
