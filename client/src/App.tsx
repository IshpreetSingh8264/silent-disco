import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Search } from './pages/Search';
import { Room } from './pages/Room';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { ArtistProfile } from './pages/ArtistProfile';
import { PlaylistDetail } from './pages/PlaylistDetail';
import { ProtectedRoute } from './components/ProtectedRoute'; // Moved ProtectedRoute to its own file
import { useAuthStore } from './store/useAuthStore';

// Removed local definition of ProtectedRoute as it's now imported

function App() {
  const { initializeSocket } = useAuthStore();

  useEffect(() => {
    initializeSocket();
  }, [initializeSocket]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="rooms" element={<Room />} />
          <Route path="library" element={<Library />} />
          <Route path="library/playlist/:id" element={<PlaylistDetail />} />
          <Route path="artist/:id" element={<ArtistProfile />} />
          <Route path="library/liked" element={<PlaylistDetail />} />
          {/* Add other routes here */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
