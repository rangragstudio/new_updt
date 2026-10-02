import React, { useState } from 'react';
import { Navigation, AppView } from './components/Navigation';
import { DashboardScreen } from './screens/DashboardScreen';
import { ToursListScreen } from './screens/ToursListScreen';
import { TourEditorScreen } from './screens/TourEditorScreen';
import { LiveCaptureScreen } from './screens/LiveCaptureScreen';
import { LeadsInboxScreen } from './screens/LeadsInboxScreen';
import { SuperAdminScreen } from './screens/SuperAdminScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CreateTourModal } from './components/CreateTourModal';
import { PublishModal } from './components/PublishModal';
import { PublicVisitorView } from './components/PublicVisitorView';

export function App() {
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [publishTourId, setPublishTourId] = useState<string | null>(null);
  const [showCreateTourModal, setShowCreateTourModal] = useState(false);
  const [publicVisitorSlug, setPublicVisitorSlug] = useState<string | null>(null);

  // If in public walkthrough visitor view
  if (publicVisitorSlug) {
    return (
      <PublicVisitorView
        slug={publicVisitorSlug}
        onExit={() => setPublicVisitorSlug(null)}
      />
    );
  }

  // If inside full-screen 360 Tour Editor
  if (currentView === 'EDITOR' && activeTourId) {
    return (
      <>
        <TourEditorScreen
          tourId={activeTourId}
          onNavigateBack={() => setCurrentView('TOURS')}
          onOpenPublishModal={(id) => setPublishTourId(id)}
        />
        {publishTourId && (
          <PublishModal
            tourId={publishTourId}
            isOpen={true}
            onClose={() => setPublishTourId(null)}
            onOpenPublicView={(slug) => {
              setPublishTourId(null);
              setPublicVisitorSlug(slug);
            }}
          />
        )}
      </>
    );
  }

  // If inside Live Capture session
  if (currentView === 'CAPTURE') {
    return (
      <LiveCaptureScreen
        onNavigateBack={() => setCurrentView('DASHBOARD')}
        onOpenTour={(tourId) => {
          setActiveTourId(tourId);
          setCurrentView('EDITOR');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#F6F2EC] flex flex-col font-sans">
      <Navigation
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onCreateTour={() => setShowCreateTourModal(true)}
      />

      <main className="flex-1 pb-16 md:pb-8">
        {currentView === 'DASHBOARD' && (
          <DashboardScreen
            onOpenTour={(tourId) => {
              setActiveTourId(tourId);
              setCurrentView('EDITOR');
            }}
            onCreateTour={() => setShowCreateTourModal(true)}
            onOpenCapture={() => setCurrentView('CAPTURE')}
            onOpenLeads={() => setCurrentView('LEADS')}
          />
        )}

        {currentView === 'TOURS' && (
          <ToursListScreen
            onOpenTour={(tourId) => {
              setActiveTourId(tourId);
              setCurrentView('EDITOR');
            }}
            onCreateTour={() => setShowCreateTourModal(true)}
            onPublishTour={(tourId) => setPublishTourId(tourId)}
          />
        )}

        {currentView === 'LEADS' && <LeadsInboxScreen />}

        {currentView === 'ADMIN' && <SuperAdminScreen />}

        {currentView === 'SETTINGS' && <SettingsScreen />}
      </main>

      {/* Global Modals */}
      <CreateTourModal
        isOpen={showCreateTourModal}
        onClose={() => setShowCreateTourModal(false)}
        onCreated={(newTourId) => {
          setActiveTourId(newTourId);
          setCurrentView('EDITOR');
        }}
      />

      {publishTourId && (
        <PublishModal
          tourId={publishTourId}
          isOpen={true}
          onClose={() => setPublishTourId(null)}
          onOpenPublicView={(slug) => {
            setPublishTourId(null);
            setPublicVisitorSlug(slug);
          }}
        />
      )}
    </div>
  );
}

export default App;
