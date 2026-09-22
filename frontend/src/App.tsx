// import { ThemeProvider, CssBaseline } from "@mui/material";
// import { theme } from "./theme";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import PatientList from "./pages/PatientList";
import PatientChart from "./pages/PatientChart";
import NoteForm from "./pages/NoteForm";
import InstructorQueue from "./pages/InstructorQueue";

function App() {
  return (
    
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/:patientId" element={<PatientChart />} />
          <Route path="/patients/:patientId/note" element={<NoteForm />} />
          <Route path="/review" element={<InstructorQueue />} />
        </Routes>
      </BrowserRouter>
    
  );
}

export default App;
