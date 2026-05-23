import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Gallery from "./pages/Gallery";
import Admin from "./pages/Admin";
import Success from "./pages/Success";
import AlbumView from "./pages/AlbumView";
import Download from "./pages/Download";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/album/:albumId" element={<AlbumView />} />
          <Route path="/success/:orderId" element={<Success />} />
          <Route path="/download/:token" element={<Download />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            borderRadius: "2px",
          },
        }}
      />
    </div>
  );
}

export default App;
